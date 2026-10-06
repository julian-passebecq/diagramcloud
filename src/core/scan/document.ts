import {documentSchema,validateDocument,type Project,type ProjectEdge} from '../model';
import {layeredPositions,slug,type ImportResult} from '../interchange/graph';
import type {Confidence,ScanItem,ScanLink,ScanModel} from './scanner';

/**
 * A scan becomes one project with levels of detail as drilldown views:
 *  - System context (macro): the repository as one system, the external systems it uses, CI/CD and its targets,
 *    and one card per cloud provider of its infrastructure as code;
 *  - Containers (medium): deployable units (packages, compose services, Kubernetes workloads), their datastores,
 *    links between them, and a data model card;
 *  - Components (mini): the modules inside each container and their imports; plus Data lineage and Infrastructure views.
 * Every node carries a source-derived evidence table (file, line, finding, confidence). Scans are Planned/designed
 * information about code, never Observed/verified claims, and they are never marked reviewed.
 */
const LIMITS={nodes:480,edges:1400,views:78,componentViews:20,fileViews:30,filesPerView:40,perView:120};
const SUFFIX:Record<Confidence,string>={confirmed:'',inferred:' (inferred)',possible:' (possible)'};
const clip=(s:string,n:number)=>s.length>n?`${s.slice(0,n-1)}…`:s;

export function documentFromScan(model:ScanModel,options:{now?:Date;fileName?:string}={}):ImportResult{
 const now=options.now??new Date(),items=[...model.items.values()];
 const ids=new Map<string,string>(),taken=new Set<string>();
 const idOf=(key:string)=>{let id=ids.get(key);if(id)return id;const base=slug(key.replace(/^x:/,'ext-').replace(/^c:\.?/,'app-').replace(/[:/]/g,'-'),'n').slice(0,70)||'n';id=base;let k=2;while(taken.has(id))id=`${base}-${k++}`;taken.add(id);ids.set(key,id);return id;};
 const docId=`repo-${slug(model.name,'r').slice(0,60)}`;
 const commit=model.commit?model.commit.slice(0,12):undefined;
 const doc:Project=documentSchema.parse({schemaVersion:1,id:docId,title:clip(`${model.name} architecture (scanned)`,160),category:'Blank',tags:['Scanned','Repository'],rootViewId:'overview',
  summary:clip(`Generated from the ${model.name} repository${model.branch?` (${model.branch}${commit?` @ ${commit}`:''})`:commit?` @ ${commit}`:''}: system context, containers, components, data lineage and infrastructure. Confirmed links are declared in the code or configuration; inferred and possible links are hints to review.`,3000),
  provenance:clip(`Repository scan of ${options.fileName??model.name}${model.branch?` on branch ${model.branch}`:''}${commit?` at commit ${commit}`:''}, ${now.toISOString().slice(0,10)}. Deterministic: manifests, Dockerfiles, docker-compose, Kubernetes, Terraform, GitHub Actions, SQL/dbt/Prisma and import statements; nothing executed, secret files never read, environment values never copied. Each component lists the file and line it comes from.`,3000),
  nodes:[],edges:[],views:[{id:'overview',title:'System context'}]});
 const nodeOf=new Map<string,string>();
 const addNode=(it:ScanItem,childViewId?:string)=>{
  const id=idOf(it.key);if(nodeOf.has(it.key)){if(childViewId)doc.nodes.find(n=>n.id===id)!.childViewId??=childViewId;return id;}
  if(doc.nodes.length>=LIMITS.nodes)return undefined;
  nodeOf.set(it.key,id);
  doc.nodes.push({id,label:clip(it.label,160),kind:it.kind,provider:clip(it.provider,80),icon:'generic',summary:clip(it.summary,500),role:'',status:'idle',blockIds:[],sourceIds:[],tags:[it.confidence,LAYER_TAG[it.layer]],visibility:'public',...(childViewId?{childViewId}:{})});
  return id;
 };
 const rows=new Map<string,(string|number)[][]>();
 const evidenceRow=(key:string,row:(string|number)[])=>{const r=rows.get(key)??rows.set(key,[]).get(key)!;if(r.length<60)r.push(row);};
 for(const it of items)for(const e of it.evidence)evidenceRow(it.key,[e.file,e.line,clip(e.finding,300),e.confidence]);
 for(const l of model.links)for(const e of l.evidence.slice(0,8))evidenceRow(l.from,[e.file,e.line,clip(`→ ${model.items.get(l.to)?.label??l.to}: ${e.finding}`,300),e.confidence]);
 for(const l of model.links)for(const e of l.evidence.slice(0,4))evidenceRow(l.to,[e.file,e.line,clip(`← ${model.items.get(l.from)?.label??l.from}: ${e.finding}`,300),e.confidence]);
 let edgeCount=0;
 const addEdge=(viewId:string,from:string,to:string,label:string,confidence:Confidence,kind:ProjectEdge['kind'],count=1)=>{
  const s=nodeOf.get(from),t=nodeOf.get(to);if(!s||!t||s===t||edgeCount>=LIMITS.edges)return undefined;
  const id=`${viewId}-e${edgeCount++}`.slice(0,80);
  doc.edges.push({id,source:s,target:t,label:clip(`${label}${count>1&&label==='imports'?` ×${count}`:''}${SUFFIX[confidence]}`,160),kind:confidence==='possible'?'dependency':kind,speed:'medium',visibility:'public'});
  return id;
 };
 const views:{id:string;title:string;description:string;keys:string[];links:{from:string;to:string;label:string;confidence:Confidence;kind:ProjectEdge['kind'];count:number}[];direction?:'LR'|'TB'}[]=[];
 const byLayer=(...layers:ScanItem['layer'][])=>items.filter(i=>layers.includes(i.layer));
 const isUsed=(key:string)=>model.links.some(l=>l.from===key||l.to===key);

 // ---- Containers (medium) ----
 const containers=byLayer('container');
 const containerLinks=model.links.filter(l=>l.layer==='container');
 const externalsUsed=[...new Set(containerLinks.map(l=>l.to).filter(k=>model.items.get(k)?.layer==='external'))];
 const tables=byLayer('table');
 const dataKey='data:model';
 if(tables.length){model.items.set(dataKey,{key:dataKey,label:'Data model',kind:'table',provider:'Generic',layer:'group',summary:`${tables.length} tables, views or models; ${model.links.filter(l=>l.layer==='data').length} lineage links (SQL, dbt, Prisma)`,confidence:'confirmed',evidence:[]});for(const t of tables.slice(0,40))for(const e of t.evidence.slice(0,1))evidenceRow(dataKey,[e.file,e.line,clip(`${t.label}: ${e.finding}`,300),e.confidence]);}
 const dbFor=externalsUsed.concat(containers.map(c=>c.key)).find(k=>{const i=model.items.get(k);return i?.kind==='storage'&&(i.tech==='postgresql'||i.tech==='mysql'||i.tech==='sqlserver'||i.tech==='sqlite'||i.tech==='snowflake'||i.tech==='bigquery');});
 views.push({id:'containers',title:'Containers',description:'Deployable units of the repository (packages, compose services, Kubernetes workloads) and the systems they use. Open a container to see its modules.',
  keys:[...containers.map(c=>c.key),...externalsUsed,...(tables.length?[dataKey]:[])],
  links:[...containerLinks,...(tables.length&&dbFor?[{from:dbFor,to:dataKey,label:'holds',confidence:'inferred' as Confidence,kind:'query' as const,count:1}]:[])]});

 // ---- Components (mini), one view per container with modules ----
 const componentViews=new Map<string,string>();let fileViews=0;
 for(const c of containers){
  const mods=items.filter(i=>i.layer==='component'&&i.parent===c.key);if(mods.length<2||componentViews.size>=LIMITS.componentViews)continue;
  const vid=`components-${idOf(c.key)}`.slice(0,80);componentViews.set(c.key,vid);
  const compLinks=model.links.filter(l=>l.layer==='component'&&mods.some(m=>m.key===l.from));
  const techs=[...new Set(compLinks.map(l=>l.to).filter(k=>!mods.some(m=>m.key===k)))];
  for(const m of mods){
   const fl=items.filter(i=>i.layer==='file'&&i.parent===m.key);if(fl.length<2||fileViews>=LIMITS.fileViews)continue;
   const fv=`files-${idOf(m.key)}`.slice(0,80);componentViews.set(m.key,fv);fileViews++;
   const shownFiles=fl.slice(0,LIMITS.filesPerView);
   views.push({id:fv,title:`${c.label} / ${m.label}: files`,description:`Source files of the ${m.label} module and the imports between them.`,keys:shownFiles.map(f=>f.key),links:model.links.filter(l=>l.layer==='file'&&shownFiles.some(f=>f.key===l.from))});
  }
  views.push({id:vid,title:`${c.label}: components`,description:`Modules of ${c.label} (top-level folders of its source) and the imports between them. Edge counts are import statements.`,keys:[...mods.map(m=>m.key),...techs],links:compLinks});
 }

 // ---- Data lineage ----
 if(tables.length)views.push({id:'data-lineage',title:'Data lineage',description:'Tables, views and models from SQL, dbt and Prisma, and how data flows between them (CREATE … AS SELECT, INSERT … SELECT, ref/source, foreign keys and relations).',keys:tables.slice(0,LIMITS.perView).map(t=>t.key),links:model.links.filter(l=>l.layer==='data')});

 // ---- Infrastructure, one view per provider ----
 const resources=byLayer('resource'),providers=[...new Set(resources.map(r=>r.provider))];
 const groupKeys:string[]=[];
 for(const p of providers){
  const list=resources.filter(r=>r.provider===p).slice(0,LIMITS.perView),vid=`infrastructure-${slug(p,'p')}`.slice(0,80),gk=`group:${p}`;
  model.items.set(gk,{key:gk,label:p==='Generic'?'Terraform modules':`${p} infrastructure`,kind:'control',provider:p,layer:'group',summary:`${list.length} Terraform resource(s) or module(s)`,confidence:'confirmed',evidence:list[0]?.evidence.slice(0,1)??[]});
  for(const r of list)for(const e of r.evidence.slice(0,1))evidenceRow(gk,[e.file,e.line,clip(`${r.label}: ${e.finding}`,300),e.confidence]);
  groupKeys.push(gk);componentViews.set(gk,vid);
  views.push({id:vid,title:`${p==='Generic'?'Terraform modules':`${p} infrastructure`}`,description:'Terraform resources and modules, linked where one references another.',keys:list.map(r=>r.key),links:model.links.filter(l=>l.layer==='resource'&&list.some(r=>r.key===l.from))});
 }

 // ---- System context (macro) ----
 const system=model.items.get('system')!;
 const ci=byLayer('ci'),deploy=items.filter(i=>i.key.startsWith('deploy:'));
 const contextExternals=externalsUsed.filter(k=>!deploy.some(d=>d.key===k));
 const lift=new Map<string,{confidence:Confidence;count:number}>();
 for(const l of containerLinks)if(contextExternals.includes(l.to)){const v=lift.get(l.to);lift.set(l.to,{confidence:v?(RANKED.indexOf(l.confidence)<RANKED.indexOf(v.confidence)?l.confidence:v.confidence):l.confidence,count:(v?.count??0)+l.count});}
 views.unshift({id:'overview',title:'System context',description:`${model.name} as one system, the external systems its code and configuration use, how it is built and deployed, and its infrastructure as code. Open the system to see its containers.`,
  keys:['system',...contextExternals,...ci.map(c=>c.key),...deploy.map(d=>d.key),...groupKeys],
  links:[...[...lift].map(([to,v])=>({from:'system',to,label:'uses',confidence:v.confidence,kind:'batch' as const,count:1})),...ci.map(c=>({from:c.key,to:'system',label:'builds and tests',confidence:'confirmed' as Confidence,kind:'control' as const,count:1})),
   ...model.links.filter(l=>l.layer==='ci'),...groupKeys.map(g=>({from:g,to:'system',label:'hosts',confidence:'inferred' as Confidence,kind:'dependency' as const,count:1}))]});

 // ---- Materialize views (root first so drilldown cards exist before their children are referenced) ----
 const childOf=(key:string)=>key==='system'?'containers':key===dataKey?'data-lineage':componentViews.get(key);
 for(const v of views.slice(0,LIMITS.views)){
  const members:string[]=[];
  for(const key of v.keys){const it=model.items.get(key);if(!it)continue;const child=childOf(key);const id=addNode(it,child&&views.some(x=>x.id===child)?child:undefined);if(id&&!members.includes(id))members.push(id);}
  const edgeIds=v.links.map(l=>addEdge(v.id,l.from,l.to,l.label,l.confidence,l.kind,l.count)).filter((x):x is string=>!!x).filter(id=>{const e=doc.edges.find(e=>e.id===id)!;return members.includes(e.source)&&members.includes(e.target);});
  const keyOf=new Map(members.map(id=>[id,id]));
  const pos=layeredPositions({title:v.title,nodes:members.map(id=>({key:id,label:id})),edges:edgeIds.map(id=>{const e=doc.edges.find(e=>e.id===id)!;return {source:e.source,target:e.target};}),groups:[],direction:v.direction??'LR'});
  doc.views.push({id:v.id,title:clip(v.title,160),description:clip(v.description,2000),nodeIds:members,edgeIds,positions:Object.fromEntries([...pos].map(([k,p])=>[keyOf.get(k)!,p])),visibility:'public'});
 }
 doc.views=doc.views.filter((v,i)=>i>0||v.nodeIds.length);
 doc.views[0]=doc.views.find(v=>v.id==='overview'&&v.nodeIds.length)??doc.views[0];
 doc.views=doc.views.filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i);
 // Drop edges no view shows (their ends were capped out).
 const shown=new Set(doc.views.flatMap(v=>v.edgeIds));doc.edges=doc.edges.filter(e=>shown.has(e.id));
 // A drilldown to a view that was not created (limits) is removed.
 for(const n of doc.nodes)if(n.childViewId&&!doc.views.some(v=>v.id===n.childViewId))delete n.childViewId;

 // ---- Evidence tables ----
 for(const [key,list] of rows){const nodeId=nodeOf.get(key);if(!nodeId)continue;const id=`ev-${nodeId}`.slice(0,80);
  doc.blocks.push({id,title:'Scan evidence',type:'table',columns:['File','Line','Finding','Confidence'],rows:list,visibility:'public',sourceIds:[],provenance:'source-derived'});
  doc.nodes.find(n=>n.id===nodeId)!.blockIds.push(id);}
 doc.story=[
  {title:'System context',viewId:'overview',nodeId:nodeOf.get('system'),narration:`${model.name} and the systems around it, from manifests, configuration and CI.`,highlightEdgeIds:[]},
  ...(doc.views.some(v=>v.id==='containers')?[{title:'Containers',viewId:'containers',narration:'The deployable units and what each one talks to. Dashed or “possible” links are hints from configuration names.',highlightEdgeIds:[]}]:[]),
  ...(doc.views.some(v=>v.id==='data-lineage')?[{title:'Data lineage',viewId:'data-lineage',narration:'How tables, views and models feed each other.',highlightEdgeIds:[]}]:[]),
 ].map(s=>s.nodeId?s:{...s,nodeId:undefined}).map(({nodeId,...s})=>nodeId?{...s,nodeId}:s);

 const document=validateDocument(doc);
 const counts=(layer:ScanItem['layer'])=>items.filter(i=>i.layer===layer).length;
 const conf=(c:Confidence)=>model.links.filter(l=>l.confidence===c).length;
 const kept=[`${document.nodes.length} components and ${document.edges.length} connections in ${document.views.length} views (system context → containers → components → files${counts('table')?', data lineage':''}${counts('resource')?', infrastructure':''}).`,
  `Found: ${[...model.detectors].map(([k,n])=>`${n} ${k}`).join(', ')||'nothing recognisable'}.`,
  `Connections: ${conf('confirmed')} confirmed, ${conf('inferred')} inferred, ${conf('possible')} possible. Each component lists its evidence (file, line, finding).`,
  ...(model.commit?[`Scanned at ${model.branch?`${model.branch} @ `:''}${model.commit.slice(0,12)}. Scanning again later gives the same IDs, so the review shows what changed.`]:[])];
 const lost=[...[...model.skipped].map(([k,n])=>`${n} ${k}.`),'Calls, runtime traffic, cloud resources not declared in this repository and code in other languages are not detected.'];
 if(items.length>document.nodes.length)lost.push(`${items.length-document.nodes.length} detected item(s) not shown (limits or not connected to a shown view).`);
 return {document,report:{format:'repository',fileName:options.fileName??model.name,pages:document.views.length,nodes:document.nodes.length,edges:document.edges.length,groups:counts('container'),kept,lost}};
}
const RANKED:Confidence[]=['confirmed','inferred','possible'];
const LAYER_TAG:Record<ScanItem['layer'],string>={system:'System',external:'External system',container:'Container',component:'Component',file:'File',table:'Data',resource:'Infrastructure',ci:'CI/CD',group:'Group'};
