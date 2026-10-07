import {monoWidth,sansWidth} from '../../src/export/design/kit';
import {parseXml,type XmlElement} from '../../src/core/interchange/xml';

/**
 * Geometric quality check for Diagram Design figures: text boxes estimated from the kit's own width budgets
 * (mono 0.62 em + tracking, sans Arial advances + 8 %), ascent 0.75 em and descent 0.22 em around the baseline.
 * Serif titles use the sans budget, which runs wider than the serif fallbacks, so it errs on the side of reporting.
 */
export const TOL=2;
export type TBox={x:number;y:number;w:number;h:number;s:string};
type Inherit={size:number;font:string;anchor:string;tracking:number;weight:number;transform:boolean};
const textOf=(e:XmlElement):string=>e.text+e.children.map(textOf).join('');
export function collect(svg:string){
 const root=parseXml(svg).children.find(e=>e.name==='svg')!,vb=root.attrs.viewBox.split(/\s+/).map(Number),out:TBox[]=[];let unresolved=0,shapes=0;
 const visit=(e:XmlElement,inh:Inherit)=>{
  const a=e.attrs,cur:Inherit={size:a['font-size']?parseFloat(a['font-size']):inh.size,font:a['font-family']??inh.font,anchor:a['text-anchor']??inh.anchor,tracking:a['letter-spacing']?parseFloat(a['letter-spacing']):inh.tracking,weight:a['font-weight']?+a['font-weight']:inh.weight,transform:inh.transform||!!a.transform};
  if(['rect','path','circle','ellipse','line','polygon','polyline'].includes(e.name)&&!(e.name==='rect'&&a.width==='100%'))shapes++;
  if(e.name==='text'){
   const s=textOf(e).trim();if(!s)return;
   if(cur.transform){unresolved++;return;}
   const mono=/mono|consolas/i.test(cur.font),w=mono?monoWidth(s,cur.size,cur.tracking):sansWidth(s,cur.size,cur.weight>=600)+[...s].length*cur.size*cur.tracking;
   const x=+a.x,y=+a.y,x0=cur.anchor==='middle'?x-w/2:cur.anchor==='end'?x-w:x;
   out.push({x:x0,y:y-cur.size*0.75,w,h:cur.size*0.97,s});return;
  }
  for(const c of e.children)visit(c,cur);
 };
 visit(root,{size:16,font:'',anchor:'start',tracking:0,weight:400,transform:false});
 return {boxes:out,vb:{x:vb[0],y:vb[1],w:vb[2],h:vb[3]},unresolved,shapes};
}
export const overlap=(a:TBox,b:TBox)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>TOL&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>TOL;

/** One line per figure type and defect class ("exploded · shapes overlap: 12"), so a long failure list stays readable. */
export function defectSummary(failures:string[]):string{
 const n=new Map<string,number>();
 for(const s of failures){const k=`${s.split('/')[0]} · ${/: (shapes overlap|shape outside viewBox|overlap|outside viewBox|empty figure)/.exec(s)?.[1]??'other'}`;n.set(k,(n.get(k)??0)+1);}
 return [...n].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join('\n');
}
/** Every geometric defect of one figure: empty, text outside the viewBox, overlapping text, then the component-shape defects. */
export function defects(svg:string,label:string){
 const s=shapeDefects(svg,label),r=textDefects(svg,label);
 return {failures:[...r.failures,...s.failures],texts:r.texts,unresolved:r.unresolved,components:s.shapes,unresolvedShapes:s.unresolved};
}
function textDefects(svg:string,label:string){
 const {boxes,vb,unresolved,shapes}=collect(svg),failures:string[]=[];
 if(!shapes)failures.push(`${label}: empty figure`);
 for(const b of boxes)if(b.x<vb.x-TOL||b.y<vb.y-TOL||b.x+b.w>vb.x+vb.w+TOL||b.y+b.h>vb.y+vb.h+TOL)failures.push(`${label}: outside viewBox "${b.s.slice(0,60)}" [${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)}] vb ${vb.w}×${vb.h}`);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlap(boxes[i],boxes[j]))failures.push(`${label}: overlap "${boxes[i].s.slice(0,40)}" × "${boxes[j].s.slice(0,40)}"`);
 return {failures,texts:boxes.length,unresolved};
}

/**
 * Component shapes. A component is the innermost element carrying one of COMPONENT_MARKERS (an element holding another marked
 * element is a container: a zone, plane or parent tile, never compared). Its shape is the convex hull of the rect, polygon,
 * polyline, circle, ellipse and path geometry under it, shifted by the translate() transforms above it; any other transform
 * leaves it unresolved and counted, never silently passed. Leaves of the same marker (and the same data-depth, for the nested
 * treemap tiles) must not overlap by more than TOL in both axes: bounding boxes first, then a separating-axis test on the hulls,
 * so diagonal isometric neighbours are judged by their real outline. Every shape stays inside the viewBox.
 */
export const COMPONENT_MARKERS=['data-node-id','data-dd-node','data-dd-repo','data-view-ref'] as const;
type Pt={x:number;y:number};
export type Shape={marker:string;id:string;depth:string;pts:Pt[];x:number;y:number;w:number;h:number};
const nums=(s:string)=>(s.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi)??[]).map(Number);
const ARITY:Record<string,number>={M:2,L:2,T:2,H:1,V:1,Q:4,S:4,C:6};
/** Every end and control point of a path (control points keep the hull conservative). */
export function pathPoints(d:string):Pt[]{
 const out:Pt[]=[];let x=0,y=0,sx=0,sy=0;
 for(const [,cmd,args] of d.matchAll(/([MLHVQCTSZAmlhvqctsza])([^MLHVQCTSZAmlhvqctsza]*)/g)){
  const C=cmd.toUpperCase(),rel=cmd!==C,n=nums(args);
  if(C==='Z'){x=sx;y=sy;continue;}
  if(C==='A'){for(let i=0;i+6<n.length;i+=7){x=rel?x+n[i+5]:n[i+5];y=rel?y+n[i+6]:n[i+6];out.push({x,y});}continue;}
  const k=ARITY[C];
  for(let i=0;i+k<=n.length;i+=k){
   if(C==='H'){x=rel?x+n[i]:n[i];out.push({x,y});continue;}
   if(C==='V'){y=rel?y+n[i]:n[i];out.push({x,y});continue;}
   for(let j=0;j<k;j+=2)out.push({x:rel?x+n[i+j]:n[i+j],y:rel?y+n[i+j+1]:n[i+j+1]});
   const end=out[out.length-1];x=end.x;y=end.y;if(C==='M'&&i===0){sx=x;sy=y;}
  }
 }
 return out;
}
function hull(ps:Pt[]):Pt[]{
 const p=[...ps].sort((a,b)=>a.x-b.x||a.y-b.y);if(p.length<3)return p;
 const cr=(o:Pt,a:Pt,b:Pt)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo:Pt[]=[],up:Pt[]=[];
 for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
 for(const q of [...p].reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
 return [...lo.slice(0,-1),...up.slice(0,-1)];
}
const translateOf=(tr:string|undefined):Pt|undefined=>{if(!tr)return {x:0,y:0};const m=/^\s*translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)\s*$/.exec(tr);return m?{x:+m[1],y:+(m[2]??0)}:undefined;};
export function collectShapes(svg:string){
 const root=parseXml(svg).children.find(e=>e.name==='svg')!,vb=root.attrs.viewBox.split(/\s+/).map(Number),shapes:Shape[]=[];let unresolved=0;
 const marked=(e:XmlElement)=>COMPONENT_MARKERS.find(m=>e.attrs[m]!==undefined);
 const holdsMarked=(e:XmlElement):boolean=>e.children.some(c=>!!marked(c)||holdsMarked(c));
 /** Adds the geometry of e and its children; false when a non-translate transform makes it unresolvable. */
 const geometry=(e:XmlElement,at:Pt,pts:Pt[]):boolean=>{
  const tr=translateOf(e.attrs.transform);if(!tr)return false;
  const o={x:at.x+tr.x,y:at.y+tr.y},a=e.attrs,add=(x:number,y:number)=>pts.push({x:x+o.x,y:y+o.y});
  if(e.name==='rect'&&a.width!=='100%'){const x=+(a.x??0),y=+(a.y??0),w=+a.width,h=+a.height;add(x,y);add(x+w,y);add(x+w,y+h);add(x,y+h);}
  else if(e.name==='polygon'||e.name==='polyline'){const n=nums(a.points??'');for(let i=0;i+1<n.length;i+=2)add(n[i],n[i+1]);}
  else if(e.name==='circle'||e.name==='ellipse'){const cx=+(a.cx??0),cy=+(a.cy??0),rx=+(a.r??a.rx),ry=+(a.r??a.ry);add(cx-rx,cy-ry);add(cx+rx,cy-ry);add(cx+rx,cy+ry);add(cx-rx,cy+ry);}
  else if(e.name==='path')for(const p of pathPoints(a.d??''))add(p.x,p.y);
  return e.children.every(c=>geometry(c,o,pts));
 };
 const visit=(e:XmlElement,at:Pt,depth:string)=>{
  const m=marked(e),contains=holdsMarked(e);
  if(m&&!contains){const pts:Pt[]=[];
   if(!geometry(e,at,pts)){unresolved++;return;}
   if(!pts.length)return;
   const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
   shapes.push({marker:m,id:e.attrs[m],depth:e.attrs['data-depth']??depth,pts:hull(pts),x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y});return;}
  if(!contains)return;
  const tr=translateOf(e.attrs.transform);if(!tr){unresolved++;return;}
  for(const c of e.children)visit(c,{x:at.x+tr.x,y:at.y+tr.y},depth);
 };
 visit(root,{x:0,y:0},'');
 return {shapes,vb:{x:vb[0],y:vb[1],w:vb[2],h:vb[3]},unresolved};
}
/** Overlap of two convex hulls along their least-overlapping edge normal (≤ 0 when an axis separates them). */
export function penetration(a:Pt[],b:Pt[]):number{
 if(a.length<3||b.length<3)return Infinity;
 let min=Infinity;
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],len=Math.hypot(q.x-p.x,q.y-p.y);if(!len)continue;
  const nx=-(q.y-p.y)/len,ny=(q.x-p.x)/len,pa=a.map(v=>v.x*nx+v.y*ny),pb=b.map(v=>v.x*nx+v.y*ny);
  min=Math.min(min,Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb)));}
 return min;
}
export const shapesOverlap=(a:Shape,b:Shape)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>TOL&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>TOL&&penetration(a.pts,b.pts)>TOL;

/** Every component-shape defect of one figure: overlapping leaf components of the same marker, shapes outside the viewBox. */
export function shapeDefects(svg:string,label:string){
 const {shapes,vb,unresolved}=collectShapes(svg),failures:string[]=[];
 for(const s of shapes)if(s.x<vb.x-TOL||s.y<vb.y-TOL||s.x+s.w>vb.x+vb.w+TOL||s.y+s.h>vb.y+vb.h+TOL)
  failures.push(`${label}: shape outside viewBox ${s.marker}="${s.id}" [${Math.round(s.x)},${Math.round(s.y)} ${Math.round(s.w)}×${Math.round(s.h)}] vb ${vb.w}×${vb.h}`);
 for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){const a=shapes[i],b=shapes[j];
  if(a.marker===b.marker&&a.depth===b.depth&&shapesOverlap(a,b))failures.push(`${label}: shapes overlap ${a.marker} "${a.id}" × "${b.id}"`);}
 return {failures,shapes:shapes.length,unresolved};
}
