import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {viewSpec,perspectivesFor,pathTo} from '../src/core/viewspec';
import {parseManifest,documentFromAtlas} from '../src/core/atlas';
import {scanRepository,scanToDocument} from '../src/core/scan';
import {samples} from '../src/data/samples';
import type {Project} from '../src/core/model';
import {readRepository} from '../scripts/lib/readRepo';

const NOW=new Date('2026-10-07T08:00:00Z'),SHA='d'.repeat(40);
const shop=()=>[...readRepository('tests/fixtures/repo-shop'),{path:'.git/HEAD',text:'ref: refs/heads/main'},{path:'.git/refs/heads/main',text:SHA}];
const atlas=()=>{const {manifest}=parseManifest(readFileSync('tests/fixtures/atlas/shop.manifest.json','utf8'));
 return documentFromAtlas(manifest,{shop:{model:scanRepository(shop(),{name:'Shop'})},billing:{model:scanRepository(readRepository('tests/fixtures/repo-billing'),{name:'Billing'})}},{now:NOW}).document;};
const state=(d:Project,id:string)=>Object.fromEntries(perspectivesFor(d,id).map(p=>[p.perspective,p.state]));

test('perspectives: the same component ID across views, with explicit partial / unknown / unsupported states',()=>{
 const d=atlas();
 // The scanned system card is in the System context (system) and in CI/CD (cicd).
 const sys=state(d,'shop.system');
 assert.equal(sys.system,'available');assert.equal(sys.cicd,'available');
 assert.equal(sys.git,'unsupported');assert.equal(sys.agents,'unsupported');assert.equal(sys.decisions,'unsupported');
 assert.equal(sys.code,'unknown','the project has code views, none about the system card itself');
 // A container: available in System; its own modules view is a Code view, so Code is partial.
 const api=state(d,'shop.app-apps-api');assert.equal(api.system,'available');assert.equal(api.code,'partial');
 const open=perspectivesFor(d,'shop.app-apps-api').find(p=>p.perspective==='code')!;assert.match(open.views[0].viewId,/^shop\.components-/);
 // Identity is preserved: the same ID is a node in both perspective specs.
 const a=viewSpec(d,'shop.overview',{now:NOW}),b=viewSpec(d,'shop.delivery',{now:NOW});
 assert.ok(a.nodes.some(n=>n.id==='shop.system')&&b.nodes.some(n=>n.id==='shop.system'));
 assert.equal(a.perspective,'system');assert.equal(b.perspective,'cicd');
});

test('view spec: renderer-neutral, with drilldown path, children, revision vector, basis, confidence and legend',()=>{
 const d=atlas(),api=d.nodes.find(n=>n.id==='shop.app-apps-api')!;
 const spec=viewSpec(d,api.childViewId!,{now:NOW});
 assert.equal(spec.format,'diagramcloud.viewspec');assert.equal(spec.perspective,'code');
 assert.deepEqual(spec.path.map(p=>p.viewId),['atlas','shop.overview','shop.containers',api.childViewId]);
 assert.deepEqual(spec.path.map(p=>p.via),[undefined,'repo-shop','shop.system','shop.app-apps-api']);
 assert.equal(spec.snapshot?.repositories.find(r=>r.id==='shop')?.revision,SHA);
 assert.ok(spec.nodes.every(n=>n.group==='shop'&&n.basis==='static-source'));assert.deepEqual(spec.groups.map(g=>g.id),['shop']);
 assert.ok(spec.nodes.every(n=>n.evidenceRefs.length>0),'every scanned component points at its evidence');
 const containers=viewSpec(d,'shop.containers',{now:NOW});
 assert.ok(containers.edges.some(e=>e.confidence==='inferred')&&containers.edges.some(e=>e.confidence==='possible'));
 assert.ok(containers.legend.confidences.includes('possible')&&containers.legend.bases.includes('static-source'));
 assert.ok(containers.children.some(c=>c.nodeId==='shop.app-apps-api'));
 const root=viewSpec(d,'atlas',{now:NOW});assert.ok(root.edges.every(e=>e.basis==='planned'));assert.deepEqual(root.path.map(p=>p.viewId),['atlas']);
 assert.deepEqual(root.omissions,[]);
});

test('view spec: public audience removes private content and says so; unknown or private views are refused',()=>{
 const s=samples.find(x=>x.nodes.some(n=>n.childViewId))!;
 const priv:Project={...s,nodes:[...s.nodes,{...s.nodes[0],id:'secret-node',label:'SECRET-XYZ',visibility:'private',childViewId:undefined}],views:s.views.map(v=>v.id===s.rootViewId?{...v,nodeIds:[...v.nodeIds,'secret-node']}:v)};
 const spec=viewSpec(priv,s.rootViewId,{now:NOW});
 assert.ok(!JSON.stringify(spec).includes('SECRET-XYZ'));assert.match(spec.omissions.join(' '),/1 private or unreachable component/);
 assert.ok(JSON.stringify(viewSpec(priv,s.rootViewId,{audience:'author',now:NOW})).includes('SECRET-XYZ'));
 assert.throws(()=>viewSpec(priv,'nope'),/Unknown view/);
 // Views without an explicit perspective count as System; samples keep working.
 assert.equal(spec.perspective,'system');assert.equal(pathTo(s,s.rootViewId).length,1);
 const scan=scanToDocument(shop(),{now:NOW}).document;assert.equal(viewSpec(scan,'delivery',{now:NOW}).nodes.find(n=>n.id==='system')?.opens,'containers');
});


import {documentSchema,validateDocument} from '../src/core/model';
import {addExistingComponentToView,publicDocument} from '../src/core/operations';
function reusePerspectiveProject(){return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-reuse-perspective',title:'Synthetic existing perspectives',rootViewId:'root',nodes:[{id:'portal-left',label:'Left',childViewId:'left'},{id:'portal-right',label:'Right',childViewId:'right'},{id:'portal-private',label:'SYNTHETIC_PRIVATE_PORTAL',childViewId:'private-view',visibility:'private'},{id:'shared',label:'Existing canonical component'}],edges:[],views:[{id:'root',title:'Root',nodeIds:['portal-left','portal-right','portal-private']},{id:'left',title:'Homonymous perspective',perspective:'code',nodeIds:['shared']},{id:'right',title:'Homonymous perspective',perspective:'code',nodeIds:[]},{id:'private-view',title:'SYNTHETIC_PRIVATE_PERSPECTIVE',visibility:'private',perspective:'code',nodeIds:['shared']},{id:'orphan',title:'SYNTHETIC_UNREACHABLE_PERSPECTIVE',perspective:'code',nodeIds:['shared']}]}));}
test('native component reuse exposes both exact existing same-perspective targets without inferring a new view or identity',()=>{
 const input=reusePerspectiveProject(),raw=JSON.stringify(input),out=addExistingComponentToView(input,'right','shared',{x:10,y:20}),targets=perspectivesFor(out,'shared').find(row=>row.perspective==='code')!;
 assert.equal(targets.state,'available');assert.deepEqual(targets.views.map(view=>view.viewId),['left','right','private-view','orphan']);assert.equal(targets.views[0].title,targets.views[1].title);assert.deepEqual(pathTo(out,'right').map(view=>view.viewId),['root','right']);
 for(const id of ['left','right'])assert.deepEqual(viewSpec(out,id,{audience:'author'}).nodes.map(node=>node.id),['shared']);assert.equal(out.views.length,input.views.length);assert.equal(out.nodes.length,input.nodes.length);assert.equal(JSON.stringify(input),raw);
});
test('permitted perspective targets retain UNKNOWN and exclude unreachable/private navigation without name joins',()=>{
 const input=addExistingComponentToView(reusePerspectiveProject(),'right','shared',{x:10,y:20}),permitted=publicDocument(input),targets=perspectivesFor(permitted,'shared').find(row=>row.perspective==='code')!;
 assert.deepEqual(targets.views.map(view=>view.viewId),['left','right']);assert.deepEqual(pathTo(input,'orphan'),[]);assert.deepEqual(pathTo(permitted,'private-view'),[]);assert.ok(!JSON.stringify(permitted).includes('SYNTHETIC_PRIVATE_PERSPECTIVE'));assert.ok(!JSON.stringify(permitted).includes('SYNTHETIC_UNREACHABLE_PERSPECTIVE'));
 assert.equal(perspectivesFor(permitted,'shared').find(row=>row.perspective==='git')!.state,'unsupported');assert.equal(perspectivesFor(permitted,'not-supplied').find(row=>row.perspective==='code')!.state,'unknown');assert.deepEqual(perspectivesFor(permitted,'not-supplied').find(row=>row.perspective==='code')!.views,[]);
});
