import type PptxGenJS from 'pptxgenjs';
import {publicPack,type ExperienceItem,type ExperiencePack,type ExperienceWorkspace} from './model';
import {MODEL_KIND_COLOR,PLAIN_NUMBER_COLUMN,PROVENANCE_NOTE,clip,fmt,statusClass} from './render';
import {MODEL_HEADER,MODEL_ROW,modelLayout,type ModelItem} from './semantic';
import {kpiDisplay} from './kpi';

/**
 * Report screens as native, editable PowerPoint: the same rail + 12-column grid as the in-app Report view.
 * Charts are real PowerPoint charts, tables are real tables, everything else is shapes and text; nothing is
 * a screenshot. Only publicPack content is exported. Tall screens split at row boundaries (a panel is never
 * cut), extra tabs get their own slides, and anything shortened on a slide is kept in full in the notes.
 */
type Pptx=InstanceType<typeof PptxGenJS>;
type Slide=ReturnType<Pptx['addSlide']>;
type Placement=ExperienceWorkspace['placements'][number];
type Box={x:number;y:number;w:number;h:number};

const W=40/3,RAIL=2.35,MAIN_X=RAIL+.3,MAIN_W=W-MAIN_X-.3,BOARD_Y=1.5,BOARD_H=5.3,GAP=.12,MAX_ROWS=9,MAX_ROW_H=.78;
const NAVY='0F2748',INK='13294A',BODY='34465E',MUTED='5B6F88',LINE='DBE3ED',SOFT='EEF4FB';
const ACCENT:Record<ExperienceWorkspace['accent'],string>={blue:'3FB4E8',teal:'2BB3A3',orange:'F28C28',violet:'9B7BE0'};
const SERIES=['1F5FA8','34A3D8','1F9E79','E0892C','8A63C9','CF4A5C'];
const TONE:Record<string,string>={good:'16774F',bad:'B3263B',warn:'9A6508',neutral:'5A6B80',info:'1F5FA8'};
const CHIP:Record<ExperienceItem['provenance'],[string,string]>={synthetic:['FFF1DD','945B0C'],reconstruction:['F1EAFD','6541A8'],'source-derived':['E2F3EF','17705C'],author:['EEF1F5','5A6B80']};
const FONT='Segoe UI',MONO='Consolas';

/** Largest font size (pt) at which the text fits the box, estimated from average glyph width. */
export function fitFont(text:string,w:number,h:number,max=11,min=7,charEm=.52,lineEm=1.28):number{
 for(let size=max;size>=min;size-=.5){
  const perLine=Math.max(1,Math.floor(w*72/(size*charEm))),lines=text.split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil(l.length/perLine)),0);
  if(lines*size*lineEm/72<=h)return size;
 }
 return min;
}
/** Lines that fit at a given size; the rest is summarised in one last line. */
function fitLines(lines:string[],h:number,size:number,what:string):string[]{
 const room=Math.max(1,Math.floor(h*72/(size*1.28)));
 return lines.length<=room?lines:[...lines.slice(0,room-1),`… ${lines.length-room+1} more ${what} (full content in the speaker notes and the HTML export)`];
}

/** Prose that fits the box at a given size (wrapped-line estimate); overflow is cut at a word and pointed to the notes. */
export function fitProse(text:string,w:number,h:number,size:number,charEm=.52,lineEm=1.28):string{
 const perLine=Math.max(1,Math.floor(w*72/(size*charEm))),room=Math.max(1,Math.floor(h*72/(size*lineEm)));
 const out:string[]=[];let used=0;
 for(const para of text.split('\n')){
  const need=Math.max(1,Math.ceil(para.length/perLine));
  if(used+need<=room){out.push(para);used+=need;continue;}
  const left=room-used-1;if(left>0){const cut=para.slice(0,left*perLine),space=cut.lastIndexOf(' ');out.push((space>perLine/2?cut.slice(0,space):cut)+' …');}
  out.push('(continued in the speaker notes and the HTML export)');return out.join('\n');
 }
 return out.join('\n');
}
/** Split grid rows into slide bands at boundaries no panel crosses, each at most MAX_ROWS tall when possible. */
export function rowBands(placements:Placement[]):[number,number][]{
 const end=Math.max(0,...placements.map(p=>p.y+p.h)),cuts=[...new Set([0,end,...placements.flatMap(p=>[p.y,p.y+p.h])])].filter(c=>!placements.some(p=>p.y<c&&c<p.y+p.h)).sort((a,b)=>a-b);
 const bands:[number,number][]=[];let start=0;
 while(start<end){const fit=cuts.filter(c=>c>start&&c-start<=MAX_ROWS);const next=fit.length?Math.max(...fit):cuts.find(c=>c>start)!;bands.push([start,next]);start=next;}
 return bands;
}

export type BackLink={slide:number;label:string};
function frame(pptx:Pptx,w:ExperienceWorkspace,trail:string[],sources:string[],part:string,back?:BackLink){
 const s=pptx.addSlide();s.background={color:'EEF2F7'};
 s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:RAIL,h:7.5,fill:{color:NAVY},line:{color:NAVY}});
 const runs:PptxGenJS.TextProps[]=[];
 const section=(heading:string,lines:string[],strongLast=false)=>{runs.push({text:heading.toUpperCase(),options:{fontSize:7.5,bold:true,color:ACCENT[w.accent],charSpacing:1,breakLine:true,paraSpaceBefore:runs.length?9:0}});
  lines.forEach((l,k)=>runs.push({text:clip(l,60),options:{fontSize:strongLast&&k===lines.length-1?11:8.5,bold:strongLast&&k===lines.length-1,color:strongLast&&k===lines.length-1?'FFFFFF':'DBE6F5',breakLine:true}}));};
 if(trail.length)section('Scope',trail,true);
 for(const c of w.context)section(c.heading,c.lines);
 if(sources.length)section('Sources',sources);
 s.addText(runs,{x:.22,y:.3,w:RAIL-.4,h:6.9,valign:'top',fontFace:FONT,margin:0});
 const backW=back?4.4:0;
 s.addText(clip(trail.join('  ›  ').toUpperCase(),back?80:110)+part,{x:MAIN_X,y:.22,w:MAIN_W-backW,h:.22,fontSize:8,color:MUTED,charSpacing:1,fontFace:FONT,margin:0});
 if(back)s.addText([{text:`← ${clip(back.label,60)}`,options:{hyperlink:{slide:back.slide,tooltip:'Back to the architecture view'}}}],{x:MAIN_X+MAIN_W-backW,y:.2,w:backW,h:.24,fontSize:8.5,bold:true,color:'1F6FB2',align:'right',fontFace:FONT,margin:0});
 s.addText(clip(w.title,90),{x:MAIN_X,y:.46,w:MAIN_W,h:.5,fontSize:w.title.length>60?18:22,bold:true,color:INK,fontFace:FONT,margin:0});
 s.addText(clip(w.description,210),{x:MAIN_X,y:.98,w:MAIN_W,h:.4,fontSize:10,color:MUTED,fontFace:FONT,margin:0,valign:'top'});
 return s;
}
function panel(pptx:Pptx,s:Slide,i:ExperienceItem,b:Box):Box{
 s.addShape(pptx.ShapeType.roundRect,{x:b.x,y:b.y,w:b.w,h:b.h,rectRadius:.06,fill:{color:'FFFFFF'},line:{color:LINE,width:.75}});
 const [bg,fg]=CHIP[i.provenance],chipW=Math.min(1.05,.12+i.provenance.length*.075);
 s.addText(i.provenance.toUpperCase(),{x:b.x+b.w-chipW-.1,y:b.y+.1,w:chipW,h:.19,fontSize:6.5,bold:true,color:fg,fill:{color:bg},align:'center',valign:'middle',fontFace:FONT,margin:0});
 s.addText(clip(i.title,80),{x:b.x+.12,y:b.y+.07,w:b.w-chipW-.3,h:.26,fontSize:b.w<2.2?8.5:10,bold:true,color:INK,fontFace:FONT,margin:0,valign:'middle'});
 return {x:b.x+.12,y:b.y+.38,w:b.w-.24,h:b.h-.47};
}

function tableRows(i:Extract<ExperienceItem,{type:'table'}>,maxRows:number){
 const status=i.statusColumn?i.columns.indexOf(i.statusColumn):-1,plain=i.columns.map(c=>PLAIN_NUMBER_COLUMN.test(c.trim()));
 const shown=i.rows.length>maxRows?i.rows.slice(0,Math.max(1,maxRows-1)):i.rows;
 const cell=(v:unknown,k:number):PptxGenJS.TableCell=>{
  if(k===status){const tone=statusClass(v);return {text:String(v??''),options:{bold:true,color:TONE[tone==='neutral'?'neutral':tone]}};}
  if(typeof v==='number')return {text:plain[k]?String(v):fmt(v),options:{align:'right',color:v<0?TONE.bad:BODY}};
  return {text:v===null?'—':clip(v,60),options:{color:BODY}};
 };
 const rows:PptxGenJS.TableRow[]=[i.columns.map(c=>({text:c,options:{bold:true,color:'4E6179',fill:{color:'F2F6FA'}}})),...shown.map(r=>r.map(cell))];
 if(shown.length<i.rows.length)rows.push([{text:`… ${i.rows.length-shown.length} more rows (full table in the speaker notes)`,options:{colspan:i.columns.length,italic:true,color:MUTED}}]);
 return rows;
}

function chart(pptx:Pptx,s:Slide,p:ExperiencePack,i:Extract<ExperienceItem,{type:'chart'}>,b:Box){
 const t=p.items.find(x=>x.id===i.dataItemId);if(t?.type!=='table'){s.addText('No display data',{x:b.x,y:b.y,w:b.w,h:.3,fontSize:9,color:MUTED});return;}
 const li=t.columns.indexOf(i.labelColumn),vi=i.valueColumns.map(c=>t.columns.indexOf(c)),labels=t.rows.map(r=>String(r[li]));
 const h=b.h-(i.unit?.2:0),box={x:b.x,y:b.y,w:b.w,h},small=b.w<3;
 const common:PptxGenJS.IChartOpts={...box,chartColors:SERIES,showTitle:false,catAxisLabelFontSize:small?7:8,valAxisLabelFontSize:small?7:8,catAxisLabelColor:MUTED,valAxisLabelColor:MUTED,legendFontSize:8,legendColor:BODY,
  valGridLine:{color:'E6EBF1',size:.5},catGridLine:{style:'none'},valAxisLineShow:false,catAxisLineShow:true,catAxisLineColor:'C7D2DF',showLegend:i.valueColumns.length>1,legendPos:'t',dataLabelFontSize:7,dataLabelColor:BODY,
  catAxisLabelFontFace:FONT,valAxisLabelFontFace:FONT,legendFontFace:FONT,dataLabelFontFace:FONT};
 const series=vi.map((c,k)=>({name:i.valueColumns[k],labels,values:t.rows.map(r=>Number(r[c]))}));
 if(i.chartType==='donut')s.addChart(pptx.ChartType.doughnut,series,{...common,holeSize:58,showLegend:true,legendPos:small?'b':'r',showPercent:true,showValue:false,dataLabelColor:'FFFFFF',dataBorder:{pt:1,color:'FFFFFF'}});
 else if(i.chartType==='line')s.addChart(pptx.ChartType.line,series,{...common,lineSize:2,lineDataSymbol:'circle',lineDataSymbolSize:5});
 else if(i.chartType==='scatter'){
  const cats=[...new Set(t.rows.map(r=>String(r[li])))];
  s.addChart(pptx.ChartType.scatter,[{name:i.valueColumns[0],values:t.rows.map(r=>Number(r[vi[0]]))},...cats.map(cat=>({name:cat,values:t.rows.map(r=>String(r[li])===cat?Number(r[vi[1]]):null)}))] as PptxGenJS.OptsChartData[],{...common,showLegend:cats.length>1,lineSize:0,lineDataSymbolSize:6});
 }else{
  // PowerPoint draws horizontal categories bottom-up; reverse so the first row stays on top, as on screen.
  const range=i.chartType==='hbar'&&vi.length===2,ordered=i.chartType==='hbar'?series.map(x=>({...x,labels:[...x.labels].reverse(),values:[...x.values].reverse()})):series;
  s.addChart(pptx.ChartType.bar,ordered,{...common,...(vi.length===1?{chartColors:[SERIES[0]]}:{}),...(range?{catAxisLabelPos:'low' as const,chartColors:[SERIES[1],SERIES[0]]}:{}),barDir:i.chartType==='hbar'?'bar':'col',barGrouping:i.chartType==='stacked'||range?'stacked':'clustered',barGapWidthPct:range?40:60,
   showValue:!range&&vi.length===1&&t.rows.length<=14,// PowerPoint rejects the whole file if a stacked bar uses outEnd labels, so only clustered hbar gets it.
   ...(i.chartType==='hbar'&&!range?{dataLabelPosition:'outEnd' as const}:{}),showLegend:vi.length>1&&!range});
 }
 if(i.unit)s.addText(clip(i.unit,110),{x:b.x,y:b.y+b.h-.18,w:b.w,h:.18,fontSize:7,color:MUTED,fontFace:FONT,margin:0});
}

function gantt(pptx:Pptx,s:Slide,i:Extract<ExperienceItem,{type:'gantt'}>,b:Box){
 const DAY=86400000,dates=[...i.tasks.flatMap(t=>[Date.parse(t.start),Date.parse(t.end)]),...i.milestones.map(m=>Date.parse(m.date))];
 const f=new Date(Math.min(...dates)),start=Date.UTC(f.getUTCFullYear(),f.getUTCMonth(),1),e=new Date(Math.max(...dates)+DAY),end=Date.UTC(e.getUTCFullYear(),e.getUTCMonth()+1,1);
 const groups=[...new Set(i.tasks.map(t=>t.group).filter((g):g is string=>!!g))],labelW=Math.min(1.9,b.w*.26),top=b.y+(i.milestones.length?.42:.24),legendH=groups.length?.24:0;
 const row=Math.min(.3,(b.y+b.h-legendH-top)/i.tasks.length),x0=b.x+labelW,span=b.w-labelW-.35,xx=(ms:number)=>x0+(ms-start)/(end-start)*span,quarterly=(end-start)/(30.44*DAY)>14;
 for(let d=new Date(start);d.getTime()<end;d.setUTCMonth(d.getUTCMonth()+(quarterly?3:1))){const x=xx(d.getTime()),m=d.getUTCMonth();
  s.addShape(pptx.ShapeType.line,{x,y:top-.05,w:0,h:i.tasks.length*row+.05,line:{color:m===0?'C7D2DF':'EDF1F5',width:.5}});
  s.addText(`${quarterly?`Q${Math.floor(m/3)+1}`:d.toLocaleString('en-US',{month:'short',timeZone:'UTC'})}${m===0||d.getTime()===start?` ${d.getUTCFullYear()}`:''}`,{x:x+.02,y:top-.2,w:.8,h:.16,fontSize:6.5,color:MUTED,fontFace:FONT,margin:0});}
 const pos=new Map<string,{x1:number;y:number;x0:number}>();
 i.tasks.forEach((t,k)=>{const y=top+k*row,a=xx(Date.parse(t.start)),z=Math.max(a+.03,xx(Date.parse(t.end)+DAY)),color=SERIES[(t.group?groups.indexOf(t.group):0)%SERIES.length];
  if(t.id)pos.set(t.id,{x0:a,x1:z,y:y+row/2});
  if(k%2===0)s.addShape(pptx.ShapeType.rect,{x:b.x,y,w:b.w,h:row,fill:{color:'F7F9FC'},line:{color:'F7F9FC'}});
  s.addText(clip(t.label,34),{x:b.x+.02,y,w:labelW-.06,h:row,fontSize:Math.min(8.5,row*28),color:BODY,valign:'middle',fontFace:FONT,margin:0});
  s.addShape(pptx.ShapeType.rect,{x:a,y:y+row*.2,w:z-a,h:row*.6,fill:{color,transparency:70},line:{color,transparency:70}});
  if(t.progress>0)s.addShape(pptx.ShapeType.rect,{x:a,y:y+row*.2,w:(z-a)*t.progress/100,h:row*.6,fill:{color},line:{color}});
  s.addText(`${Math.round(t.progress)}%`,{x:z+.03,y,w:.4,h:row,fontSize:6.5,color:MUTED,valign:'middle',fontFace:FONT,margin:0});});
 for(const t of i.tasks)for(const d of t.dependsOn??[]){const a=pos.get(d),z=t.id?pos.get(t.id):undefined;if(!a||!z)continue;const sx=Math.max(a.x0+.02,a.x1-.05);
  s.addShape(pptx.ShapeType.line,{x:sx,y:a.y+row*.3,w:0,h:Math.max(0,z.y-a.y-row*.3),line:{color:'8795A8',width:.5,dashType:'dash'}});
  s.addShape(pptx.ShapeType.line,{x:Math.min(sx,z.x0),y:z.y,w:Math.abs(z.x0-sx),h:0,flipH:z.x0<sx,line:{color:'8795A8',width:.5,dashType:'dash',endArrowType:'triangle'}});}
 i.milestones.forEach((m,k)=>{const x=xx(Date.parse(m.date)),y=b.y+(k%2)*.14;
  s.addShape(pptx.ShapeType.line,{x,y:top-.02,w:0,h:i.tasks.length*row,line:{color:INK,width:.5,dashType:'dash',transparency:40}});
  s.addShape(pptx.ShapeType.diamond,{x:x-.05,y,w:.1,h:.1,fill:{color:INK},line:{color:INK}});
  const right=x+1.9>b.x+b.w;s.addText(`${clip(m.label,24)} · ${m.date}`,{x:right?x-1.95:x+.08,y:y-.03,w:1.9,h:.16,fontSize:6.5,bold:true,color:INK,align:right?'right':'left',fontFace:FONT,margin:0});});
 groups.forEach((g,k)=>{const x=b.x+k*1.35;s.addShape(pptx.ShapeType.rect,{x,y:b.y+b.h-.15,w:.1,h:.1,fill:{color:SERIES[k%SERIES.length]},line:{color:SERIES[k%SERIES.length]}});s.addText(clip(g,18),{x:x+.14,y:b.y+b.h-.19,w:1.2,h:.18,fontSize:7,color:BODY,fontFace:FONT,margin:0});});
}

/** Same layout as the HTML diagram, scaled into the panel: boxes, key-first columns, relationship lines and cardinality. */
function model(pptx:Pptx,s:Slide,i:ModelItem,b:Box){
 const measuresH=i.measures.length?.3:0,L=modelLayout(i,Math.max(560,Math.round(b.w*72))),k=Math.min(b.w/L.w,(b.h-measuresH)/L.h),ox=b.x+(b.w-L.w*k)/2,oy=b.y;
 const X=(v:number)=>ox+v*k,Y=(v:number)=>oy+v*k,pt=(px:number)=>Math.max(5.5,px*k*72);
 for(const l of L.links){const x1=X(l.x1),y1=Y(l.y1),x2=X(l.x2),y2=Y(l.y2),len=Math.hypot(x2-x1,y2-y1)||1,ux=(x2-x1)/len,uy=(y2-y1)/len;
  s.addShape(pptx.ShapeType.line,{x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.max(.001,Math.abs(x2-x1)),h:Math.max(.001,Math.abs(y2-y1)),flipH:x1>x2,flipV:y1>y2,line:{color:'8795A8',width:1,dashType:l.active?'solid':'dash'}});
  for(const [mark,x,y] of [[l.fromMark,x1+ux*.13-uy*.08,y1+uy*.13+ux*.08],[l.toMark,x2-ux*.13-uy*.08,y2-uy*.13+ux*.08]] as [string,number,number][])
   s.addText(mark,{x:x-.08,y:y-.08,w:.16,h:.16,fontSize:pt(10),bold:true,color:BODY,align:'center',valign:'middle',fontFace:FONT,margin:0});}
 for(const t of L.boxes){const color=MODEL_KIND_COLOR[t.kind];
  s.addShape(pptx.ShapeType.roundRect,{x:X(t.x),y:Y(t.y),w:t.w*k,h:t.h*k,rectRadius:.04,fill:{color:'FFFFFF'},line:{color:'CBD6E4',width:.75}});
  s.addText(clip(t.name,40),{x:X(t.x),y:Y(t.y),w:t.w*k,h:MODEL_HEADER*k,fontSize:pt(11),bold:true,color:'FFFFFF',fill:{color},fontFace:FONT,margin:4,valign:'middle'});
  const rows=[...t.rows.map(r=>({text:`${clip(r.name,32)}${r.key?`  ${r.key.toUpperCase()}`:''}`,options:{bold:!!r.key,color:r.key?INK:MUTED,breakLine:true}})),...(t.more?[{text:`… ${t.more} more`,options:{italic:true,color:'8795A8'}}]:[])];
  s.addText(rows,{x:X(t.x),y:Y(t.y+MODEL_HEADER),w:t.w*k,h:(t.h-MODEL_HEADER)*k,fontSize:pt(9.5),fontFace:FONT,margin:4,valign:'top',paraSpaceAfter:0,lineSpacing:MODEL_ROW*k*72});}
 if(i.measures.length)s.addText([{text:'Measures  ',options:{bold:true,color:'4E6179'}},{text:i.measures.map(m=>`Σ ${m.name}`).join('   ·   '),options:{color:INK}}],{x:b.x,y:b.y+b.h-.26,w:b.w,h:.26,fontSize:8,fontFace:FONT,margin:0,valign:'middle'});
}

function body(pptx:Pptx,s:Slide,p:ExperiencePack,i:ExperienceItem,b:Box,appendix:ExperienceItem[]){
 switch(i.type){
  case 'note':{const size=fitFont(i.text,b.w,b.h,11,7);s.addText(fitProse(i.text,b.w,b.h,size),{...b,fontSize:size,color:BODY,valign:'top',fontFace:FONT,margin:0,paraSpaceAfter:2});return;}
  case 'code':{const size=Math.max(6.5,Math.min(9,fitFont(i.code,b.w,b.h-(i.file?.2:0),9,6.5,.6,1.25)));const y=b.y+(i.file?.2:0),h=b.h-(i.file?.2:0);
   if(i.file)s.addText(clip(i.file,80),{x:b.x,y:b.y,w:b.w,h:.18,fontSize:7,color:MUTED,fontFace:MONO,margin:0});
   s.addShape(pptx.ShapeType.roundRect,{x:b.x,y,w:b.w,h,rectRadius:.05,fill:{color:'0F1D33'},line:{color:'0F1D33'}});
   s.addText(fitLines(i.code.split('\n'),h-.14,size,'lines').join('\n'),{x:b.x+.1,y:y+.07,w:b.w-.2,h:h-.14,fontSize:size,fontFace:MONO,color:'D7E5FB',valign:'top',margin:0,wrap:true});return;}
  case 'table':{const size=b.w<3.5?7:8,rowH=size*1.9/72,maxRows=Math.max(1,Math.floor(b.h/rowH)-1);
   const weights=i.columns.map((c,k)=>Math.min(34,Math.max(5,c.length,...i.rows.slice(0,maxRows).map(r=>String(r[k]??'').length)))),total=weights.reduce((a,v)=>a+v,0);
   s.addTable(tableRows(i,maxRows),{x:b.x,y:b.y,w:b.w,colW:weights.map(v=>b.w*v/total),fontSize:size,fontFace:FONT,rowH,margin:[1,4,1,4],border:{type:'solid',color:'E8EDF3',pt:.5},fill:{color:'FFFFFF'},autoPage:false,valign:'middle'});return;}
  case 'kpi':{const tone=i.tone??(i.trend==='up'?'good':i.trend==='down'?'bad':'neutral'),k=kpiDisplay(p,i),valueSize=Math.min(28,Math.max(14,(b.w*72)/((k.value.length+i.unit.length*.55)*.62)));
   s.addText([{text:k.value,options:{fontSize:valueSize,bold:true,color:INK}},{text:i.unit?`  ${i.unit}`:'',options:{fontSize:Math.max(9,valueSize*.42),color:MUTED}}],{x:b.x,y:b.y,w:b.w,h:Math.min(.55,b.h*.55),fontFace:FONT,margin:0,valign:'middle'});
   const lines:PptxGenJS.TextProps[]=[];
   if(i.delta||i.trend)lines.push({text:`${i.trend?{up:'▲',down:'▼',flat:'▬'}[i.trend]+' ':''}${i.delta??''}`,options:{bold:true,color:TONE[tone]}},{text:i.comparison?`  ${i.comparison}`:'',options:{color:MUTED,breakLine:!!(k.note||k.from)}});
   if(k.note)lines.push({text:clip(k.note,120),options:{color:MUTED,breakLine:!!k.from}});
   if(k.from)lines.push({text:`↻ counted from “${clip(k.from,60)}”`,options:{color:MUTED,italic:true}});
   if(lines.length)s.addText(lines,{x:b.x,y:b.y+Math.min(.55,b.h*.55),w:b.w,h:b.h-Math.min(.55,b.h*.55),fontSize:8,fontFace:FONT,margin:0,valign:'top'});return;}
  case 'chart':chart(pptx,s,p,i,b);return;
  case 'model':model(pptx,s,i,b);return;
  case 'gantt':gantt(pptx,s,i,b);return;
  case 'image':s.addImage({data:i.data,x:b.x,y:b.y,w:b.w,h:b.h-.2,sizing:{type:'contain',w:b.w,h:b.h-.2}});s.addText(clip(i.caption,140),{x:b.x,y:b.y+b.h-.18,w:b.w,h:.18,fontSize:7,color:MUTED,fontFace:FONT,margin:0});return;
  case 'filters':{const cols=b.w>2.6?2:1,rows=Math.ceil(i.fields.length/cols),rh=Math.min(.52,(b.h-.2)/rows),cw=(b.w-(cols-1)*.12)/cols;
   i.fields.forEach((f,k)=>{const x=b.x+(k%cols)*(cw+.12),y=b.y+Math.floor(k/cols)*rh;
    s.addText(clip(f.label,30),{x,y,w:cw,h:.16,fontSize:7,color:MUTED,fontFace:FONT,margin:0});
    s.addText(`${clip(f.value,28)}`,{x,y:y+.17,w:cw,h:Math.min(.26,rh-.2),fontSize:8,color:BODY,fontFace:FONT,margin:2,valign:'middle',fill:{color:'FBFCFE'},line:{color:'CDD8E5',width:.5}});});
   s.addText('Displayed view state · not a live filter',{x:b.x,y:b.y+b.h-.17,w:b.w,h:.17,fontSize:6.5,color:MUTED,fontFace:FONT,margin:0});return;}
  case 'callouts':{const gap=.08,h=(b.h-gap*(i.entries.length-1))/i.entries.length;
   i.entries.forEach((c,k)=>{const y=b.y+k*(h+gap),color=TONE[c.tone];
    s.addShape(pptx.ShapeType.rect,{x:b.x,y,w:b.w,h,fill:{color:'F5F8FC'},line:{color:'F5F8FC'}});s.addShape(pptx.ShapeType.rect,{x:b.x,y,w:.05,h,fill:{color},line:{color}});
    const size=fitFont(`${c.title}\n${c.text}`,b.w-.25,h-.08,9,6.5);
    s.addText([{text:c.title,options:{bold:true,color:INK,breakLine:true}},{text:c.text,options:{color:BODY}}],{x:b.x+.14,y:y+.04,w:b.w-.22,h:h-.08,fontSize:size,fontFace:FONT,margin:0,valign:'middle'});});return;}
  case 'steps':{const n=i.steps.length,w=(b.w+(n-1)*.02)/n,h=Math.min(b.h,.75);
   i.steps.forEach((st,k)=>{const x=b.x+k*(w-.02);s.addShape(k===0?pptx.ShapeType.homePlate:pptx.ShapeType.chevron,{x,y:b.y,w,h,fill:{color:SOFT},line:{color:'FFFFFF',width:1}});
    s.addText([{text:`${k+1}  ${st.title}`,options:{bold:true,color:INK,breakLine:!!st.caption}},...(st.caption?[{text:st.caption,options:{color:MUTED,fontSize:6.5}}]:[])],{x:x+(k?.22:.1),y:b.y,w:w-.42,h,fontSize:w<1.4?7:8,fontFace:FONT,margin:0,valign:'middle'});});return;}
  case 'tabs':{const children=i.itemIds.map(id=>p.items.find(x=>x.id===id)).filter((x):x is ExperienceItem=>!!x&&x.type!=='tabs');
   children.forEach((c,k)=>s.addText(clip(c.title,24),{x:b.x+k*1.5,y:b.y,w:1.45,h:.24,fontSize:7.5,bold:k===0,color:k===0?INK:MUTED,align:'center',valign:'middle',fontFace:FONT,margin:0,fill:{color:k===0?'FFFFFF':'F5F8FC'},line:{color:k===0?'1F5FA8':LINE,width:k===0?1:.5}}));
   if(children.length>1)s.addText(`Other tabs follow on their own slides: ${children.slice(1).map(c=>c.title).join(', ')}`,{x:b.x,y:b.y+b.h-.16,w:b.w,h:.16,fontSize:6.5,italic:true,color:MUTED,fontFace:FONT,margin:0});
   if(children[0])body(pptx,s,p,children[0],{x:b.x,y:b.y+.32,w:b.w,h:b.h-.52},appendix);appendix.push(...children.slice(1));return;}
  case 'formula':{const eh=Math.min(.7,b.h*.45);s.addText(i.expression,{x:b.x,y:b.y,w:b.w,h:eh,fontSize:Math.min(20,Math.max(11,b.w*72/(i.expression.length*.6))),fontFace:'Cambria',italic:true,bold:true,color:INK,align:'center',valign:'middle',fill:{color:SOFT},margin:0});
   if(i.symbols.length)s.addText(i.symbols.map(sym=>`${sym.symbol}   ${sym.meaning}`).join('\n'),{x:b.x+.1,y:b.y+eh+.08,w:b.w-.2,h:b.h-eh-.08,fontSize:fitFont(i.symbols.map(sym=>`${sym.symbol}   ${sym.meaning}`).join('\n'),b.w-.2,b.h-eh-.08,9,6.5),color:BODY,fontFace:FONT,margin:0,valign:'top'});return;}
 }
}

function noteText(p:ExperiencePack,i:ExperienceItem):string{
 const head=`${i.title} [${i.type} · ${i.provenance}] ${PROVENANCE_NOTE[i.provenance]}.`;
 if(i.type==='code')return `${head}\n${i.code}`;
 if(i.type==='table')return `${head}\n${[i.columns,...i.rows].map(r=>r.map(c=>c??'—').join(' | ')).join('\n')}`;
 if(i.type==='note')return `${head}\n${i.text}`;
 if(i.type==='kpi'){const k=kpiDisplay(p,i);return `${head}\n${[k.value,i.unit].filter(Boolean).join(' ')}${k.note?` · ${k.note}`:''}${k.from?` (counted from ${k.from})`:''}`;}
 if(i.type==='model')return `${head}\nTables:\n${i.tables.map(t=>`- ${t.name} (${t.kind}): ${t.columns.map(c=>c.name+(c.key?` [${c.key}]`:'')).join(', ')}`).join('\n')}\nRelationships:\n${i.relationships.map(r=>`- ${r.from} -> ${r.to} (${r.cardinality}${r.active?'':', inactive'})`).join('\n')}${i.measures.length?`\nMeasures: ${i.measures.map(m=>m.name).join(', ')}`:''}`;
 if(i.type==='tabs')return `${head}\n${i.itemIds.map(id=>p.items.find(x=>x.id===id)).filter((x):x is ExperienceItem=>!!x&&x.type!=='tabs').map(c=>`--- Tab: ${noteText(p,c)}`).join('\n\n')}`;
 if(i.type==='chart'){const t=p.items.find(x=>x.id===i.dataItemId);return `${head}\nData: ${t?.title??i.dataItemId}${i.unit?` · ${i.unit}`:''}`;}
 return head;
}

/** Build the deck for one or more public workspaces. Pure apart from pptxgenjs; used by the browser download and by tests. */
export function buildWorkspaceDeck(PptxCtor:typeof PptxGenJS,input:ExperiencePack,workspaceIds:string[],trail:string[]=[]):Pptx{
 const p=publicPack(input),pptx=new PptxCtor();
 pptx.layout='LAYOUT_WIDE';pptx.title=p.title;pptx.company='DiagramCloud';pptx.author='DiagramCloud';pptx.subject='Report screens: displayed examples, not live queries';
 addWorkspaceSlides(pptx,p,workspaceIds,()=>trail);
 return pptx;
}

/**
 * Report-screen slides into an existing deck. `p` must already be publicPack output. Returns slides added per workspace, in order.
 * The count never depends on trail or back link, so a throwaway run can predict slide numbers. `backFor` adds a return link.
 */
export function addWorkspaceSlides(pptx:Pptx,p:ExperiencePack,workspaceIds:string[],trailFor:(workspaceId:string)=>string[],backFor:(workspaceId:string)=>BackLink|undefined=()=>undefined):number[]{
 const counts:number[]=[];
 for(const id of workspaceIds){
  const trail=trailFor(id),back=backFor(id);
  const w=p.workspaces.find(x=>x.id===id);if(!w)throw new Error(`Workspace ${id} is not approved for public export`);
  const placed=w.placements.filter(s=>p.items.some(i=>i.id===s.itemId));
  const items=placed.map(s=>p.items.find(i=>i.id===s.itemId)!),srcIds=new Set(items.flatMap(i=>[...i.sourceIds,...(i.type==='tabs'?i.itemIds.flatMap(t=>p.items.find(x=>x.id===t)?.sourceIds??[]):[])]));
  const sources=p.sources.filter(s=>srcIds.has(s.id)),sourceLines=sources.map(s=>`${s.title}${s.page?` · p.${s.page}`:''}`),kinds=[...new Set(items.map(i=>i.provenance))];
  const footer=`${kinds.map(k=>`${k.toUpperCase()}: ${PROVENANCE_NOTE[k]}`).join(' · ')}. Displayed data and code; nothing here is a live query or proof of deployment.`;
  const notesBase=`Sources:\n${sources.map(s=>`- ${s.title}${s.page?` p.${s.page}`:''}: ${s.locator}${s.revision?` (${s.revision})`:''}`).join('\n')||'- none cited'}\n\n${footer}`;
  const bands=rowBands(placed),appendix:ExperienceItem[]=[];let added=0;
  const colW=(MAIN_W-11*GAP)/12;
  bands.forEach(([from,to],k)=>{
   added++;const s=frame(pptx,w,trail,sourceLines,bands.length>1?`   ·   PART ${k+1} OF ${bands.length}`:'',back),rows=to-from,rowH=Math.min(MAX_ROW_H,(BOARD_H-(rows-1)*GAP)/rows);
   const inBand=placed.filter(pl=>pl.y>=from&&pl.y+pl.h<=to);
   for(const pl of inBand){const i=p.items.find(x=>x.id===pl.itemId)!;
    const b={x:MAIN_X+pl.x*(colW+GAP),y:BOARD_Y+(pl.y-from)*(rowH+GAP),w:pl.w*colW+(pl.w-1)*GAP,h:pl.h*rowH+(pl.h-1)*GAP};
    body(pptx,s,p,i,panel(pptx,s,i,b),appendix);}
   s.addText(clip(footer,260),{x:MAIN_X,y:7.02,w:MAIN_W,h:.3,fontSize:7,color:MUTED,fontFace:FONT,margin:0,valign:'top'});
   s.addNotes(`${w.title}${bands.length>1?` (part ${k+1} of ${bands.length})`:''}\n\n${inBand.map(pl=>noteText(p,p.items.find(x=>x.id===pl.itemId)!)).join('\n\n')}\n\n${notesBase}`);
  });
  for(const [k,i] of appendix.entries()){
   added++;const s=frame(pptx,w,trail,sourceLines,`   ·   TAB ${k+2}`,back);
   body(pptx,s,p,i,panel(pptx,s,i,{x:MAIN_X,y:BOARD_Y,w:MAIN_W,h:BOARD_H}),[]);
   s.addText(clip(footer,260),{x:MAIN_X,y:7.02,w:MAIN_W,h:.3,fontSize:7,color:MUTED,fontFace:FONT,margin:0,valign:'top'});
   s.addNotes(`${noteText(p,i)}\n\n${notesBase}`);
  }
  counts.push(added);
 }
 return counts;
}

/** Public workspaces reachable from an entity, depth-first in navigation order, grouped by the scope's direct children. */
export type DeckGroup={entityId:string;label:string;summary:string;screens:{workspaceId:string;title:string;trail:string[]}[]};
export function workspaceGroups(p:ExperiencePack,scopeId:string=p.rootId):DeckGroup[]{
 const byId=new Map(p.entities.map(e=>[e.id,e])),spaces=new Map(p.workspaces.map(w=>[w.id,w])),seen=new Set<string>();
 const collect=(id:string,trail:string[],out:DeckGroup['screens'])=>{const e=byId.get(id);if(!e||seen.has(id))return;seen.add(id);const here=[...trail,e.label];
  for(const w of e.workspaceIds)if(spaces.has(w)&&!out.some(x=>x.workspaceId===w))out.push({workspaceId:w,title:spaces.get(w)!.title,trail:here});
  for(const c of e.children)collect(c,here,out);};
 const scope=byId.get(scopeId);if(!scope)return [];
 const groups:DeckGroup[]=[];
 const own:DeckGroup['screens']=[];for(const w of scope.workspaceIds)if(spaces.has(w))own.push({workspaceId:w,title:spaces.get(w)!.title,trail:[scope.label]});
 if(own.length)groups.push({entityId:scope.id,label:scope.label,summary:scope.summary,screens:own});
 seen.add(scope.id);
 for(const c of scope.children){const screens:DeckGroup['screens']=[];collect(c,[scope.label],screens);const e=byId.get(c);if(e&&screens.length)groups.push({entityId:c,label:e.label,summary:e.summary,screens});}
 // A screen reachable twice (shared across scopes) is shown once, in its first group.
 const shown=new Set<string>();for(const g of groups)g.screens=g.screens.filter(x=>!shown.has(x.workspaceId)&&shown.add(x.workspaceId));
 return groups.filter(g=>g.screens.length);
}

export async function exportWorkspacePptx(pack:ExperiencePack,workspaceId:string,trail:string[]):Promise<void>{
 const {default:PptxGenJS}=await import('pptxgenjs');
 await buildWorkspaceDeck(PptxGenJS,pack,[workspaceId],trail).writeFile({fileName:`${workspaceId}.pptx`});
}
