import {publicDocument} from '../core/operations';
import type {Project,EvidenceBlock} from '../core/model';
import {iconCredit} from './diagram';
import {wrapLines,caption} from './text';
import {NODE_PAD,SCENE_FONT,buildScene,type SceneText} from './scene';
import {textWidth} from './measure';
import {noIcons,type IconData} from './iconData';
import type {IconEntry} from '../core/icons';
/** Largest scale (inches per layout pixel): small views are not blown up past a readable size. */
const MAX_SCALE=.0165;
function textOf(b:EvidenceBlock):string{return b.type==='text'?b.text:b.type==='code'?b.code:b.type==='metrics'?b.items.map(i=>`${i.label}: ${i.value}\n${i.note}`).join('\n\n'):'';}

type Pptx=InstanceType<typeof import('pptxgenjs').default>;
/** `screens` maps an experience workspace id to its first slide in the same deck; boxes linked to one get a SCREEN link. */
export type ScreenLink={slide:number;title:string};
export type ArchitectureParts={cover:boolean;evidence:boolean;sources:boolean;firstViewSlide:number;screens?:Map<string,ScreenLink>;icons?:IconData};

/** Native editable objects, not screenshots. Exported code is display-only. */
export async function exportPptx(input:Project,icons:IconData=noIcons):Promise<void>{
 const d=publicDocument(input),attached=new Set(d.nodes.flatMap(n=>n.blockIds)),blocks=d.blocks.filter(b=>attached.has(b.id));
 const estimate=2+d.views.length+blocks.reduce((sum,b)=>sum+(b.type==='table'?Math.max(1,Math.ceil(b.rows.length/12)):b.type==='image'?1:Math.max(1,Math.ceil(wrapLines(textOf(b),95,b.type==='code').length/(b.type==='code'?23:18)))),0);
 if(estimate>180)throw new Error('This project would create more than 180 slides. Export a smaller public project or use HTML.');
 const {default:PptxGenJS}=await import('pptxgenjs');const pptx=new PptxGenJS();
 pptx.layout='LAYOUT_WIDE';pptx.author=d.author||'DiagramCloud';pptx.subject=d.summary;pptx.title=d.title;pptx.company='DiagramCloud';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos'};
 await addArchitectureSlides(pptx,d,{cover:true,evidence:true,sources:true,firstViewSlide:2,icons});
 await pptx.writeFile({fileName:`${d.id}.pptx`});
}

/** Architecture slides into an existing deck. `d` must already be publicDocument output; view links assume views are consecutive from firstViewSlide. */
export async function addArchitectureSlides(pptx:Pptx,d:Project,parts:ArchitectureParts):Promise<void>{
 const attached=new Set(d.nodes.flatMap(n=>n.blockIds)),blocks=parts.evidence?d.blocks.filter(b=>attached.has(b.id)):[];
 const width=40/3,shape=pptx.ShapeType,icons=parts.icons??noIcons;
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
 if(parts.cover){const cover=base(d.title,d.summary);
 cover.addText('Architecture. The work behind it. The evidence.',{x:.6,y:2.45,w:11.8,h:1.05,fontSize:32,color:'254E88',bold:true,margin:0});
 cover.addText(d.author,{x:.6,y:3.8,w:11.8,h:.45,fontSize:20,color:'172C48',margin:0});
 cover.addText(caption(d.provenance,130,6),{x:.6,y:4.55,w:11.8,h:1.35,fontSize:13,color:'536780',margin:0});
 cover.addText(caption(d.tags.join('  /  '),145,2),{x:.6,y:6.25,w:11.8,h:.45,fontSize:12,color:'536780',margin:0});}
 const slideNumbers=new Map(d.views.map((v,i)=>[v.id,i+parts.firstViewSlide]));
 for(const v of d.views){
  const slide=base(v.title,v.description),scene=buildScene(d,v),b=scene.bounds,scale=Math.min((width-1.2)/b.width,4.6/b.height,MAX_SCALE),left=(width-b.width*scale)/2,top=2.2;
  const X=(x:number)=>left+(x-b.x)*scale,Y=(y:number)=>top+(y-b.y)*scale,pt=(px:number)=>px*scale*72;
  /** One text box per measured block, in Arial with exact line spacing and wrapping off, so PowerPoint keeps the scene's line breaks. */
  const put=(t:SceneText,extra:Record<string,unknown>={})=>{if(!t.lines.length)return;
   const size=pt(t.size),lead=pt(t.lineHeight),topPt=pt(t.y-b.y)-.905*size-Math.max(0,lead-1.15*size)/2,w=(t.width+4)*scale;
   slide.addText(t.lines.join('\n'),{x:t.anchor==='middle'?X(t.x)-w/2:X(t.x),y:top+topPt/72,w,h:lead*t.lines.length/72+.02,fontFace:SCENE_FONT,fontSize:size,lineSpacing:lead,bold:t.bold,color:t.color,align:t.anchor==='middle'?'center':'left',valign:'top',margin:0,wrap:false,...extra});};
  for(const e of scene.edges){
   const route=e.points.map(q=>({x:X(q.x),y:Y(q.y)}));
   for(let i=1;i<route.length;i++){const a=route[i-1],z=route[i];if(Math.abs(a.x-z.x)+Math.abs(a.y-z.y)<.0001)continue;slide.addShape(shape.line,{x:Math.min(a.x,z.x),y:Math.min(a.y,z.y),w:Math.max(.001,Math.abs(z.x-a.x)),h:Math.max(.001,Math.abs(z.y-a.y)),flipH:a.x>z.x,flipV:a.y>z.y,line:{color:'8FA2BA',width:1.5,beginArrowType:'none',endArrowType:i===route.length-1?'triangle':'none',dashType:e.dashed?'dash':'solid'}});}
  }
  const embedded:IconEntry[]=[];
  for(const n of scene.nodes){
   const screen=n.experienceWorkspaceId?parts.screens?.get(n.experienceWorkspaceId):undefined,x=X(n.x),y=Y(n.y),w=n.w*scale,h=n.h*scale;
   slide.addShape(shape.roundRect,{x,y,w,h,rectRadius:12*scale,line:{color:screen?'7FB3DF':'CBD5E1',width:1},fill:{color:'FFFFFF'}});
   slide.addShape(shape.roundRect,{x,y:Y(n.y+12),w:4*scale,h:28*scale,rectRadius:2*scale,line:{color:'2563EB',width:0},fill:{color:'2563EB'}});
   const data=n.icon?icons(n.icon.entry):undefined;
   if(n.icon&&data){slide.addImage({data,x:X(n.icon.x),y:Y(n.icon.y),w:n.icon.size*scale,h:n.icon.size*scale,altText:`${n.icon.entry.label} (${n.icon.entry.vendor} artwork)`});if(!embedded.includes(n.icon.entry))embedded.push(n.icon.entry);}
   put(n.provider);
   // The box title opens the deeper view; without one it opens the task screen. The SCREEN link, on the footer row, always opens the screen.
   const screenLink=screen?{slide:screen.slide,tooltip:`Task screen: ${caption(screen.title,80,1)}`}:undefined;
   put(n.label,{hyperlink:n.childViewId?{slide:slideNumbers.get(n.childViewId)}:screenLink});
   put(n.summary);put(n.footer);
   if(screen)slide.addText([{text:'SCREEN ›',options:{hyperlink:screenLink}}],{x:X(n.x+n.w-NODE_PAD-60),y:Y(n.footer.y)-.905*pt(10)/72,w:60*scale,h:pt(12.5)/72+.02,fontFace:SCENE_FONT,fontSize:pt(10),bold:true,color:'1F6FB2',align:'right',valign:'top',margin:0,wrap:false});
  }
  // Connection labels last, on a background-coloured box as tight as the text: never hidden under a box or a line.
  for(const e of scene.edges)if(e.label){const tight=Math.max(...e.label.lines.map(l=>textWidth(l,e.label!.size)))+6;put({...e.label,width:tight},{fill:{color:'F5F7FB'}});}
  const credit=iconCredit(embedded);
  if(credit)slide.addText(credit,{x:.6,y:6.92,w:12.1,h:.18,fontSize:8,color:'6F8197',margin:0});
  slide.addNotes(notes([v.title,v.description,...(credit?[credit]:[]),...d.nodes.filter(n=>v.nodeIds.includes(n.id)).map(n=>{const sc=n.experienceWorkspaceId?parts.screens?.get(n.experienceWorkspaceId):undefined;return `${n.label}\n${n.summary}\n${n.role}${sc?`\nTask screen: ${sc.title} (slide ${sc.slide})`:''}`;}),...d.story.filter(s=>s.viewId===v.id).map(s=>`${s.title}: ${s.narration}`)]));
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
 if(parts.sources&&d.sources.length){const lines=wrapLines(d.sources.map(s=>`${s.title}\n${s.location}${s.url?'\n'+s.url:''}`).join('\n\n'),135);for(let start=0;start<lines.length;start+=23){const slide=base('Sources and provenance','Source-derived descriptions and synthetic teaching material are distinct.');slide.addText(lines.slice(start,start+23).join('\n'),{x:.7,y:2.25,w:11.9,h:4.5,fontSize:12,color:'536780',valign:'top',margin:0});}}
}
