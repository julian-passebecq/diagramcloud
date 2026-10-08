import {scanRepository, documentFromScan} from '../core/scan';
import {IGNORED_DIR, SECRET_FILE, outsideNestedRepositories, wantedFile, type ScanFile} from '../core/scan/scanner';
import {secretInText} from '../core/secrets';
import {mapDocuments, wantedDocument, DOCUMENT_LIMITS} from './documents';
import type {DocumentMap, Purpose} from './types';
import {materializeAnalysis} from './materialize';

export const ACQUISITION_PROFILES = {
  quick: {files:200, fileBytes:64*1024, totalBytes:4*1024*1024},
  standard: {files:1500, fileBytes:256*1024, totalBytes:16*1024*1024},
} as const;
export type InventoryEntry = {path:string; bytes:number; state:'scanned'|'document'|'unsupported'|'ignored'|'limited'|'unsafe'};
export type AcquisitionAnalysis = {
  inventory:{entries:InventoryEntry[];selectedFiles:number;readFiles:number;readBytes:number;omittedEntries:number;unsupported:number;ignored:number;limited:number};
  sourceIdentity:{selectedRoot:string;sourceRevision:string|null;contentDigest:string;scopeComplete:boolean;observedAt:string;dirtyState:'unknown';profile:'quick'|'standard';analyzerVersion:string};
  documentMap:DocumentMap;technologies:string[];
};
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const abort=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Analysis cancelled','AbortError');};
const yieldTurn=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function validPath(path:string){return !!path&&path.length<=512&&!path.startsWith('/')&&!/^[a-z]:/i.test(path)&&!/[\u0000-\u001f]/.test(path)&&!path.split('/').some(s=>!s||s==='.'||s==='..');}
async function digest(bytes:Uint8Array){const value=await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>);return Array.from(new Uint8Array(value),n=>n.toString(16).padStart(2,'0')).join('');}

/** Authorized picker input only; metadata/path/resource gates run before any read.
 * The digest identifies the inspected bytes, never a clean HEAD or runtime attestation.
 */
export async function analyzePickedFolder(list:ArrayLike<File>,options:{depth:'quick'|'standard';purpose?:Purpose},signal?:AbortSignal,onProgress?:(value:{read:number;total:number;path:string})=>void){
  abort(signal);
  const all=Array.from(list),hasRelative=all.some(f=>!!f.webkitRelativePath);
  const first=all.find(f=>!!f.webkitRelativePath)?.webkitRelativePath.replace(/\\/g,'/').split('/')[0];
  const selectedRoot=first&&first.length<=120&&!secretInText(first)?first:'Selected repository';
  const raw=all.map(f=>({f,path:(f.webkitRelativePath||f.name).replace(/\\/g,'/')})).map(x=>({...x,path:hasRelative&&x.f.webkitRelativePath?x.path.split('/').slice(1).join('/'):x.path})).sort((a,b)=>compare(a.path,b.path));
  const outside=new Set(outsideNestedRepositories(raw).map(x=>x));
  const budget=ACQUISITION_PROFILES[options.depth],entries:InventoryEntry[]=[],picked:typeof raw=[];
  let reservedFiles=0,reservedBytes=0,docFiles=0,docBytes=0,unsupported=0,ignored=0,limited=0,omittedEntries=0;
  const seen=new Set<string>();
  const add=(entry:InventoryEntry)=>{if(entries.length<2000)entries.push(entry);else omittedEntries++;};
  for(const item of raw){
    const {path,f}=item;
    if(!validPath(path)||secretInText(path)||seen.has(path)||!outside.has(item)||SECRET_FILE.test(path)||(IGNORED_DIR.test(path)&&!/^\.git\/(HEAD|packed-refs|refs\/heads\/.+)$/.test(path))){ignored++;continue;}
    seen.add(path);
    const doc=wantedDocument(path),code=wantedFile(path);
    if(!doc&&!code){unsupported++;add({path,bytes:f.size,state:'unsupported'});continue;}
    const fileCap=doc?Math.min(budget.fileBytes,DOCUMENT_LIMITS.fileBytes):budget.fileBytes;
    if(!Number.isSafeInteger(f.size)||f.size<0||f.size>fileCap||reservedFiles>=budget.files||reservedBytes+f.size>budget.totalBytes||(doc&&(docFiles>=DOCUMENT_LIMITS.files||docBytes+f.size>DOCUMENT_LIMITS.totalBytes))){limited++;add({path,bytes:Math.max(0,f.size||0),state:'limited'});continue;}
    reservedFiles++;reservedBytes+=f.size;if(doc){docFiles++;docBytes+=f.size;}picked.push(item);
  }
  const files:ScanFile[]=[],documents:ScanFile[]=[],hashes:string[]=[];let readBytes=0,readFiles=0;
  for(const {f,path} of picked){
    abort(signal);await yieldTurn();abort(signal);
    const bytes=new Uint8Array(await f.arrayBuffer());abort(signal);
    if(bytes.byteLength!==f.size){throw new Error('Selected file changed during analysis; select the folder again.');}
    readBytes+=bytes.byteLength;readFiles++;
    hashes.push(`${path}\0${bytes.byteLength}\0${await digest(bytes)}`);
    const text=new TextDecoder().decode(bytes);
    if(secretInText(text)){ignored++;add({path,bytes:f.size,state:'unsafe'});}
    else if(wantedDocument(path)){documents.push({path,text});add({path,bytes:f.size,state:'document'});}
    else {files.push({path,text});add({path,bytes:f.size,state:'scanned'});}
    onProgress?.({read:readFiles,total:picked.length,path});
  }
  await yieldTurn();abort(signal);
  const model=scanRepository(files,{name:selectedRoot});
  const result=documentFromScan(model,{fileName:selectedRoot});
  const documentMap=mapDocuments(documents,text=>!secretInText(text));
  // Persist a bounded map rather than allowing hundreds of long heading/record lists
  // to exceed the authoring document's size budget.
  let mapBytes=0;
  documentMap.documents=documentMap.documents.filter(entry=>{const size=JSON.stringify(entry).length;if(mapBytes+size>300000){documentMap.omitted.documents++;return false;}mapBytes+=size;return true;});
  const mappedPaths=new Set(documentMap.documents.map(entry=>entry.path));
  let linkBytes=0,diagnosticBytes=0;
  documentMap.links=documentMap.links.filter(link=>{const size=JSON.stringify(link).length;if(!mappedPaths.has(link.fromPath)||!mappedPaths.has(link.toPath)||linkBytes+size>300000){documentMap.omitted.links++;return false;}linkBytes+=size;return true;});
  documentMap.diagnostics=documentMap.diagnostics.filter(item=>{const size=JSON.stringify(item).length;if(diagnosticBytes+size>100000){documentMap.omitted.diagnostics++;return false;}diagnosticBytes+=size;return true;});
  const analysis:AcquisitionAnalysis={inventory:{entries:entries.sort((a,b)=>compare(a.path,b.path)),selectedFiles:all.length,readFiles,readBytes,omittedEntries,unsupported,ignored,limited},
    sourceIdentity:{selectedRoot,sourceRevision:model.commit??null,contentDigest:`sha256:${await digest(new TextEncoder().encode(hashes.join('\n')))}`,scopeComplete:!limited&&!ignored&&!unsupported&&!omittedEntries&&!documentMap.omitted.documents&&!documentMap.omitted.links&&!documentMap.omitted.diagnostics,observedAt:new Date().toISOString(),dirtyState:'unknown',profile:options.depth,analyzerVersion:'diagramcloud-acquisition/1'},
    documentMap,technologies:[...model.detectors.keys()]};
  abort(signal);
  const document=materializeAnalysis(result.document,analysis);
  result.report.kept.push(`Inspected ${readFiles} of ${all.length} selected files (${options.depth}); ${documents.length} Markdown/CSV documents mapped. Content digest identifies inspected bytes; HEAD and dirty state are separate.`);
  result.report.lost.push(`${unsupported} unsupported, ${ignored} excluded/unsafe, ${limited} budget-limited files. Revision ${model.commit?'is a HEAD hint only':'unknown'}; dirty state unknown. No runtime claims established.`);
  return {document,report:result.report,analysis,read:readFiles,model};
}
