import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone} from '../src/core/model';
import {applyDocumentPatch,type Operation} from '../src/core/patch';
import {revalidateStagedPatch} from '../src/app/stageImport';

const source=samples.find(s=>s.id==='total-project-controls')!;
function preview(operations:Operation[]){return applyDocumentPatch(source,{
 format:'diagramcloud.patch',version:1,target:'project',targetId:source.id,
 baseRevision:source.revision,summary:'Reviewed answer proposal',operations
});}
test('Apply rechecks full source tests, including same-revision replacements, without mutation',()=>{
 const staged=preview([{op:'test',path:'/nodes',value:source.nodes},{op:'replace',path:'/nodes/@checks/label',value:'Reviewed checks'}]);
 const before=JSON.stringify(source);revalidateStagedPatch(source,staged);assert.equal(JSON.stringify(source),before);
 const changed=clone(source);changed.nodes.find(n=>n.id==='checks')!.summary='Source changed while the review was open';
 const changedBefore=JSON.stringify(changed);assert.throws(()=>revalidateStagedPatch(changed,staged),/test failed/);
 assert.equal(JSON.stringify(changed),changedBefore);
 assert.throws(()=>revalidateStagedPatch({...source,revision:source.revision+1},staged),/revision/i);
 assert.throws(()=>revalidateStagedPatch({...source,id:'different-project'},staged),/target|project/i);
});
test('Apply refuses an outdated whole preview even when the narrow patch still applies',()=>{
 const staged=preview([{op:'replace',path:'/nodes/@checks/label',value:'Reviewed checks'}]);
 const changed=clone(source);changed.title='Changed title at the same revision';
 assert.throws(()=>revalidateStagedPatch(changed,staged),/Patch preview changed/);
 const tampered=clone(staged);tampered.result.title='Unreviewed title';
 assert.throws(()=>revalidateStagedPatch(source,tampered),/Patch preview changed/);
});
