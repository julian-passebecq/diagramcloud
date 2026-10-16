import {studioLayoutPreferenceKey,readStudioLayoutPreference,writeStudioLayoutPreference,studioLayoutPlacement,type StudioLayoutPreferenceStorage} from '../src/core/studioLayout';
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultStudioLayout,validateStudioLayout,fitStudioLayout,studioLayoutScope} from '../src/core/studioLayout';

test('session defaults and validated copies carry only physical UI choices',()=>{
 const first=defaultStudioLayout(),other=defaultStudioLayout();assert.notEqual(first,other);assert.deepEqual(first,{sidebarSide:'left',sidebarWidth:null,detailsWidth:null,sidebarCollapsed:false,detailsCollapsed:false});
 const copied=validateStudioLayout(first);assert.notEqual(copied,first);copied.sidebarSide='right';assert.equal(first.sidebarSide,'left');
 assert.notEqual(studioLayoutScope('c','a:b'),studioLayoutScope('b:c','a'));assert.notEqual(studioLayoutScope('p','localhost:4173'),studioLayoutScope('p','127.0.0.1:4173'));
});
test('unknown keys, malformed sizes and secret-bearing values fail without echoing input',()=>{
 const base=defaultStudioLayout();for(const input of [null,[],{}, {...base,project:'PRIVATE_LAYOUT_SENTINEL'}, {...base,sidebarSide:'bottom'}, {...base,sidebarWidth:'password=PRIVATE_LAYOUT_SENTINEL'}, {...base,sidebarWidth:NaN},{...base,sidebarWidth:Infinity},{...base,sidebarWidth:219},{...base,sidebarWidth:421},{...base,sidebarWidth:220.5},{...base,detailsWidth:259},{...base,detailsWidth:481},{...base,detailsCollapsed:'false'}])assert.throws(()=>validateStudioLayout(input),/^Error: Invalid workspace layout$/);
 for(const width of [NaN,Infinity,0,-1,500.5])assert.throws(()=>fitStudioLayout(base,width,true),/^Error: Invalid workspace width$/);
});
test('effective wide widths reserve useful main space without changing requested dimensions',()=>{
 const layout={...defaultStudioLayout(),sidebarSide:'right' as const,sidebarWidth:420,detailsWidth:480},before=JSON.stringify(layout);
 for(const width of [1201,1280,1440,1600,2000,5000]){const fit=fitStudioLayout(layout,width,true);assert.equal(fit.desktop,true);assert(fit.sidebar>=220&&fit.sidebar<=420);assert(fit.details>=260&&fit.details<=480);assert(Math.min(width,2000)-fit.sidebar-fit.details>=360);}
 assert.equal(JSON.stringify(layout),before);assert.equal(fitStudioLayout(defaultStudioLayout(),1700,false).sidebar,330);assert.equal(fitStudioLayout(defaultStudioLayout(),1700,true).sidebar,300);
});
test('collapse affects visibility only, and compact fitting leaves requested desktop widths ready for return',()=>{
 const layout={...defaultStudioLayout(),sidebarWidth:420,detailsWidth:480,sidebarCollapsed:true,detailsCollapsed:true};
 for(const width of [360,390,760,1200]){const fit=fitStudioLayout(layout,width,true);assert.equal(fit.desktop,false);assert.equal(fit.sidebarVisible,false);assert.equal(fit.detailsVisible,false);assert.equal(layout.sidebarWidth,420);}
 assert.equal(fitStudioLayout(layout,1440,false).detailsVisible,false);assert.equal(fitStudioLayout({...layout,detailsCollapsed:false},1440,true).detailsVisible,true);
 const fresh=defaultStudioLayout();assert.equal(fresh.sidebarSide,'left');assert.equal(fresh.sidebarWidth,null);assert.equal(fresh.detailsWidth,null);assert.equal(layout.sidebarCollapsed,true);
});

function layoutMemory(){const values=new Map<string,string>();let writes=0;return {values,writes:()=>writes,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{writes++;values.set(key,value);}};}

test('explicit layout save stores only bounded placement and widths, with exact project/host isolation',()=>{
 const storage=layoutMemory(),layout={...defaultStudioLayout(),sidebarSide:'right' as const,sidebarWidth:420,detailsWidth:480,sidebarCollapsed:true,detailsCollapsed:true};
 storage.values.set('project-document','UNCHANGED_SYNTHETIC_PROJECT');storage.values.set('diagramcloud.presentation-profile.v1:other','UNCHANGED_PROFILE');
 assert.equal(readStudioLayoutPreference(storage,'a','host').status,'missing');assert.equal(storage.writes(),0);
 assert.equal(writeStudioLayoutPreference(storage,'a','host',layout),true);const key=studioLayoutPreferenceKey('a','host');
 assert.deepEqual(JSON.parse(storage.values.get(key)!),{version:1,sidebarSide:'right',sidebarWidth:420,detailsWidth:480});
 assert.deepEqual(readStudioLayoutPreference(storage,'a','host'),{layout:{...layout,sidebarCollapsed:false,detailsCollapsed:false},status:'saved',hasStoredValue:true});
 assert.equal(readStudioLayoutPreference(storage,'b','host').status,'missing');assert.equal(readStudioLayoutPreference(storage,'a','other').status,'missing');
 assert.notEqual(studioLayoutPreferenceKey('c','a:b'),studioLayoutPreferenceKey('b:c','a'));assert.equal(storage.values.get('project-document'),'UNCHANGED_SYNTHETIC_PROJECT');assert.equal(storage.values.get('diagramcloud.presentation-profile.v1:other'),'UNCHANGED_PROFILE');
 const read=readStudioLayoutPreference(storage,'a','host');read.layout.sidebarSide='left';assert.equal(readStudioLayoutPreference(storage,'a','host').layout.sidebarSide,'right');assert.equal(storage.writes(),1);
});

test('malformed, oversized, future and secret-bearing layout preferences fall back without repairs or echoes',()=>{
 const storage=layoutMemory(),key=studioLayoutPreferenceKey('a','host'),valid={version:1,sidebarSide:'left',sidebarWidth:null,detailsWidth:null};
 for(const raw of ['{','null','[]','{}','x'.repeat(513),JSON.stringify({...valid,version:2}),JSON.stringify({...valid,sidebarCollapsed:true}),JSON.stringify({...valid,sidebarSide:'PRIVATE_LAYOUT_SECRET'}),JSON.stringify({...valid,sidebarWidth:'password=PRIVATE_LAYOUT_SECRET'}),JSON.stringify({...valid,sidebarWidth:219}),JSON.stringify({...valid,detailsWidth:481})]){
  storage.values.set(key,raw);const result=readStudioLayoutPreference(storage,'a','host');assert.deepEqual(result,{layout:defaultStudioLayout(),status:'corrupt',hasStoredValue:true});assert.equal(storage.values.get(key),raw);assert.ok(!JSON.stringify(result).includes('PRIVATE_LAYOUT_SECRET'));
 }
 assert.equal(storage.writes(),0);
});

test('blocked preference reads and quota writes preserve session and unrelated stored records',()=>{
 const blocked:StudioLayoutPreferenceStorage={getItem(){throw new Error('PRIVATE_STORAGE_EXCEPTION');},setItem(){throw new Error('PRIVATE_STORAGE_EXCEPTION');}};
 assert.deepEqual(readStudioLayoutPreference(blocked,'a','host'),{layout:defaultStudioLayout(),status:'unavailable',hasStoredValue:false});assert.equal(writeStudioLayoutPreference(blocked,'a','host',defaultStudioLayout()),false);assert.equal(readStudioLayoutPreference(null,'a','host').status,'unavailable');assert.equal(writeStudioLayoutPreference(null,'a','host',defaultStudioLayout()),false);
 const storage=layoutMemory();writeStudioLayoutPreference(storage,'a','host',defaultStudioLayout());const before=new Map(storage.values);const full={getItem:storage.getItem,setItem(){throw new DOMException('PRIVATE_QUOTA_EXCEPTION','QuotaExceededError');}};assert.equal(writeStudioLayoutPreference(full,'a','host',{...defaultStudioLayout(),sidebarSide:'right'}),false);assert.deepEqual(storage.values,before);
});

test('invalid layout writes are inert and explicit last-save wins never claims a Project generation',()=>{
 const storage=layoutMemory(),layout=defaultStudioLayout();for(const bad of [{...layout,sidebarWidth:NaN},{...layout,sidebarWidth:Infinity},{...layout,sidebarWidth:220.5},{...layout,source:'PRIVATE_LAYOUT_SECRET'}])assert.equal(writeStudioLayoutPreference(storage,'a','host',bad),false);assert.equal(storage.writes(),0);
 assert.deepEqual(studioLayoutPlacement(layout),{sidebarSide:'left',sidebarWidth:null,detailsWidth:null});
 assert.equal(writeStudioLayoutPreference(storage,'a','host',{...layout,sidebarSide:'right'}),true);assert.equal(writeStudioLayoutPreference(storage,'a','host',{...layout,sidebarWidth:240}),true);
 const raw=JSON.parse(storage.values.get(studioLayoutPreferenceKey('a','host'))!);assert.deepEqual(raw,{version:1,sidebarSide:'left',sidebarWidth:240,detailsWidth:null});assert.equal(storage.writes(),2);assert.ok(!('revision' in raw)&&!('writer' in raw)&&!('projectId' in raw));
});
