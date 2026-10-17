/**
 * Minimal timing contract for evidence (schedule items, measurement windows): supplied calendar dates or ISO 8601
 * instants, never inferred. A date-only value is a whole UTC calendar day and an end date is inclusive (the last day);
 * an instant carries its offset and an end instant is exclusive. Pure functions: no clock, no time zone database.
 */
export const DATE_ONLY=/^(\d{4})-(\d{2})-(\d{2})$/;
export const INSTANT=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export const DURATION=/^P(?!$)(?:(\d+)W)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?)?$/;
export const DATE_OR_INSTANT=/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;
export const DAY=86400000;

/** UTC milliseconds of a real calendar date (2026-02-30 is refused), else undefined. */
export function dateValue(s:string):number|undefined{
 const m=DATE_ONLY.exec(s);if(!m)return undefined;const [y,mo,d]=[+m[1],+m[2],+m[3]],t=Date.UTC(y,mo-1,d),x=new Date(t);
 return x.getUTCFullYear()===y&&x.getUTCMonth()===mo-1&&x.getUTCDate()===d?t:undefined;
}
/** UTC milliseconds of an ISO 8601 instant with an offset and a real calendar date, else undefined. */
export function instantValue(s:string):number|undefined{
 const m=INSTANT.exec(s);if(!m||dateValue(`${m[1]}-${m[2]}-${m[3]}`)===undefined||+m[4]>23||+m[5]>59||+(m[6]??0)>59)return undefined;const t=Date.parse(s);return Number.isFinite(t)?t:undefined;
}
/** Parsed ISO 8601 duration (weeks, days, hours, minutes only; no months or years, whose length varies). */
export function durationParts(s:string):{days:number;ms:number}|undefined{
 const m=DURATION.exec(s);if(!m)return undefined;const days=(+(m[1]??0))*7+(+(m[2]??0)),ms=(+(m[3]??0))*3600000+(+(m[4]??0))*60000;return {days,ms};
}
export type Interval={start:number;end:number};
/**
 * The interval one timed fact covers, as [start, end) in UTC milliseconds, or the reason it is refused. `dateOnly`
 * says which time basis the enclosing schedule declares; mixing a date with an instant is refused, never coerced.
 */
export function intervalOf(x:{start:string;end?:string;duration?:string},dateOnly:boolean):Interval|{error:string}{
 const read=dateOnly?dateValue:instantValue,kind=dateOnly?'a calendar date such as 2026-10-16':'an ISO 8601 timestamp with an offset such as 2026-10-16T09:00:00Z';
 const start=read(x.start);if(start===undefined)return {error:`start ${x.start} is not ${kind}`};
 if(x.end===undefined&&x.duration===undefined)return {error:'needs an end or a duration; nothing is inferred'};
 let end:number|undefined;
 if(x.end!==undefined){const e=read(x.end);if(e===undefined)return {error:`end ${x.end} is not ${kind}`};end=dateOnly?e+DAY:e;if(end<=start)return {error:`ends (${x.end}) before it starts (${x.start})`};}
 if(x.duration!==undefined){const p=durationParts(x.duration);if(!p)return {error:`duration ${x.duration} is not an ISO 8601 duration in weeks, days, hours or minutes`};
  if(dateOnly&&p.ms)return {error:`duration ${x.duration} has hours or minutes, but this schedule is date-only`};
  const span=p.days*DAY+p.ms;if(span<=0)return {error:`duration ${x.duration} is zero`};
  if(end!==undefined&&end!==start+span)return {error:`end ${x.end} and duration ${x.duration} disagree; give one, or two that agree`};end=start+span;}
 return {start,end:end!};
}
/** A measurement window [from, to]: both dates (inclusive days) or both instants; `to` never before `from`. */
export function windowOf(w:{from:string;to:string}):Interval|{error:string}{
 const dated=DATE_ONLY.test(w.from);if(dated!==DATE_ONLY.test(w.to))return {error:`window ${w.from} → ${w.to} mixes a date and a timestamp`};
 const from=dated?dateValue(w.from):instantValue(w.from),to=dated?dateValue(w.to):instantValue(w.to);
 if(from===undefined||to===undefined)return {error:`window ${w.from} → ${w.to} is not two real dates or two timestamps with an offset`};
 if(to<from)return {error:`window ends (${w.to}) before it starts (${w.from})`};
 return {start:from,end:dated?to+DAY:to};
}
export const isError=(x:Interval|{error:string}):x is {error:string}=>'error' in x;
/** One schedule item or measure as plain text, the same words in every export that lists evidence. */
export const scheduleItemText=(i:{label:string;start:string;end?:string;duration?:string;basis:string})=>`${i.label}: ${i.start} → ${i.end??''}${i.end&&i.duration?' ':''}${i.duration?`(${i.duration})`:''} · ${i.basis==='estimate'?'estimate':'supplied'}`;
export const measureText=(m:{metric:string;value:number;unit:string;scope:string;window:{from:string;to:string};basis:string;role:string})=>`${m.role} ${m.metric}: ${m.value} ${m.unit} · ${m.scope} · ${m.window.from} → ${m.window.to} · ${m.basis}`;
/** Readable length of a span, for notes: "7 days", "6 h", "90 min". */
export function spanText(ms:number):string{
 if(ms%DAY===0){const d=ms/DAY;return `${d} day${d===1?'':'s'}`;}
 if(ms%3600000===0)return `${ms/3600000} h`;return `${Math.round(ms/60000)} min`;
}
