import type PptxGenJS from 'pptxgenjs';
import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {publicPack,type ExperienceItem,type ExperiencePack} from '../experience/model';
import {addWorkspaceSlides,workspaceGroups,type BackLink,type DeckGroup} from '../experience/pptx';
import {PROVENANCE_NOTE,clip} from '../experience/render';
import {addArchitectureSlides,type ScreenLink} from './pptx';
import {noIcons,type IconData} from './iconData';

/**
 * One deck for a whole project (or one scope): cover, linked contents, architecture views, one section per
 * scope group with its report screens, and a closing sources slide. Everything comes from publicDocument /
 * publicPack, so private or draft content cannot reach it. Slide numbers are tracked here because the
 * contents and section slides link to slides created after them.
 */
type Pptx=InstanceType<typeof PptxGenJS>;
type Slide=ReturnType<Pptx['addSlide']>;
export const MAX_DECK_SLIDES=180;
const NAVY='0F2748',INK='13294A',BODY='34465E',MUTED='5B6F88',ACCENT='3FB4E8',BG='EEF2F7',FONT='Segoe UI';

export type DeckSource={title:string;detail:string;page?:number;revision?:string};
export type DeckPlan={title:string;subtitle:string;author:string;architecture?:Project;pack?:ExperiencePack;groups:DeckGroup[];sources:DeckSource[]};
export type DeckSection={label:string;slide:number;detail:string};
/** Box → screen links (by workspace id) and the screen → architecture view link back. */
export type DeckLinks={screens:Map<string,ScreenLink>;back:Map<string,BackLink>};

/**
 * Screen slide numbers before any slide exists: architecture boxes link forward to screens. Counting runs
 * addWorkspaceSlides into a throwaway deck; buildDeck checks the real run lands on the same numbers.
 */
export function planLinks(PptxCtor:typeof PptxGenJS,plan:DeckPlan):DeckLinks{
 const views=plan.architecture?.views??[],screens=new Map<string,ScreenLink>(),back=new Map<string,BackLink>();
 if(!plan.pack)return {screens,back};
 let at=2+(views.length?1+views.length:0);
 for(const g of plan.groups){at++;const counts=addWorkspaceSlides(new PptxCtor(),plan.pack,g.screens.map(x=>x.workspaceId),()=>[]);g.screens.forEach((x,k)=>{screens.set(x.workspaceId,{slide:at+1,title:x.title});at+=counts[k];});}
 // The back link goes to the first view (in deck order) that has a box for the screen.
 views.forEach((v,k)=>{for(const n of plan.architecture!.nodes){const id=n.experienceWorkspaceId;if(id&&v.nodeIds.includes(n.id)&&screens.has(id)&&!back.has(id))back.set(id,{slide:4+k,label:`Architecture: ${v.title}`});}});
 return {screens,back};
}

/** Whole project: public architecture views plus every public screen reachable from its experience root. */
export function projectPlan(input:Project):DeckPlan{
 const d=publicDocument(input),pack=d.experience,groups=pack?compactGroups(workspaceGroups(pack),pack,pack.rootId):[];
 return {title:d.title,subtitle:d.summary,author:d.author,architecture:d.views.length?d:undefined,pack,groups,sources:collectSources(d,pack,groups)};
}
/** One scope of an experience pack (Evidence workspaces), report screens only. */
export function scopePlan(input:ExperiencePack,scopeId:string):DeckPlan{
 const pack=publicPack(input),scope=pack.entities.find(e=>e.id===scopeId);
 if(!scope)throw new Error('This scope is not approved for public export.');
 const groups=compactGroups(workspaceGroups(pack,scopeId),pack,scopeId);
 return {title:scope.label,subtitle:scope.summary||pack.title,author:'',pack,groups,sources:collectSources(undefined,pack,groups)};
}
/** Sections of one screen each are merged into one section named after the scope: dividers should group, not repeat. */
export function compactGroups(groups:DeckGroup[],pack:ExperiencePack,scopeId:string):DeckGroup[]{
 if(groups.length<2||groups.some(g=>g.screens.length>1))return groups;
 const scope=pack.entities.find(e=>e.id===scopeId);
 return [{entityId:scopeId,label:scope?.label??'Task & report screens',summary:scope?.summary??'',screens:groups.flatMap(g=>g.screens)}];
}
function collectSources(d:Project|undefined,pack:ExperiencePack|undefined,groups:DeckGroup[]):DeckSource[]{
 const out:DeckSource[]=(d?.sources??[]).map(s=>({title:s.title,detail:s.location+(s.url?` · ${s.url}`:'')}));
 if(pack){
  const shown=new Set(groups.flatMap(g=>g.screens.map(s=>s.workspaceId))),ids=new Set<string>();
  const cite=(i?:ExperienceItem)=>{if(!i)return;i.sourceIds.forEach(x=>ids.add(x));if(i.type==='tabs')i.itemIds.forEach(t=>cite(pack.items.find(x=>x.id===t)));};
  for(const w of pack.workspaces)if(shown.has(w.id))for(const pl of w.placements)cite(pack.items.find(i=>i.id===pl.itemId));
  for(const s of pack.sources)if(ids.has(s.id))out.push({title:s.title,detail:s.locator,page:s.page,revision:s.revision});
 }
 return out;
}

function cover(pptx:Pptx,plan:DeckPlan,views:number,screens:number){
 const s=pptx.addSlide();s.background={color:NAVY};
 s.addShape(pptx.ShapeType.rect,{x:.8,y:1.55,w:.08,h:2.5,fill:{color:ACCENT},line:{color:ACCENT}});
 s.addText('DIAGRAMCLOUD  ·  PROJECT DECK',{x:1.1,y:1.1,w:11,h:.3,fontSize:10,bold:true,color:ACCENT,charSpacing:3,fontFace:FONT,margin:0});
 s.addText(clip(plan.title,70),{x:1.1,y:1.55,w:11,h:1.1,fontSize:plan.title.length>40?32:40,bold:true,color:'FFFFFF',fontFace:FONT,margin:0,valign:'top'});
 s.addText(clip(plan.subtitle,260),{x:1.1,y:2.75,w:10.5,h:1.2,fontSize:15,color:'C9D7EA',fontFace:FONT,margin:0,valign:'top'});
 const stats=[views?`${views} architecture view${views===1?'':'s'}`:'',screens?`${screens} task & report screen${screens===1?'':'s'}`:'',plan.author?`By ${plan.author}`:''].filter(Boolean).join('   ·   ');
 s.addText(stats,{x:1.1,y:4.5,w:11,h:.35,fontSize:13,bold:true,color:'FFFFFF',fontFace:FONT,margin:0});
 s.addText('Public export. Source, synthetic and reconstruction labels are kept on every slide. Displayed data and code are examples, not live queries, measured results or proof of deployment.',{x:1.1,y:6.3,w:11,h:.5,fontSize:10,color:'9FB3CE',fontFace:FONT,margin:0,valign:'top'});
 s.addNotes(`${plan.title}\n\n${plan.subtitle}`);
}
function sectionFrame(pptx:Pptx,number:string,label:string,summary:string){
 const s=pptx.addSlide();s.background={color:BG};
 s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:4.6,h:7.5,fill:{color:NAVY},line:{color:NAVY}});
 s.addText(number,{x:.6,y:1.3,w:3.6,h:1,fontSize:54,bold:true,color:ACCENT,fontFace:FONT,margin:0});
 s.addText(clip(label,60),{x:.6,y:2.45,w:3.6,h:1.3,fontSize:26,bold:true,color:'FFFFFF',fontFace:FONT,margin:0,valign:'top'});
 if(summary)s.addText(clip(summary,260),{x:.6,y:3.85,w:3.6,h:2.2,fontSize:11,color:'C9D7EA',fontFace:FONT,margin:0,valign:'top'});
 return s;
}
/** A linked list of (label, slide) rows on the right of a section slide or on the contents slide. */
function linkedRows(pptx:Pptx,s:Slide,rows:{label:string;detail?:string;slide:number}[],x:number,y:number,w:number){
 const h=Math.min(.62,5.6/Math.max(1,rows.length));
 rows.forEach((r,k)=>{const top=y+k*h;
  s.addText([{text:clip(r.label,80),options:{bold:true,color:INK,hyperlink:{slide:r.slide,tooltip:`Go to slide ${r.slide}`},breakLine:!!r.detail}},...(r.detail?[{text:clip(r.detail,110),options:{fontSize:9,color:MUTED}}]:[])],{x,y:top,w:w-.9,h:h-.06,fontSize:13,fontFace:FONT,margin:0,valign:'middle'});
  s.addText(String(r.slide),{x:x+w-.8,y:top,w:.8,h:h-.06,fontSize:12,color:MUTED,align:'right',valign:'middle',fontFace:FONT,margin:0});
  s.addShape(pptx.ShapeType.line,{x,y:top+h-.03,w,h:0,line:{color:'D5DEE9',width:.5}});});
}
function sourcesSlides(pptx:Pptx,plan:DeckPlan,number:string){
 const per=12,pages=Math.max(1,Math.ceil(plan.sources.length/per));
 for(let k=0;k<pages;k++){
  const s=pptx.addSlide();s.background={color:BG};
  s.addText(`${number}  SOURCES AND PROVENANCE${pages>1?`  ·  ${k+1} OF ${pages}`:''}`,{x:.6,y:.35,w:12,h:.3,fontSize:10,bold:true,color:MUTED,charSpacing:2,fontFace:FONT,margin:0});
  s.addText('Where every screen comes from',{x:.6,y:.7,w:12,h:.6,fontSize:26,bold:true,color:INK,fontFace:FONT,margin:0});
  const rows=plan.sources.slice(k*per,(k+1)*per);
  if(rows.length)s.addTable([[{text:'Source',options:{bold:true}},{text:'Page / revision',options:{bold:true}},{text:'Used as',options:{bold:true}}],...rows.map(r=>[{text:clip(r.title,70)},{text:[r.page?`p.${r.page}`:'',r.revision?clip(r.revision,40):''].filter(Boolean).join(' · ')||'—'},{text:clip(r.detail,140)}])],
   {x:.6,y:1.5,w:12.1,colW:[3.6,1.9,6.6],fontSize:9,fontFace:FONT,color:BODY,rowH:.3,margin:[2,5,2,5],border:{type:'solid',color:'E1E7EF',pt:.5},fill:{color:'FFFFFF'},autoPage:false,valign:'middle'});
  else s.addText('No external source is cited by the exported content.',{x:.6,y:1.6,w:12,h:.4,fontSize:12,color:MUTED,fontFace:FONT,margin:0});
  s.addText(Object.entries(PROVENANCE_NOTE).map(([k2,v])=>`${k2.toUpperCase()}: ${v}.`).join('   '),{x:.6,y:6.75,w:12.1,h:.4,fontSize:8.5,color:MUTED,fontFace:FONT,margin:0,valign:'top'});
 }
 return pages;
}

/** Builds the deck and returns it with the section map (also used by tests). */
export async function buildDeck(PptxCtor:typeof PptxGenJS,plan:DeckPlan,icons:IconData=noIcons):Promise<{pptx:Pptx;sections:DeckSection[];slides:number;links:DeckLinks}>{
 const pptx=new PptxCtor();
 pptx.layout='LAYOUT_WIDE';pptx.title=plan.title;pptx.subject=plan.subtitle;pptx.author=plan.author||'DiagramCloud';pptx.company='DiagramCloud';
 const views=plan.architecture?.views.length??0,screens=plan.groups.reduce((n,g)=>n+g.screens.length,0);
 if(!views&&!screens)throw new Error('Nothing public to export yet: no architecture view or approved public screen.');
 const links=planLinks(PptxCtor,plan);
 cover(pptx,plan,views,screens);
 const contents=pptx.addSlide();contents.background={color:BG};
 let slide=2,num=0;const sections:DeckSection[]=[],pad=(n:number)=>String(n).padStart(2,'0');
 if(plan.architecture&&views){
  num++;const divider=sectionFrame(pptx,pad(num),'Architecture',`${views} connected view${views===1?'':'s'}, from the overview down to tasks. A box with a deeper view links to it.`);slide++;
  sections.push({label:'Architecture',slide,detail:`${views} view${views===1?'':'s'}`});
  const first=slide+1;await addArchitectureSlides(pptx,plan.architecture,{cover:false,evidence:false,sources:false,firstViewSlide:first,screens:links.screens,icons});slide+=views;
  linkedRows(pptx,divider,plan.architecture.views.slice(0,9).map((v,k)=>({label:v.title,detail:v.description,slide:first+k})),5.2,1.1,7.5);
  if(views>9)divider.addText(`… and ${views-9} more views`,{x:5.2,y:6.8,w:7,h:.3,fontSize:10,color:MUTED,fontFace:FONT,margin:0});
 }
 if(plan.pack)for(const g of plan.groups){
  num++;const divider=sectionFrame(pptx,pad(num),g.label,g.summary);slide++;
  sections.push({label:g.label,slide,detail:`${g.screens.length} screen${g.screens.length===1?'':'s'}`});
  const counts=addWorkspaceSlides(pptx,plan.pack,g.screens.map(x=>x.workspaceId),id=>g.screens.find(x=>x.workspaceId===id)!.trail,id=>links.back.get(id));
  let at=slide+1;const rows=g.screens.map((x,k)=>{if(links.screens.get(x.workspaceId)?.slide!==at)throw new Error(`Slide numbers drifted for screen ${x.workspaceId}`);const r={label:x.title,detail:x.trail.slice(1).join(' › '),slide:at};at+=counts[k];return r;});
  slide=at-1;linkedRows(pptx,divider,rows,5.2,1.1,7.5);
 }
 num++;sections.push({label:'Sources and provenance',slide:slide+1,detail:`${plan.sources.length} source${plan.sources.length===1?'':'s'}`});
 slide+=sourcesSlides(pptx,plan,pad(num));
 contents.addText('CONTENTS',{x:.6,y:.45,w:12,h:.3,fontSize:10,bold:true,color:MUTED,charSpacing:2,fontFace:FONT,margin:0});
 contents.addText(clip(plan.title,80),{x:.6,y:.8,w:12,h:.6,fontSize:26,bold:true,color:INK,fontFace:FONT,margin:0});
 linkedRows(pptx,contents,sections.map((x,k)=>({label:`${pad(k+1)}   ${x.label}`,detail:x.detail,slide:x.slide})),.6,1.7,12.1);
 contents.addNotes(sections.map(x=>`${x.label}: slide ${x.slide}`).join('\n'));
 if(slide>MAX_DECK_SLIDES)throw new Error(`This deck would have ${slide} slides (limit ${MAX_DECK_SLIDES}). Export one scope from Evidence workspaces instead.`);
 return {pptx,sections,slides:slide,links};
}

export async function downloadDeck(plan:DeckPlan,fileName:string,icons:IconData=noIcons):Promise<number>{
 const {default:PptxGenJS}=await import('pptxgenjs');
 const {pptx,slides}=await buildDeck(PptxGenJS,plan,icons);await pptx.writeFile({fileName});return slides;
}
