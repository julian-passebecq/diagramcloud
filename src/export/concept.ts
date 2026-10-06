import type {Project} from '../core/model';
import {viewSpec,type SpecNode} from '../core/viewspec';

/**
 * MosaicStudio adapter: one view as a `datapass.concept-spec/1` file (owner: datapass-mosaicstudio, spec 1.0.0).
 * MosaicStudio owns the rendering (layer cake, isometric, 3D); DiagramCloud only maps meaning. Built from the public
 * view spec, so private items never leave. Every change the target contract forces (ID rewrite, shortened label,
 * dropped component, merged connection, evidence not carried) is listed in the loss report, never silent.
 */
export const CONCEPT_SPEC_VERSION='1.0.0';
const LIMITS={nodes:40,flows:64,perCell:3,domains:8,label:40,flowLabel:60,description:600,sources:6,evidence:12,annotations:6};

type Kind=string;
type Layer={id:string;label:string;role?:string;description:string};
type ConceptNode={id:string;kind:Kind;layer:string;domain:string;label:string;status:'active'|'planned';description?:string;sources?:{path:string;note?:string}[];evidence?:{kind:string;ref:string;label?:string}[]};
type ConceptFlow={id:string;from:string;to:string;kind:'data'|'control'|'auth';label:string;direction?:'forward'|'both'};
export type ConceptSpecFile={$schema:string;format:'datapass.concept-spec';version:1;specVersion:string;id:string;title:string;subtitle?:string;provenance:'synthetic'|'documented';note:string;
 layers:(Layer&{height:number})[];domains:{id:string;label:string;description?:string;placement?:'main'|'side'}[];nodes:ConceptNode[];flows:ConceptFlow[];annotations?:{id:string;target?:string;text:string}[]};
export type ConceptExport={spec:ConceptSpecFile;report:{kept:string[];lost:string[];idMap:Record<string,string>}};

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

export function conceptSpec(input:Project,viewId:string,options:{now?:Date}={}):ConceptExport{
 const spec=viewSpec(input,viewId,{audience:'public',now:options.now});
 const lost:string[]=[...spec.omissions],idMap:Record<string,string>={},taken=new Set<string>(['none',...LAYERS.map(l=>l.id)]);
 const slug=(raw:string)=>raw.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^[^a-z]+/,'').replace(/-+/g,'-').slice(0,48).replace(/-+$/,'')||'item';
 const unique=(raw:string)=>{const base=slug(raw);let id=base,k=2;while(taken.has(id))id=`${base.slice(0,44)}-${k++}`;taken.add(id);return id;};
 /** Component and connection IDs: kept when the contract allows them, otherwise rewritten and listed in idMap. */
 const conceptId=(raw:string)=>{const id=unique(raw);if(id!==raw)idMap[raw]=id;return id;};
 const docId=unique(`${spec.projectId}-${spec.viewId}`);
 let kept=spec.nodes;
 if(kept.length>LIMITS.nodes){lost.push(`${kept.length-LIMITS.nodes} component(s) beyond the 40-node concept limit were not exported: ${kept.slice(LIMITS.nodes).map(n=>n.id).join(', ')}.`);kept=kept.slice(0,LIMITS.nodes);}
 // Domains: one per repository group, else one for the view; a full (layer, domain) cell spills into a continuation domain.
 const domainOf=(n:SpecNode)=>n.group??'main';
 const baseDomains=[...new Set(kept.map(domainOf))];
 const domains:{id:string;label:string;key:string}[]=[],cells=new Map<string,number>(),nodes:ConceptNode[]=[],sourceById=new Map(input.sources.map(s=>[s.id,s]));
 const ensureDomain=(base:string,k:number)=>{const key=`${base}#${k}`;let d=domains.find(d=>d.key===key);
  if(!d){if(domains.length>=LIMITS.domains)return undefined;const title=base==='main'?spec.title:spec.groups.find(g=>g.id===base)?.title??base;
   d={id:unique(`${base==='main'?'main':`repo-${base}`}${k?`-${k+1}`:''}`),label:clip(k?`${title} (${k+1})`:title,60),key};domains.push(d);}return d;};
 for(const b of baseDomains)ensureDomain(b,0);
 for(const n of kept){
  const layer=LAYERS.find(l=>l.kinds.includes(n.kind))!;let k=0,d=ensureDomain(domainOf(n),0);
  while(d&&(cells.get(`${layer.id}/${d.id}`)??0)>=LIMITS.perCell)d=ensureDomain(domainOf(n),++k);
  if(!d){lost.push(`${n.id}: no room left (3 components per layer and domain, 8 domains), not exported.`);continue;}
  cells.set(`${layer.id}/${d.id}`,(cells.get(`${layer.id}/${d.id}`)??0)+1);
  const id=conceptId(n.id);
  if(n.label.length>LIMITS.label)lost.push(`${n.id}: label shortened to 40 characters.`);
  const sources=n.sourceRefs.map(r=>sourceById.get(r)).filter((s):s is NonNullable<typeof s>=>!!s);
  const evidence=[...sources.filter(s=>s.url).map(s=>({kind:'url',ref:s.url!,label:clip(s.title,120)})),...n.evidenceRefs.map(b=>({kind:'doc',ref:`diagramcloud:${spec.projectId}/${b}`,label:clip(input.blocks.find(x=>x.id===b)?.title||b,120)}))];
  if(sources.length>LIMITS.sources)lost.push(`${n.id}: ${sources.length-LIMITS.sources} source(s) beyond 6 not exported.`);
  if(evidence.length>LIMITS.evidence)lost.push(`${n.id}: ${evidence.length-LIMITS.evidence} evidence ref(s) beyond 12 not exported.`);
  const description=[n.summary,n.basis==='static-source'?'Read from source.':n.basis==='planned'?'Planned (declared, not built or not verified).':'',n.observation?`Observed: ${n.observation.claim} (${n.observation.sourceApp}, ${n.observation.observedAt.slice(0,10)}).`:''].filter(Boolean).join(' ');
  nodes.push({id,kind:conceptKind(n),layer:layer.id,domain:d.id,label:clip(n.label,LIMITS.label),status:n.basis==='planned'?'planned':'active',
   ...(description?{description:clip(description,LIMITS.description)}:{}),
   ...(sources.length?{sources:sources.slice(0,LIMITS.sources).map(s=>({path:clip(s.title,200),...(s.location?{note:clip(s.location,200)}:{})}))}:{}),
   ...(evidence.length?{evidence:evidence.slice(0,LIMITS.evidence)}:{})});
 }
 const nodeId=new Map(kept.map(n=>[n.id,idMap[n.id]??n.id])),present=new Set(nodes.map(n=>n.id));
 // Connections: one flow per ordered pair (the contract refuses duplicates); labels of parallel connections are merged.
 const flows:ConceptFlow[]=[];
 for(const e of spec.edges){
  const from=nodeId.get(e.from),to=nodeId.get(e.to);if(!from||!to||!present.has(from)||!present.has(to))continue;
  const label=e.label.replace(/\s*\((inferred|possible)\)$/,'')||e.kind,prior=flows.find(f=>f.from===from&&f.to===to);
  if(prior){lost.push(`${e.id}: merged into the ${prior.id} flow (one flow per pair of components).`);if(!prior.label.includes(label))prior.label=clip(`${prior.label} · ${label}`,LIMITS.flowLabel);continue;}
  if(flows.length>=LIMITS.flows){lost.push(`${e.id}: beyond the 64-flow limit, not exported.`);continue;}
  if(label.length>LIMITS.flowLabel)lost.push(`${e.id}: label shortened to 60 characters.`);
  const reverse=flows.find(f=>f.from===to&&f.to===from);
  if(reverse&&reverse.label===label){reverse.direction='both';lost.push(`${e.id}: drawn as the two-way ${reverse.id} flow.`);continue;}
  flows.push({id:conceptId(e.id),from,to,kind:e.kind==='control'?(/auth|token|sign|role|identity/i.test(label)?'auth':'control'):'data',label:clip(label,LIMITS.flowLabel)});
 }
 const confidence=spec.edges.filter(e=>e.confidence&&e.confidence!=='confirmed').length;
 if(confidence)lost.push(`${confidence} connection(s) marked inferred or possible: the concept spec has no confidence field, so the mark is dropped from the label.`);
 const usedLayers=LAYERS.filter(l=>nodes.some(n=>n.layer===l.id));
 const documented=nodes.length>0&&nodes.every(n=>n.sources?.length||n.evidence?.length);
 const vector=spec.snapshot?.repositories.map(r=>`${r.id} @ ${r.revision?r.revision.slice(0,12):'unknown'}`).join(', ');
 const planned=nodes.filter(n=>n.status==='planned').length;
 const note=clip(`Exported from DiagramCloud (${spec.projectId}, view ${spec.viewId}, revision ${spec.projectRevision}) on ${spec.publication.generatedAt.slice(0,10)}. ${vector?`Revisions: ${vector}. `:''}${planned?`${planned} component(s) are planned, not built. `:''}${documented?'Every component cites a source or evidence block.':'Some components cite no source: read as an explanatory drawing.'} Not live telemetry.`,600);
 const annotations=spec.children.slice(0,LIMITS.annotations).filter(c=>present.has(nodeId.get(c.nodeId)!)).map(c=>({id:unique(`opens-${c.nodeId}`),target:nodeId.get(c.nodeId)!,text:clip(`Opens “${c.title}” in DiagramCloud.`,160)}));
 if(spec.children.length>LIMITS.annotations)lost.push(`${spec.children.length-LIMITS.annotations} drilldown note(s) beyond 6 not exported.`);
 lost.push('Positions, drilldown navigation, story steps, evidence block content and the design status of each component stay in DiagramCloud.');
 const file:ConceptSpecFile={$schema:'https://raw.githubusercontent.com/julian-passebecq/datapass-mosaicstudio/main/spec/concept/v1/concept-spec.schema.json',format:'datapass.concept-spec',version:1,specVersion:CONCEPT_SPEC_VERSION,
  id:docId,title:clip(`${spec.projectTitle} · ${spec.title}`,120),...(spec.purpose?{subtitle:clip(spec.purpose,240)}:{}),provenance:documented?'documented':'synthetic',note,
  layers:usedLayers.map((l,i)=>({id:l.id,label:l.label,height:i,...(l.role?{role:l.role}:{}),description:l.description})),
  domains:domains.map(d=>({id:d.id,label:d.label,placement:'main' as const})),nodes,flows,...(annotations.length?{annotations}:{})};
 const renamed=Object.keys(idMap).length;
 return {spec:file,report:{kept:[`${nodes.length} component(s), ${flows.length} flow(s), ${usedLayers.length} layer(s), ${domains.length} domain(s).`,renamed?`${renamed} ID(s) rewritten to the concept ID pattern (lowercase, hyphens): see idMap.`:'Every component keeps its DiagramCloud ID.'],lost,idMap}};
}
