import type {Project} from '../../core/model';
import {citedObservations,optionSlotState,OPTION_SLOT_LABELS,type OptionSlotState} from '../../core/decisionReview';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {clipMono,f,footerLine,header,legendStrip,lines,MONO,sansLines,svgDocument,txt,type Tokens} from './kit';
import {xml} from '../diagram';
import {figureAvailability,slotChoices,withheldSvg} from './availability';

const M=48,W=880,G=12,PAD=10,COLS=4,ROW_GAP=28,MAX_ROWS=12;
const style=(s:OptionSlotState,t:Tokens)=>s==='adopted'?{fill:t.accentTint,stroke:t.accent,tag:t.accent,dash:''}:s==='rejected'?{fill:t.paper2,stroke:t.rule,tag:t.soft,dash:''}:s==='under-test'?{fill:t.paper,stroke:t.muted,tag:t.muted,dash:' stroke-dasharray="4,3"'}:{fill:t.paper,stroke:t.rule,tag:t.soft,dash:' stroke-dasharray="2,3"'};
const day=(s:string)=>s.slice(0,10);

/**
 * Slot decisions: one row per public choice owned by the view or one of its public components (a "slot"), then one cell
 * per candidate: Adopted (only the chosen option of an accepted decision, with its date), Rejected (muted, with the reason),
 * Under test (its test plan: Planned/designed, never a result) or Candidate. Under each row, the cited experiment
 * observations that are Presented (reviewed, public) read "Observed <date> · <summary>", and the decision line names who
 * recorded it. A recommendation is never drawn as adopted. It is a presentation, not a verification; without any public
 * choice the figure is withheld (availability.ts).
 */
export function decisionsSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'decisions',options),{spec,t}=c,a=figureAvailability(c,'decisions');
 if(!a.available)return withheldSvg(c,a,{label:'Slot decisions'});
 const all=slotChoices(c),rows=all.slice(0,MAX_ROWS),omitted=all.length-rows.length;
 const hdr=header(eyebrowOf(c,'Slot decisions'),spec.title,`${rows.length} slot${rows.length===1?'':'s'} on ${spec.title}: candidates, what was adopted or rejected, and what is still under test.`,M,M,W,t,c.editorial),out:string[]=[];
 const caption='Adopted means a person recorded the decision; Under test is a test plan (Planned/designed), not a result. Only reviewed public observations are drawn as observed. A presentation, not a verification.';
 const capLines=sansLines(caption,W,11,3),capY=M+hdr.height+20;out.push(lines(capLines,M,capY,15,{size:11,fill:t.muted,italic:true,extra:' data-dd-caption="slot-decisions"'}));
 let y=capY+(capLines.length-1)*15+34;
 for(const {choice:ch,owner} of rows){
  out.push(`<g data-dd-slot="${xml(ch.id)}" data-dd-owner="${xml(owner.id)}" data-dd-slot-status="${ch.status}">`);
  const titleLs=sansLines(ch.title,W,13,2,true);out.push(lines(titleLs,M,y,17,{size:13,fill:t.ink,weight:600}));y+=(titleLs.length-1)*17+15;
  out.push(txt(clipMono(`${owner.kind==='view'?'VIEW':'COMPONENT'} · ${owner.label}`.toUpperCase(),W,8,0.1),M,y,{size:8,fill:t.soft,font:MONO,tracking:0.1}));y+=12;
  const cols=Math.min(COLS,ch.options.length),cw=Math.floor((W-(cols-1)*G)/cols),inner=cw-2*PAD;
  for(let start=0;start<ch.options.length;start+=cols){
   const cells=ch.options.slice(start,start+cols).map(o=>{const s=optionSlotState(ch,o);
    const tag=s==='adopted'?`ADOPTED${ch.decidedAt?` · ${day(ch.decidedAt)}`:''}`:s==='rejected'?`REJECTED · ${day(o.rejection!.decidedAt)}`:OPTION_SLOT_LABELS[s].toUpperCase();
    const detail=s==='rejected'?`Reason: ${o.rejection!.reason}${o.rejection!.decidedBy?` (${o.rejection!.decidedBy})`:''}`:s==='under-test'?`Test plan: ${o.testPlan}`:s==='candidate'&&ch.status==='candidate'&&o.id===ch.recommendedOptionId?`Recommended, not decided.${o.summary?` ${o.summary}`:''}`:o.summary||(s==='candidate'?'Candidate · not decided.':'');
    return {o,s,tag:clipMono(tag,inner,8,0.1),label:sansLines(o.label,inner,12,2,true),detail:detail?sansLines(detail,inner,10,5):[]};});
   const h=Math.max(...cells.map(x=>PAD+10+8+x.label.length*15+(x.detail.length?4+x.detail.length*13:0)+PAD));
   cells.forEach((x,i)=>{const cx=M+i*(cw+G),st=style(x.s,t);
    out.push(`<g data-dd-option="${xml(x.o.id)}" data-dd-option-state="${x.s}"><rect x="${f(cx)}" y="${f(y)}" width="${f(cw)}" height="${f(h)}" rx="6" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1"${st.dash}/>`,
     txt(x.tag,cx+PAD,y+PAD+8,{size:8,fill:st.tag,font:MONO,tracking:0.1}),
     lines(x.label,cx+PAD,y+PAD+8+18,15,{size:12,fill:x.s==='rejected'?t.muted:t.ink,weight:600}),
     x.detail.length?lines(x.detail,cx+PAD,y+PAD+8+18+(x.label.length-1)*15+17,13,{size:10,fill:t.muted,italic:x.s==='under-test'}):'','</g>');});
   y+=h+G;}
  const observed=citedObservations(c.doc,ch).filter(x=>x.state==='reviewed');
  for(const x of observed){const ls=sansLines(`Observed ${day(x.observation!.observedAt)} · ${x.observation!.summary}`,W,10,3);out.push(`<g data-dd-observation="${xml(x.id)}">${lines(ls,M,y+6,14,{size:10,fill:t.ink})}</g>`);y+=ls.length*14;}
  const decided=ch.status==='accepted'?`Decision recorded by ${ch.decidedBy}${ch.decidedAt?` on ${day(ch.decidedAt)}`:''}; a presentation, not a verification.`:'No decision recorded: every option is still a candidate. A presentation, not a verification.';
  const dl=sansLines(decided,W,10,2);out.push(`<g data-dd-decision="${ch.status}">${lines(dl,M,y+8,14,{size:10,fill:t.muted,italic:true})}</g>`);y+=8+(dl.length-1)*14;
  out.push('</g>');y+=ROW_GAP;}
 if(omitted){out.push(txt(`${omitted} further slot(s) not drawn (${MAX_ROWS}-row readability limit).`,M,y,{size:10,fill:t.muted,italic:true}));y+=18;}
 const legend=legendStrip([{kind:'swatch',fill:t.accent,label:'Adopted · recorded decision'},{kind:'swatch',fill:t.paper2,label:'Rejected'},{kind:'line',stroke:'muted',dashed:true,label:'Under test · planned'},{kind:'swatch',fill:t.paper,label:'Candidate'}],M,y,W,t);
 out.push(legend.svg);y+=legend.height+12;
 const cards=c.editorial?summaryCards(c,M,y+8,W):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:W+2*M,height:y+M,title:`${spec.title} · slot decisions`,
  desc:`Slot decisions on the public view ${spec.viewId}: ${rows.length} slot(s) with their candidates (adopted, rejected, under test, candidate). Adopted is a person's recorded decision; a test plan is not a result; a presentation, not a verification.${spec.omissions.length?` ${spec.omissions.join(' ')}`:''}`,
  t,theme:c.theme,type:'decisions',viewId:spec.viewId,defs:'',body:hdr.svg+out.join('')+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,W,t)});
}
