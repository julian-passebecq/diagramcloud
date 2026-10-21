import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,parseDocument,MAX_DOCUMENT_BYTES,type Project} from '../src/core/model';
import {saveProject,loadWorkspace} from '../src/core/storage';
import {readSidecar,writeSidecar,serializeSidecar,sidecarNotes,contentHash,sidecarReceipt,SidecarConflictError,SidecarUncertainWriteError,type SidecarFolder,type SidecarLink} from '../src/bridge/sidecar';

const document=(id:string)=>validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic persistence boundary',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:[],sources:[]}));
function largeDocument(id:string):Project{
 return validateDocument({...document(id),blocks:Array.from({length:84},(_,i)=>({id:`note-${i}`,type:'text',title:'Synthetic large evidence',text:'界'.repeat(50000),provenance:'synthetic',visibility:'private',sourceIds:[]}))});
}
function gate(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}
/** Controlled IndexedDB protocol double; native persistence is covered separately. */
function memoryStorage(){
 const rows=new Map<string,{id:string;json:string;writer:string;savedAt:number}>();
 const request=(value:()=>unknown)=>{const r={result:undefined as unknown,onsuccess:null as null|(()=>void),onerror:null};queueMicrotask(()=>{r.result=structuredClone(value());r.onsuccess?.();});return r;};
 const db={objectStoreNames:{contains:()=>true},close(){},onclose:null,onversionchange:null as null|(()=>void),transaction(){
  const tx={error:null,oncomplete:null as null|(()=>void),onabort:null as null|(()=>void),onerror:null,abort(){queueMicrotask(()=>tx.onabort?.());},objectStore:()=>({
   get:(id:string)=>request(()=>rows.get(id)),getAll:()=>request(()=>[...rows.values()]),
   put:(row:{id:string;json:string;writer:string;savedAt:number})=>{rows.set(row.id,structuredClone(row));queueMicrotask(()=>tx.oncomplete?.());}
  })};return tx;
 }};
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open:()=>{const r={result:db,onsuccess:null as null|(()=>void)};queueMicrotask(()=>r.onsuccess?.());return r;}}});
 return {rows,close:()=>db.onversionchange?.()};
}

test('a structurally valid UTF-8 oversized draft cannot replace a reopenable stored project',async()=>{
 const storage=memoryStorage(),small=document('size-local'),large=largeDocument(small.id);
 const encoded=JSON.stringify(large);assert.ok(encoded.length<MAX_DOCUMENT_BYTES);assert.ok(new TextEncoder().encode(encoded).byteLength>MAX_DOCUMENT_BYTES);assert.throws(()=>parseDocument(encoded),/12 MiB/);
 try{await saveProject(small);const original=structuredClone(storage.rows.get(small.id));await assert.rejects(saveProject(large),/12 MiB/);assert.deepEqual(storage.rows.get(small.id),original);const loaded=await loadWorkspace();assert.equal(loaded.warnings.length,0);assert.equal(loaded.projects[0]?.id,small.id);}
 finally{storage.close();}
});

test('local persistence captures the requested snapshot before its first await',async()=>{
 const storage=memoryStorage(),doc=document('snapshot-local'),title=doc.title;
 try{const saving=saveProject(doc);doc.title='Changed after requesting save';await saving;assert.equal(JSON.parse(storage.rows.get(doc.id)!.json).title,title);}
 finally{storage.close();}
});

/** A file-handle protocol fixture, not an installed browser File System Access proof. */
function folder(initial:string|undefined){
 const state={text:initial,reads:0,opened:0,created:0,failRead:false,failClose:false,size:undefined as number|undefined,holdFirst:false,started:gate(),release:gate()};
 const missing=()=>Object.assign(new Error('Missing'),{name:'NotFoundError'});
 const root:SidecarFolder={name:'synthetic-repository',getDirectoryHandle:async(_name,options)=>{if(state.text===undefined&&!options?.create)throw missing();return root;},getFileHandle:async(_name,options)=>{
  if(state.text===undefined){if(!options?.create)throw missing();state.created++;state.text='';}
  return {getFile:async()=>{const snapshot=state.text??'';return {size:state.size??new TextEncoder().encode(snapshot).byteLength,text:async()=>{state.reads++;if(state.failRead)throw new Error('Synthetic read failure');return snapshot;}};},
   createWritable:async()=>{const index=++state.opened;let buffer='';return {write:async(text:string)=>{if(state.holdFirst&&index===1){state.started.resolve();await state.release.promise;}buffer=text;},close:async()=>{if(state.failClose)throw new Error('Synthetic close failure');state.text=buffer;}};}};
 }};
 return {root,state};
}
async function linkFor(root:SidecarFolder,doc:Project):Promise<SidecarLink>{const read=await readSidecar(root);return {folder:root,projectId:doc.id,baseRevision:read.status==='found'?doc.revision:null,baseHash:read.status==='found'?read.hash:null};}

test('sidecar serialization refuses UTF-8 output that its own importer cannot reopen',()=>{
 assert.throws(()=>serializeSidecar(largeDocument('size-sidecar')),/12 MiB/);
});

test('oversized repository output is refused before creating a new sidecar',async()=>{
 const doc=largeDocument('size-new-sidecar'),f=folder(undefined),link=await linkFor(f.root,doc);
 await assert.rejects(writeSidecar(link,doc),/12 MiB/);assert.equal(f.state.created,0);assert.equal(f.state.opened,0);assert.equal(f.state.text,undefined);
});

test('sidecar admission checks the file size before allocating its text',async()=>{
 const f=folder('{}');f.state.size=MAX_DOCUMENT_BYTES+1;
 await assert.rejects(readSidecar(f.root),/12 MiB/);assert.equal(f.state.reads,0);
});

test('sidecar admission also checks actual UTF-8 bytes when metadata underreports',async()=>{
 const f=folder('界'.repeat(Math.ceil(MAX_DOCUMENT_BYTES/3)+1));f.state.size=1;
 await assert.rejects(readSidecar(f.root),/12 MiB/);assert.equal(f.state.opened,0);
});

test('a failed review read retains the uncertain-write receipt',async()=>{
 const doc=document('receipt-preserved'),f=folder(serializeSidecar(doc)),link=await linkFor(f.root,doc);f.state.failClose=true;
 await assert.rejects(writeSidecar(link,{...doc,revision:1}),SidecarUncertainWriteError);const receipt=sidecarReceipt(f.root);assert.ok(receipt);
 f.state.failRead=true;await assert.rejects(readSidecar(f.root),/Synthetic read failure/);assert.equal(sidecarReceipt(f.root),receipt);
 f.state.failRead=false;await readSidecar(f.root);assert.equal(sidecarReceipt(f.root),undefined);
});

test('same-handle concurrent saves serialize and refuse the stale second base',async()=>{
 const doc=document('serialized-sidecar'),f=folder(serializeSidecar(doc)),link=await linkFor(f.root,doc);f.state.holdFirst=true;
 const first=writeSidecar(link,{...doc,revision:1,title:'First requested snapshot'});await f.state.started.promise;
 const second=writeSidecar(link,{...doc,revision:2,title:'Second stale snapshot'}),settled=Promise.allSettled([first,second]);
 await new Promise<void>(r=>setImmediate(r));f.state.release.resolve();const results=await settled;
 assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');if(results[1].status==='rejected')assert.ok(results[1].reason instanceof SidecarConflictError);
 assert.equal(f.state.opened,1);assert.equal(parseDocument(f.state.text!).title,'First requested snapshot');
});

test('a held save in one repository does not serialize an unrelated handle',async()=>{
 const a=document('independent-a'),b=document('independent-b'),fa=folder(serializeSidecar(a)),fb=folder(serializeSidecar(b));fa.state.holdFirst=true;
 const first=writeSidecar(await linkFor(fa.root,a),{...a,revision:1});await fa.state.started.promise;
 try{const saved=await writeSidecar(await linkFor(fb.root,b),{...b,revision:1});assert.equal(saved.baseRevision,1);assert.equal(parseDocument(fb.state.text!).revision,1);}
 finally{fa.state.release.resolve();await first;}
});

test('repository persistence captures the requested snapshot before permission resolves',async()=>{
 const doc=document('snapshot-repository'),f=folder(serializeSidecar(doc)),link=await linkFor(f.root,doc),permission=gate(),started=gate();
 f.root.requestPermission=async()=>{started.resolve();await permission.promise;return 'granted';};
 const saving=writeSidecar(link,doc);await started.promise;doc.title='Changed while permission was pending';permission.resolve();await saving;
 assert.equal(parseDocument(f.state.text!).title,'Synthetic persistence boundary');
});

test('a rejected write does not poison the same repository queue',async()=>{
 const doc=document('queue-after-failure'),f=folder(serializeSidecar(doc)),link=await linkFor(f.root,doc);f.root.requestPermission=async()=> 'denied';
 await assert.rejects(writeSidecar(link,doc),/not granted/);f.root.requestPermission=async()=> 'granted';
 const saved=await writeSidecar(link,{...doc,revision:1});assert.equal(saved.baseHash,await contentHash(f.state.text!));assert.equal(saved.baseRevision,1);
});

test('oversized review notes remain renderable instead of throwing from the bridge UI',()=>{
 assert.match(sidecarNotes(largeDocument('size-review')).join(' '),/12 MiB/);
});

test('an oversized existing sidecar is refused before opening a writable stream',async()=>{
 const doc=document('size-existing'),f=folder(serializeSidecar(doc)),link=await linkFor(f.root,doc);f.state.size=MAX_DOCUMENT_BYTES+1;const before=f.state.reads;
 await assert.rejects(writeSidecar(link,doc),/12 MiB/);assert.equal(f.state.reads,before);assert.equal(f.state.opened,0);
});

test('a review already in flight cannot clear a newer uncertain-write receipt',async()=>{
 const doc=document('receipt-race'),f=folder(serializeSidecar(doc)),link=await linkFor(f.root,doc),started=gate(),release=gate();
 const get=f.root.getFileHandle.bind(f.root);let hold=true;
 f.root.getFileHandle=async(...args)=>{const handle=await get(...args);return {...handle,getFile:async()=>{const file=await handle.getFile();return {...file,text:async()=>{if(hold){hold=false;started.resolve();await release.promise;}return file.text();}};}};};
 const reviewing=readSidecar(f.root);await started.promise;f.state.failClose=true;
 await assert.rejects(writeSidecar(link,{...doc,revision:1}),SidecarUncertainWriteError);const receipt=sidecarReceipt(f.root);assert.ok(receipt);
 release.resolve();await reviewing;assert.equal(sidecarReceipt(f.root),receipt);
});

test('a deleted linked sidecar is not recreated as an empty file by a rejected save',async()=>{
 const doc=document('sidecar-deleted'),f=folder(serializeSidecar(doc)),link=await linkFor(f.root,doc);f.state.text=undefined;
 await assert.rejects(writeSidecar(link,{...doc,revision:1}),SidecarConflictError);
 assert.equal(f.state.created,0);assert.equal(f.state.opened,0);assert.equal(f.state.text,undefined);
});
