import {z} from 'zod';
import {MAX_DOCUMENT_BYTES,validateDocument,type Project} from './model';
import {validatePack,type ExperiencePack} from '../experience/model';

/**
 * Revision-guarded JSON Patch (RFC 6902) for small AI edits. The envelope names its target and the revision it
 * was written against; a stale base, another target, an ID change or a failing `test` refuses the whole patch.
 * Operations apply to a copy, and the result must pass validateDocument / validatePack, so nothing is mutated
 * unless the full result is valid. Extension: a path segment `@<id>` addresses an array item by its stable ID
 * (`/nodes/@checks/label`), so patches do not depend on array positions.
 */
export const PATCH_FORMAT='diagramcloud.patch';
export const MAX_PATCH_OPS=500;
const pointer=z.string().max(512).regex(/^(\/[^/]*)+$/,'Paths are JSON Pointers such as /nodes/@checks/label (the whole document cannot be replaced by a patch)');
export const operationSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('add'),path:pointer,value:z.unknown()}).strict(),
 z.object({op:z.literal('remove'),path:pointer}).strict(),
 z.object({op:z.literal('replace'),path:pointer,value:z.unknown()}).strict(),
 z.object({op:z.literal('move'),from:pointer,path:pointer}).strict(),
 z.object({op:z.literal('copy'),from:pointer,path:pointer}).strict(),
 z.object({op:z.literal('test'),path:pointer,value:z.unknown()}).strict()]);
export const patchSchema=z.object({
 format:z.literal(PATCH_FORMAT),version:z.literal(1),
 target:z.enum(['project','experience']),targetId:z.string().min(1).max(120),baseRevision:z.number().int().nonnegative(),
 summary:z.string().max(500).default(''),operations:z.array(operationSchema).min(1).max(MAX_PATCH_OPS)
}).strict();
export type Operation=z.infer<typeof operationSchema>;
export type Patch=z.infer<typeof patchSchema>;
export type PatchResult<T>={result:T;patch:Patch};

type Json=unknown;type Container=Record<string,Json>|Json[];
const FORBIDDEN=new Set(['__proto__','constructor','prototype']);
/** Fields that identify the document itself; a patch may test them but never change them. */
const PROTECTED={project:['/id','/revision','/schemaVersion','/experience/id','/experience/revision','/experience/format','/experience/schemaVersion'],experience:['/id','/revision','/format','/schemaVersion']};

export function isPatch(value:unknown):boolean{return !!value&&typeof value==='object'&&(value as {format?:unknown}).format===PATCH_FORMAT;}

function segments(path:string):string[]{
 return path.split('/').slice(1).map(s=>{const k=s.replace(/~1/g,'/').replace(/~0/g,'~');if(FORBIDDEN.has(k))throw new Error(`Path segment “${k}” is not allowed`);return k;});
}
const isObj=(v:Json):v is Record<string,Json>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Array position for a segment: an index, `@id`, or `-` (end, only when adding). */
function indexIn(arr:Json[],key:string,path:string,forAdd:boolean):number{
 if(key==='-'){if(forAdd)return arr.length;throw new Error(`${path}: “-” can only be used to add at the end`);}
 if(key.startsWith('@')){const id=key.slice(1),i=arr.findIndex(x=>isObj(x)&&x.id===id);if(i<0)throw new Error(`${path}: no item with id “${id}”`);return i;}
 if(!/^(0|[1-9]\d*)$/.test(key))throw new Error(`${path}: “${key}” is not an array index or @id`);
 const i=Number(key);if(i>arr.length||(!forAdd&&i===arr.length))throw new Error(`${path}: index ${i} is out of range`);return i;
}
/** Parent container and final key of a path. */
function locate(doc:Json,path:string):{parent:Container;key:string}{
 const keys=segments(path);let at:Json=doc;
 for(const [n,k] of keys.slice(0,-1).entries()){
  const here='/'+keys.slice(0,n+1).join('/');
  if(Array.isArray(at))at=at[indexIn(at,k,here,false)];
  else if(isObj(at)&&Object.hasOwn(at,k))at=at[k];
  else throw new Error(`${here}: does not exist`);
 }
 if(!Array.isArray(at)&&!isObj(at))throw new Error(`${path}: parent is not an object or array`);
 return {parent:at,key:keys.at(-1)!};
}
function get(doc:Json,path:string):Json{
 const {parent,key}=locate(doc,path);
 if(Array.isArray(parent))return parent[indexIn(parent,key,path,false)];
 if(!Object.hasOwn(parent,key))throw new Error(`${path}: does not exist`);return parent[key];
}
function add(doc:Json,path:string,value:Json){
 const {parent,key}=locate(doc,path);
 if(Array.isArray(parent))parent.splice(indexIn(parent,key,path,true),0,value);else parent[key]=value;
}
function remove(doc:Json,path:string):Json{
 const {parent,key}=locate(doc,path);
 if(Array.isArray(parent))return parent.splice(indexIn(parent,key,path,false),1)[0];
 if(!Object.hasOwn(parent,key))throw new Error(`${path}: does not exist`);const old=parent[key];delete parent[key];return old;
}
function replace(doc:Json,path:string,value:Json){
 const {parent,key}=locate(doc,path);
 if(Array.isArray(parent))parent[indexIn(parent,key,path,false)]=value;
 else{if(!Object.hasOwn(parent,key))throw new Error(`${path}: does not exist (use add)`);parent[key]=value;}
}
const canon=(v:Json):string=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:isObj(v)?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);

/** Apply operations to a copy. Throws, naming the failing operation, if any operation cannot apply. */
export function applyOperations<T>(input:T,operations:Operation[],protectedPaths:string[]=[]):T{
 const doc=structuredClone(input) as Json;
 operations.forEach((o,n)=>{
  const where=`Operation ${n+1} (${o.op} ${o.path})`;
  try{
   // test only reads; every other operation may not touch the document's own identity or any item's id.
   if(o.op!=='test')for(const p of o.op==='move'?[o.from,o.path]:[o.path]){
    if(protectedPaths.includes(p))throw new Error(`${p} identifies the document and cannot be changed by a patch`);
    if(p.endsWith('/id'))throw new Error('IDs are stable: edit the label instead, or remove the item and add a new one');}
   if((o.op==='add'||o.op==='replace'||o.op==='test')&&!('value' in o))throw new Error('value is required');
   switch(o.op){
    case 'add':add(doc,o.path,structuredClone(o.value));break;
    case 'remove':remove(doc,o.path);break;
    case 'replace':replace(doc,o.path,structuredClone(o.value));break;
    case 'move':if(o.path.startsWith(o.from+'/'))throw new Error('cannot move a value into itself');add(doc,o.path,remove(doc,o.from));break;
    case 'copy':add(doc,o.path,structuredClone(get(doc,o.from)));break;
    case 'test':if(canon(get(doc,o.path))!==canon(o.value))throw new Error(`test failed: the current value is ${clip(JSON.stringify(get(doc,o.path)))}`);break;
   }
  }catch(e){throw new Error(`${where}: ${e instanceof Error?e.message:String(e)}`);}
 });
 return doc as T;
}
const clip=(s:string|undefined)=>!s?'undefined':s.length>80?s.slice(0,79)+'…':s;

function envelope(input:unknown,target:Patch['target'],id:string,revision:number,kind:string):Patch{
 const parsed=patchSchema.safeParse(input);
 if(!parsed.success)throw new Error(`Not a valid DiagramCloud patch: ${parsed.error.issues.slice(0,3).map(i=>`${i.path.join('.')||'patch'}: ${i.message}`).join('; ')}`);
 const p=parsed.data;
 if(p.target!==target)throw new Error(`This patch targets ${p.target==='project'?'a project':'an evidence-workspace pack'}; use it in the ${p.target==='project'?'JSON / AI dialog':'Workspace JSON / AI panel'}.`);
 if(p.targetId!==id)throw new Error(`This patch is for ${kind} “${p.targetId}”, but “${id}” is open.`);
 if(p.baseRevision!==revision)throw new Error(`Stale patch: it was written against revision ${p.baseRevision}, and the open ${kind} is at revision ${revision}. Load the current JSON and ask for the patch again.`);
 return p;
}

/** Guarded patch for a whole project. The result keeps the base revision; applying it goes through the normal review. */
export function applyDocumentPatch(current:Project,input:unknown):PatchResult<Project>{
 const patch=envelope(input,'project',current.id,current.revision,'project');
 const result=applyOperations(current,patch.operations,PROTECTED.project);
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>MAX_DOCUMENT_BYTES)throw new Error('The patched document would exceed the 12 MiB limit');
 return {result:validateDocument(result),patch};
}
/** Guarded patch for an evidence-workspace pack. */
export function applyPackPatch(current:ExperiencePack,input:unknown):PatchResult<ExperiencePack>{
 const patch=envelope(input,'experience',current.id,current.revision,'pack');
 return {result:validatePack(applyOperations(current,patch.operations,PROTECTED.experience)),patch};
}

/** A starting patch for an AI: correct target, id and base revision, with a guarded example edit. */
export function patchTemplate(target:Patch['target'],id:string,revision:number,example:{path:string;value:unknown}):Patch{
 return {format:PATCH_FORMAT,version:1,target,targetId:id,baseRevision:revision,summary:'Describe the edit in one sentence',
  operations:[{op:'test',path:example.path,value:example.value},{op:'replace',path:example.path,value:example.value}]};
}
