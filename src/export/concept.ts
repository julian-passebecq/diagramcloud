import {validateDocument,type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {viewSpec,type SpecNode} from '../core/viewspec';

/**
 * MosaicStudio adapter: one view as a `datapass.concept-spec/1` file (owner: datapass-mosaicstudio, spec 1.0.0).
 * MosaicStudio owns the rendering (layer cake, isometric, 3D); DiagramCloud only maps meaning. Built from the public
 * view spec by default; the separate host-selected author route never changes publication visibility. Every change the target contract forces (ID rewrite, shortened label,
 * dropped component, merged connection, evidence not carried) is listed in the loss report, never silent.
 */
export const CONCEPT_SPEC_VERSION='1.0.0';
const LIMITS={nodes:40,flows:64,perCell:3,domains:8,label:40,flowLabel:60,description:600,sources:6,evidence:12,annotations:6};

type Kind=string;
type Layer={id:string;label:string;role?:string;description:string};
type ConceptNode={id:string;kind:Kind;layer:string;domain:string;label:string;status:'active'|'planned';description?:string;sources?:{path:string;note?:string}[];evidence?:{kind:string;ref:string;label?:string}[]};
type ConceptFlow={id:string;from:string;to:string;kind:'data'|'control'|'auth';label:string;direction?:'forward'|'both';evidence?:{kind:string;ref:string;label?:string}[]};
export type ConceptSpecFile={$schema:string;format:'datapass.concept-spec';version:1;specVersion:string;id:string;title:string;subtitle?:string;provenance:'synthetic'|'documented';note:string;
 layers:(Layer&{height:number})[];domains:{id:string;label:string;description?:string;placement?:'main'|'side'}[];nodes:ConceptNode[];flows:ConceptFlow[];annotations?:{id:string;target?:string;text:string}[]};
export type ConceptNodeMapping={sourceId:string;targetId:string|null;state:'kept'|'omitted';reason?:string};
export type ConceptEdgeMapping={sourceId:string;targetId:string|null;state:'kept'|'merged'|'omitted';sourceKind:string;basis:string;confidence?:string;reason?:string};
export type ConceptExport={spec:ConceptSpecFile;report:{kept:string[];lost:string[];idMap:Record<string,string>;audience:'public'|'author';nodes:ConceptNodeMapping[];edges:ConceptEdgeMapping[]}};
export type AuthorConceptSelection={projectId:string;baseRevision:number;viewId:string};

/** Layers bottom to top. DiagramCloud kinds land on the layer whose role matches what the component does. */
const LAYERS:(Layer&{kinds:SpecNode['kind'][]})[]=[
 {id:'stores',label:'Stores',role:'data',description:'Databases, tables and files that hold the data.',kinds:['storage','table']},
 {id:'compute',label:'Processing',role:'compute',description:'Jobs, functions and models that transform or compute.',kinds:['process','function','model','physics']},
 {id:'service',label:'Services & control',role:'serving',description:'APIs, gates and policies between people and data.',kinds:['control']},
 {id:'experience',label:'Apps & reports',role:'experience',description:'What people open.',kinds:['app','report']},
 {id:'sources',label:'Sources & people',role:'users',description:'Where requests and data come from.',kinds:['source']},
];
const PROVIDER_KIND:[RegExp,Kind][]=[[/entra|identity|okta|auth0|cognito/i,'identity'],[/sqlite|postgres|mysql|sql server|azure sql|fabric sql|oracle/i,'sql-db'],[/ducklake|delta|lakehouse|databricks/i,'lakehouse'],
 [/onelake|adls|s3|blob/i,'lakehouse'],[/warehouse|snowflake|bigquery|synapse/i,'warehouse'],[/kafka|event hub|kinesis|pub\/sub/i,'stream'],[/queue|service bus|sqs|rabbit/i,'queue'],
 [/dbt|airflow|data factory|pipeline/i,'pipeline'],[/notebook|jupyter|spark/i,'notebook'],[/power bi|tableau|looker/i,'report'],[/fastapi|express|flask|data api|api management|graphql/i,'api'],
 [/react|vue|svelte|angular|next/i,'web-app'],[/github actions|gitlab ci|azure pipelines|jenkins/i,'ci-runner'],[/vercel|netlify|static/i,'static-host']];
const KIND:Record<SpecNode['kind'],Kind>={storage:'database',table:'database',process:'pipeline',function:'function',model:'semantic-model',physics:'device',control:'api',app:'app',report:'report',source:'external'};
// Never `lake`: the contract allows one lake on the bottom layer, a decision for the Studio author, not a mapping.
function conceptKind(n:SpecNode):Kind{
 if(n.kind==='source'&&/planner|user|analyst|people|customer|executive|operator|engineer/i.test(n.label))return 'users';
 return PROVIDER_KIND.find(([re])=>re.test(n.provider))?.[1]??KIND[n.kind];
}
const clip=(s:string,max:number)=>s.length>max?`${s.slice(0,max-1).trimEnd()}…`:s;

/** Existing public export. No option on this route can include private content. */
export function conceptSpec(input:Project,viewId:string,options:{now?:Date}={}):ConceptExport{
 return projectConcept(input,viewId,'public',options);
}

/** Internal projection of ONE host-selected author view, never a public export or an authorization check.
 * The host must already hold access to the selected document. A viewer/agent must not choose its authority.
 * This helper only constructs inert data; it does not open files, transmit, publish or change visibility.
 */
export function authorConceptPreview(input:Project,selection:AuthorConceptSelection,options:{now?:Date}={}):ConceptExport{
 if(selection.projectId!==input.id||selection.baseRevision!==input.revision)throw new Error('Author concept selection is stale or belongs to another project.');
 return projectConcept(input,selection.viewId,'author',options);
}

function projectConcept(input:Project,viewId:string,audience:'public'|'author',options:{now?:Date}):ConceptExport{
 const validated=validateDocument(input),spec=viewSpec(validated,viewId,{audience,now:options.now});
 if(!spec.nodes.length)throw new Error('No components are available in this selected view. Choose a populated permitted view.');
 // Metadata is selected through the same public boundary as the graph, never from private source records.
 const metadata=audience==='public'?publicDocument(validated):validated;
 const lost:string[]=[...spec.omissions],idMap:Record<string,string>={},taken=new Set<string>(['none',...LAYERS.map(l=>l.id)]);
 const nodeMappings:ConceptNodeMapping[]=[],edgeMappings:ConceptEdgeMapping[]=[];
 const slug=(raw:string)=>raw.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^[^a-z]+/,'').replace(/-+/g,'-').slice(0,48).replace(/-+$/,'')||'item';
 const unique=(raw:string)=>{const base=slug(raw);let id=base,k=2;while(taken.has(id)){const suffix=`-${k++}`;id=base.slice(0,48-suffix.length).replace(/-+$/,'')+suffix;}taken.add(id);return id;};
 // Reserve canonical IDs first, then allocate rewritten IDs in stable order. Array/layout order is not identity.
 // A Map is essential: valid IDs such as "constructor" must never resolve to inherited Object properties.
 const allocated=new Map<string,string>(),valid=(id:string)=>/^[a-z][a-z0-9-]{0,47}$/.test(id)&&id!=='none';
 const sourceIds=[...spec.nodes.map(n=>({kind:'node' as const,id:n.id})),...spec.edges.map(e=>({kind:'edge' as const,id:e.id}))]
  .sort((a,b)=>Number(valid(b.id))-Number(valid(a.id))||(a.id<b.id?-1:a.id>b.id?1:0)||(a.kind==='node'?-1:1));
 for(const entry of sourceIds)allocated.set(`${entry.kind}\0${entry.id}`,unique(entry.id));
 const sourceNodeIds=new Set(spec.nodes.map(n=>n.id));
 const conceptId=(raw:string,kind:'node'|'edge')=>{
  const id=allocated.get(`${kind}\0${raw}`);if(!id)throw new Error('Unmapped concept identity');
  // Legacy idMap has one namespace. In collisions it retains the node mapping; typed rows are authoritative.
  if(kind==='edge'&&sourceNodeIds.has(raw))lost.push(`${raw}: node/edge IDs share a source spelling; use typed mapping rows for the edge.`);
  else if(id!==raw)Object.defineProperty(idMap,raw,{value:id,enumerable:true,configurable:true});
  return id;
 };
 const docId=unique(`${spec.projectId}-${spec.viewId}`);
 let kept=spec.nodes;
 if(kept.length>LIMITS.nodes){lost.push(`${kept.length-LIMITS.nodes} component(s) beyond the 40-node concept limit were not exported: ${kept.slice(LIMITS.nodes).map(n=>n.id).join(', ')}.`);nodeMappings.push(...kept.slice(LIMITS.nodes).map(n=>({sourceId:n.id,targetId:null,state:'omitted' as const,reason:'node-limit'})));kept=kept.slice(0,LIMITS.nodes);}
 // Domains: one per repository group, else one for the view; a full (layer, domain) cell spills into a continuation domain.
 const domainOf=(n:SpecNode)=>n.group??'main';
 const baseDomains=[...new Set(kept.map(domainOf))];
 const domains:{id:string;label:string;key:string}[]=[],cells=new Map<string,number>(),nodes:ConceptNode[]=[],sourceById=new Map(metadata.sources.map(s=>[s.id,s]));
 const ensureDomain=(base:string,k:number)=>{const key=`${base}#${k}`;let d=domains.find(d=>d.key===key);
  if(!d){if(domains.length>=LIMITS.domains)return undefined;const title=base==='main'?spec.title:spec.groups.find(g=>g.id===base)?.title??base;
   d={id:unique(`${base==='main'?'main':`repo-${base}`}${k?`-${k+1}`:''}`),label:clip(k?`${title} (${k+1})`:title,60),key};domains.push(d);}return d;};
 for(const b of baseDomains)ensureDomain(b,0);
 for(const n of kept){
  const layer=LAYERS.find(l=>l.kinds.includes(n.kind))!;let k=0,d=ensureDomain(domainOf(n),0);
  while(d&&(cells.get(`${layer.id}/${d.id}`)??0)>=LIMITS.perCell)d=ensureDomain(domainOf(n),++k);
  if(!d){lost.push(`${n.id}: no room left (3 components per layer and domain, 8 domains), not exported.`);nodeMappings.push({sourceId:n.id,targetId:null,state:'omitted',reason:'cell-domain-limit'});continue;}
  cells.set(`${layer.id}/${d.id}`,(cells.get(`${layer.id}/${d.id}`)??0)+1);
  const id=conceptId(n.id,'node');nodeMappings.push({sourceId:n.id,targetId:id,state:'kept'});
  if(n.label.length>LIMITS.label)lost.push(`${n.id}: label shortened to 40 characters.`);
  const sources=n.sourceRefs.map(r=>sourceById.get(r)).filter((s):s is NonNullable<typeof s>=>!!s);
  const evidence=[...sources.filter(s=>{if(s.url&&s.url.length>500){lost.push(`${n.id}: a source URL exceeds the target limit; omitted rather than truncated.`);return false;}return !!s.url;}).map(s=>({kind:'url',ref:s.url!,label:clip(s.title,120)})),...n.evidenceRefs.map(b=>({kind:'doc',ref:`diagramcloud:${spec.projectId}/${b}`,label:clip(metadata.blocks.find(x=>x.id===b)?.title||b,120)}))];
  if(sources.length>LIMITS.sources)lost.push(`${n.id}: ${sources.length-LIMITS.sources} source(s) beyond 6 not exported.`);
  if(evidence.length>LIMITS.evidence)lost.push(`${n.id}: ${evidence.length-LIMITS.evidence} evidence ref(s) beyond 12 not exported.`);
  const description=[n.basis==='static-source'?'Read from source.':n.basis==='planned'?'Planned (declared, not built or not verified).':'Basis not established; presence is not runtime health.',n.confidence?`Confidence: ${n.confidence}.`:'',n.observation?`Observed: ${n.observation.claim} (${n.observation.sourceApp}, ${n.observation.observedAt.slice(0,10)}).`:'',n.summary].filter(Boolean).join(' ');
  if(description.length>LIMITS.description)lost.push(`${n.id}: description shortened to the concept limit.`);
  nodes.push({id,kind:conceptKind(n),layer:layer.id,domain:d.id,label:clip(n.label,LIMITS.label),status:n.basis==='planned'?'planned':'active',
   ...(description?{description:clip(description,LIMITS.description)}:{}),
   ...(sources.length?{sources:sources.slice(0,LIMITS.sources).map(s=>({path:clip(s.title,200),...(s.location?{note:clip(s.location,200)}:{})}))}:{}),
   ...(evidence.length?{evidence:evidence.slice(0,LIMITS.evidence)}:{})});
 }
 const nodeId=new Map(nodeMappings.filter(n=>n.targetId!==null).map(n=>[n.sourceId,n.targetId!])),present=new Set(nodes.map(n=>n.id));
 const flows:ConceptFlow[]=[],flowMeaning=new Map<string,string>(),fullLabels=new Map<string,string[]>();
 for(const e of spec.edges){
  if(e.quantity)lost.push(`${e.id}: quantitative width is not represented in concept v1; quantity remains in DiagramCloud.`);
  const from=nodeId.get(e.from),to=nodeId.get(e.to);
  const mapping={sourceId:e.id,sourceKind:e.kind,basis:e.basis??'unspecified',...(e.confidence?{confidence:e.confidence}:{})};
  if(!from||!to||!present.has(from)||!present.has(to)){edgeMappings.push({...mapping,targetId:null,state:'omitted',reason:'endpoint-omitted'});lost.push(`${e.id}: not exported because an endpoint was omitted.`);continue;}
  if(from===to){edgeMappings.push({...mapping,targetId:null,state:'omitted',reason:'self-flow-unsupported'});lost.push(`${e.id}: self-flow is unsupported by concept v1.`);continue;}
  const kind:ConceptFlow['kind']=e.kind==='dependency'?'control':e.kind==='control'?(/auth|token|sign|role|identity/i.test(e.label)?'auth':'control'):'data';
  // Dependency is not a data transfer. Keep confidence in the visible label; the target has no confidence field.
  const raw=e.label.replace(/\s*\((inferred|possible)\)$/,'')||e.kind;
  const label=[e.confidence?`${e.confidence}:`:'',e.kind==='dependency'?'dependency:':'',raw].filter(Boolean).join(' ');
  const meaning=JSON.stringify([e.kind,e.basis,e.confidence??null]);
  const evidence={kind:'doc',ref:`diagramcloud:${spec.projectId}/${spec.viewId}/edge/${e.id}`,label:clip(`${e.kind}; ${e.basis}; ${e.confidence??'confidence not stated'}`,120)};
  const prior=flows.find(f=>f.from===from&&f.to===to);
  if(prior){
   if(flowMeaning.get(prior.id)!==meaning||(prior.direction==='both'&&!fullLabels.get(prior.id)!.includes(label))){edgeMappings.push({...mapping,targetId:null,state:'omitted',reason:'incompatible-parallel-flow'});lost.push(`${e.id}: parallel relation has different semantics/basis/confidence or a label not shared by both directions; not merged into ${prior.id}.`);continue;}
   edgeMappings.push({...mapping,targetId:prior.id,state:'merged',reason:'parallel-flow'});lost.push(`${e.id}: merged into the ${prior.id} flow (one flow per pair of components).`);
   const labels=fullLabels.get(prior.id)!;if(!labels.includes(label))labels.push(label);
   const combined=labels.join(' \u00b7 ');if(combined.length>LIMITS.flowLabel)lost.push(`${e.id}: merged label shortened to 60 characters.`);prior.label=clip(combined,LIMITS.flowLabel);
   if(prior.evidence!.length<LIMITS.evidence)prior.evidence!.push(evidence);else lost.push(`${e.id}: flow evidence limit reached; identity remains in the mapping report.`);
   continue;
  }
  const reverse=flows.find(f=>f.from===to&&f.to===from&&fullLabels.get(f.id)?.length===1&&fullLabels.get(f.id)![0]===label&&flowMeaning.get(f.id)===meaning);
  if(reverse){reverse.direction='both';edgeMappings.push({...mapping,targetId:reverse.id,state:'merged',reason:'reverse-flow'});lost.push(`${e.id}: drawn as the two-way ${reverse.id} flow.`);if(reverse.evidence!.length<LIMITS.evidence)reverse.evidence!.push(evidence);else lost.push(`${e.id}: flow evidence limit reached; identity remains in the mapping report.`);continue;}
  if(flows.length>=LIMITS.flows){edgeMappings.push({...mapping,targetId:null,state:'omitted',reason:'flow-limit'});lost.push(`${e.id}: beyond the 64-flow limit, not exported.`);continue;}
  if(label.length>LIMITS.flowLabel)lost.push(`${e.id}: label shortened to 60 characters; confidence prefix retained.`);
  const id=conceptId(e.id,'edge');flows.push({id,from,to,kind,label:clip(label,LIMITS.flowLabel),evidence:[evidence]});flowMeaning.set(id,meaning);fullLabels.set(id,[label]);edgeMappings.push({...mapping,targetId:id,state:'kept'});
  if(e.kind==='dependency')lost.push(`${e.id}: dependency uses the target's control style; source kind retained in its label and mapping.`);
 }
 const confidence=spec.edges.filter(e=>e.confidence&&e.confidence!=='confirmed').length;
 if(confidence)lost.push(`${confidence} connection(s) marked inferred or possible: confidence is retained in labels/evidence and mappings, not encoded as a target schema field.`);
 const usedLayers=LAYERS.filter(l=>nodes.some(n=>n.layer===l.id));
 const documented=nodes.length>0&&nodes.every(n=>n.sources?.length||n.evidence?.length);
 const scopedGroups=new Set(spec.groups.map(g=>g.id));
 const vectorRepositories=spec.snapshot?.repositories.filter(r=>audience==='public'||scopedGroups.has(r.id));
 if(audience==='author'&&spec.snapshot&&vectorRepositories!.length<spec.snapshot.repositories.length)lost.push('Repository metadata outside the selected view was not sent to the private preview.');
 const vector=vectorRepositories?.map(r=>`${r.id} @ ${r.revision?r.revision.slice(0,12):'unknown'}`).join(', ');
 const planned=nodes.filter(n=>n.status==='planned').length;
 const note=clip(`${audience==='author'?'PRIVATE author preview; not for public publication. ':''}Not live telemetry; active means present, not healthy. Exported from DiagramCloud (${spec.projectId}, view ${spec.viewId}, revision ${spec.projectRevision}) on ${spec.publication.generatedAt.slice(0,10)}. ${vector?`Revisions: ${vector}. `:''}${planned?`${planned} component(s) are planned, not built. `:''}${documented?'Every component cites a source or evidence block.':'Some components cite no source: read as an explanatory drawing.'}`,600);
 const retainedChildren=spec.children.filter(c=>present.has(nodeId.get(c.nodeId)!));
 const annotations=retainedChildren.slice(0,LIMITS.annotations).map(c=>({id:unique(`opens-${c.nodeId}`),target:nodeId.get(c.nodeId)!,text:clip(`Opens “${c.title}” in DiagramCloud.`,160)}));
 if(retainedChildren.length>LIMITS.annotations)lost.push(`${retainedChildren.length-LIMITS.annotations} drilldown note(s) beyond 6 not exported.`);
 lost.push('Positions, drilldown navigation, story steps, evidence block content and the design status of each component stay in DiagramCloud.');
 const file:ConceptSpecFile={$schema:'https://raw.githubusercontent.com/julian-passebecq/datapass-mosaicstudio/main/spec/concept/v1/concept-spec.schema.json',format:'datapass.concept-spec',version:1,specVersion:CONCEPT_SPEC_VERSION,
  id:docId,title:clip(`${spec.projectTitle} · ${spec.title}`,120),...(spec.purpose?{subtitle:clip(spec.purpose,240)}:{}),provenance:documented?'documented':'synthetic',note,
  layers:usedLayers.map((l,i)=>({id:l.id,label:l.label,height:i,...(l.role?{role:l.role}:{}),description:l.description})),
  domains:domains.map(d=>({id:d.id,label:d.label,placement:'main' as const})),nodes,flows,...(annotations.length?{annotations}:{})};
 if(new TextEncoder().encode(JSON.stringify(file)).byteLength>256*1024)throw new Error('Concept projection exceeds the target byte limit; select a smaller view.');
 const renamed=Object.keys(idMap).length;
 return {spec:file,report:{kept:[`${nodes.length} component(s), ${flows.length} flow(s), ${usedLayers.length} layer(s), ${domains.length} domain(s).`,renamed?`${renamed} ID(s) rewritten to the concept ID pattern (lowercase, hyphens): see idMap.`:'Every component keeps its DiagramCloud ID.'],lost,idMap,audience,nodes:nodeMappings,edges:edgeMappings}};
}
