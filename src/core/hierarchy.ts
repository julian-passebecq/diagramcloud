import type {Project} from './model';

/**
 * Drilldown hierarchy read from explicit childViewId links only (never from a dependency edge).
 * Every function takes the already permitted document (publicDocument in public modes) and returns
 * navigation state: nothing here writes the document or creates a revision.
 */
export type ParentPath={viewIds:string[];via:string[]};
/** Bound on the parent paths listed for one view; a larger set is reported as truncated, never silently cut. */
export const MAX_PARENT_PATHS=12;

/** Child view links of a view, in the view's node order, each a component of that view with a childViewId that exists. */
export function childLinks(doc:Project,viewId:string):{nodeId:string;viewId:string}[]{
 const view=doc.views.find(v=>v.id===viewId);if(!view)return [];
 const views=new Set(doc.views.map(v=>v.id)),nodes=new Map(doc.nodes.map(n=>[n.id,n]));
 return view.nodeIds.flatMap(id=>{const child=nodes.get(id)?.childViewId;return child&&views.has(child)?[{nodeId:id,viewId:child}]:[];});
}

/**
 * Every permitted path from the root to a view, no view revisited (no recursive drilldown), in a
 * deterministic depth-first order (root node order). `via` names the first component leading down at each hop.
 * At most `limit` distinct view chains; `truncated` says more exist.
 */
export function parentPaths(doc:Project,target:string,limit=MAX_PARENT_PATHS):{paths:ParentPath[];truncated:boolean}{
 const paths:ParentPath[]=[];let truncated=false;
 if(!doc.views.some(v=>v.id===target))return {paths,truncated};
 const visit=(viewId:string,viewIds:string[],via:string[])=>{
  if(truncated)return;
  if(viewId===target){
   // A path is its chain of views: two components of one view opening the same child are one parent, listed once.
   const key=[...viewIds,viewId].join('\u0000');if(paths.some(p=>p.viewIds.join('\u0000')===key))return;
   if(paths.length>=limit){truncated=true;return;}paths.push({viewIds:[...viewIds,viewId],via:[...via]});return;}
  for(const link of childLinks(doc,viewId))if(!viewIds.includes(link.viewId)&&link.viewId!==viewId)visit(link.viewId,[...viewIds,viewId],[...via,link.nodeId]);
 };
 visit(doc.rootViewId,[],[]);
 return {paths,truncated};
}

/** True when the path is an exact chain of childViewId links from the root with no view revisited. */
export function isPermittedPath(doc:Project,path:string[]):boolean{
 if(!path.length||path[0]!==doc.rootViewId||new Set(path).size!==path.length)return false;
 for(let i=0;i<path.length;i++){if(!doc.views.some(v=>v.id===path[i]))return false;if(i+1<path.length&&!childLinks(doc,path[i]).some(l=>l.viewId===path[i+1]))return false;}
 return true;
}

export type RailMove={path:string[];view:string;selected:string|null};
export type HierarchyRail={up?:RailMove;down?:RailMove;previous?:RailMove;next?:RailMove;siblings:number;position:number};

/**
 * One-step moves from the active view of an open path. Up opens the parent (selecting the component that
 * leads down), Down opens the child view of the selected component, Previous/Next open the neighbouring
 * child views of the same parent. A move never revisits a view already on the path.
 */
export function hierarchyRail(doc:Project,path:string[],activeView:string,selected:string|null):HierarchyRail{
 const index=path.indexOf(activeView);
 if(index<0||!isPermittedPath(doc,path.slice(0,index+1)))return {siblings:0,position:0};
 const prefix=path.slice(0,index+1),out:HierarchyRail={siblings:0,position:0};
 if(index>0){
  const parent=prefix[index-1],via=childLinks(doc,parent).find(l=>l.viewId===activeView)?.nodeId??null;
  out.up={path:prefix.slice(0,index),view:parent,selected:via};
  const ancestors=new Set(prefix.slice(0,index)),seen=new Set<string>(),siblings=childLinks(doc,parent).filter(l=>!ancestors.has(l.viewId)&&!seen.has(l.viewId)&&!!seen.add(l.viewId));
  const at=siblings.findIndex(l=>l.viewId===activeView);out.siblings=siblings.length;out.position=at+1;
  const move=(i:number):RailMove|undefined=>siblings[i]?{path:[...prefix.slice(0,index),siblings[i].viewId],view:siblings[i].viewId,selected:null}:undefined;
  if(at>=0){out.previous=move(at-1);out.next=move(at+1);}
 }
 const view=doc.views.find(v=>v.id===activeView);
 if(selected&&view?.nodeIds.includes(selected)){const child=childLinks(doc,activeView).find(l=>l.nodeId===selected)?.viewId;if(child&&!prefix.includes(child))out.down={path:[...prefix,child],view:child,selected:null};}
 return out;
}
