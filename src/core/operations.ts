import {clone,validateDocument,type Project,type ProjectView} from './model';
import {publicPack} from '../experience/model';
export function positionFor(view:ProjectView,nodeId:string){const i=Math.max(0,view.nodeIds.indexOf(nodeId));return view.positions[nodeId]??{x:(i%3)*290,y:Math.floor(i/3)*170};}
export function traceNodes(doc:Project,viewId:string,start:string,direction:'upstream'|'downstream'):Set<string>{const view=doc.views.find(v=>v.id===viewId),edges=doc.edges.filter(e=>view?.edgeIds.includes(e.id)),seen=new Set([start]),queue=[start];while(queue.length){const current=queue.shift();for(const e of edges){const next=direction==='downstream'?(e.source===current?e.target:null):(e.target===current?e.source:null);if(next&&!seen.has(next)){seen.add(next);queue.push(next);}}}return seen;}
export function pathToView(doc:Project,target:string):string[]{function visit(viewId:string,path:string[]):string[]|null{if(viewId===target)return[...path,viewId];if(path.includes(viewId))return null;const v=doc.views.find(v=>v.id===viewId);for(const n of doc.nodes.filter(n=>v?.nodeIds.includes(n.id)))if(n.childViewId){const result=visit(n.childViewId,[...path,viewId]);if(result)return result;}return null;}return visit(doc.rootViewId,[])??[target];}
export function removeNode(input:Project,nodeId:string):Project{const d=clone(input),removedEdges=new Set(d.edges.filter(e=>e.source===nodeId||e.target===nodeId).map(e=>e.id));d.nodes=d.nodes.filter(n=>n.id!==nodeId);d.edges=d.edges.filter(e=>!removedEdges.has(e.id));for(const v of d.views){v.nodeIds=v.nodeIds.filter(id=>id!==nodeId);v.edgeIds=v.edgeIds.filter(id=>!removedEdges.has(id));delete v.positions[nodeId];}const removedObs=new Set(d.observations.filter(o=>o.nodeId===nodeId).map(o=>o.id));d.observations=d.observations.filter(o=>!removedObs.has(o.id));d.story=d.story.filter(s=>s.nodeId!==nodeId).map(s=>({...s,highlightEdgeIds:s.highlightEdgeIds.filter(id=>!removedEdges.has(id)),...(s.observationIds?{observationIds:s.observationIds.filter(id=>!removedObs.has(id))}:{})}));if(d.delivery){d.delivery.instances=d.delivery.instances.filter(i=>i.nodeId!==nodeId&&i.componentId!==nodeId);if(d.delivery.applicability)d.delivery.applicability=d.delivery.applicability.filter(i=>i.componentId!==nodeId);if(d.delivery.configurations)d.delivery.configurations=d.delivery.configurations.filter(i=>i.componentId!==nodeId);for(const p of d.delivery.promotions)for(const g of p.gates)if(g.observationId&&removedObs.has(g.observationId))delete g.observationId;}return validateDocument(d);}
/** Remove private and unreachable content, rather than hiding it with CSS. */
export function publicDocument(input:Project):Project{
 const d=clone(input);delete d.privateNotes;delete d.portfolio;
 // Import receipts contain private scope and historical counts, never publication
 // content. Visibility edits cannot accidentally publish this internal context.
 for(const b of d.blocks)if(b.id.startsWith('analysis-graph-state-')||b.id.startsWith('analysis-evolution-'))b.visibility='private';
 // A public component does not publish the text of a still-private cited source.
 // Authors can explicitly detach the citation when approving their own caption.
 const privateSources=new Set(input.sources.filter(s=>s.visibility!=='public').map(s=>s.id));
 for(const n of d.nodes)if(n.sourceIds.some(id=>privateSources.has(id))){n.summary='';n.role='';}
 for(const b of d.blocks)if(b.sourceIds.some(id=>privateSources.has(id)))b.visibility='private';
 if(d.experience){try{d.experience=publicPack(d.experience);}catch{delete d.experience;}}
 for(const node of d.nodes)if(node.experienceWorkspaceId&&!d.experience?.workspaces.some(w=>w.id===node.experienceWorkspaceId))delete node.experienceWorkspaceId;
 const publicViews=new Set(d.views.filter(v=>v.visibility==='public').map(v=>v.id)),keptViews=new Set<string>(),keptNodes=new Set<string>();
 function walk(viewId:string){if(keptViews.has(viewId)||!publicViews.has(viewId))return;keptViews.add(viewId);const v=d.views.find(v=>v.id===viewId)!;for(const n of d.nodes.filter(n=>n.visibility==='public'&&v.nodeIds.includes(n.id))){keptNodes.add(n.id);if(n.childViewId)walk(n.childViewId);}}
 walk(d.rootViewId);d.nodes=d.nodes.filter(n=>keptNodes.has(n.id));for(const n of d.nodes)if(n.childViewId&&!keptViews.has(n.childViewId))delete n.childViewId;
 d.views=d.views.filter(v=>keptViews.has(v.id));const membership=new Set(d.views.flatMap(v=>v.edgeIds));d.edges=d.edges.filter(e=>e.visibility==='public'&&keptNodes.has(e.source)&&keptNodes.has(e.target)&&membership.has(e.id));const edges=new Set(d.edges.map(e=>e.id));
 for(const v of d.views){v.nodeIds=v.nodeIds.filter(id=>keptNodes.has(id));v.edgeIds=v.edgeIds.filter(id=>edges.has(id));v.positions=Object.fromEntries(Object.entries(v.positions).filter(([id])=>v.nodeIds.includes(id)));if(v.design)v.design={...v.design,focal:v.design.focal.filter(id=>v.nodeIds.includes(id))};}
 const blockRefs=new Set(d.nodes.flatMap(n=>n.blockIds)),publicAssets=new Set(d.assets.filter(a=>a.visibility==='public').map(a=>a.id));d.blocks=d.blocks.filter(b=>b.visibility==='public'&&blockRefs.has(b.id)&&(b.type!=='image'||publicAssets.has(b.assetId)));
 const blocks=new Set(d.blocks.map(b=>b.id));d.nodes.forEach(n=>n.blockIds=n.blockIds.filter(id=>blocks.has(id)));for(const n of d.nodes)if(n.customIconAssetId&&!publicAssets.has(n.customIconAssetId))delete n.customIconAssetId;const assetRefs=new Set([...d.blocks.flatMap(b=>b.type==='image'?[b.assetId]:[]),...d.nodes.flatMap(n=>n.customIconAssetId?[n.customIconAssetId]:[])]);d.assets=d.assets.filter(a=>assetRefs.has(a.id));d.assets.forEach(asset=>{delete asset.remote;});
 // Prune delivery closure before collecting sources: a dropped private declaration
 // must not publish an otherwise unused public source title or locator.
 if(d.delivery){
  const privateRepositoryIds=new Set(input.atlas?.snapshots.find(s=>s.id===input.atlas!.activeSnapshotId)?.repositories.filter(r=>r.nodeId?!keptNodes.has(r.nodeId):r.visibility!=='public').map(r=>r.id)??[]);
  const visible=<T extends {visibility:string;sourceIds:string[]}>(rows:T[])=>rows.filter(r=>r.visibility==='public'&&!r.sourceIds.some(id=>privateSources.has(id)));
  d.delivery.environments=visible(d.delivery.environments).map(e=>({...e,...(e.bindings?{bindings:visible(e.bindings)}:{})}));d.delivery.artifacts=visible(d.delivery.artifacts).map(a=>{if(a.sourceRepositoryId&&privateRepositoryIds.has(a.sourceRepositoryId))delete a.sourceRepositoryId;return a;});
  const envs=new Set(d.delivery.environments.map(e=>e.id)),artifacts=new Set(d.delivery.artifacts.map(a=>a.id));
  if(d.delivery.releases)d.delivery.releases=visible(d.delivery.releases).map(r=>({...r,artifactIds:r.artifactIds.filter(id=>artifacts.has(id))}));
  const releases=new Set(d.delivery.releases?.map(r=>r.id)??[]);
  if(d.delivery.applicability)d.delivery.applicability=visible(d.delivery.applicability).filter(r=>envs.has(r.environmentId)&&keptNodes.has(r.componentId));
  if(d.delivery.configurations)d.delivery.configurations=visible(d.delivery.configurations).filter(r=>envs.has(r.environmentId)&&keptNodes.has(r.componentId));
  d.delivery.instances=visible(d.delivery.instances).filter(i=>keptNodes.has(i.nodeId)&&keptNodes.has(i.componentId)&&envs.has(i.environmentId)).map(i=>{if(i.artifactId&&!artifacts.has(i.artifactId))delete i.artifactId;if(i.releaseId&&!releases.has(i.releaseId))delete i.releaseId;return i;});
  d.delivery.promotions=visible(d.delivery.promotions).filter(p=>envs.has(p.fromEnvironmentId)&&envs.has(p.toEnvironmentId)).map(p=>{if(p.artifactId&&!artifacts.has(p.artifactId))delete p.artifactId;if(p.releaseId&&!releases.has(p.releaseId))delete p.releaseId;return p;});
  if(!d.delivery.environments.length)delete d.delivery;
 }
 const sourceRefs=new Set([...d.nodes.flatMap(n=>n.sourceIds),...d.blocks.flatMap(b=>b.sourceIds),...(d.delivery?[...d.delivery.environments,...d.delivery.artifacts,...d.delivery.instances,...d.delivery.promotions,...(d.delivery.releases??[]),...(d.delivery.applicability??[]),...(d.delivery.configurations??[]),...d.delivery.environments.flatMap(e=>e.bindings??[])].flatMap(r=>r.sourceIds):[])]);d.sources=d.sources.filter(s=>s.visibility==='public'&&sourceRefs.has(s.id));const sources=new Set(d.sources.map(s=>s.id));[...d.nodes,...d.blocks,...(d.delivery?[...d.delivery.environments,...d.delivery.artifacts,...d.delivery.instances,...d.delivery.promotions,...(d.delivery.releases??[]),...(d.delivery.applicability??[]),...(d.delivery.configurations??[]),...d.delivery.environments.flatMap(e=>e.bindings??[])]:[])].forEach(item=>item.sourceIds=item.sourceIds.filter(id=>sources.has(id)));
 // Only reviewed, public observations about kept components are Presented; everything else stays in the authoring document.
 d.observations=d.observations.filter(o=>o.visibility==='public'&&!!o.reviewedAt&&keptNodes.has(o.nodeId)).map(o=>({...o,blockIds:o.blockIds.filter(id=>blocks.has(id))}));const observations=new Set(d.observations.map(o=>o.id));
 if(d.delivery)for(const p of d.delivery.promotions)for(const g of p.gates)if(g.observationId&&!observations.has(g.observationId))delete g.observationId;
 // Atlas: only the active snapshot, only repositories whose component is public; runtime/context pointers stay in authoring JSON.
 if(d.atlas){const active=d.atlas.snapshots.find(s=>s.id===d.atlas!.activeSnapshotId)!;// A repository reaches public output through its public card, or, without a card, only when its author marked it public.
 const repositories=active.repositories.filter(r=>r.nodeId?keptNodes.has(r.nodeId):r.visibility==='public');
  if(repositories.length)d.atlas={snapshots:[{...active,repositories,runtimeRefs:[],contextRefs:[]}],activeSnapshotId:active.id};else delete d.atlas;}
 d.story=d.story.filter(s=>keptViews.has(s.viewId)&&(!s.nodeId||keptNodes.has(s.nodeId))).map(s=>({...s,highlightEdgeIds:s.highlightEdgeIds.filter(id=>edges.has(id)),...(s.observationIds?{observationIds:s.observationIds.filter(id=>observations.has(id))}:{})}));return validateDocument(d);
}
export type History={past:Project[];present:Project;future:Project[]};
export function commitHistory(h:History,input:Project):History{return{past:[...h.past,h.present].slice(-25),present:validateDocument({...input,revision:h.present.revision+1}),future:[]};}
export function undo(h:History):History{return h.past.length?{past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future]}:h;}
export function redo(h:History):History{return h.future.length?{past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)}:h;}
