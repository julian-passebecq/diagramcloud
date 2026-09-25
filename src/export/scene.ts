import type {Project,ProjectView} from '../core/model';
import {positionFor} from '../core/operations';
import {iconFor,type IconEntry} from '../core/icons';
import {measureLines} from './measure';
export type ScenePoint={x:number;y:number};
export type SceneBounds={x:number;y:number;width:number;height:number};
export const NODE_WIDTH=220;
export const NODE_HEIGHT=100;
export const ROUTE_CLEARANCE=38;

export function sceneBounds(points:ScenePoint[],padding=30):SceneBounds{
 const x=Math.min(0,...points.map(p=>p.x))-padding;
 const y=Math.min(0,...points.map(p=>p.y))-padding;
 return{
  x,y,
  width:Math.max(300,...points.map(p=>p.x+NODE_WIDTH))-x+padding,
  height:Math.max(150,...points.map(p=>p.y+NODE_HEIGHT))-y+padding
 };
}

/** Deterministic Manhattan route shared by vector and presentation exports. */
export function orthogonalRoute(source:ScenePoint,target:ScenePoint,clearance=ROUTE_CLEARANCE):ScenePoint[]{
 const s={left:source.x,right:source.x+NODE_WIDTH,top:source.y,bottom:source.y+NODE_HEIGHT,cx:source.x+NODE_WIDTH/2,cy:source.y+NODE_HEIGHT/2};
 const t={left:target.x,right:target.x+NODE_WIDTH,top:target.y,bottom:target.y+NODE_HEIGHT,cx:target.x+NODE_WIDTH/2,cy:target.y+NODE_HEIGHT/2};
 if(t.left>=s.right+clearance/2){const mid=(s.right+t.left)/2;return[{x:s.right,y:s.cy},{x:mid,y:s.cy},{x:mid,y:t.cy},{x:t.left,y:t.cy}];}
 if(s.left>=t.right+clearance/2){const mid=(t.right+s.left)/2;return[{x:s.left,y:s.cy},{x:mid,y:s.cy},{x:mid,y:t.cy},{x:t.right,y:t.cy}];}
 if(t.top>=s.bottom+clearance/2){const mid=(s.bottom+t.top)/2;return[{x:s.cx,y:s.bottom},{x:s.cx,y:mid},{x:t.cx,y:mid},{x:t.cx,y:t.top}];}
 if(s.top>=t.bottom+clearance/2){const mid=(t.bottom+s.top)/2;return[{x:s.cx,y:s.top},{x:s.cx,y:mid},{x:t.cx,y:mid},{x:t.cx,y:t.bottom}];}
 const lane=Math.max(s.bottom,t.bottom)+clearance;
 return[{x:s.cx,y:s.bottom},{x:s.cx,y:lane},{x:t.cx,y:lane},{x:t.cx,y:t.bottom}];
}

export function routeLabel(points:ScenePoint[]):ScenePoint{
 let best={length:-1,point:points[0]??{x:0,y:0}};
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);
  if(length>best.length)best={length,point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
 }
 return best.point;
}

export function svgPolylinePath(points:ScenePoint[]):string{return points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');}
export function routeIsOrthogonal(points:ScenePoint[]):boolean{return points.slice(1).every((p,i)=>p.x===points[i].x||p.y===points[i].y);}

/*
 * Measured export scene. Every export (SVG, PNG, HTML portfolio, PowerPoint) draws these boxes, lines and icon
 * slots instead of laying out text on its own, so a label breaks at the same word in each. Units are the view's
 * layout pixels; PowerPoint scales them to inches. Text is measured with Arial metrics (see measure.ts).
 */

export type SceneText={lines:string[];x:number;y:number;size:number;lineHeight:number;bold:boolean;color:string;width:number;anchor:'start'|'middle';truncated:boolean};
export type SceneIcon={entry:IconEntry;x:number;y:number;size:number};
export type SceneNode={id:string;x:number;y:number;w:number;h:number;provider:SceneText;label:SceneText;summary:SceneText;footer:SceneText;icon?:SceneIcon;childViewId?:string;experienceWorkspaceId?:string};
export type SceneEdge={id:string;points:ScenePoint[];dashed:boolean;label?:SceneText};
export type Scene={bounds:SceneBounds;nodes:SceneNode[];edges:SceneEdge[];vendorIcons:IconEntry[]};

export const SCENE_FONT='Arial';
export const NODE_PAD=16,ICON_SIZE=22,EDGE_LABEL_WIDTH=150;
const INK='16263d',MUTED='52647a',LINK='2563eb',EDGE='45556d';

function text(value:string,x:number,y:number,width:number,size:number,lineHeight:number,color:string,maxLines:number,bold=false,anchor:'start'|'middle'='start'):SceneText{
 const m=measureLines(value,width,{size,bold},maxLines);
 return {lines:m.lines,x,y,size,lineHeight,bold,color,width,anchor,truncated:m.truncated};
}

/** Lay out one view: measured text per box, a square slot for a registered vendor icon, and the shared orthogonal routes. */
export function buildScene(d:Project,view:ProjectView):Scene{
 const nodes=d.nodes.filter(n=>view.nodeIds.includes(n.id)).map((n):SceneNode=>{
  const p=positionFor(view,n.id),x=p.x,y=p.y,w=NODE_WIDTH,h=NODE_HEIGHT,inner=w-2*NODE_PAD,entry=iconFor(n.icon);
  const icon=entry.origin==='vendor'?{entry,x:x+w-NODE_PAD-ICON_SIZE+6,y:y+10,size:ICON_SIZE}:undefined;
  const provider=text(n.provider.toUpperCase(),x+NODE_PAD,y+22,inner-(icon?ICON_SIZE+4:0),10,12.5,MUTED,1);
  const label=text(n.label,x+NODE_PAD,y+44,inner,14,17,INK,2,true);
  const summaryTop=label.y+label.lineHeight*(label.lines.length-1)+16;
  const summary=text(n.summary,x+NODE_PAD,summaryTop,inner,10,12.5,MUTED,label.lines.length>1?1:2);
  const footer=text(n.childViewId?'Open subdiagram':n.blockIds.length?`${n.blockIds.length} evidence block${n.blockIds.length===1?'':'s'}`:'Component',x+NODE_PAD,y+h-11,inner,10,12.5,LINK,1);
  return {id:n.id,x,y,w,h,provider,label,summary,footer,icon,...(n.childViewId?{childViewId:n.childViewId}:{}),...(n.experienceWorkspaceId?{experienceWorkspaceId:n.experienceWorkspaceId}:{})};
 });
 const boxes=nodes.map(n=>({x:n.x,y:n.y,w:n.w,h:n.h}));
 const edges=d.edges.filter(e=>view.edgeIds.includes(e.id)).map((e):SceneEdge=>{
  const s=positionFor(view,e.source),t=positionFor(view,e.target);
  const points=routeAround(s,t,boxes.filter(b=>!(b.x===s.x&&b.y===s.y)&&!(b.x===t.x&&b.y===t.y)),boxes);
  return {id:e.id,points,dashed:e.kind==='control',...(e.label?{label:edgeLabel(e.label,points,boxes)}:{})};
 });
 const vendorIcons=[...new Set(nodes.flatMap(n=>n.icon?[n.icon.entry]:[]))];
 // Detours may leave the node area; the bounds grow to keep every route and label on the page.
 const base=sceneBounds(view.nodeIds.map(id=>positionFor(view,id))),extra=edges.flatMap(e=>[...e.points,...(e.label?[{x:e.label.x,y:e.label.y-e.label.size}]:[])]);
 const minX=Math.min(base.x,...extra.map(q=>q.x-30)),minY=Math.min(base.y,...extra.map(q=>q.y-30)),maxX=Math.max(base.x+base.width,...extra.map(q=>q.x+30)),maxY=Math.max(base.y+base.height,...extra.map(q=>q.y+30));
 return {bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY},nodes,edges,vendorIcons};
}

type Box={x:number;y:number;w:number;h:number};
const inside=(p:ScenePoint,b:Box)=>p.x>b.x+1&&p.x<b.x+b.w-1&&p.y>b.y+1&&p.y<b.y+b.h-1;
/**
 * Label on the longest segment whose midpoint no box covers (boxes are drawn over lines), kept inside that
 * segment's free length: above a horizontal segment, wrapping to three lines if needed (half a box height); beside a vertical one.
 */
export function edgeLabel(value:string,points:ScenePoint[],boxes:Box[]):SceneText{
 // Merge straight runs first: a route between two boxes on one row is two collinear halves, and the label may use both.
 const runs:{a:ScenePoint;z:ScenePoint}[]=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],z=points[i];if(a.x===z.x&&a.y===z.y)continue;const last=runs.at(-1);
  if(last&&((last.a.y===last.z.y&&a.y===z.y&&last.z.y===a.y)||(last.a.x===last.z.x&&a.x===z.x&&last.z.x===a.x)))last.z=z;else runs.push({a,z});}
 const segs=runs.map(({a,z})=>({a,z,len:Math.abs(z.x-a.x)+Math.abs(z.y-a.y),mid:{x:(a.x+z.x)/2,y:(a.y+z.y)/2}}));
 const free=segs.filter(g=>!boxes.some(b=>inside(g.mid,b))),pick=[...(free.length?free:segs)].sort((p,q)=>q.len-p.len)[0];
 if(!pick){const at=routeLabel(points);return text(value,at.x,at.y-8,EDGE_LABEL_WIDTH,10,12.5,EDGE,1,false,'middle');}
 if(pick.a.y===pick.z.y){
  const width=Math.max(24,Math.min(EDGE_LABEL_WIDTH,pick.len-8)),t=text(value,pick.mid.x,0,width,10,12.5,EDGE,3,false,'middle');
  return {...t,y:pick.mid.y-6-(t.lines.length-1)*t.lineHeight};
 }
 return text(value,pick.mid.x+6,pick.mid.y+3,EDGE_LABEL_WIDTH,10,12.5,EDGE,2);
}

/** True when an axis-aligned segment passes through the inside of a box (touching its edge does not count). */
export function crosses(a:ScenePoint,z:ScenePoint,b:Box):boolean{
 if(a.y===z.y)return a.y>b.y&&a.y<b.y+b.h&&Math.max(a.x,z.x)>b.x&&Math.min(a.x,z.x)<b.x+b.w;
 return a.x>b.x&&a.x<b.x+b.w&&Math.max(a.y,z.y)>b.y&&Math.min(a.y,z.y)<b.y+b.h;
}
const crossings=(points:ScenePoint[],obstacles:Box[])=>points.slice(1).reduce((n,z,i)=>n+obstacles.filter(b=>crosses(points[i],z,b)).length,0);
/**
 * The shared orthogonal route, unless it would pass behind another box (and so look connected to it). Then the
 * route with the fewest crossings wins among: through the gap between rows (vertical first), through the gap
 * between columns (horizontal first), or a lane just below or above every box in the way. Ties keep the order
 * listed, so routes only change where a box was in the way.
 */
export function routeAround(source:ScenePoint,target:ScenePoint,obstacles:Box[],all:Box[]=obstacles):ScenePoint[]{
 const direct=orthogonalRoute(source,target);
 if(!crossings(direct,obstacles))return direct;
 const W=NODE_WIDTH,H=NODE_HEIGHT,sx=source.x+W/2,tx=target.x+W/2,sy=source.y+H/2,ty=target.y+H/2,lo=Math.min(sx,tx),hi=Math.max(sx,tx);
 const candidates:ScenePoint[][]=[direct];
 if(target.y>=source.y+H){const mid=(source.y+H+target.y)/2;candidates.push([{x:sx,y:source.y+H},{x:sx,y:mid},{x:tx,y:mid},{x:tx,y:target.y}]);}
 if(source.y>=target.y+H){const mid=(target.y+H+source.y)/2;candidates.push([{x:sx,y:source.y},{x:sx,y:mid},{x:tx,y:mid},{x:tx,y:target.y+H}]);}
 if(target.x>=source.x+W){const mid=(source.x+W+target.x)/2;candidates.push([{x:source.x+W,y:sy},{x:mid,y:sy},{x:mid,y:ty},{x:target.x,y:ty}]);}
 if(source.x>=target.x+W){const mid=(target.x+W+source.x)/2;candidates.push([{x:source.x,y:sy},{x:mid,y:sy},{x:mid,y:ty},{x:target.x+W,y:ty}]);}
 const inWay=obstacles.filter(b=>b.x<hi&&b.x+b.w>lo);
 const top=Math.min(source.y,target.y,...inWay.map(b=>b.y))-ROUTE_CLEARANCE/2,bottom=Math.max(source.y,target.y,...inWay.map(b=>b.y+b.h))+ROUTE_CLEARANCE/2;
 const minY=Math.min(...all.map(b=>b.y)),maxY=Math.max(...all.map(b=>b.y+b.h)),between=(y:number)=>y>minY&&y<maxY;
 const under=[{x:sx,y:source.y+H},{x:sx,y:bottom},{x:tx,y:bottom},{x:tx,y:target.y+H}],over=[{x:sx,y:source.y},{x:sx,y:top},{x:tx,y:top},{x:tx,y:target.y}];
 candidates.push(...(between(bottom)||!between(top)?[under,over]:[over,under]));
 return candidates.map((r,k)=>({r,k,n:crossings(r,obstacles)})).sort((p,q)=>p.n-q.n||p.k-q.k)[0].r;
}
