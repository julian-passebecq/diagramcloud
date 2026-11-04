import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWorkbenchLayout,validateWorkbenchLayout,fitWorkbenchLayout,fitFloatingRect} from '../src/core/workbenchLayout';
import {arrangementScopeKey,readWorkspaceArrangements,restoreWorkspaceArrangement,changeWorkspaceArrangements} from '../src/core/workspaceArrangements';
const rect={x:900,y:400,width:380,height:480},slots={explorer:true,companion:true,dock:true,rail:true};
test('floating releases docked space, stays mounted, and suspends on compact and Present without changing requests',()=>{
 const layout={...defaultWorkbenchLayout(),dockCollapsed:false,floating:{companion:rect,dock:{x:20,y:30,width:720,height:300}}},before=JSON.stringify(layout);
 const desktop=fitWorkbenchLayout(layout,1440,900,slots);assert.deepEqual(desktop.floating,{companion:true,dock:true});assert.equal(desktop.companion,0);assert.equal(desktop.dock,0);assert(desktop.visible.companion&&desktop.visible.dock);
 for(const input of [{...layout,compactPane:'companion' as const},{...layout,preset:'present' as const}]){const fit=fitWorkbenchLayout(input,input.preset==='present'?1440:390,844,slots);assert.deepEqual(fit.floating,{companion:false,dock:false});}
 assert.equal(JSON.stringify(layout),before);
});
test('measured bounds fit all rectangle edges, preserve request, and apply pane-specific minimums',()=>{
 const before={...rect};assert.deepEqual(fitFloatingRect(rect,600,350,'companion'),{x:220,y:0,width:380,height:350});assert.deepEqual(rect,before);
 assert.deepEqual(fitFloatingRect({x:-100,y:999,width:1,height:1},600,350,'dock'),{x:0,y:170,width:320,height:180});
});
test('old arrangement records migrate only in memory; floating save/restore is detached and scoped',()=>{
 const scope={projectId:'p',hostId:'h',audience:'author' as const},values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const {floating,...legacy}=defaultWorkbenchLayout();const raw=JSON.stringify({version:1,scope,entries:[{name:'Old',layout:legacy}]});storage.setItem(arrangementScopeKey(scope),raw);
 const read=readWorkspaceArrangements(storage,scope);assert.equal(read.status,'ready');assert.deepEqual(read.entries[0].layout.floating,{companion:null,dock:null});assert.equal(storage.getItem(arrangementScopeKey(scope)),raw);
 const next={...defaultWorkbenchLayout(),floating:{companion:rect,dock:null}};const save=changeWorkspaceArrangements(storage,scope,raw,{type:'save',name:'Float',layout:next});assert(save.ok);
 const restored=restoreWorkspaceArrangement(storage,scope,save.read.basis,'Float');assert(restored.ok);assert.deepEqual(restored.layout,next);restored.layout.floating.companion!.x=0;assert.equal(next.floating.companion.x,900);
 assert.equal(readWorkspaceArrangements(storage,{...scope,audience:'public'}).entries.length,0);
});
test('floating imports reject partial, extra, nonfinite, fractional and oversized geometry',()=>{
 for(const floating of [null,{}, {companion:null}, {companion:null,dock:null,extra:true},{companion:{...rect,x:-1},dock:null},{companion:{...rect,width:NaN},dock:null},{companion:{...rect,height:2001},dock:null},{companion:{...rect,x:.5},dock:null},{companion:{...rect,sourceId:'secret'},dock:null}])assert.throws(()=>validateWorkbenchLayout({...defaultWorkbenchLayout(),floating}));
});
