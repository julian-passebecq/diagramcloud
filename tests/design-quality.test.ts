import test from 'node:test';
import assert from 'node:assert/strict';
import {designSvg} from '../src/export/design';
import {monoWidth,sansWidth} from '../src/export/design/kit';
import {DESIGN_TYPES,type DesignType,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,type XmlElement} from '../src/core/interchange/xml';

/**
 * Geometric quality check for every Diagram Design figure: text boxes estimated from the kit's own width budgets
 * (mono 0.62 em + tracking, sans Arial advances + 8 %), ascent 0.75 em and descent 0.22 em around the baseline.
 * Serif titles use the sans budget, which runs wider than the serif fallbacks, so it errs on the side of reporting.
 */
const NOW=new Date('2026-10-07T09:00:00Z'),TOL=2;
type TBox={x:number;y:number;w:number;h:number;s:string};
type Inherit={size:number;font:string;anchor:string;tracking:number;weight:number;transform:boolean};
const textOf=(e:XmlElement):string=>e.text+e.children.map(textOf).join('');
function collect(svg:string){
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
const overlap=(a:TBox,b:TBox)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>TOL&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>TOL;

test('design quality: the checker itself sees overlaps, overflow, transforms and empty figures',()=>{
 const {boxes,vb,unresolved,shapes}=collect('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="100%" height="100%"/><g font-size="12"><text x="10" y="30">Overlapping label</text><text x="20" y="32">Second label</text><text x="190" y="60" font-family="ui-monospace">overflows the canvas</text><g transform="rotate(90)"><text x="0" y="0">skipped</text></g></g></svg>');
 assert.equal(shapes,0);assert.equal(unresolved,1);assert.equal(boxes.length,3);assert.ok(overlap(boxes[0],boxes[1]));assert.ok(!overlap(boxes[0],boxes[2]));assert.ok(boxes[2].x+boxes[2].w>vb.w);
});

test('design quality: no overlapping text, every text inside the viewBox, never an empty figure',()=>{
 const failures:string[]=[];let figures=0,unresolved=0,texts=0;
 for(const d of [contosoForecasting(),...samples] as Project[])for(const view of publicDocument(d).views)for(const type of DESIGN_TYPES.filter(t=>t!=='auto') as DesignType[])for(const theme of ['light','dark'] as const){
  const label=`${type}/${d.id}/${view.id}/${theme}`,{boxes,vb,unresolved:u,shapes}=collect(designSvg(d,view.id,{type,theme,now:NOW}));figures++;unresolved+=u;texts+=boxes.length;
  if(!shapes)failures.push(`${label}: empty figure`);
  for(const b of boxes)if(b.x<vb.x-TOL||b.y<vb.y-TOL||b.x+b.w>vb.x+vb.w+TOL||b.y+b.h>vb.y+vb.h+TOL)failures.push(`${label}: outside viewBox "${b.s.slice(0,60)}" [${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)}] vb ${vb.w}×${vb.h}`);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlap(boxes[i],boxes[j]))failures.push(`${label}: overlap "${boxes[i].s.slice(0,40)}" × "${boxes[j].s.slice(0,40)}"`);
 }
 if(unresolved)console.log(`design quality: ${unresolved} text(s) under an unresolved transform skipped`);
 assert.ok(figures>0&&texts>figures*3,`${texts} text boxes in ${figures} figures`);
 assert.equal(failures.length,0,`${failures.length} geometric defect(s) in ${figures} figures:\n${failures.slice(0,80).join('\n')}`);
});
