/** Data-only GraphSnapshot -> existing Project candidate. No new persistent graph.
 * Spec: galaxy-prompt-spec@92d256f, datapass.graph/1.
 * File import is user-selected, inert and PRIVATE. Nothing here grants scope or observation review.
 */
import {z} from 'zod';
import {documentSchema,validateDocument,type Project} from '../core/model';
import {secretFindings} from '../core/secrets';

export const GRAPH_SNAPSHOT_MAX_BYTES=4*1024*1024;
const name=z.string().min(1).max(200);
const ids=z.array(name).max(10000);
const instant=z.string().datetime({offset:true});
const safePath=name.max(512).refine(value=>
 !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('/') &&
 !value.includes('\\') && !value.split('/').some(s=>s==='..'||s==='.'||!s) &&
 !/[\u0000-\u001f]/.test(value),'A source is an inert relative path, not a URL or command');
const sourceRef=z.object({id:name,repo_id:name,revision:name,path:safePath,
 selector:z.string().min(1).max(512),content_sha256:z.string().regex(/^[a-f0-9]{64}$/),
 role:name,privacy_domain_id:name}).strict();
const factNode=z.object({id:name,kind:name,label:name,organization_id:name,
 privacy_domain_id:name,source_ref_ids:ids,state:z.string().max(160).nullable().optional(),
 parent_id:name.nullable().optional()}).strict();
const families=['knowledge','task','agent','lineage','decision','evaluation'] as const;
const assertion=z.object({id:name,from:name,predicate:name,to:name,
 family:z.enum(families),evidence_kind:z.enum(['ASSERTED','OBSERVED','DERIVED','INFERRED','UNKNOWN']),
 source_ref_ids:ids,observed_at:instant.nullable(),valid_from:instant.nullable().optional(),
 valid_to:instant.nullable().optional(),confidence_basis:z.string().max(2000).nullable().optional()}).strict();
export const graphSnapshotSchema=z.object({
 schema:z.literal('datapass.graph/1'),schema_minor:z.number().int().nonnegative().optional(),
 graph_id:name,generation_id:name,captured_at:instant,synthetic:z.boolean(),
 scope:z.object({organization_ids:ids,privacy_domain_ids:ids,project_ids:ids,
  scope_policy_hash:name}).strict(),
 source_vector:z.array(z.object({repo_id:name,revision:name}).strict()).max(10000),
 source_refs:z.array(sourceRef).max(10000),nodes:z.array(factNode).max(10000),
 assertions:z.array(assertion).max(50000),
 groups:z.array(z.object({id:name,label:name,node_ids:ids}).strict()).max(2000),
 complete_scope:z.boolean(),omitted:z.array(z.object({reason:name,source_id:name.optional()}).strict()).max(10000),
 predecessor_generation:name.nullable().optional(),removed_assertion_ids:ids.optional(),
 layout_hints:z.object({orientation:z.enum(['TB','LR']).optional(),
  group_by:z.enum(['organization','project','family','kind']).optional()}).strict().optional()
}).strict();
export type GraphSnapshot=z.infer<typeof graphSnapshotSchema>;

const unique=(items:string[],kind:string)=>{
 const values=new Set(items);if(values.size!==items.length)throw new Error('Duplicate '+kind+' IDs in GraphSnapshot');
 return values;
};
/** The source schema is necessary but never confers authorization or source freshness. */
export function validateGraphSnapshot(raw:unknown):GraphSnapshot{
 const serialized=JSON.stringify(raw);
 if(!serialized||new TextEncoder().encode(serialized).byteLength>GRAPH_SNAPSHOT_MAX_BYTES)
  throw new Error('GraphSnapshot exceeds 4 MiB; select a smaller, already-scoped export.');
 if(secretFindings(raw).length)throw new Error('GraphSnapshot refused: sensitive content detected.');
 const g=graphSnapshotSchema.parse(raw);
 const orgs=unique(g.scope.organization_ids,'organization scope');
 const domains=unique(g.scope.privacy_domain_ids,'privacy domain scope');
 unique(g.scope.project_ids,'project scope');
 const nodes=unique(g.nodes.map(n=>n.id),'node');
 const refs=unique(g.source_refs.map(s=>s.id),'source ref');
 unique(g.assertions.map(a=>a.id),'assertion');
 unique(g.groups.map(x=>x.id),'group');
 unique(g.source_vector.map(x=>x.repo_id),'source vector');
 // The source scope is the upper bound; imported group and node data never expand grants.
 if(g.nodes.some(n=>!orgs.has(n.organization_id)||!domains.has(n.privacy_domain_id))||
    g.source_refs.some(s=>!domains.has(s.privacy_domain_id)))
  throw new Error('GraphSnapshot contains content outside its declared privacy scope.');
 if(g.nodes.some(n=>n.parent_id&&!nodes.has(n.parent_id))||
    g.nodes.some(n=>n.source_ref_ids.some(id=>!refs.has(id)))||
    g.assertions.some(a=>!nodes.has(a.from)||!nodes.has(a.to)||
      a.source_ref_ids.some(id=>!refs.has(id)))||
    g.groups.some(x=>x.node_ids.some(id=>!nodes.has(id))))
  throw new Error('GraphSnapshot has unresolved node or source references; import refused without mutation.');
 if(g.source_refs.some(s=>!g.source_vector.some(v=>v.repo_id===s.repo_id&&v.revision===s.revision)))
  throw new Error('GraphSnapshot source references are inconsistent with the revision vector.');
 return g;
}
export function isGraphSnapshot(x:unknown):boolean{
 return !!x&&typeof x==='object'&&(x as {schema?:unknown}).schema==='datapass.graph/1';
}
// Two independent non-cryptographic hashes give stable, opaque, bounded local IDs.
// Collision detection is mandatory: never silently combine unrelated external entities.
function hash(seed:string):string{let h=2166136261;for(let i=0;i<seed.length;i++)h=Math.imul((h^seed.charCodeAt(i)),16777619);return (h>>>0).toString(36);}
const local=(kind:string,external:string)=>{
 const slug=external.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24)||'item';
 return kind+'-'+slug+'-'+hash(external)+'-'+hash(external.split('').reverse().join(''));
};
export const graphProjectId=(graphId:string)=>local('graph',graphId);
const PERSPECTIVES:Record<string,Project['views'][number]['perspective']>={
 organization:'system',task:'system',agent:'agents',knowledge:'code',
 decision:'decisions',evaluation:'evidence',lineage:'data'};
const VIEW_TYPES=['organization','task','agent','knowledge','decision','evaluation','lineage'] as const;
const VIEW_TITLES:Record<string,string>={
 organization:'Organization / architecture',task:'Work and dependencies',
 agent:'Agent topology snapshot',knowledge:'Knowledge and context',
 decision:'Decisions',evaluation:'Evaluation',lineage:'Data lineage'};
const belongs=(kind:string,family:string)=>family==='organization'?/^(organization|project|system|application|component)$/.test(kind):
 family==='task'?/^(workstream|feature|task|prompt|revision)$/.test(kind):
 family==='agent'?/^(native_session|agent|provider|session)$/.test(kind):
 family==='knowledge'?/^(source|document|context|knowledge)$/.test(kind):
 family==='decision'?/^(decision|adr)$/.test(kind):
 family==='evaluation'?/^(check_result|experiment|test|evaluation)$/.test(kind):
 /^(dataset|table|pipeline|model|report)$/.test(kind);

/** Compile a private review candidate; a new generation NEVER automatically deletes old work.
 * Existing stageGenerated(existing, candidate, preserve=true) owns the normal author merge.
 */
export function compileGraphSnapshot(raw:unknown):{document:Project;warnings:string[]}{
 const g=validateGraphSnapshot(raw);
 // This is a bounded Project projection, not an attempt to flatten a 10k-node graph.
 if(g.nodes.length>470||g.assertions.length>1250||g.source_refs.length>190)
  throw new Error('GraphSnapshot exceeds DiagramCloud Project limits; export a narrower scoped selection.');
 const nodeIDs=new Map(g.nodes.map(n=>[n.id,local('gn',g.graph_id+'/'+n.id)] as const));
 const sourceIDs=new Map(g.source_refs.map(s=>[s.id,local('gs',g.graph_id+'/'+s.id)] as const));
 const assertionIDs=new Map(g.assertions.map(a=>[a.id,local('ge',g.graph_id+'/'+a.id)] as const));
 const allIDs=[...nodeIDs.values(),...sourceIDs.values(),...assertionIDs.values()];
 unique(allIDs,'mapped local (hash collision)');
 const source='graph-import-header',headId='graph-private-entry';
 const nodes:Project['nodes']=g.nodes.map(n=>({
  id:nodeIDs.get(n.id)!,label:n.label.slice(0,160),
  kind:n.kind==='dataset'||n.kind==='table'?'table':n.kind==='organization'||n.kind==='project'?'control':
   n.kind==='revision'?'source':n.kind==='report'?'report':n.kind==='source'?'source':'process',
  provider:'Generic',icon:'generic',summary:'Imported '+n.kind+'; declared state '+(n.state??'unknown')+'. Not live.',
  status:'idle',role:'',sourceIds:n.source_ref_ids.map(id=>sourceIDs.get(id)!),blockIds:[],
  tags:['GraphSnapshot',n.kind.slice(0,65),g.synthetic?'Synthetic':'Imported'],basis:'unknown',visibility:'private'
 }));
 const edges:Project['edges']=g.assertions.map(a=>({
  id:assertionIDs.get(a.id)!,source:nodeIDs.get(a.from)!,target:nodeIDs.get(a.to)!,
  label:a.predicate.slice(0,160),kind:a.family==='lineage'?'batch':'dependency',
  speed:'medium',basis:a.evidence_kind==='ASSERTED'?'planned':'unknown',visibility:'private'
 }));
 const sources:Project['sources']=[
  {id:source,title:'Selected GraphSnapshot input',location:'Private user-selected data-only exchange.',visibility:'private'},
  ...g.source_refs.map(ref=>({id:sourceIDs.get(ref.id)!,title:('Source '+ref.role).slice(0,160),
   location:ref.repo_id+'@'+ref.revision+':'+ref.path+'#'+ref.selector,visibility:'private' as const}))
 ];
 const blocks:Project['blocks']=[{
  id:'graph-import-context',title:'GraphSnapshot generation and limits',type:'text',visibility:'private',
  sourceIds:[source],provenance:'source-derived',
  text:'Graph '+g.graph_id+'; generation '+g.generation_id+'; captured '+g.captured_at+
   '; scope policy '+g.scope.scope_policy_hash+'; complete scope '+g.complete_scope+
   '; omitted '+g.omitted.length+'. Origin is '+(g.synthetic?'synthetic':'source-provided')+
   '; imported evidence is not reviewed runtime or an authorization grant.'}];
 for(const a of g.assertions){
  const id=local('gb',g.graph_id+'/'+a.id),owner=nodes.find(n=>n.id===nodeIDs.get(a.from));
  if(!owner)throw new Error('Unresolved assertion source');
  const text=JSON.stringify({assertion_id:a.id,family:a.family,predicate:a.predicate,
   evidence_kind:a.evidence_kind,observed_at:a.observed_at,
   valid_from:a.valid_from??null,valid_to:a.valid_to??null,
   confidence_basis:a.confidence_basis??null,source_ref_ids:a.source_ref_ids});
  if(text.length>50000)throw new Error('Assertion evidence exceeds block limit');
  blocks.push({id,title:'Assertion evidence',type:'code',language:'json',code:text,
   visibility:'private',sourceIds:a.source_ref_ids.map(x=>sourceIDs.get(x)!),
   provenance:g.synthetic?'synthetic':'source-derived'});
  owner.blockIds.push(id);
 }
 const nav=VIEW_TYPES.map(f=>({
  id:'graph-nav-'+f,label:VIEW_TITLES[f],kind:'control' as const,provider:'Generic',icon:'generic',
  summary:'Snapshot view; no live queries or execution.',status:'idle' as const,role:'',
  blockIds:[],sourceIds:[source],tags:['GraphSnapshot','Navigation'],
  childViewId:'graph-view-'+f,visibility:'private' as const,basis:'unknown' as const
 }));
 const root:Project['nodes'][number]={id:headId,label:'Private GraphSnapshot review',
  kind:'control',provider:'Generic',icon:'generic',summary:'Open Edit to review imported private evidence; public exports omit it.',
  status:'idle',role:'',blockIds:['graph-import-context'],sourceIds:[],tags:['GraphSnapshot','Private'],
  visibility:'public',basis:'unknown'};
 const views:Project['views']=[{
  id:'graph-root',title:'Imported graph review',description:'Private GraphSnapshot. All source identities and facts are initially private.',
  perspective:'system',visibility:'public',nodeIds:[headId,...nav.map(n=>n.id)],edgeIds:[],
  positions:Object.fromEntries([headId,...nav.map(n=>n.id)].map((id,i)=>[id,{x:(i%3)*300,y:Math.floor(i/3)*180}]))
 }];
 for(const family of VIEW_TYPES){
  const assertions=g.assertions.filter(a=>family==='organization'?
   (g.nodes.find(n=>n.id===a.from)?.kind==='organization'||g.nodes.find(n=>n.id===a.to)?.kind==='organization') :
   a.family===family);
  const subset=new Set([
   ...g.nodes.filter(n=>belongs(n.kind,family)).map(n=>n.id),
   ...assertions.flatMap(a=>[a.from,a.to])
  ]);
  const ids=[...subset].map(id=>nodeIDs.get(id)!),eids=assertions.map(a=>assertionIDs.get(a.id)!);
  views.push({id:'graph-view-'+family,title:VIEW_TITLES[family],
   description:assertions.length?'Snapshot declarations and source-referred assertions. NOT live verification.':
    'No relationship of this family was established in the selected source scope.',
   perspective:PERSPECTIVES[family],visibility:'private',nodeIds:ids,edgeIds:eids,
   positions:Object.fromEntries(ids.map((id,i)=>[id,{x:(i%4)*280,y:Math.floor(i/4)*175}]))});
 }
 // Public root has only an inert explanatory card; detailed navigation and source
 // remain private until the author reviews visibility through the existing editor.
 const document=documentSchema.parse({schemaVersion:1,id:graphProjectId(g.graph_id),
  title:'Selected GraphSnapshot',summary:'Private snapshot import. No runtime state verified.',
  category:'Blank',rootViewId:'graph-root',nodes:[root,...nav,...nodes],edges,views,
  sources,blocks,provenance:'GraphSnapshot input '+g.schema+'. Selected file, not a live source.',
  tags:['GraphSnapshot']});
 return {document:validateDocument(document),warnings:[
  'Imported as private, unreviewed data. Review through existing import preview, Edit and publication gates.',
  'Scope and permissions are producer claims, not permissions granted by DiagramCloud.',
  g.complete_scope?'Source reports complete selected scope.':'Source reports PARTIAL scope; omitted facts are not deletions.',
  g.removed_assertion_ids?.length?'Tombstone IDs supplied but not executed: compare compatible generations before any removal.':'No removal operation.'
 ]};
}
