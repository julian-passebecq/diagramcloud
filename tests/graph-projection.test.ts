import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileGraphSnapshot,previewGraphReimport,readGraphHistory} from '../src/intelligence/graphSnapshot';
import {graphProjection} from '../src/intelligence/graphProjection';
const fixture=()=>JSON.parse(readFileSync('tests/fixtures/night4/graph-fixture.json','utf8'));
test('producer recollection time can change without changing generation content or retained history',()=>{
 const g=fixture(),doc=compileGraphSnapshot(g).document;g.captured_at='2026-10-09T00:00:00Z';
 const result=previewGraphReimport(doc,g,doc.revision);assert.equal(result.delta.changes.length,0);assert.equal(readGraphHistory(result.document).length,1);
 g.assertions[0].predicate='different content';assert.throws(()=>previewGraphReimport(doc,g,doc.revision),/Generation identity conflict/);
});
test('canvas family/project scope filters actual memberships without modifying authored data',()=>{
 const doc=compileGraphSnapshot(fixture()).document,before=JSON.stringify(doc),view=doc.views.find(v=>v.id==='graph-view-task')!;
 const scoped=graphProjection(doc,view,{filter:{family:'evaluation'},collapsed:[]});
 assert.ok(scoped.view.nodeIds.length<view.nodeIds.length);
 assert.ok(scoped.project.edges.filter(e=>scoped.view.edgeIds.includes(e.id)).every(e=>scoped.view.nodeIds.includes(e.source)&&scoped.view.nodeIds.includes(e.target)));
 const empty=graphProjection(doc,view,{filter:{project:'missing-project'},collapsed:[]});assert.equal(empty.view.nodeIds.length,0);
 assert.equal(JSON.stringify(doc),before);
});
test('group collapse retains one real member, original assertion IDs, reversible positions and independent author cards',()=>{
 const doc=compileGraphSnapshot(fixture()).document,view=doc.views.find(v=>v.id==='graph-view-task')!;
 const open=graphProjection(doc,view,{filter:{},collapsed:[]});assert.ok(open.groups.length);
 const collapsed=graphProjection(doc,view,{filter:{},collapsed:[open.groups[0].id]});
 assert.ok(collapsed.view.nodeIds.length<open.view.nodeIds.length);
 assert.ok(collapsed.view.nodeIds.every(id=>doc.nodes.some(n=>n.id===id)));
 assert.ok(collapsed.view.edgeIds.every(id=>doc.edges.some(e=>e.id===id)));
 assert.deepEqual(graphProjection(doc,view,{filter:{},collapsed:[]}).view,view);
 assert.equal(graphProjection(doc,doc.views[0],{filter:{family:'evaluation'},collapsed:['demo-group']}).view,doc.views[0]);
});
