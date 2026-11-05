import {z} from 'zod';
import {MAX_DOCUMENT_BYTES,errorMessage,validateDocument,nodeSchema,blockSchema,viewSchema,type Project,type ProjectNode,type ProjectView,type EvidenceBlock,type TourStop,type Tour} from '../core/model';
import {canonical,fnv64} from '../core/learningMapping';
import {applyDocumentPatch,type Patch} from '../core/patch';
import {recordStop,newStopId} from '../core/tours';
import {EXPLANATION_DETAILS_COLUMNS,explanationDetailsRows,readExplanationDetails} from '../core/explanationDetails';
import {isAnswerBlock} from '../core/questionAnswers';

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,39}$/);
const ref=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
const sentence=z.string().trim().min(1).max(160);
const refs=z.array(ref).max(30).default([]);
const stateRow=z.object({name:sentence,value:z.string().max(1500)}).strict();
const STEP_PROVENANCES=['synthetic','reference','source-derived','author'] as const;
/** Authoring input only. The output is an ordinary, revision-guarded Project patch.
 * Steps are presentation order, not a scheduler, UML interaction model or runtime trace.
 */
export const explanationWalkthroughSchema=z.object({
 format:z.literal('diagramcloud.explanation-walkthrough'),version:z.literal(1),
 projectId:ref,baseRevision:z.number().int().nonnegative(),baseFingerprint:z.string().regex(/^[0-9a-f]{16}$/),
 id,title:sentence,question:z.string().trim().min(1).max(1200),sourceIds:refs,
 steps:z.array(z.object({id,title:sentence,viewId:ref,nodeIds:refs,edgeIds:refs,
  narration:z.string().trim().min(1).max(1600),sourceIds:refs,
  provenance:z.enum(STEP_PROVENANCES).default('synthetic'),
  /** Explicit prerequisite step IDs. An absent link is unknown, not proof of independence. */
  dependsOn:z.array(id).max(20).default([]),caseLabel:z.string().trim().max(200).transform(value=>value||undefined).optional(),
  before:z.array(stateRow).max(20).default([]),after:z.array(stateRow).max(20).default([]),
  code:z.object({blockId:ref,fromLine:z.number().int().positive(),toLine:z.number().int().positive()}).strict().optional(),
  takeaway:z.string().max(1000).default(''),questions:z.array(z.string().trim().min(1).max(300)).max(8).default([])
 }).strict()).min(1).max(30)
}).strict();
export type ExplanationWalkthrough=z.infer<typeof explanationWalkthroughSchema>;
type Step=ExplanationWalkthrough['steps'][number];
export const WALKTHROUGH_NOTICE='Authored explanation snapshots. Presentation order is not causal order, elapsed time or a recorded run. No code or API is executed.';
/** Change detector, not a security signature. Preparation binds the full source; native patch tests guard every replaced collection. */
export const walkthroughFingerprint=(doc:Project)=>fnv64(canonical(validateDocument(doc)));
/** What a revision or removal does besides replacing the walkthrough's own generated content. Shown in the review. */
export type RevisionEffects={kind:'revise'|'remove';keptSteps:string[];addedSteps:string[];droppedSteps:string[];
 /** Saved answers that stay attached to a kept step. Their question source changed, so they read stale; nothing is rebound. */
 staleAnswerIds:string[];
 /** Saved answers attached only to a removed step's note. They go with it; one Undo restores them. */
 removedAnswerIds:string[];
 /** Story steps that point into removed explanation views or notes. */
 removedStorySteps:string[];
 /** Generated items whose public visibility (an explicit author choice) is kept. New items are private. */
 publicItemIds:string[]};
export type WalkthroughResult={patch:Patch;preview:Project;tourId:string;entryNodeId:string;
 steps:{sourceStepId:string;viewId:string;noteNodeId:string;stopId:string}[];notice:typeof WALKTHROUGH_NOTICE;effects?:RevisionEffects};
export type WalkthroughRemoval={patch:Patch;preview:Project;tourId:string;entryNodeId:string;notice:typeof WALKTHROUGH_NOTICE;effects:RevisionEffects};
const unique=(items:string[],what:string)=>{if(new Set(items).size!==items.length)throw new Error(`Duplicate ${what}.`);};

/** Facts a step reads from its source. Preparation reads them from the project; the reverse reader reads the recorded copies. */
type CodeFacts={id:string;title:string;language:string;excerpt:string;provenance:EvidenceBlock['provenance'];sourceIds:string[];contentFingerprint:string};
type StepFacts={participants:string[];perspective:ProjectView['perspective'];code?:CodeFacts};
type Cut={projectId:string;revision:number;fingerprint:string};
type Rendered={entryId:string;indexId:string;tourId:string;nodes:ProjectNode[];blocks:EvidenceBlock[];views:ProjectView[];
 frames:{stepId:string;viewId:string;noteId:string;subjects:{kind:'node'|'edge';id:string}[];narration:string}[]};

/** Source-dependent checks and facts. Throws on anything the request cannot bind exactly. */
function sourceFacts(doc:Project,r:ExplanationWalkthrough,ignoreViews:Set<string>=new Set()):StepFacts[]{
 const sourceIds=new Set(doc.sources.map(s=>s.id));
 const checkSources=(ids:string[])=>{unique(ids,'source reference');if(ids.some(x=>!sourceIds.has(x)))throw new Error('Unknown explanation source reference.');};
 checkSources(r.sourceIds);
 return r.steps.map(step=>{
  checkSources(step.sourceIds);unique(step.nodeIds,'step component');unique(step.edgeIds,'step connection');
  const sourceView=doc.views.find(v=>v.id===step.viewId&&!ignoreViews.has(v.id));if(!sourceView)throw new Error('Unknown explanation view.');
  if(step.nodeIds.some(id=>!sourceView.nodeIds.includes(id))||step.edgeIds.some(id=>!sourceView.edgeIds.includes(id)))throw new Error('Explanation subjects are outside the selected view.');
  if(!step.nodeIds.length&&!step.edgeIds.length)throw new Error('An explanation step needs an explicit subject.');
  const edges=doc.edges.filter(e=>step.edgeIds.includes(e.id));
  const participants=[...new Set([...step.nodeIds,...edges.flatMap(e=>[e.source,e.target])])];
  let code:CodeFacts|undefined;
  if(step.code){
   const attached=new Set(doc.nodes.filter(n=>participants.includes(n.id)).flatMap(n=>n.blockIds));
   const block=doc.blocks.find(b=>b.id===step.code!.blockId);
   if(!attached.has(step.code.blockId)||block?.type!=='code')throw new Error('Code focus must name a code block attached to the selected subjects.');
   const lines=block.code.split(/\r?\n/);if(step.code.fromLine>step.code.toLine||step.code.toLine>lines.length)throw new Error('Code focus is outside its exact source block.');
   code={id:block.id,title:`${block.title} : ${step.code.fromLine}-${step.code.toLine}`.slice(0,160),language:block.language,excerpt:lines.slice(step.code.fromLine-1,step.code.toLine).join('\n'),
    provenance:block.provenance,sourceIds:block.sourceIds,contentFingerprint:fnv64(block.code)};
  }
  return {participants,perspective:sourceView.perspective,code};
 });
}

/** Pure rendering of a request at a source cut. The same function serves preparation and the reverse reader's check. */
function renderWalkthrough(r:ExplanationWalkthrough,cut:Cut,facts:StepFacts[],occupied:Set<string>):Rendered{
 unique(r.steps.map(s=>s.id),'step ID');unique(r.sourceIds,'source reference');
 const prefix=`walk-${r.id}`,entryId=prefix,indexId=`${prefix}.index`;
 const producedIds=new Set([entryId,indexId]);
 const fresh=(s:string)=>{if(s.length>80||occupied.has(s)||producedIds.has(s))throw new Error('Explanation ID collision; choose a new walkthrough ID.');producedIds.add(s);return s;};
 const nodes:ProjectNode[]=[],blocks:EvidenceBlock[]=[],views:ProjectView[]=[];
 const frames:Rendered['frames']=[],seenSteps=new Set<string>();
 const block=(b:EvidenceBlock)=>{blocks.push(b);return b.id;};
 const makeNote=(nodeId:string,label:string,blockIds:string[],refs:string[],childViewId?:string):ProjectNode=>({
  id:nodeId,label,kind:'control',provider:'Generic',icon:'generic-document',summary:'Authored explanation at a fixed source cut; not an observed result.',
  role:`${cut.projectId}@revision ${cut.revision}; source fingerprint ${cut.fingerprint}. ${WALKTHROUGH_NOTICE}`,
  status:'idle',tags:['explanation-snapshot'],basis:'planned',visibility:'private',blockIds,sourceIds:refs,...(childViewId?{childViewId}:{})
 }) as ProjectNode;
 const intro=fresh(`${prefix}.intro`);
 block({id:intro,title:r.title,type:'text',text:`Question: ${r.question}\n\n${WALKTHROUGH_NOTICE}\nSource: ${cut.projectId} revision ${cut.revision}; fingerprint ${cut.fingerprint}.\n\nThis private addition changes no existing feature, deployment, approval or observation.`,visibility:'private',sourceIds:r.sourceIds,provenance:'author'} as EvidenceBlock);
 nodes.push(makeNote(entryId,r.title,[intro],r.sourceIds,indexId));
 r.steps.forEach((step,i)=>{const fact=facts[i];
  unique(step.dependsOn,'step prerequisite');
  if(step.dependsOn.some(d=>!seenSteps.has(d)))throw new Error('Step prerequisite is missing, forward or cyclic; order the authored presentation explicitly.');
  seenSteps.add(step.id);
  const ids=fact.participants;
  if(ids.length+step.edgeIds.length+1>20)throw new Error('A step exceeds the native 20-subject anchor limit; split it explicitly.');
  // No duplicate actor for each call: frame membership changes, canonical participant IDs do not.
  const viewId=fresh(`${prefix}.${step.id}.view`),noteId=fresh(`${prefix}.${step.id}.note`),navId=fresh(`${prefix}.${step.id}.entry`);
  const refs=[...new Set([...r.sourceIds,...step.sourceIds])],owned:string[]=[];
  const base={visibility:'private' as const,sourceIds:refs,provenance:step.provenance};
  if(step.provenance!=='synthetic'&&!refs.length)throw new Error('A nonsynthetic explanation needs an explicit source reference.');
  owned.push(block({...base,id:fresh(`${prefix}.${step.id}.contract`),title:'Authored explanation details',type:'table',columns:EXPLANATION_DETAILS_COLUMNS,
   rows:explanationDetailsRows({focusQuestion:r.question,sourceCut:`${cut.projectId} revision ${cut.revision}`,caseLabel:step.caseLabel,
    prerequisites:step.dependsOn.map(id=>`${id} · ${r.steps.find(s=>s.id===id)!.title}`),questions:step.questions})} as EvidenceBlock));
  owned.push(block({...base,id:fresh(`${prefix}.${step.id}.text`),title:step.title,type:'text',text:[
   step.narration,step.caseLabel?`Selected case: ${step.caseLabel}`:'',
   step.dependsOn.length?`Explicit prerequisites: ${step.dependsOn.join(', ')}.`:'Causal prerequisites not supplied; this is presentation order only.',
   step.takeaway?`Takeaway: ${step.takeaway}`:'',...step.questions.map(q=>`Question to explore: ${q}`),
   `Snapshot of ${cut.projectId} revision ${cut.revision}. ${WALKTHROUGH_NOTICE}`
  ].filter(Boolean).join('\n\n')} as EvidenceBlock));
  for(const phase of ['before','after'] as const)if(step[phase].length){
   unique(step[phase].map(s=>s.name),`${phase} state field`);
   owned.push(block({...base,id:fresh(`${prefix}.${step.id}.${phase}`),title:`${phase==='before'?'Before':'After'} - ${step.title}`.slice(0,160),type:'table',columns:['State field','Declared value'],rows:step[phase].map(x=>[x.name,x.value]),transform:phase==='before'?'input':'output'} as EvidenceBlock));
  }
  if(step.code){
   const code=fact.code;if(!code||code.id!==step.code.blockId)throw new Error('Code focus must name a code block attached to the selected subjects.');
   const provenance=step.provenance==='synthetic'||code.provenance==='synthetic'?'synthetic':code.provenance;
   owned.push(block({...base,id:fresh(`${prefix}.${step.id}.code`),title:code.title,type:'code',language:code.language,code:code.excerpt,provenance,sourceIds:[...new Set([...refs,...code.sourceIds])],transform:'logic'} as EvidenceBlock));
   owned.push(block({...base,id:fresh(`${prefix}.${step.id}.locator`),title:'Code excerpt source cut',type:'text',provenance,text:`${cut.projectId} revision ${cut.revision}, block ${code.id}, lines ${step.code.fromLine}-${step.code.toLine}, content fingerprint ${code.contentFingerprint}. Frozen excerpt, not live code. Display-only; no execution.`} as EvidenceBlock));
  }
  nodes.push(makeNote(noteId,step.title,owned,refs),makeNote(navId,step.title,[],refs,viewId));
  const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:(i%3)*310,y:Math.floor(i/3)*150}]));
  positions[noteId]={x:0,y:Math.ceil(ids.length/3)*150+30};
  views.push({id:viewId,title:step.title,description:WALKTHROUGH_NOTICE,nodeIds:[...ids,noteId],edgeIds:step.edgeIds,positions,visibility:'private',perspective:step.code?'code':fact.perspective??'system',design:{type:'architecture',focal:[noteId]}} as ProjectView);
  frames.push({stepId:step.id,viewId,noteId,subjects:[...[...ids,noteId].map(id=>({kind:'node' as const,id})),...step.edgeIds.map(id=>({kind:'edge' as const,id}))],narration:step.narration});
 });
 const navs=nodes.filter(n=>n.id.endsWith('.entry'));
 views.unshift({id:indexId,title:`Walkthrough: ${r.title}`.slice(0,160),description:`${r.question}\n${WALKTHROUGH_NOTICE}`,nodeIds:navs.map(n=>n.id),edgeIds:[],positions:Object.fromEntries(navs.map((n,i)=>[n.id,{x:(i%3)*310,y:Math.floor(i/3)*150}])),visibility:'private',perspective:'evidence',design:{type:'architecture',focal:[]}} as ProjectView);
 return {entryId,indexId,tourId:fresh(`${prefix}.tour`),nodes,blocks,views,frames};
}

const sourceCheck=(doc:Project,r:ExplanationWalkthrough)=>{
 if(r.projectId!==doc.id||r.baseRevision!==doc.revision||r.baseFingerprint!==walkthroughFingerprint(doc))
  throw new Error('Explanation source changed or belongs to another project. Prepare again; nothing was changed.');
};
const guardedCollections=['nodes','edges','views','blocks','sources','tours','story'] as const;
function guardedPatch(doc:Project,summary:string,next:Project,keys:readonly ('nodes'|'blocks'|'views'|'tours'|'story')[]):Patch{
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:summary.slice(0,500),operations:[
  // A revision number alone cannot protect a same-revision changed imported document.
  ...guardedCollections.filter(k=>doc[k]!==undefined).map(k=>({op:'test' as const,path:`/${k}`,value:doc[k]})),
  ...keys.filter(k=>canonical(doc[k])!==canonical(next[k])).map(k=>({op:'replace' as const,path:`/${k}`,value:next[k]}))]};
 if(new TextEncoder().encode(JSON.stringify(patch)).length>MAX_DOCUMENT_BYTES)throw new Error('Explanation patch exceeds native import size; split the selected source or steps.');
 return patch;
}

/** Produce private additive content, preserving original entities, code, evidence and story.
 * Use ordinary Preview / Apply / Undo. A copied code excerpt is explicitly frozen at the source cut;
 * subsequent source edits do not turn it into current code. Re-author against a new cut to refresh it.
 * The existing host owns access and publication; this function cannot grant either.
 */
export function prepareExplanationWalkthrough(input:Project,value:unknown):WalkthroughResult{
 const doc=validateDocument(input),r=explanationWalkthroughSchema.parse(value);
 sourceCheck(doc,r);
 // Native JSON Patch has no absence test. Refuse rather than overwrite a newly added
 // same-revision collection. The source owner initializes/saves Tours, then re-exports.
 if(!Array.isArray(doc.tours))throw new Error('Initialize and save the Tours collection in the source project, then refresh the source fingerprint. No content was changed.');
 unique(r.steps.map(s=>s.id),'step ID');unique(r.sourceIds,'source reference');
 const facts=sourceFacts(doc,r);
 const prefix=`walk-${r.id}`;
 const occupied=new Set([...doc.nodes,...doc.edges,...doc.views,...doc.blocks,...(doc.tours??[])].map(x=>x.id));
 if(occupied.has(prefix)||occupied.has(`${prefix}.index`))throw new Error('Explanation already exists; choose a new ID instead of replacing authored work.');
 const g=renderWalkthrough(r,{projectId:doc.id,revision:doc.revision,fingerprint:r.baseFingerprint},facts,occupied);
 const root=doc.views.find(v=>v.id===doc.rootViewId)!;
 const draft=validateDocument({...doc,nodes:[...doc.nodes,...g.nodes],blocks:[...doc.blocks,...g.blocks],views:doc.views.map(v=>v.id===root.id?{...v,nodeIds:[...v.nodeIds,g.entryId],positions:{...v.positions,[g.entryId]:{x:0,y:-300}}}:v).concat(g.views)});
 const stops:TourStop[]=[],steps:WalkthroughResult['steps']=[];
 for(const frame of g.frames){const stop=recordStop(draft,frame.viewId,frame.subjects,frame.narration);stop.id=newStopId(stops,stop);stops.push(stop);
  steps.push({sourceStepId:frame.stepId,viewId:frame.viewId,noteNodeId:frame.noteId,stopId:stop.id});}
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:`Add private explanation: ${r.title}`.slice(0,500),operations:[
  // A revision number alone cannot protect a same-revision changed imported document.
  ...(['nodes','edges','views','blocks','sources','tours'] as const).filter(k=>doc[k]!==undefined).map(k=>({op:'test' as const,path:`/${k}`,value:doc[k]})),
  {op:'replace',path:'/nodes',value:draft.nodes},{op:'replace',path:'/blocks',value:draft.blocks},{op:'replace',path:'/views',value:draft.views},
  {op:'add',path:'/tours/-',value:{id:g.tourId,title:r.title,sourceRevision:doc.revision,stops,visibility:'private'}}
 ]};
 if(new TextEncoder().encode(JSON.stringify(patch)).length>MAX_DOCUMENT_BYTES)throw new Error('Explanation patch exceeds native import size; split the selected source or steps.');
 const preview=applyDocumentPatch(doc,patch).result;
 return {patch,preview,tourId:g.tourId,entryNodeId:g.entryId,steps,notice:WALKTHROUGH_NOTICE};
}

/* ---------------- Reverse reading, revision and removal ---------------- */

/** Refusal of the reverse reader. Nothing is guessed, repaired or changed. */
export class ExplanationRevisionError extends Error{}
const refuse=(message:string):never=>{throw new ExplanationRevisionError(message);};
const WALK_TOUR=/^walk-([a-z][a-z0-9_.-]{0,39})\.tour$/;
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export type ExistingExplanation={
 /** The request rebuilt from the recorded content, bound to its original cut. Step subjects are the frame's explicit participants. */
 request:ExplanationWalkthrough;cut:Cut;tourId:string;
 generated:{nodeIds:Set<string>;blockIds:Set<string>;viewIds:Set<string>};
 /** Saved answer block IDs attached to each generated note node. */
 answers:Map<string,string[]>};
export type ExplanationListing={id:string;tourId:string;title:string;state:'available'|'unavailable';notice:string};

const stripVisibility=<T extends {visibility?:unknown}>(x:T)=>{const {visibility:_,...rest}=x;return rest;};
/** Both sides through the same schema, so defaults never read as an edit. */
const sameNode=(a:unknown,b:unknown)=>canonical(stripVisibility(nodeSchema.parse(a)))===canonical(stripVisibility(nodeSchema.parse(b)));
const sameBlock=(a:unknown,b:unknown)=>canonical(stripVisibility(blockSchema.parse(a)))===canonical(stripVisibility(blockSchema.parse(b)));
const sameView=(a:unknown,b:unknown)=>{const {positions:_a,...x}=stripVisibility(viewSchema.parse(a)),{positions:_b,...y}=stripVisibility(viewSchema.parse(b));return canonical(x)===canonical(y);};

/**
 * Rebuild an applied walkthrough's request from its tour, notes and `explanation-details/1` blocks, then render that
 * request at the recorded cut and compare it with every recorded copy. A copy that differs (an edited narration, a
 * reordered or re-narrated stop, an added card or block) is refused, never chosen: the reader cannot tell which copy the
 * author meant. Visibility and card positions are author choices outside the request and are not compared.
 */
export function readExplanationWalkthrough(input:Project,walkthroughId:string):ExistingExplanation{
 const doc=validateDocument(input);
 if(!id.safeParse(walkthroughId).success)refuse('Unsupported explanation ID. Nothing was changed.');
 const prefix=`walk-${walkthroughId}`,tourId=`${prefix}.tour`;
 const tour=(doc.tours??[]).find(t=>t.id===tourId)??refuse('This explanation tour is no longer in the project. Nothing was changed.');
 const node=(nodeId:string)=>doc.nodes.find(n=>n.id===nodeId);const blockOf=(blockId:string)=>doc.blocks.find(b=>b.id===blockId);
 const entry=node(prefix)??refuse('The explanation entry card is missing, so its source cut cannot be read. Nothing was changed.');
 const cutMatch=new RegExp(`^${escape(doc.id)}@revision (\\d+); source fingerprint ([0-9a-f]{16})\\. ${escape(WALKTHROUGH_NOTICE)}$`).exec(entry.role??'');
 if(!cutMatch)refuse('The explanation entry no longer records its source cut. The request cannot be reconstructed; nothing was changed.');
 const cut:Cut={projectId:doc.id,revision:Number(cutMatch![1]),fingerprint:cutMatch![2]};
 const intro=blockOf(`${prefix}.intro`);
 const introText=intro?.type==='text'?intro.text:'',marker=`\n\n${WALKTHROUGH_NOTICE}\nSource: `;
 if(!introText.startsWith('Question: ')||!introText.includes(marker))refuse('The explanation question record is missing or edited. The request cannot be reconstructed; nothing was changed.');
 const question=introText.slice('Question: '.length,introText.lastIndexOf(marker));
 const generatedViews=new Set(doc.views.filter(v=>v.id===`${prefix}.index`||v.id.startsWith(`${prefix}.`)).map(v=>v.id));
 const steps:Step[]=[],facts:StepFacts[]=[];
 for(const [i,stop] of tour.stops.entries()){
  const where=`Stop ${i+1}`;
  if(stop.omitted||!stop.viewId||!stop.viewId.startsWith(`${prefix}.`)||!stop.viewId.endsWith('.view'))refuse(`${where} of this explanation tour is not a generated explanation frame. Nothing was changed.`);
  const stepId=stop.viewId!.slice(prefix.length+1,-'.view'.length);
  if(!id.safeParse(stepId).success)refuse(`${where} names an unsupported step. Nothing was changed.`);
  const frame=doc.views.find(v=>v.id===stop.viewId)??refuse(`${where}: its explanation frame is missing. Nothing was changed.`);
  const note=node(`${prefix}.${stepId}.note`)??refuse(`Step ${stepId}: its explanation note is missing. Nothing was changed.`);
  const contract=blockOf(`${prefix}.${stepId}.contract`),text=blockOf(`${prefix}.${stepId}.text`);
  const details=contract?readExplanationDetails([contract]):null;
  if(!contract||details?.state!=='available')refuse(`Step ${stepId}: its explanation details record is missing or unsupported. The request cannot be reconstructed; nothing was changed.`);
  if(details!.state!=='available')throw new Error('unreachable');
  const provenance=STEP_PROVENANCES.find(p=>p===contract!.provenance)??refuse(`Step ${stepId}: unsupported evidence basis. Nothing was changed.`);
  const participants=frame.nodeIds.filter(x=>x!==note.id);
  // The request does not record its source view. Only one candidate is accepted; several or none are refused.
  const perspective=frame.perspective;
  const codeLocator=blockOf(`${prefix}.${stepId}.locator`),codeExcerpt=blockOf(`${prefix}.${stepId}.code`);
  const candidates=doc.views.filter(v=>!generatedViews.has(v.id)&&frame.edgeIds.every(e=>v.edgeIds.includes(e))&&participants.every(n=>v.nodeIds.includes(n))&&(codeExcerpt||(v.perspective??'system')===perspective));
  if(candidates.length!==1)refuse(`Step ${stepId}: ${candidates.length?`${candidates.length} views`:'no view'} of the project hold${candidates.length===1?'s':''} its subjects, so its source view cannot be determined. Nothing was guessed or changed.`);
  const details2=details!.details;
  const prerequisites=details2.prerequisites.map(p=>{const at=p.indexOf(' · ');return at>0?p.slice(0,at):refuse(`Step ${stepId}: unreadable prerequisite. Nothing was changed.`);});
  const table=(phase:'before'|'after')=>{const b=blockOf(`${prefix}.${stepId}.${phase}`);if(!b)return [];if(b.type!=='table')return refuse(`Step ${stepId}: its ${phase} state record is not a table. Nothing was changed.`);return b.rows.map(row=>({name:String(row[0]??''),value:String(row[1]??'')}));};
  let code:Step['code'],codeFacts:CodeFacts|undefined;
  if(codeLocator||codeExcerpt){
   const m=codeLocator?.type==='text'?new RegExp(`^${escape(doc.id)} revision \\d+, block ([a-z][a-z0-9_.-]{0,79}), lines (\\d+)-(\\d+), content fingerprint ([0-9a-f]{16})\\. `).exec(codeLocator.text):null;
   if(!m||codeExcerpt?.type!=='code')refuse(`Step ${stepId}: its frozen code excerpt or source locator is missing or edited. Nothing was changed.`);
   if(codeExcerpt!.type!=='code')throw new Error('unreachable');
   code={blockId:m![1],fromLine:Number(m![2]),toLine:Number(m![3])};
   // While the cited block still has its recorded content, the excerpt is re-derived from it, so an edited excerpt is caught.
   // After the cited code changed, the frozen copy is the only record of those lines and is read as recorded.
   const cited=blockOf(code.blockId),lines=cited?.type==='code'&&fnv64(cited.code)===m![4]?cited.code.split(/\r?\n/):null;
   const excerpt=lines&&code.toLine<=lines.length&&code.fromLine<=code.toLine?lines.slice(code.fromLine-1,code.toLine).join('\n'):codeExcerpt!.code;
   codeFacts={id:m![1],title:codeExcerpt!.title,language:codeExcerpt!.language,excerpt,provenance:codeExcerpt!.provenance,sourceIds:codeExcerpt!.sourceIds,contentFingerprint:m![4]};
  }
  // The text block carries narration, case, prerequisites, takeaway and questions; only the takeaway lives nowhere else.
  const narration=stop.narration;
  const head=[narration,details2.caseLabel?`Selected case: ${details2.caseLabel}`:'',prerequisites.length?`Explicit prerequisites: ${prerequisites.join(', ')}.`:'Causal prerequisites not supplied; this is presentation order only.'].filter(Boolean).join('\n\n')+'\n\n';
  const tail=[...details2.questions.map(q=>`Question to explore: ${q}`),`Snapshot of ${doc.id} revision ${cut.revision}. ${WALKTHROUGH_NOTICE}`].join('\n\n');
  const body=text?.type==='text'?text.text:'';
  if(!body.startsWith(head)||!body.endsWith(tail)||body.length<head.length+tail.length)refuse(`Step ${stepId}: its narration copies disagree (tour stop and explanation text). The request cannot be reconstructed without choosing one; nothing was changed.`);
  const middle=body.slice(head.length,body.length-tail.length);
  if(middle&&!(middle.startsWith('Takeaway: ')&&middle.endsWith('\n\n')))refuse(`Step ${stepId}: its explanation text was edited. Nothing was changed.`);
  const takeaway=middle?middle.slice('Takeaway: '.length,-2):'';
  steps.push({id:stepId,title:note.label,viewId:candidates[0].id,nodeIds:participants,edgeIds:frame.edgeIds,narration,sourceIds:note.sourceIds.filter(s=>!entry.sourceIds.includes(s)),provenance,
   dependsOn:prerequisites,...(details2.caseLabel?{caseLabel:details2.caseLabel}:{}),before:table('before'),after:table('after'),...(code?{code}:{}),takeaway,questions:details2.questions} as Step);
  facts.push({participants,perspective:candidates[0].perspective,code:codeFacts});
 }
 const parsed=explanationWalkthroughSchema.safeParse({format:'diagramcloud.explanation-walkthrough',version:1,projectId:doc.id,baseRevision:cut.revision,baseFingerprint:cut.fingerprint,
  id:walkthroughId,title:tour.title,question,sourceIds:entry.sourceIds,steps});
 if(!parsed.success)refuse(`The recorded explanation does not form a valid request (${parsed.error.issues[0]?.message??'invalid'}). Nothing was changed.`);
 const request=parsed.data!;
 let g:Rendered;
 try{g=renderWalkthrough(request,cut,facts,new Set());}catch(e){return refuse(`The recorded explanation cannot be rebuilt: ${errorMessage(e)} Nothing was changed.`);}
 // Compare every recorded copy with the rendering. Visibility and positions are author choices, not request content.
 const answers=new Map<string,string[]>();
 const edited=(what:string)=>refuse(`Generated explanation content was edited after it was applied (${what}). Revise and Remove refuse rather than overwrite or choose between copies. Undo that edit or keep the explanation as it is; nothing was changed.`);
 for(const want of g.nodes){const have=node(want.id);if(!have)edited(`missing ${want.id}`);
  const isAnswer=(b:string)=>{const x=blockOf(b);return !!x&&!want.blockIds.includes(b)&&isAnswerBlock(x);};
  const extra=have!.blockIds.filter(isAnswer);if(extra.length)answers.set(want.id,extra);
  if(!sameNode({...have!,blockIds:have!.blockIds.filter(b=>!isAnswer(b))},want))edited(want.id);}
 for(const want of g.blocks){const have=blockOf(want.id);if(!have||!sameBlock(have,want))edited(want.id);}
 for(const want of g.views){const have=doc.views.find(v=>v.id===want.id);if(!have)edited(`missing ${want.id}`);
  if(!sameView(have,want))edited(want.id);}
 if(tour.sourceRevision!==cut.revision||tour.stops.length!==g.frames.length||g.frames.some((f,i)=>canonical({viewId:tour.stops[i].viewId,subjects:tour.stops[i].subjects,narration:tour.stops[i].narration})!==canonical({viewId:f.viewId,subjects:f.subjects,narration:f.narration})))edited(tourId);
 const nodeIds=new Set(g.nodes.map(n=>n.id)),blockIds=new Set(g.blocks.map(b=>b.id)),viewIds=new Set(g.views.map(v=>v.id));
 const stray=[...doc.nodes,...doc.blocks,...doc.views,...doc.edges,...(doc.tours??[])].find(x=>x.id.startsWith(`${prefix}.`)&&!nodeIds.has(x.id)&&!blockIds.has(x.id)&&!viewIds.has(x.id)&&x.id!==tourId);
 if(stray)edited(`unexpected ${stray.id}`);
 const linked=doc.edges.find(e=>nodeIds.has(e.source)||nodeIds.has(e.target));if(linked)edited(`connection ${linked.id}`);
 const foreign=doc.views.find(v=>!viewIds.has(v.id)&&v.nodeIds.some(n=>nodeIds.has(n)&&n!==prefix));if(foreign)edited(`generated card placed in ${foreign.id}`);
 return {request,cut,tourId,generated:{nodeIds,blockIds,viewIds},answers};
}

/** Every walkthrough tour in the project with whether it can be revised or removed. Read-only. */
export function listExplanationWalkthroughs(doc:Project):ExplanationListing[]{
 return (doc.tours??[]).flatMap((t):ExplanationListing[]=>{const m=WALK_TOUR.exec(t.id);if(!m)return [];
  try{readExplanationWalkthrough(doc,m[1]);return [{id:m[1],tourId:t.id,title:t.title,state:'available' as const,notice:'Revise or remove through the ordinary review.'}];}
  catch(e){return [{id:m[1],tourId:t.id,title:t.title,state:'unavailable' as const,notice:errorMessage(e)}];}});
}

const withVisibility=<T extends {id:string;visibility?:'public'|'private'}>(items:T[],before:Map<string,'public'|'private'|undefined>,kept:string[]):T[]=>
 items.map(x=>{const v=before.get(x.id);if(v==='public'){kept.push(x.id);return {...x,visibility:'public'};}return x;});

function storyAfter(doc:Project,viewIds:Set<string>,nodeIds:Set<string>){
 const removed:string[]=[];const story=doc.story.filter(s=>{const gone=viewIds.has(s.viewId)||(!!s.nodeId&&nodeIds.has(s.nodeId));if(gone)removed.push(s.title);return !gone;});
 return {story,removed};
}
function answerFate(doc:Project,existing:ExistingExplanation,droppedNotes:Set<string>){
 const removed:string[]=[],stale:string[]=[];
 for(const [noteId,ids] of existing.answers)for(const answer of ids){
  if(!droppedNotes.has(noteId)){stale.push(answer);continue;}
  // An answer also attached to a non-generated card stays (and reads stale there); it is only detached here.
  if(!doc.nodes.some(n=>!existing.generated.nodeIds.has(n.id)&&n.blockIds.includes(answer)))removed.push(answer);
 }
 return {removed,stale};
}
const finalize=(make:()=>Project)=>{try{return make();}catch(e){return refuse(`The result would leave a reference to removed explanation content elsewhere in the project: ${errorMessage(e)} Nothing was changed.`);}};

/**
 * Replace exactly one applied walkthrough with a revised request bound to the current full source. Stable IDs are kept:
 * generated IDs follow the walkthrough and step IDs, a kept step keeps its stop ID, and a kept item keeps its visibility.
 * Answers on a kept step read stale (their question source changed) and are never rebound.
 */
export function reviseExplanationWalkthrough(input:Project,value:unknown):WalkthroughResult{
 const doc=validateDocument(input),r=explanationWalkthroughSchema.parse(value);
 sourceCheck(doc,r);
 const existing=readExplanationWalkthrough(doc,r.id),{generated}=existing,prefix=`walk-${r.id}`;
 unique(r.steps.map(s=>s.id),'step ID');unique(r.sourceIds,'source reference');
 const facts=sourceFacts(doc,r,generated.viewIds);
 const occupied=new Set([...doc.nodes.filter(n=>!generated.nodeIds.has(n.id)),...doc.edges,...doc.views.filter(v=>!generated.viewIds.has(v.id)),...doc.blocks.filter(b=>!generated.blockIds.has(b.id)),...(doc.tours??[]).filter(t=>t.id!==existing.tourId)].map(x=>x.id));
 const g=renderWalkthrough(r,{projectId:doc.id,revision:doc.revision,fingerprint:r.baseFingerprint},facts,occupied);
 const oldSteps=existing.request.steps.map(s=>s.id),newSteps=r.steps.map(s=>s.id);
 const droppedNotes=new Set(oldSteps.filter(s=>!newSteps.includes(s)).map(s=>`${prefix}.${s}.note`));
 const {removed:removedAnswers,stale}=answerFate(doc,existing,droppedNotes);
 const vis=new Map<string,'public'|'private'|undefined>([...doc.nodes,...doc.blocks,...doc.views].filter(x=>generated.nodeIds.has(x.id)||generated.blockIds.has(x.id)||generated.viewIds.has(x.id)).map(x=>[x.id,x.visibility]));
 const kept:string[]=[];
 const nodes=withVisibility(g.nodes,vis,kept).map(n=>existing.answers.has(n.id)&&!droppedNotes.has(n.id)?{...n,blockIds:[...n.blockIds,...existing.answers.get(n.id)!]}:n);
 const oldViews=new Map(doc.views.map(v=>[v.id,v]));
 const views=withVisibility(g.views,vis,kept).map(v=>{const old=oldViews.get(v.id);if(!old)return v;
  return {...v,positions:{...v.positions,...Object.fromEntries(Object.entries(old.positions).filter(([n])=>v.nodeIds.includes(n)))}};});
 const removedIds=new Set([...generated.nodeIds].filter(n=>!g.nodes.some(x=>x.id===n))),removedViews=new Set([...generated.viewIds].filter(v=>!g.views.some(x=>x.id===v)));
 const {story,removed:removedStory}=storyAfter(doc,removedViews,removedIds);
 const blocks=[...doc.blocks.filter(b=>!generated.blockIds.has(b.id)&&!removedAnswers.includes(b.id)),...withVisibility(g.blocks,vis,kept)];
 const draft=finalize(()=>validateDocument({...doc,nodes:[...doc.nodes.filter(n=>!generated.nodeIds.has(n.id)).map(n=>({...n,blockIds:n.blockIds.filter(b=>!removedAnswers.includes(b))})),...nodes],blocks,
  views:[...doc.views.filter(v=>!generated.viewIds.has(v.id)),...views],story}));
 const oldTour=doc.tours!.find(t=>t.id===existing.tourId)!;
 const stops:TourStop[]=[],steps:WalkthroughResult['steps']=[];
 for(const frame of g.frames){const stop=recordStop(draft,frame.viewId,frame.subjects,frame.narration);
  const previous=oldTour.stops.find(s=>s.viewId===frame.viewId)?.id;stop.id=previous&&!stops.some(s=>s.id===previous)?previous:newStopId([...stops,...oldTour.stops],stop);stops.push(stop);
  steps.push({sourceStepId:frame.stepId,viewId:frame.viewId,noteNodeId:frame.noteId,stopId:stop.id!});}
 if(oldTour.visibility==='public')kept.push(oldTour.id);
 const tour:Tour={id:existing.tourId,title:r.title,sourceRevision:doc.revision,stops,visibility:oldTour.visibility};
 const next=finalize(()=>validateDocument({...draft,tours:doc.tours!.map(t=>t.id===tour.id?tour:t)}));
 const patch=guardedPatch(doc,`Revise private explanation: ${r.title}`,next,['nodes','blocks','views','tours','story']);
 const preview=applyDocumentPatch(doc,patch).result;
 return {patch,preview,tourId:tour.id,entryNodeId:prefix,steps,notice:WALKTHROUGH_NOTICE,
  effects:{kind:'revise',keptSteps:newSteps.filter(s=>oldSteps.includes(s)),addedSteps:newSteps.filter(s=>!oldSteps.includes(s)),droppedSteps:oldSteps.filter(s=>!newSteps.includes(s)),
   staleAnswerIds:stale,removedAnswerIds:removedAnswers,removedStorySteps:removedStory,publicItemIds:kept}};
}

/** Remove exactly one applied walkthrough: its generated cards, blocks, frames and tour, and its entry card wherever it is placed. */
export function removeExplanationWalkthrough(input:Project,walkthroughId:string):WalkthroughRemoval{
 const doc=validateDocument(input),existing=readExplanationWalkthrough(doc,walkthroughId),{generated}=existing,prefix=`walk-${walkthroughId}`;
 const {removed:removedAnswers}=answerFate(doc,existing,new Set(generated.nodeIds));
 const {story,removed:removedStory}=storyAfter(doc,generated.viewIds,generated.nodeIds);
 const views=doc.views.filter(v=>!generated.viewIds.has(v.id)).map(v=>v.nodeIds.includes(prefix)?{...v,nodeIds:v.nodeIds.filter(n=>n!==prefix),positions:Object.fromEntries(Object.entries(v.positions).filter(([n])=>n!==prefix))}:v);
 const next=finalize(()=>validateDocument({...doc,nodes:doc.nodes.filter(n=>!generated.nodeIds.has(n.id)).map(n=>({...n,blockIds:n.blockIds.filter(b=>!removedAnswers.includes(b))})),
  blocks:doc.blocks.filter(b=>!generated.blockIds.has(b.id)&&!removedAnswers.includes(b.id)),views,story,tours:doc.tours!.filter(t=>t.id!==existing.tourId)}));
 const patch=guardedPatch(doc,`Remove private explanation: ${existing.request.title}`,next,['nodes','blocks','views','tours','story']);
 const preview=applyDocumentPatch(doc,patch).result;
 const publicIds=[...doc.nodes,...doc.blocks,...doc.views,...(doc.tours??[])].filter(x=>(generated.nodeIds.has(x.id)||generated.blockIds.has(x.id)||generated.viewIds.has(x.id)||x.id===existing.tourId)&&x.visibility==='public').map(x=>x.id);
 return {patch,preview,tourId:existing.tourId,entryNodeId:prefix,notice:WALKTHROUGH_NOTICE,
  effects:{kind:'remove',keptSteps:[],addedSteps:[],droppedSteps:existing.request.steps.map(s=>s.id),staleAnswerIds:[],removedAnswerIds:removedAnswers,removedStorySteps:removedStory,publicItemIds:publicIds}};
}
