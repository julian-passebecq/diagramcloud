import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDomainDataReference} from '../examples/domain-data/build';
import {publicDocument} from '../src/core/operations';
import {validateDocument,type Project} from '../src/core/model';
import {DOMAIN_MAP_COLUMNS} from '../src/core/domainCorrespondence';
import {LINKED_PERSPECTIVE_UNAVAILABLE,LINKED_PICK_LOST,discoverMappingBlocks,linkedChildView,linkedParentView,linkedStateLine,linkedViewChoices,openLinkedPerspective,pickLinked,reconcileLinkedPerspective,resolveLinkedSelection,setLinkedView,suggestRightView,swapLinkedSides,linkedMappings,type LinkedPerspective} from '../src/core/linkedPerspective';
import type {PerspectiveBinding} from '../src/core/workbenchPerspective';

// Synthetic teaching project (examples/domain-data): authored, labelled synthetic, no client data.
const project=()=>buildDomainDataReference().project;
const bind=(doc:Project,audience:'author'|'public'='author'):PerspectiveBinding=>({projectId:doc.id,audience,epoch:doc.revision});
const ids=(doc:Project,viewId:string)=>doc.views.find(v=>v.id===viewId)!.nodeIds;
function open(doc:Project,left='physical',right='data',audience:'author'|'public'='author'):LinkedPerspective{
 const out=openLinkedPerspective(doc,{binding:bind(doc,audience),leftViewId:left,rightViewId:right,anchorNodeId:'wind.goal'});
 assert.ok(out.ok,'opens');return out.state;
}
function pick(state:LinkedPerspective,doc:Project,side:'left'|'right',id:string){const out=pickLinked(state,doc,state.binding,side,id);assert.ok(out.ok);return out.state;}
const select=(state:LinkedPerspective,doc:Project)=>resolveLinkedSelection(state,doc,ids(doc,state.leftViewId),ids(doc,state.rightViewId));

test('view choices are the reachable permitted views only',()=>{
 const doc=project();doc.views.push({id:'orphan',title:'Synthetic orphan',description:'',nodeIds:[],edgeIds:[],positions:{},visibility:'public'});
 const choices=linkedViewChoices(validateDocument(doc)).map(v=>v.id);
 assert.ok(choices.includes('physical')&&choices.includes('data'));assert.ok(!choices.includes('orphan'));
});

test('mapping discovery takes exact domain mapping tables attached to their from-node, never join mapping tables',()=>{
 const doc=project(),found=discoverMappingBlocks(doc);
 assert.equal(found.length,doc.blocks.filter(b=>b.type==='table'&&b.transform==='mapping').length);
 // A join mapping table (other columns) and a detached domain table are ignored.
 doc.blocks.push({id:'b.join.synthetic',title:'Synthetic join keys',type:'table',transform:'mapping',columns:['Left key','Right key'],rows:[['a','b']],sourceIds:['s.author'],visibility:'public',provenance:'synthetic'});
 doc.nodes.find(n=>n.id==='data.sample')!.blockIds.push('b.join.synthetic');
 doc.blocks.push({id:'b.detached',title:'Synthetic detached',type:'table',transform:'mapping',columns:[...DOMAIN_MAP_COLUMNS],rows:[['map.detached','wind.drive','data.kpi','explains','illustrative','Synthetic','a','b','none','Synthetic detached row.']],sourceIds:['s.author'],visibility:'public',provenance:'synthetic'});
 const again=discoverMappingBlocks(validateDocument(doc));
 assert.deepEqual(again,found);
});

test('exact stable ID is the same object on both sides',()=>{
 const doc=project();let s=open(doc,'physical','physical-flow');s=pick(s,doc,'left','wind.foil');
 const sel=select(s,doc);assert.equal(sel.state,'EXACT');assert.deepEqual(sel.targets,['wind.foil']);
 assert.equal(linkedStateLine(sel,'right').text,'Same object');assert.equal(linkedStateLine(sel,'left').text,'Same object');
});

test('related is not identical: one authored relation is RELATED, never EXACT',()=>{
 const doc=project();let s=open(doc);s=pick(s,doc,'left','wind.machine');
 const sel=select(s,doc);assert.equal(sel.state,'RELATED');assert.deepEqual(sel.targets,['data.asset']);
 assert.equal(linkedStateLine(sel,'right').text,'Related, not the same object');assert.notEqual(linkedStateLine(sel,'right').code,'same');
 assert.equal(sel.mappings[0].relation,'represented-by');
});

test('a choice of two returns every target and never selects one',()=>{
 const doc=project();let s=open(doc);s=pick(s,doc,'left','wind.sensor');
 const sel=select(s,doc);assert.equal(sel.state,'CHOICE');assert.deepEqual(sel.targets,['data.channel','data.sample']);
 assert.equal(linkedStateLine(sel,'right').text,'Several related objects: choose');assert.equal(s.pick?.id,'wind.sensor');assert.equal(s.pick?.side,'left');
});

test('an unresolved mapping is kept as a gap, never a target',()=>{
 const doc=project();let s=open(doc);s=pick(s,doc,'left','wind.foil');
 const sel=select(s,doc);assert.equal(sel.state,'ABSENT');assert.deepEqual(sel.targets,[]);
 assert.equal(sel.gaps.length,1);assert.equal(sel.gaps[0].state,'unresolved');assert.equal(sel.gaps[0].toId,null);
 assert.equal(linkedStateLine(sel,'right').text,'No counterpart in this view');assert.equal(linkedStateLine(sel,'left').text,'Only in left view');
});

test('labels are never matched: a same-label component with another ID is not a counterpart',()=>{
 const doc=project();doc.nodes.find(n=>n.id==='data.asset')!.label='Oscillating-foil device';const v=validateDocument(doc);
 let s=open(v,'physical','data-detail');s=pick(s,v,'left','wind.machine');assert.equal(select(s,v).state,'ABSENT');
 const same=openLinkedPerspective(v,{binding:bind(v),leftViewId:'physical',rightViewId:'data',mode:'same-cut',mappingBlockIds:[]});assert.ok(same.ok);
 const sp=pickLinked(same.state,v,same.state.binding,'left','wind.machine');assert.ok(sp.ok);assert.equal(select(sp.state,v).state,'ABSENT');
});

test('a private mapping block is absent from the public projection',()=>{
 const doc=project(),privateBlock=doc.blocks.find(b=>b.type==='table'&&b.transform==='mapping'&&b.rows[0][3]==='sampled-into')!;privateBlock.visibility='private';
 const author=validateDocument(doc),pub=publicDocument(author);
 assert.ok(discoverMappingBlocks(author).includes(privateBlock.id));assert.ok(!discoverMappingBlocks(pub).includes(privateBlock.id));
 let s=open(pub,'physical','data','public');s=pick(s,pub,'left','wind.sensor');
 const sel=select(s,pub);assert.equal(sel.state,'RELATED');assert.deepEqual(sel.targets,['data.channel']);
 assert.ok(linkedMappings(s,pub).every(m=>m.relation!=='sampled-into'));
 // Naming the private block in a public open is refused with the generic message.
 const refused=openLinkedPerspective(pub,{binding:bind(pub,'public'),leftViewId:'physical',rightViewId:'data',mappingBlockIds:[privateBlock.id]});
 assert.deepEqual(refused,{ok:false,reason:LINKED_PERSPECTIVE_UNAVAILABLE});
});

test('a stale binding is refused without a change',()=>{
 const doc=project();
 assert.equal(openLinkedPerspective(doc,{binding:{...bind(doc),epoch:doc.revision+1},leftViewId:'physical',rightViewId:'data'}).ok,false);
 const s=open(doc),stale={...s.binding,epoch:s.binding.epoch-1};
 assert.equal(pickLinked(s,doc,stale,'left','wind.sensor').ok,false);
 assert.equal(swapLinkedSides(s,{...s.binding,audience:'public'}).ok,false);
 assert.equal(setLinkedView(s,doc,stale,'right','etl').ok,false);
 assert.equal(resolveLinkedSelection({...s,pick:{side:'left',id:'wind.sensor'}},{...doc,revision:doc.revision+1},ids(doc,'physical'),ids(doc,'data')).state,'REFUSED');
});

test('swap keeps the anchor and the picked object; a view change keeps the anchor and drops a pick that left its view',()=>{
 const doc=project();let s=open(doc);s=pick(s,doc,'left','wind.sensor');
 const swapped=swapLinkedSides(s,s.binding);assert.ok(swapped.ok);
 assert.equal(swapped.state.leftViewId,'data');assert.equal(swapped.state.anchorNodeId,'wind.goal');assert.deepEqual(swapped.state.pick,{side:'right',id:'wind.sensor'});
 assert.equal(select(swapped.state,doc).state,'CHOICE');
 const moved=setLinkedView(swapped.state,doc,swapped.state.binding,'right','etl');assert.ok(moved.ok);assert.equal(moved.state.pick,null);assert.equal(moved.state.anchorNodeId,'wind.goal');
});

test('reconcile: another project or audience resets; a revision keeps what resolves and drops a lost pick visibly',()=>{
 const doc=project();let s=open(doc);s=pick(s,doc,'left','wind.site');
 assert.deepEqual(reconcileLinkedPerspective(s,doc,{...s.binding,audience:'public'}),{state:null,notice:LINKED_PERSPECTIVE_UNAVAILABLE});
 assert.equal(reconcileLinkedPerspective(s,{...doc,id:'other'},{...s.binding,projectId:'other'}).state,null);
 const next=structuredClone(doc);next.revision++;const physical=next.views.find(v=>v.id==='physical')!;physical.nodeIds=physical.nodeIds.filter(id=>id!=='wind.site');delete physical.positions['wind.site'];
 const out=reconcileLinkedPerspective(s,next,bind(next));
 assert.ok(out.state);assert.equal(out.state.pick,null);assert.equal(out.notice,LINKED_PICK_LOST);assert.equal(out.state.anchorNodeId,'wind.goal');assert.equal(out.state.binding.epoch,next.revision);
 assert.deepEqual(out.state.mappingBlockIds,s.mappingBlockIds);
});

test('up, down and the suggested companion view follow explicit drilldown and authored relations only',()=>{
 const doc=project();assert.equal(linkedParentView(doc,'physical'),'overview');assert.equal(linkedParentView(doc,'overview'),null);
 let s=open(doc,'overview','data');s=pick(s,doc,'left','nav.physical');assert.equal(linkedChildView(doc,s),'physical');
 const mappings=linkedMappings(open(doc),doc);assert.equal(suggestRightView(doc,'physical',mappings),'data','4 relations tie with 4 shared IDs; document order breaks the tie');
});
