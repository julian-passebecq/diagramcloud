import type {ExperienceWorkspace} from './model';

/**
 * Grid geometry for moving and resizing workspace panels. Pure: the studio feeds it pointer deltas measured in
 * grid steps (or arrow-key presses) and only commits a cell that placementProblem() accepts. The limits mirror
 * packSchema (x 0..11, y 0..200, w/h 1..12, x+w <= 12), so a committed layout always validates.
 */
export type Cell={x:number;y:number;w:number;h:number};
type Placement=ExperienceWorkspace['placements'][number];
export const GRID_COLS=12,MAX_Y=200,MAX_SPAN=12;

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));

/** Move by whole cells, kept inside the grid. */
export function moved(c:Cell,dx:number,dy:number):Cell{return {...c,x:clamp(c.x+dx,0,GRID_COLS-c.w),y:clamp(c.y+dy,0,MAX_Y)};}
/** Resize from the bottom-right corner by whole cells, kept inside the grid. */
export function resized(c:Cell,dw:number,dh:number):Cell{return {...c,w:clamp(c.w+dw,1,GRID_COLS-c.x),h:clamp(c.h+dh,1,MAX_SPAN)};}

/** Whole grid steps covered by a pointer movement; half a step rounds, so small jitters do nothing. */
export function stepsFor(pixels:number,step:number):number{return step>0?Math.round(pixels/step):0;}

/** Why a panel cannot take this cell, or null when it can. Names the panel it would overlap. */
export function placementProblem(placements:Placement[],id:string,c:Cell,title:(itemId:string)=>string=x=>x):string|null{
 if(![c.x,c.y,c.w,c.h].every(Number.isInteger))return 'Positions must be whole grid cells.';
 if(c.x<0||c.y<0||c.w<1||c.h<1||c.x+c.w>GRID_COLS||c.y>MAX_Y||c.h>MAX_SPAN)return 'That position is outside the 12-column grid.';
 const hit=placements.find(o=>o.id!==id&&c.x<o.x+o.w&&c.x+c.w>o.x&&c.y<o.y+o.h&&c.y+c.h>o.y);
 return hit?`That would overlap “${title(hit.itemId)}”.`:null;
}

/** Several panels, keyed by placement id. */
export type CellMap=Record<string,Cell>;

/** Move a group by whole cells; the shift is limited so every panel in the group stays inside the grid. */
export function groupShift(orig:CellMap,dx:number,dy:number):CellMap{
 const cells=Object.values(orig);if(!cells.length)return {};
 const minX=Math.min(...cells.map(c=>c.x)),maxRight=Math.max(...cells.map(c=>c.x+c.w)),minY=Math.min(...cells.map(c=>c.y)),maxY=Math.max(...cells.map(c=>c.y));
 const sx=clamp(dx,-minX,GRID_COLS-maxRight),sy=clamp(dy,-minY,MAX_Y-maxY);
 return Object.fromEntries(Object.entries(orig).map(([id,c])=>[id,{...c,x:c.x+sx,y:c.y+sy}]));
}

/** Why a set of new cells cannot be applied together, or null. Checks bounds and overlaps using the new positions. */
export function groupProblem(placements:Placement[],next:CellMap,title:(itemId:string)=>string=x=>x):string|null{
 for(const [id,c] of Object.entries(next)){const own=placementProblem([],id,c);if(own)return own;}
 const final=placements.map(p=>next[p.id]?{...p,...next[p.id]}:p);
 for(let a=0;a<final.length;a++)for(let b=a+1;b<final.length;b++){
  const x=final[a],y=final[b];if(!next[x.id]&&!next[y.id])continue;
  if(x.x<y.x+y.w&&x.x+x.w>y.x&&x.y<y.y+y.h&&x.y+x.h>y.y)return `“${title(x.itemId)}” would overlap “${title(y.itemId)}”.`;
 }
 return null;
}

export type AlignMode='left'|'right'|'top'|'bottom'|'width'|'height';
export const ALIGN_LABEL:Record<AlignMode,string>={left:'Align left',right:'Align right',top:'Align top',bottom:'Align bottom',width:'Match width',height:'Match height'};
/** Align edges to the outermost selected edge, or match width/height to the largest selected panel. */
export function aligned(orig:CellMap,mode:AlignMode):CellMap{
 const cells=Object.values(orig);if(!cells.length)return {};
 const left=Math.min(...cells.map(c=>c.x)),right=Math.max(...cells.map(c=>c.x+c.w)),top=Math.min(...cells.map(c=>c.y)),bottom=Math.max(...cells.map(c=>c.y+c.h));
 const w=Math.max(...cells.map(c=>c.w)),h=Math.max(...cells.map(c=>c.h));
 const f:Record<AlignMode,(c:Cell)=>Cell>={left:c=>({...c,x:left}),right:c=>({...c,x:right-c.w}),top:c=>({...c,y:top}),bottom:c=>({...c,y:bottom-c.h}),width:c=>({...c,w}),height:c=>({...c,h})};
 return Object.fromEntries(Object.entries(orig).map(([id,c])=>[id,f[mode](c)]));
}

export function describeCell(c:Cell):string{return `column ${c.x+1}, row ${c.y+1}, ${c.w} wide × ${c.h} tall`;}

const KEYS:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
/** Cell offset for an arrow key, or null. */
export function arrowDelta(key:string):[number,number]|null{return KEYS[key]??null;}
/** Arrow-key handling for the move grip (move) and the corner handle (resize). Null for other keys. */
export function keyStep(key:string,mode:'move'|'resize',c:Cell):Cell|null{
 const d=KEYS[key];if(!d)return null;
 return mode==='move'?moved(c,d[0],d[1]):resized(c,d[0],d[1]);
}
