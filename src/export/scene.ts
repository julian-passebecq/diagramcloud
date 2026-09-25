import type {Project,ProjectView} from '../core/model';
import {positionFor} from '../core/operations';
import {iconFor,type IconEntry} from '../core/icons';
import {measureLines,textWidth} from './measure';
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

export type SceneText={lines:string[];x:number;y:number;size:number;lineHeight:number;bold:boolean;color:string;width:number;anchor:'start'|'middle';truncated:boolean;
 /** Other placements for the same label (other side of a vertical line, narrower wraps); layout only, not drawn. */
 alts?:SceneText[];
 /** For a label beside a vertical line: the y range its anchor may slide along; layout only. */
 span?:[number,number]};
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
 const shown=d.edges.filter(e=>view.edgeIds.includes(e.id));
 const routes=separateLanes(shown.map(e=>{const s=positionFor(view,e.source),t=positionFor(view,e.target);
  return simplifyRoute(routeAround(s,t,boxes.filter(b=>!(b.x===s.x&&b.y===s.y)&&!(b.x===t.x&&b.y===t.y)),boxes));}));
 const placed:Box[]=[];
 const edges=shown.map((e,k):SceneEdge=>({id:e.id,points:routes[k],dashed:e.kind==='control',...(e.label?{label:clearOf(edgeLabel(e.label,routes[k],boxes),placed,boxes,routes)}:{})}));
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
 // Beside a vertical line: right side on one or two lines first, then the left side, then narrower wraps of up to
 // three lines on either side for tight gaps. clearOf takes the first that covers no box and no other label.
 const span:[number,number]=[Math.min(pick.a.y,pick.z.y)+12,Math.max(pick.a.y,pick.z.y)-4];
 const beside=(width:number,lines:number)=>{const r={...text(value,pick.mid.x+6,pick.mid.y+3,width,10,12.5,EDGE,lines),span},w=labelBox(r).w;return [r,{...r,x:pick.mid.x-6-w+2}];};
 const [first,...alts]=[...beside(EDGE_LABEL_WIDTH,2),...beside(56,3)];
 return {...first,alts};
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
 const best=candidates.map((r,k)=>({r,k,n:crossings(r,obstacles)})).sort((p,q)=>p.n-q.n||p.k-q.k)[0];
 return best.n?channelRoute(source,target,all)??best.r:best.r;
}

const BEND=100;
/**
 * Fallback for when every route above still crosses a box: the shortest route, counting each bend as BEND px, over
 * a grid of channel lines (half-way between neighbouring box edges, box centres, and a lane just outside all boxes).
 * It leaves the middle of a side of the source and enters the middle of a side of the target, and no segment passes
 * through any box, its own two ends included. Undefined when no such route exists.
 */
export function channelRoute(source:ScenePoint,target:ScenePoint,all:Box[]):ScenePoint[]|undefined{
 const W=NODE_WIDTH,H=NODE_HEIGHT,c=ROUTE_CLEARANCE/2,s={...source,w:W,h:H},t={...target,w:W,h:H},boxes=[...all,s,t];
 const lines=(edges:number[],ends:number[])=>{const e=[...new Set(edges)].sort((p,q)=>p-q);
  return [...new Set([e[0]-c,...e.slice(1).map((v,i)=>(e[i]+v)/2),e.at(-1)!+c,...ends])].sort((p,q)=>p-q);};
 const xs=lines(boxes.flatMap(b=>[b.x,b.x+b.w]),[s.x+W/2,t.x+W/2]),ys=lines(boxes.flatMap(b=>[b.y,b.y+b.h]),[s.y+H/2,t.y+H/2]);
 const DIRS=[[1,0],[0,1],[-1,0],[0,-1]],free=(a:ScenePoint,z:ScenePoint)=>!boxes.some(b=>crosses(a,z,b));
 const beyond=(v:number[],from:number,step:number)=>{if(!step)return v.indexOf(from);for(let k=step>0?0:v.length-1;k>=0&&k<v.length;k+=step)if(step*(v[k]-from)>0)return k;return -1;};
 // Side midpoints, bottom first, with the outward direction d (an index in DIRS); each joins the grid at the first line beyond its side.
 const sides=(b:Box)=>[[b.x+b.w/2,b.y+b.h,1],[b.x+b.w,b.y+b.h/2,0],[b.x+b.w/2,b.y,3],[b.x,b.y+b.h/2,2]].flatMap(([x,y,d])=>{
  const i=beyond(xs,x,DIRS[d][0]),j=beyond(ys,y,DIRS[d][1]),side={x,y};
  return i<0||j<0||!free(side,{x:xs[i],y:ys[j]})?[]:[{side,d,i,j,len:Math.abs(xs[i]-x)+Math.abs(ys[j]-y)}];});
 // Dijkstra over (grid point, heading) states; a heading change costs BEND and reversing is not allowed.
 const key=(i:number,j:number,d:number)=>(i*ys.length+j)*4+d,cost=new Map<number,number>(),prev=new Map<number,number>(),start=new Map<number,ScenePoint>();
 const queue:[number,number][]=[],push=(k:number,c:number)=>{if(cost.has(k)&&cost.get(k)!<=c)return false;cost.set(k,c);queue.push([c,k]);return true;};
 for(const g of sides(s)){const k=key(g.i,g.j,g.d);if(push(k,g.len))start.set(k,g.side);}
 const goals=sides(t);let end:{k:number;total:number;side:ScenePoint}|undefined;
 while(queue.length){
  let m=0;for(let q=1;q<queue.length;q++)if(queue[q][0]<queue[m][0])m=q;
  const [here,k]=queue.splice(m,1)[0];if(here>cost.get(k)!)continue;if(end&&here>=end.total)break;
  const d=k%4,j=Math.floor(k/4)%ys.length,i=Math.floor(k/4/ys.length);
  for(const g of goals)if(g.i===i&&g.j===j){const total=here+g.len+(d===(g.d+2)%4?0:BEND);if(!end||total<end.total)end={k,total,side:g.side};}
  DIRS.forEach(([dx,dy],nd)=>{const ni=i+dx,nj=j+dy;if(nd===(d+2)%4||ni<0||nj<0||ni>=xs.length||nj>=ys.length)return;
   const a={x:xs[i],y:ys[j]},z={x:xs[ni],y:ys[nj]};if(!free(a,z))return;
   const nk=key(ni,nj,nd);if(push(nk,here+Math.abs(z.x-a.x)+Math.abs(z.y-a.y)+(nd===d?0:BEND))){prev.set(nk,k);start.delete(nk);}});
 }
 if(!end)return undefined;
 const path:ScenePoint[]=[end.side];let k=end.k;
 for(;;){path.unshift({x:xs[Math.floor(k/4/ys.length)],y:ys[Math.floor(k/4)%ys.length]});const p=prev.get(k);if(p===undefined)break;k=p;}
 return simplifyRoute([start.get(k)!,...path]);
}

/** Drop repeated points and merge straight runs, so a route alternates horizontal and vertical segments. */
export function simplifyRoute(points:ScenePoint[]):ScenePoint[]{
 const out:ScenePoint[]=[];
 for(const q of points){const last=out.at(-1);if(last&&last.x===q.x&&last.y===q.y)continue;
  const prev=out.at(-2);if(prev&&last&&((prev.x===last.x&&last.x===q.x)||(prev.y===last.y&&last.y===q.y)))out[out.length-1]={...q};else out.push({...q});}
 return out;
}

export const LANE_GAP=8;
/**
 * Connections that share a straight stretch get their own lanes, LANE_GAP apart and centred on the shared line, so
 * two connections never draw as one. Moving a segment moves its two end points together: routes stay orthogonal,
 * and an end on a box side only slides along that side. Horizontal stretches first, then vertical ones.
 */
export function separateLanes(input:ScenePoint[][]):ScenePoint[][]{
 const routes=input.map(r=>r.map(q=>({...q})));
 for(const horizontal of [true,false]){
  type Seg={r:number;i:number;at:number;lo:number;hi:number};
  const segs:Seg[]=[];
  routes.forEach((pts,r)=>pts.slice(1).forEach((z,i)=>{const a=pts[i];if(horizontal?a.y===z.y&&a.x!==z.x:a.x===z.x&&a.y!==z.y)segs.push({r,i,at:horizontal?a.y:a.x,lo:Math.min(horizontal?a.x:a.y,horizontal?z.x:z.y),hi:Math.max(horizontal?a.x:a.y,horizontal?z.x:z.y)});}));
  const byLine=new Map<number,Seg[]>();for(const g of segs)byLine.set(g.at,[...(byLine.get(g.at)??[]),g]);
  for(const line of byLine.values()){
   // Clusters of overlapping stretches from different routes on one line.
   line.sort((p,q)=>p.lo-q.lo);let cluster:Seg[]=[],reach=-Infinity;
   const flush=()=>{const rs=[...new Set(cluster.map(g=>g.r))].sort((p,q)=>p-q);
    if(rs.length>1)for(const g of cluster){const offset=(rs.indexOf(g.r)-(rs.length-1)/2)*LANE_GAP,pts=routes[g.r];
     for(const k of [g.i,g.i+1]){if(horizontal)pts[k].y=g.at+offset;else pts[k].x=g.at+offset;}}
    cluster=[];reach=-Infinity;};
   for(const g of line){if(cluster.length&&g.lo>=reach-4)flush();cluster.push(g);reach=Math.max(reach,g.hi);}
   flush();
  }
 }
 return routes;
}

/** The rectangle a label's text covers. */
export function labelBox(t:SceneText):Box{
 const w=Math.max(0,...t.lines.map(l=>textWidth(l,t.size,t.bold)))+4,top=t.y-t.size,h=t.size+(t.lines.length-1)*t.lineHeight+4;
 return {x:t.anchor==='middle'?t.x-w/2:t.x-2,y:top,w,h};
}
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
/**
 * Place a label clear of labels already placed and of every box (labels are drawn on top, so they must not cover
 * box text): try its side(s) at positions one line apart, alternately after and before the original. A spot that
 * also covers no line, its own included, comes first, so a label is not read as belonging to the line under it. If
 * nothing is fully clear, accept a spot clear of other labels with its anchor outside boxes; otherwise keep the original.
 */
function clearOf(t:SceneText,placed:Box[],boxes:Box[],lines:ScenePoint[][]=[]):SceneText{
 const {alts,...base}=t,sides=[base,...(alts??[])];
 // Positions one line apart, nearest first: within ±3 lines, or along the whole line for a label beside a vertical one.
 const ks=[0,...Array.from({length:40},(_,i)=>i%2?-(i+1)/2:i/2+1)];
 const tries=sides.flatMap(side=>ks.map(k=>({...side,y:side.y+k*side.lineHeight})).filter((c,i)=>side.span?c.y>=side.span[0]&&c.y<=side.span[1]:i<7));
 const free=(c:SceneText)=>!placed.some(b=>overlaps(labelBox(c),b));
 const clear=(c:SceneText)=>free(c)&&!boxes.some(b=>overlaps(labelBox(c),b)),offLines=(c:SceneText)=>{const b=labelBox(c);return !lines.some(r=>r.slice(1).some((z,i)=>crosses(r[i],z,b)));};
 const out=tries.find(c=>clear(c)&&offLines(c))??tries.find(c=>clear(c))??tries.find(c=>free(c)&&!boxes.some(b=>inside({x:c.x,y:c.y},b)))??base;
 placed.push(labelBox(out));return out;
}
