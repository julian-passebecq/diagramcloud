import {validateDocument,type Project} from '../core/model';
import type {AcquisitionAnalysis} from './acquisition';
import {z} from 'zod';

const PREFIX='analysis-context-';
/** Private derived context uses existing evidence persistence, never a new graph/model. */
export function materializeAnalysis(project:Project,analysis:AcquisitionAnalysis):Project{
  const doc=structuredClone(project),root=doc.nodes.find(n=>doc.views.find(v=>v.id===doc.rootViewId)?.nodeIds.includes(n.id));
  if(!root)throw new Error('Analysis requires a repository root.');
  // Selection authorizes inspection, not publication. Keep extracted facts private
  // until the human author changes visibility in Edit mode.
  // Stable selected-root identity; changing inspected bytes must never rename it.
  // An opaque name-derived identifier also avoids publishing the private folder name.
  let rootHash=2166136261;for(const character of analysis.sourceIdentity.selectedRoot)rootHash=Math.imul(rootHash^character.charCodeAt(0),16777619);
  doc.id=`repo-analysis-${(rootHash>>>0).toString(16)}`;
  doc.title='Selected repository analysis';doc.summary='Private source analysis. Review extracted facts and visibility in Edit mode before publication.';
  doc.provenance='Deterministic local source inspection; not runtime evidence or a clean-worktree attestation.';
  for(const node of doc.nodes)node.visibility='private';
  for(const edge of doc.edges)edge.visibility='private';
  for(const block of doc.blocks)block.visibility='private';
  for(const view of doc.views){view.description='Static source projection; extracted members are private until reviewed.';if(view.id!==doc.rootViewId)view.visibility='private';}
  doc.story=[];root.visibility='public';root.label='Selected repository';root.summary='Repository root. Review the private source analysis before publishing extracted facts.';
  const id='analysis-scope';
  doc.blocks.push({id,title:'Inspected scope and limits',type:'text',text:'Only supported static declarations become components or connections. Documentation and source inventory remain private authoring context. Missing relationships remain unknown. Revision and dirty state are not a runtime attestation.',visibility:'public',sourceIds:[],provenance:'source-derived'});root.blockIds.push(id);
  // A docs-only or unknown source still has an honest root and an empty container view.
  if(doc.nodes.length===1){doc.summary='Selected repository inventory. No supported architecture or operational relationship was established; inspect the structure and evidence outputs for the selected scope.';root.summary='Repository root. Architecture unknown; inventory and selected documentation are available in authoring context.';}
  return attachAcquisitionContext(doc,analysis);
}
/** Attach selected documentation/inventory to one existing repository without
 * rebuilding its graph, renaming the project, or replacing authored facts.
 * New scans are private until the author reviews publication in Edit mode.
 */
export function attachAcquisitionContext(project:Project,analysis:AcquisitionAnalysis,repositoryId?:string):Project{
  // Keep context outside the scanner-owned `${repo}.` namespace: rescanRepository
  // removes that namespace before validation but retains the repository card.
  const doc=structuredClone(project),prefix=repositoryId?`analysis-repo-${repositoryId}-context-`:PREFIX;
  const root=repositoryId?doc.nodes.find(node=>node.id===`repo-${repositoryId}`):doc.nodes.find(node=>doc.views.find(view=>view.id===doc.rootViewId)?.nodeIds.includes(node.id));
  if(!root)throw new Error('Analysis requires a repository root.');
  const old=new Set(doc.blocks.filter(block=>block.id.startsWith(prefix)).map(block=>block.id));
  doc.blocks=doc.blocks.filter(block=>!old.has(block.id));for(const node of doc.nodes)node.blockIds=node.blockIds.filter(id=>!old.has(id));
  if(repositoryId){
    root.visibility='private';
    for(const node of doc.nodes)if(node.id.startsWith(`${repositoryId}.`))node.visibility='private';
    for(const edge of doc.edges)if(edge.id.startsWith(`${repositoryId}.`))edge.visibility='private';
    for(const view of doc.views)if(view.id.startsWith(`${repositoryId}.`))view.visibility='private';
    for(const block of doc.blocks)if(block.id.startsWith(`${repositoryId}.`)||block.id===`repo-${repositoryId}.facts`)block.visibility='private';
  }
  const serialized=JSON.stringify(analysis),chunks=serialized.match(/[\s\S]{1,48000}/g)??[];
  if(doc.blocks.length+chunks.length>1500||root.blockIds.length+chunks.length>1000||serialized.length>2000000)throw new Error('Analysis context exceeds document limits; select a narrower source.');
  chunks.forEach((code,index)=>{const id=`${prefix}${index}`;doc.blocks.push({id,title:`Private source analysis ${index+1}/${chunks.length}`,type:'code',language:'json',code,visibility:'private',sourceIds:[],provenance:'source-derived'});root.blockIds.push(id);});
  return validateDocument(doc);
}
/** Restores analysis after existing Project save/reload. Never use for public projection. */
export function readAcquisitionAnalysis(project:Project,repositoryId?:string):AcquisitionAnalysis|undefined{
  const prefix=repositoryId?`analysis-repo-${repositoryId}-context-`:PREFIX;
  const blocks=project.blocks.filter(b=>b.id.startsWith(prefix)&&b.visibility==='private').sort((a,b)=>Number(a.id.slice(prefix.length))-Number(b.id.slice(prefix.length)));
  if(!blocks.length||blocks.length>42)return undefined;
  try{const serialized=blocks.map(b=>b.type==='code'?b.code:'').join('');if(serialized.length>2000000)return undefined;const parsed=analysisSchema.safeParse(JSON.parse(serialized));return parsed.success?parsed.data:undefined;}catch{return undefined;}
}
const count=z.number().int().nonnegative(),path=z.string().max(512).refine(value=>!value.startsWith('/')&&!/^[a-z]:/i.test(value)&&!/[\u0000-\u001f]/.test(value)&&!value.split('/').some(part=>!part||part==='.'||part==='..'));
const analysisSchema=z.object({
  inventory:z.object({entries:z.array(z.object({path,bytes:count,state:z.enum(['scanned','document','unsupported','ignored','limited','unsafe'])})).max(2000),selectedFiles:count,readFiles:count,readBytes:count,omittedEntries:count,unsupported:count,ignored:count,limited:count}),
  sourceIdentity:z.object({selectedRoot:z.string().max(120),sourceRevision:z.string().regex(/^[a-f0-9]{40,64}$/).nullable(),contentDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),scopeComplete:z.boolean(),observedAt:z.string().datetime(),dirtyState:z.literal('unknown'),profile:z.enum(['quick','standard']),analyzerVersion:z.literal('diagramcloud-acquisition/1')}),
  technologies:z.array(z.string().max(160)).max(200),
  documentMap:z.object({format:z.literal('diagramcloud.document-map'),version:z.literal(1),documents:z.array(z.object({path,kind:z.enum(['markdown','csv']),headings:z.array(z.object({title:z.string().max(200),line:count,level:count})).max(500),records:z.array(z.object({id:z.string().max(200),startLine:count,endLine:count})).max(2000)})).max(200),links:z.array(z.object({fromPath:path,fromLine:count,toPath:path,toLine:count.optional(),kind:z.enum(['document-link','source-record'])})).max(4000),diagnostics:z.array(z.object({path:z.string().max(512),line:count.optional(),code:z.enum(['unresolved','ambiguous','unsupported','limited','unsafe','invalid']),message:z.string().max(2000)})).max(1000),omitted:z.object({documents:count,links:count,diagnostics:count}),limitations:z.array(z.string().max(2000)).max(20)}),
});
