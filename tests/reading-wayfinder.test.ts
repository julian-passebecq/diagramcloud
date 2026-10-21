import test from 'node:test';import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {prepareReadingWayfinder,resolveWayfinderPick} from '../src/core/readingWayfinder';
const fixture=()=>validateDocument({schemaVersion:1,id:'wayfinder-example',title:'Fictional application',category:'Reference',rootViewId:'root',
 nodes:[
 {id:'app',label:'Application',kind:'app',childViewId:'app-view'},
 {id:'data',label:'Data',kind:'storage',childViewId:'data-view'},
 {id:'shared-a',label:'Shared from app',kind:'process',childViewId:'query'},
 {id:'shared-d',label:'Shared from data',kind:'process',childViewId:'query'},
 {id:'private',label:'PRIVATE_LABEL',kind:'app',childViewId:'private-view',visibility:'private'}
 ],edges:[{id:'e',source:'app',target:'data',label:'dependency not parent',kind:'dependency'}],
 views:[
 {id:'root',title:'Overview',nodeIds:['app','data','private'],edgeIds:['e'],positions:{}},
 {id:'app-view',title:'Request path',nodeIds:['shared-a'],edgeIds:[],positions:{}},
 {id:'data-view',title:'Data model',nodeIds:['shared-d'],edgeIds:[],positions:{}},
 {id:'query',title:'Query details',nodeIds:[],edgeIds:[],positions:{}},
 {id:'private-view',title:'PRIVATE_VIEW',nodeIds:[],edgeIds:[],positions:{},visibility:'private'}
 ],blocks:[],sources:[],assets:[],observations:[],story:[]});
test('retains chosen parent for a shared view',()=>{const d=fixture(),v=prepareReadingWayfinder(d,'author',['root','data-view','query'],'query');assert.deepEqual(v.trail.map(x=>x.pick.viewId),['root','data-view','query']);assert.equal(v.trail.at(-1)!.label,'Query details');});
test('dependency is not a containment shortcut',()=>{const d=fixture();assert.equal(prepareReadingWayfinder(d,'author',['root','app-view','data-view'],'data-view').available,false);});
test('current level and inside-level rows reuse declared children',()=>{const d=fixture(),v=prepareReadingWayfinder(d,'author',['root','app-view'],'app-view');assert.ok(v.level.some(x=>x.pick.viewId==='data-view'));assert.deepEqual(v.children.map(x=>x.pick.viewId),['query']);});
test('tree retains both paths to a shared view',()=>{const v=prepareReadingWayfinder(fixture(),'author',['root'],'root');assert.equal(v.tree.filter(x=>x.pick.viewId==='query').length,2);});
test('private projection never lists private targets or labels',()=>{const v=prepareReadingWayfinder(fixture(),'public',['root'],'root');assert.ok(!JSON.stringify(v).includes('PRIVATE'));assert.ok(!v.tree.some(x=>x.pick.viewId==='private-view'));});
test('hidden content changes do not affect public reading at same revision',()=>{const d=fixture(),a=prepareReadingWayfinder(d,'public',['root'],'root');d.nodes.find(n=>n.id==='private')!.label='OTHER_SECRET';assert.deepEqual(prepareReadingWayfinder(d,'public',['root'],'root'),a);});
test('private and unavailable path are generically refused',()=>{assert.equal(prepareReadingWayfinder(fixture(),'public',['root','private-view'],'private-view').available,false);assert.equal(prepareReadingWayfinder(fixture(),'public',['root','absent'],'absent').available,false);});
test('exact source-bound pick resolves without document mutation',()=>{const d=fixture(),before=JSON.stringify(d),v=prepareReadingWayfinder(d,'author',['root'],'root'),pick=v.children[0].pick;assert.deepEqual(resolveWayfinderPick(d,'author',pick),{viewId:pick.viewId,path:pick.path});assert.equal(JSON.stringify(d),before);});
test('changed content at same revision invalidates pick',()=>{const d=fixture(),p=prepareReadingWayfinder(d,'author',['root'],'root').children[0].pick;d.title='changed';assert.equal(resolveWayfinderPick(d,'author',p),null);});
test('public audience refuses author-cut pick',()=>{const d=fixture(),p=prepareReadingWayfinder(d,'author',['root'],'root').children[0].pick;assert.equal(resolveWayfinderPick(d,'public',p),null);});
test('forged path and unknown selected entity refused',()=>{const d=fixture(),p=prepareReadingWayfinder(d,'author',['root'],'root').children[0].pick;assert.equal(resolveWayfinderPick(d,'author',{...p,path:['root','query'],viewId:'query'}),null);assert.equal(resolveWayfinderPick(d,'author',{...p,nodeId:'absent'}),null);});
test('empty invalid path does not silently switch to root',()=>{assert.equal(prepareReadingWayfinder(fixture(),'author',[],'root').available,false);});

// A shared view has several occurrences, but only the chosen path is current.
test('exact current path is unique among shared-view occurrences',()=>{
 const doc=fixture(),v=prepareReadingWayfinder(doc,'author',['root','data-view','query'],'query');
 assert.deepEqual(v.tree.filter(x=>x.current).map(x=>x.pick.path),[['root','data-view','query']]);
 assert.deepEqual(v.trail.filter(x=>x.current).map(x=>x.pick.viewId),['query']);
 assert.equal(v.children.some(x=>x.current),false);
});
test('changing the chosen parent transfers the current occurrence, not every shared view',()=>{
 const doc=fixture();
 for(const parent of ['app-view','data-view']){
  const v=prepareReadingWayfinder(doc,'author',['root',parent,'query'],'query');
  assert.deepEqual(v.tree.filter(x=>x.current).map(x=>x.pick.path),[['root',parent,'query']]);
  assert.equal(v.tree.filter(x=>x.pick.viewId==='query'&&!x.current).length,1);
 }
});
test('root current marker does not mark its children',()=>{
 const v=prepareReadingWayfinder(fixture(),'author',['root'],'root');
 assert.equal(v.tree.filter(x=>x.current).length,1);assert.equal(v.tree[0].current,true);
 assert.ok(v.children.every(x=>!x.current));assert.equal(v.level[0].current,true);
});
test('invalid path has no current occurrence or guessed parent',()=>{
 const v=prepareReadingWayfinder(fixture(),'public',['root','private-view'],'private-view');
 assert.equal(v.available,false);assert.equal(v.tree.filter(x=>x.current).length,0);
});
