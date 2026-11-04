import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWorkbenchLayout,validateWorkbenchLayout,fitWorkbenchLayout,fitFloatingRect} from '../src/core/workbenchLayout';
import {arrangementScopeKey,readWorkspaceArrangements,restoreWorkspaceArrangement,changeWorkspaceArrangements} from '../src/core/workspaceArrangements';
const rect={x:900,y:400,width:380,height:480},slots={explorer:true,companion:true,dock:true,rail:true};
test('floating releases docked space, stays mounted, and suspends on compact and Present without changing requests',()=>{
 const layout={...defaultWorkbenchLayout(),dockCollapsed:false,floating:{explorer:null,companion:rect,dock:{x:20,y:30,width:720,height:300}}},before=JSON.stringify(layout);
 const desktop=fitWorkbenchLayout(layout,1440,900,slots);assert.deepEqual(desktop.floating,{explorer:false,companion:true,dock:true});assert.equal(desktop.companion,0);assert.equal(desktop.dock,0);assert(desktop.visible.companion&&desktop.visible.dock);
 for(const input of [{...layout,compactPane:'companion' as const},{...layout,preset:'present' as const}]){const fit=fitWorkbenchLayout(input,input.preset==='present'?1440:390,844,slots);assert.deepEqual(fit.floating,{explorer:false,companion:false,dock:false});}
 assert.equal(JSON.stringify(layout),before);
});
test('measured bounds fit all rectangle edges, preserve request, and apply pane-specific minimums',()=>{
 const before={...rect};assert.deepEqual(fitFloatingRect(rect,600,350,'companion'),{x:220,y:0,width:380,height:350});assert.deepEqual(rect,before);
 assert.deepEqual(fitFloatingRect({x:-100,y:999,width:1,height:1},600,350,'dock'),{x:0,y:170,width:320,height:180});
});
test('old arrangement records migrate only in memory; floating save/restore is detached and scoped',()=>{
 const scope={projectId:'p',hostId:'h',audience:'author' as const},values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const {floating,...legacy}=defaultWorkbenchLayout();const raw=JSON.stringify({version:1,scope,entries:[{name:'Old',layout:legacy}]});storage.setItem(arrangementScopeKey(scope),raw);
 const read=readWorkspaceArrangements(storage,scope);assert.equal(read.status,'ready');assert.deepEqual(read.entries[0].layout.floating,{explorer:null,companion:null,dock:null});assert.equal(read.entries[0].layout.density,'comfortable');assert.equal(storage.getItem(arrangementScopeKey(scope)),raw);
 const next={...defaultWorkbenchLayout(),floating:{explorer:null,companion:rect,dock:null}};const save=changeWorkspaceArrangements(storage,scope,raw,{type:'save',name:'Float',layout:next});assert(save.ok);
 const restored=restoreWorkspaceArrangement(storage,scope,save.read.basis,'Float');assert(restored.ok);assert.deepEqual(restored.layout,next);restored.layout.floating.companion!.x=0;assert.equal(next.floating.companion.x,900);
 assert.equal(readWorkspaceArrangements(storage,{...scope,audience:'public'}).entries.length,0);
});
test('floating imports reject partial, extra, nonfinite, fractional and oversized geometry',()=>{
 for(const floating of [null,{}, {companion:null}, {companion:null,dock:null,extra:true},{companion:{...rect,x:-1},dock:null},{companion:{...rect,width:NaN},dock:null},{companion:{...rect,height:2001},dock:null},{companion:{...rect,x:.5},dock:null},{companion:{...rect,sourceId:'secret'},dock:null},{explorer:null,companion:null},{explorer:null,companion:null,dock:null,extra:null},{explorer:{...rect,width:119},companion:null,dock:null},{explorer:{...rect,y:-4},companion:null,dock:null},{explorer:{...rect,x:1.5},companion:null,dock:null},{explorer:'left',companion:null,dock:null}])assert.throws(()=>validateWorkbenchLayout({...defaultWorkbenchLayout(),floating}));
});

test('floating Explorer releases its docked column, keeps the request and suspends on compact and Present',()=>{
 const explorer={x:16,y:16,width:320,height:560},layout={...defaultWorkbenchLayout(),floating:{explorer,companion:null,dock:null}},before=JSON.stringify(layout);
 const docked=fitWorkbenchLayout(defaultWorkbenchLayout(),1440,900,slots),floated=fitWorkbenchLayout(layout,1440,900,slots);
 assert(docked.explorer>0);assert.equal(floated.explorer,0);assert.equal(floated.floating.explorer,true);assert(floated.visible.explorer);assert(floated.primary>docked.primary,'the released column goes to the primary view');
 const compact=fitWorkbenchLayout({...layout,compactPane:'explorer'},390,844,slots);assert.equal(compact.floating.explorer,false);assert.equal(compact.active,'explorer');assert(compact.visible.explorer);
 const present=fitWorkbenchLayout({...layout,preset:'present'},1440,900,slots);assert.equal(present.floating.explorer,false);assert.equal(present.visible.explorer,false);
 const collapsed=fitWorkbenchLayout({...layout,panels:{...layout.panels,sidebarCollapsed:true}},1440,900,slots);assert.equal(collapsed.floating.explorer,false);assert.equal(collapsed.explorer,0);
 const noSlot=fitWorkbenchLayout(layout,1440,900,{...slots,explorer:false});assert.equal(noSlot.floating.explorer,false);
 assert.equal(JSON.stringify(layout),before);assert.deepEqual(validateWorkbenchLayout(JSON.parse(before)).floating.explorer,explorer);
});
test('Explorer floating bounds: 220px minimum width, all edges inside the measured frame, request untouched',()=>{
 const request={x:5000,y:5000,width:100,height:100},copy={...request};
 assert.deepEqual(fitFloatingRect(request,800,500,'explorer'),{x:580,y:320,width:220,height:180});assert.deepEqual(request,copy);
 assert.deepEqual(fitFloatingRect({x:0,y:0,width:2000,height:2000},800,500,'explorer'),{x:0,y:0,width:800,height:500});
 assert.equal(fitFloatingRect({x:0,y:0,width:221,height:200},150,500,'explorer').width,150,'never wider than the frame');
});
