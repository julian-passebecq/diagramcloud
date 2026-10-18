import {z} from 'zod';
import {validateDocument,type Project} from './model';
import {publicDocument} from './operations';
import {viewSpec,type ViewSpec} from './viewspec';
import {canonical,fnv64} from './learningMapping';

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
export const relatedContextRequestSchema=z.object({projectId:id,baseRevision:z.number().int().nonnegative(),
 viewId:id,nodeId:id,audience:z.enum(['author','public']),scope:z.enum(['view','project']).default('view'),
 direction:z.enum(['incoming','outgoing','both']).default('both'),depth:z.number().int().min(0).max(3).default(1),
 kinds:z.array(z.enum(['batch','stream','query','control','dependency'])).max(5).default(['batch','stream','query','control','dependency']),
 maxNodes:z.number().int().min(1).max(40).default(20),maxEdges:z.number().int().min(0).max(120).default(60)
}).strict();
export type RelatedContextRequest=z.infer<typeof relatedContextRequestSchema>;
export type RelatedContext={state:'available';readOnly:true;projectId:string;baseRevision:number;viewId:string;nodeId:string;audience:'author'|'public';
 scope:'view'|'project';fingerprint:string;spec:ViewSpec;distance:Record<string,number>;
 memberships:{nodeId:string;views:{id:string;title:string}[]}[];truncated:boolean;notice:string};
export type RelatedContextResult=RelatedContext|{state:'unavailable';readOnly:true;notice:string};
export const RELATED_UNAVAILABLE='The selected context is unavailable or changed. Return to the current permitted view.';
const unavailable=():RelatedContextResult=>({state:'unavailable',readOnly:true,notice:RELATED_UNAVAILABLE});
const stable=(a:{id:string},b:{id:string})=>a.id<b.id?-1:a.id>b.id?1:0;
/** Related architecture or concept entities, using only explicit graph connections.
 * This is not a guessed ontology, causal graph or new canonical Project. A host may render this ViewSpec
 * in the companion pane with its existing node/list renderer. Scope expansion is explicit; hiding a pane
 * grants no scope. A graph with cycles remains a graph, never a falsely unique parent hierarchy.
 */
export function relatedContext(input:Project,value:unknown):RelatedContextResult{
 const parsed=relatedContextRequestSchema.safeParse(value);if(!parsed.success)return unavailable();
 const r=parsed.data;
 if(r.projectId!==input.id||r.baseRevision!==input.revision)return unavailable();
 const validated=validateDocument(input),doc=r.audience==='public'?publicDocument(validated):validated;
 const view=doc.views.find(v=>v.id===r.viewId);
 // Even project-wide search must begin with a visible selection in the actual anchor view.
 if(!view||!view.nodeIds.includes(r.nodeId))return unavailable();
 const allowedNodes=new Set(r.scope==='view'?view.nodeIds:doc.nodes.map(n=>n.id));
 const allowedEdges=new Set(r.scope==='view'?view.edgeIds:doc.edges.map(e=>e.id));
 const edges=doc.edges.filter(e=>allowedEdges.has(e.id)&&r.kinds.includes(e.kind)&&allowedNodes.has(e.source)&&allowedNodes.has(e.target)).sort(stable);
 const distances=new Map<string,number>([[r.nodeId,0]]);let frontier=[r.nodeId],truncated=false;
 for(let d=1;d<=r.depth&&frontier.length;d++){
  const next=new Set<string>();
  for(const id of frontier)for(const e of edges){
   if(r.direction!=='incoming'&&e.source===id&&!distances.has(e.target))next.add(e.target);
   if(r.direction!=='outgoing'&&e.target===id&&!distances.has(e.source))next.add(e.source);
  }
  frontier=[];
  for(const id of [...next].sort()){
   if(distances.size>=r.maxNodes){truncated=true;continue;}
   distances.set(id,d);frontier.push(id);
  }
 }
 const visibleEdges=edges.filter(e=>distances.has(e.source)&&distances.has(e.target));
 if(visibleEdges.length>r.maxEdges)truncated=true;
 const chosen=visibleEdges.slice(0,r.maxEdges);
 const ids=[...distances.keys()];
 // Prevent layout from suggesting a connection to a retained node when that edge was limited out.
 const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:(distances.get(id)??0)*300,y:i*140}]));
 let temporaryId='related-context';let n=2;while(doc.views.some(v=>v.id===temporaryId))temporaryId=`related-context-${n++}`;
 const local:Project={...doc,views:[...doc.views,{id:temporaryId,title:`Related to ${doc.nodes.find(n=>n.id===r.nodeId)!.label}`.slice(0,160),
  description:'Explicit supplied relationships. Layout and distance are navigation aids, not causal strength or timing.',
  nodeIds:ids,edgeIds:chosen.map(e=>e.id),positions,visibility:r.audience==='public'?'public':'private',perspective:view.perspective}]};
 const spec=viewSpec(local,temporaryId,{audience:'author',now:new Date(0)});
 // Native ViewSpec retains source-array order; this projection promises stable focus/depth order.
 spec.nodes=ids.map(id=>spec.nodes.find(n=>n.id===id)!);
 spec.edges=chosen.map(edge=>spec.edges.find(e=>e.id===edge.id)!);
 // Retain the real originating context; the ephemeral pane is not a traversable authoring route.
 spec.audience=r.audience;spec.publication.policy=r.audience==='public'?'publicDocument':'authoring';
 spec.path=viewSpec(doc,view.id,{audience:'author',now:new Date(0)}).path;
 spec.children=[];
 const memberships=ids.map(nodeId=>({nodeId,views:doc.views.filter(v=>v.nodeIds.includes(nodeId)).sort(stable).map(v=>({id:v.id,title:v.title}))}));
 const body={projectId:doc.id,baseRevision:doc.revision,viewId:r.viewId,nodeId:r.nodeId,audience:r.audience,scope:r.scope,spec,memberships,distance:Object.fromEntries(distances),truncated};
 return {state:'available',readOnly:true,...body,fingerprint:fnv64(canonical(body)),
  notice:'Read-only related-context view. Only explicit relationships are shown; not a causal proof, hierarchy, access grant or inferred concept mapping. '+
   (truncated?'The selected display limit was reached. Use the relation list or narrow the scope.':'Depth, direction and relation filters limit this view; it is not an exhaustive system map.')};
}
/** Selection requests resolve by exact node identity and current projection fingerprint; never by labels.
 * The caller owns Follow / Pin and route history. This only proposes inspection, never applies an edit.
 */
export function resolveRelatedPick(current:RelatedContextResult,message:unknown):{nodeId:string;sourceViewId:string}|null{
 if(current.state!=='available'||!message||typeof message!=='object'||Array.isArray(message))return null;
 const m=message as Record<string,unknown>;
 if(Object.keys(m).sort().join(',')!=='fingerprint,nodeId'||m.fingerprint!==current.fingerprint||typeof m.nodeId!=='string'||!current.spec.nodes.some(n=>n.id===m.nodeId))return null;
 return {nodeId:m.nodeId,sourceViewId:current.viewId};
}
