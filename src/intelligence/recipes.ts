import type {Project} from '../core/model';
import {readAcquisitionAnalysis} from './materialize';
import type {AnalysisOptions} from './types';
import {z} from 'zod';
import {validateDocument} from '../core/model';
import {perspectiveOf,repositoryOf} from '../core/viewspec';
/** A recommendation is a reasoned presentation choice, never an applied change. */
export type Recipe={id:string;title:string;availability:'available'|'partial'|'unknown';viewIds:string[];reason:string;figure:'architecture'|'swimlane'|'lineage'|'matrix'|'tree'|'exploded';maxNodes:number};
const definitions:{id:string;title:string;perspectives:string[];tags:string[];figure:Recipe['figure']}[]=[
 {id:'system',title:'System concept map',perspectives:['system'],tags:[],figure:'architecture'},
 {id:'data',title:'Data and semantic lineage',perspectives:['data'],tags:['dbt','fabric'],figure:'lineage'},
 {id:'jobs',title:'Job dependencies and delivery',perspectives:['cicd'],tags:['databricks'],figure:'swimlane'},
 {id:'interfaces',title:'Interfaces and schema dependencies',perspectives:['code'],tags:['dotnet'],figure:'tree'},
 {id:'cloud',title:'Infrastructure declarations',perspectives:['cloud'],tags:['azure'],figure:'architecture'},
 {id:'evidence',title:'Evidence and checks',perspectives:['evidence'],tags:[],figure:'matrix'},
 {id:'knowledge',title:'Document and decision sources',perspectives:['decisions','code'],tags:['document'],figure:'tree'}
];
export const recipeSchema=z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,60}$/),version:z.literal(1),title:z.string().min(1).max(160),
 question:z.string().min(1).max(300),requirements:z.object({perspectives:z.array(z.string()).max(9),tags:z.array(z.string()).max(20),relationships:z.boolean()}).strict(),
 projection:z.object({kind:z.literal('existing-view-membership'),maxNodes:z.number().int().min(1).max(100)}).strict(),
 render:z.object({figure:z.enum(['architecture','swimlane','lineage','matrix','tree','exploded'])}).strict(),missing:z.string().min(1).max(300)}).strict();
export type ViewRecipe=z.infer<typeof recipeSchema>;
export function validateRecipeRegistry(input:unknown){const rows=z.array(recipeSchema).min(1).max(50).parse(input);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Duplicate recipe ID');return rows;}
export const recipeRegistry=validateRecipeRegistry(definitions.map(d=>({id:d.id,version:1,title:d.title,
 question:{system:'What are the system boundaries and supplied connections?',data:'Where does data come from and which transformations are supplied?',jobs:'Which declared work items depend on which others?',interfaces:'Which interfaces and schemas explicitly reference each other?',cloud:'Which infrastructure resources are declared?',evidence:'Which components have reviewed external evidence and which do not?',knowledge:'Which documents and decisions cite selected sources?'}[d.id],
 requirements:{perspectives:d.perspectives,tags:d.tags,relationships:!['evidence','knowledge'].includes(d.id)},projection:{kind:'existing-view-membership',maxNodes:60},render:{figure:d.figure},missing:'Missing matching facts remain unknown; the recipe never creates relationships.'})));
export function recommendRecipes(doc:Project,options:AnalysisOptions,scope:{repositoryId?:string;environmentId?:string}={}):Recipe[]{
 const facts=repositoryOutputFacts(doc,scope.repositoryId),envIds=scope.environmentId?new Set(doc.delivery?.instances.filter(i=>i.environmentId===scope.environmentId).flatMap(i=>[i.nodeId,i.componentId])):undefined;
 const nodeMap=new Map(facts.nodes.filter(n=>!envIds||envIds.has(n.id)).map(n=>[n.id,n])),edgeIds=new Set(facts.edges.filter(e=>nodeMap.has(e.source)&&nodeMap.has(e.target)).map(e=>e.id));
 const scopedViews=facts.views.map(v=>({...v,nodeIds:v.nodeIds.filter(id=>nodeMap.has(id)),edgeIds:v.edgeIds.filter(id=>edgeIds.has(id))}));
 const choices=recipeRegistry.map(d=>{const views=scopedViews.filter(v=>v.nodeIds.length&&(d.requirements.perspectives.includes(perspectiveOf(v))||v.nodeIds.some(id=>nodeMap.get(id)?.tags.some(t=>d.requirements.tags.includes(t)))));
  const edgeCount=views.reduce((n,v)=>n+v.edgeIds.length,0),nodeCount=views.reduce((n,v)=>n+v.nodeIds.length,0);
  return {id:d.id,title:d.title,availability:nodeCount?(edgeCount||!d.requirements.relationships?'available':'partial'):'unknown',viewIds:views.map(v=>v.id),figure:d.render.figure,
   maxNodes:options.depth==='quick'?24:60,reason:nodeCount?(edgeCount?'Explicit matching perspectives and retained relationships':'Components exist; relationships not established'):'No matching facts in the current selected scope'} as Recipe;});
 const priority=options.purpose==='audit'||options.purpose==='work-review'?['evidence','interfaces','cloud']:options.purpose==='education'?['system','knowledge','interfaces']:options.purpose==='presentation'||options.purpose==='portfolio'?['system','data','jobs']:['system','interfaces','data'];
 return choices.sort((a,b)=>Number(b.availability==='available')-Number(a.availability==='available')+((priority.indexOf(a.id)<0?10:priority.indexOf(a.id))-(priority.indexOf(b.id)<0?10:priority.indexOf(b.id)))/20);
}
/** Source-backed bounded reachability, not causal impact or test coverage %. */
export function impactFacts(doc:Project,start:string,options:{direction:'upstream'|'downstream';includeInferred:boolean;limit?:number}){
 if(!doc.nodes.some(n=>n.id===start))throw new Error('Unknown impact subject');
 const edges=doc.edges.filter(e=>e.basis==='static-source'||e.basis==='planned'||(options.includeInferred&&(!e.basis||e.basis==='unknown'))),limit=Math.max(1,Math.min(100,options.limit??60));
 const ids=new Set([start]),queue=[start],links=new Set<string>();let limited=false;
 while(queue.length){const id=queue.shift()!;for(const e of edges){const next=options.direction==='downstream'?(e.source===id?e.target:null):(e.target===id?e.source:null);if(!next)continue;
  links.add(e.id);if(ids.has(next))continue;if(ids.size>=limit){limited=true;continue;}ids.add(next);queue.push(next);}}
 const retained=edges.filter(e=>links.has(e.id)&&ids.has(e.source)&&ids.has(e.target));
 return {nodes:doc.nodes.filter(n=>ids.has(n.id)),edges:retained,limited,
  views:doc.views.filter(v=>v.nodeIds.some(id=>ids.has(id))).map(v=>({id:v.id,title:v.title,nodeIds:v.nodeIds.filter(id=>ids.has(id))})),
  relationships:retained.map(e=>({edgeId:e.id,basis:e.basis??'unknown',sourceIds:[...new Set([...(doc.nodes.find(n=>n.id===e.source)?.sourceIds??[]),...(doc.nodes.find(n=>n.id===e.target)?.sourceIds??[])])],note:'Endpoint citations are context; they do not independently prove the relationship.'})),
  checks:doc.observations.filter(o=>ids.has(o.nodeId)&&o.reviewedAt),gaps:doc.nodes.filter(n=>ids.has(n.id)&&!doc.observations.some(o=>o.nodeId===n.id&&o.reviewedAt)).map(n=>({nodeId:n.id,reason:'No reviewed external check is attached; source declarations do not prove coverage'}))};
}
export const patternSchema=z.object({id:z.string(),version:z.literal(1),title:z.string(),illustrative:z.literal(true),requiredKinds:z.array(z.string()),requiredTags:z.array(z.string()),evidenceRequirements:z.array(z.string()).min(1)}).strict();
export const patternCatalog=z.array(patternSchema).parse([
 {id:'c4',version:1,title:'System and container explanation',illustrative:true,requiredKinds:['app','storage'],requiredTags:[],evidenceRequirements:['Explicit system boundary','Source-backed dependencies']},
 {id:'modular-monolith',version:1,title:'Modular application candidate',illustrative:true,requiredKinds:['app','function'],requiredTags:['dotnet'],evidenceRequirements:['Module boundaries','Source-backed entry point and references','Deployment topology']},
 {id:'medallion',version:1,title:'Layered data pipeline candidate',illustrative:true,requiredKinds:['storage','process'],requiredTags:['dbt','fabric','databricks'],evidenceRequirements:['Layer contracts and transforms','Source-backed lineage','Dated external execution evidence to claim deployment']},
 {id:'event',version:1,title:'Event-driven flow candidate',illustrative:true,requiredKinds:['source','process'],requiredTags:[],evidenceRequirements:['Declared broker/topic or event contract','Producer and consumer references','Delivery guarantees']},
 {id:'migration',version:1,title:'Migration design candidate',illustrative:true,requiredKinds:['source','storage'],requiredTags:[],evidenceRequirements:['Explicit before/after scope','Author-approved transition plan','External migration checks']}
]);
/** A pattern match is a candidate and carries its evidence gaps, never a deployed claim. */
export function classifyPatterns(input:Project){const doc=validateDocument(input);return patternCatalog.map(p=>{
 const matching=doc.nodes.filter(n=>p.requiredKinds.includes(n.kind)),kinds=new Set<string>(matching.map(n=>n.kind)),tags=doc.nodes.flatMap(n=>n.tags);
 const matches=p.requiredKinds.every(k=>kinds.has(k))&&(!p.requiredTags.length||p.requiredTags.some(t=>tags.includes(t)));
 const ids=new Set(matching.map(n=>n.id)),relationships=doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
 return {...p,state:matches?'candidate' as const:'not-established' as const,nodeIds:matches?matching.map(n=>n.id):[],sourceIds:matches?[...new Set(matching.flatMap(n=>n.sourceIds))]:[],relationshipIds:matches?relationships.map(e=>e.id):[],matchReasons:matches?['Component kinds: '+[...kinds].join(', '),...(p.requiredTags.length?['Declared tag matches: '+p.requiredTags.filter(t=>tags.includes(t)).join(', ')]:[]),'Supplied connections between selected components: '+relationships.length]:[],reason:matches?'Kinds and declared tags suggest a useful illustrative comparison; they do not prove the architecture pattern.':'Required source facts are not established.',gaps:p.evidenceRequirements};});}
export function learningPath(doc:Project){return doc.views.map(v=>({viewId:v.id,title:v.title,nodeId:v.nodeIds[0],sourceIds:[...new Set(v.nodeIds.flatMap(id=>doc.nodes.find(n=>n.id===id)?.sourceIds??[]))],
 reason:v.id===doc.rootViewId?'Start with the declared project boundary.':v.perspective==='evidence'?'Read the cited evidence and unresolved checks.':'Continue into the existing '+(v.perspective??'detail')+' perspective.'})).sort((a,b)=>Number(b.viewId===doc.rootViewId)-Number(a.viewId===doc.rootViewId));}
export function architectureAudit(doc:Project){const analysis=readAcquisitionAnalysis(doc),active=doc.atlas?.snapshots.find(s=>s.id===doc.atlas?.activeSnapshotId),claims=doc.observations.filter(o=>o.reviewedAt);
 const stale=claims.flatMap(o=>{const revision=repositoryOf(doc,o.nodeId)?.revision??(!active?analysis?.sourceIdentity.sourceRevision:undefined);return revision&&/^[a-f0-9]{40,64}$/.test(revision)&&/^[a-f0-9]{40,64}$/.test(o.sourceRevision)&&revision!==o.sourceRevision?[{id:o.id,nodeId:o.nodeId,sourceRevision:o.sourceRevision,currentSourceRevision:revision,state:'stale-source-revision',reason:'Reviewed external claim refers to a different exact source commit. No replacement outcome is inferred.'}]:[];});
 const groups=new Map<string,typeof claims>();for(const o of claims){const key=JSON.stringify([o.nodeId,o.sourceApp,o.authority,o.sourceRevision,o.observedAt]);groups.set(key,[...(groups.get(key)??[]),o]);}
 const conflicts=[...groups.values()].filter(rows=>new Set(rows.map(o=>o.claim)).size>1).map(rows=>({nodeId:rows[0].nodeId,observationIds:rows.map(o=>o.id),state:'requires-review',reason:'Different claim outcomes share the same external authority, timestamp and source revision. Inspect their individual check scope before deciding whether they conflict.'}));return {
 format:'diagramcloud.architecture-audit/1',projectId:doc.id,revision:doc.revision,
 missingSources:doc.nodes.filter(n=>!n.sourceIds.length).map(n=>({nodeId:n.id,state:'unknown',reason:'No cited source attached.'})),
 unreviewed:doc.observations.filter(o=>!o.reviewedAt).map(o=>({id:o.id,nodeId:o.nodeId,state:'requires-review'})),
 stale,conflicts,
 unsupported:analysis?.documentMap.diagnostics.filter(d=>d.code==='unsupported'||d.code==='unresolved'||d.code==='ambiguous')??[],
 repositories:active?.repositories.filter(r=>r.scanStatus!=='scanned').map(r=>({id:r.id,state:r.scanStatus,reason:'No successful scan in this selected snapshot.'}))??[],
 note:'Missing facts are unknown. This is a source/evidence inventory, not a security certification or runtime health assessment.'};}
export function contextualRecipes(doc:Project,options:AnalysisOptions,context?:{archetypes:string[];repositoryId?:string;environmentId?:string}){const rows=recommendRecipes(doc,options,context),relevance:Record<string,string[]>={data:['data'],jobs:['data','cloud','application'],interfaces:['application','library'],cloud:['cloud'],knowledge:['documents']};return rows.map((r,i)=>({...r,
 state:r.availability==='unknown'&&context?.archetypes.length&&relevance[r.id]&&!relevance[r.id].some(a=>context.archetypes.includes(a))?'not-applicable':r.availability==='unknown'?'unavailable':r.availability==='partial'?'useful':i<3?'recommended':'available',
 requirements:recipeRegistry.find(d=>d.id===r.id)!.requirements,question:recipeRegistry.find(d=>d.id===r.id)!.question}));}
export function knowledgeFacts(doc:Project){const analysis=readAcquisitionAnalysis(doc);
 return {documents:analysis?.documentMap.documents??[],links:analysis?.documentMap.links??[],diagnostics:analysis?.documentMap.diagnostics??[],
  decisions:doc.views.filter(v=>v.perspective==='decisions'),limitations:['Only explicit source links are connected; prose similarity is not a relationship.']};}
export function projectCollection(projects:Project[]){return projects.map(p=>({id:p.id,title:p.title,views:p.views.length,
 revisions:p.atlas?.snapshots.find(s=>s.id===p.atlas?.activeSnapshotId)?.repositories.map(r=>({id:r.id,revision:r.revision??'UNKNOWN'}))??[],
 source:'independent-project' as const}));}

/** Atlas namespaces are explicit ownership, not a technology/name join. */
export function repositoryOutputFacts(doc:Project,repositoryId?:string){
 const active=doc.atlas?.snapshots.find(s=>s.id===doc.atlas?.activeSnapshotId);
 if(!repositoryId)return {nodes:doc.nodes,views:doc.views,edges:doc.edges};
 const repository=active?.repositories.find(r=>r.id===repositoryId);
 if(!repository)return {nodes:[],views:[],edges:[]};
 const nodes=doc.nodes.filter(n=>n.id.startsWith(repositoryId+'.')||n.id===(repository.nodeId??'repo-'+repositoryId)),ids=new Set(nodes.map(n=>n.id));
 const edges=doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),edgeIds=new Set(edges.map(e=>e.id));
 const views=doc.views.filter(v=>v.id.startsWith(repositoryId+'.')).map(v=>({...v,nodeIds:v.nodeIds.filter(id=>ids.has(id)),edgeIds:v.edgeIds.filter(id=>edgeIds.has(id))}));
 return {nodes,views,edges};
}
