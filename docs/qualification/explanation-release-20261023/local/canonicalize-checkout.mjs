import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';
const root=process.cwd(), expected='130c70744ec8fdeefebb784c56afb53c182f8dfa';
const git=(a,o={})=>execFileSync('git',a,{cwd:root,maxBuffer:64*1024*1024,...o});
if(git(['rev-parse','HEAD']).toString().trim()!==expected||git(['status','--porcelain']).length)throw Error('Unexpected or dirty source');
const entries=git(['ls-tree','-rz','HEAD']).toString().split('\0').filter(Boolean).map(x=>{const [meta,name]=x.split('\t');const [mode,kind,oid]=meta.split(' ');return{mode,kind,oid,name};});
if(entries.some(x=>x.kind!=='blob'||!['100644','100755'].includes(x.mode)))throw Error('Unsupported tracked member');
const raw=git(['cat-file','--batch'],{input:Buffer.from(entries.map(x=>x.oid).join('\n')+'\n')});let at=0;const changes=[];
for(const e of entries){const end=raw.indexOf(10,at),header=raw.subarray(at,end).toString().split(' '),n=Number(header[2]),canonical=raw.subarray(end+1,end+1+n);at=end+2+n;if(header[0]!==e.oid)throw Error('Git object mismatch');
const target=path.resolve(root,e.name);if(!target.startsWith(root+path.sep)||fs.lstatSync(target).isSymbolicLink())throw Error('Unsafe tracked path');
const current=fs.readFileSync(target);if(!current.equals(canonical)){if(!Buffer.from(current.toString('utf8').replaceAll('\r\n','\n')).equals(canonical))throw Error('Difference is not CRLF-only: '+e.name);changes.push({target,canonical,name:e.name,before:crypto.createHash('sha256').update(current).digest('hex'),after:crypto.createHash('sha256').update(canonical).digest('hex')});}}
for(const c of changes)fs.writeFileSync(c.target,c.canonical);
git(['-c','core.autocrlf=false','add','--renormalize','--','.']);
if(git(['write-tree']).toString().trim()!==git(['rev-parse','HEAD^{tree}']).toString().trim())throw Error('Unexpected source tree after canonical index refresh');
if(git(['status','--porcelain']).length)throw Error('Unexpected Git delta after canonicalization');
const report={sourceSha:expected,trackedFiles:entries.length,filesRestored:changes.length,policy:'Exact Git blobs; preflight required every difference to be CRLF-only; no Git configuration change',files:changes.map(({name,before,after})=>({name,before,after}))};fs.writeFileSync('.local/continuation/checkout-canonicalization.json',JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({sourceSha:expected,trackedFiles:entries.length,filesRestored:changes.length})+'\n');
