import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace,saveProject,deleteRow,adoptRow,readRawRow} from '../src/core/storage';
import {documentSchema,validateDocument} from '../src/core/model';

/** Controlled IndexedDB request/transaction double, not a browser storage test.
 * Real IndexedDB/save/reload cases remain in tests/e2e/storage-*.spec.ts. */
function eventStore(){
 const rows=new Map<string,unknown>();let current:IDBDatabase|null=null,opens=0,failOpen=false;
 const db={objectStoreNames:{contains:()=>true},close:()=>{},onversionchange:null,transaction:()=>{
  const tx:{oncomplete:(()=>void)|null;onabort:(()=>void)|null;onerror:(()=>void)|null;error:null;aborted:boolean;abort:()=>void;objectStore:()=>unknown}={oncomplete:null,onabort:null,onerror:null,error:null,aborted:false,abort(){this.aborted=true;queueMicrotask(()=>this.onabort?.());},objectStore:()=>({
   get:(id:string)=>request(()=>rows.get(id)),getAll:()=>request(()=>[...rows.values()]),
   put:(row:{id:string})=>{rows.set(row.id,structuredClone(row));queueMicrotask(()=>{if(!tx.aborted)tx.oncomplete?.();});},
   delete:(id:string)=>{rows.delete(id);queueMicrotask(()=>{if(!tx.aborted)tx.oncomplete?.();});}
  })};
  return tx as unknown as IDBTransaction;
 }} as unknown as IDBDatabase;
 function request(value:()=>unknown){const r={result:undefined,onsuccess:null,onerror:null};queueMicrotask(()=>{r.result=value() as undefined;(r.onsuccess as (()=>void)|null)?.();});return r;}
 return {rows,db,get opens(){return opens;},set failOpen(value:boolean){failOpen=value;},install(){Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){opens++;if(failOpen)throw new DOMException('blocked','SecurityError');const r={result:db,error:null,onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};queueMicrotask(()=>{current=db;(r.onsuccess as (()=>void)|null)?.();});return r;}}});},close(){(current?.onversionchange as (()=>void)|null)?.();current=null;}};
}
const document=(id:string)=>validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic '+id,rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:[],sources:[]}));

test('storage connection retries after a synchronous open failure',async()=>{
 const s=eventStore();s.install();s.failOpen=true;
 try{await assert.rejects(loadWorkspace(),/does not allow local storage/);s.failOpen=false;assert.equal((await loadWorkspace()).projects.length,0);assert.equal(s.opens,2);}
 finally{s.close();}
});
test('a failed open is shared for simultaneous callers but does not poison later calls',async()=>{
 const s=eventStore();s.install();s.failOpen=true;
 try{const results=await Promise.allSettled([loadWorkspace(),loadWorkspace()]);assert.ok(results.every(r=>r.status==='rejected'));s.failOpen=false;await loadWorkspace();assert.equal(s.opens,2);}
 finally{s.close();}
});
test('deletion by another tab is a conflict, not permission to resurrect a document',async()=>{
 const s=eventStore();s.install();const d=document('storage-deleted');s.rows.set(d.id,{id:d.id,json:JSON.stringify(d),writer:'other',savedAt:1});
 try{await loadWorkspace();s.rows.delete(d.id);await assert.rejects(saveProject(d),/Another tab removed/);assert.equal(s.rows.has(d.id),false);}
 finally{s.close();}
});
test('same-tab explicit deletion clears the generation and permits deliberate recreation',async()=>{
 const s=eventStore();s.install();const d=document('storage-recreated');s.rows.set(d.id,{id:d.id,json:JSON.stringify(d),writer:'other',savedAt:1});
 try{await loadWorkspace();await deleteRow(d.id);await saveProject(d);assert.equal(s.rows.has(d.id),true);}
 finally{s.close();}
});
test('an unadopted malformed row cannot be overwritten just because both generations are missing',async()=>{
 const s=eventStore();s.install();const d=document('storage-unadopted');const bad={id:d.id,json:'broken',writer:'other'};s.rows.set(d.id,bad);
 try{const result=await loadWorkspace();assert.equal(result.warnings.length,1);await assert.rejects(saveProject(d),/Another tab changed/);assert.deepEqual(s.rows.get(d.id),bad);}
 finally{s.close();}
});
test('explicit adoption permits repair of a malformed row without weakening later conflicts',async()=>{
 const s=eventStore();s.install();const d=document('storage-adopted');s.rows.set(d.id,{id:d.id,json:'broken',writer:'other'});
 try{await loadWorkspace();await adoptRow(d.id);await saveProject(d);assert.equal(JSON.parse((s.rows.get(d.id) as {json:string}).json).id,d.id);s.rows.set(d.id,{id:d.id,json:JSON.stringify(d),writer:'second-tab',savedAt:Date.now()+100});await assert.rejects(saveProject(d),/Another tab changed/);}
 finally{s.close();}
});
test('ordinary same-tab saves keep working with a monotonically later generation',async()=>{
 const s=eventStore();s.install();const d=document('storage-ordinary');
 try{await loadWorkspace();await saveProject(d);const first=(s.rows.get(d.id) as {savedAt:number}).savedAt;await saveProject({...d,revision:d.revision+1});assert.ok((s.rows.get(d.id) as {savedAt:number}).savedAt>first);}
 finally{s.close();}
});

for(const [label,savedAt] of [
 ['not-a-number',Number.NaN],['positive-infinity',Number.POSITIVE_INFINITY],
 ['negative-infinity',Number.NEGATIVE_INFINITY],['text','corrupt'],
 ['unsafe-number',Number.MAX_VALUE]
] as const)test(`repair of ${label} generation survives reopen and advances on later saves`,async()=>{
 const s=eventStore();s.install();const d=document(`repair-${label}`);
 s.rows.set(d.id,{id:d.id,json:'broken',writer:'other',savedAt});
 try{
  assert.equal((await loadWorkspace()).warnings.length,1);
  await adoptRow(d.id);await saveProject(d);
  const first=(s.rows.get(d.id) as {savedAt:number}).savedAt;
  assert.ok(Number.isSafeInteger(first),'Repaired save must have a safe finite generation');
  const loaded=await loadWorkspace();assert.equal(loaded.warnings.length,0);assert.equal(loaded.projects[0]?.id,d.id);
  await saveProject({...d,revision:d.revision+1});
  assert.ok((s.rows.get(d.id) as {savedAt:number}).savedAt>first,'Every next save must advance the generation');
 }finally{s.close();}
});


test('repair adoption refuses a row replaced after it was shown for recovery',async()=>{
 const s=eventStore();s.install();const d=document('recovery-race');
 const bad={id:d.id,json:'broken',writer:'first-tab',savedAt:1};s.rows.set(d.id,bad);
 try{
  await loadWorkspace();await readRawRow(d.id);
  const replacement={id:d.id,json:JSON.stringify({...d,title:'Newer recovered copy'}),writer:'second-tab',savedAt:2};s.rows.set(d.id,replacement);
  await assert.rejects(adoptRow(d.id),/changed|reload/i);
  assert.deepEqual(s.rows.get(d.id),replacement);
 }finally{s.close();}
});

test('repair adoption refuses a row removed after it was shown for recovery',async()=>{
 const s=eventStore();s.install();const d=document('recovery-removed');s.rows.set(d.id,{id:d.id,json:'broken',writer:'other',savedAt:1});
 try{await loadWorkspace();await readRawRow(d.id);s.rows.delete(d.id);await assert.rejects(adoptRow(d.id),/removed|reload/i);assert.equal(s.rows.has(d.id),false);}
 finally{s.close();}
});

test('a changed corrupt row cannot be adopted just because its generation is unchanged',async()=>{
 const s=eventStore();s.install();const d=document('recovery-same-generation');s.rows.set(d.id,{id:d.id,json:'broken one',writer:'other',savedAt:1});
 try{await loadWorkspace();const replacement={id:d.id,json:'broken two',writer:'other',savedAt:1};s.rows.set(d.id,replacement);await assert.rejects(adoptRow(d.id),/changed|reload/i);assert.deepEqual(s.rows.get(d.id),replacement);}
 finally{s.close();}
});

test('changing the writer or bytes at an adopted NaN generation remains a conflict',async()=>{
 const s=eventStore();s.install();const d=document('recovery-nan-conflict');s.rows.set(d.id,{id:d.id,json:'broken one',writer:'first',savedAt:NaN});
 try{await loadWorkspace();await adoptRow(d.id);const replacement={id:d.id,json:'broken two',writer:'second',savedAt:NaN};s.rows.set(d.id,replacement);await assert.rejects(saveProject(d),/Another tab changed/);assert.deepEqual(s.rows.get(d.id),replacement);}
 finally{s.close();}
});

test('repeated finite generation with changed content does not authorize a stale save',async()=>{
 const s=eventStore();s.install();const d=document('storage-same-generation');s.rows.set(d.id,{id:d.id,json:JSON.stringify(d),writer:'other',savedAt:1});
 try{await loadWorkspace();const replacement={id:d.id,json:JSON.stringify({...d,title:'Newer copy'}),writer:'other',savedAt:1};s.rows.set(d.id,replacement);await assert.rejects(saveProject(d),/Another tab changed/);assert.deepEqual(s.rows.get(d.id),replacement);}
 finally{s.close();}
});

test('a stale recovery deletion refuses a replacement even when its timestamp is reused',async()=>{
 const s=eventStore();s.install();const d=document('delete-replaced');s.rows.set(d.id,{id:d.id,json:'broken',writer:'other',savedAt:1});
 try{await loadWorkspace();const replacement={id:d.id,json:JSON.stringify(d),writer:'other',savedAt:1};s.rows.set(d.id,replacement);await assert.rejects(deleteRow(d.id),/changed|reload/i);assert.deepEqual(s.rows.get(d.id),replacement);}
 finally{s.close();}
});

test('a stale deletion of an already removed row keeps the external-deletion guard',async()=>{
 const s=eventStore();s.install();const d=document('delete-disappeared');s.rows.set(d.id,{id:d.id,json:JSON.stringify(d),writer:'other',savedAt:1});
 try{await loadWorkspace();s.rows.delete(d.id);await assert.rejects(deleteRow(d.id),/removed|reload/i);await assert.rejects(saveProject(d),/Another tab removed/);assert.equal(s.rows.has(d.id),false);}
 finally{s.close();}
});

test('deletion cannot authorize removing a project this tab never observed',async()=>{
 const s=eventStore();s.install();const d=document('delete-unobserved'),row={id:d.id,json:JSON.stringify(d),writer:'other',savedAt:1};s.rows.set(d.id,row);
 try{await assert.rejects(deleteRow(d.id),/changed|reload/i);assert.deepEqual(s.rows.get(d.id),row);}
 finally{s.close();}
});

test('an unchanged quarantined NaN generation can still be explicitly deleted',async()=>{
 const s=eventStore();s.install();const d=document('delete-nan');s.rows.set(d.id,{id:d.id,json:'broken',writer:'other',savedAt:NaN});
 try{await loadWorkspace();await deleteRow(d.id);assert.equal(s.rows.has(d.id),false);await saveProject(d);assert.equal((await loadWorkspace()).projects[0]?.id,d.id);}
 finally{s.close();}
});

test('a restored row reusing this tab writer cannot overwrite a changed copy',async()=>{
 const s=eventStore();s.install();const d=document('same-writer-content');
 try{await saveProject(d);const replacement={...(s.rows.get(d.id) as object),json:JSON.stringify({...d,title:'Newer restored synthetic copy'})};s.rows.set(d.id,replacement);await assert.rejects(saveProject({...d,revision:d.revision+1}),/Another tab changed/);assert.deepEqual(s.rows.get(d.id),replacement);}
 finally{s.close();}
});

test('a restored row reusing this tab writer cannot bypass generation conflicts',async()=>{
 const s=eventStore();s.install();const d=document('same-writer-generation');
 try{await saveProject(d);const row=s.rows.get(d.id) as {savedAt:number},replacement={...row,savedAt:row.savedAt+1};s.rows.set(d.id,replacement);await assert.rejects(saveProject(d),/Another tab changed/);assert.deepEqual(s.rows.get(d.id),replacement);}
 finally{s.close();}
});
