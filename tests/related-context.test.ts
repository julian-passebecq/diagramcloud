import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {relatedContext,resolveRelatedPick,RELATED_UNAVAILABLE} from '../src/core/relatedContext';
function project(){return validateDocument({schemaVersion:1,id:'concepts',title:'Concepts',rootViewId:'root',revision:2,
 nodes:[{id:'api',label:'API'},{id:'retry',label:'Retry'},{id:'queue',label:'Queue'},{id:'secret',label:'Private concept',visibility:'private'},{id:'other',label:'Outside selected view'},{id:'details',label:'Explore related subsystem',childViewId:'more'}],
 edges:[{id:'a',source:'api',target:'retry',label:'uses policy',kind:'control'},{id:'b',source:'retry',target:'queue',label:'may enqueue',kind:'control'},
 {id:'c',source:'queue',target:'api',label:'delivers request',kind:'stream'},{id:'private-edge',source:'api',target:'secret',visibility:'private'},{id:'outside',source:'queue',target:'other',kind:'dependency'}],
 views:[{id:'root',title:'Selected architecture',nodeIds:['api','retry','queue','secret','details'],edgeIds:['a','b','c','private-edge']},
 {id:'more',title:'Related view',nodeIds:['queue','other'],edgeIds:['outside']}]
 });}
const request=()=>({projectId:'concepts',baseRevision:2,viewId:'root',nodeId:'api',audience:'public',scope:'view',direction:'both',depth:1,maxNodes:20,maxEdges:60});
test('related context is a read-only graph with explicit edge meaning and stable canonical IDs',()=>{
 const p=project(),before=JSON.stringify(p),r=relatedContext(p,request());assert.equal(r.state,'available');if(r.state!=='available')return;
 assert.equal(JSON.stringify(p),before);assert.equal(r.readOnly,true);assert.deepEqual(r.spec.nodes.map(n=>n.id),['api','queue','retry']);
 assert.deepEqual(r.spec.edges.map(e=>e.id),['a','b','c']);assert.match(r.notice,/not a causal proof/);assert.equal(r.spec.publication.policy,'publicDocument');
});
test('cycles do not become a false parent hierarchy or infinite traversal',()=>{
 const r=relatedContext(project(),{...request(),depth:3});assert.equal(r.state,'available');if(r.state==='available'){assert.equal(r.spec.nodes.length,3);assert.equal(r.distance.api,0);assert.equal(r.spec.children.length,0);}
});
test('project expansion is explicit; view mode cannot pull a hidden neighboring subsystem',()=>{
 const narrow=relatedContext(project(),{...request(),depth:3}),wide=relatedContext(project(),{...request(),depth:3,scope:'project'});
 if(narrow.state!=='available'||wide.state!=='available')throw Error('fixture');assert.ok(!narrow.spec.nodes.some(n=>n.id==='other'));assert.ok(wide.spec.nodes.some(n=>n.id==='other'));
});
test('incoming and outgoing direction select distinct neighborhoods',()=>{
 const outgoing=relatedContext(project(),{...request(),direction:'outgoing'}),incoming=relatedContext(project(),{...request(),direction:'incoming'});
 if(outgoing.state!=='available'||incoming.state!=='available')throw Error('fixture');
 assert.deepEqual(outgoing.spec.nodes.map(n=>n.id),['api','retry']);assert.deepEqual(incoming.spec.nodes.map(n=>n.id),['api','queue']);
});
test('explicit edge kind filter never invents a conceptual relation',()=>{
 const r=relatedContext(project(),{...request(),kinds:['control'],direction:'outgoing'});if(r.state!=='available')throw Error('fixture');assert.deepEqual(r.spec.edges.map(e=>e.id),['a']);
});
test('shared entity memberships preserve both valid contexts',()=>{
 const r=relatedContext(project(),request());if(r.state!=='available')throw Error('fixture');assert.deepEqual(r.memberships.find(m=>m.nodeId==='queue')!.views.map(v=>v.id),['more','root']);
});
test('bounded display reports limits without inventing shortcut edges',()=>{
 const r=relatedContext(project(),{...request(),maxNodes:2,maxEdges:0});if(r.state!=='available')throw Error('fixture');assert.equal(r.truncated,true);assert.equal(r.spec.edges.length,0);assert.match(r.notice,/display limit/);
});
test('depth zero is one subject, not a camera zoom or invisible traversal',()=>{
 const r=relatedContext(project(),{...request(),depth:0});if(r.state!=='available')throw Error('fixture');assert.deepEqual(r.spec.nodes.map(n=>n.id),['api']);assert.equal(r.spec.edges.length,0);
});
test('public projection does not depend on private labels, order, count or topology',()=>{
 const p=project(),a=relatedContext(p,request());p.nodes.unshift({id:'hidden-two',label:'Private new',kind:'model',provider:'Generic',icon:'generic',summary:'x',role:'x',status:'idle',visibility:'private',tags:[],blockIds:[],sourceIds:[]});
 p.views[0].nodeIds.unshift('hidden-two');p.nodes.find(n=>n.id==='secret')!.label='Secret changed';p.views.push({id:'private-view',title:'Secret view',description:'',nodeIds:['queue'],edgeIds:[],positions:{},visibility:'private'});
 assert.deepEqual(relatedContext(p,request()),a);
});
test('author scope may inspect private related context but the public scope cannot',()=>{
 const a=relatedContext(project(),{...request(),audience:'author'}),b=relatedContext(project(),request());
 if(a.state!=='available'||b.state!=='available')throw Error('fixture');assert.ok(a.spec.nodes.some(n=>n.id==='secret'));assert.ok(!b.spec.nodes.some(n=>n.id==='secret'));
});
for(const edit of [{nodeId:'secret'},{nodeId:'missing'},{viewId:'missing'},{baseRevision:3},{projectId:'wrong'},{depth:-1},{depth:4},{maxNodes:0},{maxEdges:121},{audience:'admin'},{scope:'all'},{execute:true}])test('context refuses '+JSON.stringify(edit),()=>{
 assert.deepEqual(relatedContext(project(),{...request(),...edit}),{state:'unavailable',readOnly:true,notice:RELATED_UNAVAILABLE});
});
test('selection requires exact current projection identity, not label or stale UI',()=>{
 const r=relatedContext(project(),request());if(r.state!=='available')throw Error('fixture');
 assert.deepEqual(resolveRelatedPick(r,{nodeId:'queue',fingerprint:r.fingerprint}),{nodeId:'queue',sourceViewId:'root'});
 for(const pick of [{nodeId:'Queue',fingerprint:r.fingerprint},{nodeId:'secret',fingerprint:r.fingerprint},{nodeId:'api',fingerprint:'stale'},{nodeId:'api',fingerprint:r.fingerprint,execute:true}])assert.equal(resolveRelatedPick(r,pick),null);
 const changed=project();changed.nodes.find(n=>n.id==='retry')!.summary='Changed context';const current=relatedContext(changed,request());assert.equal(resolveRelatedPick(current,{nodeId:'api',fingerprint:r.fingerprint}),null);
});
test('source arrays may reorder without changing the selected graph order',()=>{
 const p=project(),a=relatedContext(p,request());p.nodes.reverse();p.edges.reverse();const b=relatedContext(p,request());
 if(a.state!=='available'||b.state!=='available')throw Error('fixture');assert.deepEqual(a.spec.nodes.map(n=>n.id),b.spec.nodes.map(n=>n.id));
});

test('read-only related pane does not consume the native 80-view document budget',()=>{
 const p=project();for(let i=p.views.length;i<80;i++)p.views.push({id:'v'+i,title:'Existing view',description:'',nodeIds:[],edgeIds:[],positions:{},visibility:'private'});
 assert.equal(relatedContext(p,{...request(),audience:'author'}).state,'available');
 assert.equal(p.views.length,80);
});
test('changing audience invalidates a prior pick even for the same public node',()=>{
 const p=project(),pub=relatedContext(p,request()),author=relatedContext(p,{...request(),audience:'author'});
 if(pub.state!=='available'||author.state!=='available')throw Error('fixture');
 assert.equal(resolveRelatedPick(author,{nodeId:'api',fingerprint:pub.fingerprint}),null);
});
