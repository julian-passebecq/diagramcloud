import type {Project} from '../core/model';
import {overviewProjection} from './projectOverview';
import {xml} from './diagram';
export type HowItWorksOptions={mode:'story'|'path';viewId?:string;startNodeId?:string};
/** Only authored story order or a selected directed path, never runtime timing. */
export function howItWorksFacts(input:Project,options:HowItWorksOptions,publicMode=false){
 const project=overviewProjection(input,publicMode),steps:{key:string;title:string;business:string;technical:string;viewId:string;nodeId?:string;sourceIds:string[];basis:string;observationIds:string[]}[]=[],notes:string[]=[];
 const append=(viewId:string,nodeId:string|undefined,title:string,narration:string,key:string,observations:string[]=[])=>{const node=project.nodes.find(n=>n.id===nodeId),view=project.views.find(v=>v.id===viewId);if(!view)return;
  const sourceIds=[...new Set([...(node?.sourceIds??[]),...(node?.blockIds.flatMap(id=>project.blocks.find(b=>b.id===id)?.sourceIds??[])??[])])];
  steps.push({key,title,business:narration||node?.role||node?.summary||'Business contribution not supplied.',technical:node?[node.kind,node.provider||'Provider not supplied',node.summary||'Technical constraint not supplied.'].join(' · '):view.description||'Technical caption not supplied.',viewId,...(node?{nodeId:node.id}:{}),sourceIds,basis:node?.basis??'unknown',observationIds:observations.filter(id=>project.observations.some(o=>o.id===id&&o.reviewedAt))});};
 if(options.mode==='story'){
  project.story.slice(0,6).forEach((s,i)=>append(s.viewId,s.nodeId,s.title,s.narration,'story-'+i,s.observationIds));
  if(project.story.length>6)notes.push(`${project.story.length-6} further authored story steps remain in Present mode.`);
  notes.push('Order is the authored story, not execution timing.');
 }else{
  const view=project.views.find(v=>v.id===(options.viewId??project.rootViewId));if(!view)throw new Error('Selected view unavailable');
  if(options.startNodeId&&!view.nodeIds.includes(options.startNodeId))throw new Error('Selected path start unavailable');
  const edges=project.edges.filter(e=>view.edgeIds.includes(e.id)),starts=view.nodeIds.filter(id=>!edges.some(e=>e.target===id));let current=options.startNodeId??(starts.length===1?starts[0]:undefined);const visited=new Set<string>();
  if(!current)notes.push('Select a starting component: this view has multiple or no unambiguous starts.');
  while(current&&steps.length<6){if(visited.has(current)){notes.push('A cycle ends this bounded path.');break;}visited.add(current);const node=project.nodes.find(n=>n.id===current)!;append(view.id,node.id,node.label,node.role||node.summary,node.id);
   const next=edges.filter(e=>e.source===current);if(next.length>1){notes.push('The path ends at a branch. Select another start to explain that branch.');break;}current=next[0]?.target;
  }
  if(current&&steps.length===6)notes.push('Six-step sheet limit reached; remaining connections stay in the diagram.');
  notes.push('Order follows selected connections for reading. Runtime traffic, timing and causality remain unknown.');
 }
 if(steps.length<3)notes.push('Partial sheet: fewer than three supplied steps. Add an authored story or select another existing path.');
 return {project,steps,notes,complete:steps.length>=3};
}
export function howItWorksHtml(input:Project,options:HowItWorksOptions){
 const {project,steps,notes}=howItWorksFacts(input,options,true);
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xml(project.title)} · How it works</title><style>body{font:16px/1.6 system-ui;color:#182b40;margin:0}main{max-width:960px;margin:auto;padding:24px}article{border-top:1px solid #dde4ec;padding:20px 0}code{overflow-wrap:anywhere}small{color:#526579}@media print{article{break-inside:avoid}}</style></head><body><main><small>Public sheet · document revision ${project.revision}</small><h1>${xml(project.title)} · How it works</h1><p>${xml(project.summary)}</p>${steps.map((s,i)=>`<article id="step-${i+1}"><h2>${i+1}. ${xml(s.title)}</h2><p>${xml(s.business)}</p><p><b>Technical caption:</b> ${xml(s.technical)}</p><small>Basis: ${xml(s.basis)} · view <code>${xml(s.viewId)}</code>${s.nodeId?` · component <code>${xml(s.nodeId)}</code>`:''}. Designed/static facts remain distinct from observed claims.</small><ul>${s.sourceIds.map(id=>project.sources.find(source=>source.id===id)).filter(source=>!!source).map(source=>`<li>${xml(source!.title)} · <code>${xml(source!.location)}</code></li>`).join('')||'<li>No public source attached.</li>'}</ul>${s.observationIds.map(id=>project.observations.find(o=>o.id===id)!).map(o=>`<p>External ${xml(o.claim)} claim · ${xml(o.observedAt)} · ${xml(o.authority)}: ${xml(o.summary)} ${xml(o.caveat)}</p>`).join('')}</article>`).join('')||'<p>No supplied steps in this public projection.</p>'}<h2>Reading limits</h2><ul>${notes.map(note=>`<li>${xml(note)}</li>`).join('')}</ul><p>${xml(project.provenance)}</p></main></body></html>`;
}
