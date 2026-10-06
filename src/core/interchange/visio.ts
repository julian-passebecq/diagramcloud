import {documentFromGraph,inferKind,inferProvider,plainLabel,type GraphEdge,type GraphNode,type GraphPage,type ImportResult} from './graph';
import {parseXml,type XmlElement} from './xml';
import {zipEntries,zipText} from './zip';

/**
 * Visio adapter for .vsdx (and macro-enabled .vsdm / template .vstx) packages: Office Open XML with one XML part per
 * page. Keeps every foreground page, shapes with their text (or their master's name), connectors glued or dropped on
 * shapes, containers and drawn frames as group tags, and the arrangement. Drops themes, fills, lines, fonts, images,
 * shape data, layers and background pages, and lists those losses. Binary .vsd and Visio 2003 XML (.vdx) are refused
 * with a message: Visio can save them as .vsdx.
 */
type Shape={id:string;parent?:string;type:string;master?:Master;masterShape?:XmlElement;el:XmlElement;cells:Map<string,number>;text:string;children:string[]};
type Master={id:string;name:string;shapes:Map<string,XmlElement>;top?:XmlElement};
const DPI=96;

const relsOf=(xml:string|undefined)=>new Map((xml?[...walkAll(parseXml(xml))].filter(e=>e.name==='Relationship'):[]).map(r=>[r.attrs.Id,r.attrs.Target??'']));
function* walkAll(el:XmlElement):Generator<XmlElement>{for(const c of el.children){yield c;yield* walkAll(c);}}
const child=(el:XmlElement|undefined,name:string)=>el?.children.find(c=>c.name===name);
const resolvePart=(base:string,target:string)=>target.startsWith('/')?target.slice(1):`${base}/${target}`.replace(/[^/]+\/\.\.\//g,'');

/** The text a shape shows: plain runs between <cp/>/<pp/>/<tp/> markers plus field values. */
function textOf(el:XmlElement|undefined):string{if(!el)return '';let s=el.text;for(const c of el.children)s+=` ${textOf(c)}`;return s;}
function cellsOf(el:XmlElement|undefined):Map<string,number>{
 const out=new Map<string,number>();
 for(const c of el?.children??[])if(c.name==='Cell'&&c.attrs.N){const v=Number(c.attrs.V);if(Number.isFinite(v))out.set(c.attrs.N,v);}
 return out;
}
/** A User-section value (e.g. msvStructureType) from the shape, then its master shape. */
function userValue(el:XmlElement|undefined,row:string):string{
 const sec=el?.children.find(c=>c.name==='Section'&&c.attrs.N==='User'),r=sec?.children.find(c=>c.name==='Row'&&c.attrs.N===row);
 return (r?.children.find(c=>c.name==='Cell'&&c.attrs.N==='Value')?.attrs.V??'').replace(/^"|"$/g,'');
}
/** Geometry drawn with neither fill nor line: a text block. */
function invisibleGeometry(el:XmlElement|undefined):boolean{
 const geo=el?.children.filter(c=>c.name==='Section'&&c.attrs.N==='Geometry')??[];if(!geo.length)return false;
 return geo.every(g=>{const c=cellsOf(g);return c.get('NoFill')===1&&c.get('NoLine')===1||c.get('NoShow')===1;});
}

async function readMasters(bytes:Uint8Array,entries:ReturnType<typeof zipEntries>):Promise<Map<string,Master>>{
 const list=await zipText(bytes,entries,'visio/masters/masters.xml'),out=new Map<string,Master>();if(!list)return out;
 const rels=relsOf(await zipText(bytes,entries,'visio/masters/_rels/masters.xml.rels'));
 for(const m of [...walkAll(parseXml(list))].filter(e=>e.name==='Master')){
  const rid=child(m,'Rel')?.attrs['r:id'],target=rid?rels.get(rid):undefined,master:Master={id:m.attrs.ID,name:m.attrs.NameU??m.attrs.Name??'',shapes:new Map()};
  const xml=target?await zipText(bytes,entries,resolvePart('visio/masters',target)):undefined;
  if(xml){const shapes=child(child(parseXml(xml),'MasterContents'),'Shapes');for(const s of walkAll(shapes??{name:'',attrs:{},children:[],text:''}))if(s.name==='Shape'&&s.attrs.ID)master.shapes.set(s.attrs.ID,s);
   master.top=shapes?.children.find(c=>c.name==='Shape');}
  out.set(master.id,master);
 }
 return out;
}

function shapesOf(contents:XmlElement,masters:Map<string,Master>):Map<string,Shape>{
 const out=new Map<string,Shape>();
 const visit=(el:XmlElement,parent?:Shape,parentMaster?:Master)=>{
  for(const s of child(el,'Shapes')?.children??[]){
   if(s.name!=='Shape'||!s.attrs.ID)continue;
   const master=s.attrs.Master?masters.get(s.attrs.Master):parentMaster;
   const masterShape=s.attrs.MasterShape&&master?master.shapes.get(s.attrs.MasterShape):s.attrs.Master?master?.top:undefined;
   const cells=new Map([...cellsOf(masterShape),...cellsOf(s)]);
   const ownText=child(s,'Text'),text=plainLabel(textOf(ownText??child(masterShape,'Text')));
   const shape:Shape={id:s.attrs.ID,parent:parent?.id,type:s.attrs.Type??masterShape?.attrs.Type??'Shape',master,masterShape,el:s,cells,text,children:[]};
   out.set(shape.id,shape);parent?.children.push(shape.id);visit(s,shape,master);
  }
 };
 visit(contents);
 return out;
}

function pageGraph(title:string,contents:XmlElement,pageHeight:number,masters:Map<string,Master>,lost:Map<string,number>):GraphPage{
 const count=(k:string,n=1)=>lost.set(k,(lost.get(k)??0)+n);
 const shapes=shapesOf(contents,masters),all=[...shapes.values()];
 const cell=(s:Shape,n:string,d=0)=>s.cells.get(n)??d;
 const isLine=(s:Shape)=>s.cells.has('BeginX')&&s.cells.has('EndX');
 // Origin of a shape's local coordinates on the page (inches, y up); rotation and flips are ignored.
 const origin=(s:Shape):{x:number;y:number}=>{const p=s.parent?origin(shapes.get(s.parent)!):{x:0,y:0},w=cell(s,'Width'),h=cell(s,'Height');
  return {x:p.x+cell(s,'PinX')-cell(s,'LocPinX',w/2),y:p.y+cell(s,'PinY')-cell(s,'LocPinY',h/2)};};
 const box=(s:Shape)=>{const o=origin(s),w=cell(s,'Width'),h=cell(s,'Height');return {x:o.x*DPI,y:(pageHeight-o.y-h)*DPI,w:w*DPI,h:h*DPI};};
 const toPage=(s:Shape,x:number,y:number)=>{const p=s.parent?origin(shapes.get(s.parent)!):{x:0,y:0};return {x:(p.x+x)*DPI,y:(pageHeight-p.y-y)*DPI};};
 const nameOf=(s:Shape)=>(s.master?.name??s.el.attrs.NameU??'').replace(/\.\d+$/,'').replace(/_+/g,' ');

 const connects=[...walkAll(contents)].filter(e=>e.name==='Connect');
 const glued=new Map<string,{begin?:string;end?:string}>();
 for(const c of connects){const g=glued.get(c.attrs.FromSheet)??{};if(c.attrs.FromCell==='BeginX')g.begin=c.attrs.ToSheet;else if(c.attrs.FromCell==='EndX')g.end=c.attrs.ToSheet;glued.set(c.attrs.FromSheet,g);}
 const lines=all.filter(isLine),boxes=all.filter(s=>!isLine(s));
 const referenced=new Set([...glued.values()].flatMap(g=>[g.begin,g.end]).filter((v):v is string=>!!v));
 const structure=(s:Shape)=>userValue(s.el,'msvStructureType')||userValue(s.masterShape,'msvStructureType');
 // A group of two or more labelled or connected shapes is a frame around them; a group of an icon and a caption is one component.
 const meaningful=(id:string)=>{const k=shapes.get(id)!;return !isLine(k)&&(!!k.text||referenced.has(id));};
 const containers=new Set(boxes.filter(s=>/^(Container|List)$/i.test(structure(s))||s.type==='Group'&&s.children.filter(meaningful).length>=2).map(s=>s.id));
 const owner=(id:string):string=>{let s=shapes.get(id);while(s?.parent&&!containers.has(s.parent))s=shapes.get(s.parent);return s?.id??id;};
 const inside=(a:Shape,f:Shape)=>{const A=box(a),F=box(f);return a!==f&&A.x>=F.x&&A.y>=F.y&&A.x+A.w<=F.x+F.w&&A.y+A.h<=F.y+F.h&&A.w*A.h<F.w*F.h;};
 const tops=boxes.filter(s=>owner(s.id)===s.id);
 // A labelled shape drawn behind two or more others, without connectors of its own, is a frame (a region, a network).
 const frames=tops.filter(f=>!containers.has(f.id)&&!referenced.has(f.id)&&f.text&&tops.filter(v=>inside(v,f)).length>=2);
 frames.forEach(f=>containers.add(f.id));
 const groupOf=(s:Shape)=>{for(let p=s.parent?shapes.get(s.parent):undefined;p;p=p.parent?shapes.get(p.parent):undefined)if(containers.has(p.id)&&nameOfFrame(p))return nameOfFrame(p);
  return tops.filter(f=>containers.has(f.id)&&nameOfFrame(f)&&inside(s,f)).sort(byArea).map(nameOfFrame)[0]||undefined;};
 const caption=new Map<string,string>(),consumed=new Set<string>();
 const nameOfFrame=(f:Shape)=>f.text||caption.get(f.id)||'';
 const byArea=(a:Shape,b:Shape)=>box(a).w*box(a).h-box(b).w*box(b).h;
 const labelOf=(s:Shape)=>s.text||caption.get(s.id)||s.children.map(id=>shapes.get(id)!).filter(k=>!isLine(k)).map(k=>k.text).find(Boolean)||'';

 // Reference drawings often name an unlabelled icon with a separate text shape just above or below it, and a network
 // or region with a caption at (or just above) the top of an unlabelled box: the caption names that shape instead of
 // becoming a component of its own.
 const labelled=tops.filter(t=>t.text&&!referenced.has(t.id)&&!containers.has(t.id)&&t.type!=='Group'&&box(t).h<=0.6*DPI);
 const bare=tops.filter(u=>!containers.has(u.id)&&!labelOf(u)&&u.type!=='Foreign'&&!isLine(u));
 const encloses=(u:Shape,t:Shape)=>tops.filter(v=>v!==t&&v!==u&&inside(v,u)).length>=2;
 for(const t of labelled){
  const T=box(t);
  const frame=bare.filter(u=>{if(caption.has(u.id)||!encloses(u,t))return false;const U=box(u);return inside(t,u)||T.x>=U.x-0.2*DPI&&T.x+T.w<=U.x+U.w+0.2*DPI&&U.y-(T.y+T.h)>=-0.05*DPI&&U.y-(T.y+T.h)<=0.3*DPI;}).sort(byArea)[0];
  if(frame){caption.set(frame.id,t.text);containers.add(frame.id);consumed.add(t.id);continue;}
  const near=bare.filter(u=>!caption.has(u.id)&&!containers.has(u.id)&&box(u).w*box(u).h<=(1.5*DPI)**2).map(u=>{const U=box(u);
   return {u,dx:Math.abs(U.x+U.w/2-(T.x+T.w/2)),gap:Math.max(U.y-(T.y+T.h),T.y-(U.y+U.h)),limit:Math.max(U.w,T.w)/2};}).filter(c=>c.dx<=c.limit&&c.gap<=0.3*DPI).sort((a,b)=>a.gap-b.gap)[0];
  if(near){caption.set(near.u.id,t.text);consumed.add(t.id);}
 }
 if(consumed.size)count('caption text shape(s) used as the name of the shape they label',consumed.size);

 const nodes:GraphNode[]=[],ids=new Set<string>(),groups=new Set<string>();
 for(const s of boxes){
  if(consumed.has(s.id))continue;
  if(owner(s.id)!==s.id){if(s.text&&s.text!==labelOf(shapes.get(owner(s.id))!))count('inner text(s) merged into their shape');continue;}
  if(containers.has(s.id)&&!referenced.has(s.id)){if(nameOfFrame(s))groups.add(nameOfFrame(s));continue;}
  const label=labelOf(s),master=nameOf(s);
  if(s.type==='Foreign'&&!label&&!referenced.has(s.id)){count('picture(s) not imported');continue;}
  if(!referenced.has(s.id)&&(/^(text|title|annotation|callout|legend|note)\b/i.test(master)||invisibleGeometry(s.el)||!s.el.children.some(c=>c.name==='Section'&&c.attrs.N==='Geometry')&&!s.masterShape&&s.type!=='Group')){if(label)count('free text annotation(s) not imported');continue;}
  if(!label&&!master&&!referenced.has(s.id)){count('unlabelled decorative shape(s) not imported');continue;}
  if(s.type==='Foreign')count('picture(s) imported as a generic box');
  const b=box(s),group=groupOf(s);if(group)groups.add(group);
  nodes.push({key:s.id,label:label||master||'Unlabelled shape',summary:label&&master&&!label.toLowerCase().includes(master.toLowerCase())?master:'',group,x:b.x,y:b.y,w:b.w,h:b.h,
   kind:inferKind(`${label} ${master}`),provider:inferProvider(`${master} ${label}`)});
  ids.add(s.id);
  if(!label&&master)count('shape(s) without text named after their master shape');
 }
 if(nodes.some(n=>n.provider!=='Generic'))count('vendor or stencil shape(s) drawn with the generic symbol (provider name kept)',nodes.filter(n=>n.provider!=='Generic').length);
 // A connector dropped on a shape without gluing keeps only its end point: attach it to the smallest box under that point.
 const placed=nodes.map(n=>({key:n.key,x:n.x!,y:n.y!,r:n.x!+n.w!,b:n.y!+n.h!}));
 const under=(p:{x:number;y:number})=>{const m=12;return placed.filter(b=>p.x>=b.x-m&&p.x<=b.r+m&&p.y>=b.y-m&&p.y<=b.b+m).sort((a,b)=>(a.r-a.x)*(a.b-a.y)-(b.r-b.x)*(b.b-b.y))[0]?.key;};
 const edges:GraphEdge[]=[];let dropped=0,ways=0;
 for(const l of lines){
  const g=glued.get(l.id)??{};let s=g.begin?owner(g.begin):undefined,t=g.end?owner(g.end):undefined;
  if(!s||!ids.has(s)){const u=under(toPage(l,cell(l,'BeginX'),cell(l,'BeginY')));if(u){s=u;dropped++;}}
  if(!t||!ids.has(t)){const u=under(toPage(l,cell(l,'EndX'),cell(l,'EndY')));if(u){t=u;dropped++;}}
  const begin=cell(l,'BeginArrow'),end=cell(l,'EndArrow');
  if(begin>0&&end===0)[s,t]=[t,s];else if(begin>0||end===0)ways++;
  if(!s&&!t&&!l.text){count('line(s) not attached to any shape not imported');continue;}
  edges.push({source:s&&ids.has(s)?s:'',target:t&&ids.has(t)?t:'',label:l.text,kind:cell(l,'LinePattern',1)>1?'dependency':'batch'});
 }
 if(dropped)count('connector end(s) attached to the shape under them (not glued in Visio)',dropped);
 if(ways)count('two-way or undirected connector(s) imported as one direction',ways);
 return {title,nodes,edges,groups:[...groups]};
}

export const VISIO_ACCEPT='.vsdx,.vsdm,.vstx,.vstm';
export const isVisioFile=(name:string)=>/\.(vsdx|vsdm|vstx|vstm|vsd|vdx|vss|vssx)$/i.test(name);

/** The interchange pages of a Visio package, before they become a document (exported for tests). */
export async function visioPages(bytes:Uint8Array,fileName='diagram.vsdx'):Promise<{pages:GraphPage[];lost:Map<string,number>}>{
 if(bytes[0]===0xd0&&bytes[1]===0xcf&&bytes[2]===0x11&&bytes[3]===0xe0)throw new Error(`${fileName} is in the older binary Visio format (.vsd). Open it in Visio and save it as a .vsdx drawing, then import that file.`);
 if(/^\s*(<\?xml[^>]*>\s*)?<VisioDocument/.test(new TextDecoder().decode(bytes.subarray(0,400))))throw new Error(`${fileName} is a Visio 2003 XML drawing (.vdx). Open it in Visio and save it as a .vsdx drawing, then import that file.`);
 let entries:ReturnType<typeof zipEntries>;
 try{entries=zipEntries(bytes);}catch{throw new Error(`${fileName} is not a Visio drawing: a .vsdx file is a ZIP package.`);}
 const index=await zipText(bytes,entries,'visio/pages/pages.xml');
 if(!index)throw new Error(entries.has('visio/masters/masters.xml')?`${fileName} has no pages: it looks like a Visio stencil. Import a drawing (.vsdx) instead.`:`${fileName} is not a Visio drawing (no visio/pages/pages.xml).`);
 const rels=relsOf(await zipText(bytes,entries,'visio/pages/_rels/pages.xml.rels')),masters=await readMasters(bytes,entries);
 const lost=new Map<string,number>(),pages:GraphPage[]=[];
 for(const [i,p] of [...walkAll(parseXml(index))].filter(e=>e.name==='Page').entries()){
  if(p.attrs.Background==='1'){lost.set('background page(s) not imported',(lost.get('background page(s) not imported')??0)+1);continue;}
  const rid=child(p,'Rel')?.attrs['r:id'],target=rid?rels.get(rid):undefined,xml=target?await zipText(bytes,entries,resolvePart('visio/pages',target)):undefined;
  if(!xml)continue;
  const height=cellsOf(child(p,'PageSheet')).get('PageHeight')??11;
  const contents=child(parseXml(xml),'PageContents');if(!contents)continue;
  pages.push(pageGraph(p.attrs.Name??p.attrs.NameU??`Page ${i+1}`,contents,height,masters,lost));
 }
 if(!pages.length)throw new Error(`No pages found in ${fileName}.`);
 return {pages,lost};
}

export async function importVisio(bytes:Uint8Array,fileName:string,options:{idSuffix?:string;now?:Date}={}):Promise<ImportResult>{
 const {pages,lost}=await visioPages(bytes,fileName);
 const notes=[...lost].map(([what,n])=>`${n} ${what}.`);
 notes.push('Themes, fills, lines, fonts, shape data, layers and connector routes are not imported.');
 return documentFromGraph(pages,{format:'visio',fileName,lost:notes,...options});
}
