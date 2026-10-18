import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWorkbenchLayout,fitWorkbenchLayout,selectWorkbenchPane,setWorkbenchPreset,validateWorkbenchLayout} from '../src/core/workbenchLayout';
import {studioLayoutPlacement,writeStudioLayoutPreference,readStudioLayoutPreference} from '../src/core/studioLayout';
const slots={explorer:true,companion:true,dock:true,rail:true};
test('Explain starts with one primary view, companion and explorer; dock is opt-in',()=>{
 const out=fitWorkbenchLayout(defaultWorkbenchLayout(),1600,900,slots);assert.deepEqual(out.visible,{primary:true,explorer:true,companion:true,dock:false});assert.equal(out.compact,false);assert.ok(out.primary>=360);
});
test('Compare divides available canvas space rather than allocating two whole workspaces',()=>{
 const layout=setWorkbenchPreset(defaultWorkbenchLayout(),'compare'),out=fitWorkbenchLayout(layout,1600,900,slots);assert.equal(out.companion,542);assert.ok(out.primary>=360);
});
test('presentation suppresses chrome without destroying the previous layout or slot state',()=>{
 const original={...defaultWorkbenchLayout(),dockCollapsed:false},present=setWorkbenchPreset(original,'present');
 const out=fitWorkbenchLayout(present,1600,900,slots);assert.deepEqual(out.visible,{primary:true,explorer:false,companion:false,dock:false});assert.equal(out.rail,false);
 assert.deepEqual(setWorkbenchPreset(present,'explain'),original);
});
test('missing companion or dock returns compact reader to primary',()=>{
 const state=selectWorkbenchPane(defaultWorkbenchLayout(),'companion'),out=fitWorkbenchLayout(state,390,844,{...slots,companion:false});assert.equal(out.active,'primary');assert.equal(out.visible.primary,true);
});
test('390x844 has exactly one accessible reading pane, no squeezed multi-column layout',()=>{
 for(const pane of ['primary','explorer','companion','dock'] as const){const out=fitWorkbenchLayout(selectWorkbenchPane(defaultWorkbenchLayout(),pane),390,844,slots);assert.equal(out.compact,true);assert.equal(out.active,pane);assert.equal(Object.values(out.visible).filter(Boolean).length,1);assert.equal(out.rail,false);}
});
test('very short wide viewport also uses the compact route',()=>{assert.equal(fitWorkbenchLayout(defaultWorkbenchLayout(),1600,400,slots).compact,true);});
test('physical requests survive compact navigation and effective clamping',()=>{
 const state={...defaultWorkbenchLayout(),panels:{...defaultWorkbenchLayout().panels,sidebarWidth:420,detailsWidth:480},companionPercent:70,dockCollapsed:false},before=JSON.stringify(state);
 for(const w of [390,900,1201,1440,2000]){const fit=fitWorkbenchLayout(state,w,900,slots);if(!fit.compact)assert.ok(fit.primary>=360);}
 assert.equal(JSON.stringify(state),before);
});
test('new session fields cannot change legacy preference bytes or gain persistence',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const state=selectWorkbenchPane(setWorkbenchPreset(defaultWorkbenchLayout(),'compare'),'dock');assert.equal(writeStudioLayoutPreference(storage,'project','host',state.panels),true);
 const raw=[...values.values()][0];assert.equal(raw.includes('compare'),false);assert.equal(raw.includes('dock'),false);assert.deepEqual(studioLayoutPlacement(readStudioLayoutPreference(storage,'project','host').layout),studioLayoutPlacement(state.panels));
});
test('layout rejects nonfinite, out-of-range, extra and unknown state without echoing values',()=>{
 for(const delta of [{dockHeight:NaN},{dockHeight:139},{companionPercent:71},{preset:'PRIVATE_SENTINEL'},{compactPane:'run'},{execute:true}])assert.throws(()=>validateWorkbenchLayout({...defaultWorkbenchLayout(),...delta}),/^Error: Invalid workbench layout$/);
 for(const [w,h] of [[0,900],[390,NaN],[Infinity,900],[390,0]])assert.throws(()=>fitWorkbenchLayout(defaultWorkbenchLayout(),w,h,slots));
});
test('all returned state is detached, no shared default objects',()=>{
 const a=defaultWorkbenchLayout(),b=defaultWorkbenchLayout();a.panels.sidebarCollapsed=true;assert.equal(b.panels.sidebarCollapsed,false);
 const copy=validateWorkbenchLayout(b);copy.panels.sidebarWidth=420;assert.equal(b.panels.sidebarWidth,null);
});
