import type {Project} from './model';
import {pathTo} from './viewspec';
import {resolveLinkedPick} from './linkedReading';
import {DOMAIN_MAP_COLUMNS,readDomainMappings,resolveDomainPick,type DomainMapping} from './domainCorrespondence';
import {samePerspectiveBinding,type PerspectiveBinding} from './workbenchPerspective';

/**
 * Linked perspective (V3 workspace): two permitted views of ONE project cut, read side by side.
 * Session state only: stable-ID pointers, never a revision, never a second model. Identity is exact stable ID;
 * a relation comes only from an explicit mapping table (src/core/domainCorrespondence.ts) and is never identity.
 * Labels are never matched. The caller passes the permitted projection (publicDocument for a public audience).
 */
export type LinkedMode='same-cut'|'mapped';
export type LinkedSide='left'|'right';
export type DetailPlacement='below-both'|'below-right';
export type LinkedPerspective={binding:PerspectiveBinding;mode:LinkedMode;leftViewId:string;rightViewId:string;anchorNodeId:string|null;mappingBlockIds:string[];pick:{side:LinkedSide;id:string}|null;detailPlacement:DetailPlacement};
export type LinkedOpenInput={binding:PerspectiveBinding;leftViewId:string;rightViewId:string;anchorNodeId?:string|null;mappingBlockIds?:readonly string[];mode?:LinkedMode;detailPlacement?:DetailPlacement};
export type LinkedResult={ok:true;state:LinkedPerspective;notice?:string}|{ok:false;reason:string};

/** One generic message: it never says whether a refused ID exists in a private part of the project. */
export const LINKED_PERSPECTIVE_UNAVAILABLE='This linked reading is not available in the current permitted project. Nothing was changed.';
export const LINKED_PICK_LOST='The selected component is no longer in its view. The selection was cleared; nothing was rebound.';
export const LINKED_ANCHOR_LOST='The business question component is no longer available. The anchor was cleared.';
export const DETAIL_PLACEMENTS:readonly DetailPlacement[]=['below-both','below-right'];

const refuse=(reason=LINKED_PERSPECTIVE_UNAVAILABLE):LinkedResult=>({ok:false,reason});
const boundTo=(binding:PerspectiveBinding,doc:Project)=>binding.projectId===doc.id&&binding.epoch===doc.revision;

/** The reachable permitted views (explicit childViewId drilldown from the root), in document order. */
export function linkedViewChoices(doc:Project):{id:string;title:string}[]{
 return doc.views.filter(v=>pathTo(doc,v.id).length>0).map(v=>({id:v.id,title:v.title}));
}
const reachable=(doc:Project,viewId:string)=>pathTo(doc,viewId).length>0;

/**
 * Mapping tables of this permitted document: transform 'mapping', exactly DOMAIN_MAP_COLUMNS, attached to the
 * from-node they describe. Join mapping tables have other columns and are never picked up. Each table is checked
 * on its own, so one malformed table never hides the others; a duplicated mapping ID keeps the first table only.
 */
export function discoverMappingBlocks(doc:Project):string[]{
 const out:string[]=[],mappingIds=new Set<string>();
 for(const b of doc.blocks){
  if(b.type!=='table'||b.transform!=='mapping'||b.columns.length!==DOMAIN_MAP_COLUMNS.length||!b.columns.every((c,i)=>c===DOMAIN_MAP_COLUMNS[i]))continue;
  const from=b.rows[0]?.[1];if(typeof from!=='string'||!doc.nodes.find(n=>n.id===from)?.blockIds.includes(b.id))continue;
  let read:DomainMapping[];try{read=readDomainMappings(doc,[b.id]);}catch{continue;}
  if(read.some(m=>mappingIds.has(m.id)))continue;
  read.forEach(m=>mappingIds.add(m.id));out.push(b.id);
  if(out.length>=120)break;
 }
 return out;
}

/** Opens a linked perspective on the document it receives. A stale binding, an unreachable view or invalid mapping evidence is refused whole. */
export function openLinkedPerspective(doc:Project,input:LinkedOpenInput):LinkedResult{
 const binding=input.binding;
 if(!boundTo(binding,doc))return refuse();
 if(!reachable(doc,input.leftViewId)||!reachable(doc,input.rightViewId))return refuse();
 const anchor=input.anchorNodeId??null;if(anchor!==null&&!doc.nodes.some(n=>n.id===anchor))return refuse();
 const blocks=input.mappingBlockIds?[...input.mappingBlockIds]:discoverMappingBlocks(doc);
 try{readDomainMappings(doc,blocks);}catch{return refuse();}
 const mode=input.mode??(blocks.length?'mapped':'same-cut');
 if(mode==='same-cut'&&input.mappingBlockIds&&input.mappingBlockIds.length)return refuse();
 const detailPlacement=input.detailPlacement??'below-both';if(!DETAIL_PLACEMENTS.includes(detailPlacement))return refuse();
 return {ok:true,state:{binding:{...binding},mode,leftViewId:input.leftViewId,rightViewId:input.rightViewId,anchorNodeId:anchor,mappingBlockIds:mode==='mapped'?blocks:[],pick:null,detailPlacement}};
}

/** Mappings of the state, read again on the permitted document (never cached across revisions). */
export function linkedMappings(state:LinkedPerspective,doc:Project):DomainMapping[]{
 if(state.mode!=='mapped'||!boundTo(state.binding,doc))return [];
 try{return readDomainMappings(doc,state.mappingBlockIds);}catch{return [];}
}

export type LinkedSelectionState='NONE'|'EXACT'|'RELATED'|'CHOICE'|'ABSENT'|'REFUSED';
export type LinkedSelection={state:LinkedSelectionState;side:LinkedSide|null;originId:string|null;targets:string[];mappings:DomainMapping[];gaps:DomainMapping[]};
const none=(state:LinkedSelectionState='NONE'):LinkedSelection=>({state,side:null,originId:null,targets:[],mappings:[],gaps:[]});

/**
 * Resolves the pick against the ids each side renders. Same-cut: exact identity only. Mapped: exact identity outranks
 * an authored relation; several related targets come back together (CHOICE) and none is picked. An explicitly
 * unresolved mapping from the pick is returned as a gap, never as a target.
 */
export function resolveLinkedSelection(state:LinkedPerspective,doc:Project,leftIds:readonly string[],rightIds:readonly string[]):LinkedSelection{
 if(!boundTo(state.binding,doc))return none('REFUSED');
 const pick=state.pick;if(!pick)return none();
 if(state.mode==='same-cut'){
  const r=resolveLinkedPick(leftIds,rightIds,pick.side,pick.id);
  if(r.state==='REFUSED')return none('REFUSED');
  return {state:r.state==='MATCH'?'EXACT':'ABSENT',side:pick.side,originId:pick.id,targets:r.state==='MATCH'?[pick.id]:[],mappings:[],gaps:[]};
 }
 const mappings=linkedMappings(state,doc),r=resolveDomainPick(leftIds,rightIds,pick.side,pick.id,mappings);
 if(r.state==='REFUSED')return none('REFUSED');
 const gaps=r.state==='EXACT'?[]:mappings.filter(m=>m.state==='unresolved'&&m.fromId===pick.id);
 return {state:r.state,side:pick.side,originId:pick.id,targets:r.targets,mappings:r.mappings,gaps};
}

export type LinkedStateLine={code:'select'|'selected'|'same'|'related'|'choice'|'absent'|'only';text:string};
/** The reader-facing line of one side. "Related" is never "the same object". */
export function linkedStateLine(selection:LinkedSelection,side:LinkedSide):LinkedStateLine{
 const origin=selection.side===side;
 switch(selection.state){
  case 'NONE':case 'REFUSED':return {code:'select',text:'Select a component; exact identity and authored relations stay distinct.'};
  case 'EXACT':return {code:'same',text:'Same object'};
  case 'ABSENT':return origin?{code:'only',text:`Only in ${side} view`}:{code:'absent',text:'No counterpart in this view'};
  case 'RELATED':return origin?{code:'selected',text:'Selected; one related object in the other view'}:{code:'related',text:'Related, not the same object'};
  case 'CHOICE':return origin?{code:'selected',text:'Selected; several related objects in the other view'}:{code:'choice',text:'Several related objects: choose'};
 }
}

/** Every change carries the binding it was issued at; a stale one is refused without a change. */
export function pickLinked(state:LinkedPerspective,doc:Project,issuedAt:PerspectiveBinding,side:LinkedSide,id:string):LinkedResult{
 if(!samePerspectiveBinding(issuedAt,state.binding)||!boundTo(state.binding,doc))return refuse();
 const view=doc.views.find(v=>v.id===(side==='left'?state.leftViewId:state.rightViewId));
 if(!view||!view.nodeIds.includes(id)||!doc.nodes.some(n=>n.id===id))return refuse();
 return {ok:true,state:{...state,pick:{side,id}}};
}
export function clearLinkedPick(state:LinkedPerspective):LinkedPerspective{return {...state,pick:null};}
/** Swapping keeps the pick on the same object (now on the other side) and the anchor. */
export function swapLinkedSides(state:LinkedPerspective,issuedAt:PerspectiveBinding):LinkedResult{
 if(!samePerspectiveBinding(issuedAt,state.binding))return refuse();
 return {ok:true,state:{...state,leftViewId:state.rightViewId,rightViewId:state.leftViewId,pick:state.pick?{side:state.pick.side==='left'?'right':'left',id:state.pick.id}:null}};
}
/** A view change keeps the anchor; the pick is kept only while it is still in its side's view. */
export function setLinkedView(state:LinkedPerspective,doc:Project,issuedAt:PerspectiveBinding,side:LinkedSide,viewId:string):LinkedResult{
 if(!samePerspectiveBinding(issuedAt,state.binding)||!boundTo(state.binding,doc)||!reachable(doc,viewId))return refuse();
 const next={...state,[side==='left'?'leftViewId':'rightViewId']:viewId} as LinkedPerspective;
 const view=next.pick&&doc.views.find(v=>v.id===(next.pick!.side==='left'?next.leftViewId:next.rightViewId));
 if(next.pick&&!view?.nodeIds.includes(next.pick.id))next.pick=null;
 return {ok:true,state:next};
}
export function setLinkedAnchor(state:LinkedPerspective,doc:Project,issuedAt:PerspectiveBinding,nodeId:string|null):LinkedResult{
 if(!samePerspectiveBinding(issuedAt,state.binding)||!boundTo(state.binding,doc)||nodeId!==null&&!doc.nodes.some(n=>n.id===nodeId))return refuse();
 return {ok:true,state:{...state,anchorNodeId:nodeId}};
}
export function setDetailPlacement(state:LinkedPerspective,placement:DetailPlacement):LinkedPerspective{
 return DETAIL_PLACEMENTS.includes(placement)?{...state,detailPlacement:placement}:state;
}

/**
 * Reconciles the state with the current permitted document. Another project or audience resets with the generic
 * message. A revision change keeps every ID that still resolves; a lost pick or anchor is dropped and said.
 */
export function reconcileLinkedPerspective(state:LinkedPerspective,doc:Project,binding:PerspectiveBinding):{state:LinkedPerspective|null;notice:string|null}{
 if(state.binding.projectId!==binding.projectId||state.binding.audience!==binding.audience||binding.projectId!==doc.id||binding.epoch!==doc.revision)return {state:null,notice:LINKED_PERSPECTIVE_UNAVAILABLE};
 if(state.binding.epoch===binding.epoch)return {state,notice:null};
 if(!reachable(doc,state.leftViewId)||!reachable(doc,state.rightViewId))return {state:null,notice:LINKED_PERSPECTIVE_UNAVAILABLE};
 const still=new Set(discoverMappingBlocks(doc)),blocks=state.mappingBlockIds.filter(id=>still.has(id));
 const notices:string[]=[];let pick=state.pick,anchor=state.anchorNodeId;
 if(pick){const view=doc.views.find(v=>v.id===(pick!.side==='left'?state.leftViewId:state.rightViewId));if(!view?.nodeIds.includes(pick.id)||!doc.nodes.some(n=>n.id===pick!.id)){pick=null;notices.push(LINKED_PICK_LOST);}}
 if(anchor&&!doc.nodes.some(n=>n.id===anchor)){anchor=null;notices.push(LINKED_ANCHOR_LOST);}
 if(blocks.length<state.mappingBlockIds.length)notices.push(`${state.mappingBlockIds.length-blocks.length} mapping table(s) no longer resolve and are no longer read.`);
 return {state:{...state,binding:{...binding},mappingBlockIds:blocks,pick,anchorNodeId:anchor},notice:notices.length?notices.join(' '):null};
}

/** Parent of a view along its default permitted path (explicit drilldown only). */
export function linkedParentView(doc:Project,viewId:string):string|null{const p=pathTo(doc,viewId);return p.length>1?p[p.length-2].viewId:null;}
/** Child view of the picked component, when it has one that is reachable in this permitted document. */
export function linkedChildView(doc:Project,state:LinkedPerspective):string|null{
 const child=state.pick?doc.nodes.find(n=>n.id===state.pick!.id)?.childViewId:undefined;
 return child&&reachable(doc,child)?child:null;
}
/** A default companion view: the reachable view sharing the most exact IDs or authored relations with the left one; ties keep document order. */
export function suggestRightView(doc:Project,leftViewId:string,mappings:readonly DomainMapping[]):string|null{
 const left=new Set(doc.views.find(v=>v.id===leftViewId)?.nodeIds??[]);let best:string|null=null,score=-1;
 for(const v of linkedViewChoices(doc)){if(v.id===leftViewId)continue;const ids=new Set(doc.views.find(x=>x.id===v.id)!.nodeIds);
  const s=[...left].filter(id=>ids.has(id)).length+mappings.filter(m=>m.toId!==null&&(left.has(m.fromId)&&ids.has(m.toId)||left.has(m.toId)&&ids.has(m.fromId))).length;
  if(s>score){score=s;best=v.id;}}
 return best;
}
