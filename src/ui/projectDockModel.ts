import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {variantState} from '../core/variants';
import {readEvolutionHistory} from '../intelligence/evolution';

export type DockAudience='author'|'public';
export type ProjectDockTool='variants'|'comparison'|'history'|'git'|'work';
export type DockTarget={viewId:string;nodeId?:string};
/** A read-only projection over the existing Project. No collection, Git probing or alternate persistence. */
export function projectDockModel(input:Project,audience:DockAudience,activeViewId:string,selectedNodeId?:string|null){
 const doc=audience==='public'?publicDocument(input):input;
 const view=doc.views.find(v=>v.id===activeViewId)??doc.views.find(v=>v.id===doc.rootViewId)??doc.views[0];
 const target=(nodeId:string):DockTarget|undefined=>{
  if(!doc.nodes.some(n=>n.id===nodeId))return undefined;
  const host=view?.nodeIds.includes(nodeId)?view:doc.views.find(v=>v.nodeIds.includes(nodeId));
  return host?{viewId:host.id,nodeId}:undefined;
 };
 const selected=selectedNodeId?doc.nodes.find(n=>n.id===selectedNodeId):undefined;
 // Story participation here means an exact named component. View membership,
 // highlighted connection endpoints and shared labels do not infer participation.
 const story=doc.story.map((s,index)=>({index,title:s.title,narration:s.narration,target:{viewId:s.viewId,...(s.nodeId?{nodeId:s.nodeId}:{})},
  selectedSubject:!!selected&&s.nodeId===selected.id}));
 const selectedSteps=story.filter(s=>s.selectedSubject);
 const snapshot=doc.atlas?.snapshots.find(s=>s.id===doc.atlas?.activeSnapshotId);
 const sourceRows=doc.sources.map(source=>({...source,components:doc.nodes.filter(n=>n.sourceIds.includes(source.id)||n.blockIds.some(id=>doc.blocks.some(b=>b.id===id&&b.sourceIds.includes(source.id)))).map(n=>({id:n.id,label:n.label,target:target(n.id)}))}));
 const repositories=(snapshot?.repositories??[]).map(r=>({...r,target:r.nodeId?target(r.nodeId):undefined}));
 const workflow=doc.nodes.filter(n=>n.kind==='process'||n.kind==='control'||n.kind==='function').map(n=>({id:n.id,label:n.label,kind:n.kind,summary:n.summary,designedStatus:n.status,basis:n.basis??'unknown',target:target(n.id)}));
 const variants=audience==='author'?(doc.variants??[]).map(v=>{const state=variantState(doc,v.id);return {id:v.id,title:v.title,summary:v.summary,state:state.status,message:state.message,viewId:v.viewId};}):[];
 let historyState:'available'|'empty'|'invalid'|'private'=audience==='public'?'private':'empty';
 let snapshots:{id:string;label:string;capturedAt:string;documentRevision:number;revisionVector:{id:string;revision:string;authority:string}[]}[]=[];
 if(audience==='author')try{const history=readEvolutionHistory(doc,true);snapshots=history.snapshots.map(s=>({id:s.id,label:s.label,capturedAt:s.capturedAt,documentRevision:s.documentRevision,revisionVector:s.revisionVector.map(r=>({id:r.id,revision:r.revision,authority:r.authority}))}));historyState=snapshots.length?'available':'empty';}catch{historyState='invalid';}
 return {id:doc.id,title:doc.title,summary:doc.summary,provenance:doc.provenance,revision:audience==='author'?doc.revision:null,audience,activeView:view?{id:view.id,title:view.title,description:view.description}:null,selected:selected?{id:selected.id,label:selected.label,target:target(selected.id)}:null,
  views:doc.views.map(v=>({id:v.id,title:v.title,description:v.description,perspective:v.perspective??'system'})),story,selectedSteps,workflow,sources:sourceRows,repositories,snapshot:snapshot?{id:snapshot.id,capturedAt:snapshot.capturedAt,label:snapshot.label}:null,variants,snapshots,historyState};
}
