import zipfile, tarfile, io, hashlib, json
from pathlib import Path
base=Path('.local/continuation')
with zipfile.ZipFile(base/'ci-39985734370/artifact.zip') as z:
    names=[n for n in z.namelist() if n.endswith('diagramcloud-web-build.tar.gz')]
    if len(names)!=1: raise ValueError('Expected exactly one CI web archive')
    with tarfile.open(fileobj=io.BytesIO(z.read(names[0]))) as t:
        ci={m.name.removeprefix('./'):hashlib.sha256(t.extractfile(m).read()).hexdigest() for m in t if m.isfile()}
with tarfile.open(base/'candidate-1.33.1-130c707/diagramcloud-web-build.tar.gz') as t:
    candidate={m.name.removeprefix('./'):hashlib.sha256(t.extractfile(m).read()).hexdigest() for m in t if m.isfile()}
result={'format':'diagramcloud.dist-membership-comparison/1','sourceSha':'130c70744ec8fdeefebb784c56afb53c182f8dfa','ciFiles':len(ci),'candidateFiles':len(candidate),'onlyCi':sorted(ci.keys()-candidate.keys()),'onlyCandidate':sorted(candidate.keys()-ci.keys()),'changed':sorted(p for p in ci.keys()&candidate.keys() if ci[p]!=candidate[p]),'identical':sum(ci[p]==candidate[p] for p in ci.keys()&candidate.keys())}
result['inspectedDifferences']={'galaxy/version-handshake.json':'Only generated_at differs; source revision and other fields match.','third-party-licenses.txt':'Build-host dependency inventory: Linux esbuild/rollup/lzma packages versus Windows esbuild/rollup packages.','method':'Read-only unified text comparison of both archive members; no equivalence claimed for changed raw bytes.'}
result['ciReceiptManifestCount']=127
result['ciReceiptManifestScope']='The CI receipt dist manifest excludes 13 source maps by design; each actual web archive contains 140 regular files.'
(base/'ci-candidate-dist-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
