import test from 'node:test';
import assert from 'node:assert/strict';
import {LINKED_LAYOUT_PREFERENCE_VERSION,defaultLinkedLayout,linkedLayoutPreferenceKey,readLinkedLayoutPreference,studioLayoutPreferenceKey,validateLinkedLayout,writeLinkedLayoutPreference,writeStudioLayoutPreference,readStudioLayoutPreference,defaultStudioLayout,type StudioLayoutPreferenceStorage} from '../src/core/studioLayout';

function memory(){const data=new Map<string,string>();const s:StudioLayoutPreferenceStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}};return {s,data};}
const throwing:StudioLayoutPreferenceStorage={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};

test('the linked layout has its own versioned key per project and host',()=>{
 assert.equal(LINKED_LAYOUT_PREFERENCE_VERSION,1);
 assert.equal(linkedLayoutPreferenceKey('p','h'),'diagramcloud.linked-layout.v1:'+encodeURIComponent(JSON.stringify(['h','p'])));
 assert.notEqual(linkedLayoutPreferenceKey('p','h'),studioLayoutPreferenceKey('p','h'));
});
test('only detail placement and a 30-70 split are stored; save then load round-trips',()=>{
 const {s,data}=memory();
 assert.equal(writeLinkedLayoutPreference(s,'p','h',{detailPlacement:'below-right',splitPercent:60}),true);
 assert.deepEqual(JSON.parse(data.get(linkedLayoutPreferenceKey('p','h'))!),{version:1,detailPlacement:'below-right',splitPercent:60});
 assert.deepEqual(readLinkedLayoutPreference(s,'p','h'),{layout:{detailPlacement:'below-right',splitPercent:60},status:'saved',hasStoredValue:true});
 for(const bad of [{detailPlacement:'free',splitPercent:50},{detailPlacement:'below-both',splitPercent:29},{detailPlacement:'below-both',splitPercent:71},{detailPlacement:'below-both',splitPercent:50.5},{detailPlacement:'below-both',splitPercent:50,leftViewId:'x'}])assert.equal(writeLinkedLayoutPreference(s,'p','h',bad),false);
 assert.throws(()=>validateLinkedLayout(null));assert.deepEqual(validateLinkedLayout(defaultLinkedLayout()),{detailPlacement:'below-both',splitPercent:50});
});
test('reading is read-only: a corrupt record is left untouched and defaults are shown',()=>{
 const {s,data}=memory(),key=linkedLayoutPreferenceKey('p','h');
 for(const raw of ['{','[]','{"version":2,"detailPlacement":"below-right","splitPercent":50}','{"version":1,"detailPlacement":"below-right","splitPercent":90}','{"version":1,"detailPlacement":"below-right"}']){
  data.set(key,raw);const out=readLinkedLayoutPreference(s,'p','h');assert.equal(out.status,'corrupt');assert.deepEqual(out.layout,defaultLinkedLayout());assert.equal(data.get(key),raw);
 }
 assert.equal(readLinkedLayoutPreference(memory().s,'p','h').status,'missing');
 assert.equal(readLinkedLayoutPreference(null,'p','h').status,'unavailable');assert.equal(readLinkedLayoutPreference(throwing,'p','h').status,'unavailable');
 assert.equal(writeLinkedLayoutPreference(throwing,'p','h',defaultLinkedLayout()),false);
});
test('the studio v1 record is unchanged by a linked layout write',()=>{
 const {s,data}=memory();
 assert.equal(writeStudioLayoutPreference(s,'p','h',{...defaultStudioLayout(),sidebarWidth:300}),true);
 const studioRaw=data.get(studioLayoutPreferenceKey('p','h'));
 assert.equal(studioRaw,'{"version":1,"sidebarSide":"left","sidebarWidth":300,"detailsWidth":null}');
 writeLinkedLayoutPreference(s,'p','h',{detailPlacement:'below-right',splitPercent:40});
 assert.equal(data.get(studioLayoutPreferenceKey('p','h')),studioRaw);assert.equal(readStudioLayoutPreference(s,'p','h').status,'saved');
});
