import {publicDocument,positionFor} from '../core/operations';
import type {Project,EvidenceBlock} from '../core/model';
import {bounds} from './diagram';
import {wrapLines,caption} from './text';
import {NODE_HEIGHT,NODE_WIDTH,orthogonalRoute,routeLabel} from './scene';
function textOf(b:EvidenceBlock):string{return b.type==='text'?b.text:b.type==='code'?b.code:b.type==='metrics'?b.items.map(i=>`${i.label}: ${i.value}\n${i.note}`).join('\n\n'):'';}

/** Native editable objects, not screenshots. Exported code is display-only. */
export async function exportPptx(input:Project):Promise<void>{
 const d=publicDocument(input),attached=new Set(d.nodes.flatMap(n=>n.blockIds)),blocks=d.blocks.filter(b=>attached.has(b.id));
 const estimate=2+d.views.length+blocks.reduce((sum,b)=>sum+(b.type==='table'?Math.max(1,Math.ceil(b.rows.length/12)):b.type==='image'?1:Math.max(1,Math.ceil(wrapLines(textOf(b),95,b.type==='code').length/(b.type==='code'?23:18)))),0);
 if(estimate>180)throw new Error('This project would create more than 180 slides. Export a smaller public project or use HTML.');
 const {default:PptxGenJS}=await import('pptxgenjs');const pptx=new PptxGenJS();
 pptx.layout='LAYOUT_WIDE';pptx.author=d.author||'DiagramCloud';pptx.subject=d.summary;pptx.title=d.title;pptx.company='DiagramCloud';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos'};
 const width=40/3,shape=pptx.ShapeType;
 const sourceNotes='[Sources]\n'+d.sources.map(s=>`${s.title}\n${s.location}${s.url?'\n'+s.url:''}`).join('\n\n')+'\n[/Sources]';
 const notes=(parts:string[])=>[d.provenance,sourceNotes,...parts].join('\n\n');
 function base(title:string,subtitle:string){
  const s=pptx.addSlide();s.background={color:'F5F7FB'};
  s.addText('DIAGRAMCLOUD / PROJECT PORTFOLIO',{x:.6,y:.28,w:12,h:.25,fontSize:10,color:'58718F',charSpacing:2,margin:0});
  s.addText(caption(title,74,2),{x:.6,y:.8,w:12.1,h:.68,fontSize:title.length>70?22:27,bold:true,color:'172C48',margin:0});
  s.addText(caption(subtitle,145,2),{x:.6,y:1.57,w:12.1,h:.48,fontSize:12,color:'536780',margin:0});
  s.addText('Public export · Source labels retained · No live telemetry',{x:.6,y:7.13,w:12.1,h:.18,fontSize:9,color:'6F8197',margin:0});
  s.addNotes(notes([title,subtitle]));return s;
 }
 const cover=base(d.title,d.summary);
 cover.addText('Architecture. The work behind it. The evidence.',{x:.6,y:2.45,w:11.8,h:1.05,fontSize:32,color:'254E88',bold:true,margin:0});
 cover.addText(d.author,{x:.6,y:3.8,w:11.8,h:.45,fontSize:20,color:'172C48',margin:0});
 cover.addText(caption(d.provenance,130,6),{x:.6,y:4.55,w:11.8,h:1.35,fontSize:13,color:'536780',margin:0});
 cover.addText(caption(d.tags.join('  /  '),145,2),{x:.6,y:6.25,w:11.8,h:.45,fontSize:12,color:'536780',margin:0});
 const slideNumbers=new Map(d.views.map((v,i)=>[v.id,i+2]));
 for(const v of d.views){
  const slide=base(v.title,v.description),b=bounds(v),scale=Math.min((width-1.2)/b.width,4.6/b.height),left=(width-b.width*scale)/2,top=2.2;
  const pos=(id:string)=>{const p=positionFor(v,id);return{x:left+(p.x-b.x)*scale,y:top+(p.y-b.y)*scale};};
  for(const e of d.edges.filter(e=>v.edgeIds.includes(e.id))){
   const route=orthogonalRoute(positionFor(v,e.source),positionFor(v,e.target)).map(point=>({x:left+(point.x-b.x)*scale,y:top+(point.y-b.y)*scale}));
   for(let i=1;i<route.length;i++){const a=route[i-1],z=route[i];if(Math.abs(a.x-z.x)+Math.abs(a.y-z.y)<.0001)continue;slide.addShape(shape.line,{x:Math.min(a.x,z.x),y:Math.min(a.y,z.y),w:Math.max(.001,Math.abs(z.x-a.x)),h:Math.max(.001,Math.abs(z.y-a.y)),flipH:a.x>z.x,flipV:a.y>z.y,line:{color:'8FA2BA',width:1.5,beginArrowType:'none',endArrowType:i===route.length-1?'triangle':'none',dashType:e.kind==='control'?'dash':'solid'}});}
   const label=routeLabel(route);slide.addText(caption(e.label,32,1),{x:label.x-.65,y:label.y-.2,w:1.3,h:.18,fontSize:8,color:'536780',align:'center',margin:0});
  }
  for(const n of d.nodes.filter(n=>v.nodeIds.includes(n.id))){
   const p=pos(n.id),w=NODE_WIDTH*scale,h=NODE_HEIGHT*scale;slide.addShape(shape.roundRect,{x:p.x,y:p.y,w,h,rectRadius:.12,line:{color:'CAD5E4',width:1},fill:{color:'FFFFFF'}});
   slide.addText(caption(n.provider.toUpperCase(),30,1),{x:p.x+.12,y:p.y+.08,w:Math.max(.01,w-.24),h:h*.17,fontSize:Math.min(9,scale*1150),color:'58718F',margin:0});
   slide.addText(caption(n.label,25,2),{x:p.x+.12,y:p.y+h*.3,w:Math.max(.01,w-.24),h:h*.3,fontSize:Math.min(14,scale*1650),bold:true,color:'172C48',margin:0,hyperlink:n.childViewId?{slide:slideNumbers.get(n.childViewId)}:undefined});
   slide.addText(caption(n.summary,36,2),{x:p.x+.12,y:p.y+h*.66,w:Math.max(.01,w-.24),h:h*.28,fontSize:Math.min(9,scale*1100),color:'536780',margin:0});
  }
  slide.addNotes(notes([v.title,v.description,...d.nodes.filter(n=>v.nodeIds.includes(n.id)).map(n=>`${n.label}\n${n.summary}\n${n.role}`),...d.story.filter(s=>s.viewId===v.id).map(s=>`${s.title}: ${s.narration}`)]));
 }
 for(const b of blocks){
  const subtitle=d.nodes.filter(n=>n.blockIds.includes(b.id)).map(n=>n.label).join(' / ')+` | ${b.provenance}`;
  if(b.type==='image'){
   const asset=d.assets.find(a=>a.id===b.assetId);if(asset){const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Cannot decode an evidence image'));image.src=asset.data;});const ratio=image.width/image.height,maxW=11.9,maxH=3.8,w=Math.min(maxW,maxH*ratio),h=w/ratio,slide=base(b.title,subtitle);slide.addImage({data:asset.data,x:(width-w)/2,y:2.25+(maxH-h)/2,w,h});slide.addText(caption(b.caption+'\n'+asset.rights,145,4),{x:.7,y:6.2,w:11.9,h:.65,fontSize:10,color:'536780',margin:0});}continue;
  }
  if(b.type==='table'){
   for(let start=0;start<Math.max(1,b.rows.length);start+=12){const slide=base(b.title+(start?` (continued ${start+1})`:''),subtitle),rows=[b.columns,...b.rows.slice(start,start+12).map(row=>row.map(c=>c===null?'—':caption(String(c),55,3)))].map(row=>row.map(text=>({text})));slide.addTable(rows,{x:.65,y:2.25,w:12.05,border:{type:'solid',color:'DCE3ED',pt:.5},fontSize:b.columns.length>7?8:11,color:'243B58',fill:{color:'FFFFFF'},margin:4,rowH:.3,autoPage:false});slide.addNotes(notes([JSON.stringify({columns:b.columns,rows:b.rows.slice(start,start+12)})]));}continue;
  }
  const full=textOf(b),lines=wrapLines(full,95,b.type==='code'),size=b.type==='code'?23:18;
  for(let start=0;start<Math.max(1,lines.length);start+=size){const slide=base(b.title+(start?' (continued)':''),subtitle);slide.addText(lines.slice(start,start+size).join('\n'),{x:.8,y:2.35,w:11.7,h:4.35,fontSize:b.type==='code'?12:16,fontFace:b.type==='code'?'Consolas':'Aptos',color:'243B58',valign:'top',margin:0,paraSpaceAfter:0});slide.addNotes(notes([b.title,subtitle,'Original evidence content:',full]));}
 }
 if(d.sources.length){const lines=wrapLines(d.sources.map(s=>`${s.title}\n${s.location}${s.url?'\n'+s.url:''}`).join('\n\n'),135);for(let start=0;start<lines.length;start+=23){const slide=base('Sources and provenance','Source-derived descriptions and synthetic teaching material are distinct.');slide.addText(lines.slice(start,start+23).join('\n'),{x:.7,y:2.25,w:11.9,h:4.5,fontSize:12,color:'536780',valign:'top',margin:0});}}
 await pptx.writeFile({fileName:`${d.id}.pptx`});
}
