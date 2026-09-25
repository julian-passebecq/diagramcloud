import {errorMessage,parseDocument,type Project} from './model';
const TAB_ID=crypto.randomUUID();let connection:Promise<IDBDatabase>|undefined;const known=new Map<string,number>();

type Row={id:string;json:string;writer:string;savedAt:number};
export type WorkspaceWarning={id:string;message:string};
export type WorkspaceLoad={projects:Project[];warnings:WorkspaceWarning[]};

/** Plain-language reason for a storage failure; quota errors say what to do. */
export function storageErrorMessage(error:unknown):string{
 const name=(error as {name?:unknown}|null)?.name;
 if(name==='QuotaExceededError')return 'Browser storage is full. Download a backup, then free space or remove unused projects.';
 if(name==='SecurityError'||name==='InvalidStateError')return 'This browser does not allow local storage here (private window or blocked site data). Download a backup to keep your work.';
 return errorMessage(error);
}

function open():Promise<IDBDatabase>{
 if(!connection)connection=new Promise((resolve,reject)=>{
  // indexedDB can be missing or throw synchronously (blocked site data); a later call may try again.
  let r:IDBOpenDBRequest;try{r=indexedDB.open('diagramcloud-v1',1);}catch(error){connection=undefined;reject(new Error(storageErrorMessage(error)));return;}let blocked=false;
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('projects'))r.result.createObjectStore('projects',{keyPath:'id'});};
  r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>{r.result.close();connection=undefined;};resolve(r.result);};
  r.onerror=()=>{connection=undefined;reject(r.error?new Error(storageErrorMessage(r.error)):new Error('Could not open local workspace'));};
  r.onblocked=()=>{blocked=true;connection=undefined;reject(new Error('Close older DiagramCloud tabs to open storage'));};
 });
 return connection;
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
     known.set(project.id,row.savedAt);projects.push(project);
    }catch(error){warnings.push({id:rowId,message:errorMessage(error)});}
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
  const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');let problem:Error|null=null;let timestamp=0;
  const r=store.get(doc.id);
  r.onsuccess=()=>{const previous=r.result as Row|undefined,expected=known.get(doc.id);if(previous&&previous.writer!==TAB_ID&&previous.savedAt!==expected){problem=new Error('Another tab changed this project. Export your JSON, then reload before editing.');tx.abort();return;}timestamp=Math.max(Date.now(),(previous?.savedAt??0)+1);
   // A throwing put (quota, serialization) would abort with no reason; keep the real one.
   try{store.put({id:doc.id,json:JSON.stringify(doc),writer:TAB_ID,savedAt:timestamp} satisfies Row);}catch(error){problem=new Error(storageErrorMessage(error));tx.abort();}};
  tx.oncomplete=()=>{known.set(doc.id,timestamp);resolve();};
  tx.onabort=tx.onerror=()=>reject(problem??(tx.error?new Error(storageErrorMessage(tx.error)):new Error('Local save failed. Export a JSON backup.')));
 });
}
