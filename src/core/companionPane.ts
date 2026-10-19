import {validateDocument,type EvidenceBlock,type Project,type ProjectView} from './model';
import {publicDocument} from './operations';
import {relatedContext,resolveRelatedPick,type RelatedContext,type RelatedContextRequest,type RelatedContextResult} from './relatedContext';

/**
 * Pure state for the optional companion pane (UX31-UX33). The pane is a reading aid next to the canvas: it renders
 * relatedContext through the export scene and a keyboard list, never edits the document, never grants scope and never
 * moves the reader except through an explicit detour that keeps the original question and offers an explicit return.
 */
export type CompanionTab='explanation'|'code'|'related'|'evidence';
export const COMPANION_TAB_LABEL:Record<CompanionTab,string>={explanation:'Explanation',code:'Code/State',related:'Related',evidence:'Evidence'};
export type CompanionAnchor={viewId:string;nodeId:string};
export type CompanionFilters=Pick<RelatedContextRequest,'scope'|'direction'|'depth'|'kinds'|'maxNodes'>;
export const RELATION_KINDS=['batch','stream','query','control','dependency'] as const;
export const DEFAULT_FILTERS:CompanionFilters={scope:'view',direction:'both',depth:1,kinds:[...RELATION_KINDS],maxNodes:20};
export const DISPLAY_LIMITS=[5,10,20,40] as const;

/** The permitted document for this audience. A public or Present reader never sees an author-only fact. */
export function permittedDocument(project:Project,publicMode:boolean):Project{
 const doc=validateDocument(project);return publicMode?publicDocument(doc):doc;
}

export type CompanionContent={node:Project['nodes'][number];explanation:EvidenceBlock[];codeState:EvidenceBlock[];evidence:EvidenceBlock[];sources:Project['sources']};
/** Blocks attached to the anchor component in the permitted document, sorted by tab. Nothing is inferred. */
export function companionContent(doc:Project,nodeId:string):CompanionContent|null{
 const node=doc.nodes.find(n=>n.id===nodeId);if(!node)return null;
 const blocks=node.blockIds.map(id=>doc.blocks.find(b=>b.id===id)).filter((b):b is EvidenceBlock=>!!b);
 const sourceIds=new Set([...node.sourceIds,...blocks.flatMap(b=>b.sourceIds)]);
 return {node,explanation:blocks.filter(b=>b.type==='text'),codeState:blocks.filter(b=>b.type==='code'||b.type==='table'),
  evidence:blocks.filter(b=>b.type!=='text'&&b.type!=='code'&&b.type!=='table'),sources:doc.sources.filter(s=>sourceIds.has(s.id))};
}
/** Tabs with something to show; Related is always offered because it carries the filters and the coverage. */
export function companionTabs(content:CompanionContent|null):CompanionTab[]{
 if(!content)return ['related'];
 const tabs:CompanionTab[]=[];
 if(content.explanation.length||content.node.summary||content.node.role)tabs.push('explanation');
 if(content.codeState.length)tabs.push('code');
 tabs.push('related');
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

/** A detour remembers the original question; it is the companion's anchor until the reader returns or ends it. */
export type CompanionDetour={projectId:string;origin:CompanionAnchor&{label:string};target:CompanionAnchor&{label:string}};
export function startDetour(doc:Project,origin:CompanionAnchor,target:CompanionAnchor,current?:CompanionDetour|null):CompanionDetour{
 const label=(id:string)=>doc.nodes.find(n=>n.id===id)?.label??id;
 // A second hop keeps the first origin: the original question is never replaced by a detour.
 return {projectId:doc.id,origin:current?.projectId===doc.id?current.origin:{...origin,label:label(origin.nodeId)},target:{...target,label:label(target.nodeId)}};
}
