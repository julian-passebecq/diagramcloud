import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {DEFAULT_FILTERS,companionContent,companionRelated,companionTabs,coverageText,detourTarget,permittedDocument,relatedSceneView,startDetour} from '../src/core/companionPane';
import {buildScene} from '../src/export/scene';

/* UX32: the companion pane's pure state. The React pane renders exactly this. */
function project(){return validateDocument({schemaVersion:1,id:'companion',title:'Companion',rootViewId:'root',revision:3,
 sources:[{id:'doc',title:'Reference'},{id:'hidden-source',title:'Private reference',visibility:'private'}],
 blocks:[{id:'why',title:'Why',type:'text',text:'Explains the wrapper.'},{id:'code',title:'retry.py',type:'code',language:'python',code:'def retry(): pass',sourceIds:['doc']},
  {id:'state',title:'State',type:'table',columns:['k','v'],rows:[['attempt','1']]},{id:'secret-note',title:'Secret',type:'text',text:'author only',visibility:'private'},
  {id:'kpi',title:'Numbers',type:'metrics',items:[{label:'attempts',value:'3'}],sourceIds:['hidden-source']}],
 nodes:[{id:'api',label:'API',summary:'Front door',blockIds:['why','code','state','secret-note','kpi']},{id:'retry',label:'Retry'},{id:'queue',label:'Queue'},{id:'secret',label:'Private concept',visibility:'private'},{id:'other',label:'Elsewhere'}],
 edges:[{id:'a',source:'api',target:'retry',kind:'control'},{id:'b',source:'retry',target:'queue',kind:'stream'},{id:'p',source:'api',target:'secret',visibility:'private'},{id:'o',source:'queue',target:'other',kind:'dependency'}],
 views:[{id:'root',title:'Root',nodeIds:['api','retry','queue','secret'],edgeIds:['a','b','p']},{id:'more',title:'More',nodeIds:['queue','other'],edgeIds:['o']}]});}
const anchor={viewId:'root',nodeId:'api'};

test('tabs are offered only when they have content; Related is always there',()=>{
 const p=project();
 assert.deepEqual(companionTabs(companionContent(p,'api')),['explanation','code','related','evidence']);
 assert.deepEqual(companionTabs(companionContent(p,'queue')),['related']);
 assert.deepEqual(companionTabs(null),['related']);
});

test('a public reader sees only the public projection: no private block, source or related component',()=>{
 const pub=permittedDocument(project(),true),content=companionContent(pub,'api')!;
 assert.ok(!content.explanation.some(b=>b.id==='secret-note'));
 assert.ok(!content.sources.some(s=>s.id==='hidden-source'));
 const r=companionRelated(project(),true,anchor,{...DEFAULT_FILTERS,depth:3});assert.equal(r.state,'available');if(r.state!=='available')return;
 assert.ok(!r.spec.nodes.some(n=>n.id==='secret'));
 const author=companionRelated(project(),false,anchor,{...DEFAULT_FILTERS,depth:3});assert.ok(author.state==='available'&&author.spec.nodes.some(n=>n.id==='secret'));
});

test('coverage names its bounds and the truncation, never "all"',()=>{
 const p=project(),narrow={...DEFAULT_FILTERS,maxNodes:2};
 const r=companionRelated(p,false,anchor,narrow);if(r.state!=='available')throw Error('fixture');
 assert.equal(r.truncated,true);
 const text=coverageText(r,narrow);
 assert.match(text,/^1 related component and \d+ connections? within depth 1, this view, both directions, all relation kinds; display limit 2 reached, more may exist\.$/);
 const wide=companionRelated(p,false,anchor,{...DEFAULT_FILTERS,depth:3,scope:'project',kinds:['control']});if(wide.state!=='available')throw Error('fixture');
 assert.match(coverageText(wide,{...DEFAULT_FILTERS,depth:3,scope:'project',kinds:['control']}),/the permitted project, both directions, control; display limit 20\.$/);
});

test('the related scene is drawn from the projection only, in its own order',()=>{
 const p=project(),r=companionRelated(p,false,anchor,{...DEFAULT_FILTERS,depth:2});if(r.state!=='available')throw Error('fixture');
 const view=relatedSceneView(r,p.views[0]),scene=buildScene(p,view);
 assert.deepEqual(scene.nodes.map(n=>n.id).sort(),r.spec.nodes.map(n=>n.id).sort());
 assert.deepEqual(scene.edges.map(e=>e.id).sort(),r.spec.edges.map(e=>e.id).sort());
 assert.ok(!p.views.some(v=>v.id===view.id),'the scene view is temporary, never stored');
});

test('a detour opens a related component in a permitted view and keeps the first origin across hops',()=>{
 const p=project(),wide=companionRelated(p,false,{viewId:'root',nodeId:'retry'},{...DEFAULT_FILTERS,depth:2,scope:'project'});
 assert.deepEqual(detourTarget(wide,'queue'),{viewId:'root',nodeId:'queue'});
 assert.deepEqual(detourTarget(wide,'other'),{viewId:'more',nodeId:'other'});
 assert.equal(detourTarget(wide,'not-there'),null);
 const first=startDetour(p,{viewId:'root',nodeId:'retry'},{viewId:'root',nodeId:'queue'});
 assert.equal(first.origin.label,'Retry');assert.equal(first.target.label,'Queue');
 const second=startDetour(p,{viewId:'root',nodeId:'queue'},{viewId:'more',nodeId:'other'},first);
 assert.deepEqual(second.origin,first.origin,'the original question is never replaced');
 assert.equal(second.target.nodeId,'other');
});

test('a stale revision or a hidden anchor is unavailable with a generic notice',()=>{
 const p=project();
 const stale=companionRelated({...p,revision:p.revision},true,{viewId:'root',nodeId:'secret'},DEFAULT_FILTERS);
 assert.equal(stale.state,'unavailable');
 assert.equal(detourTarget(stale,'api'),null);
});
