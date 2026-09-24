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

export function describeCell(c:Cell):string{return `column ${c.x+1}, row ${c.y+1}, ${c.w} wide × ${c.h} tall`;}

const KEYS:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
/** Arrow-key handling for the move grip (move) and the corner handle (resize). Null for other keys. */
export function keyStep(key:string,mode:'move'|'resize',c:Cell):Cell|null{
 const d=KEYS[key];if(!d)return null;
 return mode==='move'?moved(c,d[0],d[1]):resized(c,d[0],d[1]);
}
