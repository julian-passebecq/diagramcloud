import {z} from 'zod';
import {MAX_DOCUMENT_BYTES,validateDocument,type Project,type ProjectNode,type ProjectView,type EvidenceBlock,type TourStop} from '../core/model';
import {canonical,fnv64} from '../core/learningMapping';
import {applyDocumentPatch,type Patch} from '../core/patch';
import {recordStop,newStopId} from '../core/tours';

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,39}$/);
const ref=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
const sentence=z.string().trim().min(1).max(160);
const refs=z.array(ref).max(30).default([]);
const stateRow=z.object({name:sentence,value:z.string().max(1500)}).strict();
/** Authoring input only. The output is an ordinary, revision-guarded Project patch.
 * Steps are presentation order, not a scheduler, UML interaction model or runtime trace.
 */
export const explanationWalkthroughSchema=z.object({
 format:z.literal('diagramcloud.explanation-walkthrough'),version:z.literal(1),
 projectId:ref,baseRevision:z.number().int().nonnegative(),baseFingerprint:z.string().regex(/^[0-9a-f]{16}$/),
 id,title:sentence,question:z.string().trim().min(1).max(1200),sourceIds:refs,
 steps:z.array(z.object({id,title:sentence,viewId:ref,nodeIds:refs,edgeIds:refs,
  narration:z.string().trim().min(1).max(1600),sourceIds:refs,
  provenance:z.enum(['synthetic','reference','source-derived','author']).default('synthetic'),
  /** Explicit prerequisite step IDs. An absent link is unknown, not proof of independence. */
  dependsOn:z.array(id).max(20).default([]),caseLabel:z.string().max(200).optional(),
  before:z.array(stateRow).max(20).default([]),after:z.array(stateRow).max(20).default([]),
  code:z.object({blockId:ref,fromLine:z.number().int().positive(),toLine:z.number().int().positive()}).strict().optional(),
  takeaway:z.string().max(1000).default(''),questions:z.array(z.string().min(1).max(300)).max(8).default([])
 }).strict()).min(1).max(30)
}).strict();
export type ExplanationWalkthrough=z.infer<typeof explanationWalkthroughSchema>;
export const WALKTHROUGH_NOTICE='Authored explanation snapshots. Presentation order is not causal order, elapsed time or a recorded run. No code or API is executed.';
/** Change detector, not a security signature. Preparation binds the full source; native patch tests guard every replaced collection. */
export const walkthroughFingerprint=(doc:Project)=>fnv64(canonical(validateDocument(doc)));
export type WalkthroughResult={patch:Patch;preview:Project;tourId:string;entryNodeId:string;
 steps:{sourceStepId:string;viewId:string;noteNodeId:string;stopId:string}[];notice:typeof WALKTHROUGH_NOTICE};
const unique=(items:string[],what:string)=>{if(new Set(items).size!==items.length)throw new Error(`Duplicate ${what}.`);};

/** Produce private additive content, preserving original entities, code, evidence and story.
 * Use ordinary Preview / Apply / Undo. A copied code excerpt is explicitly frozen at the source cut;
 * subsequent source edits do not turn it into current code. Re-author against a new cut to refresh it.
 * The existing host owns access and publication; this function cannot grant either.
 */
export function prepareExplanationWalkthrough(input:Project,value:unknown):WalkthroughResult{
 const doc=validateDocument(input),r=explanationWalkthroughSchema.parse(value);
 if(r.projectId!==doc.id||r.baseRevision!==doc.revision||r.baseFingerprint!==walkthroughFingerprint(doc))
  throw new Error('Explanation source changed or belongs to another project. Prepare again; nothing was changed.');
 // Native JSON Patch has no absence test. Refuse rather than overwrite a newly added
 // same-revision collection. The source owner initializes/saves Tours, then re-exports.
 if(!Array.isArray(doc.tours))throw new Error('Initialize and save the Tours collection in the source project, then refresh the source fingerprint. No content was changed.');
 unique(r.steps.map(s=>s.id),'step ID');unique(r.sourceIds,'source reference');
 const sourceIds=new Set(doc.sources.map(s=>s.id));
 const checkSources=(ids:string[])=>{unique(ids,'source reference');if(ids.some(x=>!sourceIds.has(x)))throw new Error('Unknown explanation source reference.');};
 checkSources(r.sourceIds);
 const prefix=`walk-${r.id}`,entryId=prefix,indexId=`${prefix}.index`;
 const producedIds=new Set([entryId,indexId]);
 const originalIds=new Set([...doc.nodes,...doc.edges,...doc.views,...doc.blocks,...(doc.tours??[])].map(x=>x.id));
 const fresh=(s:string)=>{if(s.length>80||originalIds.has(s)||producedIds.has(s))throw new Error('Explanation ID collision; choose a new walkthrough ID.');producedIds.add(s);return s;};
 if(originalIds.has(entryId)||originalIds.has(indexId))throw new Error('Explanation already exists; choose a new ID instead of replacing authored work.');
 const nodes:ProjectNode[]=[],blocks:EvidenceBlock[]=[],views:ProjectView[]=[];
 const map:WalkthroughResult['steps']=[],seenSteps=new Set<string>();
 const block=(b:EvidenceBlock)=>{blocks.push(b);return b.id;};
 const makeNote=(nodeId:string,label:string,blockIds:string[],refs:string[],childViewId?:string):ProjectNode=>({
  id:nodeId,label,kind:'control',provider:'Generic',icon:'generic-document',summary:'Authored explanation at a fixed source cut; not an observed result.',
  role:`${doc.id}@revision ${doc.revision}; source fingerprint ${r.baseFingerprint}. ${WALKTHROUGH_NOTICE}`,
  status:'idle',tags:['explanation-snapshot'],basis:'planned',visibility:'private',blockIds,sourceIds:refs,...(childViewId?{childViewId}:{})
 });
 const intro=fresh(`${prefix}.intro`);
 block({id:intro,title:r.title,type:'text',text:`Question: ${r.question}\n\n${WALKTHROUGH_NOTICE}\nSource: ${doc.id} revision ${doc.revision}; fingerprint ${r.baseFingerprint}.\n\nThis private addition changes no existing feature, deployment, approval or observation.`,visibility:'private',sourceIds:r.sourceIds,provenance:'author'});
 nodes.push(makeNote(entryId,r.title,[intro],r.sourceIds,indexId));
 for(const step of r.steps){
  checkSources(step.sourceIds);unique(step.nodeIds,'step component');unique(step.edgeIds,'step connection');unique(step.dependsOn,'step prerequisite');
  if(step.dependsOn.some(d=>!seenSteps.has(d)))throw new Error('Step prerequisite is missing, forward or cyclic; order the authored presentation explicitly.');
  seenSteps.add(step.id);
  const sourceView=doc.views.find(v=>v.id===step.viewId);if(!sourceView)throw new Error('Unknown explanation view.');
  if(step.nodeIds.some(id=>!sourceView.nodeIds.includes(id))||step.edgeIds.some(id=>!sourceView.edgeIds.includes(id)))throw new Error('Explanation subjects are outside the selected view.');
  if(!step.nodeIds.length&&!step.edgeIds.length)throw new Error('An explanation step needs an explicit subject.');
  const edges=doc.edges.filter(e=>step.edgeIds.includes(e.id));
  const ids=[...new Set([...step.nodeIds,...edges.flatMap(e=>[e.source,e.target])])];
  if(ids.length+step.edgeIds.length+1>20)throw new Error('A step exceeds the native 20-subject anchor limit; split it explicitly.');
  // No duplicate actor for each call: frame membership changes, canonical participant IDs do not.
  const viewId=fresh(`${prefix}.${step.id}.view`),noteId=fresh(`${prefix}.${step.id}.note`),navId=fresh(`${prefix}.${step.id}.entry`);
  const refs=[...new Set([...r.sourceIds,...step.sourceIds])],owned:string[]=[];
  const base={visibility:'private' as const,sourceIds:refs,provenance:step.provenance};
  if(step.provenance!=='synthetic'&&!refs.length)throw new Error('A nonsynthetic explanation needs an explicit source reference.');
  owned.push(block({...base,id:fresh(`${prefix}.${step.id}.text`),title:step.title,type:'text',text:[
   step.narration,step.caseLabel?`Selected case: ${step.caseLabel}`:'',
   step.dependsOn.length?`Explicit prerequisites: ${step.dependsOn.join(', ')}.`:'Causal prerequisites not supplied; this is presentation order only.',
   step.takeaway?`Takeaway: ${step.takeaway}`:'',...step.questions.map(q=>`Question to explore: ${q}`),
   `Snapshot of ${doc.id} revision ${doc.revision}. ${WALKTHROUGH_NOTICE}`
  ].filter(Boolean).join('\n\n')}));
  for(const phase of ['before','after'] as const)if(step[phase].length){
   unique(step[phase].map(s=>s.name),`${phase} state field`);
   owned.push(block({...base,id:fresh(`${prefix}.${step.id}.${phase}`),title:`${phase==='before'?'Before':'After'} - ${step.title}`.slice(0,160),type:'table',columns:['State field','Declared value'],rows:step[phase].map(x=>[x.name,x.value]),transform:phase==='before'?'input':'output'}));
  }
  if(step.code){
   const attached=new Set(doc.nodes.filter(n=>ids.includes(n.id)).flatMap(n=>n.blockIds));
   const code=doc.blocks.find(b=>b.id===step.code!.blockId);
   if(!attached.has(step.code.blockId)||code?.type!=='code')throw new Error('Code focus must name a code block attached to the selected subjects.');
   const lines=code.code.split(/\r?\n/);if(step.code.fromLine>step.code.toLine||step.code.toLine>lines.length)throw new Error('Code focus is outside its exact source block.');
   const excerpt=lines.slice(step.code.fromLine-1,step.code.toLine).join('\n');
   const provenance=step.provenance==='synthetic'||code.provenance==='synthetic'?'synthetic':code.provenance;
   owned.push(block({...base,id:fresh(`${prefix}.${step.id}.code`),title:`${code.title} : ${step.code.fromLine}-${step.code.toLine}`.slice(0,160),type:'code',language:code.language,code:excerpt,provenance,sourceIds:[...new Set([...refs,...code.sourceIds])],transform:'logic'}));
   owned.push(block({...base,id:fresh(`${prefix}.${step.id}.locator`),title:'Code excerpt source cut',type:'text',provenance,text:`${doc.id} revision ${doc.revision}, block ${code.id}, lines ${step.code.fromLine}-${step.code.toLine}, content fingerprint ${fnv64(code.code)}. Frozen excerpt, not live code. Display-only; no execution.`}));
  }
  nodes.push(makeNote(noteId,step.title,owned,refs),makeNote(navId,step.title,[],refs,viewId));
  const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:(i%3)*310,y:Math.floor(i/3)*150}]));
  positions[noteId]={x:0,y:Math.ceil(ids.length/3)*150+30};
  views.push({id:viewId,title:step.title,description:WALKTHROUGH_NOTICE,nodeIds:[...ids,noteId],edgeIds:step.edgeIds,positions,visibility:'private',perspective:step.code?'code':sourceView.perspective??'system',design:{type:'architecture',focal:[noteId]}});
  map.push({sourceStepId:step.id,viewId,noteNodeId:noteId,stopId:''});
 }
 const navs=nodes.filter(n=>n.id.endsWith('.entry'));
 views.unshift({id:indexId,title:`Walkthrough: ${r.title}`.slice(0,160),description:`${r.question}\n${WALKTHROUGH_NOTICE}`,nodeIds:navs.map(n=>n.id),edgeIds:[],positions:Object.fromEntries(navs.map((n,i)=>[n.id,{x:(i%3)*310,y:Math.floor(i/3)*150}])),visibility:'private',perspective:'evidence',design:{type:'architecture',focal:[]}});
 const root=doc.views.find(v=>v.id===doc.rootViewId)!;
 const draft=validateDocument({...doc,nodes:[...doc.nodes,...nodes],blocks:[...doc.blocks,...blocks],views:doc.views.map(v=>v.id===root.id?{...v,nodeIds:[...v.nodeIds,entryId],positions:{...v.positions,[entryId]:{x:0,y:-300}}}:v).concat(views)});
 const stops:TourStop[]=[];
 for(const item of map){const source=r.steps.find(s=>s.id===item.sourceStepId)!;
  const frame=views.find(v=>v.id===item.viewId)!;
  const subjects=[...frame.nodeIds.map(id=>({kind:'node' as const,id})),...source.edgeIds.map(id=>({kind:'edge' as const,id}))];
  const stop=recordStop(draft,item.viewId,subjects,source.narration);stop.id=newStopId(stops,stop);stops.push(stop);item.stopId=stop.id;
 }
 const tourId=fresh(`${prefix}.tour`);
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:`Add private explanation: ${r.title}`.slice(0,500),operations:[
  // A revision number alone cannot protect a same-revision changed imported document.
  ...(['nodes','edges','views','blocks','sources','tours'] as const).filter(k=>doc[k]!==undefined).map(k=>({op:'test' as const,path:`/${k}`,value:doc[k]})),
  {op:'replace',path:'/nodes',value:draft.nodes},{op:'replace',path:'/blocks',value:draft.blocks},{op:'replace',path:'/views',value:draft.views},
  {op:'add',path:'/tours/-',value:{id:tourId,title:r.title,sourceRevision:doc.revision,stops,visibility:'private'}}
 ]};
 if(new TextEncoder().encode(JSON.stringify(patch)).length>MAX_DOCUMENT_BYTES)throw new Error('Explanation patch exceeds native import size; split the selected source or steps.');
 const preview=applyDocumentPatch(doc,patch).result;
 return {patch,preview,tourId,entryNodeId:entryId,steps:map,notice:WALKTHROUGH_NOTICE};
}
