import {z} from 'zod';
import {validateDocument,type Project} from '../core/model';
import {applyDocumentPatch,type Patch} from '../core/patch';
import {secretFindings} from '../core/secrets';
import {prefixed,repoNodeId} from '../core/atlas/compose';
import type {DomainResult} from './domainAdapters';
const id=z.string().regex(/^[a-z][a-z0-9-]{0,23}$/),sha=z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i),text=z.string().min(1).max(200);
const contractSchema=z.object({role:z.enum(['producer','consumer']),scheme:z.enum(['openapi-contract','nuget-package','npm-package']),identity:text,version:z.string().min(1).max(100),nodeKey:z.string().min(1).max(1000),path:z.string().min(1).max(512).refine(p=>!p.startsWith('/')&&!/[\\\u0000-\u001f]/.test(p)&&!p.split('/').some(x=>x==='.'||x==='..'||!x)),line:z.number().int().positive(),digest:z.string().regex(/^sha256:[a-f0-9]{64}$/i).optional()}).strict();
export const repositoryAnalysisSchema=z.object({format:z.literal('diagramcloud.repository-analysis/1'),repositoryId:id,revision:sha,analyzerVersion:z.literal('diagramcloud-domain/3'),contracts:z.array(contractSchema).max(200).refine(contracts=>new Set(contracts.map(c=>JSON.stringify([c.role,c.scheme,c.identity,c.version,c.nodeKey,c.path]))).size===contracts.length,'Duplicate contract declarations refused')}).strict();
export type RepositoryAnalysis=z.infer<typeof repositoryAnalysisSchema>;
export type CrossRepositoryCandidate={id:string;producerRepositoryId:string;consumerRepositoryId:string;scheme:RepositoryAnalysis['contracts'][number]['scheme'];identity:string;version:string;state:'candidate';basis:'static-source';evidence:{repositoryId:string;revision:string;path:string;line:number;role:'producer'|'consumer';nodeKey:string;digest?:string}[];reason:string};
function hash(s:string){let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return(n>>>0).toString(36);}
export function repositoryAnalysis(report:DomainResult,repositoryId:string,revision:string):RepositoryAnalysis{return repositoryAnalysisSchema.parse({format:'diagramcloud.repository-analysis/1',repositoryId,revision,analyzerVersion:report.analyzerVersion,contracts:report.contracts});}
/** Explicit members and source versions only. Identity/version equals are candidate
 * joins, never runtime traffic, installed package state or a permission decision. */
export function crossRepositoryCandidates(project:Project,inputs:unknown[]){
 validateDocument(project);if(inputs.length>30)throw new Error('Repository analysis selection exceeds 30 files');
 const snapshot=project.atlas?.snapshots.find(s=>s.id===project.atlas?.activeSnapshotId);if(!snapshot)throw new Error('Cross-repository resolution requires an explicitly declared project atlas');
 const reports=inputs.map(input=>{if(secretFindings(input).length)throw new Error('Sensitive repository analysis refused');return repositoryAnalysisSchema.parse(input);});
 if(new Set(reports.map(r=>r.repositoryId)).size!==reports.length)throw new Error('Duplicate repository analysis selection refused');
 for(const r of reports){const member=snapshot.repositories.find(m=>m.id===r.repositoryId);if(!member)throw new Error('Repository '+r.repositoryId+' is not a declared atlas member');if(!member.revision||member.revision.toLowerCase()!==r.revision.toLowerCase())throw new Error('Repository '+r.repositoryId+' revision differs or is unknown; rescan/select that exact source revision first');}
 const candidates:CrossRepositoryCandidate[]=[],unresolved:{repositoryId:string;identity:string;version:string;reason:string}[]=[];
 for(const consumerReport of reports)for(const consumer of consumerReport.contracts.filter(c=>c.role==='consumer')){
  const producers=reports.flatMap(report=>report.contracts.filter(p=>p.role==='producer'&&p.scheme===consumer.scheme&&p.identity===consumer.identity&&p.version===consumer.version&&report.repositoryId!==consumerReport.repositoryId).map(contract=>({report,contract})));
  if(producers.length!==1){unresolved.push({repositoryId:consumerReport.repositoryId,identity:consumer.identity,version:consumer.version,reason:producers.length?'Ambiguous exact producer key; no relationship guessed':'No selected external producer declaration with this exact scheme, identity and version'});continue;}
  const producer=producers[0];if(consumer.digest&&producer.contract.digest!==consumer.digest){unresolved.push({repositoryId:consumerReport.repositoryId,identity:consumer.identity,version:consumer.version,reason:'Consumer digest does not match a declared producer digest'});continue;}
  const key=JSON.stringify([producer.report.repositoryId,consumerReport.repositoryId,consumer.scheme,consumer.identity,consumer.version,consumer.nodeKey,consumer.path]);
  candidates.push({id:'cross-repo-'+hash(key)+'-'+hash(key.split('').reverse().join('')),producerRepositoryId:producer.report.repositoryId,consumerRepositoryId:consumerReport.repositoryId,scheme:consumer.scheme,identity:consumer.identity,version:consumer.version,state:'candidate',basis:'static-source',evidence:[{repositoryId:producer.report.repositoryId,revision:producer.report.revision,...producer.contract},{repositoryId:consumerReport.repositoryId,revision:consumerReport.revision,...consumer}],reason:'Exact selected '+consumer.scheme+' producer/consumer declaration and version. Requires author review; availability, installation, runtime traffic and health remain unknown.'});
 }
 return {format:'diagramcloud.cross-repository-candidates/1' as const,candidates:candidates.slice(0,200),unresolved:unresolved.slice(0,400),omitted:{candidates:Math.max(0,candidates.length-200),unresolved:Math.max(0,unresolved.length-400)}};
}
/** Creates an author-review patch only. Recomputes all candidates against the
 * current revision vector before accepting a selected opaque candidate ID. */
export function crossRepositoryPatch(project:Project,inputs:unknown[],selectedIds:string[]):Patch{
 const result=crossRepositoryCandidates(project,inputs),selected=result.candidates.filter(c=>selectedIds.includes(c.id));
 if(!selected.length||selected.length!==new Set(selectedIds).size)throw new Error('Select existing unambiguous relationship candidates');if(selected.length>80)throw new Error('Review at most 80 relationship candidates at once');
 const operations:Patch['operations']=[];
 for(const candidate of selected){if(project.edges.some(e=>e.id===candidate.id))throw new Error('Candidate relationship already exists; authored relationships are not overwritten');
  const source=repoNodeId(candidate.producerRepositoryId),target=repoNodeId(candidate.consumerRepositoryId),blockId=candidate.id+'-evidence',sourceIds:string[]=[];
  for(const ref of candidate.evidence){const sourceId=candidate.id+'-'+ref.role+'-source';if(project.sources.some(s=>s.id===sourceId))throw new Error('Candidate source identity collision');sourceIds.push(sourceId);operations.push({op:'add',path:'/sources/-',value:{id:sourceId,title:(ref.repositoryId+' '+ref.path).slice(0,160),location:(ref.repositoryId+'@'+ref.revision+':'+ref.path+':'+ref.line).slice(0,2000),visibility:'private'}});}
  if(project.blocks.some(b=>b.id===blockId))throw new Error('Candidate evidence identity collision');
  operations.push({op:'add',path:'/blocks/-',value:{id:blockId,title:'Reviewed static contract relationship proposal',type:'text',text:candidate.reason+'\n'+candidate.evidence.map(r=>r.role+' '+r.repositoryId+'@'+r.revision+' '+r.path+':'+r.line).join('\n'),provenance:'source-derived',sourceIds,visibility:'private'}});
  const node=project.nodes.find(n=>n.id===target);if(!node||!project.nodes.some(n=>n.id===source))throw new Error('Repository card missing from this project');
  operations.push({op:'add',path:'/nodes/@'+target+'/blockIds/-',value:blockId},{op:'add',path:'/edges/-',value:{id:candidate.id,source,target,label:(candidate.scheme+' '+candidate.identity+'@'+candidate.version).slice(0,160),kind:'dependency',speed:'medium',basis:'static-source',visibility:'private'}});
  for(const view of project.views.filter(v=>v.nodeIds.includes(source)&&v.nodeIds.includes(target)))operations.push({op:'add',path:'/views/@'+view.id+'/edgeIds/-',value:candidate.id});
 }
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:project.id,baseRevision:project.revision,summary:'Review '+selected.length+' exact static contract relationships; no runtime observation',operations};applyDocumentPatch(project,patch);return patch;
}
/** Recover explicit repository receipts already attached to this atlas. */
export function retainedRepositoryAnalyses(project:Project):RepositoryAnalysis[]{
 const snapshot=project.atlas?.snapshots.find(s=>s.id===project.atlas?.activeSnapshotId);if(!snapshot)return [];
 return snapshot.repositories.flatMap(r=>{const b=project.blocks.find(b=>b.id===prefixed(r.id,'domain-analysis-receipt'));if(!b||b.type!=='code'||b.provenance!=='source-derived'||!r.revision)return [];
  try{const raw=JSON.parse(b.code);if(raw.repositoryRevision!==r.revision)return [];return [repositoryAnalysisSchema.parse({format:'diagramcloud.repository-analysis/1',repositoryId:r.id,revision:r.revision,analyzerVersion:raw.analyzerVersion,contracts:raw.contracts})];}catch{return [];}});
}
