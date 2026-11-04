import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWorkbenchLayout,validateWorkbenchLayout,fitWorkbenchLayout} from '../src/core/workbenchLayout';
import {ARRANGEMENT_LIMIT,arrangementScopeKey,changeWorkspaceArrangements,readWorkspaceArrangements,restoreWorkspaceArrangement,type ArrangementScope} from '../src/core/workspaceArrangements';
const scope:ArrangementScope={projectId:'project',audience:'author',hostId:'local:4173'};
function memory(){const values=new Map<string,string>();return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
const layout=()=>({...defaultWorkbenchLayout(),preset:'compare' as const,companionPercent:60,dockHeight:310,dockCollapsed:false,railCollapsed:true,mapCollapsed:true,panels:{sidebarSide:'right' as const,sidebarWidth:410,detailsWidth:470,sidebarCollapsed:true,detailsCollapsed:false}});

test('complete physical layout saves and restores detached, with controlled route/map collapse',()=>{
 const storage=memory(),before=layout(),saved=changeWorkspaceArrangements(storage,scope,null,{type:'save',name:'Review',layout:before});assert(saved.ok);
 const read=readWorkspaceArrangements(storage,scope);assert.equal(read.status,'ready');const restored=restoreWorkspaceArrangement(storage,scope,read.basis,'Review');assert(restored.ok);assert.deepEqual(restored.layout,before);restored.layout.panels.sidebarWidth=220;assert.equal(read.entries[0].layout.panels.sidebarWidth,410);assert.deepEqual(before,layout());
 assert(![...storage.values.values()][0].includes('nodeId'));assert.equal(fitWorkbenchLayout(before,1600,900,{explorer:true,companion:true,dock:true,rail:true}).rail,false);
});
test('strict new layout flags preserve old in-memory callers without accepting arbitrary fields',()=>{
 const {railCollapsed,mapCollapsed,...legacy}=defaultWorkbenchLayout();assert.deepEqual(validateWorkbenchLayout(legacy),defaultWorkbenchLayout());
 for(const delta of [{mapCollapsed:'yes'},{railCollapsed:1},{nodeId:'private-node'}])assert.throws(()=>validateWorkbenchLayout({...legacy,...delta}));
});
test('project, audience and host isolate names and reject a copied foreign envelope',()=>{
 const storage=memory();assert(changeWorkspaceArrangements(storage,scope,null,{type:'save',name:'PRIVATE_AUTHOR_NAME',layout:layout()}).ok);
 for(const target of [{...scope,projectId:'other'},{...scope,audience:'public' as const},{...scope,hostId:'another'}]){const read=readWorkspaceArrangements(storage,target);assert.equal(read.status,'missing');assert.deepEqual(read.entries,[]);assert(!restoreWorkspaceArrangement(storage,target,null,'PRIVATE_AUTHOR_NAME').ok);storage.setItem(arrangementScopeKey(target),storage.getItem(arrangementScopeKey(scope))!);assert.equal(readWorkspaceArrangements(storage,target).status,'corrupt');assert.deepEqual(readWorkspaceArrangements(storage,target).entries,[]);}
});
test('invalid, future, oversized or unknown fields stay untouched until explicit discard',()=>{
 const storage=memory(),key=arrangementScopeKey(scope);for(const raw of ['{bad',JSON.stringify({version:2,scope,entries:[]}),JSON.stringify({version:1,scope,entries:[{name:'x',layout:{...layout(),execute:true}}]}),'x'.repeat(32769)]){storage.setItem(key,raw);const read=readWorkspaceArrangements(storage,scope);assert.equal(read.status,'corrupt');assert.deepEqual(read.entries,[]);assert(!changeWorkspaceArrangements(storage,scope,raw,{type:'save',name:'x',layout:layout()}).ok);assert.equal(storage.getItem(key),raw);assert(changeWorkspaceArrangements(storage,scope,raw,{type:'discard-corrupt'}).ok);assert.equal(storage.getItem(key),null);}
});
test('stale selected lists cannot overwrite, restore or delete newer arrangements',()=>{
 const storage=memory(),first=changeWorkspaceArrangements(storage,scope,null,{type:'save',name:'First',layout:layout()});assert(first.ok);const second=changeWorkspaceArrangements(storage,scope,first.read.basis,{type:'save',name:'Second',layout:defaultWorkbenchLayout()});assert(second.ok);
 for(const action of [{type:'save' as const,name:'Stale',layout:layout()},{type:'delete' as const,name:'First'}]){const out=changeWorkspaceArrangements(storage,scope,first.read.basis,action);assert(!out.ok);assert.equal(out.reason,'conflict');}
 assert(!restoreWorkspaceArrangement(storage,scope,first.read.basis,'First').ok);assert.equal(storage.getItem(arrangementScopeKey(scope)),second.read.basis);
});
test('bounded unique names and record counts fail without replacing previous data',()=>{
 const storage=memory();let basis:string|null=null;for(let i=0;i<ARRANGEMENT_LIMIT;i++){const out=changeWorkspaceArrangements(storage,scope,basis,{type:'save',name:'Layout '+i,layout:layout()});assert(out.ok);basis=out.read.basis;}
 for(const name of ['Layout 0','too many','x'.repeat(61),'bad\nname',' padded '])assert(!changeWorkspaceArrangements(storage,scope,basis,{type:'save',name,layout:layout()}).ok);
 assert.equal(storage.getItem(arrangementScopeKey(scope)),basis);assert(changeWorkspaceArrangements(storage,scope,basis,{type:'delete',name:'Layout 0'}).ok);
});
test('blocked or full storage produces explicit failures; delete does not mutate the current layout',()=>{
 const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');},removeItem:()=>{throw Error('blocked');}};
 assert.equal(readWorkspaceArrangements(blocked,scope).status,'unavailable');assert(!changeWorkspaceArrangements(blocked,scope,null,{type:'save',name:'No',layout:layout()}).ok);
 const storage=memory(),saved=changeWorkspaceArrangements(storage,scope,null,{type:'save',name:'Keep',layout:layout()});assert(saved.ok);const full={...storage,setItem:()=>{throw Error('quota');}};assert(!changeWorkspaceArrangements(full,scope,saved.read.basis,{type:'delete',name:'Keep'}).ok);assert.equal(storage.getItem(arrangementScopeKey(scope)),saved.read.basis);
 const current=layout(),before=JSON.stringify(current);assert(changeWorkspaceArrangements(storage,scope,saved.read.basis,{type:'delete',name:'Keep'}).ok);assert.equal(JSON.stringify(current),before);
});

test('storage never auto-applies an arrangement and public rendered markup omits author names',async()=>{
 const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{WorkspaceArrangements}=await import('../src/ui/WorkspaceArrangements');const storage=memory();assert(changeWorkspaceArrangements(storage,scope,null,{type:'save',name:'PRIVATE_AUTHOR_DESK',layout:layout()}).ok);let restores=0;
 const render=(audience:'public'|'author')=>renderToStaticMarkup(createElement(WorkspaceArrangements,{scope:{...scope,audience},layout:defaultWorkbenchLayout(),storage:()=>storage,isCurrent:()=>true,onRestore:()=>{restores++;}}));
 assert.match(render('author'),/PRIVATE_AUTHOR_DESK/);assert.doesNotMatch(render('public'),/PRIVATE_AUTHOR_DESK/);assert.equal(restores,0);
});
