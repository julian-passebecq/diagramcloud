import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone} from '../src/core/model';
import {applyDocumentPatch,applyOperations,applyPackPatch,isPatch,patchTemplate,type Operation} from '../src/core/patch';
import {describeChanges} from '../src/core/changeDetail';

const total=samples.find(s=>s.id==='total-project-controls')!;
const patch=(operations:Operation[],over:Record<string,unknown>={})=>({format:'diagramcloud.patch',version:1,target:'project',targetId:total.id,baseRevision:total.revision,summary:'test',operations,...over});

test('stable-ID paths edit by id, the result validates, and the source is not mutated',()=>{
 const before=JSON.stringify(total);
 const {result,patch:p}=applyDocumentPatch(total,patch([
  {op:'test',path:'/nodes/@checks/label',value:'SQL quality checks'},
  {op:'replace',path:'/nodes/@checks/label',value:'Reviewed SQL checks'},
  {op:'add',path:'/nodes/@checks/tags/-',value:'ai-reviewed'},
  {op:'remove',path:'/nodes/@excel/summary'}]));
 const checks=result.nodes.find(n=>n.id==='checks')!;
 assert.equal(checks.label,'Reviewed SQL checks');assert(checks.tags.includes('ai-reviewed'));
 assert.equal(result.nodes.find(n=>n.id==='excel')!.summary,'','removed optional field falls back to its default');
 assert.equal(result.revision,total.revision,'the patch result keeps the base revision; applying bumps it');
 assert.equal(JSON.stringify(total),before);assert.equal(p.operations.length,4);
 assert.deepEqual(describeChanges(total,result).changes.map(c=>c.id).sort(),['checks','excel'],'reviewable in the change preview');
});

test('RFC 6902 semantics: index paths, add/remove/replace/move/copy/test, escaped keys',()=>{
 const doc={a:[1,2,3],o:{'x/y':1,'t~n':2}};
 assert.deepEqual(applyOperations(doc,[{op:'add',path:'/a/1',value:9}]).a,[1,9,2,3]);
 assert.deepEqual(applyOperations(doc,[{op:'remove',path:'/a/0'}]).a,[2,3]);
 assert.deepEqual(applyOperations(doc,[{op:'move',from:'/a/0',path:'/a/-'}]).a,[2,3,1]);
 assert.deepEqual(applyOperations(doc,[{op:'copy',from:'/o/x~1y',path:'/o/z'}]).o,{'x/y':1,'t~n':2,z:1});
 assert.deepEqual(applyOperations(doc,[{op:'replace',path:'/o/t~0n',value:3}]).o,{'x/y':1,'t~n':3});
 assert.deepEqual(applyOperations(doc,[{op:'test',path:'/o',value:{'t~n':2,'x/y':1}}]),doc,'test compares JSON values regardless of key order');
 assert.throws(()=>applyOperations(doc,[{op:'replace',path:'/o/missing',value:1}]),/does not exist \(use add\)/);
 assert.throws(()=>applyOperations(doc,[{op:'remove',path:'/a/3'}]),/index 3 is out of range/);
 assert.throws(()=>applyOperations(doc,[{op:'move',from:'/o',path:'/o/inner'}]),/into itself/);
});

test('guards: stale base, other project, wrong target, ids, identity fields, prototype keys',()=>{
 const op:Operation={op:'replace',path:'/nodes/@checks/label',value:'x'};
 assert.throws(()=>applyDocumentPatch(total,patch([op],{baseRevision:total.revision+1})),/Stale patch: it was written against revision 1, and the open project is at revision 0/);
 assert.throws(()=>applyDocumentPatch(total,patch([op],{targetId:'other-project'})),/for project “other-project”, but “total-project-controls” is open/);
 assert.throws(()=>applyDocumentPatch(total,patch([op],{target:'experience'})),/targets an evidence-workspace pack/);
 assert.throws(()=>applyDocumentPatch(total,patch([{op:'replace',path:'/nodes/@checks/id',value:'checks-2'}])),/Operation 1 \(replace \/nodes\/@checks\/id\): IDs are stable/);
 assert.throws(()=>applyDocumentPatch(total,patch([{op:'replace',path:'/revision',value:99}])),/\/revision identifies the document/);
 assert.throws(()=>applyDocumentPatch(total,patch([{op:'add',path:'/nodes/@checks/__proto__',value:{polluted:true}}])),/“__proto__” is not allowed/);
 assert.equal(({} as {polluted?:boolean}).polluted,undefined);
 assert.throws(()=>applyDocumentPatch(total,patch([{op:'replace',path:'',value:{}} as Operation])),/whole document cannot be replaced/);
 assert.throws(()=>applyDocumentPatch(total,{...patch([op]),script:'x'}),/Not a valid DiagramCloud patch/);
});

test('all or nothing: a failing test or an invalid result refuses the whole patch',()=>{
 assert.throws(()=>applyDocumentPatch(total,patch([
  {op:'replace',path:'/title',value:'Changed'},
  {op:'test',path:'/nodes/@checks/label',value:'Something else'}])),/Operation 2 \(test \/nodes\/@checks\/label\): test failed: the current value is "SQL quality checks"/);
 assert.throws(()=>applyDocumentPatch(total,patch([{op:'replace',path:'/nodes/@checks/childViewId',value:'missing-view'}])),/unknown reference/);
 assert.throws(()=>applyDocumentPatch(total,patch([{op:'remove',path:'/nodes/@nope'}])),/no item with id “nope”/);
 assert.equal(total.nodes.find(n=>n.id==='checks')!.label,'SQL quality checks');
});

test('experience pack patches use the pack id and revision, and templates start from the open version',()=>{
 const pack=clone(total.experience!),item=pack.items[0];
 const p={format:'diagramcloud.patch',version:1,target:'experience',targetId:pack.id,baseRevision:pack.revision,operations:[{op:'replace',path:`/items/@${item.id}/title`,value:'Patched title'}]};
 assert.equal(applyPackPatch(pack,p).result.items[0].title,'Patched title');
 assert.throws(()=>applyPackPatch(pack,{...p,baseRevision:pack.revision+3}),/Stale patch/);
 const t=patchTemplate('project',total.id,total.revision,{path:'/title',value:total.title});
 assert(isPatch(t));assert.deepEqual(applyDocumentPatch(total,t).result,total,'the template is a valid no-op');
});
