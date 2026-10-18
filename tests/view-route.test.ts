import test from 'node:test';
import assert from 'node:assert/strict';
import {hierarchyRail,isPermittedPath,parentPaths,resolveViewRoute,VIEW_ROUTE_UNAVAILABLE,MAX_PARENT_PATHS} from '../src/core/hierarchy';
import type {Project} from '../src/core/model';

// Synthetic, already-permitted domain fixture. These tests exercise navigation, not import/privacy qualification.
function graph(links:Record<string,string[]>,root='root'):Project {
 const all=[...new Set([root,...Object.keys(links),...Object.values(links).flat()])];
 const nodes=Object.entries(links).flatMap(([from,tos])=>tos.map((to,i)=>({id:`${from}.n${i}`,childViewId:to,label:to})));
 return {rootViewId:root,views:all.map(id=>({id,nodeIds:nodes.filter(n=>n.id.startsWith(`${id}.n`)).map(n=>n.id)})),nodes} as Project;
}
const diamond=()=>graph({root:['a','b'],a:['shared','left'],b:['shared','right'],shared:['detail']});
const path=(doc:Project,to:string,from:string[]=[])=>{const out=resolveViewRoute(doc,to,from);assert.equal(out.state,'resolved');if(out.state!=='resolved')throw Error('unresolved');return out.path;};

test('preserves second parent where the old root-first traversal chooses the first',()=>{
 const doc=diamond();assert.deepEqual(parentPaths(doc,'shared').paths[0].viewIds,['root','a','shared']);
 assert.deepEqual(path(doc,'shared',['root','b','shared']),['root','b','shared']);
 assert.deepEqual(path(doc,'detail',['root','b','shared']),['root','b','shared','detail']);
});
test('moving to an ancestor or root deliberately truncates only descendants',()=>{
 const doc=diamond();assert.deepEqual(path(doc,'b',['root','b','shared','detail']),['root','b']);assert.deepEqual(path(doc,'root',['root','b']),['root']);
});
test('a sibling keeps the common chosen parent',()=>{
 assert.deepEqual(path(diamond(),'right',['root','b','shared','detail']),['root','b','right']);
});
test('a target outside the current branch may use its only rooted path',()=>{
 assert.deepEqual(path(diamond(),'left',['root','b','right']),['root','a','left']);
});
test('no chosen parent means explicit choice, not first-match navigation',()=>{
 const out=resolveViewRoute(diamond(),'shared');assert.equal(out.state,'choose');if(out.state!=='choose')return;
 assert.deepEqual(out.paths.map(p=>p.viewIds),[['root','a','shared'],['root','b','shared']]);assert.equal(out.truncated,false);
});
test('ambiguity below the chosen parent also requires a choice',()=>{
 const doc=graph({root:['a','b'],b:['x','y'],x:['target'],y:['target'],a:['target']});
 const out=resolveViewRoute(doc,'target',['root','b']);assert.equal(out.state,'choose');if(out.state!=='choose')return;
 assert.deepEqual(out.paths.map(p=>p.viewIds),[['root','b','x','target'],['root','b','y','target']]);
});
test('explicit choice is validated on current data and can deliberately change parent',()=>{
 const doc=diamond(),out=resolveViewRoute(doc,'shared',['root','a','shared'],['root','b','shared']);
 assert.deepEqual(out,{state:'resolved',path:['root','b','shared'],basis:'explicit'});
});
test('an explicit invalid path refuses without falling back',()=>{
 for(const p of [[],['shared'],['root','missing','shared'],['root','a','b','shared'],['root','a'],['root','a','root','a','shared']])assert.equal(resolveViewRoute(diamond(),'shared',[],p).state,'unavailable');
});
test('revoked current ancestry cannot silently choose a surviving alternative',()=>{
 const doc=graph({root:['a','b'],a:['shared'],b:[]});assert.equal(resolveViewRoute(doc,'shared',['root','b','shared']).state,'unavailable');
});
test('hidden and missing targets receive exactly the same generic response',()=>{
 const doc=graph({root:['public']});assert.deepEqual(resolveViewRoute(doc,'private'),resolveViewRoute(doc,'missing'));
 assert.deepEqual(resolveViewRoute(doc,'private'),{state:'unavailable',message:VIEW_ROUTE_UNAVAILABLE});
});
test('an existing orphan is unavailable, never a rootless path',()=>{
 const doc=graph({root:['a'],orphan:[]});assert.equal(resolveViewRoute(doc,'orphan').state,'unavailable');
});
test('two components opening one child are one route; first via ID is stable',()=>{
 const doc=graph({root:['a','a'],a:['shared','shared']});
 assert.deepEqual(path(doc,'shared'),['root','a','shared']);assert.equal(parentPaths(doc,'shared').paths.length,1);
});
test('dependency edges and matching labels do not create hierarchy or identity',()=>{
 const doc=graph({root:['a'],orphan:[]});doc.edges=[{id:'e',source:'root.n0',target:'orphan',kind:'dependency'}] as Project['edges'];doc.nodes[0].label='orphan';
 assert.equal(resolveViewRoute(doc,'orphan').state,'unavailable');
});
test('path listing has a visible bound and preserves a chosen route beyond that bound',()=>{
 const branches=Array.from({length:18},(_,i)=>`b${i}`),doc=graph({root:branches,...Object.fromEntries(branches.map(b=>[b,['target']]))});
 const out=resolveViewRoute(doc,'target');assert.equal(out.state,'choose');if(out.state!=='choose')return;
 assert.equal(out.paths.length,MAX_PARENT_PATHS);assert.equal(out.truncated,true);
 assert.deepEqual(path(doc,'target',['root','b17']),['root','b17','target']);
 assert.equal(resolveViewRoute(doc,'target',[],['root','b17','target']).state,'resolved');
});
test('duplicate membership explosion is deduplicated before enumeration',()=>{
 const links:Record<string,string[]>={root:Array(50).fill('n0')};for(let i=0;i<25;i++)links[`n${i}`]=Array(30).fill(`n${i+1}`);
 assert.equal(path(graph(links),'n25').length,27);
});
test('disconnected exponential DAG is pruned before path enumeration',()=>{
 const links:Record<string,string[]>={root:['a0','b0'],orphan:[]};for(let i=0;i<24;i++){links[`a${i}`]=[`a${i+1}`,`b${i+1}`];links[`b${i}`]=[`a${i+1}`,`b${i+1}`];}
 assert.equal(resolveViewRoute(graph(links),'orphan').state,'unavailable');
});
test('changing node order cannot change an already valid chosen parent',()=>{
 const doc=diamond();doc.views[0].nodeIds.reverse();assert.deepEqual(path(doc,'detail',['root','a','shared']),['root','a','shared','detail']);
});
test('result mutation and calls never mutate the input or caller pointers',()=>{
 const doc=diamond(),before=JSON.stringify(doc),current=['root','b','shared'];const out=resolveViewRoute(doc,'detail',current);
 if(out.state==='resolved')out.path[0]='changed';assert.equal(JSON.stringify(doc),before);assert.deepEqual(current,['root','b','shared']);
 const choices=resolveViewRoute(doc,'shared');if(choices.state==='choose'){choices.paths[0].viewIds[0]='changed';choices.paths[0].via[0]='changed';}
 assert.equal(JSON.stringify(doc),before);assert.equal(resolveViewRoute(doc,'shared').state,'choose');
});
test('rail remains compatible with a retained chosen route',()=>{
 const doc=diamond(),p=path(doc,'detail',['root','b','shared']);assert.equal(isPermittedPath(doc,p),true);
 assert.deepEqual(hierarchyRail(doc,p,'detail',null).up?.path,['root','b','shared']);
});
test('unknown current path and malformed explicit path refuse',()=>{
 assert.equal(resolveViewRoute(diamond(),'shared',['root','bad']).state,'unavailable');
 assert.equal(resolveViewRoute(diamond(),'shared',[],null as unknown as string[]).state,'unavailable');
});
