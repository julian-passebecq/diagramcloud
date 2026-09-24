import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';
import {SIDECAR_PATH,readManifestIdentity,readSidecar,sidecarNotes,type ManifestIdentity,type SidecarFolder,type SidecarLink} from '../bridge/sidecar';

type PickerWindow=Window&{showDirectoryPicker?:(options?:{id?:string;mode?:'read'|'readwrite'})=>Promise<SidecarFolder>};
export type FoundSidecar={folder:SidecarFolder;text:string;hash:string;manifest:ManifestIdentity|null};

type Props={
 project:Project;
 link:SidecarLink|null;
 onFound:(found:FoundSidecar)=>void;
 onCreate:(folder:SidecarFolder)=>Promise<boolean>;
 onSave:()=>Promise<void>;
 onDownload:()=>void;
 onError:(message:string)=>void;
};

/** DataPass Bridge V1 entry point: pick a project repository, read .datapass/diagramcloud.json, hand the text to the normal review flow. */
export function RepositoryBridge(p:Props){
 const picker=(window as PickerWindow).showDirectoryPicker?.bind(window);
 const [missing,setMissing]=useState<{folder:SidecarFolder;manifest:ManifestIdentity|null}|null>(null),[busy,setBusy]=useState(false);
 const linked=!!p.link&&p.link.projectId===p.project.id;
 const run=async(work:()=>Promise<void>)=>{setBusy(true);try{await work();}catch(error){if(!(error instanceof Error&&error.name==='AbortError'))p.onError(errorMessage(error));}finally{setBusy(false);}};
 const open=()=>run(async()=>{
  setMissing(null);const folder=await picker!({id:'datapass-project',mode:'readwrite'});
  const [read,manifest]=await Promise.all([readSidecar(folder),readManifestIdentity(folder)]);
  if(read.status==='missing')setMissing({folder,manifest});else p.onFound({folder,text:read.text,hash:read.hash,manifest});
 });
 const notes=missing||linked?sidecarNotes(p.project):[];
 return <section className="repo-bridge" aria-label="DataPass project repository">
  <div className="repo-bridge-head"><div><strong>DataPass project repository</strong><p className="micro">Open a project folder to review its <code>{SIDECAR_PATH}</code>. Nothing is applied until it validates and you approve the change preview. Saving back never overwrites a file that changed after it was opened.</p></div>
  <div className="toolbar">{picker?<Button onClick={open} disabled={busy}>Open project folder…</Button>:<span className="micro">Folder access needs Edge or Chrome. Use “Import JSON” with the repository file instead.</span>}{linked&&<Button disabled={busy} onClick={()=>run(p.onSave)}>Save to repository</Button>}<Button appearance="subtle" onClick={p.onDownload}>Download {SIDECAR_PATH.split('/').pop()}</Button></div></div>
  {linked&&<p className="micro">Linked to <b>{p.link!.folder.name}/{SIDECAR_PATH}</b>{p.link!.baseRevision===p.project.revision?' · in sync':' · changes not yet saved to the repository'}</p>}
  {missing&&<div className="note-card" role="status"><strong>No {SIDECAR_PATH} in {missing.folder.name}</strong>{missing.manifest&&<> · DataPass project “{missing.manifest.title}”</>}<p>Create it from the open project “{p.project.title}”? The file is the full authoring document, so review it before you commit it.</p><Button appearance="primary" disabled={busy} onClick={()=>run(async()=>{if(await p.onCreate(missing.folder))setMissing(null);})}>Create repository file</Button></div>}
  {notes.map(note=><p key={note} className="micro repo-note">{note}</p>)}
 </section>;
}
