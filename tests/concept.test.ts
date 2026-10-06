import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {conceptSpec} from '../src/export/concept';
import {orderedViews} from '../src/export/drawio';
import {publicDocument} from '../src/core/operations';
import {scanToDocument} from '../src/core/scan';
import type {Project} from '../src/core/model';
import {readRepository} from '../scripts/lib/readRepo';
import {checkConceptSpec} from './contracts/mosaicstudio/schema';

const NOW=new Date('2026-10-07T08:00:00Z');

test('MosaicStudio concept spec: every public view of every sample passes the owner validator without warnings',()=>{
 for(const s of samples)for(const v of orderedViews(publicDocument(s))){
  const {spec}=conceptSpec(s,v.id,{now:NOW}),r=checkConceptSpec(JSON.parse(JSON.stringify(spec)));
  assert.ok(r.ok,`${s.id}/${v.id}: ${r.ok?'':r.issues.slice(0,3).map(i=>`${i.path} ${i.message}`).join('; ')}`);
  assert.deepEqual(r.warnings,[],`${s.id}/${v.id}: no unknown fields`);
 }
});

test('MosaicStudio concept spec: IDs kept, basis carried as status, provenance honest, loss report explicit',()=>{
 const c=samples.find(s=>s.id==='contoso-forecasting')!;
 const {spec,report}=conceptSpec(c,'overview',{now:NOW});
 assert.deepEqual(spec.nodes.map(n=>n.id),c.views.find(v=>v.id==='overview')!.nodeIds,'same IDs as DiagramCloud');assert.deepEqual(report.idMap,{});
 assert.equal(spec.provenance,'documented');assert.match(spec.note,/contoso @ 61353848b4e7/);
 assert.equal(spec.nodes.find(n=>n.id==='fabric-app')?.status,'planned');assert.equal(spec.nodes.find(n=>n.id==='api')?.status,'active');
 assert.equal(spec.nodes.find(n=>n.id==='planner')?.kind,'users');assert.equal(spec.nodes.find(n=>n.id==='operational')?.kind,'sql-db');assert.equal(spec.nodes.find(n=>n.id==='bronze')?.kind,'lakehouse');
 assert.ok(spec.nodes.find(n=>n.id==='api')!.evidence!.some(e=>e.kind==='url'&&e.ref.includes('/blob/61353848')));
 assert.ok(spec.annotations?.some(a=>a.target==='fabric-app'),'drilldowns become notes');
 assert.match(report.lost.join(' '),/Positions, drilldown navigation/);
 // Scans: IDs with dots or underscores are rewritten and mapped; scanned components cite their evidence.
 const scan=scanToDocument(readRepository('tests/fixtures/repo-shop'),{now:NOW}).document;
 const out=conceptSpec(scan,'containers',{now:NOW});
 assert.ok(checkConceptSpec(out.spec).ok);
 for(const [from,to] of Object.entries(out.report.idMap)){assert.ok(/[^a-z0-9-]/.test(from)||from.length>48||/^[^a-z]/.test(from),from);assert.match(to,/^[a-z][a-z0-9-]{0,47}$/);}
 assert.equal(out.spec.provenance,'documented');
});

test('MosaicStudio concept spec: private components never leave; crowded layers spill into continuation domains',()=>{
 const s=samples.find(x=>x.nodes.some(n=>n.childViewId))!;
 const priv:Project={...s,nodes:[...s.nodes,{...s.nodes[0],id:'secret-node',label:'SECRET-XYZ',visibility:'private',childViewId:undefined}],views:s.views.map(v=>v.id===s.rootViewId?{...v,nodeIds:[...v.nodeIds,'secret-node']}:v)};
 const {spec,report}=conceptSpec(priv,s.rootViewId,{now:NOW});
 assert.ok(!JSON.stringify(spec).includes('SECRET-XYZ'));assert.match(report.lost.join(' '),/private/);
 const extra=Array.from({length:7},(_,i)=>`t${i}`);
 const crowd:Project={...s,nodes:[...s.nodes,...extra.map((id,i)=>({...s.nodes[0],id,label:`Table ${i}`,kind:'table' as const,childViewId:undefined,blockIds:[],sourceIds:[]}))],
  views:s.views.map(v=>v.id===s.rootViewId?{...v,nodeIds:[...v.nodeIds,...extra]}:v)};
 const r=conceptSpec(crowd,s.rootViewId,{now:NOW});assert.ok(checkConceptSpec(r.spec).ok);assert.ok(r.spec.domains.length>=3);assert.equal(r.spec.provenance,'synthetic');
});
