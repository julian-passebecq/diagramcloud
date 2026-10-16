import {applyDocumentPatch} from '../src/core/patch';
import {observationPatch} from '../src/core/realization';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone,parseDocument,validateDocument,MAX_DOCUMENT_BYTES,documentSchema,nodeSchema,blockSchema,viewSchema,edgeSchema} from '../src/core/model';
import {publicDocument,removeNode,traceNodes,pathToView,commitHistory,undo,redo,type History,addExistingComponentToView,VIEW_MEMBERSHIP_UNAVAILABLE,removeComponentFromView,VIEW_REMOVAL_UNAVAILABLE} from '../src/core/operations';
import {svgDiagram,documentFromSvg,mermaidDiagram,xml} from '../src/export/diagram';
import {portfolioHtml} from '../src/export/html';
const total=samples.find(d=>d.id==='total-project-controls')!;
const platform=samples.find(d=>d.id==='datapass-platform')!;
const constellation=samples.find(d=>d.id==='project-constellation')!;
for(const sample of samples)test(`valid gallery: ${sample.id}`,()=>assert.equal(validateDocument(sample).id,sample.id));
test('authoring JSON round trip preserves the document',()=>{for(const sample of samples)assert.deepEqual(parseDocument(JSON.stringify(sample)),sample);});
test('reject unknown schema versions and fields',()=>{assert.throws(()=>validateDocument({...total,schemaVersion:2}));assert.throws(()=>validateDocument({...total,script:'alert(1)'}));});
test('reject dangling child references',()=>{const d=clone(total);d.nodes[0].childViewId='missing-view';assert.throws(()=>validateDocument(d),/unknown reference/);});
test('reject duplicate IDs',()=>{const d=clone(total);d.nodes.push(clone(d.nodes[0]));assert.throws(()=>validateDocument(d),/Duplicate node/);});
test('reject an edge endpoint outside its view',()=>{const d=clone(total);d.edges[0].target='mandatory';assert.throws(()=>validateDocument(d),/endpoint outside/);});
test('reject recursive drilldown',()=>{const d=clone(total);d.nodes.find(n=>n.id==='check-function')!.childViewId='overview';assert.throws(()=>validateDocument(d),/Recursive drilldown/);});
test('allow cyclic data flow and terminate tracing',()=>{const d=clone(total);const e=edgeSchema.parse({id:'back-edge',source:'powerbi',target:'business'});d.edges.push(e);d.views.find(v=>v.id==='overview')!.edgeIds.push(e.id);validateDocument(d);const result=traceNodes(d,'overview','business','downstream');assert.equal(result.size,5);});
test('reject mismatched table row width',()=>{const d=clone(total);const b=d.blocks.find(b=>b.type==='table');if(b?.type==='table')b.rows.push(['bad']);assert.throws(()=>validateDocument(d),/column count/);});
test('reject non-finite and unknown positions',()=>{const d=clone(total);d.views[0].positions.business={x:Infinity,y:0};assert.throws(()=>validateDocument(d));d.views[0].positions.business={x:0,y:0};d.views[0].positions.unknown={x:0,y:0};assert.throws(()=>validateDocument(d),/non-member/);});
test('enforce byte-size limit before JSON parsing',()=>assert.throws(()=>parseDocument(' '.repeat(MAX_DOCUMENT_BYTES+1)),/12 MiB/));
test('reject executable source links',()=>{const d=clone(total);d.sources[0].url='javascript:alert(1)';assert.throws(()=>validateDocument(d));});
test('public export strips private nodes, notes and evidence',()=>{const d=clone(total);d.privateNotes='SECRET_NOTES';d.nodes.find(n=>n.id==='business')!.visibility='private';const secret=blockSchema.parse({id:'secret',type:'text',title:'Private note',text:'SECRET_BLOCK',visibility:'private'});d.blocks.push(secret);d.nodes.find(n=>n.id==='checks')!.blockIds.push(secret.id);const out=publicDocument(d);assert.ok(!JSON.stringify(out).includes('SECRET'));assert.ok(!out.nodes.some(n=>n.id==='business'));assert.ok(!out.edges.some(e=>e.source==='business'));validateDocument(out);});
test('private child views remove the drilldown link',()=>{const d=clone(total);d.views.find(v=>v.id==='validation')!.visibility='private';const out=publicDocument(d);assert.equal(out.nodes.find(n=>n.id==='checks')!.childViewId,undefined);assert.ok(!out.nodes.some(n=>n.id==='check-function'));});
test('unreachable content and image payloads are removed',()=>{const d=clone(total);d.views.push(viewSchema.parse({id:'unreachable',title:'Unlinked'}));d.blocks.push(blockSchema.parse({id:'unattached',type:'text',title:'Orphan',text:'UNREACHABLE_SECRET'}));d.assets.push({id:'unused-image',name:'unused.png',data:'data:image/png;base64,AAAA',visibility:'public',rights:'test'});const out=publicDocument(d);assert.ok(!JSON.stringify(out).includes('UNREACHABLE_SECRET'));assert.equal(out.assets.length,0);assert.ok(!out.views.some(v=>v.id==='unreachable'));});
test('private asset cannot leak through a public image block',()=>{const d=clone(total);d.assets.push({id:'private-image',name:'secret.png',data:'data:image/png;base64,AAAA',visibility:'private',rights:'private'});d.blocks.push(blockSchema.parse({id:'image-block',type:'image',title:'Screenshot',assetId:'private-image'}));d.nodes[0].blockIds.push('image-block');const out=publicDocument(d);assert.ok(!out.blocks.some(b=>b.id==='image-block'));assert.equal(out.assets.length,0);});
test('node deletion cleans edges, memberships and story',()=>{const out=removeNode(total,'business');assert.ok(!out.nodes.some(n=>n.id==='business'));assert.ok(!out.story.some(s=>s.nodeId==='business'));assert.ok(out.views.every(v=>!v.nodeIds.includes('business')));validateDocument(out);});
test('node deletion does not mutate source',()=>{removeNode(total,'checks');assert.ok(total.nodes.some(n=>n.id==='checks'));});
test('trace respects direction and view boundaries',()=>{assert.deepEqual([...traceNodes(total,'overview','oracle','upstream')].sort(),['business','excel','oracle']);assert.deepEqual([...traceNodes(total,'overview','oracle','downstream')].sort(),['checks','oracle','powerbi']);});
test('path reaches the third-level code view',()=>assert.deepEqual(pathToView(total,'check-detail'),['overview','validation','check-detail']));
test('platform map reaches BigQuery task-level drilldown',()=>assert.deepEqual(pathToView(platform,'bq-telemetry-table'),['overview','foil-platform','bigquery-detail','bq-telemetry-table']));
test('platform map reaches Artifact Studio canvas detail',()=>assert.deepEqual(pathToView(platform,'artifact-canvas-detail'),['overview','portfolio-flow','artifact-canvas-detail']));
test('constellation reaches Contoso model detail',()=>assert.deepEqual(pathToView(constellation,'contoso-models'),['overview','core-products','contoso-product','contoso-models']));
test('constellation reaches Atlas Mongo detail',()=>assert.deepEqual(pathToView(constellation,'atlasmongo-detail'),['overview','atlas-family-view','atlasmongo-detail']));
test('undo and redo preserve data and branching clears future',()=>{const initial:History={past:[],present:clone(total),future:[]};const h=commitHistory(initial,{...initial.present,title:'Edited'});assert.equal(h.present.revision,1);assert.equal(undo(h).present.title,total.title);assert.equal(redo(undo(h)).present.title,'Edited');assert.equal(commitHistory(undo(h),{...initial.present,title:'Branch'}).future.length,0);});
test('history is bounded',()=>{let h:History={past:[],present:clone(total),future:[]};for(let i=0;i<40;i++)h=commitHistory(h,{...h.present,title:`Title ${i}`});assert.equal(h.past.length,25);});
test('SVG metadata round trip equals the public document',()=>{for(const d of samples)assert.deepEqual(documentFromSvg(svgDiagram(d)),publicDocument(d));});
test('arbitrary SVG is not a semantic diagram import',()=>assert.throws(()=>documentFromSvg('<svg/>'),/No DiagramCloud metadata/));
test('XML escaping covers injection characters',()=>assert.equal(xml('<&"\''),'&lt;&amp;&quot;&apos;'));
test('HTML export escapes script termination and uses public payload',()=>{const d=clone(total);d.title='</script><script>window.HACKED=1</script>';d.privateNotes='DO_NOT_PUBLISH';const html=portfolioHtml(d);assert.ok(!html.includes('</script><script>'));assert.ok(!html.includes('DO_NOT_PUBLISH'));assert.ok(html.includes('\\u003c/script>'));assert.ok(html.includes("connect-src 'none'"));});
test('Mermaid is a scoped view export, not evidence serialization',()=>{const out=mermaidDiagram(total);assert.ok(out.startsWith('flowchart LR'));assert.ok(out.includes('Oracle project database'));assert.ok(!out.includes('forecast_cost_eur'));});
test('Mermaid escapes pipe characters in labels',()=>{const d=clone(total);d.edges[0].label='raw | curated';const out=mermaidDiagram(d);assert.ok(out.includes('raw &#124; curated'));assert.ok(!out.includes('|raw | curated|'));});
test('stable IDs have bounded safe syntax',()=>{assert.throws(()=>nodeSchema.parse({id:'<script>',label:'Bad'}));assert.throws(()=>nodeSchema.parse({id:'a'.repeat(90),label:'Bad'}));});


function componentReuseProject(){return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-reuse-unit',revision:7,title:'Synthetic canonical reuse',rootViewId:'root',
 nodes:[{id:'left-portal',label:'Left',childViewId:'left'},{id:'right-portal',label:'Right',childViewId:'right'},{id:'shared',label:'Same label',summary:'Canonical authored explanation',blockIds:['example'],sourceIds:['source']},{id:'other',label:'Same label'},{id:'private',label:'SYNTHETIC_REUSE_PRIVATE',visibility:'private'}],
 edges:[{id:'native-link',source:'shared',target:'other',kind:'dependency',basis:'planned',quantity:{value:0,unit:'items/day',provenance:'synthetic'}}],
 views:[{id:'root',title:'Root',nodeIds:['left-portal','right-portal'],positions:{'left-portal':{x:0,y:0},'right-portal':{x:400,y:0}}},{id:'left',title:'Left existing view',nodeIds:['shared','other','private'],edgeIds:['native-link'],positions:{shared:{x:0,y:0},other:{x:400,y:0}}},{id:'right',title:'Right existing view',nodeIds:['other'],positions:{other:{x:700,y:0}},design:{type:'auto',focal:['other']}}],
 blocks:[{id:'example',type:'text',title:'Synthetic example',text:'Input, work and output are authored illustration.',sourceIds:['source'],provenance:'synthetic'}],sources:[{id:'source',title:'Synthetic declared reference',location:'Synthetic fixture'}],story:[{title:'Existing story',narration:'Authored order only',viewId:'left',nodeId:'shared',highlightEdgeIds:['native-link']}]}));}
test('component reuse adds only exact existing membership and authored position, with one ordinary Undo and no fact clones',()=>{
 const input=componentReuseProject(),raw=JSON.stringify(input),point={x:123.5,y:-40.25},out=addExistingComponentToView(input,'right','shared',point),expected=clone(input),right=expected.views.find(view=>view.id==='right')!;right.nodeIds.push('shared');right.positions.shared={...point};
 assert.deepEqual(out,expected);assert.equal(out.revision,input.revision);assert.equal(out.nodes.filter(node=>node.id==='shared').length,1);assert.equal(JSON.stringify(input),raw);assert.equal(out.views.find(view=>view.id==='right')!.edgeIds.length,0,'incident edges are not implicitly added');
 const h:History={past:[],present:input,future:[]},committed=commitHistory(h,out);assert.equal(committed.past.length,1);assert.equal(committed.present.revision,input.revision+1);assert.deepEqual(undo(committed).present,input);assert.deepEqual(redo(undo(committed)).present,committed.present);
 point.x=999;out.nodes.find(node=>node.id==='shared')!.summary='Caller copy only';assert.equal(input.nodes.find(node=>node.id==='shared')!.summary,'Canonical authored explanation');assert.equal(out.views.find(view=>view.id==='right')!.positions.shared.x,123.5);
});
test('already present component reuse is an exact no-op rather than a new position, revision or history candidate',()=>{
 const input=componentReuseProject(),raw=JSON.stringify(input),same=addExistingComponentToView(input,'left','shared',{x:999,y:888});assert.equal(same,input);assert.equal(JSON.stringify(input),raw);const after=addExistingComponentToView(input,'right','shared',{x:40,y:20});assert.equal(addExistingComponentToView(after,'right','shared',{x:500,y:500}),after);
});
test('component reuse rejects unknown scope, invalid positions and recursive expansion atomically with a fixed refusal',()=>{
 const input=componentReuseProject(),raw=JSON.stringify(input),invalids=[['missing','shared',{x:0,y:0}],['right','missing',{x:0,y:0}],['right','right-portal',{x:0,y:0}],['right','shared',{x:Infinity,y:0}],['right','shared',{x:0,y:NaN}],['right','shared',{x:100001,y:0}],['right','shared',{x:0,y:0,unknown:'SYNTHETIC_UNTRUSTED_VALUE'}]] as const;
 for(const [view,node,position] of invalids){assert.throws(()=>addExistingComponentToView(input,view,node,position),{message:VIEW_MEMBERSHIP_UNAVAILABLE});assert.equal(JSON.stringify(input),raw);}
 const invalid=clone(input);invalid.views[0].nodeIds.push('right-portal');assert.throws(()=>addExistingComponentToView(invalid,'right','shared',{x:0,y:0}),{message:VIEW_MEMBERSHIP_UNAVAILABLE});assert.equal(JSON.stringify(input),raw);
});
test('reusing a private component never relabels visibility, publishes it or changes source/runtime facts',()=>{
 const input=componentReuseProject(),before=JSON.stringify(input),out=addExistingComponentToView(input,'right','private',{x:-300,y:140});assert.equal(out.nodes.find(node=>node.id==='private')!.visibility,'private');assert.deepEqual(publicDocument(out),publicDocument(input));assert.ok(!JSON.stringify(publicDocument(out)).includes('SYNTHETIC_REUSE_PRIVATE'));assert.deepEqual(out.nodes,input.nodes);assert.deepEqual(out.edges,input.edges);assert.deepEqual(out.blocks,input.blocks);assert.deepEqual(out.sources,input.sources);assert.deepEqual(out.observations,input.observations);assert.equal(JSON.stringify(input),before);
});

function componentRemovalProject(){
 const input=componentReuseProject(),right=input.views.find(view=>view.id==='right')!;right.nodeIds.push('shared');right.edgeIds=['native-link'];right.positions.shared={x:150,y:25};return validateDocument(input);
}
test('one-view removal changes only exact view membership position and incident membership retaining canonical facts and ordinary Undo',()=>{
 let input=componentRemovalProject();
 // Synthetic unreviewed fixture enters through the patch path; no review/shareability decision is authored.
 input=applyDocumentPatch(input,observationPatch(input,{id:'fixture-not-observed',nodeId:'shared',sourceApp:'synthetic-fixture',authority:'Synthetic unit fixture only',observedAt:'2026-10-15T00:00:00Z',sourceRevision:'fixture-1',claim:'not-observed',summary:'Synthetic fixture: no runtime verification is asserted.'})).result;
 const raw=JSON.stringify(input),out=removeComponentFromView(input,'right','shared'),expected=clone(input),view=expected.views.find(view=>view.id==='right')!;view.nodeIds=view.nodeIds.filter(id=>id!=='shared');view.edgeIds=[];delete view.positions.shared;
 assert.deepEqual(out,expected);assert.equal(out.revision,input.revision);assert.equal(JSON.stringify(input),raw);assert.deepEqual(out.observations,input.observations);assert.equal(out.observations[0].reviewedAt,undefined);assert.equal(out.observations[0].shareable,false);assert.equal(out.edges[0].quantity!.value,0);assert.equal(out.edges[0].quantity!.provenance,'synthetic');
 const history:History={past:[],present:input,future:[]},h=commitHistory(history,out);assert.equal(h.past.length,1);assert.deepEqual(undo(h).present,input);assert.deepEqual(redo(undo(h)).present,h.present);
});
test('one-view removal has exact no-op identity and constant atomic refusal for unknown or invalid scope',()=>{
 const input=componentRemovalProject(),raw=JSON.stringify(input);assert.equal(removeComponentFromView(input,'root','shared'),input);
 for(const [view,node] of [['missing','shared'],['right','missing']]){assert.throws(()=>removeComponentFromView(input,view,node),{message:VIEW_REMOVAL_UNAVAILABLE});assert.equal(JSON.stringify(input),raw);}
 const invalid=clone(input);invalid.nodes.find(node=>node.id==='right-portal')!.childViewId='root';const before=JSON.stringify(invalid);assert.throws(()=>removeComponentFromView(invalid,'right','shared'),{message:VIEW_REMOVAL_UNAVAILABLE});assert.equal(JSON.stringify(invalid),before);
});
test('one-view removal refuses authored focal and story node or highlighted-edge dependencies without rewriting them',()=>{
 const base=componentRemovalProject();
 for(const kind of ['focal','story-node','story-edge'] as const){const input=clone(base),right=input.views.find(view=>view.id==='right')!;if(kind==='focal')right.design!.focal=['shared'];else input.story.push({...input.story[0],viewId:'right',nodeId:kind==='story-node'?'shared':undefined,highlightEdgeIds:kind==='story-edge'?['native-link']:[]});validateDocument(input);const raw=JSON.stringify(input);assert.throws(()=>removeComponentFromView(input,'right','shared'),{message:VIEW_REMOVAL_UNAVAILABLE});assert.equal(JSON.stringify(input),raw);}
});
test('one-view removal refuses newly unreachable child views but permits a still-reachable alternate parent without deleting facts',()=>{
 const input=componentRemovalProject(),raw=JSON.stringify(input);assert.throws(()=>removeComponentFromView(input,'root','right-portal'),{message:VIEW_REMOVAL_UNAVAILABLE});assert.equal(JSON.stringify(input),raw);
 const alternate=clone(input);alternate.nodes.push(nodeSchema.parse({id:'backup-portal',label:'Synthetic alternate portal',childViewId:'right'}));alternate.views[0].nodeIds.push('backup-portal');validateDocument(alternate);const out=removeComponentFromView(alternate,'root','right-portal');assert.ok(!out.views[0].nodeIds.includes('right-portal'));assert.deepEqual(out.nodes,alternate.nodes);assert.deepEqual(out.edges,alternate.edges);assert.deepEqual(out.views.find(view=>view.id==='right'),alternate.views.find(view=>view.id==='right'));assert.deepEqual(pathToView(out,'right'),['root','right']);
});
test('removing private membership leaves the public projection identical and all visibility sources evidence and observations intact',()=>{
 const input=addExistingComponentToView(componentRemovalProject(),'right','private',{x:0,y:200}),raw=JSON.stringify(input),out=removeComponentFromView(input,'right','private');assert.deepEqual(publicDocument(out),publicDocument(input));assert.ok(!JSON.stringify(publicDocument(out)).includes('SYNTHETIC_REUSE_PRIVATE'));assert.deepEqual(out.nodes,input.nodes);assert.deepEqual(out.edges,input.edges);assert.deepEqual(out.blocks,input.blocks);assert.deepEqual(out.sources,input.sources);assert.deepEqual(out.observations,input.observations);assert.equal(JSON.stringify(input),raw);
});

test('one-view removal filters every incident parallel membership while retaining unrelated and other-view memberships',()=>{
 const input=componentRemovalProject(),right=input.views.find(view=>view.id==='right')!;input.nodes.push(nodeSchema.parse({id:'spare',label:'Synthetic unaffected endpoint'}));right.nodeIds.push('spare');right.positions.spare={x:800,y:0};input.edges.push(edgeSchema.parse({...input.edges[0],id:'parallel-link'}),edgeSchema.parse({id:'unrelated-link',source:'other',target:'spare',kind:'dependency'}));right.edgeIds.push('parallel-link','unrelated-link');validateDocument(input);const raw=JSON.stringify(input),out=removeComponentFromView(input,'right','shared');assert.deepEqual(out.views.find(view=>view.id==='right')!.edgeIds,['unrelated-link']);assert.deepEqual(out.edges,input.edges);assert.deepEqual(out.views.find(view=>view.id==='left'),input.views.find(view=>view.id==='left'));assert.deepEqual(out.views.find(view=>view.id==='right')!.positions.spare,right.positions.spare);assert.equal(JSON.stringify(input),raw);
});

test('private alternate parent cannot conceal loss of a previously reachable public child view while a public alternate remains valid',()=>{
 const input=componentRemovalProject();input.nodes.push(nodeSchema.parse({id:'backup-portal',label:'SYNTHETIC_PRIVATE_ALTERNATE_PORTAL',visibility:'private',childViewId:'right'}));input.views[0].nodeIds.push('backup-portal');validateDocument(input);const raw=JSON.stringify(input),publicBefore=publicDocument(input);assert.ok(publicBefore.views.some(view=>view.id==='right'));assert.throws(()=>removeComponentFromView(input,'root','right-portal'),{message:VIEW_REMOVAL_UNAVAILABLE});assert.equal(JSON.stringify(input),raw);assert.deepEqual(publicDocument(input),publicBefore);
 const publicAlternate=clone(input);publicAlternate.nodes.find(node=>node.id==='backup-portal')!.visibility='public';validateDocument(publicAlternate);const out=removeComponentFromView(publicAlternate,'root','right-portal');assert.ok(!out.views[0].nodeIds.includes('right-portal'));assert.ok(publicDocument(out).views.some(view=>view.id==='right'));assert.deepEqual(out.nodes,publicAlternate.nodes);assert.deepEqual(out.edges,publicAlternate.edges);assert.deepEqual(out.views.find(view=>view.id==='right'),publicAlternate.views.find(view=>view.id==='right'));
});
