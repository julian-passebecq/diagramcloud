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
