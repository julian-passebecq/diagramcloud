import {documentFromGraph,inferKind,inferProvider,plainLabel,type GraphEdge,type GraphNode,type GraphPage,type ImportResult} from './graph';
import {find,parseXml,type XmlElement} from './xml';
import type {ProjectEdge,ProjectNode} from '../model';

/** DiagramCloud's own draw.io export carries its component type, provider and ID so a round trip keeps them. */
const NODE_KINDS:readonly string[]=['source','process','storage','model','report','app','control','physics','function','table'] satisfies ProjectNode['kind'][];
const EDGE_KINDS:readonly string[]=['batch','stream','query','control','dependency'] satisfies ProjectEdge['kind'][];

/**
 * draw.io / diagrams.net adapter. Reads .drawio and .xml files (plain or compressed pages), editable .drawio.svg
 * exports and editable .drawio.png exports. Keeps every page, box, label, connector, container (as a group tag) and
 * the arrangement; drops styles, colours, waypoints, stencil artwork and free text, and lists those losses.
 */
type Cell={id:string;parent?:string;value:string;style:string;vertex:boolean;edge:boolean;source?:string;target?:string;tooltip?:string;x:number;y:number;w:number;h:number;points:number;
 /** Object/UserObject attributes (custom properties, C4 fields) for %placeholder% labels. */
 data:Record<string,string>;sourcePoint?:{x:number;y:number};targetPoint?:{x:number;y:number}};

async function inflate(bytes:Uint8Array,format:'deflate-raw'|'deflate'):Promise<string>{
 const stream=new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(format));
 return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
const fromBase64=(s:string)=>Uint8Array.from(atob(s.replace(/\s+/g,'')),c=>c.charCodeAt(0));
const uriDecode=(s:string)=>{try{return decodeURIComponent(s);}catch{return s;}};

/** A page's mxGraphModel, whether stored as XML or as draw.io's compressed form (base64 → raw deflate → URI-encoded XML). */
async function pageModel(diagram:XmlElement):Promise<XmlElement|undefined>{
 const direct=find(diagram,'mxGraphModel');if(direct)return direct;
 const text=diagram.text.trim();if(!text)return undefined;
 let xml:string;
 try{xml=uriDecode(await inflate(fromBase64(text),'deflate-raw'));}catch{throw new Error(`The draw.io page “${diagram.attrs.name??'page'}” is compressed in a form DiagramCloud cannot read.`);}
 return find(parseXml(xml),'mxGraphModel');
}

function cellsOf(model:XmlElement):Cell[]{
 const root=find(model,'root');if(!root)return [];
 const out:Cell[]=[];
 for(const el of root.children){
  const wrapper=el.name==='object'||el.name==='UserObject'?el:undefined,cell=wrapper?el.children.find(c=>c.name==='mxCell'):el.name==='mxCell'?el:undefined;
  if(!cell)continue;
  const a:Record<string,string|undefined>={...cell.attrs,...(wrapper?{id:wrapper.attrs.id,value:wrapper.attrs.label??''}:{})},geo=cell.children.find(c=>c.name==='mxGeometry');
  const n=(v?:string)=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const point=(as:string)=>{const p=geo?.children.find(c=>c.name==='mxPoint'&&c.attrs.as===as);return p?{x:n(p.attrs.x),y:n(p.attrs.y)}:undefined;};
  out.push({id:a.id??'',parent:a.parent,value:a.value??'',style:a.style??'',vertex:a.vertex==='1',edge:a.edge==='1',source:a.source,target:a.target,tooltip:wrapper?.attrs.tooltip,
   x:n(geo?.attrs.x),y:n(geo?.attrs.y),w:n(geo?.attrs.width)||120,h:n(geo?.attrs.height)||60,points:geo?.children.find(c=>c.name==='Array')?.children.length??0,
   data:wrapper?.attrs??{},sourcePoint:point('sourcePoint'),targetPoint:point('targetPoint')});
 }
 return out;
}

const humanize=(s:string)=>s.replace(/\.(svg|png)$/i,'').replace(/^\d+_?/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/^./,c=>c.toUpperCase());
/** A readable name for an unlabelled vendor stencil: aws4 resIcon/prIcon, the stencil's shape name, or the file name of an image stencil. */
function stencilName(style:string,vendorOnly=true):string{
 if(vendorOnly&&!isVendorStencil(style))return '';
 const res=style.match(/(?:resIcon|prIcon|grIcon|network2Icon)=mxgraph\.[a-z0-9]+\.([a-z0-9_]+)/i)?.[1]??style.match(/shape=mxgraph\.[a-z0-9]+\.([a-z0-9_]+)/i)?.[1]??style.match(/image=img\/lib\/[^;]*\/([^/;]+)\.(?:svg|png)/i)?.[1];
 if(!res||/^(resource_?icon|product_?icon|group|icon|rect|ellipse)$/i.test(res))return '';
 return res?humanize(res):'';
}
function isVendorStencil(style:string){return VENDOR.test(style);}
const VENDOR=/mxgraph\.(aws|azure|gcp|kubernetes|mscae|cisco|ibm|alibaba|oracle|citrix|veeam|vmware|sap)|img\/lib\/(azure|aws|gcp|ibm|mscae)/i;
const isTable=(c:Cell)=>/shape=table|childLayout=tableLayout|shape=tableRow|shape=partialRectangle/.test(c.style);
const isGroupStyle=(c:Cell)=>/(^|;)(swimlane|group)(;|$)|container=1|shape=swimlane|mxgraph\.aws4\.group|groupCenter/.test(c.style);
const isText=(c:Cell)=>/(^|;)text(;|$)/.test(c.style)||/(^|;)shape=text/.test(c.style);

function pageGraph(title:string,cells:Cell[],lost:Map<string,number>):GraphPage{
 const byId=new Map(cells.map(c=>[c.id,c])),count=(k:string,n=1)=>lost.set(k,(lost.get(k)??0)+n);
 const children=new Map<string,Cell[]>();for(const c of cells)if(c.parent)(children.get(c.parent)??children.set(c.parent,[]).get(c.parent)!).push(c);
 const isVertex=(id?:string)=>!!id&&!!byId.get(id)?.vertex,isEdge=(id?:string)=>!!id&&!!byId.get(id)?.edge;
 const vertices=cells.filter(c=>c.vertex&&!isEdge(c.parent));
 const referenced=new Set(cells.filter(c=>c.edge).flatMap(c=>[c.source,c.target]).filter((v):v is string=>!!v));
 // An invisible draw.io group (icon + caption grouped together) that connectors attach to is one component, not a frame.
 const isPlainGroup=(c:Cell)=>/(^|;)group(;|$)/.test(c.style)&&referenced.has(c.id);
 const containers=new Set(vertices.filter(c=>!isTable(c)&&!isPlainGroup(c)&&(isGroupStyle(c)||(children.get(c.id)??[]).some(k=>k.vertex))).map(c=>c.id));
 // A vertex inside a non-container vertex (e.g. a label or icon placed on a box, table rows) belongs to that box.
 const owner=(id:string):string=>{let c=byId.get(id);while(c&&isVertex(c.parent)&&!containers.has(c.parent!))c=byId.get(c.parent!);return c?.id??id;};
 const abs=(c:Cell):{x:number;y:number}=>{const p=c.parent&&isVertex(c.parent)?abs(byId.get(c.parent)!):{x:0,y:0};return {x:p.x+c.x,y:p.y+c.y};};
 // A labelled box drawn behind two or more other shapes, without connectors of its own, is a visual frame (a VNet,
 // a region, a subscription): a group, not a component. The smallest enclosing frame names the group.
 const box=(c:Cell)=>{const p=abs(c);return {x:p.x,y:p.y,r:p.x+c.w,b:p.y+c.h};};
 const inside=(a:Cell,f:Cell)=>{const A=box(a),F=box(f);return a!==f&&A.x>=F.x&&A.y>=F.y&&A.r<=F.r&&A.b<=F.b&&a.w*a.h<f.w*f.h;};
 const frames=vertices.filter(f=>!referenced.has(f.id)&&!containers.has(f.id)&&!isText(f)&&!isTable(f)&&plainLabel(f.value)&&vertices.filter(v=>inside(v,f)).length>=2);
 frames.forEach(f=>containers.add(f.id));
 const groupOf=(c:Cell):string|undefined=>{let p=c.parent?byId.get(c.parent):undefined;while(p){if(containers.has(p.id)){const l=plainLabel(p.value);if(l)return l;}p=p.parent?byId.get(p.parent):undefined;}
  const around=frames.filter(f=>inside(c,f)).sort((a,b)=>a.w*a.h-b.w*b.h)[0];return around?plainLabel(around.value):undefined;};
 // %name% placeholders resolve from the cell's own properties, then its ancestors' (draw.io placeholders=1).
 const resolve=(c:Cell,text:string)=>text.replace(/%([A-Za-z0-9_]+)%/g,(m,k:string)=>{for(let p:Cell|undefined=c;p;p=p.parent?byId.get(p.parent):undefined)if(p.data[k]!==undefined)return p.data[k];return m;});
 const ownLabel=(c:Cell)=>plainLabel(resolve(c,c.data.c4Name??c.value));
 const labelOf=(c:Cell)=>ownLabel(c)||(children.get(c.id)??[]).filter(k=>k.vertex&&!containers.has(k.id)).map(k=>ownLabel(k)).find(Boolean)||stencilName(c.style)||(children.get(c.id)??[]).map(k=>stencilName(k.style)).find(Boolean)||(referenced.has(c.id)?stencilName(c.style,false):'');
 const nodes:GraphNode[]=[],nodeIds=new Set<string>(),groups=new Set<string>();
 for(const c of vertices){
  if(owner(c.id)!==c.id){if(ownLabel(c)&&ownLabel(c)!==labelOf(byId.get(owner(c.id))!))count('inner label(s) merged into their box');continue;}
  const label=labelOf(c);
  if(containers.has(c.id)&&!referenced.has(c.id)){if(label)groups.add(label);continue;}
  if(isText(c)&&!referenced.has(c.id)){if(label)count('free text annotation(s) not imported');continue;}
  if(!label&&!referenced.has(c.id)){count('unlabelled decorative shape(s) not imported');continue;}
  if(/shape=image|(^|;)image;/.test(c.style)&&!isVendorStencil(c.style))count('image shape(s) imported as a generic box');
  if(isVendorStencil(c.style))count('vendor stencil(s) drawn with the generic symbol (provider name kept)');
  const p=abs(c),group=groupOf(c);if(group)groups.add(group);
  const shape=c.style.match(/shape=([^;]+)/)?.[1]??'';
  const c4=c.data.c4Type?.toLowerCase()??'',page=c.data.link?.match(/^data:page\/id,(.+)$/)?.[1];
  nodes.push({key:c.id,...(c.data.dcId?{id:c.data.dcId}:{}),...(page?{link:page}:{}),label:label||'Untitled',summary:plainLabel(resolve(c,c.data.c4Description??c.tooltip??'')),group,x:p.x,y:p.y,w:c.w,h:c.h,
   kind:NODE_KINDS.includes(c.data.dcKind??'')?c.data.dcKind as ProjectNode['kind']:/person/.test(c4)?'source':/database|db/.test(c4)?'storage':/cylinder|datastore/.test(shape)?'storage':/rhombus/.test(c.style)?'control':/actor|umlActor/.test(shape)?'source':inferKind(`${label} ${stencilName(c.style)}`),
   provider:c.data.dcProvider||inferProvider(`${c.style} ${label}`)});
  nodeIds.add(c.id);
 }
 // A connector drawn to a shape without snapping keeps only an end point: attach it to the smallest box under that point.
 const placed=nodes.map(n=>({key:n.key,x:n.x??0,y:n.y??0,r:(n.x??0)+(n.w??0),b:(n.y??0)+(n.h??0)}));
 const under=(edge:Cell,p?:{x:number;y:number})=>{if(!p)return undefined;const o=edge.parent&&isVertex(edge.parent)?abs(byId.get(edge.parent)!):{x:0,y:0},x=p.x+o.x,y=p.y+o.y,m=12;
  return placed.filter(b=>x>=b.x-m&&x<=b.r+m&&y>=b.y-m&&y<=b.b+m).sort((a,b)=>(a.r-a.x)*(a.b-a.y)-(b.r-b.x)*(b.b-b.y))[0]?.key;};
 const edges:GraphEdge[]=[];let snapped=0;
 for(const c of cells.filter(c=>c.edge)){
  let s=c.source?owner(c.source):undefined,t=c.target?owner(c.target):undefined;
  if(!s||!nodeIds.has(s)){const u=under(c,c.sourcePoint);if(u){s=u;snapped++;}}
  if(!t||!nodeIds.has(t)){const u=under(c,c.targetPoint);if(u){t=u;snapped++;}}
  const label=[plainLabel(c.value),...(children.get(c.id)??[]).filter(k=>k.vertex).map(k=>plainLabel(k.value))].filter(Boolean).join(' · ');
  if(c.points)count('connector waypoint set(s) replaced by DiagramCloud routing');
  if(/startArrow=(?!none)[a-z]/i.test(c.style)&&/endArrow=(?!none)[a-z]/i.test(c.style)||/endArrow=none/.test(c.style)&&!/startArrow=(?!none)[a-z]/i.test(c.style))count('two-way or undirected connector(s) imported as one direction');
  edges.push({source:s&&nodeIds.has(s)?s:'',target:t&&nodeIds.has(t)?t:'',label,kind:EDGE_KINDS.includes(c.style.match(/(?:^|;)dcKind=([a-z]+)/)?.[1]??'')?c.style.match(/(?:^|;)dcKind=([a-z]+)/)![1] as ProjectEdge['kind']:/dashed=1/.test(c.style)?'dependency':'batch'});
 }
 // Small unlabelled dots that connectors meet at are junctions: replace each by direct connections through it.
 const junctions=new Set(nodes.filter(n=>n.label==='Untitled'&&(n.w??0)<=24&&(n.h??0)<=24).map(n=>n.key));
 let merged=0;
 for(const j of junctions){
  const into=edges.filter(e=>e.target===j&&e.source),out=edges.filter(e=>e.source===j&&e.target);
  // Lines all drawn away from (or all into) the dot have no direction to follow: keep the dot as a junction component.
  if(!into.length||!out.length){const n=nodes.find(n=>n.key===j)!;n.label='Junction';n.kind='control';count('junction dot(s) with no through direction kept as “Junction”');continue;}
  for(const a of into)for(const b of out)if(a.source!==b.target)edges.push({source:a.source,target:b.target,label:[a.label,b.label].filter(Boolean).join(' · '),kind:a.kind==='dependency'||b.kind==='dependency'?'dependency':'batch'});
  for(let i=edges.length-1;i>=0;i--)if(edges[i].source===j||edges[i].target===j)edges.splice(i,1);
  nodes.splice(nodes.findIndex(n=>n.key===j),1);nodeIds.delete(j);merged++;
 }
 if(merged)count('junction dot(s) replaced by direct connections',merged);
 const unnamed=nodes.filter(n=>n.label==='Untitled');unnamed.forEach(n=>{n.label='Unlabelled shape';});
 if(unnamed.length)count('connected shape(s) without a label, named “Unlabelled shape”',unnamed.length);
 if(snapped)lost.set('connector end(s) attached to the box under them (not snapped in draw.io)',(lost.get('connector end(s) attached to the box under them (not snapped in draw.io)')??0)+snapped);
 return {title,nodes,edges,groups:[...groups]};
}

/** draw.io XML text out of an editable .drawio.svg (its `content` attribute) or the XML itself. */
function mxfileText(raw:string):string{
 const t=raw.replace(/^﻿/,'').trim();
 if(/^<svg[\s>]|^<\?xml[^>]*>\s*(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(t)){const svg=find(parseXml(t),'svg');const content=svg?.attrs.content;if(!content||!/mxfile|mxGraphModel/.test(content))throw new Error('This SVG has no embedded draw.io diagram. In draw.io, export with “Include a copy of my diagram” checked.');return content;}
 return t;
}

/** Editable .drawio.png: draw.io stores the diagram in a tEXt or zTXt chunk named "mxfile". */
export async function drawioFromPng(bytes:Uint8Array):Promise<string>{
 const sig=[137,80,78,71,13,10,26,10];if(sig.some((b,i)=>bytes[i]!==b))throw new Error('Not a PNG file.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let i=8;
 while(i+8<=bytes.length){
  const len=view.getUint32(i),type=String.fromCharCode(...bytes.subarray(i+4,i+8)),data=bytes.subarray(i+8,i+8+len);i+=12+len;
  if(type!=='tEXt'&&type!=='zTXt')continue;
  const nul=data.indexOf(0),key=String.fromCharCode(...data.subarray(0,nul));if(key!=='mxfile')continue;
  const text=type==='tEXt'?new TextDecoder('latin1').decode(data.subarray(nul+1)):await inflate(data.subarray(nul+2),'deflate');
  return uriDecode(text);
 }
 throw new Error('This PNG has no embedded draw.io diagram. In draw.io, export PNG with “Include a copy of my diagram” checked.');
}

export const looksLikeDrawio=(raw:string)=>/^\s*(<\?xml[^>]*>\s*)?<(mxfile|mxGraphModel)[\s>]/.test(raw)||/<svg[^>]*\scontent="[^"]*(mxfile|mxGraphModel)/.test(raw.slice(0,200000));

export async function importDrawio(raw:string,fileName:string,options:{idSuffix?:string;now?:Date}={}):Promise<ImportResult>{
 const {pages,lost}=await drawioPages(raw);
 const notes=[...lost].map(([what,n])=>`${n} ${what}.`);
 notes.push('Fill and line colours, fonts, shape styles and connector styles are not imported.');
 return documentFromGraph(pages,{format:'drawio',fileName,lost:notes,...options});
}

/** The interchange pages of a draw.io file, before they become a document (exported for diagnostics and tests). */
export async function drawioPages(raw:string):Promise<{pages:GraphPage[];lost:Map<string,number>}>{
 const doc=parseXml(mxfileText(raw)),mxfile=find(doc,'mxfile')??(doc.children[0]?.name==='mxfile'?doc.children[0]:undefined);
 const lost=new Map<string,number>(),pages:GraphPage[]=[];
 if(mxfile){
  const diagrams=mxfile.children.filter(c=>c.name==='diagram');
  for(const [i,d] of diagrams.entries()){const model=await pageModel(d);pages.push({...pageGraph(d.attrs.name??`Page ${i+1}`,model?cellsOf(model):[],lost),...(d.attrs.id?{id:d.attrs.id}:{})});}
 }else{
  const model=find(doc,'mxGraphModel');if(!model)throw new Error('Not a draw.io file: no <mxfile> or <mxGraphModel> element.');
  pages.push(pageGraph('',cellsOf(model),lost));
 }
 return {pages,lost};
}
