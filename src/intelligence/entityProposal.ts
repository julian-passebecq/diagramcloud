import {z} from 'zod';
import {validateDocument,type Project} from '../core/model';
import {applyDocumentPatch,type Patch,type Operation} from '../core/patch';
import {secretFindings} from '../core/secrets';
const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,60}$/),sourceId=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/),citation=z.object({sourceId,line:z.number().int().positive(),endLine:z.number().int().positive(),quote:z.string().min(1).max(1000)}).strict();
export const entityProposalSchema=z.object({format:z.literal('diagramcloud.entity-proposal'),version:z.literal(1),projectId:sourceId,baseRevision:z.number().int().nonnegative(),
 entities:z.array(z.object({id,label:z.string().min(1).max(160),kind:z.enum(['source','process','storage','model','report','app','control','function','table']),citations:z.array(citation).min(1).max(5)}).strict()).min(1).max(50),
 relations:z.array(z.object({id,from:id,to:id,label:z.string().max(160),citations:z.array(citation).min(1).max(5)}).strict()).max(100)}).strict();
/** The agent supplies candidates and precise citations; author review decides adoption.
 * No prose similarity becomes a source assertion and no code is executed. */
export function stageEntityProposal(project:Project,input:unknown,selectedSources:Record<string,string>){
 const doc=validateDocument(project),p=entityProposalSchema.parse(input);if(p.projectId!==doc.id||p.baseRevision!==doc.revision)throw new Error('Entity proposal project/revision differs');
 if(secretFindings(p).length)throw new Error('Entity proposal contains secret values');
 const entities=new Set(p.entities.map(e=>e.id));if(entities.size!==p.entities.length||new Set(p.relations.map(r=>r.id)).size!==p.relations.length)throw new Error('Duplicate candidate identity');
 const operations:Operation[]=[];
 const validateCitations=(rows:z.infer<typeof citation>[])=>{for(const c of rows){const source=doc.sources.find(s=>s.id===c.sourceId);if(!source||!Object.hasOwn(selectedSources,c.sourceId))throw new Error('Citation source was not explicitly selected');const text=selectedSources[c.sourceId];if(new TextEncoder().encode(text).byteLength>131072||secretFindings(text).length)throw new Error('Selected citation source unsafe or too large');const lines=text.split(/\r?\n/);if(c.endLine<c.line||c.endLine>lines.length||!lines.slice(c.line-1,c.endLine).join('\n').includes(c.quote))throw new Error('Citation quote is absent from exact line range');}};
 for(const e of p.entities){if(doc.nodes.some(n=>n.id===e.id))throw new Error('Candidate collides with authored component');validateCitations(e.citations);const blockId='candidate-'+e.id;
  if(doc.blocks.some(b=>b.id===blockId))throw new Error('Candidate evidence identity collision');
  operations.push({op:'add',path:'/blocks/-',value:{id:blockId,type:'text',title:'Source-cited candidate',text:e.citations.map(c=>'Source '+c.sourceId+':'+c.line+'–'+c.endLine+'\n'+c.quote).join('\n\n')+'\n\nCandidate extraction; semantic interpretation requires author review.',provenance:'source-derived',sourceIds:e.citations.map(c=>c.sourceId),visibility:'private'}});
  operations.push({op:'add',path:'/nodes/-',value:{id:e.id,label:e.label,kind:e.kind,summary:'Source-cited candidate; author review required',blockIds:[blockId],sourceIds:[...new Set(e.citations.map(c=>c.sourceId))],basis:'unknown',visibility:'private'}});
 }
 for(const r of p.relations){if(doc.edges.some(e=>e.id===r.id)||!entities.has(r.from)||!entities.has(r.to))throw new Error('Candidate relationship identity or endpoint invalid');validateCitations(r.citations);
  const blockId='relation-'+r.id;if(doc.blocks.some(b=>b.id===blockId))throw new Error('Relation evidence identity collision');
  operations.push({op:'add',path:'/blocks/-',value:{id:blockId,type:'text',title:'Candidate relationship citation',text:r.from+' → '+r.to+'\n'+r.citations.map(c=>'Source '+c.sourceId+':'+c.line+'–'+c.endLine+'\n'+c.quote).join('\n\n')+'\nSemantic interpretation is a candidate requiring author review.',provenance:'source-derived',sourceIds:[...new Set(r.citations.map(c=>c.sourceId))],visibility:'private'}});
  operations.push({op:'add',path:'/nodes/@'+r.from+'/blockIds/-',value:blockId});
  operations.push({op:'add',path:'/edges/-',value:{id:r.id,source:r.from,target:r.to,label:r.label+' (candidate)',kind:'dependency',basis:'unknown',visibility:'private'}});
 }
 const viewId='candidate-entities';if(doc.views.some(v=>v.id===viewId))throw new Error('Candidate view exists; review the prior proposal first');
 operations.push({op:'add',path:'/views/-',value:{id:viewId,title:'Source-cited extraction candidates',description:'Proposed interpretations from explicitly selected source text. Review required; not observed facts.',nodeIds:p.entities.map(e=>e.id),edgeIds:p.relations.map(r=>r.id),positions:Object.fromEntries(p.entities.map((e,i)=>[e.id,{x:i%3*300,y:Math.floor(i/3)*180}])),visibility:'private',perspective:'code'}});
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:'Review source-cited entity/relation candidates; no observed claims.',operations};applyDocumentPatch(doc,patch);return {patch,state:'REQUIRES_AUTHOR_REVIEW' as const,citations:p.relations.flatMap(r=>r.citations.map(c=>({relationId:r.id,...c})))};
}
