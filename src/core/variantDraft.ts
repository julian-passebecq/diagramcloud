import {canonical} from './learningMapping';
import {clone,edgeSchema,errorMessage,nodeSchema,validateDocument,type Project,type ProjectEdge,type ProjectNode} from './model';
import {applyOperations,type Operation} from './patch';
import {addVariant,reviseVariant,variantState} from './variants';
import {compareView,type DeltaAxis,type ViewDelta} from '../export/design/delta';
import {compareEnvironments} from '../intelligence/delivery';

/**
 * Visual variant drafts. A draft is a temporary candidate document derived from a known baseline (the live project, or
 * for an existing variant the project without it): the author edits components, connections and the variant's own view
 * with ordinary forms, and nothing reaches the model until the draft is recorded. Recording turns the difference between
 * baseline and candidate into variant operations, and every changed or removed field carries a `test` precondition with
 * the baseline value, so a concurrent edit of the same field refuses the variant instead of being overwritten.
 * The draft is never persisted and is never a second model: it is discarded on record, cancel or project switch.
 */
export type VariantDraft={variantId:string;title:string;viewId:string;baseline:Project;candidate:Project;revises?:string};
export const DRAFT_NOTE='Draft candidate: nothing in the model changes until you record it. Recording stores operations with preconditions; Apply is still a separate step.';
const ID=/^[a-z][a-z0-9_.-]{0,79}$/;

const view=(d:Project,viewId:string)=>{const v=d.views.find(v=>v.id===viewId);if(!v)throw new Error(`Unknown view ${viewId}.`);return v;};
const local=(draft:VariantDraft,id:string)=>id.startsWith(`${draft.variantId}.`);
const slug=(text:string)=>text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'item';
function freshId(draft:VariantDraft,base:string):string{
 const taken=new Set([...draft.candidate.nodes,...draft.candidate.edges,...draft.baseline.nodes,...draft.baseline.edges].map(x=>x.id));
 let id=`${draft.variantId}.${slug(base)}`.slice(0,80);for(let n=2;taken.has(id);n++)id=`${draft.variantId}.${slug(base)}-${n}`.slice(0,80);
 return id;
}
/** One validated candidate step. A refused edit leaves the draft as it was. */
function step(draft:VariantDraft,f:(d:Project)=>void):VariantDraft{const d=clone(draft.candidate);f(d);return {...draft,candidate:validateDocument(d)};}

/** Start a new visual draft of one view on the live project. */
export function startDraft(doc:Project,input:{variantId:string;title:string;viewId:string}):VariantDraft{
 const variantId=input.variantId.trim(),title=input.title.trim();
 if(!ID.test(variantId))throw new Error('Variant ID: lower-case letters, digits, “.”, “_” or “-”, starting with a letter.');
 if(!title)throw new Error('Give the variant a title.');
 if(doc.variants?.some(v=>v.id===variantId))throw new Error(`A variant ${variantId} already exists.`);
 view(doc,input.viewId);
 return {variantId,title,viewId:input.viewId,baseline:doc,candidate:clone(doc)};
}
/** Edit an existing variant visually: only a current one, from the document without it, so its preconditions are re-derived. */
export function draftFromVariant(doc:Project,id:string):VariantDraft{
 const state=variantState(doc,id);
 if(state.status!=='current'||!state.candidate)throw new Error(`Cannot edit visually: ${state.message}`);
 const baseline=validateDocument({...doc,variants:(doc.variants??[]).filter(v=>v.id!==id)});
 if(!baseline.variants?.length)delete baseline.variants;
 return {variantId:id,title:state.variant.title,viewId:state.variant.viewId,baseline,candidate:state.candidate,revises:id};
}

/** Replace one component's fields (from the ordinary component editor). Its ID never changes. */
export function draftUpdateNode(draft:VariantDraft,node:ProjectNode):VariantDraft{
 return step(draft,d=>{const i=d.nodes.findIndex(n=>n.id===node.id);if(i<0)throw new Error(`No component ${node.id} in this candidate.`);d.nodes[i]=clone(node);});
}
/** Add a candidate component to the view, with an ID in the variant's namespace. */
export function draftAddNode(draft:VariantDraft,input:{label:string;kind?:ProjectNode['kind'];provider?:string}):{draft:VariantDraft;id:string}{
 const label=input.label.trim();if(!label)throw new Error('Give the component a label.');
 const id=freshId(draft,label);
 const next=step(draft,d=>{const v=view(d,draft.viewId),xs=Object.values(v.positions),y=xs.length?Math.max(...xs.map(p=>p.y))+160:80;
  d.nodes.push(nodeSchema.parse({id,label,kind:input.kind??'process',provider:input.provider?.trim()||'Generic',basis:'planned'}));
  v.nodeIds.push(id);v.positions[id]={x:80,y};});
 return {draft:next,id};
}
/** Move a component in this view (layout only). */
export function draftMoveNode(draft:VariantDraft,nodeId:string,position:{x:number;y:number}):VariantDraft{
 if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new Error('A position needs two numbers.');
 return step(draft,d=>{const v=view(d,draft.viewId);if(!v.nodeIds.includes(nodeId))throw new Error(`${nodeId} is not in view ${draft.viewId}.`);v.positions[nodeId]={x:Math.round(position.x),y:Math.round(position.y)};});
}
/**
 * Take a component out of this view, with its connections in the view. A canonical component and its connections stay
 * in the project (other views may show them); only a candidate-local one is deleted.
 */
export function draftRemoveNode(draft:VariantDraft,nodeId:string):VariantDraft{
 return step(draft,d=>{const v=view(d,draft.viewId);if(!v.nodeIds.includes(nodeId))throw new Error(`${nodeId} is not in view ${draft.viewId}.`);
  const touching=new Set(d.edges.filter(e=>e.source===nodeId||e.target===nodeId).map(e=>e.id));
  v.nodeIds=v.nodeIds.filter(id=>id!==nodeId);delete v.positions[nodeId];v.edgeIds=v.edgeIds.filter(id=>!touching.has(id));
  if(v.design?.focal)v.design.focal=v.design.focal.filter(id=>id!==nodeId);
  if(local(draft,nodeId)){d.nodes=d.nodes.filter(n=>n.id!==nodeId);d.edges=d.edges.filter(e=>!(touching.has(e.id)&&local(draft,e.id)));}});
}
/** Replace one connection's fields (from the ordinary connection editor). Endpoints are kept as given. */
export function draftUpdateEdge(draft:VariantDraft,edge:ProjectEdge):VariantDraft{
 return step(draft,d=>{const i=d.edges.findIndex(e=>e.id===edge.id);if(i<0)throw new Error(`No connection ${edge.id} in this candidate.`);d.edges[i]=clone(edge);});
}
/** Add a candidate connection between two components of the view. */
export function draftAddEdge(draft:VariantDraft,input:{source:string;target:string;label?:string;kind?:ProjectEdge['kind']}):{draft:VariantDraft;id:string}{
 if(input.source===input.target)throw new Error('A connection needs two different components.');
 const id=freshId(draft,`${input.source.split('.').at(-1)}-${input.target.split('.').at(-1)}`);
 const next=step(draft,d=>{const v=view(d,draft.viewId);for(const n of [input.source,input.target])if(!v.nodeIds.includes(n))throw new Error(`${n} is not in view ${draft.viewId}.`);
  d.edges.push(edgeSchema.parse({id,source:input.source,target:input.target,label:input.label?.trim()??'',kind:input.kind??'batch',basis:'planned'}));v.edgeIds.push(id);});
 return {draft:next,id};
}
/** Take a connection out of this view; a candidate-local one is deleted, a canonical one stays in the project. */
export function draftRemoveEdge(draft:VariantDraft,edgeId:string):VariantDraft{
 return step(draft,d=>{const v=view(d,draft.viewId);if(!v.edgeIds.includes(edgeId))throw new Error(`${edgeId} is not in view ${draft.viewId}.`);
  v.edgeIds=v.edgeIds.filter(id=>id!==edgeId);if(local(draft,edgeId))d.edges=d.edges.filter(e=>e.id!==edgeId);});
}

const esc=(k:string)=>k.replace(/~/g,'~0').replace(/\//g,'~1');
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
/** Field-level operations from `before` to `after` of one object at `path`, each change guarded by a test of the old value. */
function fields(path:string,before:Record<string,unknown>,after:Record<string,unknown>,skip:string[]=[]):Operation[]{
 const out:Operation[]=[];
 for(const k of [...new Set([...Object.keys(before),...Object.keys(after)])].sort()){if(k==='id'||skip.includes(k))continue;
  const p=`${path}/${esc(k)}`,has=Object.hasOwn(before,k),will=Object.hasOwn(after,k);
  if(has&&will){if(!same(before[k],after[k]))out.push({op:'test',path:p,value:before[k]},{op:'replace',path:p,value:after[k]});}
  else if(will)out.push({op:'add',path:p,value:after[k]});
  else out.push({op:'test',path:p,value:before[k]},{op:'remove',path:p});}
 return out;
}
function items<T extends {id:string}>(kind:'nodes'|'edges',before:T[],after:T[]):{changes:Operation[];adds:Operation[];removes:Operation[]}{
 const b=new Map(before.map(x=>[x.id,x])),a=new Map(after.map(x=>[x.id,x])),changes:Operation[]=[],adds:Operation[]=[],removes:Operation[]=[];
 for(const x of after){const old=b.get(x.id);if(!old)adds.push({op:'add',path:`/${kind}/-`,value:x});else changes.push(...fields(`/${kind}/@${x.id}`,old as Record<string,unknown>,x as Record<string,unknown>));}
 for(const x of before)if(!a.has(x.id))removes.push({op:'test',path:`/${kind}/@${x.id}`,value:x},{op:'remove',path:`/${kind}/@${x.id}`});
 return {changes,adds,removes};
}
/**
 * The variant operations that turn the draft's baseline into its candidate: field changes of components and connections,
 * new candidate items, then the view (membership arrays as a whole, positions one component at a time), then removals.
 * Every replaced or removed value is preceded by a `test` of its baseline value. Pure.
 */
export function draftOperations(draft:VariantDraft):Operation[]{
 const nodes=items('nodes',draft.baseline.nodes,draft.candidate.nodes),edges=items('edges',draft.baseline.edges,draft.candidate.edges);
 const bv=view(draft.baseline,draft.viewId),cv=view(draft.candidate,draft.viewId),vp=`/views/@${draft.viewId}`;
 const positions=fields(`${vp}/positions`,bv.positions,cv.positions);
 return [...nodes.changes,...edges.changes,...nodes.adds,...edges.adds,...fields(vp,bv as unknown as Record<string,unknown>,cv as unknown as Record<string,unknown>,['positions']),...positions,...edges.removes,...nodes.removes];
}
/** True when the draft changes nothing yet. */
export const draftIsEmpty=(draft:VariantDraft)=>draftOperations(draft).length===0;

/**
 * Record the draft on the live project: a new variant, or the revised operations of the variant it edits. Refused when
 * the project switched, or when a precondition no longer holds because someone changed the same field meanwhile.
 */
export function recordDraft(live:Project,draft:VariantDraft):Project{
 if(live.id!==draft.baseline.id)throw new Error(`Refused: this draft belongs to project ${draft.baseline.id}, and ${live.id} is open. Nothing was recorded.`);
 const operations=draftOperations(draft);
 if(!operations.length)throw new Error('Nothing to record: the candidate is the same as its baseline.');
 try{return draft.revises?reviseVariant(live,draft.revises,operations):addVariant(live,{id:draft.variantId,title:draft.title,viewId:draft.viewId,operations});}
 catch(e){throw new Error(`Refused: ${errorMessage(e)} Nothing was recorded; the draft is kept.`);}
}

export type RebaseCheck={path:string;recorded:unknown;current:unknown;missing:boolean};
export type RebaseReport={status:'clean'|'conflicts'|'broken';checks:RebaseCheck[];conflicts:RebaseCheck[];message:string};
/** Read a JSON pointer with `@id` addressing; undefined plus `missing` when it does not resolve. */
function read(doc:unknown,path:string):{value?:unknown;missing:boolean}{
 let at:unknown=doc;
 for(const raw of path.split('/').slice(1)){const k=raw.replace(/~1/g,'/').replace(/~0/g,'~');
  if(Array.isArray(at)){const i=k.startsWith('@')?at.findIndex(x=>x&&typeof x==='object'&&(x as {id?:unknown}).id===k.slice(1)):/^\d+$/.test(k)?Number(k):-1;if(i<0||i>=at.length)return {missing:true};at=at[i];}
  else if(at&&typeof at==='object'&&Object.hasOwn(at,k))at=(at as Record<string,unknown>)[k];else return {missing:true};}
 return {value:at,missing:false};
}
/**
 * What an explicit rebase would meet, shown before it happens: each precondition of the variant against the current
 * document. A conflict (a field someone else changed) blocks the rebase; nothing is overwritten blindly. Pure.
 */
export function rebaseReport(doc:Project,id:string):RebaseReport{
 const v=doc.variants?.find(v=>v.id===id);if(!v)throw new Error(`No variant ${id} in this project.`);
 const base={...doc,variants:(doc.variants??[]).filter(x=>x.id!==id)};
 const checks=(v.operations as Operation[]).filter(o=>o.op==='test').map(o=>{const r=read(base,o.path);return {path:o.path,recorded:'value' in o?o.value:undefined,current:r.value,missing:r.missing};});
 const conflicts=checks.filter(c=>c.missing||!same(c.recorded,c.current));
 if(!doc.views.some(x=>x.id===v.viewId))return {status:'broken',checks,conflicts,message:`View ${v.viewId} no longer exists: the variant cannot be rebased.`};
 if(conflicts.length)return {status:'conflicts',checks,conflicts,message:`${conflicts.length} precondition(s) no longer hold: someone changed the same field(s) since the variant was recorded. Rebase is refused so their edit is not overwritten; edit the variant again or discard it.`};
 try{validateDocument(applyOperations(base,v.operations as Operation[]));}
 catch(e){return {status:'broken',checks,conflicts,message:`The operations no longer apply: ${errorMessage(e)}`};}
 return {status:'clean',checks,conflicts,message:`${checks.length} precondition(s) still hold. Rebasing records the current content as the new baseline; compare again before applying.`};
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Linked comparison (V3 W3). A comparison is opened on purpose from the workspace and frozen: it records the project, the
 * revision and the two sides it read, and keeps them until the reader returns or explicitly compares again. A source
 * change while it is open marks it stale and never re-pairs anything. Objects pair by exact stable ID only, or across two
 * projects by an explicit recorded correspondence; a label, a name, a tag or a provider never pairs two objects. An
 * object with no counterpart is shown absent. Comparing selects and reads only: it has no Apply, and Apply of a variant
 * stays the one revision-guarded patch of the Variants panel.
 * ------------------------------------------------------------------------------------------------------------------- */

/** What a comparison reads: a variant against its baseline, an earlier session revision against the live one, or two declared environments. */
export type ComparisonSource={kind:'variant';variantId:string}|{kind:'version';revision:number}|{kind:'environment';from:string;to:string}|{kind:'correspondence';rightProjectId:string};
export type EnvironmentSideState='reviewed-claim'|'declared'|'not-applicable'|'absent';
export type EnvironmentSide={state:EnvironmentSideState;text:string;claim?:string};
/** One component paired across two environments by its explicit componentId (never a label). */
export type EnvironmentPair={componentId:string;label:string;left:EnvironmentSide;right:EnvironmentSide;equivalence:'UNKNOWN'|'cited-same-revision'|'cited-different-revisions';axes:{axis:DeltaAxis;change:string;text:string}[]};
export type LinkedComparison={
 source:ComparisonSource;projectId:string;projectTitle:string;revision:number;viewId:string;
 title:string;leftLabel:string;rightLabel:string;pairing:'stable-id'|'correspondence';
 view?:{left:Project;right:Project;delta:ViewDelta};
 environments?:EnvironmentPair[];
};
export type ComparisonChoices={
 variants:{id:string;title:string;viewId:string;status:'current'|'stale'|'broken';message:string}[];
 versions:{revision:number;title:string}[];
 environments:{id:string;label:string}[];
};
export const COMPARE_NOTE='Selecting compares only: nothing is accepted, applied or recorded from here. Apply of a variant stays in the Variants panel, as one revision and one Undo.';
export const PAIRING_TEXT:Record<LinkedComparison['pairing'],string>={'stable-id':'Paired by exact stable ID. A label or name never pairs two objects; an object with no counterpart is shown absent.','correspondence':'Paired by the recorded cross-project correspondence only. Objects it does not name are never paired, even when their IDs or labels are equal.'};

/** What can be compared on the live project: its variants (only a current one opens), earlier revisions held in this session, and declared environments. Pure. */
export function comparisonChoices(live:Project,versions:Project[]=[]):ComparisonChoices{
 const seen=new Set<number>(),past:ComparisonChoices['versions']=[];
 for(const d of [...versions].reverse())if(d.id===live.id&&d.revision!==live.revision&&!seen.has(d.revision)){seen.add(d.revision);past.push({revision:d.revision,title:d.title});}
 return {variants:(live.variants??[]).map(v=>{const s=variantState(live,v.id);return {id:v.id,title:v.title,viewId:v.viewId,status:s.status,message:s.message};}),
  versions:past,environments:(live.delivery?.environments??[]).map(e=>({id:e.id,label:e.label}))};
}

function environmentSide(doc:Project,componentId:string,environmentId:string,rows:ReturnType<typeof compareEnvironments>[number]['from']):EnvironmentSide{
 const label=doc.delivery?.environments.find(e=>e.id===environmentId)?.label??environmentId;
 const observed=rows.find(r=>r.observed);
 if(observed?.observed)return {state:'reviewed-claim',claim:observed.observed.claim,text:`Declared instance in ${label} · reviewed external claim ${observed.observed.claim} by ${observed.observed.authority} at ${observed.observed.capturedAt}`};
 if(rows.length)return {state:'declared',text:`Declared instance in ${label}${rows.length>1?` (${rows.length} instances)`:''} · declared revision ${rows.map(r=>r.declaredRevision).join(', ')} · no reviewed claim`};
 if(doc.delivery?.applicability?.some(a=>a.componentId===componentId&&a.environmentId===environmentId))return {state:'not-applicable',text:`Declared not applicable in ${label}`};
 return {state:'absent',text:`No declaration in ${label}: absent, not matched to another component`};
}
/** Components paired across two declared environments by componentId, with the declared and evidence differences labelled. Pure. */
export function environmentPairs(doc:Project,from:string,to:string):EnvironmentPair[]{
 if(from===to)throw new Error('Pick two different environments.');
 const env=(id:string)=>doc.delivery?.environments.find(e=>e.id===id)?.label??id,a=env(from),b=env(to);
 return compareEnvironments(doc,from,to).map(row=>{
  const left=environmentSide(doc,row.componentId,from,row.from),right=environmentSide(doc,row.componentId,to,row.to),axes:EnvironmentPair['axes']=[];
  const present=(s:EnvironmentSide)=>s.state==='declared'||s.state==='reviewed-claim';
  if(present(left)!==present(right))axes.push({axis:'architecture',change:present(left)?`DECLARED IN ${a.toUpperCase()} ONLY`:`DECLARED IN ${b.toUpperCase()} ONLY`,text:`${row.component}: ${left.text}; ${right.text}`});
  else if(left.state!==right.state&&(left.state==='not-applicable'||right.state==='not-applicable'))axes.push({axis:'architecture',change:'APPLICABILITY DIFFERS',text:`${row.component}: ${left.text}; ${right.text}`});
  if((left.claim??'')!==(right.claim??''))axes.push({axis:'evidence',change:'REVIEWED CLAIM DIFFERS',text:`${row.component}: ${left.claim?`${left.claim} in ${a}`:`no reviewed claim in ${a}`}, ${right.claim?`${right.claim} in ${b}`:`no reviewed claim in ${b}`}. A claim in one environment says nothing about the other.`});
  return {componentId:row.componentId,label:row.component,left,right,equivalence:row.equivalence,axes};
 });
}

/**
 * Open a frozen comparison on the live project. Throws with the reason when the source cannot be compared (a stale or
 * broken variant, a revision this session no longer holds, a view missing on one side, an undeclared environment).
 * Never mutates the project.
 */
export function openLinkedComparison(live:Project,source:ComparisonSource,options:{viewId:string;versions?:Project[];now?:Date}):LinkedComparison{
 const base={source,projectId:live.id,projectTitle:live.title,revision:live.revision,pairing:'stable-id' as const};
 const now=options.now??new Date();
 if(source.kind==='variant'){
  const state=variantState(live,source.variantId);
  if(state.status!=='current'||!state.candidate)throw new Error(`Cannot compare ${state.variant.title}: ${state.message}`);
  const delta=compareView(live,state.candidate,state.variant.viewId,now,'author');
  return {...base,viewId:state.variant.viewId,title:`Variant ${state.variant.title} against its baseline`,leftLabel:'Baseline',rightLabel:`Variant ${state.variant.title}`,view:{left:live,right:state.candidate,delta}};
 }
 if(source.kind==='version'){
  const earlier=[...(options.versions??[])].reverse().find(d=>d.id===live.id&&d.revision===source.revision);
  if(!earlier)throw new Error(`Revision ${source.revision} is not held in this session any more. Nothing was compared.`);
  if(earlier.revision===live.revision)throw new Error('Pick an earlier revision: this one is the open revision.');
  const viewId=[options.viewId,live.rootViewId].find(id=>earlier.views.some(v=>v.id===id)&&live.views.some(v=>v.id===id));
  if(!viewId)throw new Error(`View ${options.viewId} is not in revision ${earlier.revision}: open a view both revisions show.`);
  const delta=compareView(earlier,live,viewId,now,'author');
  return {...base,viewId,title:`Revision ${earlier.revision} against revision ${live.revision}`,leftLabel:`Revision ${earlier.revision}`,rightLabel:`Revision ${live.revision} (open)`,view:{left:earlier,right:live,delta}};
 }
 if(source.kind==='correspondence')throw new Error('A cross-project comparison needs the other project and its recorded correspondence.');
 const env=(id:string)=>live.delivery?.environments.find(e=>e.id===id);
 const from=env(source.from),to=env(source.to);
 if(!from||!to)throw new Error('Pick two declared environments of this project.');
 return {...base,viewId:options.viewId,title:`${from.label} against ${to.label}`,leftLabel:from.label,rightLabel:to.label,environments:environmentPairs(live,from.id,to.id)};
}

/** Stale when the open project or its revision is no longer the one the comparison read. The frozen pairs are kept; nothing is re-paired. Pure. */
export function comparisonStale(c:LinkedComparison,live:Project):string|null{
 if(live.id!==c.projectId)return `Another project is open. This comparison still shows ${c.projectTitle} as it was opened; nothing was re-paired.`;
 if(live.revision!==c.revision)return `The source changed since this comparison was opened (revision ${c.revision}, now ${live.revision}). The pairs below are still those of revision ${c.revision}; nothing was re-paired. Compare again to read the current source.`;
 return null;
}

/** An explicit, recorded correspondence between objects of two projects. Only the pairs it names are paired. */
export type Correspondence={format:'diagramcloud.correspondence';version:1;leftProjectId:string;rightProjectId:string;recordedBy:string;recordedAt:string;
 views:{left:string;right:string}[];components:{left:string;right:string}[];connections:{left:string;right:string}[]};
const UNPAIRED='unpaired~';
/**
 * Bring the right project into the left project's identity space through a recorded correspondence, for comparison
 * only. Every named pair takes the left ID; every other right ID is moved into a namespace no left ID can use, so an
 * equal ID or label in another project is never taken as the same object. Refuses an unrecorded, ambiguous or dangling
 * correspondence. The result is a comparison input, never a document to save.
 */
export function alignByCorrespondence(left:Project,right:Project,c:Correspondence):Project{
 if(c.format!=='diagramcloud.correspondence'||c.version!==1)throw new Error('Not a diagramcloud.correspondence v1 record.');
 if(c.leftProjectId!==left.id||c.rightProjectId!==right.id)throw new Error(`This correspondence is recorded for ${c.leftProjectId} and ${c.rightProjectId}, not ${left.id} and ${right.id}.`);
 if(!c.recordedBy.trim()||Number.isNaN(Date.parse(c.recordedAt)))throw new Error('A correspondence needs who recorded it and when.');
 const map=(pairs:{left:string;right:string}[],leftIds:string[],rightIds:string[],what:string)=>{const l=new Set(leftIds),r=new Set(rightIds),out=new Map<string,string>(),used=new Set<string>();
  for(const p of pairs){if(!l.has(p.left)||!r.has(p.right))throw new Error(`The ${what} pair ${p.left} ↔ ${p.right} names an object that does not exist.`);
   if(out.has(p.right)||used.has(p.left))throw new Error(`The ${what} pair ${p.left} ↔ ${p.right} is ambiguous: each object pairs at most once.`);out.set(p.right,p.left);used.add(p.left);}
  return (id:string)=>out.get(id)??`${UNPAIRED}${id}`;};
 const node=map(c.components,left.nodes.map(n=>n.id),right.nodes.map(n=>n.id),'component'),edge=map(c.connections,left.edges.map(e=>e.id),right.edges.map(e=>e.id),'connection'),view=map(c.views,left.views.map(v=>v.id),right.views.map(v=>v.id),'view');
 const d=clone(right);
 d.id=left.id;
 d.nodes=d.nodes.map(n=>({...n,id:node(n.id),...(n.childViewId?{childViewId:view(n.childViewId)}:{})}));
 d.edges=d.edges.map(e=>({...e,id:edge(e.id),source:node(e.source),target:node(e.target)}));
 d.views=d.views.map(v=>({...v,id:view(v.id),nodeIds:v.nodeIds.map(node),edgeIds:v.edgeIds.map(edge),positions:Object.fromEntries(Object.entries(v.positions).map(([k,p])=>[node(k),p]))}));
 d.rootViewId=view(d.rootViewId);
 d.observations=d.observations.map(o=>({...o,nodeId:node(o.nodeId)}));
 delete d.variants;
 return d;
}
/** A comparison of one view of two projects through a recorded correspondence. Throws when the view is not paired. */
export function openCorrespondenceComparison(left:Project,right:Project,c:Correspondence,leftViewId:string,now=new Date()):LinkedComparison{
 const aligned=alignByCorrespondence(left,right,c);
 if(!c.views.some(v=>v.left===leftViewId))throw new Error(`View ${leftViewId} has no recorded counterpart in ${right.title}. Nothing was compared.`);
 return {source:{kind:'correspondence',rightProjectId:right.id},projectId:left.id,projectTitle:left.title,revision:left.revision,viewId:leftViewId,pairing:'correspondence',
  title:`${left.title} against ${right.title}`,leftLabel:left.title,rightLabel:right.title,view:{left,right:aligned,delta:compareView(left,aligned,leftViewId,now,'author')}};
}
