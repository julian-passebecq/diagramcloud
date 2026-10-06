import {documentSchema,validateDocument,type Project,type ProjectEdge,type ProjectNode} from '../model';

/**
 * Interchange graph: what every importer (draw.io, Mermaid, Visio) produces before it becomes a DiagramCloud document.
 * Importers are adapters, not round trips: they keep boxes, labels, connections, groups and (for draw.io) layout,
 * and they list everything they drop in the import report instead of silently approximating it.
 */
export type ImportFormat='drawio'|'mermaid'|'visio'|'repository'|'atlas';
/**
 * `id` is a DiagramCloud ID carried by the source (our own draw.io export) and kept when valid and free.
 * `link` names the page this box opens (a draw.io page link): it becomes a drilldown when the pages form a tree.
 */
export type GraphNode={id?:string;link?:string;key:string;label:string;kind?:ProjectNode['kind'];provider?:string;summary?:string;group?:string;x?:number;y?:number;w?:number;h?:number};
export type GraphEdge={source:string;target:string;label?:string;kind?:ProjectEdge['kind']};
export type GraphPage={id?:string;title:string;nodes:GraphNode[];edges:GraphEdge[];groups:string[];direction?:'LR'|'TB'};
export type ImportReport={format:ImportFormat;fileName:string;pages:number;nodes:number;edges:number;groups:number;kept:string[];lost:string[]};
export type ImportResult={document:Project;report:ImportReport};

export const FORMAT_LABEL:Record<ImportFormat,string>={drawio:'draw.io',mermaid:'Mermaid',visio:'Visio',repository:'Repository',atlas:'Project atlas'};
const ID=/^[a-z][a-z0-9_.-]{0,79}$/;
const MAX_NODES=500,MAX_EDGES=1500,MAX_VIEWS=79,COL=300,ROW=180;
/** Card size on the canvas and in exports (NODE_WIDTH/NODE_HEIGHT in src/export/scene.ts). */
const NODE_WIDTH=220,NODE_HEIGHT=100;

export function slug(value:string,prefix='n'):string{
 const s=value.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60).replace(/-+$/,'');
 return /^[a-z]/.test(s)?s:`${prefix}-${s||'x'}`.replace(/-+$/,'');
}
function unique(base:string,taken:Set<string>):string{let id=base,k=2;while(taken.has(id))id=`${base.slice(0,72)}-${k++}`;taken.add(id);return id;}
const clip=(s:string,max:number)=>s.length>max?`${s.slice(0,max-1)}…`:s;

/** Plain text from a label that may carry HTML (draw.io html=1) or Mermaid entity/markdown escapes. */
export function plainLabel(raw:string):string{
 return raw.replace(/<br\s*\/?>/gi,' ').replace(/<\/(div|p|li|h\d)>/gi,' ').replace(/<[^>]*>/g,'')
  .replace(/#quot;/g,'"').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
  .replace(/^`|`$/g,'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/\s+/g,' ').trim();
}

const PROVIDERS:[RegExp,string][]=[
 [/mxgraph\.(azure|mscae)|img\/lib\/azure|\bazure\b|\bentra\b|cosmos ?db|\bmicrosoft fabric\b/i,'Azure'],
 [/mxgraph\.aws|\baws\b|\bamazon\b|\bs3\b|\blambda\b|dynamodb|\bec2\b|cloudfront|api gateway|\bsqs\b|\bsns\b|kinesis|redshift|aurora/i,'AWS'],
 [/mxgraph\.gcp|\bgcp\b|google cloud|bigquery|cloud run|pub\/?sub|cloud storage|cloud functions|dataflow|\bgke\b/i,'Google Cloud'],
 [/databricks|delta lake|unity catalog/i,'Databricks'],
 [/mxgraph\.kubernetes|kubernetes|\bk8s\b|\bpod\b|\bhelm\b/i,'Kubernetes'],
 [/power ?bi/i,'Power BI'],[/snowflake/i,'Snowflake'],[/kafka/i,'Kafka'],[/postgres/i,'PostgreSQL'],
];
/** Provider name only: vendor shapes are never redrawn as vendor artwork (see the icon registry). */
export function inferProvider(text:string):string{for(const [re,name] of PROVIDERS)if(re.test(text))return name;return 'Generic';}
const KINDS:[RegExp,ProjectNode['kind']][]=[
 [/dashboard|report|power ?bi|grafana|looker|tableau|analytics ui/i,'report'],
 [/function|lambda|cloud run job|serverless/i,'function'],
 [/\bmodel\b|machine learning|\bml\b|\bai\b|openai|llm|inference/i,'model'],
 [/database|\bdb\b|sql|storage|bucket|\bs3\b|blob|lake|warehouse|cosmos|dynamo|redis|cache|bigquery|cylinder|datastore|disk|table storage|\bfiles?\b/i,'storage'],
 [/firewall|\bwaf\b|gateway|key ?vault|secret|identity|auth|entra|\biam\b|security|monitor|policy|rhombus|decision/i,'control'],
 [/\buser|client|browser|mobile|device|iot|sensor|\bsource|internet|actor|partner|external/i,'source'],
 [/\bapp\b|web|frontend|front-end|portal|website|\bui\b|\bspa\b/i,'app'],
 [/\btable\b|\bdim[A-Z_]|\bfact[A-Z_]/,'table'],
];
export function inferKind(text:string):ProjectNode['kind']{for(const [re,kind] of KINDS)if(re.test(text))return kind;return 'process';}

/** Layered layout for diagrams without coordinates (Mermaid): ranks by longest path, back edges ignored, members of a group kept together. */
export function layeredPositions(page:GraphPage):Map<string,{x:number;y:number}>{
 const keys=page.nodes.map(n=>n.key),out=new Map<string,string[]>(),inc=new Map<string,string[]>();keys.forEach(k=>{out.set(k,[]);inc.set(k,[]);});
 const state=new Map<string,number>(),back=new Set<GraphEdge>();
 const adj=new Map<string,GraphEdge[]>();keys.forEach(k=>adj.set(k,[]));page.edges.forEach(e=>adj.get(e.source)?.push(e));
 const dfs=(k:string)=>{state.set(k,1);for(const e of adj.get(k)??[]){const s=state.get(e.target);if(s===1)back.add(e);else if(!s)dfs(e.target);}state.set(k,2);};
 keys.forEach(k=>{if(!state.get(k))dfs(k);});
 for(const e of page.edges)if(!back.has(e)&&e.source!==e.target){out.get(e.source)?.push(e.target);inc.get(e.target)?.push(e.source);}
 const rank=new Map<string,number>(),indeg=new Map(keys.map(k=>[k,inc.get(k)!.length])),queue=keys.filter(k=>indeg.get(k)===0);
 keys.forEach(k=>rank.set(k,0));
 while(queue.length){const k=queue.shift()!;for(const t of out.get(k)!){rank.set(t,Math.max(rank.get(t)!,rank.get(k)!+1));indeg.set(t,indeg.get(t)!-1);if(indeg.get(t)===0)queue.push(t);}}
 const layers:string[][]=[];keys.forEach(k=>{(layers[rank.get(k)!]??=[]).push(k);});
 const order=new Map<string,number>(),group=new Map(page.nodes.map(n=>[n.key,n.group??'']));
 layers.forEach((layer,i)=>{
  if(i>0){const bary=(k:string)=>{const p=inc.get(k)!.map(s=>order.get(s)).filter((v):v is number=>v!==undefined);return p.length?p.reduce((a,b)=>a+b,0)/p.length:Number.MAX_SAFE_INTEGER;};
   const groupBary=new Map<string,number>();for(const k of layer){const g=group.get(k)!;groupBary.set(g,Math.min(groupBary.get(g)??Infinity,bary(k)));}
   layer.sort((a,b)=>groupBary.get(group.get(a)!)!-groupBary.get(group.get(b)!)!||group.get(a)!.localeCompare(group.get(b)!)||bary(a)-bary(b));}
  else layer.sort((a,b)=>group.get(a)!.localeCompare(group.get(b)!));
  layer.forEach((k,j)=>order.set(k,j));});
 const pos=new Map<string,{x:number;y:number}>(),lr=page.direction!=='TB';
 layers.forEach((layer,i)=>layer.forEach((k,j)=>{const along=i*(lr?COL:ROW+40),across=(j-(layer.length-1)/2)*(lr?ROW:COL);pos.set(k,lr?{x:along,y:across}:{x:across,y:along});}));
 return normalize(pos);
}
function normalize(pos:Map<string,{x:number;y:number}>){const xs=[...pos.values()].map(p=>p.x),ys=[...pos.values()].map(p=>p.y),mx=Math.min(0,...xs.length?[Math.min(...xs)]:[]),my=Math.min(0,...ys.length?[Math.min(...ys)]:[]);for(const [k,p] of pos)pos.set(k,{x:Math.round((p.x-mx)/10)*10,y:Math.round((p.y-my)/10)*10});return pos;}

/**
 * Positions for diagrams that carry coordinates (draw.io): keep the author's arrangement, scaled so DiagramCloud's
 * larger cards keep the original gaps, then nudge any remaining overlap to the right.
 */
export function scaledPositions(nodes:GraphNode[]):Map<string,{x:number;y:number}>{
 const c=nodes.map(n=>({key:n.key,cx:(n.x??0)+(n.w??120)/2,cy:(n.y??0)+(n.h??60)/2}));
 const minX=Math.min(...c.map(p=>p.cx)),minY=Math.min(...c.map(p=>p.cy));
 // Nearest-neighbour distance along each axis among boxes that share a row (or a column).
 const gaps=(axis:'cx'|'cy',other:'cx'|'cy',band:number)=>{const g:number[]=[];for(const a of c){let best=Infinity;for(const b of c){if(a===b)continue;const d=b[axis]-a[axis];if(d>1&&Math.abs(b[other]-a[other])<band)best=Math.min(best,d);}if(best<Infinity)g.push(best);}return g.length?Math.min(...g):0;};
 const gx=gaps('cx','cy',40),gy=gaps('cy','cx',60);
 // Scale so the tightest neighbouring pair still has room for two cards side by side (or stacked).
 const kx=gx?Math.min(4,Math.max(1,(NODE_WIDTH+60)/gx)):1.6,ky=gy?Math.min(4,Math.max(1,(NODE_HEIGHT+70)/gy)):1.6;
 const pos=new Map<string,{x:number;y:number}>();
 for(const p of c)pos.set(p.key,{x:(p.cx-minX)*kx,y:(p.cy-minY)*ky});
 const placed:{x:number;y:number}[]=[];
 for(const p of [...c].sort((a,b)=>a.cy-b.cy||a.cx-b.cx)){const q=pos.get(p.key)!;let moved=true;while(moved){moved=false;for(const o of placed)if(Math.abs(o.x-q.x)<NODE_WIDTH+24&&Math.abs(o.y-q.y)<NODE_HEIGHT+24){q.x=o.x+NODE_WIDTH+40;moved=true;}}placed.push(q);}
 return normalize(pos);
}

/** Build one validated DiagramCloud project from interchange pages. More than one page adds a root "Pages" view that drills into each page. */
export function documentFromGraph(pages:GraphPage[],options:{format:ImportFormat;fileName:string;title?:string;lost?:string[];idSuffix?:string;now?:Date}):ImportResult{
 if(!pages.length||pages.every(p=>!p.nodes.length))throw new Error(`No boxes found in this ${FORMAT_LABEL[options.format]} file.`);
 const lost=[...(options.lost??[])],kept:string[]=[];
 const usable=pages.filter(p=>p.nodes.length);
 if(pages.length>usable.length)lost.push(`${pages.length-usable.length} empty page(s) skipped.`);
 if(usable.length>MAX_VIEWS){lost.push(`Only the first ${MAX_VIEWS} pages were imported (of ${usable.length}).`);usable.length=MAX_VIEWS;}
 const fileTitle=options.fileName.replace(/\.(drawio|xml|svg|png|mmd|mermaid|md|txt|vsdx|vsdm)$/i,'').replace(/\.drawio$/i,'');
 const title=clip(options.title?.trim()||(usable.length===1?usable[0].title:'')||fileTitle||`Imported ${FORMAT_LABEL[options.format]} diagram`,160);
 const suffix=options.idSuffix??crypto.randomUUID().slice(0,6);
 const docId=`import-${slug(title,'d').slice(0,50)}-${suffix}`.replace(/[^a-z0-9_.-]/g,'-').slice(0,80);
 const nodeIds=new Set<string>(),edgeIds=new Set<string>(),viewIds=new Set<string>(['overview']);
 const doc:Project=documentSchema.parse({schemaVersion:1,id:docId,title,category:'Blank',tags:['Imported',FORMAT_LABEL[options.format]],rootViewId:'overview',
  summary:`Imported from ${FORMAT_LABEL[options.format]} (${options.fileName}). Review labels, component types and visibility before publishing.`,
  provenance:`Imported from the ${FORMAT_LABEL[options.format]} file “${options.fileName}” on ${(options.now??new Date()).toISOString().slice(0,10)}. Boxes, labels, connections and groups were kept; styles, colours and vendor artwork were not. Component types and providers were inferred from labels and shapes.`,
  nodes:[],edges:[],views:[{id:'overview',title}]});
 let nodeCount=0,edgeCount=0,truncated=0,selfLoops=0,dangling=0;const groups=new Set<string>();
 const pageViews=usable.map((page,pi)=>{
  const viewId=usable.length===1?'overview':unique(slug(page.title||`page-${pi+1}`,'page'),viewIds);
  const keyToId=new Map<string,string>(),members:string[]=[],edges:string[]=[];
  for(const n of page.nodes){
   if(nodeCount>=MAX_NODES)break;
   const label=n.label.trim()||n.key;if(label.length>160)truncated++;
   const id=n.id&&ID.test(n.id)&&!nodeIds.has(n.id)?unique(n.id,nodeIds):unique(slug(options.format==='mermaid'?n.key:label),nodeIds);keyToId.set(n.key,id);members.push(id);nodeCount++;
   const hint=`${label} ${n.summary??''}`;
   doc.nodes.push({id,label:clip(label,160),kind:n.kind??inferKind(hint),provider:clip(n.provider&&(n.provider!=='Generic'||n.id)?n.provider:inferProvider(hint),80),icon:'generic',summary:clip(n.summary??'',500),role:'',status:'idle',blockIds:[],sourceIds:[],tags:n.group?[clip(n.group,80)]:[],visibility:'public'});
   if(n.group)groups.add(n.group);
  }
  for(const e of page.edges){
   const s=keyToId.get(e.source),t=keyToId.get(e.target);
   if(!s||!t){dangling++;continue;}if(s===t){selfLoops++;continue;}
   if(edgeCount>=MAX_EDGES)break;
   const id=unique(`${viewId}-e${edges.length+1}`.slice(0,80),edgeIds);edges.push(id);edgeCount++;
   doc.edges.push({id,source:s,target:t,label:clip(e.label?.trim()??'',160),kind:e.kind??'batch',speed:'medium',visibility:'public'});
  }
  const hasCoords=page.nodes.some(n=>n.x!==undefined);
  const raw=hasCoords?scaledPositions(page.nodes.filter(n=>keyToId.has(n.key))):layeredPositions({...page,nodes:page.nodes.filter(n=>keyToId.has(n.key)),edges:page.edges.filter(e=>keyToId.has(e.source)&&keyToId.has(e.target))});
  const positions=Object.fromEntries([...raw].map(([k,p])=>[keyToId.get(k)!,p]));
  return {id:viewId,title:clip(page.title||title,160),description:'',nodeIds:members,edgeIds:edges,positions,visibility:'public' as const,keyToId};
 });
 // Page links (a box that opens another page) become drilldowns when, followed from the first page, they reach
 // every page exactly once: the first page is then the root view and no "Pages" view is needed.
 const linkOf=new Map<string,number>();usable.forEach((p,i)=>{if(p.id)linkOf.set(p.id,i);});
 const drill:{node:string;view:number}[]=[];
 if(usable.length>1&&linkOf.size){
  const seen=new Set([0]),stack=[0];
  while(stack.length){const i=stack.pop()!;for(const n of usable[i].nodes){const t=n.link!==undefined?linkOf.get(n.link):undefined,id=pageViews[i].keyToId.get(n.key);if(t===undefined||!id||seen.has(t))continue;seen.add(t);stack.push(t);drill.push({node:id,view:t});}}
  if(seen.size!==usable.length)drill.length=0;
 }
 const views=pageViews.map(({keyToId:_,...v})=>v);
 if(usable.length===1)doc.views=[{...views[0],id:'overview'}];
 else if(drill.length){
  const ids=new Map(views.map((v,i)=>[i,i===0?'overview':v.id]));
  doc.views=views.map((v,i)=>({...v,id:ids.get(i)!}));
  for(const {node,view} of drill)doc.nodes.find(n=>n.id===node)!.childViewId=ids.get(view)!;
  kept.push(`${usable.length} pages: the first is the root view and the ${drill.length} page link(s) between them are drilldowns.`);
 }
 else{
  if(linkOf.size&&usable.some(p=>p.nodes.some(n=>n.link)))lost.push('Page links that do not form a single tree from the first page were not imported; every page is reachable from the root “Pages” view instead.');
  // One card per page in a root view; each card drills into its page, so pages stay reachable in public exports.
  const pageNodes=usable.map((page,i)=>{const id=unique(slug(`page-${page.title||i+1}`,'page'),nodeIds);doc.nodes.push({id,label:clip(page.title||`Page ${i+1}`,160),kind:'process',provider:'Generic',icon:'generic',summary:`${views[i].nodeIds.length} components`,role:'',status:'idle',childViewId:views[i].id,blockIds:[],sourceIds:[],tags:[],visibility:'public'});return id;});
  doc.views=[{id:'overview',title,description:`${usable.length} pages imported from ${options.fileName}. Open a page to see its diagram.`,nodeIds:pageNodes,edgeIds:[],positions:Object.fromEntries(pageNodes.map((id,i)=>[id,{x:(i%3)*COL,y:Math.floor(i/3)*ROW}])),visibility:'public'},...views];
  kept.push(`${usable.length} pages, each as a view opened from the root “Pages” cards.`);
 }
 const total=usable.reduce((a,p)=>a+p.nodes.length,0),totalEdges=usable.reduce((a,p)=>a+p.edges.length,0);
 if(total>nodeCount)lost.push(`Only the first ${MAX_NODES} boxes were imported (of ${total}).`);
 if(totalEdges-dangling-selfLoops>edgeCount)lost.push(`Only the first ${MAX_EDGES} connections were imported.`);
 if(dangling)lost.push(`${dangling} connection(s) without a box at both ends were dropped.`);
 if(selfLoops)lost.push(`${selfLoops} self-connection(s) were dropped.`);
 if(truncated)lost.push(`${truncated} label(s) longer than 160 characters were shortened.`);
 kept.unshift(`${nodeCount} boxes and ${edgeCount} connections with their labels.`);
 if(groups.size)kept.push(`${groups.size} group(s) kept as a tag on each member (${[...groups].slice(0,5).join(', ')}${groups.size>5?', …':''}).`);
 kept.push(usable.some(p=>p.nodes.some(n=>n.x!==undefined))?'The original arrangement, rescaled for DiagramCloud cards.':'A layered left-to-right or top-to-bottom layout (the source has no coordinates).');
 kept.push('Component type and provider name inferred from each label and shape; edit them in the Inspector.');
 const document=validateDocument(doc);
 return {document,report:{format:options.format,fileName:options.fileName,pages:usable.length,nodes:nodeCount,edges:edgeCount,groups:groups.size,kept,lost}};
}
