"""Read-only independent verification of the first published release evidence commit."""
import hashlib,json,re,subprocess
from pathlib import Path
from datetime import datetime,timezone

root=Path(__file__).resolve().parents[2]
base=root/'.local/continuation'
bare=base/'remote-readback.git'
expected='856355e7e57073a7252e55e1eeb15b9555aabd5f'
source='130c70744ec8fdeefebb784c56afb53c182f8dfa'
prefix='docs/qualification/explanation-release-20261023/'
branch='refs/heads/codex/diagramcloud-release-evidence-20261023'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git','-C',str(bare),*args])
def require(ok,message):
    if not ok:raise RuntimeError(message)
require(git('rev-parse','--is-bare-repository').strip()==b'true','Readback is not a bare repository')
require(git('rev-parse','refs/heads/evidence').decode().strip()==expected,'Fetched branch identity differs')
require(git('show','-s','--format=%P',expected).decode().strip()==source,'Evidence commit parent differs')
remote=subprocess.check_output(['git','ls-remote','https://github.com/julian-passebecq/diagramcloud.git',branch]).decode().split()
require(remote and remote[0]==expected,'Remote branch moved after independent fetch')
tree=[]
for entry in git('ls-tree','-rz',expected,'--',prefix).split(b'\0'):
    if not entry:continue
    meta,name=entry.split(b'\t',1);mode,kind,oid=meta.decode().split()
    require(kind=='blob' and mode=='100644','Unexpected evidence tree entry')
    tree.append((name.decode(),oid))
raw=subprocess.check_output(['git','-C',str(bare),'cat-file','--batch'],input=('\n'.join(oid for _,oid in tree)+'\n').encode())
pos=0;files={}
for name,oid in tree:
    end=raw.index(b'\n',pos);header=raw[pos:end].decode().split();size=int(header[2]);data=raw[end+1:end+1+size];pos=end+size+2
    require(header[0]==oid,'Git object header mismatch');files[name]=data
require(len(files)==62,'Expected exactly 62 published evidence files')
manifest=json.loads((base/'release-evidence-manifest.json').read_text(encoding='utf-8'))
require(manifest['complete'] and not manifest['missing'],'Local manifest is incomplete')
local={row['target']:root/row['source'] for row in manifest['files']}
for name,filename in [('EVIDENCE-MANIFEST.json','release-evidence-manifest.json'),('EVIDENCE-SCAN.json','release-evidence-scan.json'),('SHA256SUMS.txt','RELEASE-EVIDENCE-SHA256SUMS.txt')]:local[prefix+name]=base/filename
require(set(local)==set(files),'Local and remote evidence file inventories differ')
sums={}
for line in files[prefix+'SHA256SUMS.txt'].decode().splitlines():
    match=re.fullmatch(r'([a-f0-9]{64})  (.+)',line);require(match is not None,'Malformed published checksum line')
    digest,name=match.groups();require(name not in sums,'Duplicate published checksum entry');sums[name]=digest
require(set(sums)=={name[len(prefix):] for name in files if name!=prefix+'SHA256SUMS.txt'},'Published checksum inventory differs')
rows=[]
for name,data in sorted(files.items()):
    digest=sha(data);local_bytes=local[name].read_bytes();rel=name[len(prefix):]
    require(local_bytes==data,'Remote and exact local evidence bytes differ: '+rel)
    require(rel=='SHA256SUMS.txt' or sums[rel]==digest,'Published checksum mismatch: '+rel)
    rows.append({'path':rel,'bytes':len(data),'sha256':digest,'exactLocalBytesMatch':True,'publishedChecksumMatch':None if rel=='SHA256SUMS.txt' else True})
for row in manifest['files']:
    require(row['sha256']==sha(files[row['target']]) and row['bytes']==len(files[row['target']]),'Manifest byte identity mismatch')
changed=git('diff-tree','--no-commit-id','--name-only','-r',source,expected).decode().splitlines()
require(set(changed)==set(files),'Evidence commit changed paths outside the exact allowlist')
receipt={'format':'diagramcloud.independent-evidence-readback/1','capturedAt':datetime.now(timezone.utc).isoformat(),
         'status':'PASS','repository':'julian-passebecq/diagramcloud','branch':branch,'commit':expected,'parent':source,
         'method':'Fresh fetch into a newly created ignored bare Git repository; raw git cat-file --batch bytes compared against exact local manifest and every published SHA256SUMS entry; remote branch rechecked independently.',
         'remoteWrites':False,'sourceWorktreeWrites':False,'files':len(files),'exactLocalByteMatches':len(rows),
         'publishedChecksumEntries':len(sums),'publishedChecksumMatches':len(sums),'manifestEntries':len(manifest['files']),
         'changedPathsOutsideEvidence':0,'mismatches':[],'entries':rows}
(base/'initial-evidence-readback.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='entries'},indent=2))
