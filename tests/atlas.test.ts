import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseManifest,documentFromAtlas,rescanRepository,addRepository,compareSnapshots,staleRepositories,type AtlasScan} from '../src/core/atlas';
import {scanRepository} from '../src/core/scan';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {readRepository} from '../scripts/lib/readRepo';

const NOW=new Date('2026-10-06T12:00:00Z'),LATER=new Date('2026-10-20T09:30:00Z');
const SHA_A='a'.repeat(40),SHA_B='b'.repeat(40),SHA_C='c'.repeat(40);
const git=(branch:string,sha:string)=>[{path:'.git/HEAD',text:`ref: refs/heads/${branch}\n`},{path:`.git/refs/heads/${branch}`,text:`${sha}\n`}];
const manifestText=readFileSync('tests/fixtures/atlas/shop.manifest.json','utf8');
const shopFiles=()=>[...readRepository('tests/fixtures/repo-shop'),...git('main',SHA_A)];
const billingFiles=()=>[...readRepository('tests/fixtures/repo-billing'),...git('release',SHA_B)];
function atlas(scans?:Record<string,AtlasScan>){
 const {manifest}=parseManifest(manifestText);
 return documentFromAtlas(manifest,scans??{shop:{model:scanRepository(shopFiles(),{name:'Shop'})},billing:{model:scanRepository(billingFiles(),{name:'Billing'})}},{now:NOW});
}

test('manifest: explicit membership only; credentials, unknown or self relationships and duplicate IDs are refused; DataPass project files are read as manifests',()=>{
 const m=JSON.parse(manifestText);
 assert.equal(parseManifest(manifestText).manifest.repositories.length,3);
 const bad=(patch:(x:typeof m)=>void,re:RegExp)=>{const x=structuredClone(m);patch(x);assert.throws(()=>parseManifest(JSON.stringify(x)),re);};
 bad(x=>{x.repositories[0].locator='https://user:ghp_secret@github.com/example/shop';},/credentials/);
 bad(x=>{x.repositories[0].locator='https://gitlab.com/x/y.git?private_token=abc';},/credentials/);
 bad(x=>{x.relationships.push({from:'shop',to:'nowhere'});},/unknown repository nowhere/);
 bad(x=>{x.relationships.push({from:'shop',to:'shop'});},/itself/);
 bad(x=>{x.repositories.push({...x.repositories[0]});},/Duplicate repository ID: shop/);
 assert.throws(()=>parseManifest('{"repositories":[]}'),/Not a project manifest/);
 const dp=parseManifest(JSON.stringify({schemaVersion:1,project:{id:'FOIL',title:'FOIL'},repositories:{Databricks_DAB:{path:'../foil_databrick_dab'},'web app':{path:'../web',label:'Web app'}}}));
 assert.equal(dp.source,'datapass');assert.deepEqual(dp.manifest.repositories.map(r=>[r.id,r.title,r.host,r.path]),[['databricks-dab','Databricks_DAB','local','../foil_databrick_dab'],['web-app','Web app','local','../web']]);
});

test('atlas: one project, N repositories, each at its own revision; scans drill down under their own ID prefix; relationships are planned',()=>{
 const {document:d,report}=atlas();
 assert.doesNotThrow(()=>validateDocument(d));assert.equal(report.format,'atlas');
 const root=d.views.find(v=>v.id===d.rootViewId)!;
 assert.deepEqual(root.nodeIds,['repo-shop','repo-billing','repo-handbook']);assert.equal(root.perspective,'system');
 const node=(id:string)=>d.nodes.find(n=>n.id===id)!;
 assert.equal(node('repo-shop').childViewId,'shop.overview');assert.equal(node('repo-billing').childViewId,'billing.overview');assert.equal(node('repo-handbook').childViewId,undefined);
 // Both scans have a `system` node; prefixes keep them apart, and nothing from one repository references the other.
 assert.ok(node('shop.system')&&node('billing.system'));
 for(const e of d.edges.filter(e=>e.id.startsWith('shop.')))assert.ok(e.source.startsWith('shop.')&&e.target.startsWith('shop.'));
 // Revision vector: no single project SHA.
 const snap=d.atlas!.snapshots[0];assert.equal(d.atlas!.activeSnapshotId,snap.id);
 assert.deepEqual(snap.repositories.map(r=>[r.id,r.revision,r.ref,r.scanStatus,r.authority]),[['shop',SHA_A,'main','scanned','git'],['billing',SHA_B,'release','scanned','git'],['handbook','1234567890abcdef1234567890abcdef12345678',undefined,'not-scanned','manifest']]);
 assert.match(report.kept[1],/shop @ aaaaaaaaaaaa, billing @ bbbbbbbbbbbb, handbook @ 1234567890ab/);
 // Basis and perspectives.
 assert.ok(d.edges.filter(e=>e.id.startsWith('rel-')).every(e=>e.basis==='planned'));
 assert.equal(node('repo-handbook').basis,'planned');assert.equal(node('repo-shop').basis,'static-source');assert.equal(node('shop.system').basis,'static-source');
 assert.ok(d.views.some(v=>v.id.startsWith('shop.components-')&&v.perspective==='code'));assert.equal(d.views.find(v=>v.id==='shop.data-lineage')?.perspective,'data');
 // Each card carries its facts with their basis; handbook's revision is declared by the manifest, not read from git.
 const facts=d.blocks.find(b=>b.id==='repo-handbook.facts');assert.ok(facts?.type==='table');assert.deepEqual(facts.rows.find(r=>r[0]==='Revision'),['Revision','1234567890abcdef1234567890abcdef12345678','manifest']);
 assert.match(report.lost.join(' '),/handbook: not scanned/);
 // Deterministic.
 assert.deepEqual(atlas().document,d);
});

test('atlas: rescanning one repository replaces only its subtree, keeps the previous snapshot and compares revision vectors',()=>{
 const {document:before}=atlas();
 const changed=[...readRepository('tests/fixtures/repo-billing'),...git('release',SHA_C),{path:'src/api/health.ts',text:"import {routes} from './routes';\nexport const ok=!!routes;"}];
 const {document:after,report}=rescanRepository(before,'billing',scanRepository(changed,{name:'Billing'}),LATER);
 const shop=(d:Project)=>JSON.stringify({n:d.nodes.filter(n=>n.id.startsWith('shop.')),e:d.edges.filter(e=>e.id.startsWith('shop.')),v:d.views.filter(v=>v.id.startsWith('shop.'))});
 assert.equal(shop(after),shop(before),'other repositories are untouched');
 assert.ok(after.nodes.some(n=>n.id.startsWith('billing.')&&n.label==='health.ts')||after.blocks.some(b=>b.id.startsWith('billing.')&&JSON.stringify(b).includes('health.ts')));
 assert.equal(after.atlas!.snapshots.length,2);
 const [a,b]=after.atlas!.snapshots;assert.equal(after.atlas!.activeSnapshotId,b.id);
 assert.deepEqual(compareSnapshots(a,b).map(c=>[c.id,c.change]),[['shop','unchanged'],['billing','revision-changed'],['handbook','unchanged']]);
 assert.match(report.kept.join(' '),/Previous revision: bbbbbbbbbbbb/);
 assert.throws(()=>rescanRepository(before,'nope',scanRepository(changed)),/not part of this atlas/);
});

test('atlas: stale and missing sources are listed, never guessed',()=>{
 const {document:d}=atlas({shop:{model:scanRepository(shopFiles(),{name:'Shop'})},billing:{missing:true}});
 const snap=d.atlas!.snapshots[0];
 const stale=Object.fromEntries(staleRepositories(snap,{now:LATER,maxAgeDays:7,current:{shop:SHA_C}}).map(s=>[s.id,s.reasons.join('; ')]));
 assert.match(stale.shop,/scanned 13 days ago/);assert.match(stale.shop,/source is now at cccccccccccc, snapshot has aaaaaaaaaaaa/);
 assert.match(stale.billing,/source folder not found/);assert.match(stale.billing,/revision unknown/);
 assert.match(stale.handbook,/never scanned/);
 assert.deepEqual(staleRepositories(snap,{now:NOW,current:{shop:SHA_A}}).map(s=>s.id),['billing','handbook']);
 // An unknown revision is never reported as unchanged.
 const unknown={...snap,repositories:snap.repositories.map(r=>r.id==='billing'?{...r,revision:SHA_B}:r)};
 assert.equal(compareSnapshots(snap,unknown).find(c=>c.id==='billing')!.change,'unknown');
});

test('atlas: adding a repository is an explicit edit; public exports keep only the active snapshot and public repositories',()=>{
 const {document:d}=atlas();
 const added=addRepository(d,{id:'warehouse',title:'Warehouse',host:'gitlab',locator:'https://gitlab.com/example/warehouse',role:'data'},LATER);
 assert.ok(added.views.find(v=>v.id===added.rootViewId)!.nodeIds.includes('repo-warehouse'));
 const snap=added.atlas!.snapshots.at(-1)!;assert.equal(snap.repositories.find(r=>r.id==='warehouse')?.scanStatus,'not-scanned');assert.equal(added.atlas!.snapshots.length,2);
 assert.throws(()=>addRepository(d,{id:'shop',title:'Again',host:'github',locator:'x'}),/already in this atlas/);
 assert.throws(()=>addRepository(d,{id:'Bad ID',title:'x',host:'github',locator:'x'}),/lowercase/);
 assert.throws(()=>addRepository(d,{id:'leak',title:'x',host:'github',locator:'https://me:token@github.com/x/y'}),/credentials/);
 // Private repository card and runtime pointers do not reach public output.
 const priv:Project=validateDocument({...added,nodes:added.nodes.map(n=>n.id==='repo-billing'?{...n,visibility:'private' as const}:n),
  atlas:{...added.atlas!,snapshots:added.atlas!.snapshots.map(s=>({...s,runtimeRefs:[{id:'run-1',sourceApp:'cloud',kind:'deployment',ref:'cloud://secret-env',basis:'observed' as const}]}))}});
 const pub=publicDocument(priv);
 assert.equal(pub.atlas!.snapshots.length,1);assert.equal(pub.atlas!.activeSnapshotId,snap.id);
 assert.ok(!pub.atlas!.snapshots[0].repositories.some(r=>r.id==='billing'));assert.deepEqual(pub.atlas!.snapshots[0].runtimeRefs,[]);
 assert.ok(!JSON.stringify(pub).includes('secret-env'));
});

test('atlas: many scanned repositories stay inside document limits',()=>{
 const base=JSON.parse(manifestText);
 base.repositories=Array.from({length:10},(_,i)=>({id:`shop-${i}`,title:`Shop ${i}`,host:'github',locator:`https://github.com/example/shop-${i}`}));base.relationships=[];
 const {manifest}=parseManifest(JSON.stringify(base)),model=scanRepository(shopFiles(),{name:'Shop'});
 const {document:d}=documentFromAtlas(manifest,Object.fromEntries(manifest.repositories.map(r=>[r.id,{model}])),{now:NOW});
 assert.doesNotThrow(()=>validateDocument(d));assert.ok(d.nodes.length<=500&&d.edges.length<=1500&&d.views.length<=80);
 assert.ok(manifest.repositories.every(r=>d.nodes.find(n=>n.id===`repo-${r.id}`)?.childViewId),'every scanned repository still drills down');
});

test('galaxy map: apps become declared members, connections become labelled relationships; live is static source, branch and planned stay planned',()=>{
 const {manifest,source,notes}=parseManifest(readFileSync('tests/fixtures/atlas/galaxy.sample.json','utf8'));
 assert.equal(source,'galaxy');assert.equal(manifest.project.id,'galaxy');
 assert.deepEqual(manifest.repositories.map(r=>[r.id,r.host,r.locator,r.role]),[['hub','github','https://github.com/example/hub','platform'],['notes','gitlab','example-group/notes','application'],['board','local','board','application'],['react','gitlab','example-react','application']]);
 assert.deepEqual(manifest.relationships.map(r=>[r.from,r.to,r.label,r.kind,r.basis]),[['notes','hub','notes.overview/1 · live','batch','static-source'],['hub','board','hub-reports · branch','query','planned'],['react','notes','notes-link · planned','control','planned']]);
 assert.match(notes!.join(' '),/hub → hub \(control-db\): an app reading its own contract/);assert.match(notes!.join(' '),/ghost → hub: unknown app/);
 const {document:d}=documentFromAtlas(manifest,{},{now:NOW});assert.doesNotThrow(()=>validateDocument(d));
 assert.ok(d.atlas!.snapshots[0].repositories.every(r=>r.scanStatus==='not-scanned'),'reading the map scans nothing');
});
