import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace} from '../src/core/storage';
/** Browser API protocol double only. Native IndexedDB and multi-tab gates remain separate. */
test('storage can retry after a synchronous open failure instead of caching rejection forever',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');let calls=0;
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){calls++;throw Object.assign(Error('blocked'),{name:'SecurityError'});}}});
 try{await assert.rejects(loadWorkspace(),/does not allow local storage/);await assert.rejects(loadWorkspace(),/does not allow local storage/);assert.equal(calls,2);}
 finally{if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');}
});

test('async error and blocked attempts can recover; late old success cannot replace the new connection',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 type Req={onsuccess:(()=>void)|null;onerror:(()=>void)|null;onblocked:(()=>void)|null;onupgradeneeded:(()=>void)|null;result:IDBDatabase;error:Error|null};
 const requests:Req[]=[],closed:number[]=[];
 const database=(id:number)=>({
  onversionchange:null,
  close(){closed.push(id);},
  transaction(){return {objectStore(){return {getAll(){const r={result:[],onsuccess:null as (()=>void)|null,onerror:null};queueMicrotask(()=>r.onsuccess?.());return r;}};}};}
 } as unknown as IDBDatabase);
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){const req={onsuccess:null,onerror:null,onblocked:null,onupgradeneeded:null,result:database(requests.length),error:null};requests.push(req);return req;}}});
 try{
  const failed=loadWorkspace();requests[0].error=Error('Read failed');requests[0].onerror?.();await assert.rejects(failed,/Read failed/);
  const blocked=loadWorkspace();requests[1].onblocked?.();await assert.rejects(blocked,/older DiagramCloud/);
  const pending=loadWorkspace();assert.equal(requests.length,3);
  requests[1].onsuccess?.();assert.deepEqual(closed,[1]); // Old late database is closed, never adopted.
  requests[0].onerror?.();requests[2].onsuccess?.();assert.deepEqual(await pending,{projects:[],warnings:[]});
  assert.deepEqual(await loadWorkspace(),{projects:[],warnings:[]});assert.equal(requests.length,3,'Successful new database stays cached');
  requests[2].result.onversionchange?.({} as IDBVersionChangeEvent);
  const reopened=loadWorkspace();assert.equal(requests.length,4);requests[3].onsuccess?.();await reopened;
  requests[3].result.onversionchange?.({} as IDBVersionChangeEvent);
 }finally{if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');}
});
