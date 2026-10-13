import {parseAllDocuments,isMap,isSeq,isScalar,isAlias,type Node} from 'yaml';
import type {DocumentInput,DocumentMap,DocumentDiagnostic,DocumentLink} from './types';

/** These files belong to domain/configuration analyzers. A lexical document map
 * must not reinterpret a deployment manifest or dependency lock as architecture. */
const NATIVE=/(^|\/)(package(?:-lock)?\.json|tsconfig[^/]*\.json|composer(?:\.lock|\.json)|openapi\.(json|ya?ml)|swagger\.(json|ya?ml)|asyncapi\.(json|ya?ml)|databricks\.(json|ya?ml)|dbt_project\.ya?ml|manifest\.json|catalog\.json|function\.json|host\.json|containerapp\.(json|ya?ml)|template\.json|azuredeploy\.json|main\.json|deploymenttemplate\.json|azure\.ya?ml|chart\.ya?ml|values[^/]*\.ya?ml|kustomization(?:\.ya?ml)?|docker-compose[^/]*\.ya?ml|compose\.ya?ml|\.platform|definition\.pbir)$/i;
const PRIVATE_SEGMENT=/(^|\/)(\.git|node_modules|vendor|dist|build|out|target|coverage|\.venv|venv|\.cache|\.worktrees|\.claude|\.terraform|test-results|playwright-report)(\/|$)/i;
const PRIVATE_FILE=/(^|\/)(\.env(?:\.[^/]*)?|[^/]*(?:secret|credential|private[-_]?key)[^/]*)$/i;
const PRIVATE_KEY=/^(?:env|environment|environmentVariables|dotenv|connectionStrings?)$|password|passwd|passphrase|secret|token|api[_-]?key|private[_-]?key|credential/i;
const REF_KEYS=new Set(['$ref','document_ref','document_refs','source_ref','source_refs']);
const LIMITS={files:200,fileBytes:128*1024,totalBytes:8*1024*1024,records:2000,links:4000,diagnostics:1000,depth:48,visited:10000} as const;
function safePath(path:string):boolean{return !!path&&!path.startsWith('/')&&!/^[a-z]:/i.test(path)&&!/[\\\u0000-\u001f]/.test(path)&&!path.split('/').some(s=>!s||s==='.'||s==='..')&&!PRIVATE_SEGMENT.test(path)&&!PRIVATE_FILE.test(path);}
/** Call on metadata before reading. JSON/YAML data stays lexical, never executable. */
export function wantedStructuredDocument(path:string):boolean{return safePath(path)&&/\.(json|ya?ml)$/i.test(path)&&!NATIVE.test(path);}
const pointerKey=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1');
function targetPath(from:string,value:string):{path:string;fragment:boolean}|null{
 if(value.startsWith('#')||/^[a-z][a-z0-9+.-]*:/i.test(value)||value.startsWith('//'))return null;
 let raw:string;try{raw=decodeURIComponent(value.split('#')[0]);}catch{return null;}
 if(!raw||raw.startsWith('/')||/[?\\\u0000-\u001f]/.test(raw))return null;
 const parts=from.split('/').slice(0,-1);
 for(const part of raw.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else{if(part.includes(':'))return null;parts.push(part);}}
 const path=parts.join('/');return safePath(path)?{path,fragment:value.includes('#')}:null;
}

/** Explicit selected-local references only: $ref, document_ref(s), source_ref(s).
 * Record identities are JSON Pointers, not field values or inferred entities.
 * No source scalar value, tag, alias expansion, URL or referenced file is executed/read.
 * availablePaths must be the caller's already-authorized, content-filtered set. */
export function mapStructuredDocuments(input:readonly DocumentInput[],isSafeText:(text:string)=>boolean,availablePaths?:readonly string[]):DocumentMap{
 const documents:DocumentMap['documents']=[],links:DocumentLink[]=[],diagnostics:DocumentDiagnostic[]=[],omitted={documents:0,links:0,diagnostics:0};
 const diag=(item:DocumentDiagnostic)=>{if(diagnostics.length<LIMITS.diagnostics)diagnostics.push(item);else omitted.diagnostics++;};
 const files=new Map<string,string>();let bytes=0;
 for(const f of [...input].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)){
  if(!wantedStructuredDocument(f.path)){omitted.documents++;continue;}
  if(files.has(f.path))throw new Error('Duplicate structured document path: '+f.path);
  const size=new TextEncoder().encode(f.text).byteLength;
  if(files.size>=LIMITS.files||size>LIMITS.fileBytes||bytes+size>LIMITS.totalBytes){omitted.documents++;diag({path:f.path,code:'limited',message:'Structured document exceeds selected analysis budgets.'});continue;}
  if(!isSafeText(f.text)){omitted.documents++;diag({path:f.path,code:'unsafe',message:'Content rejected by the application safety filter.'});continue;}
  files.set(f.path,f.text);bytes+=size;
 }
 const available=new Set((availablePaths??[...files.keys()]).filter(safePath)),pending:{path:string;line:number;target:string}[]=[],accepted=new Set<string>();
 for(const [path,text] of files){
  const entry:DocumentMap['documents'][number]={path,kind:/\.json$/i.test(path)?'json':'yaml',headings:[],records:[]};
  const staged:{path:string;line:number;target:string}[]=[],lineStarts=[0];for(let i=0;i<text.length;i++)if(text[i]==='\n')lineStarts.push(i+1);
  const line=(offset:number)=>{let lo=0,hi=lineStarts.length;while(lo+1<hi){const mid=(lo+hi)>>>1;if(lineStarts[mid]<=offset)lo=mid;else hi=mid;}return lo+1;};
  try{
   if(entry.kind==='json')JSON.parse(text); // YAML's permissive syntax is not a JSON validator.
   const parsed=parseAllDocuments(text,{uniqueKeys:true,schema:'core'});
   if(parsed.some(d=>d.errors.length))throw new Error('Invalid syntax or duplicate mapping keys.');
   if(entry.kind==='json'&&parsed.length!==1)throw new Error('JSON must contain one document.');
   let visited=0,limited=false,privateFields=false;
   const stack:{node:Node|null;pointer:string;depth:number;start?:number}[]=parsed.map((d,i)=>({node:d.contents,pointer:parsed.length===1?'':'/document/'+i,depth:0}));
   while(stack.length){
    const current=stack.pop()!,node=current.node;if(!node)continue;
    if(++visited>LIMITS.visited||current.depth>LIMITS.depth){limited=true;continue;}
    if(isAlias(node)||node.tag)throw new Error('Aliases and explicit tags are unsupported.');
    if(isMap(node)||isSeq(node)){
     const start=current.start??node.range?.[0]??0,end=Math.max(start,(node.range?.[1]??start+1)-1);
     if(entry.records.length<LIMITS.records)entry.records.push({id:current.pointer||'/',startLine:line(start),endLine:line(end)});else limited=true;
     if(isMap(node))for(let i=node.items.length-1;i>=0;i--){
      const pair=node.items[i];if(!isScalar(pair.key)||typeof pair.key.value!=='string'||pair.key.value.length>200)throw new Error('Only bounded string mapping keys are supported.');
      const key=pair.key.value;if(PRIVATE_KEY.test(key)){privateFields=true;continue;}
      const value=pair.value as Node|null;
      if(REF_KEYS.has(key)&&value){
       const values=isSeq(value)?value.items:[value];
       if(values.some(v=>!isScalar(v)||typeof v.value!=='string'))diag({path,line:line(pair.key.range?.[0]??0),code:'unsupported',message:'Explicit references require a string path or list of string paths.'});
       else for(const v of values)if(isScalar(v))staged.push({path,line:line(v.range?.[0]??pair.key.range?.[0]??0),target:String(v.value)});
      }
      if(value)stack.push({node:value,pointer:current.pointer+'/'+pointerKey(key),depth:current.depth+1,start:pair.key.range?.[0]});
     }
     else for(let i=node.items.length-1;i>=0;i--)stack.push({node:node.items[i] as Node|null,pointer:current.pointer+'/'+i,depth:current.depth+1});
    }
   }
   if(limited)diag({path,code:'limited',message:'Structural record/depth budget reached; mapping is partial.'});
   if(privateFields)diag({path,code:'unsafe',message:'Secret or environment fields and their descendants were omitted without copying values.'});
   documents.push(entry);accepted.add(path);pending.push(...staged);
  }catch{omitted.documents++;diag({path,code:'invalid',message:'Invalid structured document or unsupported aliases/tags/keys; no partial records or references retained.'});}
 }
 // Invalid selected structured files must not become a resolved reference target.
 const usable=new Set([...available].filter(p=>!files.has(p)||accepted.has(p)));
 for(const r of pending){
  const target=targetPath(r.path,r.target);
  if(!target||!usable.has(target.path)){diag({path:r.path,line:r.line,code:'unresolved',message:'Explicit reference has no safe authorized selected target.'});continue;}
  if(links.length>=LIMITS.links){omitted.links++;continue;}
  const candidate:DocumentLink={fromPath:r.path,fromLine:r.line,toPath:target.path,toLine:1,kind:'structured-reference'};
  if(!links.some(l=>l.fromPath===candidate.fromPath&&l.fromLine===candidate.fromLine&&l.toPath===candidate.toPath))links.push(candidate);
  if(target.fragment)diag({path:r.path,line:r.line,code:'unsupported',message:'File resolved; JSON Pointer or heading fragment resolution is not implemented.'});
 }
 return {format:'diagramcloud.document-map',version:1,documents,links,diagnostics,omitted,limitations:[
  'Selected JSON/YAML records are lexical JSON Pointers with source ranges; no scalar values or runtime architecture are inferred.',
  'Only explicit $ref, document_ref(s) and source_ref(s) selected-local paths are linked. References are never fetched; fragments remain unresolved.',
  'Known native manifests are left to domain analyzers. Environment/secret fields, aliases and explicit tags are not mapped.',
  'Document instructions stay inert; generated records remain private until a separately reviewed projection.']};
}
