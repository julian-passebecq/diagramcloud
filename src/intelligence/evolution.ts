import {validateDocument,type Project} from '../core/model';
import {readAcquisitionAnalysis} from './materialize';
/** Source-qualified identity is the stable component ID plus its cited source
 * locators. Layout is a distinct change. Missing scope is never deletion. */
export function semanticEvolution(before:Project,after:Project){
 validateDocument(before);validateDocument(after);if(before.id!==after.id)throw new Error('Evolution requires versions of the same project');
 const a=readAcquisitionAnalysis(before),b=readAcquisitionAnalysis(after),reasons:string[]=[];
 const av=before.atlas?.snapshots.find(s=>s.id===before.atlas?.activeSnapshotId),bv=after.atlas?.snapshots.find(s=>s.id===after.atlas?.activeSnapshotId);
 if(a&&b&&(a.sourceIdentity.selectedRoot!==b.sourceIdentity.selectedRoot||a.sourceIdentity.analyzerVersion!==b.sourceIdentity.analyzerVersion||a.sourceIdentity.profile!==b.sourceIdentity.profile))reasons.push('Different acquisition source, parser or profile');
 if((av||bv)&&JSON.stringify(av?.repositories.map(r=>r.id).sort())!==JSON.stringify(bv?.repositories.map(r=>r.id).sort()))reasons.push('Different explicit repository membership');
 const state=reasons.length?'incomparable':a&&b&&a.sourceIdentity.scopeComplete&&b.sourceIdentity.scopeComplete?'comparable':'partial';
 if(state==='partial')reasons.push('Completeness not established for both selected source scopes');
 const signature=(doc:Project,n:Project['nodes'][number])=>JSON.stringify({label:n.label,kind:n.kind,summary:n.summary,basis:n.basis,
  sources:n.sourceIds.map(id=>doc.sources.find(s=>s.id===id)?.location).sort(),evidence:n.blockIds.map(id=>doc.blocks.find(b=>b.id===id)),
  claims:doc.observations.filter(o=>o.nodeId===n.id&&o.reviewedAt).map(o=>({sourceApp:o.sourceApp,authority:o.authority,claim:o.claim,sourceRevision:o.sourceRevision,observedAt:o.observedAt}))});
 const old=new Map(before.nodes.map(n=>[n.id,n])),next=new Set(after.nodes.map(n=>n.id));
 const changes:{id:string;change:'added'|'changed'|'not-in-scope'|'moved';reason:string}[]=[];
 if(state!=='incomparable'){
  for(const n of after.nodes){const prev=old.get(n.id);if(!prev)changes.push({id:n.id,change:'added',reason:'New stable component ID'});
   else if(signature(before,prev)!==signature(after,n))changes.push({id:n.id,change:'changed',reason:'Source-qualified meaning, evidence or reviewed claim differs'});
   for(const v of after.views){const prior=before.views.find(x=>x.id===v.id),x=prior?.positions[n.id],y=v.positions[n.id];if(x&&y&&(x.x!==y.x||x.y!==y.y))changes.push({id:n.id,change:'moved',reason:'Presentation position changed in '+v.id});}}
  for(const n of before.nodes)if(!next.has(n.id))changes.push({id:n.id,change:'not-in-scope',reason:'Not present in this version; removal is not established without an explicit source tombstone'});
  const edgeMeaning=(e:Project['edges'][number])=>JSON.stringify({...e});
  for(const edge of after.edges){const prior=before.edges.find(e=>e.id===edge.id);if(!prior||edgeMeaning(prior)!==edgeMeaning(edge))changes.push({id:edge.id,change:prior?'changed':'added',reason:'Connection endpoints, declared basis, quantity provenance or presentation differ'});}
  for(const edge of before.edges)if(!after.edges.some(e=>e.id===edge.id))changes.push({id:edge.id,change:'not-in-scope',reason:'Connection absent; deletion is not established'});
 }
 return {format:'diagramcloud.semantic-evolution/1',projectId:before.id,state,reasons,changes,
  before:{documentRevision:before.revision,sourceIdentity:a?.sourceIdentity,revisionVector:av?.repositories.map(r=>({id:r.id,revision:r.revision??'UNKNOWN'}))??[]},
  after:{documentRevision:after.revision,sourceIdentity:b?.sourceIdentity,revisionVector:bv?.repositories.map(r=>({id:r.id,revision:r.revision??'UNKNOWN'}))??[]},
  note:'No single project revision, deployment order, causal effect, downtime or productivity is inferred'};
}
