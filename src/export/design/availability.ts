import {explanationGaps} from '../../intelligence/learning/gaps';
import {designContext,eyebrowOf,footerParts,type DesignContext,type DesignOptions} from './context';
import {footerLine,header,lines,MONO,sansLines,svgDocument,txt} from './kit';
import {comparisonOf,sankeyBands,scheduleOf} from './measures';
import {xml} from '../diagram';
import type {Project} from '../../core/model';

/** Figures whose meaning depends on semantics a view may not supply: they are withheld, never drawn from guesses. */
export type MeasuredFigure='sankey'|'timeline'|'sequence'|'gantt'|'comparison';
export const MEASURED_FIGURES:MeasuredFigure[]=['sankey','timeline','sequence','gantt','comparison'];
export const isMeasuredFigure=(type:string):type is MeasuredFigure=>(MEASURED_FIGURES as string[]).includes(type);
export type FigureAvailability={type:MeasuredFigure;available:boolean;figure:string;missing:{input:string;reason:string;needs:string}[];fallback:string;schedule:{state:'supplied'|'partial'|'missing';reason:string;needs:string}};
export const FALLBACK_FIGURE='Architecture (relationship diagram)';
const FIGURE:Record<MeasuredFigure,string>={sankey:'Sankey flow figure',timeline:'Story timeline',sequence:'Sequence',gantt:'Scheduled timeline (Gantt)',comparison:'Baseline and current comparison'};
const SCHEDULE_NEEDS='A schedule evidence block on a component of this view: items with a start and an end or an ISO 8601 duration, each supplied or declared as an estimate. In the JSON: {"type": "schedule", "timezone": "date-only", "items": [{"id": "build", "label": "Build", "nodeIds": ["etl"], "start": "2026-10-01", "end": "2026-10-05", "basis": "supplied"}]}.';
const MEASURE_NEEDS='A metrics item with a "measure" for the baseline and one for the current reading: same metric, unit and scope, windows of the same length. In the JSON: "measure": {"metric": "p95 latency", "value": 420, "unit": "ms", "scope": "checkout API", "window": {"from": "2026-09-01", "to": "2026-09-07"}, "basis": "measured", "role": "baseline"}.';

/**
 * Whether one public view supplies what a measured figure needs, reusing the "what is missing to explain this?" gaps
 * (src/intelligence/learning/gaps.ts, public mode) and the evidence readers of measures.ts. Sankey needs a connection
 * quantity between two components that is not an ambiguous measurement; the story timeline needs public story steps; a
 * sequence needs a connection to order; the Gantt needs supplied or estimated schedule items that do not conflict; the
 * comparison needs one baseline and one current reading of the same metric, unit, scope and window length. Nothing is
 * inferred: a story order is not timing, a name is not a quantity, a difference is not a cause.
 */
export function figureAvailability(c:DesignContext,type:MeasuredFigure):FigureAvailability{
 const {doc,spec}=c,ids=new Set(spec.nodes.map(n=>n.id)),edges=spec.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 const gaps=explanationGaps(c.input,spec.viewId,{publicMode:true})?.gaps??[],gap=(k:string)=>gaps.find(g=>g.key===k);
 const sched=scheduleOf(c),timing=gap('timing'),scheduled=sched.rows.length>0&&!sched.conflicts.length;
 const schedule={state:scheduled?'supplied' as const:timing?.state==='partial'?'partial' as const:'missing' as const,
  reason:scheduled?`${sched.rows.length} schedule item${sched.rows.length===1?'':'s'} on this view${sched.estimates?`, ${sched.estimates===1?'1 declared as an estimate':`${sched.estimates} declared as estimates`}`:''}.`:sched.conflicts.length?`The schedule items of this view conflict: ${sched.conflicts[0]}`:timing?.reason??'No dates, durations or declared estimates for this view.',
  needs:timing?.needs??'Supplied dates or durations per step, or estimates labelled as estimates.'};
 const missing:FigureAvailability['missing']=[];
 if(type==='sankey'){const s=sankeyBands(spec);if(!s.bands.length){const q=gap('quantities');
  if(!edges.some(e=>e.quantity))missing.push({input:'Connection quantities with units',reason:`This view has no connection quantities between two of its components${q?`: ${q.reason.replace(/\.$/,'').replace(/^No/,'no')}`:''}.`,needs:`${q?.needs??'A quantity with a unit and provenance on each connection.'} In the JSON, a connection's "quantity" field: {"value": 1200, "unit": "rows/day", "provenance": "author"}.`});
  else missing.push({input:'Connection quantities with units',reason:`No drawable quantity between two different components: ${[s.selfLoops.length?`${s.selfLoops.length} from a component to itself`:'',...s.ambiguous.map(a=>`measurement ${a.measurementId} is on ${a.edges.length} connections of one scope (ambiguous, never counted twice)`)].filter(Boolean).join('; ')}.`,needs:'A quantity with a unit and provenance on a connection between two components, with one measurement ID per connection.'});}}
 if(type==='timeline'&&!doc.story.some(s=>doc.views.some(v=>v.id===s.viewId)))missing.push({input:'Public story steps',reason:'This project has no public story yet: no story step on a public view.',needs:'Story steps written in the story composer, on public views. Their order is a presentation sequence, not timing.'});
 if(type==='sequence'&&!edges.length)missing.push({input:'Connections between components',reason:'No connection between two components of this view: there is no message to order.',needs:'At least one connection between components of this view; message order is then derived from the connections, not timing.'});
 if(type==='gantt'){
  if(!sched.rows.length&&!sched.conflicts.length)missing.push({input:'Schedule items with dates',reason:`${timing?.reason??'No dates, durations or declared estimates for this view.'}${doc.story.length?' A story order is presentation order, not elapsed time.':''}`,needs:SCHEDULE_NEEDS});
  if(sched.conflicts.length)missing.push({input:'Consistent schedule items',reason:sched.conflicts.slice(0,3).join(' ')+(sched.conflicts.length>3?` (${sched.conflicts.length-3} more.)`:''),needs:'One start and end per item ID across the schedule blocks of this view, and one time basis (date-only or timed). Correct the evidence; nothing is merged or averaged.'});}
 if(type==='comparison'){const k=comparisonOf(c);
  if(!k.readings)missing.push({input:'Baseline and current measures',reason:'No metrics item on a public component of this view carries a measure (metric, value, unit, scope, window, basis, role). A graph shape or node count is never a measurement.',needs:MEASURE_NEEDS});
  else if(!k.rows.length)missing.push({input:'Comparable baseline and current',reason:k.unavailable.slice(0,3).map(u=>`${u.metric}: ${u.reason}.`).join(' ')+(k.unavailable.length>3?` (${k.unavailable.length-3} more.)`:''),needs:'For each metric: one baseline and one current reading with the same unit and scope and windows of the same length.'});}
 return {type,available:!missing.length,figure:FIGURE[type],missing,fallback:FALLBACK_FIGURE,schedule};
}
export const availabilityOf=(input:Project,viewId:string,type:MeasuredFigure)=>figureAvailability(designContext(input,viewId,type),type);
/** One plain-text sentence per missing input, as shown in the Studio note: the same words as the withheld figure. */
export const availabilityText=(a:FigureAvailability)=>a.missing.map(m=>`${m.input}: ${m.reason} Needs: ${m.needs}`);

const M=48,W=720;
/** The schedule state as a note for a figure that draws an order but no time: the Gantt is either its own figure or withheld. */
export function scheduleNote(a:FigureAvailability,x:number,y:number,width:number,c:DesignContext):{svg:string;height:number}{
 const ls=sansLines(a.schedule.state==='supplied'?`Scheduled timeline (Gantt) available as its own figure: ${a.schedule.reason} This order is not elapsed time.`:`Scheduled timeline (Gantt) withheld: ${a.schedule.reason} Needs: ${a.schedule.needs}`,width,10,4);
 return {svg:`<g ${a.schedule.state==='supplied'?'data-dd-schedule="supplied"':'data-dd-withheld="schedule"'}>${lines(ls,x,y,14,{size:10,fill:c.t.muted,italic:true})}</g>`,height:ls.length*14};
}
const INVENTED:Record<MeasuredFigure,string>={sankey:'amounts',timeline:'steps or dates',sequence:'messages',gantt:'dates or durations',comparison:'baselines, differences or percentages'};

/**
 * "What is missing to draw this": the figure is held back instead of drawn, naming each missing input, why it is missing,
 * what would supply it and the fallback figure. Static, public, no invented amounts, dates or messages.
 */
export function withheldSvg(c:DesignContext,a:FigureAvailability,options:{label:string;title?:string}):string{
 const {spec,t}=c,title=options.title??spec.title,hdr=header(eyebrowOf(c,`${options.label} · withheld`),title,`What is missing to draw this ${a.figure.toLowerCase()}.`,M,M,W,t,c.editorial),out:string[]=[];
 let y=M+hdr.height+28;const top=y;y+=22;
 out.push(txt('WITHHELD · NOT DRAWN',M+16,y,{size:8,fill:t.accent,font:MONO,tracking:0.12}));y+=10;
 for(const m of a.missing){
  y+=16;out.push(`<g data-dd-missing="${xml(m.input)}">`+txt(m.input,M+16,y,{size:12,fill:t.ink,weight:600}));
  const why=sansLines(m.reason,W-32,10,8),needs=sansLines(`Needs: ${m.needs}`,W-32,10,8);
  out.push(lines(why,M+16,y+17,14,{size:10,fill:t.muted}),lines(needs,M+16,y+17+why.length*14+2,14,{size:10,fill:t.muted,italic:true}),'</g>');y+=17+(why.length+needs.length)*14;}
 if(a.type==='timeline'){const n=scheduleNote(a,M+16,y+18,W-32,c);out.push(n.svg);y+=8+n.height;}
 if(a.type==='sequence'){out.push(txt('Message order would be derived from the connections, not timing.',M+16,y+18,{size:10,fill:t.muted,italic:true}));y+=22;}
 if(a.type==='gantt'){out.push(txt('A story or step order is presentation order, never elapsed time.',M+16,y+18,{size:10,fill:t.muted,italic:true}));y+=22;}
 if(a.type==='comparison'){out.push(txt('No money, time saving or performance is inferred from the diagram.',M+16,y+18,{size:10,fill:t.muted,italic:true}));y+=22;}
 const fb=sansLines(`Fallback: the ${a.fallback} shows the same public components and connections without inventing ${INVENTED[a.type]}.`,W-32,10,3);
 out.push(`<g data-dd-fallback="architecture">${lines(fb,M+16,y+22,14,{size:10,fill:t.ink})}</g>`);y+=22+(fb.length-1)*14+18;
 const box=`<g data-dd-empty="" data-dd-withheld="${a.type}"><rect x="${M}" y="${top}" width="${W}" height="${y-top}" rx="6" fill="${t.paper2}" stroke="${t.rule}"/></g>`;
 const end=y+12;
 return svgDocument({slug:c.slug,width:W+2*M,height:end+24+M,title:`${title} · ${a.type} withheld`,desc:`${a.figure} withheld on the public view ${spec.viewId}: missing ${a.missing.map(m=>m.input.toLowerCase()).join(', ')}. Fallback: ${a.fallback}.`,
  t,theme:c.theme,type:a.type,viewId:spec.viewId,defs:'',body:hdr.svg+box+out.join('')+footerLine(footerParts(c),M,end+24,W,t)});
}
/** Renders the withheld state when the view lacks the figure's semantics, else undefined (the caller draws the figure). */
export function withheldOrUndefined(input:Project,viewId:string,type:MeasuredFigure,options:DesignOptions,label:string):string|undefined{
 const c=designContext(input,viewId,type,options),a=figureAvailability(c,type);
 return a.available?undefined:withheldSvg(c,a,{label,title:type==='timeline'?c.doc.title:undefined});
}
