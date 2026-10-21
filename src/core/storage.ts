import {canonical} from './learningMapping';
import {errorMessage,parseDocument,type Project} from './model';
const TAB_ID=crypto.randomUUID();let connection:Promise<IDBDatabase>|undefined;
// Keep the observed bytes and writer as well as the generation: corrupt or
// externally restored rows may reuse a timestamp. Recovery must not rebind.
type RowBasis={json:unknown;writer:unknown;savedAt:unknown};
const known=new Map<string,RowBasis>(),quarantined=new Map<string,RowBasis>();
const rowBasis=(row:Partial<Row>):RowBasis=>({json:row.json,writer:row.writer,savedAt:row.savedAt});
const sameBasis=(a:RowBasis,b:RowBasis|undefined)=>!!b&&Object.is(a.savedAt,b.savedAt)&&a.writer===b.writer&&a.json===b.json;

type Row={id:string;json:string;writer:string;savedAt:number};
/** A stored row that could not be loaded. It stays untouched in IndexedDB until the user recovers or deletes it. */
export type WorkspaceWarning={id:string;message:string;savedAt?:number;bytes:number;hasJsonText:boolean};
export type WorkspaceLoad={projects:Project[];warnings:WorkspaceWarning[]};

/** Plain-language reason for a storage failure; quota errors say what to do. */
export function storageErrorMessage(error:unknown):string{
 const name=(error as {name?:unknown}|null)?.name;
 if(name==='QuotaExceededError')return 'Browser storage is full. Download a backup, then free space or remove unused projects.';
 if(name==='SecurityError'||name==='InvalidStateError')return 'This browser does not allow local storage here (private window or blocked site data). Download a backup to keep your work.';
 return errorMessage(error);
}

function open():Promise<IDBDatabase>{
 if(!connection){
  // Assign the attempt before clearing a rejected one. Clearing from inside a
  // synchronous Promise executor would be overwritten by the assignment itself.
  const attempt=new Promise<IDBDatabase>((resolve,reject)=>{
   let r:IDBOpenDBRequest;try{r=indexedDB.open('diagramcloud-v1',1);}catch(error){reject(new Error(storageErrorMessage(error)));return;}let blocked=false;
   r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('projects'))r.result.createObjectStore('projects',{keyPath:'id'});};
   r.onsuccess=()=>{if(blocked){r.result.close();return;}const db=r.result,forget=()=>{if(connection===attempt)connection=undefined;};db.onclose=forget;db.onversionchange=()=>{db.close();forget();};resolve(db);};
   r.onerror=()=>reject(r.error?new Error(storageErrorMessage(r.error)):new Error('Could not open local workspace'));
   r.onblocked=()=>{blocked=true;reject(new Error('Close older DiagramCloud tabs to open storage'));};
  });
  connection=attempt;
  // A late failure from an older request must not clear a newer connection.
  void attempt.catch(()=>{if(connection===attempt)connection=undefined;});
 }
 return connection;
}

/** Resolve only whether startup drafts can be queued, never merge their contents.
 * Revision equality is NOT document equality. Conflicting stored copies must stay
 * untouched until the user backs up and reopens/reviews them.
 */
export function planWorkspaceDraftSaves(saved:readonly Project[],drafts:readonly Project[]):{pending:Project[];conflicts:string[]}{
 const prior=new Map(saved.map(doc=>[doc.id,doc])),pending:Project[]=[],conflicts:string[]=[];
 for(const doc of drafts){const stored=prior.get(doc.id);if(!stored)pending.push(doc);else if(canonical(stored)!==canonical(doc))conflicts.push(doc.id);}
 return {pending,conflicts};
}

/** Load every healthy row independently. Corrupt rows remain untouched for recovery instead of disabling the whole workspace. */
export async function loadWorkspace():Promise<WorkspaceLoad>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readonly'),r=tx.objectStore('projects').getAll();
  r.onerror=()=>reject(r.error??new Error('Could not read local workspace'));
  r.onsuccess=()=>{
   const projects:Project[]=[],warnings:WorkspaceWarning[]=[];
   for(const raw of r.result as unknown[]){
    const row=raw as Partial<Row>,rowId=typeof row.id==='string'?row.id:'unknown-row';
    try{
     if(typeof row.json!=='string'||typeof row.savedAt!=='number'||!Number.isFinite(row.savedAt)||typeof row.writer!=='string')throw new Error('Invalid local storage record');
     const project=parseDocument(row.json);
     if(project.id!==rowId)throw new Error(`Stored key ${rowId} does not match document ID ${project.id}`);
     known.set(project.id,rowBasis(row));quarantined.delete(project.id);projects.push(project);
    }catch(error){let bytes=0;try{bytes=typeof row.json==='string'?row.json.length:JSON.stringify(raw)?.length??0;}catch{/* unserializable envelope */}
     quarantined.set(rowId,rowBasis(row));
     warnings.push({id:rowId,message:errorMessage(error),...(typeof row.savedAt==='number'&&Number.isFinite(row.savedAt)?{savedAt:row.savedAt}:{}),bytes,hasJsonText:typeof row.json==='string'});}
   }
   resolve({projects,warnings});
  };
 });
}
export async function loadProjects():Promise<Project[]>{return (await loadWorkspace()).projects;}

/** Compare generation inside a single transaction; conflicting tabs never silently overwrite. */
export async function saveProject(doc:Project):Promise<void>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');let problem:Error|null=null;let timestamp=0,json='';
  const r=store.get(doc.id);
  r.onsuccess=()=>{const previous=r.result as Row|undefined;if(previous&&!sameBasis(rowBasis(previous),known.get(doc.id))){problem=new Error('Another tab changed this project. Export your JSON, then reload before editing.');tx.abort();return;}
   // A disappeared, previously loaded row is an external deletion. Only the
   // explicit same-tab delete/adopt flow may establish a fresh creation basis.
   if(!previous&&known.has(doc.id)){problem=new Error('Another tab removed this project. Export your JSON, then reload before restoring it.');tx.abort();return;}
   // Explicitly adopted malformed timestamps must not survive as NaN/Infinity,
   // or stop advancing through numeric overflow. Normal generations still advance.
   const prior=previous?.savedAt;timestamp=Math.max(Date.now(),typeof prior==='number'&&Number.isSafeInteger(prior)&&prior>=0&&prior<Number.MAX_SAFE_INTEGER?prior+1:0);
   // A throwing put (quota, serialization) would abort with no reason; keep the real one.
   try{json=JSON.stringify(doc);store.put({id:doc.id,json,writer:TAB_ID,savedAt:timestamp} satisfies Row);}catch(error){problem=new Error(storageErrorMessage(error));tx.abort();}};
  tx.oncomplete=()=>{known.set(doc.id,{json,writer:TAB_ID,savedAt:timestamp});quarantined.delete(doc.id);resolve();};
  tx.onabort=tx.onerror=()=>reject(problem??(tx.error?new Error(storageErrorMessage(tx.error)):new Error('Local save failed. Export a JSON backup.')));
 });
}

/** The stored row exactly as it is, for a raw backup of a row that could not be loaded. */
export async function readRawRow(id:string):Promise<unknown>{
 const db=await open();
 return new Promise((resolve,reject)=>{const r=db.transaction('projects','readonly').objectStore('projects').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error??new Error('Could not read the stored row'));});
}
/** Delete only the exact observed row, after explicit confirmation in the UI.
 * The comparison and deletion share one transaction: another tab cannot replace
 * the row between the guard and the delete. A stale warning grants no authority.
 */
export async function deleteRow(id:string):Promise<void>{
 const expected=quarantined.get(id)??known.get(id),db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');let problem:Error|null=null;
  const r=store.get(id);
  r.onsuccess=()=>{
   const row=r.result as Partial<Row>|undefined;
   if(!row){problem=new Error('The stored project was removed. Keep your backup, then reload before restoring it.');tx.abort();return;}
   if(!sameBasis(rowBasis(row),expected)){problem=new Error('The stored project changed. Keep your backup, then reload and review the current copy.');tx.abort();return;}
   try{store.delete(id);}catch(error){problem=new Error(storageErrorMessage(error));tx.abort();}
  };
  tx.oncomplete=()=>{known.delete(id);quarantined.delete(id);resolve();};
  tx.onabort=tx.onerror=()=>reject(problem??(tx.error?new Error(storageErrorMessage(tx.error)):new Error('Could not delete the stored row')));
 });
}
/**
 * Adopt only the exact quarantined row seen by loadWorkspace. Re-reading a newer
 * row must not authorize the older JSON already displayed by the repair editor.
 * A change after this read is still detected in saveProject's write transaction.
 */
export async function adoptRow(id:string):Promise<void>{
 const expected=quarantined.get(id),row=await readRawRow(id) as Partial<Row>|undefined;
 if(!row)throw new Error('The stored recovery row was removed. Keep your backup, then reload before restoring it.');
 if(!sameBasis(rowBasis(row),expected))throw new Error('The stored recovery row changed. Keep your backup, then reload and review the current copy.');
 known.set(id,rowBasis(row));
}
