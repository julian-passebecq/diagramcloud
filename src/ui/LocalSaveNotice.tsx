import type {Project} from '../core/model';

type Props={error:string;publicMode:boolean;project:Project;library:readonly Project[];unsavedProjectIds:readonly string[];onCurrentBackup:()=>void|Promise<void>;onBackup:(draft:Project)=>void|Promise<void>;onBackupError?:(message:string)=>void};
export const LOCAL_BACKUP_FAILED='The backup download could not start. The draft is still in memory. Keep this tab open, retry the backup or copy its Authoring JSON.';
/** Starting a browser download does not prove the user retained it, nor does a
 * backup acknowledge a durable local save. Callback failures remain visible. */
export async function attemptLocalBackup(action:()=>void|Promise<void>,report:(message:string)=>void):Promise<void>{
 try{await action();}catch{report(LOCAL_BACKUP_FAILED);}
}

/** Recovery for the actual in-memory drafts. Downloading a backup never claims a successful save. */
export function LocalSaveNotice({error,publicMode,project,library,unsavedProjectIds,onCurrentBackup,onBackup,onBackupError=()=>{}}:Props){
 if(!error)return null;
 if(publicMode)return <div role="alert" className="alert error local-save-notice"><strong>Local save needs attention.</strong> Authoring work is not saved. Return to Explore or Edit to back up the affected drafts.</div>;
 const others=Array.from(new Set(unsavedProjectIds)).filter(id=>id!==project.id).flatMap(id=>{const draft=library.find(d=>d.id===id);return draft?[draft]:[];});
 return <div role="alert" className="alert error local-save-notice"><div><strong>Local save needs attention.</strong> {error}</div>
  <div className="local-save-actions"><button type="button" onClick={()=>void attemptLocalBackup(onCurrentBackup,onBackupError)}>Download backup</button>
   {others.map(draft=><button key={draft.id} type="button" onClick={()=>void attemptLocalBackup(()=>onBackup(draft),onBackupError)}>Download backup for {draft.title} ({draft.id})</button>)}
  </div>
  {others.length>0&&<div>Other project drafts are still only in memory. Back up each affected draft before reloading.</div>}
 </div>;
}
