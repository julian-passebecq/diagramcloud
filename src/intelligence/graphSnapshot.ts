/** Data-only GraphSnapshot -> existing Project candidate. No new persistent graph.
 * Spec: galaxy-prompt-spec@92d256f, datapass.graph/1.
 * File import is user-selected, inert and PRIVATE. Nothing here grants scope or observation review.
 */
import {z} from 'zod';
import {documentSchema,validateDocument,type Project} from '../core/model';
import {secretFindings} from '../core/secrets';
import {previewCandidateReimport} from './bridge';
import {applyDocumentPatch,type Patch} from '../core/patch';

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
 unique(g.removed_assertion_ids??[],'tombstone');
 if(g.removed_assertion_ids?.some(id=>g.assertions.some(a=>a.id===id)))throw new Error('A present assertion cannot also be tombstoned.');
 if(g.predecessor_generation===g.generation_id)throw new Error('A generation cannot be its own predecessor.');
 // Validate long hierarchies once without recursion or repeated linear lookup.
 // A valid 10k-node selected file must not monopolize the browser on a chain.
 const parents=new Map(g.nodes.map(n=>[n.id,n.parent_id])),finished=new Set<string>();
 for(const n of g.nodes){if(finished.has(n.id))continue;const trail=new Set<string>();let id:string|undefined|null=n.id;
  while(id&&!finished.has(id)){if(trail.has(id))throw new Error('Cyclic GraphSnapshot parent hierarchy.');trail.add(id);id=parents.get(id);}
  for(const id of trail)finished.add(id);}
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
 const revisions=new Map(g.source_vector.map(v=>[v.repo_id,v.revision]));
 if(g.source_refs.some(s=>revisions.get(s.repo_id)!==s.revision))
  throw new Error('GraphSnapshot source references are inconsistent with the revision vector.');
 return g;
}
export function isGraphSnapshot(x:unknown):boolean{
 return !!x&&typeof x==='object'&&(x as {schema?:unknown}).schema==='datapass.graph/1';
}
// Two independent non-cryptographic hashes give stable, opaque, bounded local IDs.
// Collision detection is mandatory: never silently combine unrelated external entities.
function hash(seed:string):string{let h=2166136261;for(let i=0;i<seed.length;i++)h=Math.imul((h^seed.charCodeAt(i)),16777619);return (h>>>0).toString(36);}
export const graphLocalId=(kind:string,external:string)=>{
 const slug=external.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24)||'item';
 return kind+'-'+slug+'-'+hash(external)+'-'+hash(external.split('').reverse().join(''));
};
const local=graphLocalId;
const graphSourceId=(g:GraphSnapshot,ref:GraphSnapshot['source_refs'][number])=>local('gs',g.graph_id+'/'+ref.id+'/'+ref.repo_id+'/'+ref.revision+'/'+ref.path+'/'+ref.selector+'/'+ref.content_sha256);
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
 const sourceIDs=new Map(g.source_refs.map(s=>[s.id,graphSourceId(g,s)] as const));
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
 // Parent-retaining hierarchy only follows explicit parent_id declarations.
 // The parent is outside its own child view, so no recursive expansion is made.
 for(const parent of g.nodes){const children=g.nodes.filter(n=>n.parent_id===parent.id);if(!children.length||views.length>=70)continue;
  const ids=children.map(n=>nodeIDs.get(n.id)!),members=new Set(ids),viewId=local('gv',g.graph_id+'/'+parent.id);
  const childEdges=edges.filter(e=>members.has(e.source)&&members.has(e.target));
  views.push({id:viewId,title:('Inside '+parent.label).slice(0,160),description:'Explicit parent membership supplied by the snapshot; not an inferred dependency.',visibility:'private',nodeIds:ids,edgeIds:childEdges.map(e=>e.id),positions:Object.fromEntries(ids.map((id,i)=>[id,{x:i%4*280,y:Math.floor(i/4)*175}]))});
  nodes.find(n=>n.id===nodeIDs.get(parent.id))!.childViewId=viewId;
 }
 // Public root has only an inert explanatory card; detailed navigation and source
 // remain private until the author reviews visibility through the existing editor.
 const document=documentSchema.parse({schemaVersion:1,id:graphProjectId(g.graph_id),
  title:'Selected GraphSnapshot',summary:'Private snapshot import. No runtime state verified.',
  category:'Blank',rootViewId:'graph-root',nodes:[root,...nav,...nodes],edges,views,
  sources,blocks,provenance:'GraphSnapshot input '+g.schema+'. Selected file, not a live source.',
  tags:['GraphSnapshot']});
 writeGraphHistory(document,[graphGeneration(g)]);
 return {document:validateDocument(document),warnings:[
  'Imported as private, unreviewed data. Review through existing import preview, Edit and publication gates.',
  'Scope and permissions are producer claims, not permissions granted by DiagramCloud.',
  g.complete_scope?'Source reports complete selected scope.':'Source reports PARTIAL scope; omitted facts are not deletions.',
  g.removed_assertion_ids?.length?'Tombstone IDs supplied but not executed: compare compatible generations before any removal.':'No removal operation.'
 ]};
}

/** Private source mapping inside ordinary evidence blocks. Bounded generation
 * receipts describe imports; they are not another authoritative graph store.
 * Generated facts still live in Project nodes/edges/sources and evidence. */
export type GraphGeneration={
 format:'diagramcloud.graph-generation/1';graphId:string;generationId:string;capturedAt:string;
 parserVersion:string;minor:number;synthetic:boolean;scope:GraphSnapshot['scope'];complete:boolean;
 predecessor:string|null;omitted:GraphSnapshot['omitted'];tombstones:string[];
 sourceVector:GraphSnapshot['source_vector'];
 nodes:{externalId:string;localId:string;kind:string;organization:string;domain:string;state:string;
  parent:string|null;groups:string[];sourceIds:string[];signature:string}[];
 assertions:{externalId:string;localId:string;from:string;to:string;family:string;origin:string;
   sourceIds:string[];signature:string;evidenceSignature:string}[];
};
const STATE_PREFIX='analysis-graph-state-';
const generationReceiptSchema=z.object({format:z.literal('diagramcloud.graph-generation/1'),graphId:name,generationId:name,capturedAt:instant,
 parserVersion:name,minor:z.number().int().nonnegative(),synthetic:z.boolean(),scope:graphSnapshotSchema.shape.scope,complete:z.boolean(),predecessor:name.nullable(),
 omitted:graphSnapshotSchema.shape.omitted,tombstones:ids,sourceVector:graphSnapshotSchema.shape.source_vector,
 nodes:z.array(z.object({externalId:name,localId:name,kind:name,organization:name,domain:name,state:z.string().max(160),parent:name.nullable(),groups:ids,sourceIds:ids,signature:name}).strict()).max(470),
 assertions:z.array(z.object({externalId:name,localId:name,from:name,to:name,family:name,origin:name,sourceIds:ids,signature:name,evidenceSignature:name}).strict()).max(1250)
}).strict();
const signature=(value:unknown)=>{const s=JSON.stringify(value);return hash(s)+'-'+hash(s.split('').reverse().join(''));};
export function graphGeneration(g:GraphSnapshot):GraphGeneration{
 return {format:'diagramcloud.graph-generation/1',graphId:g.graph_id,generationId:g.generation_id,
  capturedAt:g.captured_at,parserVersion:'diagramcloud-graph/2',minor:g.schema_minor??0,synthetic:g.synthetic,
  scope:g.scope,complete:g.complete_scope,predecessor:g.predecessor_generation??null,omitted:g.omitted,
  tombstones:g.removed_assertion_ids??[],sourceVector:g.source_vector,
  nodes:g.nodes.map(n=>({externalId:n.id,localId:local('gn',g.graph_id+'/'+n.id),kind:n.kind,
   organization:n.organization_id,domain:n.privacy_domain_id,state:n.state??'UNKNOWN',parent:n.parent_id??null,
   groups:g.groups.filter(x=>x.node_ids.includes(n.id)).map(x=>x.id),
   sourceIds:n.source_ref_ids.map(x=>graphSourceId(g,g.source_refs.find(s=>s.id===x)!)),signature:signature(n)})),
  assertions:g.assertions.map(a=>({externalId:a.id,localId:local('ge',g.graph_id+'/'+a.id),
   from:local('gn',g.graph_id+'/'+a.from),to:local('gn',g.graph_id+'/'+a.to),family:a.family,origin:a.evidence_kind,
   sourceIds:a.source_ref_ids.map(x=>graphSourceId(g,g.source_refs.find(s=>s.id===x)!)),signature:signature(a),
   evidenceSignature:signature(JSON.stringify({assertion_id:a.id,family:a.family,predicate:a.predicate,evidence_kind:a.evidence_kind,observed_at:a.observed_at,valid_from:a.valid_from??null,valid_to:a.valid_to??null,confidence_basis:a.confidence_basis??null,source_ref_ids:a.source_ref_ids}))}))};
}
export function writeGraphHistory(doc:Project,history:GraphGeneration[]){
 const root=doc.nodes.find(n=>n.id==='graph-private-entry');if(!root)throw new Error('Missing graph review root');
 doc.blocks=doc.blocks.filter(b=>!b.id.startsWith(STATE_PREFIX));
 for(const node of doc.nodes)node.blockIds=node.blockIds.filter(id=>!id.startsWith(STATE_PREFIX));
 const raw=JSON.stringify(history.slice(-3));
 // Chunk the serialized receipt, rather than exceed Project's per-block text budget.
 for(let at=0;at<raw.length;at+=44000){const id=STATE_PREFIX+Math.floor(at/44000);
  doc.blocks.push({id,title:'Private import generation receipt',type:'code',language:'text',code:raw.slice(at,at+44000),
   provenance:history.at(-1)?.synthetic?'synthetic':'source-derived',sourceIds:[],visibility:'private'});root.blockIds.push(id);}
}
export function readGraphHistory(doc:Project):GraphGeneration[]{
 const parts=doc.blocks.filter(b=>b.id.startsWith(STATE_PREFIX)).sort((a,b)=>Number(a.id.slice(STATE_PREFIX.length))-Number(b.id.slice(STATE_PREFIX.length)));
 if(!parts.length)return [];
 try{const raw:unknown=JSON.parse(parts.map(b=>b.type==='code'?b.code:'').join(''));
  return z.array(generationReceiptSchema).max(3).parse(raw);
 }catch{return [];}
}
export type GraphDelta={state:'comparable'|'partial'|'incomparable';reasons:string[];before:string;after:string;
 changes:{kind:'node'|'assertion';id:string;change:'added'|'changed'|'not-in-scope'|'tombstone';localId:string}[]};
const sameSet=(a:string[],b:string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export function compareGraphGenerations(a:GraphGeneration,b:GraphGeneration):GraphDelta{
 const reasons:string[]=[];
 if(a.graphId!==b.graphId)reasons.push('Different graph identities');
 if(a.parserVersion!==b.parserVersion||a.minor!==b.minor)reasons.push('Different parser / contract versions');
 if(a.synthetic!==b.synthetic)reasons.push('Synthetic and source-provided generations are not interchangeable');
 if(a.scope.scope_policy_hash!==b.scope.scope_policy_hash||!sameSet(a.scope.organization_ids,b.scope.organization_ids)||
  !sameSet(a.scope.privacy_domain_ids,b.scope.privacy_domain_ids)||!sameSet(a.scope.project_ids,b.scope.project_ids))reasons.push('Different selected scope or policy');
 if(!sameSet(a.sourceVector.map(x=>x.repo_id),b.sourceVector.map(x=>x.repo_id)))reasons.push('Different repository membership');
 if(new Date(b.capturedAt).getTime()<new Date(a.capturedAt).getTime())reasons.push('Incoming capture predates the retained generation');
 const state=reasons.length?'incomparable':(!a.complete||!b.complete?'partial':'comparable');
 if(state==='partial')reasons.push('Incomplete selected scope: absence does not establish deletion');
 const changes:GraphDelta['changes']=[];
 if(state!=='incomparable')for(const kind of ['node','assertion'] as const){
  const prior=kind==='node'?a.nodes:a.assertions,next=kind==='node'?b.nodes:b.assertions;
  const old=new Map(prior.map(x=>[x.externalId,x]));const incoming=new Set(next.map(x=>x.externalId));
  for(const row of next){const prev=old.get(row.externalId);if(!prev||prev.signature!==row.signature)changes.push({kind,id:row.externalId,localId:row.localId,change:prev?'changed':'added'});}
  for(const row of prior)if(!incoming.has(row.externalId))changes.push({kind,id:row.externalId,localId:row.localId,
   change:kind==='assertion'&&state==='comparable'&&b.predecessor===a.generationId&&b.tombstones.includes(row.externalId)?'tombstone':'not-in-scope'});
 }

 return {state,reasons,before:a.generationId,after:b.generationId,changes};
}
/** An explicit reimport proposal. No removals, publication or observation review. */
export function previewGraphReimport(current:Project,raw:unknown,baseRevision:number){
 const g=validateGraphSnapshot(raw),candidate=compileGraphSnapshot(g),history=readGraphHistory(current),fresh=graphGeneration(g),prior=history.at(-1);
 if(!prior)throw new Error('This older graph import has no generation receipt. Import into a new project or recover the original input first.');
 if(prior.graphId!==fresh.graphId)throw new Error('Graph identity differs');
 if(prior.generationId===fresh.generationId&&signature(prior)!==signature(fresh))throw new Error('Generation identity conflict: the same generation ID has different content');
 for(const row of fresh.nodes){const old=prior.nodes.find(x=>x.externalId===row.externalId);if(old&&(old.kind!==row.kind||old.domain!==row.domain||old.organization!==row.organization))throw new Error('Conflicting semantic node identity: '+row.externalId);}
 for(const row of fresh.assertions){const old=prior.assertions.find(x=>x.externalId===row.externalId);if(old&&(old.from!==row.from||old.to!==row.to||old.family!==row.family))throw new Error('Conflicting assertion identity: '+row.externalId);}
 const delta=compareGraphGenerations(prior,fresh),proposal=previewCandidateReimport(current,candidate.document,baseRevision),merged=proposal.document;
 // Preserve author content; refresh only import-owned assertion evidence and sources
 // that are still private. Public facts require a separate author review.
 for(const b of candidate.document.blocks.filter(x=>!x.id.startsWith(STATE_PREFIX))){const old=merged.blocks.find(x=>x.id===b.id);
  const receipt=prior.assertions.find(a=>local('gb',prior.graphId+'/'+a.externalId)===b.id);
  if(old?.type==='code'&&old.visibility==='private'&&receipt&&signature(old.code)===receipt.evidenceSignature&&
   old.title==='Assertion evidence'&&old.language==='json'&&old.provenance===(prior.synthetic?'synthetic':'source-derived')&&
   JSON.stringify(old.sourceIds)===JSON.stringify(receipt.sourceIds))Object.assign(old,b);}
 for(const n of candidate.document.nodes){const old=merged.nodes.find(x=>x.id===n.id);if(old)old.sourceIds=[...new Set([...old.sourceIds,...n.sourceIds])];}
 writeGraphHistory(merged,prior.generationId===fresh.generationId?history:[...history,fresh]);
 // Use the original revision guard even after the conservative merge above.
 const operations:Patch['operations']=(['nodes','edges','views','blocks','sources'] as const).filter(k=>JSON.stringify(current[k])!==JSON.stringify(merged[k])).map(k=>({op:'replace',path:'/'+k,value:merged[k]}));
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:current.id,baseRevision,
  summary:'Review GraphSnapshot generation '+fresh.generationId+'; authored work retained; no removals',operations:operations.length?operations:[{op:'test',path:'/revision',value:baseRevision}]};
 return {document:applyDocumentPatch(current,patch).result,patch,delta,warnings:[...candidate.warnings,
  ...delta.reasons,'Changed source records are separate from retained authored labels, layout and public evidence. Tombstones are review information only.']};
}
export type GraphFilter={organization?:string;project?:string;family?:string;state?:string;origin?:string;search?:string};
/** Project scope follows explicit parent IDs or groups, never label similarity. */
export function graphRows(doc:Project,filter:GraphFilter={}){
 const g=readGraphHistory(doc).at(-1);if(!g)return {nodes:[],assertions:[],generation:undefined};
 const available=new Map(doc.nodes.map(n=>[n.id,n])),project=g.nodes.find(n=>n.externalId===filter.project);
 const inProject=(n:GraphGeneration['nodes'][number])=>{if(!project)return !filter.project;
  if(n.externalId===project.externalId||n.groups.some(x=>project.groups.includes(x)))return true;
  const visited=new Set<string>();let p=n.parent;while(p&&!visited.has(p)){if(p===project.externalId)return true;visited.add(p);p=g.nodes.find(x=>x.externalId===p)?.parent??null;}return false;};
 const familyNodes=new Set(g.assertions.filter(a=>!filter.family||a.family===filter.family).flatMap(a=>[a.from,a.to]));
 const nodes=g.nodes.filter(n=>available.has(n.localId)&&(!filter.organization||n.organization===filter.organization)&&inProject(n)&&
  (!filter.family||familyNodes.has(n.localId)||belongs(n.kind,filter.family))&&(!filter.state||n.state===filter.state)&&
  (!filter.search||[available.get(n.localId)!.label,n.kind,n.externalId].join(' ').toLowerCase().includes(filter.search.toLowerCase())));
 const ids=new Set(nodes.map(n=>n.localId)),edgeIds=new Set(doc.edges.map(e=>e.id));
 const assertions=g.assertions.filter(a=>edgeIds.has(a.localId)&&ids.has(a.from)&&ids.has(a.to)&&(!filter.family||a.family===filter.family)&&(!filter.origin||a.origin===filter.origin));
 return {nodes:filter.origin?nodes.filter(n=>assertions.some(a=>a.from===n.localId||a.to===n.localId)):nodes,assertions,generation:g};
}
export function graphEvidenceChain(doc:Project,start:string,limit=80){
 const {nodes,assertions}=graphRows(doc),known=new Set(nodes.map(n=>n.localId)),seen=new Set<string>(),queue=[start];
 while(queue.length&&seen.size<Math.min(80,limit)){const id=queue.shift()!;if(seen.has(id)||!known.has(id))continue;seen.add(id);
  for(const a of assertions){if(a.from===id)queue.push(a.to);if(a.to===id)queue.push(a.from);}}
 return {nodes:nodes.filter(n=>seen.has(n.localId)),assertions:assertions.filter(a=>seen.has(a.from)&&seen.has(a.to)),
  limited:queue.length>0,missing:['feature','prompt','native_session','revision','check_result'].filter(k=>!nodes.some(n=>seen.has(n.localId)&&n.kind===k))};
}
/** Explicit tombstones produce a proposal for assertion removal only. Nodes,
 * authored evidence, source records and generations remain in the document. */
export function graphTombstonePatch(doc:Project):Patch|undefined{
 const history=readGraphHistory(doc);if(history.length<2)return undefined;
 const delta=compareGraphGenerations(history.at(-2)!,history.at(-1)!);
 const removed=new Set(delta.changes.filter(c=>c.kind==='assertion'&&c.change==='tombstone').map(c=>c.localId));
 if(!removed.size)return undefined;
 const edges=doc.edges.filter(e=>!removed.has(e.id)),views=doc.views.map(v=>({...v,edgeIds:v.edgeIds.filter(id=>!removed.has(id))}));
 return {format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,
  summary:'Review '+removed.size+' explicit source tombstone(s) from comparable predecessor; keep nodes and evidence',
  operations:[{op:'replace',path:'/edges',value:edges},{op:'replace',path:'/views',value:views},
   {op:'replace',path:'/story',value:doc.story.map(s=>({...s,highlightEdgeIds:s.highlightEdgeIds.filter(id=>!removed.has(id))}))}]};
}
/** Large file browsing stays transient. The user's explicit selection becomes a
 * bounded partial candidate without changing external generation/entity IDs. */
export function selectGraphNodes(raw:unknown,selected:string[]):GraphSnapshot{
 const g=validateGraphSnapshot(raw),ids=unique(selected,'selected node');
 if(!selected.length||selected.length>450||selected.some(id=>!g.nodes.some(n=>n.id===id)))throw new Error('Select 1–450 known components');
 const assertions=g.assertions.filter(a=>ids.has(a.from)&&ids.has(a.to));if(assertions.length>1200)throw new Error('Selected relations exceed the projection budget; select fewer components');
 const nodes=g.nodes.filter(n=>ids.has(n.id)).map(n=>({...n,parent_id:n.parent_id&&ids.has(n.parent_id)?n.parent_id:null}));
 const used=new Set([...nodes.flatMap(n=>n.source_ref_ids),...assertions.flatMap(a=>a.source_ref_ids)]),source_refs=g.source_refs.filter(s=>used.has(s.id));
 if(source_refs.length>190)throw new Error('Selected sources exceed the projection budget');
 return validateGraphSnapshot({...g,nodes,assertions,source_refs,groups:g.groups.map(group=>({...group,node_ids:group.node_ids.filter(id=>ids.has(id))})).filter(group=>group.node_ids.length),
  scope:{...g.scope,organization_ids:[...new Set(nodes.map(n=>n.organization_id))],privacy_domain_ids:[...new Set([...nodes.map(n=>n.privacy_domain_id),...source_refs.map(s=>s.privacy_domain_id)])]},
  complete_scope:false,omitted:[...g.omitted.slice(0,9999),{reason:'Explicit consumer projection: '+(g.nodes.length-nodes.length)+' source components outside selection. Absence is not deletion.'}],removed_assertion_ids:[]});
}
