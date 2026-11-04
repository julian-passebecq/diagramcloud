import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {pathToView,publicDocument} from '../src/core/operations';
import {childLinks,hierarchyRail,isPermittedPath,MAX_PARENT_PATHS,parentPaths} from '../src/core/hierarchy';

// Synthetic hierarchy: root holds A (opens view A), B (opens view B) and C (opens other). Views A and B each hold a
// component opening the shared view; a private root component P opens it directly; X only depends on A (an edge, not containment).
function project():Project{
 return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-hierarchy',title:'Synthetic hierarchy',rootViewId:'root',
  nodes:[{id:'a',label:'Synthetic A',childViewId:'va'},{id:'b',label:'Synthetic B',childViewId:'vb'},{id:'c',label:'Synthetic C',childViewId:'other'},{id:'p',label:'Synthetic private',visibility:'private',childViewId:'shared'},
   {id:'x',label:'Synthetic dependant'},{id:'s1',label:'Synthetic S1',childViewId:'shared'},{id:'s1b',label:'Synthetic S1 twin',childViewId:'shared'},{id:'s2',label:'Synthetic S2',childViewId:'shared'},
   {id:'s',label:'Synthetic shared inner',childViewId:'deep'},{id:'o',label:'Synthetic other inner'},{id:'d',label:'Synthetic deep inner'}],
  edges:[{id:'x-a',source:'x',target:'a',label:'depends on'}],
  views:[{id:'root',title:'Synthetic root',nodeIds:['a','b','c','p','x'],edgeIds:['x-a']},{id:'va',title:'Synthetic view A',nodeIds:['s1','s1b']},{id:'vb',title:'Synthetic view B',nodeIds:['s2']},
   {id:'shared',title:'Synthetic shared',nodeIds:['s']},{id:'other',title:'Synthetic other',nodeIds:['o']},{id:'deep',title:'Synthetic deep',nodeIds:['d']}]}));
}

test('hierarchy: every permitted parent path to a shared view is listed once per view chain, in root node order',()=>{
 const out=parentPaths(project(),'shared');
 assert.equal(out.truncated,false);
 assert.deepEqual(out.paths,[{viewIds:['root','va','shared'],via:['a','s1']},{viewIds:['root','vb','shared'],via:['b','s2']},{viewIds:['root','shared'],via:['p']}]);
 assert.deepEqual(parentPaths(project(),'deep').paths.map(p=>p.viewIds),[['root','va','shared','deep'],['root','vb','shared','deep'],['root','shared','deep']]);
 assert.deepEqual(parentPaths(project(),'root').paths,[{viewIds:['root'],via:[]}]);
 assert.deepEqual(parentPaths(project(),'missing').paths,[]);
});

test('hierarchy: public mode resolves against publicDocument, so a private parent is never offered',()=>{
 const pub=publicDocument(project());
 assert.deepEqual(parentPaths(pub,'shared').paths.map(p=>p.via),[['a','s1'],['b','s2']]);
 assert.ok(!JSON.stringify(parentPaths(pub,'deep')).includes('"p"'));
});

test('hierarchy: containment is never inferred from a dependency edge',()=>{
 const doc=project();
 assert.deepEqual(childLinks(doc,'root').map(l=>l.nodeId),['a','b','c','p']);
 assert.equal(hierarchyRail(doc,['root'],'root','x').down,undefined);
});

test('hierarchy: a drilldown cycle is never walked, and paths are bounded and say when they are truncated',()=>{
 const cyclic=structuredClone(project()) as Project;cyclic.nodes.find(n=>n.id==='d')!.childViewId='shared';
 assert.equal(parentPaths(cyclic,'deep').paths.length,3);
 assert.equal(isPermittedPath(cyclic,['root','va','shared','deep','shared']),false);
 assert.equal(hierarchyRail(cyclic,['root','va','shared','deep'],'deep','d').down,undefined,'Down never revisits a view on the path');
 const wide=structuredClone(project()) as Project;
 for(let i=0;i<MAX_PARENT_PATHS+3;i++){wide.nodes.push({...wide.nodes[0],id:`w${i}`,label:`Synthetic W${i}`,childViewId:`vw${i}`},{...wide.nodes[0],id:`ws${i}`,label:`Synthetic WS${i}`,childViewId:'shared'});wide.views.push({...wide.views[1],id:`vw${i}`,title:`Synthetic W${i}`,nodeIds:[`ws${i}`]});wide.views[0].nodeIds.push(`w${i}`);}
 const out=parentPaths(wide,'shared');assert.equal(out.paths.length,MAX_PARENT_PATHS);assert.equal(out.truncated,true);
});

test('hierarchy rail: Up keeps the parent and selects the leading component, Down opens the selected child, siblings follow parent order',()=>{
 const doc=project();
 const atRoot=hierarchyRail(doc,['root'],'root','c');
 assert.deepEqual(atRoot.down,{path:['root','other'],view:'other',selected:null});
 assert.equal(atRoot.up,undefined);assert.equal(atRoot.previous,undefined);assert.equal(atRoot.next,undefined);
 const inA=hierarchyRail(doc,['root','va'],'va',null);
 assert.deepEqual(inA.up,{path:['root'],view:'root',selected:'a'});
 assert.deepEqual(inA.next,{path:['root','vb'],view:'vb',selected:null});assert.equal(inA.previous,undefined);
 assert.equal(inA.siblings,4,'children of root by distinct view: A, B, other and the author-only shortcut to shared');
 assert.equal(hierarchyRail(publicDocument(doc),['root','va'],'va',null).siblings,3,'the private shortcut is not a public sibling');
 const inB=hierarchyRail(doc,['root','vb'],'vb',null);
 assert.deepEqual(inB.previous,{path:['root','va'],view:'va',selected:null});assert.deepEqual(inB.next,{path:['root','other'],view:'other',selected:null});
 const inShared=hierarchyRail(doc,['root','va','shared'],'shared',null);
 assert.equal(inShared.siblings,1,'two components of view A opening the shared view are one sibling');
 assert.equal(inShared.previous,undefined);assert.equal(inShared.next,undefined);
 // An ancestor active with its child still open: Down from it replaces the open tail rather than extending it.
 const ancestor=hierarchyRail(doc,['root','va','shared','deep'],'shared','s');
 assert.deepEqual(ancestor.down,{path:['root','va','shared','deep'],view:'deep',selected:null});
 assert.deepEqual(ancestor.up,{path:['root','va'],view:'va',selected:'s1'});
});

// A valid chain of views where every view holds two components opening the next one, plus one unreachable view:
// 2^N raw walks, one view chain. Parent paths and pathToView must stay polynomial.
function doubledChain(n:number):Project{
 const nodes:Project['nodes'][number][]=[],views:{id:string;title:string;nodeIds:string[]}[]=[];
 for(let i=0;i<n;i++){const ids=i<n-1?[`c${i}a`,`c${i}b`]:[`c${i}a`];for(const id of ids)nodes.push({id,label:`Synthetic ${id}`,...(i<n-1?{childViewId:`v${i+1}`}:{})} as Project['nodes'][number]);views.push({id:`v${i}`,title:`Synthetic chain ${i}`,nodeIds:ids});}
 nodes.push({id:'u0',label:'Synthetic unreachable'} as Project['nodes'][number]);views.push({id:'unreachable',title:'Synthetic unreachable',nodeIds:['u0']});
 return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-doubled-chain',title:'Synthetic doubled chain',rootViewId:'v0',nodes,edges:[],views}));
}
test('hierarchy: duplicate links and unreachable views never make parent paths or pathToView exponential',()=>{
 const doc=doubledChain(40),chain=doc.views.filter(v=>v.id!=='unreachable').map(v=>v.id);
 const started=performance.now();
 const last=parentPaths(doc,'v39');
 assert.equal(last.truncated,false);assert.equal(last.paths.length,1);assert.deepEqual(last.paths[0].viewIds,chain);assert.deepEqual(last.paths[0].via,chain.slice(0,-1).map((_,i)=>`c${i}a`),'the first component leading down is named');
 assert.deepEqual(parentPaths(doc,'unreachable'),{paths:[],truncated:false});
 assert.deepEqual(pathToView(doc,'unreachable'),['unreachable']);
 assert.deepEqual(pathToView(doc,'v39'),chain);
 assert.ok(performance.now()-started<500,`hierarchy queries took ${Math.round(performance.now()-started)} ms`);
});

test('hierarchy rail: an invalid recorded path offers no move, and nothing is written to the document',()=>{
 const doc=project(),before=JSON.stringify(doc);
 assert.deepEqual(hierarchyRail(doc,['shared'],'shared',null),{siblings:0,position:0});
 assert.deepEqual(hierarchyRail(doc,['root','deep'],'deep',null),{siblings:0,position:0});
 parentPaths(doc,'deep');hierarchyRail(doc,['root','va','shared'],'shared','s');
 assert.equal(JSON.stringify(doc),before);assert.equal(doc.revision,project().revision);
});
