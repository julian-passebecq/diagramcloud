import {validateDocument,type Project} from '../core/model';

/**
 * DataPass ↔ DiagramCloud Bridge V1 (contract pinned in docs/contracts/datapass-diagramcloud-bridge.lock.json).
 * A project repository carries one DiagramCloud document at .datapass/diagramcloud.json. DiagramCloud only reads it
 * through the normal validate → preview → apply path, and only writes it after checking nobody changed it meanwhile.
 */
export const SIDECAR_DIR='.datapass',SIDECAR_FILE='diagramcloud.json',SIDECAR_PATH=`${SIDECAR_DIR}/${SIDECAR_FILE}`,MANIFEST_FILE='project.json';
/** Above this, embedded images make Git review painful. Advisory only; the 12 MiB document limit still applies. */
export const SIDECAR_WARN_BYTES=1024*1024;
const MAX_MANIFEST_BYTES=1024*1024;

/** Minimal File System Access surface. Browser handles and in-memory test folders both satisfy it. */
export type SidecarWritable={write(data:string):Promise<void>;close():Promise<void>};
export type SidecarFile={getFile():Promise<{size:number;text():Promise<string>}>;createWritable():Promise<SidecarWritable>};
export type SidecarFolder={name:string;requestPermission?(descriptor:{mode:'readwrite'}):Promise<PermissionState>;getDirectoryHandle(name:string,options?:{create?:boolean}):Promise<SidecarFolder>;getFileHandle(name:string,options?:{create?:boolean}):Promise<SidecarFile>};

/** baseHash is the SHA-256 of the file as last read or written; null means it did not exist yet. */
export type SidecarLink={folder:SidecarFolder;projectId:string;baseRevision:number|null;baseHash:string|null};
export type SidecarRead={status:'missing'}|{status:'found';text:string;hash:string;bytes:number};
export type ManifestIdentity={id:string;title:string};

export class SidecarConflictError extends Error{constructor(message:string){super(message);this.name='SidecarConflictError';}}

export async function contentHash(text:string):Promise<string>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
const notFound=(error:unknown)=>error instanceof Error&&(error.name==='NotFoundError'||error.name==='TypeMismatchError');

/** Stable, reviewable text: full authoring document (the repository is private project storage), two-space JSON, trailing newline. */
export function serializeSidecar(project:Project):string{return JSON.stringify(validateDocument(project),null,2)+'\n';}

async function sidecarHandle(folder:SidecarFolder,create:boolean):Promise<SidecarFile|null>{
 try{const dir=await folder.getDirectoryHandle(SIDECAR_DIR,{create});return await dir.getFileHandle(SIDECAR_FILE,{create});}
 catch(error){if(!create&&notFound(error))return null;throw error;}
}

/** Reads raw text only. Callers must still parseDocument + preview before anything reaches the open project. */
export async function readSidecar(folder:SidecarFolder):Promise<SidecarRead>{
 const handle=await sidecarHandle(folder,false);if(!handle)return{status:'missing'};
 const text=await (await handle.getFile()).text();if(!text.trim())return{status:'missing'};
 return{status:'found',text,hash:await contentHash(text),bytes:new TextEncoder().encode(text).byteLength};
}

/** Only the DataPass project id/title are read from .datapass/project.json, to confirm the right folder was chosen. */
export async function readManifestIdentity(folder:SidecarFolder):Promise<ManifestIdentity|null>{
 try{
  const dir=await folder.getDirectoryHandle(SIDECAR_DIR),file=await (await dir.getFileHandle(MANIFEST_FILE)).getFile();
  if(file.size>MAX_MANIFEST_BYTES)return null;
  const project=(JSON.parse(await file.text()) as {project?:{id?:unknown;title?:unknown}}).project;
  return typeof project?.id==='string'&&typeof project.title==='string'?{id:project.id.slice(0,160),title:project.title.slice(0,240)}:null;
 }catch{return null;}
}

/** Write the open project back, refusing if the file changed since it was read (DataPass plan applied, Git pull, other editor). */
export async function writeSidecar(link:SidecarLink,project:Project):Promise<SidecarLink>{
 if(project.id!==link.projectId)throw new Error(`The open project (${project.id}) is not the one linked to ${link.folder.name}/${SIDECAR_PATH} (${link.projectId}).`);
 if(link.folder.requestPermission&&await link.folder.requestPermission({mode:'readwrite'})!=='granted')throw new Error(`Write access to ${link.folder.name} was not granted. Nothing was written.`);
 const text=serializeSidecar(project),handle=(await sidecarHandle(link.folder,true))!;
 const onDisk=await (await handle.getFile()).text(),diskHash=onDisk.trim()?await contentHash(onDisk):null;
 if(diskHash!==link.baseHash)throw new SidecarConflictError(`${link.folder.name}/${SIDECAR_PATH} changed after DiagramCloud last read it. Nothing was written. Download a backup, then reopen the repository file to review the newer version.`);
 const writable=await handle.createWritable();await writable.write(text);await writable.close();
 return{...link,baseRevision:project.revision,baseHash:await contentHash(text)};
}

/** Review notes shown before a sidecar is written into a Git repository. */
export function sidecarNotes(project:Project,bytes=new TextEncoder().encode(serializeSidecar(project)).byteLength):string[]{
 const privateCount=[project.nodes,project.edges,project.views,project.blocks,project.assets,project.sources].reduce((sum,items)=>sum+items.filter(item=>item.visibility==='private').length,0)+(project.privateNotes?1:0);
 const notes:string[]=[];
 if(privateCount)notes.push(`${privateCount} private object${privateCount===1?'':'s'} will be stored in the repository file. Commit it only where the repository visibility allows that.`);
 if(bytes>SIDECAR_WARN_BYTES)notes.push(`The file is ${(bytes/1024/1024).toFixed(1)} MiB, mostly embedded images. Large sidecars are hard to review in Git.`);
 return notes;
}

/** The `diagramCloud` member of a datapass.ai-context V1 envelope. DataPass produces the envelope; this is the shape DiagramCloud guarantees. */
export function contextBlock(project:Project|null){
 return project?{present:true,documentPath:SIDECAR_PATH,documentId:project.id,revision:project.revision}:{present:false,documentPath:SIDECAR_PATH,revision:null};
}
