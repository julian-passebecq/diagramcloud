import {SEMANTIC_DEPTHS,type DepthScene,type SemanticDepth} from './depth';
/**
 * Lesson figure interaction (extends R4-AC-12). One selection is shared by the spatial figure and the list alternative.
 * "Open inside" moves the diagram one semantic depth deeper, only for a component the depth scene lists as collapsed (its
 * childViewId opens a view the scene has not shown yet), so drilling stays explicit drilldown, bounded at two levels and never
 * revisits a view. Back returns to the depth the drill started from. Selection and drill are navigation state: they never
 * change zoom, environment, perspective, variant, run or audience, and never create a document revision.
 */
export type FigureDrill={from:SemanticDepth;nodeId:string};
export type FigureState={selected:string|null;trail:FigureDrill[]};
export type FigureAction={type:'select';nodeId:string|null}|{type:'drill';nodeId:string;from:SemanticDepth}|{type:'back'}|{type:'reset'};
export const FIGURE_INITIAL:FigureState={selected:null,trail:[]};
export function figureInteraction(state:FigureState,action:FigureAction):FigureState{
 switch(action.type){
  case 'select':return {...state,selected:action.nodeId};
  case 'drill':return {selected:action.nodeId,trail:[...state.trail,{from:action.from,nodeId:action.nodeId}]};
  case 'back':{const top=state.trail.at(-1);return top?{selected:top.nodeId,trail:state.trail.slice(0,-1)}:state;}
  case 'reset':return {...state,trail:[]};
 }
}
/** The selection as the current scene sees it: a component that is not in the scene is never shown as selected. */
export const selectedIn=(scene:Pick<DepthScene,'nodes'>,state:Pick<FigureState,'selected'>)=>state.selected&&scene.nodes.some(n=>n.id===state.selected)?state.selected:null;
/** Where "Open inside" leads for one component: the next depth, and the view its explicit childViewId opens. Null when the
 * component opens nothing new, its view is already shown, or the scene is already at the two-level bound. */
export function drillTarget(scene:Pick<DepthScene,'nodes'|'collapsed'|'depth'>,nodeId:string|null|undefined):{depth:SemanticDepth;viewId:string;title:string}|null{
 if(!nodeId||!scene.nodes.some(n=>n.id===nodeId))return null;
 const collapsed=scene.collapsed.find(c=>c.nodeId===nodeId),at=SEMANTIC_DEPTHS.findIndex(d=>d.id===scene.depth),next=SEMANTIC_DEPTHS[at+1];
 return collapsed&&next?{depth:next.id,viewId:collapsed.viewId,title:collapsed.title}:null;
}
/** The depth Back returns to, or null when the diagram is at the lesson's own depth. */
export const backTarget=(state:Pick<FigureState,'trail'>)=>state.trail.at(-1)??null;
