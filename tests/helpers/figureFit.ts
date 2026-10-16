import {parseXml,type XmlElement} from '../../src/core/interchange/xml';
import {textWidth} from '../../src/export/measure';

/**
 * Every printed line of an SVG figure must sit inside its viewBox. Unlike the design-quality text boxes, this check
 * measures each <tspan> line on its own (a wrapped footer is several lines, not one long string) and resolves
 * translate() groups, so the classic, blueprint and editorial figures are checked with the same Arial advances their
 * renderers wrap with. Monospace text is budgeted at 0.62 em per character. Any other transform is counted, never passed.
 */
export type FitLine={s:string;x:number;y:number;w:number;size:number};
const TOL=2;
type Inh={size:number;font:string;anchor:string;bold:boolean;dx:number;dy:number};
const ownText=(e:XmlElement):string=>e.text+e.children.filter(c=>c.name!=='tspan').map(ownText).join('');
export function figureLines(svg:string){
 const root=parseXml(svg).children.find(e=>e.name==='svg');if(!root)throw new Error('Not an SVG figure');
 const vb=root.attrs.viewBox.split(/\s+/).map(Number),lines:FitLine[]=[];let unresolved=0;
 const width=(s:string,inh:Inh)=>/mono|consolas|courier/i.test(inh.font)?[...s].length*inh.size*0.62:textWidth(s,inh.size,inh.bold);
 const place=(s:string,x:number,y:number,inh:Inh)=>{s=s.trim();if(!s)return;const w=width(s,inh),ax=x+inh.dx,x0=inh.anchor==='middle'?ax-w/2:inh.anchor==='end'?ax-w:ax;lines.push({s,x:x0,y:y+inh.dy,w,size:inh.size});};
 const visit=(e:XmlElement,inh:Inh)=>{
  const a=e.attrs;let {dx,dy}=inh;
  if(a.transform){const m=/^\s*translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)\s*$/.exec(a.transform);if(!m){if(e.name==='text'||svgHasText(e))unresolved++;return;}dx+=+m[1];dy+=+(m[2]??0);}
  const cur:Inh={size:a['font-size']?parseFloat(a['font-size']):inh.size,font:a['font-family']??inh.font,anchor:a['text-anchor']??inh.anchor,bold:a['font-weight']?+a['font-weight']>=600||a['font-weight']==='bold':inh.bold,dx,dy};
  if(e.name==='title'||e.name==='metadata'||e.name==='defs')return;
  if(e.name==='text'){
   const x=+(a.x??0),y=+(a.y??0),spans=e.children.filter(c=>c.name==='tspan');
   place(ownText(e),x,y,cur);
   let ly=y;for(const t of spans){const ta=t.attrs;ly=ta.y!==undefined?+ta.y:ly+(ta.dy?parseFloat(ta.dy):0);place(t.text+t.children.map(ownText).join(''),ta.x!==undefined?+ta.x:x,ly,{...cur,size:ta['font-size']?parseFloat(ta['font-size']):cur.size,bold:ta['font-weight']?+ta['font-weight']>=600:cur.bold});}
   return;
  }
  for(const c of e.children)visit(c,cur);
 };
 visit(root,{size:16,font:'',anchor:'start',bold:false,dx:0,dy:0});
 return {lines,vb:{x:vb[0],y:vb[1],w:vb[2],h:vb[3]},unresolved};
}
function svgHasText(e:XmlElement):boolean{return e.name==='text'||e.children.some(svgHasText);}
/** Lines that leave the viewBox: horizontally (the defect that cut the classic footer) or vertically. */
export function fitDefects(svg:string,label:string){
 const {lines,vb,unresolved}=figureLines(svg),failures:string[]=[];
 for(const l of lines)if(l.x<vb.x-TOL||l.x+l.w>vb.x+vb.w+TOL||l.y-l.size*0.75<vb.y-TOL||l.y+l.size*0.22>vb.y+vb.h+TOL)failures.push(`${label}: outside viewBox "${l.s.slice(0,70)}" [${Math.round(l.x)},${Math.round(l.y)} w ${Math.round(l.w)}] vb ${vb.w}×${vb.h}`);
 return {failures,lines:lines.length,unresolved};
}
