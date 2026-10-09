import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {scanRepository,wantedFile} from '../src/core/scan/scanner';
import {scanToDocument} from '../src/core/scan';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';

const ROOT='tests/fixtures/repo-shop';
function read(dir:string,out:{path:string;text:string}[]=[]){for(const n of readdirSync(dir)){const f=join(dir,n);if(statSync(f).isDirectory())read(f,out);else out.push({path:relative(ROOT,f).replace(/\\/g,'/'),text:readFileSync(f,'utf8')});}return out;}
const files=()=>read(ROOT);
const NOW=new Date('2026-10-06T12:00:00Z');

test('scanner: containers, compose links, Kubernetes, Terraform, CI, data lineage and imports, each with evidence and confidence',()=>{
 const m=scanRepository(files());
 const it=(k:string)=>{const v=m.items.get(k);assert.ok(v,`item ${k}`);return v!;};
 const link=(a:string,b:string)=>m.links.find(l=>l.from===a&&l.to===b);
 assert.equal(m.name,'shop');
 // Containers from manifests; the workspace root itself is not a container.
 assert.equal(it('c:apps/web').kind,'app');assert.equal(it('c:apps/api').kind,'process');assert.equal(it('c:worker').kind,'function');
 assert.ok(!m.items.has('c:.'));
 // Compose: depends_on is confirmed; postgres/redis images are the targets of the drivers in package.json.
 assert.equal(link('c:apps/web','c:apps/api')?.confidence,'confirmed');
 assert.equal(it('svc:db').tech,'postgresql');assert.equal(link('c:apps/api','svc:db')?.confidence,'confirmed');
 assert.equal(link('c:apps/api','x:s3')?.confidence,'inferred','a declared SDK is an inferred link');
 assert.equal(link('c:apps/api','x:stripe')?.confidence,'confirmed','an import statement confirms the dependency');
 assert.equal(link('c:apps/api','x:sentry')?.confidence,'possible','a key name in .env.example is only a hint');
 assert.ok(!m.items.has('x:postgresql'),'the compose postgres service is preferred over an external PostgreSQL node');
 // Kubernetes: the Deployment named like the compose service merges into it; Service + Ingress route to it.
 assert.ok(it('c:apps/api').evidence.some(e=>/Kubernetes Deployment “api”/.test(e.finding)));
 assert.equal(link('ing:shop (shop.example.com)','c:apps/api')?.confidence,'confirmed');
 assert.equal(link('c:apps/api','svc:cache')?.confidence,'confirmed');
 // Terraform: resources with a reference; module.
 assert.equal(it('tf:aws_s3_bucket.assets').provider,'AWS');
 assert.ok(link('tf:aws_cloudfront_distribution.cdn','tf:aws_s3_bucket.assets'));assert.ok(m.items.has('tf:module.network'));
 // CI targets.
 for(const t of ['deploy:aws','deploy:container registry','deploy:terraform apply'])assert.ok(link('ci:github-actions',t),t);
 // Data lineage: CTEs are not tables; CREATE AS SELECT, INSERT … SELECT, foreign keys, dbt ref/source, Prisma relations.
 assert.ok(link('t:orders','t:order_totals'));assert.ok(link('t:customers','t:order_totals'));assert.ok(!m.items.has('t:recent'));
 assert.ok(link('t:orders','t:daily_revenue'));assert.equal(link('t:orders','t:customers')?.label,'foreign key');
 assert.ok(link('t:stg_orders','t:revenue'));assert.ok(link('t:shop.orders','t:stg_orders'));assert.ok(link('t:order','t:customer'));
 // Components and files from imports (TypeScript relative imports, Python absolute and `from . import`).
 assert.equal(link('m:apps/api:routes','m:apps/api:db')?.confidence,'confirmed');
 assert.ok(link('m:apps/web:pages','m:apps/web:lib'));assert.ok(link('m:worker:jobs','m:worker:store'));
 assert.ok(link('f:worker/app/store/repo.py','f:worker/app/store/models.py'));
 assert.ok(link('f:apps/web/src/lib/format.ts','f:apps/web/src/lib/api.ts'));
 // Evidence points at a file and a line.
 const dep=link('c:apps/web','c:apps/api')!.evidence[0];assert.notEqual(dep.kind,'selection-metadata');if(dep.kind==='selection-metadata')throw new Error('Compose dependency must be source-backed');assert.equal(dep.file,'docker-compose.yml');assert.ok(dep.line>1);
 const s3=link('c:apps/api','x:s3')!.evidence[0];assert.notEqual(s3.kind,'selection-metadata');if(s3.kind==='selection-metadata')throw new Error('Package dependency must be source-backed');assert.equal(s3.file,'apps/api/package.json');
 assert.ok(readFileSync(join(ROOT,s3.file),'utf8').split('\n')[s3.line-1].includes('@aws-sdk/client-s3'));
});

test('scanner: secret files are never read and environment values never reach the document',()=>{
 const secret=[{path:'.env',text:'STRIPE_API_KEY=sk_live_SHOULD_NOT_APPEAR'},{path:'apps/api/.env.production',text:'DATABASE_URL=postgres://admin:hunter2@prod/shop'},{path:'deploy/key.pem',text:'-----BEGIN PRIVATE KEY-----'},{path:'infra/prod.tfvars',text:'password = "tfvar-secret"'}];
 const {document,report}=scanToDocument([...files(),...secret],{now:NOW});
 const json=JSON.stringify(document);
 for(const s of ['SHOULD_NOT_APPEAR','hunter2','PRIVATE KEY','tfvar-secret','user:password','shop:shop@db'])assert.ok(!json.includes(s),s);
 assert.match(report.lost.join(' '),/4 secret or credential file\(s\) never read/);
 for(const p of ['.env','.env.local','x/.env.production','a.pem','id_rsa','terraform.tfstate','prod.tfvars','node_modules/x/package.json','dist/app.js'])assert.equal(wantedFile(p),false,p);
 for(const p of ['.env.example','apps/api/package.json','.github/workflows/ci.yml','infra/main.tf','src/a.ts','.git/HEAD'])assert.equal(wantedFile(p),true,p);
});

test('scan document: macro → medium → mini → files drilldown, data lineage and infrastructure views, valid and public-safe',()=>{
 const {document:d,report}=scanToDocument(files(),{now:NOW,fileName:'repo-shop'});
 assert.doesNotThrow(()=>validateDocument(d));
 assert.equal(d.id,'repo-shop');assert.deepEqual(d.tags,['Scanned','Repository']);assert.equal(report.format,'repository');
 const view=(id:string)=>{const v=d.views.find(v=>v.id===id);assert.ok(v,id);return v!;};
 const node=(id:string)=>d.nodes.find(n=>n.id===id)!;
 assert.equal(d.rootViewId,'overview');assert.equal(node('system').childViewId,'containers');
 assert.ok(view('containers').nodeIds.includes('app-apps-api'));
 assert.ok(node('app-apps-api').childViewId?.startsWith('components-'));
 assert.ok(d.nodes.some(n=>n.label==='lib'&&n.childViewId?.startsWith('files-')),'a module drills into its files');
 assert.ok(view('data-lineage').nodeIds.length>=8);assert.ok(view('infrastructure-aws'));
 assert.equal(node('data-model').childViewId,'data-lineage');
 // Source tables and selected-directory metadata stay distinct. Confidence is a tag.
 for(const n of d.nodes){const b=d.blocks.find(b=>n.blockIds.includes(b.id));assert.ok(b&&b.type==='table'&&['source-derived','reference'].includes(b.provenance),`${n.id} has evidence`);if(b.provenance==='reference'){assert(b.title.includes('no source line'));assert(!b.columns.includes('Line'));}assert.ok(['confirmed','inferred','possible'].includes(n.tags[0]));}
 assert.ok(d.edges.some(e=>/\(inferred\)$/.test(e.label)));assert.ok(d.edges.some(e=>/\(possible\)$/.test(e.label)&&e.kind==='dependency'));
 // Scans are planned/designed information: no observations, and all content is reachable in public exports.
 assert.equal(d.observations.length,0);
 assert.equal(publicDocument(d).nodes.length,d.nodes.length);
 // Deterministic: the same files give the same document, so a rescan diffs by stable ID.
 assert.deepEqual(scanToDocument(files(),{now:NOW,fileName:'repo-shop'}).document,d);
});

test('scanner: git branch and commit from HEAD and refs; nothing else under .git is read',()=>{
 const sha='0123456789abcdef0123456789abcdef01234567';
 const m=scanRepository([...files(),{path:'.git/HEAD',text:'ref: refs/heads/main\n'},{path:'.git/refs/heads/main',text:`${sha}\n`},{path:'.git/config',text:'[remote "origin"] url = https://token@github.com/x'}]);
 assert.equal(m.branch,'main');assert.equal(m.commit,sha);
 const {document,report}=scanToDocument([...files(),{path:'.git/HEAD',text:'ref: refs/heads/main'},{path:'.git/packed-refs',text:`# pack\n${sha} refs/heads/main\n`},{path:'.git/config',text:'token@github.com'}],{now:NOW});
 assert.match(report.kept.join(' '),/main @ 0123456789ab/);
 assert.ok(!JSON.stringify(document).includes('token@'));
});

test('scanner: an unrelated folder has only the system; limits hold on a large synthetic repository',()=>{
 assert.equal(scanRepository([{path:'README.md',text:'# hi'}]).items.size,1);
 const big=Array.from({length:400},(_,i)=>({path:`src/m${i%60}/f${i}.ts`,text:`import {x} from '../m${(i+1)%60}/f${i+1}';\nexport const y=${i};`}));
 const {document}=scanToDocument([{path:'package.json',text:'{"name":"big","dependencies":{"react":"1"}}'},...big],{now:NOW});
 assert.ok(document.nodes.length<=500&&document.views.length<=80&&document.edges.length<=1500);
 assert.doesNotThrow(()=>validateDocument(document));
});

test('scanner: nested agent worktrees (.claude/worktrees) are skipped like node_modules, the repository itself is not',async()=>{
 const {IGNORED_DIR}=await import('../src/core/scan/scanner');
 for(const p of ['.claude/worktrees/','.claude/worktrees/agent-1/src/index.ts','app/.claude/worktrees/x/package.json','.worktrees/feature/src/a.ts'])assert.ok(IGNORED_DIR.test(p),p);
 for(const p of ['src/index.ts','.claude/settings.json','docs/worktrees/guide.md'])assert.ok(!IGNORED_DIR.test(p),p);
 assert.equal(wantedFile('.claude/worktrees/agent-1/package.json'),false);
});

test('repository reader: a nested clone or git worktree (its own .git) is skipped, the root repository is read',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{readRepository}=await import('../scripts/lib/readRepo');
 const root=mkdtempSync(join(tmpdir(),'dc-nested-'));
 try{mkdirSync(join(root,'.git','refs','heads'),{recursive:true});writeFileSync(join(root,'.git','HEAD'),'ref: refs/heads/main\n');writeFileSync(join(root,'package.json'),'{"name":"root"}');
  mkdirSync(join(root,'tools','other'),{recursive:true});writeFileSync(join(root,'tools','other','.git'),'gitdir: ../../.git/worktrees/other\n');writeFileSync(join(root,'tools','other','package.json'),'{"name":"other"}');
  mkdirSync(join(root,'lib'));writeFileSync(join(root,'lib','index.ts'),'export const a=1;');
  const paths=readRepository(root).map(f=>f.path);
  assert.ok(paths.includes('package.json')&&paths.includes('lib/index.ts')&&paths.includes('.git/HEAD'));assert.ok(!paths.some(p=>p.startsWith('tools/other')),paths.join(','));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('folder picker: files under a sub-folder with its own .git are left out, the repository root is kept',async()=>{
 const {nestedRepositoryPrefixes,outsideNestedRepositories}=await import('../src/core/scan/scanner');
 const paths=['.git/HEAD','package.json','src/a.ts','tools/other/.git','tools/other/package.json','vendor2/lib/.git/HEAD','vendor2/lib/x.ts','vendor2/keep.ts'];
 assert.deepEqual(nestedRepositoryPrefixes(paths),['tools/other','vendor2/lib']);
 assert.deepEqual(outsideNestedRepositories(paths.map(path=>({path}))).map(x=>x.path),['.git/HEAD','package.json','src/a.ts','vendor2/keep.ts']);
});
