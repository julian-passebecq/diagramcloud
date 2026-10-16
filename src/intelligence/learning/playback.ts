import type {Project} from '../../core/model';
import {viewSpec} from '../../core/viewspec';
import type {LearningEntry} from './catalogue';
/**
 * Step playback (R4-AC-15): previous / next walks the DECLARED steps of a lesson example or of a procedure view, in their
 * declared order, and highlights one at a time. It is teaching: a presented sequence, not a run and not timing. It reads
 * only; it never creates an observation, attempt or run record, and never executes a step.
 */
export const PLAYBACK_LABEL='Presented sequence - not a run, not timing';
export type PlaybackStep={id:string;label:string;nodeId?:string};
export type PlaybackSource={id:string;title:string;origin:string;steps:PlaybackStep[]};
/** The lesson example's authored steps, in their authored order. */
export function lessonPlayback(entry:Pick<LearningEntry,'id'|'lesson'>):PlaybackSource|null{
 const steps=entry.lesson.example?.steps??[];
 return steps.length?{id:'lesson-'+entry.id,title:'Lesson example steps',origin:'Authored synthetic lesson example; the order is the authored list.',steps:steps.map((label,i)=>({id:`${entry.id}-step-${i+1}`,label}))}:null;
}
/** A declared procedure: a view whose control connections form one unbranched chain through every component of the view.
 * The order is that chain; anything else (branching, cycle, a component left out, a non-control link) returns null rather than an invented order. */
export function procedurePlayback(doc:Project,viewId:string,options:{audience?:'public'|'author'}={}):PlaybackSource|null{
 const spec=viewSpec(doc,viewId,{audience:options.audience??'public',now:new Date(0)}),ids=spec.nodes.map(n=>n.id);
 if(ids.length<2||spec.edges.length!==ids.length-1||spec.edges.some(e=>e.kind!=='control'))return null;
 const out=new Map<string,string>(),indeg=new Map(ids.map(id=>[id,0]));
 for(const e of spec.edges){if(out.has(e.from)||e.from===e.to)return null;out.set(e.from,e.to);indeg.set(e.to,(indeg.get(e.to)??0)+1);}
 const starts=ids.filter(id=>indeg.get(id)===0);if(starts.length!==1||[...indeg.values()].some(n=>n>1))return null;
 const order:string[]=[];for(let cur:string|undefined=starts[0];cur&&!order.includes(cur);cur=out.get(cur))order.push(cur);
 if(order.length!==ids.length)return null;
 const label=new Map(spec.nodes.map(n=>[n.id,n.label]));
 return {id:'procedure-'+viewId,title:'Declared procedure: '+spec.title,origin:'Declared by the view\'s control connections; the order is that chain.',steps:order.map(id=>({id,label:label.get(id)!,nodeId:id}))};
}
export type PlaybackFrame={index:number;step:PlaybackStep;position:string;atStart:boolean;atEnd:boolean;label:typeof PLAYBACK_LABEL};
/** Clamped, never wrapped: the first and last steps stay where the declaration put them. */
export function playbackFrame(source:PlaybackSource,index:number):PlaybackFrame{
 const i=Math.max(0,Math.min(source.steps.length-1,Math.trunc(index)||0));
 return {index:i,step:source.steps[i],position:`Step ${i+1} of ${source.steps.length}`,atStart:i===0,atEnd:i===source.steps.length-1,label:PLAYBACK_LABEL};
}
