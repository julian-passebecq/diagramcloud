import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseManifest,documentFromAtlas,rescanRepository,addRepository,compareSnapshots,staleRepositories,parseLensMinimap,applyLensMinimap,lensHeads,type AtlasScan} from '../src/core/atlas';
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

test('Lens minimap: observed Git and delivery pointers in a new snapshot; components untouched; unknown repositories never added; scans go stale when the head moves',()=>{
 const {document:d}=atlas();
 const out=applyLensMinimap(d,parseLensMinimap(readFileSync('tests/fixtures/atlas/lens.minimap.json','utf8')),{now:LATER});
 const after=out.document,snap=after.atlas!.snapshots.at(-1)!;
 assert.equal(after.atlas!.snapshots.length,2);assert.equal(after.atlas!.activeSnapshotId,snap.id);assert.match(snap.label!,/Lens observation of 2026-10-20 10:00 UTC/);
 assert.deepEqual({n:after.nodes,e:after.edges,v:after.views},{n:d.nodes,e:d.edges,v:d.views},'components, connections and views are unchanged');
 // The scanned revision stays (it describes the content); Lens's head makes shop stale; billing is at the same head.
 assert.deepEqual(snap.repositories.map(r=>[r.id,r.revision,r.authority]),[['shop',SHA_A,'git'],['billing',SHA_B,'git'],['handbook','1234567890abcdef1234567890abcdef12345678','manifest']]);
 assert.deepEqual(lensHeads(snap),{shop:'e'.repeat(40),billing:SHA_B});
 const stale=Object.fromEntries(staleRepositories(snap,{now:LATER,current:lensHeads(snap)}).map(s=>[s.id,s.reasons.join('; ')]));
 assert.match(stale.shop,/source is now at eeeeeeeeeeee, snapshot has aaaaaaaaaaaa/);assert.ok(!stale.billing);
 const ref=(id:string)=>snap.runtimeRefs.find(r=>r.id===id);
 assert.equal(ref('lens.shop.ci')?.ref,'FAILED @ eeeeeeeeeeee');assert.ok(snap.runtimeRefs.every(r=>r.basis==='observed'&&r.sourceApp==='lens'));
 assert.equal(ref('lens.shop.request.1')?.ref,'https://github.com/example/shop/pull/42');assert.ok(!JSON.stringify(after).includes('SECRET-TOKEN'),'credential-bearing links are dropped');
 assert.match(ref('lens.shop.agent.1')!.note!,/Agent-reported running · WO-7 cart/);
 assert.match(out.report.lost.join(' '),/warehouse: not a member of this atlas, not added/);assert.match(out.report.lost.join(' '),/request 43 link carries credentials/);
 assert.match(out.report.kept.join(' '),/Shop: main @ eeeeeeeeeeee, CI FAILED, 2 request\(s\), 1 agent session\(s\)\. The scan is at aaaaaaaaaaaa: rescan to follow\./);
 assert.ok(!snap.repositories.some(r=>r.id==='warehouse'));
 // Public output carries none of it.
 assert.deepEqual(publicDocument(after).atlas!.snapshots[0].runtimeRefs,[]);
 // Refusals change nothing.
 assert.throws(()=>parseLensMinimap('{"format":"datapass.lens.minimap","version":2}'),/rejected/);
 const none=JSON.parse(readFileSync('tests/fixtures/atlas/lens.minimap.json','utf8'));none.repositories=none.repositories.slice(2);
 assert.throws(()=>applyLensMinimap(d,parseLensMinimap(JSON.stringify(none))),/No repository of this Lens minimap is a member/);
});


test('Lens minimap whose commits have no parents produces no commit edges, nodes or pointers and says the commits were not read',()=>{
 const {document:d}=atlas(),raw=JSON.parse(readFileSync('tests/fixtures/atlas/lens.minimap.json','utf8'));
 raw.repositories[0].commits=[{sha:'e'.repeat(40),message:'COMMIT_SENTINEL root'},{sha:'f'.repeat(40),parents:[],message:'COMMIT_SENTINEL orphan'}];
 const plain=applyLensMinimap(d,parseLensMinimap(readFileSync('tests/fixtures/atlas/lens.minimap.json','utf8')),{now:LATER}),out=applyLensMinimap(d,parseLensMinimap(JSON.stringify(raw)),{now:LATER});
 assert.deepEqual({n:out.document.nodes,e:out.document.edges,v:out.document.views},{n:d.nodes,e:d.edges,v:d.views});
 const refs=(r:typeof out)=>r.document.atlas!.snapshots.at(-1)!.runtimeRefs;
 assert.deepEqual(refs(out),refs(plain),'commits add no runtime pointer');assert.ok(!refs(out).some(r=>/commit/i.test(r.kind)));
 assert.doesNotMatch(JSON.stringify(out.document),/COMMIT_SENTINEL|f{40}/);
 assert.match(out.report.lost.join(' '),/2 commit\(s\) in the Lens file were not read: DiagramCloud never draws a commit graph/);
 assert.doesNotMatch(plain.report.lost.join(' '),/commit\(s\) in the Lens file/);
});
test('Galaxy consumer refuses duplicate exact source app IDs before guessing endpoints, without echoing private input',()=>{
 const privateId='SYNTHETIC_PRIVATE_DUPLICATE_APP_ID',first={id:privateId,name:'SYNTHETIC_PRIVATE_FIRST_NAME',path:'SYNTHETIC_PRIVATE_FIRST_PATH'},second={id:privateId,name:'SYNTHETIC_PRIVATE_SECOND_NAME',repo:'SYNTHETIC_PRIVATE_REMOTE'};
 for(const duplicateRows of [[first,second],[second,first],[first,{...first}]]){
  const input={apps:[...duplicateRows,{id:'consumer',name:'Synthetic consumer'}],contracts:[],connections:[{from:privateId,to:'consumer',kind:'file',contract:'Synthetic declared output',status:'planned'}]},raw=JSON.stringify(input);
  assert.throws(()=>parseManifest(raw),(error:unknown)=>error instanceof Error&&error.message==='Ambiguous Galaxy app identities. No project was created.'&&!error.message.includes('SYNTHETIC_PRIVATE'));
  assert.equal(JSON.stringify(input),raw,'source declaration bytes are not rewritten to remove duplicates');
 }
});

test('Galaxy homonymous labels and distinct source IDs with colliding slugs retain separate existing endpoint mappings',()=>{
 const a={id:'shared_name',name:'Synthetic equal display label'},b={id:'shared-name',name:'Synthetic equal display label'},consumer={id:'consumer',name:'Synthetic consumer'};
 for(const apps of [[a,b,consumer],[b,a,consumer]]){
  const input={apps,contracts:[],connections:[{from:a.id,to:consumer.id},{from:b.id,to:consumer.id},{from:'not-selected',to:consumer.id}]},raw=JSON.stringify(input),result=parseManifest(raw),repositories=result.manifest.repositories;
  assert.equal(repositories.length,3);assert.equal(new Set(repositories.map(r=>r.id)).size,3);assert.equal(repositories.filter(r=>r.title===a.name).length,2);
  assert.deepEqual(new Set(repositories.filter(r=>r.title===a.name).map(r=>r.id)),new Set(['shared-name','shared-name-2']),'existing local suffix behavior remains; no new canonical identity rule');
  const bySource=new Map(repositories.map(r=>[r.locator,r.id]));assert.notEqual(bySource.get(a.id),bySource.get(b.id));
  assert.deepEqual(result.manifest.relationships.map(r=>[r.from,r.to]),[[bySource.get(a.id),bySource.get(consumer.id)],[bySource.get(b.id),bySource.get(consumer.id)]]);
  assert.ok(result.notes?.some(note=>/unknown app, not drawn/.test(note)),'existing unknown-endpoint omission remains');assert.equal(JSON.stringify(input),raw);
 }
});

const galaxyCapacityError='Galaxy scope exceeds the supported limit of 40 applications. Select a smaller explicit scope. No project was created.';
function galaxyCapacityInput(count:number){return {apps:Array.from({length:count},(_,i)=>({id:`app-${String(i+1).padStart(2,'0')}`,name:'Synthetic homonymous application',repo:`example/synthetic-${i+1}`})),contracts:[],connections:[] as {from:string;to:string;kind?:string;contract?:string;status?:string}[]};}

test('Galaxy capacity accepts all40 explicit apps and preserves connections involving the final app without a scan or guessed revision',()=>{
 const input=galaxyCapacityInput(40);input.connections=[{from:'app-40',to:'app-01',kind:'file',contract:'Synthetic final output',status:'planned'},{from:'app-01',to:'app-40',kind:'query',contract:'Synthetic final input',status:'branch'}];const raw=JSON.stringify(input),out=parseManifest(raw);assert.equal(out.source,'galaxy');assert.equal(out.manifest.repositories.length,40);assert.equal(out.manifest.repositories.at(-1)!.id,'app-40');assert.equal(new Set(out.manifest.repositories.map(r=>r.id)).size,40);
 assert.deepEqual(out.manifest.relationships.map(r=>[r.from,r.to,r.kind,r.basis]),[['app-40','app-01','batch','planned'],['app-01','app-40','query','planned']]);assert.deepEqual(out.notes,[]);
 const doc=documentFromAtlas(out.manifest,{},{now:NOW}).document;validateDocument(doc);assert.equal(doc.nodes.length,40);assert.ok(doc.nodes.some(n=>n.id==='repo-app-40'));assert.deepEqual(doc.edges.map(e=>[e.source,e.target]),[['repo-app-40','repo-app-01'],['repo-app-01','repo-app-40']]);assert.equal(doc.atlas!.snapshots[0].repositories.length,40);assert.ok(doc.atlas!.snapshots[0].repositories.every(r=>r.revision===undefined&&r.scanStatus==='not-scanned'&&r.authority==='manifest'));assert.deepEqual(doc.observations,[]);assert.equal(JSON.stringify(input),raw);
});

test('Galaxy41 apps rejects identically with no silent subset whether links name the outside app or no links exist',()=>{
 const input=galaxyCapacityInput(41),outside=input.apps[40];outside.id='SYNTHETIC_PRIVATE_CAPACITY_APP';outside.name='SYNTHETIC_PRIVATE_CAPACITY_NAME';outside.repo='example/SYNTHETIC_PRIVATE_CAPACITY_REMOTE';
 const variants=[[],[{from:outside.id,to:'app-01',kind:'file'}],[{from:'app-01',to:outside.id,kind:'query'}],[{from:outside.id,to:'SYNTHETIC_PRIVATE_UNKNOWN_ENDPOINT',kind:'file'}]];
 for(const connections of variants)for(const apps of [input.apps,[...input.apps].reverse()]){const value={...input,apps,connections},raw=JSON.stringify(value);assert.throws(()=>parseManifest(raw),(error:unknown)=>error instanceof Error&&error.message===galaxyCapacityError&&!error.message.includes('SYNTHETIC_PRIVATE'));assert.equal(JSON.stringify(value),raw);}
});

test('Galaxy overcapacity refuses before resolving a duplicate outside the first40 without exposing any source identity',()=>{
 const input=galaxyCapacityInput(40),duplicate={...input.apps[0],name:'SYNTHETIC_PRIVATE_DUPLICATE_NAME',path:'C:/SYNTHETIC_PRIVATE_DUPLICATE_PATH'};
 for(const apps of [[...input.apps,duplicate],[duplicate,...input.apps]]){const value={...input,apps,connections:[{from:duplicate.id,to:'app-40',kind:'file'}]},raw=JSON.stringify(value);assert.throws(()=>parseManifest(raw),(error:unknown)=>error instanceof Error&&error.message===galaxyCapacityError&&!error.message.includes('SYNTHETIC_PRIVATE'));assert.equal(JSON.stringify(value),raw);}
});

test('Galaxy duplicate identity within capacity keeps its existing refusal and native manifest limits remain unchanged',()=>{
 const input=galaxyCapacityInput(40);input.apps[39]={...input.apps[0]};assert.throws(()=>parseManifest(JSON.stringify(input)),(error:unknown)=>error instanceof Error&&error.message==='Ambiguous Galaxy app identities. No project was created.');
 const supported=parseManifest(JSON.stringify(galaxyCapacityInput(40))).manifest;assert.equal(parseManifest(JSON.stringify(supported)).manifest.repositories.length,40);const extra={...supported.repositories[0],id:'extra'};assert.throws(()=>parseManifest(JSON.stringify({...supported,repositories:[...supported.repositories,extra]})));
});

import {createHash as provenanceHash} from 'node:crypto';
import {mkdtempSync as provenanceTemp,writeFileSync as provenanceWrite,rmSync as provenanceRemove} from 'node:fs';
import {tmpdir as provenanceTmpdir} from 'node:os';
import {join as provenanceJoin} from 'node:path';
import {spawnSync as provenanceSpawn} from 'node:child_process';
import {attachGalaxyImportProvenance,GALAXY_PROVENANCE_UNAVAILABLE} from '../src/core/atlas/compose';
import {GALAXY_IMPORT_PROVENANCE_BLOCK,GALAXY_IMPORT_PROVENANCE_PREFIX,parseGalaxyImportProvenance,prepareGalaxyImportProvenance} from '../src/core/atlas/manifest';
import {portfolioHtml as provenanceHtml} from '../src/export/html';
import {svgDiagram as provenanceSvg} from '../src/export/diagram';

const provenanceInput=()=>({apps:[{id:'shared_name',name:'Synthetic same label',repo:'example/synthetic-first'},{id:'shared-name',name:'Synthetic same label',repo:'example/synthetic-second'}],contracts:[],connections:[{from:'shared_name',to:'shared-name',kind:'file',status:'planned'}]});
function provenanceOf(doc:Project){const block=doc.blocks.find(b=>b.id===GALAXY_IMPORT_PROVENANCE_BLOCK);return block?.type==='code'?parseGalaxyImportProvenance(block.code):undefined;}

test('Forward Galaxy provenance captures exact assigned IDs and decoded UTF8 text; default conversion/citations/facts remain unchanged',async()=>{
 const raw='  '+JSON.stringify(provenanceInput(),null,2)+'\n',parsed=parseManifest(raw),base=documentFromAtlas(parsed.manifest,{},{now:NOW}).document,before=JSON.stringify(base);
 assert.equal(provenanceOf(base),undefined);assert.equal('bindings' in parsed,false);const captured=await attachGalaxyImportProvenance(base,raw,{now:NOW});assert.equal(captured.captured,true);const receipt=provenanceOf(captured.document)!;
 assert.deepEqual(receipt.mappings,[{sourceAppId:'shared_name',repositoryId:'shared-name',nodeId:'repo-shared-name'},{sourceAppId:'shared-name',repositoryId:'shared-name-2',nodeId:'repo-shared-name-2'}]);
 assert.equal(receipt.input.digestDomain,'decoded-text-utf8');assert.equal(receipt.input.sha256,provenanceHash('sha256').update(raw,'utf8').digest('hex'));assert.notEqual(receipt.input.sha256,provenanceHash('sha256').update(JSON.stringify(JSON.parse(raw))).digest('hex'));assert.equal(receipt.input.utf8Bytes,new TextEncoder().encode(raw).byteLength);
 assert.equal(receipt.namespace,null);assert.equal(receipt.bindingState,'unbound');assert.equal(receipt.synthetic,null);assert.equal(receipt.input.upstreamVersion,null);assert.equal(receipt.capturedAt,NOW.toISOString());
 assert.deepEqual(captured.document.sources,base.sources);assert.deepEqual(captured.document.nodes.map(n=>n.sourceIds),base.nodes.map(n=>n.sourceIds));assert.deepEqual(captured.document.edges,base.edges);assert.deepEqual(captured.document.atlas,base.atlas);assert.deepEqual(captured.document.observations,[]);assert.equal(JSON.stringify(base),before);
 const added=captured.document.blocks.filter(b=>!base.blocks.some(old=>old.id===b.id));assert.equal(added.length,1);assert.equal(added[0].visibility,'private');assert.ok(added[0].type==='code'&&added[0].code.length<=48000);assert.equal(new TextEncoder().encode(JSON.stringify(captured.document)).byteLength<12*1024*1024,true);validateDocument(captured.document);
});

test('Forward capture is unavailable for unsafe/unrepresentable exact IDs or reserved evidence collisions without partial edits',async()=>{
 for(const sourceAppId of ['x'.repeat(1001),'unsafe\u0000id','password=synthetic-unusable']){const input=provenanceInput();input.apps[0].id=sourceAppId;input.connections=[];const raw=JSON.stringify(input),base=documentFromAtlas(parseManifest(raw).manifest,{},{now:NOW}).document,before=JSON.stringify(base),result=await attachGalaxyImportProvenance(base,raw,{now:NOW});assert.equal(result.captured,false);assert.equal(result.message,GALAXY_PROVENANCE_UNAVAILABLE);assert.strictEqual(result.document,base);assert.equal(JSON.stringify(base),before);assert.equal(provenanceOf(base),undefined);}
 const raw=JSON.stringify(provenanceInput()),base=documentFromAtlas(parseManifest(raw).manifest,{},{now:NOW}).document;base.blocks.push({id:GALAXY_IMPORT_PROVENANCE_BLOCK,title:'Synthetic existing author evidence',type:'text',text:'Retain exactly',visibility:'private',sourceIds:[],provenance:'author'});const before=JSON.stringify(base),result=await attachGalaxyImportProvenance(base,raw,{now:NOW});assert.equal(result.captured,false);assert.equal(JSON.stringify(result.document),before);
 const forty=galaxyCapacityInput(40),complete=await attachGalaxyImportProvenance(documentFromAtlas(parseManifest(JSON.stringify(forty)).manifest,{},{now:NOW}).document,JSON.stringify(forty),{now:NOW});assert.equal(provenanceOf(complete.document)!.mappings.length,40);assert.equal(complete.captured,true);
});

test('Forward receipt codec rejects forged/ambiguous fields without becoming identity authority; old no-receipt remains UNKNOWN',async()=>{
 const raw=JSON.stringify(provenanceInput()),prepared=(await prepareGalaxyImportProvenance(raw,'atlas-galaxy','snap-synthetic',NOW))!,receipt=prepared.receipt;
 for(const value of [{...receipt,unexpected:'synthetic'},{...receipt,namespace:'guessed-org'},{...receipt,bindingState:'reviewed'},{...receipt,format:'datapass.graph/1'},{...receipt,mappings:[receipt.mappings[0],receipt.mappings[0]]},{...receipt,mappings:receipt.mappings.map((m,i)=>i?{...m,nodeId:'repo-wrong'}:m)},{...receipt,input:{...receipt.input,sha256:'not-a-digest'}}])assert.equal(parseGalaxyImportProvenance(JSON.stringify(value)),undefined);
 assert.equal(parseGalaxyImportProvenance('x'.repeat(48001)),undefined);assert.equal(parseGalaxyImportProvenance('{'),undefined);const old=documentFromAtlas(parseManifest(raw).manifest,{},{now:NOW}).document;assert.equal(provenanceOf(old),undefined);assert.equal(old.atlas!.snapshots[0].repositories.some(r=>r.revision!==undefined),false);
});

test('Forward private receipt cannot alter public captions/counts/exports even after all evidence visibility is toggled',async()=>{
 const raw=JSON.stringify(provenanceInput()),base=documentFromAtlas(parseManifest(raw).manifest,{},{now:NOW}).document,captured=(await attachGalaxyImportProvenance(base,raw,{now:NOW})).document,receipt=provenanceOf(captured)!;
 for(const block of captured.blocks)block.visibility='public';for(const node of captured.nodes){node.visibility='public';node.summary='Synthetic public caption retained';}for(const node of base.nodes)node.summary='Synthetic public caption retained';
 const expected=publicDocument(base),actual=publicDocument(captured);assert.deepEqual(actual,expected);assert.equal(actual.blocks.some(b=>b.id.startsWith(GALAXY_IMPORT_PROVENANCE_PREFIX)),false);assert.ok(actual.nodes.every(n=>n.summary==='Synthetic public caption retained'));
 const bytes=JSON.stringify(actual)+provenanceHtml(captured)+provenanceSvg(captured,captured.rootViewId);assert.ok(!bytes.includes(receipt.input.sha256));assert.ok(!bytes.includes('diagramcloud.galaxy-import-provenance/1'));assert.ok(!bytes.includes('shared_name'));assert.equal(JSON.stringify(captured).includes(receipt.input.sha256),true,'full authoring backup intentionally retains private metadata');
});

test('Atlas CLI capture flag is explicit, hashes exact decoded input and keeps --previous as history without ID reuse',()=>{
 const folder=provenanceTemp(provenanceJoin(provenanceTmpdir(),'diagramcloud-galaxy-provenance-'));try{
  const source=provenanceJoin(folder,'synthetic.json'),first=provenanceJoin(folder,'first.json'),next=provenanceJoin(folder,'next.json'),raw=' '+JSON.stringify(provenanceInput(),null,2)+'\n';provenanceWrite(source,raw);
  const run=(args:string[])=>{const child=provenanceSpawn(process.execPath,['--import','tsx','scripts/atlas.ts',source,...args],{encoding:'utf8',timeout:20000});assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);return child.stderr;};
  const defaultLog=run(['--out',first]);assert.ok(!defaultLog.includes('Private Galaxy import provenance captured.'));const prior=validateDocument(JSON.parse(readFileSync(first,'utf8')));assert.equal(provenanceOf(prior),undefined);
  const captureLog=run(['--capture-galaxy-provenance','--previous',first,'--out',next]);assert.equal(captureLog.split(/\r?\n/).filter(line=>line==='Private Galaxy import provenance captured. No namespace binding or ID reuse.').length,1);const captured=validateDocument(JSON.parse(readFileSync(next,'utf8'))),receipt=provenanceOf(captured)!;assert.equal(receipt.input.sha256,provenanceHash('sha256').update(raw,'utf8').digest('hex'));assert.equal(receipt.namespace,null);assert.equal(captured.atlas!.snapshots.length,2);assert.deepEqual(captured.atlas!.snapshots[0],prior.atlas!.snapshots[0]);assert.deepEqual(captured.nodes.map(n=>n.id),prior.nodes.map(n=>n.id));assert.equal(readFileSync(source,'utf8'),raw);assert.deepEqual(captured.observations,[]);
 }finally{assert.ok(folder.startsWith(provenanceJoin(provenanceTmpdir(),'diagramcloud-galaxy-provenance-')));provenanceRemove(folder,{recursive:true,force:true});}
});
