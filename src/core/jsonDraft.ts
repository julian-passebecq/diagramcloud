import {MAX_DOCUMENT_BYTES,errorMessage,type Choice,type Project} from './model';
import {applyDocumentPatch,PATCH_FORMAT,type Operation,type Patch} from './patch';
import {previewDocumentChange,type DocumentChangePreview} from './changePreview';

/**
 * Native JSON draft: the applied model, the current draft text and the last valid preview are three distinct things.
 * A draft is text only; it never mutates the project. Apply turns it into a revision-guarded `diagramcloud.patch`
 * against the base the draft was written from, so a newer live revision (a visual edit, an undo, another project)
 * refuses the whole draft. A component draft is addressed by its exact stable ID and replaces only that component.
 */
export type DraftScope={kind:'project'}|{kind:'node';id:string};
export type DraftBase={projectId:string;revision:number;scope:DraftScope};
export type DraftCheck={ok:true;text:string;next:Project;preview:DocumentChangePreview;decisions:string[]}|{ok:false;text:string;error:string};
export const DRAFT_NO_COMPONENT=(id:string)=>`No component with stable ID “${id}” in this project. Nothing is mapped; choose a component on the canvas or edit the whole project.`;
const IDENTITY=['id','revision','schemaVersion'];
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const isObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);

/** The text a draft starts from: the whole project, or exactly the component with this stable ID. */
export function draftText(project:Project,scope:DraftScope):string{
 if(scope.kind==='project')return JSON.stringify(project,null,2);
 const node=project.nodes.find(n=>n.id===scope.id);if(!node)throw new Error(DRAFT_NO_COMPONENT(scope.id));
 return JSON.stringify(node,null,2);
}

/** The guarded patch equivalent to a draft. Throws on unparsable JSON or a changed identity; never mutates. */
export function draftPatch(base:DraftBase,applied:Project,text:string):Patch{
 if(new TextEncoder().encode(text).byteLength>MAX_DOCUMENT_BYTES)throw new Error('The draft exceeds the 12 MiB document limit');
 let value:unknown;try{value=JSON.parse(text);}catch(e){throw new Error(`Not valid JSON: ${errorMessage(e)}`);}
 if(!isObj(value))throw new Error('The draft must be one JSON object');
 const operations:Operation[]=[{op:'test',path:'/id',value:base.projectId}];
 if(base.scope.kind==='node'){
  const id=base.scope.id;
  if(value.id!==id)throw new Error(`Keep the stable component ID “${id}”; to rename, edit the label`);
  if(!applied.nodes.some(n=>n.id===id))throw new Error(DRAFT_NO_COMPONENT(id));
  operations.push({op:'replace',path:`/nodes/@${id}`,value});
 }else{
  if(value.id!==base.projectId)throw new Error(`Keep the stable project ID “${base.projectId}”`);
  if('revision' in value&&value.revision!==base.revision)throw new Error(`Keep "revision": ${base.revision}; the revision changes only when the draft is applied`);
  if(value.schemaVersion!==applied.schemaVersion)throw new Error(`Keep "schemaVersion": ${applied.schemaVersion}`);
  const current=applied as unknown as Record<string,unknown>;
  for(const key of new Set([...Object.keys(current),...Object.keys(value)])){
   if(IDENTITY.includes(key))continue;
   const path='/'+key.replace(/~/g,'~0').replace(/\//g,'~1');
   if(!(key in value))operations.push({op:'remove',path});
   else if(!(key in current))operations.push({op:'add',path,value:value[key]});
   else if(!same(current[key],value[key]))operations.push({op:'replace',path,value:value[key]});
  }
 }
 return {format:PATCH_FORMAT,version:1,target:'project',targetId:base.projectId,baseRevision:base.revision,summary:base.scope.kind==='node'?`JSON drawer: component ${base.scope.id}`:'JSON drawer: whole project',operations};
}

/** Accepted decisions an edit removes or rewrites (author, date, sources or content). Shown before Apply, never silent. */
export function decisionRewrites(before:Project,after:Project):string[]{
 const accepted=(p:Project)=>new Map([...p.nodes,...p.views].flatMap(o=>(o.choices??[]).filter(c=>c.status==='accepted').map(c=>[c.id,c] as [string,Choice])));
 const next=new Map([...after.nodes,...after.views].flatMap(o=>(o.choices??[]).map(c=>[c.id,c] as [string,Choice])));
 return [...accepted(before)].filter(([id,c])=>!same(c,next.get(id))).map(([id])=>id).sort();
}

/** Validate a draft against the project it was written from. Errors are results, so a caller can keep the last good preview. */
export function checkDraft(base:DraftBase,applied:Project,text:string):DraftCheck{
 try{
  if(applied.id!==base.projectId)throw new Error(`This draft belongs to project “${base.projectId}”, but “${applied.id}” is open`);
  const {result}=applyDocumentPatch(applied,draftPatch(base,applied,text));
  return {ok:true,text,next:result,preview:previewDocumentChange(applied,result),decisions:decisionRewrites(applied,result)};
 }catch(e){return {ok:false,text,error:errorMessage(e)};}
}

/** Apply: revalidate against the LIVE project. A newer revision or another project refuses everything, without mutation. */
export function applyDraft(base:DraftBase,live:Project,text:string,appliedAtBase?:Project):Project{
 if(live.id!==base.projectId)throw new Error(`Refused: this draft belongs to project “${base.projectId}”, but “${live.id}” is open. Nothing was applied.`);
 if(live.revision!==base.revision)throw new Error(`Refused: the project is now at revision ${live.revision}, and this draft was written against revision ${base.revision}. Nothing was applied. Reload the draft from the applied model and redo the edit.`);
 // Revisions can repeat after Undo and a new edit; the content the draft was written from must also be unchanged.
 if(appliedAtBase&&!same(appliedAtBase,live))throw new Error(`Refused: the project changed after this draft started (revision ${base.revision}). Nothing was applied. Reload the draft from the applied model and redo the edit.`);
 const checked=checkDraft(base,live,text);
 if(!checked.ok)throw new Error(`Refused: ${checked.error}. Nothing was applied.`);
 return checked.next;
}

/**
 * Debounced, cancelable validation where only the newest submission can report. A result that arrives after a newer
 * draft was submitted (or after cancel) is dropped, so a late validation can never replace a newer draft's state.
 */
export function createLatestValidator<R>(check:(text:string,signal:AbortSignal)=>R|Promise<R>,onResult:(text:string,result:R)=>void,delay=250){
 let generation=0,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
 const cancel=()=>{generation++;if(timer!==undefined)clearTimeout(timer);timer=undefined;controller?.abort();controller=undefined;};
 return {
  submit(text:string){cancel();const mine=generation;timer=setTimeout(()=>{timer=undefined;const c=controller=new AbortController();
   Promise.resolve().then(()=>check(text,c.signal)).then(result=>{if(mine===generation&&!c.signal.aborted){controller=undefined;onResult(text,result);}},()=>{/* checks report errors as results */});},delay);},
  cancel,
  pending:()=>timer!==undefined||controller!==undefined
 };
}
