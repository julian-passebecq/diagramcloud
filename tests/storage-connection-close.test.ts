import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace} from '../src/core/storage';

/** Controlled IndexedDB close-event protocol, not native browser persistence. */
function connections(){
 const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 const databases:Array<{db:IDBDatabase;forceClose:()=>void}>=[];
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){
  let closed=false;
  const db={onversionchange:null,onclose:null,close(){closed=true;},transaction(){
   if(closed)throw new DOMException('The connection is closed','InvalidStateError');
   return {objectStore(){return {getAll(){const request={result:[],onsuccess:null as (()=>void)|null,onerror:null};queueMicrotask(()=>request.onsuccess?.());return request;}};}};
  }} as unknown as IDBDatabase;
  databases.push({db,forceClose(){closed=true;db.onclose?.call(db,new Event('close'));}});
  const request={result:db,onsuccess:null as (()=>void)|null,onerror:null,onblocked:null,onupgradeneeded:null};
  queueMicrotask(()=>request.onsuccess?.());return request;
 }}});
 return {databases,restore(){for(const {db} of databases)db.onversionchange?.call(db,{} as IDBVersionChangeEvent);if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');}};
}

test('a forced close invalidates the cached connection so the next load can reopen',async()=>{
 const store=connections();
 try{
  assert.deepEqual(await loadWorkspace(),{projects:[],warnings:[]});
  store.databases[0].forceClose();
  assert.deepEqual(await loadWorkspace(),{projects:[],warnings:[]});
  assert.equal(store.databases.length,2);
 }finally{store.restore();}
});

test('a delayed close event from an old connection does not invalidate its replacement',async()=>{
 const store=connections();
 try{
  await loadWorkspace();const first=store.databases[0];first.forceClose();
  await loadWorkspace();first.forceClose();
  await loadWorkspace();assert.equal(store.databases.length,2);
 }finally{store.restore();}
});
