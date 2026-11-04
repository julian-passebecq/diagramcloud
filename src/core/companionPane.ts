import {validateDocument,type EvidenceBlock,type Project,type ProjectView} from './model';
import {publicDocument} from './operations';
import {relatedContext,resolveRelatedPick,type RelatedContext,type RelatedContextRequest,type RelatedContextResult} from './relatedContext';
import {isExplanationDetails,readExplanationDetails,type ExplanationDetailsResult} from './explanationDetails';
import {VIEW_ROUTE_UNAVAILABLE} from './hierarchy';
import {isAnswerBlock} from './questionAnswers';
import {pathTo} from './viewspec';
import {conceptsExplaining} from '../intelligence/learning/mappings';

/**
 * Pure state for the optional companion pane (UX31-UX33). The pane is a reading aid next to the canvas: it renders
 * relatedContext through the export scene and a keyboard list, never edits the document, never grants scope and never
 * moves the reader except through an explicit detour that keeps the original question and offers an explicit return.
 */
export type CompanionTab='explanation'|'code'|'contract'|'questions'|'related'|'concepts'|'evidence';
export const COMPANION_TAB_LABEL:Record<CompanionTab,string>={explanation:'Explanation',code:'Code/State',contract:'Contract',questions:'Questions',related:'Related',concepts:'Concepts',evidence:'Evidence'};
export type CompanionAudience='public'|'author';
export type CompanionAnchor={viewId:string;nodeId:string};
export type CompanionFilters=Pick<RelatedContextRequest,'scope'|'direction'|'depth'|'kinds'|'maxNodes'>;
export const RELATION_KINDS=['batch','stream','query','control','dependency'] as const;
export const DEFAULT_FILTERS:CompanionFilters={scope:'view',direction:'both',depth:1,kinds:[...RELATION_KINDS],maxNodes:20};
export const DISPLAY_LIMITS=[5,10,20,40] as const;

/** The permitted document for this audience. A public or Present reader never sees an author-only fact. */
export function permittedDocument(project:Project,publicMode:boolean):Project{
 const doc=validateDocument(project);return publicMode?publicDocument(doc):doc;
}

export type CompanionContent={node:Project['nodes'][number];explanation:EvidenceBlock[];codeState:EvidenceBlock[];contract:EvidenceBlock[];structure:ExplanationDetailsResult;evidence:EvidenceBlock[];sources:Project['sources']};
/** Blocks attached to the anchor component in the permitted document, sorted by tab. Nothing is inferred. */
export function companionContent(doc:Project,nodeId:string):CompanionContent|null{
 const node=doc.nodes.find(n=>n.id===nodeId);if(!node)return null;
 const blocks=node.blockIds.map(id=>doc.blocks.find(b=>b.id===id)).filter((b):b is EvidenceBlock=>!!b);
 const sourceIds=new Set([...node.sourceIds,...blocks.flatMap(b=>b.sourceIds)]);
 return {node,explanation:blocks.filter(b=>b.type==='text'),codeState:blocks.filter(b=>(b.type==='code'||b.type==='table')&&!isExplanationDetails(b)),
  contract:blocks.filter(b=>b.transform==='input'||b.transform==='output'),structure:readExplanationDetails(blocks),
  evidence:blocks.filter(b=>(b.type!=='text'&&b.type!=='code'&&b.type!=='table')||isExplanationDetails(b)),sources:doc.sources.filter(s=>sourceIds.has(s.id))};
}
/**
 * Tabs with something to show; Related is always offered because it carries the filters and the coverage.
 * Concepts is offered only when at least one stored concept mapping explains the component in this audience.
 */
export function companionTabs(content:CompanionContent|null,conceptCount=0):CompanionTab[]{
 if(!content)return ['related'];
 const tabs:CompanionTab[]=[];
 if(content.explanation.length||content.node.summary||content.node.role)tabs.push('explanation');
 if(content.codeState.length)tabs.push('code');
 if(content.contract.length||content.structure)tabs.push('contract');
 if(content.structure)tabs.push('questions');
 tabs.push('related');
 if(conceptCount>0)tabs.push('concepts');
 if(content.evidence.length||content.sources.length)tabs.push('evidence');
 return tabs;
}

export function companionRelated(project:Project,publicMode:boolean,anchor:CompanionAnchor,filters:CompanionFilters):RelatedContextResult{
 return relatedContext(project,{projectId:project.id,baseRevision:project.revision,viewId:anchor.viewId,nodeId:anchor.nodeId,
  audience:publicMode?'public':'author',scope:filters.scope,direction:filters.direction,depth:filters.depth,kinds:filters.kinds,maxNodes:filters.maxNodes});
}

/** One line that says how much is shown and what bounds it. Never says "all". */
export function coverageText(ctx:RelatedContext,filters:CompanionFilters):string{
 const shown=ctx.spec.nodes.length-1,edges=ctx.spec.edges.length;
 const kinds=filters.kinds.length===RELATION_KINDS.length?'all relation kinds':filters.kinds.length?filters.kinds.join(', '):'no relation kind';
 return `${shown} related component${shown===1?'':'s'} and ${edges} connection${edges===1?'':'s'} within depth ${filters.depth}, ${filters.scope==='view'?'this view':'the permitted project'}, ${filters.direction==='both'?'both directions':filters.direction}, ${kinds}; display limit ${filters.maxNodes}${ctx.truncated?' reached, more may exist':''}.`;
}

/** A temporary view for the export scene: the projection's own order and distance layout, never a stored view. */
export function relatedSceneView(ctx:RelatedContext,anchorView:ProjectView):ProjectView{
 const ids=ctx.spec.nodes.map(n=>n.id);
 return {...anchorView,id:'companion-related',title:ctx.spec.title,nodeIds:ids,edgeIds:ctx.spec.edges.map(e=>e.id),
  positions:Object.fromEntries(ids.map((id,i)=>[id,{x:(ctx.distance[id]??0)*300,y:i*140}]))};
}

/** Where a related component opens: the anchor view when it is a member there, otherwise its first permitted view. */
export function detourTarget(ctx:RelatedContextResult,nodeId:string):CompanionAnchor|null{
 if(ctx.state!=='available')return null;
 const pick=resolveRelatedPick(ctx,{fingerprint:ctx.fingerprint,nodeId});if(!pick)return null;
 const views=ctx.memberships.find(m=>m.nodeId===pick.nodeId)?.views??[];
 const viewId=views.some(v=>v.id===pick.sourceViewId)?pick.sourceViewId:views[0]?.id;
 return viewId?{viewId,nodeId:pick.nodeId}:null;
}

/**
 * Related concepts: the stored concept mappings that explain this component, read through conceptsExplaining after the
 * audience projection (public: reviewed or source-declared public mappings only; rejected never). Nothing is inferred from
 * a shared word, tag or icon: a component without a stored mapping has no Concepts tab.
 */
export function companionConcepts(project:Project,publicMode:boolean,nodeId:string){
 return conceptsExplaining(project,nodeId,{publicMode});
}

/** The tabs the pane shows: companionTabs plus Questions in authoring when a private authored answer is attached. */
export function companionPaneTabs(content:CompanionContent|null,conceptCount:number,publicMode:boolean):CompanionTab[]{
 const tabs=companionTabs(content,conceptCount);
 if(!publicMode&&content?.evidence.some(isAnswerBlock)&&!tabs.includes('questions'))tabs.push('questions');
 return tabs;
}
export type CompanionConcept=ReturnType<typeof companionConcepts>[number];

/** A question chosen in the Questions tab, bound to its component by kind, position and exact text. */
export type CompanionQuestion={nodeId:string;kind:'focus'|'follow-up';index:number;text:string};
export function companionQuestions(content:CompanionContent|null):CompanionQuestion[]{
 if(!content||content.structure?.state!=='available')return [];
 const d=content.structure.details,nodeId=content.node.id;
 return [{nodeId,kind:'focus',index:0,text:d.focusQuestion},...d.questions.map((text,index)=>({nodeId,kind:'follow-up' as const,index,text}))];
}
/** The chosen question when it still exists unchanged on this component; a moved or reworded question is never rebound. */
export function resolveQuestion(content:CompanionContent|null,q:CompanionQuestion|null):CompanionQuestion|null{
 if(!q)return null;
 return companionQuestions(content).find(x=>x.nodeId===q.nodeId&&x.kind===q.kind&&x.index===q.index&&x.text===q.text)??null;
}

/** What the reader was doing when the detour started: restored by Return, never by anything else. */
export type CompanionReading={tab:CompanionTab;filters:CompanionFilters;question:CompanionQuestion|null};
export const DEFAULT_READING:CompanionReading={tab:'related',filters:DEFAULT_FILTERS,question:null};
const cloneReading=(r:CompanionReading):CompanionReading=>({tab:r.tab,filters:{...r.filters,kinds:[...r.filters.kinds]},question:r.question?{...r.question}:null});

/**
 * A detour remembers the original question, the project, revision and audience it started in, and the reading state
 * (tab, filters, selected question). It is the companion's anchor until the reader returns or ends it.
 */
export type CompanionDetour={projectId:string;revision:number;audience:CompanionAudience;origin:CompanionAnchor&{label:string};target:CompanionAnchor&{label:string};reading:CompanionReading};
export function startDetour(doc:Project,origin:CompanionAnchor,target:CompanionAnchor,current?:CompanionDetour|null,
 context:{audience?:CompanionAudience;reading?:CompanionReading}={}):CompanionDetour{
 const label=(id:string)=>doc.nodes.find(n=>n.id===id)?.label??id,audience=context.audience??'author';
 // A second hop keeps the first origin and its reading state: the original question is never replaced by a detour.
 // A hop in another project or audience starts a new detour instead.
 if(current&&current.projectId===doc.id&&current.audience===audience)return {...current,target:{...target,label:label(target.nodeId)}};
 return {projectId:doc.id,revision:doc.revision,audience,origin:{...origin,label:label(origin.nodeId)},target:{...target,label:label(target.nodeId)},reading:cloneReading(context.reading??DEFAULT_READING)};
}

/** Return is refused with the same generic message as any unavailable navigation target: it never names what is missing. */
export const RETURN_UNAVAILABLE=VIEW_ROUTE_UNAVAILABLE;
export type CompanionReturn={state:'available';anchor:CompanionAnchor;reading:CompanionReading;revisionChanged:boolean}|{state:'refused';notice:typeof RETURN_UNAVAILABLE};
/**
 * Whether Return may bring the reader back, checked against the CURRENT permitted document. Refused with the generic
 * message when the project or audience changed, or the origin component or its view is gone, revoked or unreachable.
 * Identities are exact: nothing is rebound to a similar component, view or question. A tab that no longer has content
 * falls back to Related; a question that moved or was reworded is dropped, never rebound. A revision change alone is
 * not a refusal (it is reported), because the origin is checked by identity in the current permitted document.
 */
export function resolveReturn(project:Project,publicMode:boolean,detour:CompanionDetour):CompanionReturn{
 const refused:CompanionReturn={state:'refused',notice:RETURN_UNAVAILABLE};
 const doc=permittedDocument(project,publicMode);
 if(detour.projectId!==doc.id||detour.audience!==(publicMode?'public':'author'))return refused;
 const {viewId,nodeId}=detour.origin,view=doc.views.find(v=>v.id===viewId);
 if(!view||!view.nodeIds.includes(nodeId)||!doc.nodes.some(n=>n.id===nodeId)||!pathTo(doc,viewId).length)return refused;
 const content=companionContent(doc,nodeId),tabs=companionPaneTabs(content,companionConcepts(project,publicMode,nodeId).length,publicMode),reading=cloneReading(detour.reading);
 return {state:'available',anchor:{viewId,nodeId},revisionChanged:doc.revision!==detour.revision,
  reading:{...reading,tab:tabs.includes(reading.tab)?reading.tab:'related',question:resolveQuestion(content,reading.question)}};
}
