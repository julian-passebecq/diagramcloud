import type {Project} from './model';
import {repositoryOf} from './viewspec';

/**
 * Canvas card footprint used for layout spacing. The card width matches the canvas (`.react-flow__node-component`) and
 * the export scene (NODE_WIDTH); the height covers the tallest canvas card (title, summary, footer and workspace row),
 * which is taller than the export scene's 100 px box.
 */
export const LAYOUT_NODE_WIDTH=220,LAYOUT_NODE_HEIGHT=160;
/** Column pitch leaves room for an edge label between columns; row pitch matches the grid layout's 180 px. */
export const LAYOUT_COLUMN=LAYOUT_NODE_WIDTH+120,LAYOUT_ROW=180,LAYOUT_BAND_GAP=70;
/** Columns per band before a long flow wraps, and the extra vertical lane left between bands for the connectors that cross from one band to the next. */
export const LAYOUT_MAX_COLUMNS=6,LAYOUT_WRAP_GAP=120;

export type LayeredLayoutOptions={
 /** Columns per band; a longer flow folds into bands stacked top to bottom, all reading left to right. Infinity: no wrap. */
 maxColumns?:number;
};

type RankNode={id:string;position:{x:number;y:number}};
type RankEdge={from:string;to:string};

/**
 * Reading order of a view: a rank per component (longest path from the components nothing points to), cycles broken
 * at the earliest component in the given order (canvas order: x, then y, then id). Deterministic, and only a reading
 * aid: it is not a measured time order.
 */
export function flowRanks(nodes:RankNode[],edges:RankEdge[]):Map<string,number>{
 const order=[...nodes].sort((a,b)=>a.position.x-b.position.x||a.position.y-b.position.y||a.id.localeCompare(b.id)),ids=new Set(order.map(n=>n.id));
 const inner=edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to),indeg=new Map(order.map(n=>[n.id,0])),rank=new Map<string,number>(),done=new Set<string>();
 for(const e of inner)indeg.set(e.to,indeg.get(e.to)!+1);
 while(done.size<order.length){
  let next=order.find(n=>!done.has(n.id)&&indeg.get(n.id)===0);
  if(!next)next=order.filter(n=>!done.has(n.id)).sort((a,b)=>indeg.get(a.id)!-indeg.get(b.id)!)[0];// cycle: break it
  done.add(next.id);rank.set(next.id,Math.max(0,...inner.filter(e=>e.to===next!.id&&done.has(e.from)&&e.from!==next!.id).map(e=>(rank.get(e.from)??0)+1)));
  for(const e of inner)if(e.from===next.id&&!done.has(e.to))indeg.set(e.to,indeg.get(e.to)!-1);
 }
 return rank;
}

const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;

/**
 * Layered (left-to-right) layout of one view, computed from its connections only. Pure and deterministic: positions in
 * the document are not read, so the same view membership and connections always give the same result, and applying it
 * twice changes nothing.
 * - Columns: longest-path reading order (flowRanks), cycles broken at the earliest component in view order.
 * - Rows: barycentre sweeps (4 passes, ties by id) to reduce crossings; members of one repository stay contiguous.
 * - Wrap: more than `maxColumns` (default 6) columns fold into bands of at most `maxColumns` columns, stacked top to
 *   bottom and all reading left to right (column k sits in band floor(k/maxColumns)), with a lane between bands for
 *   the connector into the next band. Kept only when it does not add edge crossings (straight lines between box
 *   centres); otherwise the unwrapped row is returned.
 * - Components with no connection in the view go in a band under the main flow.
 */
export function layeredLayout(doc:Project,viewId:string,options:LayeredLayoutOptions={}):Record<string,{x:number;y:number}>{
 const maxColumns=options.maxColumns??LAYOUT_MAX_COLUMNS;
 if(!(maxColumns>=1))throw new Error('maxColumns must be at least 1.');
 const view=doc.views.find(v=>v.id===viewId);
 if(!view)throw new Error(`Unknown view ${viewId}.`);
 const known=new Set(doc.nodes.map(n=>n.id)),ids=view.nodeIds.filter(id=>known.has(id)),inView=new Set(ids),index=new Map(ids.map((id,i)=>[id,i]));
 const edges=doc.edges.filter(e=>view.edgeIds.includes(e.id)&&inView.has(e.source)&&inView.has(e.target)&&e.source!==e.target).map(e=>({from:e.source,to:e.target}));
 const linked=new Set(edges.flatMap(e=>[e.from,e.to])),main=ids.filter(id=>linked.has(id)),loose=ids.filter(id=>!linked.has(id));
 const group=new Map(ids.map(id=>[id,repositoryOf(doc,id)?.id??'']));
 // View order (not canvas coordinates) drives cycle breaking, so the result does not depend on the current positions.
 const ranks=flowRanks(main.map(id=>({id,position:{x:index.get(id)!,y:0}})),edges);
 const depth=main.length?Math.max(...main.map(id=>ranks.get(id)!))+1:0;
 const columns:string[][]=Array.from({length:depth},()=>[]);
 for(const id of main)columns[ranks.get(id)!].push(id);
 const neighbours=new Map(main.map(id=>[id,[] as string[]]));
 for(const e of edges){neighbours.get(e.from)!.push(e.to);neighbours.get(e.to)!.push(e.from);}
 // Slot of a node in its column, centred so columns of different heights compare.
 const slot=new Map<string,number>();
 const place=(col:string[])=>col.forEach((id,i)=>slot.set(id,i-(col.length-1)/2));
 const arrange=(col:string[],key:(id:string)=>number)=>{
  const bc=new Map(col.map(id=>[id,key(id)])),blocks=new Map<string,string[]>();
  for(const id of col){const k=group.get(id)?`g:${group.get(id)}`:`n:${id}`;if(!blocks.has(k))blocks.set(k,[]);blocks.get(k)!.push(id);}
  const mean=(b:string[])=>b.reduce((s,id)=>s+bc.get(id)!,0)/b.length;
  return [...blocks.entries()].sort((a,b)=>mean(a[1])-mean(b[1])||cmp(a[0],b[0]))
   .flatMap(([,b])=>b.sort((x,y)=>bc.get(x)!-bc.get(y)!||cmp(x,y)));
 };
 // Initial order: repository blocks, then view order.
 columns.forEach((col,r)=>{columns[r]=arrange(col,id=>index.get(id)!);place(columns[r]);});
 const barycentre=(id:string,side:(n:string)=>boolean)=>{const ns=neighbours.get(id)!.filter(side);return ns.length?ns.reduce((s,n)=>s+slot.get(n)!,0)/ns.length:slot.get(id)!;};
 for(let pass=0;pass<4;pass++){
  const forward=pass%2===0,order=forward?columns.map((_,r)=>r):columns.map((_,r)=>columns.length-1-r);
  for(const r of order){const side=(n:string)=>forward?ranks.get(n)!<r:ranks.get(n)!>r;columns[r]=arrange(columns[r],id=>barycentre(id,side));place(columns[r]);}
 }
 const flow=(width:number)=>{
  const out:Record<string,{x:number;y:number}>={},bands=depth<=width?Math.min(depth,1):Math.ceil(depth/width);let top=0;
  for(let b=0;b<bands;b++){
   const cols=columns.slice(b*width,(b+1)*width),tallest=Math.max(0,...cols.map(c=>c.length));
   cols.forEach((col,k)=>col.forEach((id,i)=>{out[id]={x:k*LAYOUT_COLUMN,y:top+Math.round((i+(tallest-col.length)/2)*LAYOUT_ROW)};}));
   top+=tallest*LAYOUT_ROW+(b<bands-1?LAYOUT_WRAP_GAP:0);
  }
  return {out,height:top,width:Math.min(depth,width)};
 };
 let placed=flow(Infinity);
 if(depth>maxColumns){
  const wrapped=flow(maxColumns);
  if(layoutCrossings(edges,wrapped.out)<=layoutCrossings(edges,placed.out))placed=wrapped;
 }
 const out=placed.out;
 if(loose.length){
  const sorted=[...loose].sort((a,b)=>cmp(group.get(a)!,group.get(b)!)||index.get(a)!-index.get(b)!);
  const perRow=Math.max(placed.width,Math.ceil(Math.sqrt(sorted.length)),3),top=placed.height?placed.height+LAYOUT_BAND_GAP:0;
  sorted.forEach((id,i)=>{out[id]={x:(i%perRow)*LAYOUT_COLUMN,y:top+Math.floor(i/perRow)*LAYOUT_ROW};});
 }
 return out;
}

type Point={x:number;y:number};
/**
 * Edge crossings of a layout, counted as proper intersections of straight segments between box centres (edges that
 * share an endpoint never count). A layout quality measure only: the canvas and exports route edges their own way.
 */
export function layoutCrossings(edges:RankEdge[],positions:Record<string,Point>):number{
 const c=(id:string)=>({x:positions[id].x+LAYOUT_NODE_WIDTH/2,y:positions[id].y+LAYOUT_NODE_HEIGHT/2});
 const seg=edges.filter(e=>positions[e.from]&&positions[e.to]&&e.from!==e.to).map(e=>({a:c(e.from),b:c(e.to),from:e.from,to:e.to}));
 const o=(a:Point,b:Point,q:Point)=>Math.sign((b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x));
 let n=0;
 for(let i=0;i<seg.length;i++)for(let j=i+1;j<seg.length;j++){
  const s=seg[i],t=seg[j];if(new Set([s.from,s.to,t.from,t.to]).size<4)continue;
  if(o(s.a,s.b,t.a)*o(s.a,s.b,t.b)<0&&o(t.a,t.b,s.a)*o(t.a,t.b,s.b)<0)n++;
 }
 return n;
}
