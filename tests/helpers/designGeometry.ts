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

/** Every geometric defect of one figure: empty, text outside the viewBox, overlapping text. */
export function defects(svg:string,label:string){
 const {boxes,vb,unresolved,shapes}=collect(svg),failures:string[]=[];
 if(!shapes)failures.push(`${label}: empty figure`);
 for(const b of boxes)if(b.x<vb.x-TOL||b.y<vb.y-TOL||b.x+b.w>vb.x+vb.w+TOL||b.y+b.h>vb.y+vb.h+TOL)failures.push(`${label}: outside viewBox "${b.s.slice(0,60)}" [${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)}] vb ${vb.w}×${vb.h}`);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlap(boxes[i],boxes[j]))failures.push(`${label}: overlap "${boxes[i].s.slice(0,40)}" × "${boxes[j].s.slice(0,40)}"`);
 return {failures,texts:boxes.length,unresolved};
}
