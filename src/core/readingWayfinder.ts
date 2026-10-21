import {validateDocument,type Project} from './model';
import {publicDocument} from './operations';
import {childLinks,isPermittedPath} from './hierarchy';
import {canonical,fnv64} from './learningMapping';

export type WayfinderPick={sourceKey:string;path:string[];viewId:string;nodeId?:string};
export type WayfinderItem={label:string;pick:WayfinderPick;depth:number;current:boolean};
export type ReadingWayfinderModel={
 projectId:string;title:string;revision:number;sourceKey:string;available:boolean;
 trail:WayfinderItem[];level:WayfinderItem[];children:WayfinderItem[];tree:WayfinderItem[];truncated:boolean;
};
/** A projection of existing explicit view containment, NOT an organization registry or delivery lifecycle. */
export function prepareReadingWayfinder(input:Project,audience:'author'|'public',path:readonly string[],activeView:string):ReadingWayfinderModel {
 const validated=validateDocument(input),doc=audience==='public'?publicDocument(validated):validated;
 const sourceKey=fnv64(canonical(doc)),base={projectId:doc.id,title:doc.title,revision:doc.revision,sourceKey};
 const index=path.indexOf(activeView),prefix=index<0?[]:[...path.slice(0,index+1)];
 const empty={...base,available:false,trail:[],level:[],children:[],tree:[],truncated:false};
 if(!isPermittedPath(doc,prefix))return empty;
 const title=(id:string)=>doc.views.find(v=>v.id===id)!.title;
 const item=(p:string[],nodeId?:string):WayfinderItem=>({label:title(p[p.length-1]),depth:p.length-1,current:p.length===prefix.length&&p.every((id,i)=>id===prefix[i]),pick:{sourceKey,path:[...p],viewId:p[p.length-1],...(nodeId?{nodeId}:{})}});
 const childrenOf=(p:string[])=>{
  const seen=new Set<string>();
  return childLinks(doc,p[p.length-1]).filter(x=>!p.includes(x.viewId)&&!seen.has(x.viewId)&&!!seen.add(x.viewId)).map(x=>item([...p,x.viewId]));
 };
 const trail=prefix.map((_,i)=>item(prefix.slice(0,i+1))),level=prefix.length>1?childrenOf(prefix.slice(0,-1)):[item(prefix)];
 const tree:WayfinderItem[]=[];let truncated=false;
 const walk=(p:string[])=>{if(tree.length>=160){truncated=true;return;}tree.push(item(p));for(const c of childrenOf(p)){if(tree.length>=160){truncated=true;break;}walk(c.pick.path);}};
 walk([doc.rootViewId]);
 return {...base,available:true,trail,level,children:childrenOf(prefix),tree,truncated};
}
export function resolveWayfinderPick(input:Project,audience:'author'|'public',pick:WayfinderPick):{viewId:string;path:string[];nodeId?:string}|null{
 const doc=audience==='public'?publicDocument(validateDocument(input)):validateDocument(input);
 if(!pick||pick.sourceKey!==fnv64(canonical(doc))||!Array.isArray(pick.path)||pick.path[pick.path.length-1]!==pick.viewId||!isPermittedPath(doc,pick.path))return null;
 if(pick.nodeId&&!doc.views.find(v=>v.id===pick.viewId)?.nodeIds.includes(pick.nodeId))return null;
 return {viewId:pick.viewId,path:[...pick.path],...(pick.nodeId?{nodeId:pick.nodeId}:{})};
}
