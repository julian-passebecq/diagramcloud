import {textWidth} from '../export/measure';
import type {ScenePoint} from '../export/scene';

/**
 * Canvas connection label placement: a label pill is never drawn over a card and avoids the labels placed before it.
 * Pure and deterministic (same routes, cards and labels give the same spots). Widths come from the export's text
 * measurement, so the pill is given that exact width and clips with an ellipsis instead of growing past it.
 */
export type LabelRect={x:number;y:number;w:number;h:number};
export type PlacedLabel={x:number;y:number;width:number;clipped:boolean;hidden:boolean};

export const LABEL_SIZE=9;
export const LABEL_HEIGHT=16;
const PAD=12,MIN_W=26,MARGIN=3;
/** Pill width for a label: measured text plus padding, with headroom because the canvas font is not Arial. */
export const labelWidth=(text:string)=>Math.ceil(textWidth(text,LABEL_SIZE)*1.12)+PAD;

const hits=(a:LabelRect,b:LabelRect,m:number)=>a.x<b.x+b.w+m&&a.x+a.w>b.x-m&&a.y<b.y+b.h+m&&a.y+a.h>b.y-m;

/** Candidate centres: along every segment (longest first) on it, then just off it on either side. */
type Cand={x:number;y:number;horizontal:boolean;off:number};
function candidates(points:ScenePoint[]):Cand[]{
 const segs=points.slice(1).map((b,i)=>({a:points[i],b,len:Math.abs(b.x-points[i].x)+Math.abs(b.y-points[i].y),i})).filter(s=>s.len>0)
  .sort((p,q)=>q.len-p.len||p.i-q.i);
 const out:Cand[]=[];
 const ts=[.5,.35,.65,.2,.8,.1,.9];
 for(const off of [0,-1,1])for(const s of segs){const horizontal=Math.abs(s.b.y-s.a.y)<Math.abs(s.b.x-s.a.x);
  for(const t of ts){const x=s.a.x+(s.b.x-s.a.x)*t,y=s.a.y+(s.b.y-s.a.y)*t;
   out.push({x,y,horizontal,off});}}
 return out;
}

export function placeLabels(items:{id:string;text:string;route?:ScenePoint[]}[],cards:LabelRect[]):Map<string,PlacedLabel>{
 const placed:LabelRect[]=[],out=new Map<string,PlacedLabel>();
 for(const it of items){
  if(!it.text||!it.route||it.route.length<2)continue;
  const full=labelWidth(it.text),cands=candidates(it.route);
  const rectAt=(c:Cand,w:number):LabelRect=>{
   const dx=c.horizontal?0:c.off*(w/2+4),dy=c.horizontal?c.off*(LABEL_HEIGHT/2+3):0;
   return {x:c.x+dx-w/2,y:c.y+dy-LABEL_HEIGHT/2,w,h:LABEL_HEIGHT};};
  const free=(r:LabelRect)=>!cards.some(b=>hits(r,b,MARGIN))&&!placed.some(b=>hits(r,b,0));
  let found:LabelRect|undefined;
  // Full width first anywhere, then progressively narrower (clipped with an ellipsis).
  for(let w=full;;w=Math.max(MIN_W,Math.min(w-8,Math.floor(w*.85)))){
   for(const c of cands){const r=rectAt(c,w);if(free(r)){found=r;break;}}
   if(found||w<=MIN_W)break;
  }
  if(!found){out.set(it.id,{x:0,y:0,width:0,clipped:true,hidden:true});continue;}
  placed.push(found);
  out.set(it.id,{x:found.x+found.w/2,y:found.y+found.h/2,width:found.w,clipped:found.w<full,hidden:false});
 }
 return out;
}
