import {explanationGaps} from '../../intelligence/learning/gaps';
import {designContext,eyebrowOf,footerParts,type DesignContext,type DesignOptions} from './context';
import {footerLine,header,lines,MONO,sansLines,svgDocument,txt} from './kit';
import {xml} from '../diagram';
import type {Project} from '../../core/model';

/** Figures whose meaning depends on semantics a view may not supply: they are withheld, never drawn from guesses. */
export type MeasuredFigure='sankey'|'timeline'|'sequence';
export type FigureAvailability={type:MeasuredFigure;available:boolean;figure:string;missing:{input:string;reason:string;needs:string}[];fallback:string;schedule:{state:'partial'|'missing';reason:string;needs:string}};
export const FALLBACK_FIGURE='Architecture (relationship diagram)';
const FIGURE:Record<MeasuredFigure,string>={sankey:'Sankey flow figure',timeline:'Story timeline',sequence:'Sequence'};

/**
 * Whether one public view supplies what a measured figure needs, reusing the "what is missing to explain this?" gaps
 * (src/intelligence/learning/gaps.ts, public mode). Sankey needs at least one connection quantity with a unit between two
 * components of the view; the story timeline needs public story steps; a sequence needs at least one connection to order.
 * A scheduled timeline (Gantt) is never available: the model has no dates, durations or declared estimates per step, so
 * `schedule` always names it as withheld. Nothing is inferred: a story order is not timing, a name is not a quantity.
 */
export function figureAvailability(c:DesignContext,type:MeasuredFigure):FigureAvailability{
 const {doc,spec}=c,ids=new Set(spec.nodes.map(n=>n.id)),edges=spec.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 const gaps=explanationGaps(c.input,spec.viewId,{publicMode:true})?.gaps??[],gap=(k:string)=>gaps.find(g=>g.key===k);
 const timing=gap('timing'),schedule={state:timing?.state==='partial'?'partial' as const:'missing' as const,reason:timing?.reason??'No dates, durations or declared estimates for this view.',needs:timing?.needs??'Supplied dates or durations per step, or estimates labelled as estimates.'};
 const missing:FigureAvailability['missing']=[];
 if(type==='sankey'&&!edges.some(e=>e.quantity&&e.from!==e.to)){const q=gap('quantities');missing.push({input:'Connection quantities with units',reason:`This view has no connection quantities between two of its components${q?`: ${q.reason.replace(/\.$/,'').replace(/^No/,'no')}`:''}.`,needs:`${q?.needs??'A quantity with a unit and provenance on each connection.'} In the JSON, a connection's "quantity" field: {"value": 1200, "unit": "rows/day", "provenance": "author"}.`});}
 if(type==='timeline'&&!doc.story.some(s=>doc.views.some(v=>v.id===s.viewId)))missing.push({input:'Public story steps',reason:'This project has no public story yet: no story step on a public view.',needs:'Story steps written in the story composer, on public views. Their order is a presentation sequence, not timing.'});
 if(type==='sequence'&&!edges.length)missing.push({input:'Connections between components',reason:'No connection between two components of this view: there is no message to order.',needs:'At least one connection between components of this view; message order is then derived from the connections, not timing.'});
 return {type,available:!missing.length,figure:FIGURE[type],missing,fallback:FALLBACK_FIGURE,schedule};
}
export const availabilityOf=(input:Project,viewId:string,type:MeasuredFigure)=>figureAvailability(designContext(input,viewId,type),type);

const M=48,W=720;
/** The schedule gap as a note for a figure that draws an order but no time: it names the withheld Gantt and what it needs. */
export function scheduleNote(a:FigureAvailability,x:number,y:number,width:number,c:DesignContext):{svg:string;height:number}{
 const ls=sansLines(`Scheduled timeline (Gantt) withheld: ${a.schedule.reason} Needs: ${a.schedule.needs}`,width,10,4);
 return {svg:`<g data-dd-withheld="schedule">${lines(ls,x,y,14,{size:10,fill:c.t.muted,italic:true})}</g>`,height:ls.length*14};
}

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
  const why=sansLines(m.reason,W-32,10,3),needs=sansLines(`Needs: ${m.needs}`,W-32,10,4);
  out.push(lines(why,M+16,y+17,14,{size:10,fill:t.muted}),lines(needs,M+16,y+17+why.length*14+2,14,{size:10,fill:t.muted,italic:true}),'</g>');y+=17+(why.length+needs.length)*14;}
 if(a.type==='timeline'){const n=scheduleNote(a,M+16,y+18,W-32,c);out.push(n.svg);y+=8+n.height;}
 if(a.type==='sequence'){out.push(txt('Message order would be derived from the connections, not timing.',M+16,y+18,{size:10,fill:t.muted,italic:true}));y+=22;}
 const fb=sansLines(`Fallback: the ${a.fallback} shows the same public components and connections without inventing ${a.type==='sankey'?'amounts':a.type==='timeline'?'steps or dates':'messages'}.`,W-32,10,3);
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
