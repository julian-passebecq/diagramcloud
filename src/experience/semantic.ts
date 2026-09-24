import type {ExperienceItem} from './model';

/**
 * Star-schema layout shared by the HTML/SVG renderer and the PowerPoint exporter, so every output draws the same
 * picture. Facts sit in the middle band; each dimension goes above or below, nearest the facts it relates to.
 * Explicit col/row positions (all tables) override the automatic layout. Units are abstract pixels.
 */
export type ModelItem=Extract<ExperienceItem,{type:'model'}>;
export type ModelBox={name:string;kind:ModelItem['tables'][number]['kind'];x:number;y:number;w:number;h:number;rows:{name:string;key?:'pk'|'fk';type:string}[];more:number};
export type ModelLink={x1:number;y1:number;x2:number;y2:number;fromMark:string;toMark:string;active:boolean};
export type ModelLayout={w:number;h:number;boxes:ModelBox[];links:ModelLink[]};

export const MODEL_HEADER=24,MODEL_ROW=15,MODEL_MAX_ROWS=6;
const GAP_X=18,BAND_GAP=46,PAD=8;

function tableOf(ref:string){return ref.slice(0,ref.indexOf('.'));}

/** Keys first, then the rest, capped so a wide table does not dominate the picture. */
function rowsFor(t:ModelItem['tables'][number]){
 const ordered=[...t.columns.filter(c=>c.key==='pk'),...t.columns.filter(c=>c.key==='fk'),...t.columns.filter(c=>!c.key)];
 const shown=ordered.length>MODEL_MAX_ROWS?ordered.slice(0,MODEL_MAX_ROWS-1):ordered;
 return {rows:shown.map(c=>({name:c.name,key:c.key,type:c.type})),more:ordered.length-shown.length};
}
const heightOf=(rows:number,more:number)=>MODEL_HEADER+Math.max(1,rows)*MODEL_ROW+(more?MODEL_ROW:0)+6;

/** Point where the segment from the box centre towards (tx,ty) leaves the box. */
function edge(b:ModelBox,tx:number,ty:number){
 const cx=b.x+b.w/2,cy=b.y+b.h/2,dx=tx-cx,dy=ty-cy;if(!dx&&!dy)return {x:cx,y:cy};
 const s=Math.min(dx?Math.abs(b.w/2/dx):Infinity,dy?Math.abs(b.h/2/dy):Infinity);
 return {x:cx+dx*s,y:cy+dy*s};
}

export function modelLayout(item:ModelItem,width:number):ModelLayout{
 const base=item.tables.map(t=>({t,...rowsFor(t)}));
 const facts=base.filter(x=>x.t.kind==='fact'||x.t.kind==='bridge'),others=base.filter(x=>!(x.t.kind==='fact'||x.t.kind==='bridge'));
 const neighbours=new Map<string,Set<string>>();
 for(const r of item.relationships){const a=tableOf(r.from),b=tableOf(r.to);if(!neighbours.has(a))neighbours.set(a,new Set());if(!neighbours.has(b))neighbours.set(b,new Set());neighbours.get(a)!.add(b);neighbours.get(b)!.add(a);}
 const boxes:ModelBox[]=[];
 const manual=item.tables.every(t=>t.col!==undefined&&t.row!==undefined);
 if(manual){
  const cols=Math.max(...item.tables.map(t=>t.col!))+1,cw=(width-PAD*2-(cols-1)*GAP_X)/cols,rowH=new Map<number,number>();
  for(const x of base)rowH.set(x.t.row!,Math.max(rowH.get(x.t.row!)??0,heightOf(x.rows.length,x.more)));
  const rowsSorted=[...rowH.keys()].sort((a,b)=>a-b),top=new Map<number,number>();let y=PAD;for(const r of rowsSorted){top.set(r,y);y+=rowH.get(r)!+BAND_GAP;}
  for(const x of base)boxes.push({name:x.t.name,kind:x.t.kind,x:PAD+x.t.col!*(cw+GAP_X),y:top.get(x.t.row!)!,w:cw,h:heightOf(x.rows.length,x.more),rows:x.rows,more:x.more});
 }else{
  // Middle band: facts spread evenly. Outer bands: dimensions by barycentre of their related facts.
  const perBand=Math.max(facts.length,Math.ceil(others.length/2),1),bw=Math.min(190,(width-PAD*2-(perBand-1)*GAP_X)/perBand);
  const factX=new Map<string,number>(),span=width-PAD*2-bw;
  facts.forEach((f,k)=>factX.set(f.t.name,PAD+(facts.length===1?span/2:span*k/(facts.length-1))));
  const bary=(name:string)=>{const xs=[...(neighbours.get(name)??[])].map(n=>factX.get(n)).filter((v):v is number=>v!==undefined);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:PAD+span/2;};
  const sorted=[...others].sort((a,b)=>bary(a.t.name)-bary(b.t.name)||a.t.name.localeCompare(b.t.name));
  const topBand=sorted.filter((_,k)=>k%2===0),bottomBand=sorted.filter((_,k)=>k%2===1);
  /** Place boxes near their target x without overlap, then pull the row back inside the width. */
  const place=(band:typeof base,y:number)=>{const xs:number[]=[];band.forEach((b,k)=>{const want=bary(b.t.name);xs.push(k?Math.max(want,xs[k-1]+bw+GAP_X):Math.max(PAD,want));});
   const overflow=(xs.at(-1)??0)+bw-(width-PAD);if(overflow>0)for(let k=0;k<xs.length;k++)xs[k]-=overflow;
   // Still too wide after shifting left: fall back to even spacing across the whole width.
   if((xs[0]??PAD)<PAD)band.forEach((_,k)=>{xs[k]=PAD+(band.length===1?(width-2*PAD-bw)/2:(width-2*PAD-bw)*k/(band.length-1));});
   band.forEach((b,k)=>boxes.push({name:b.t.name,kind:b.t.kind,x:xs[k],y,w:bw,h:heightOf(b.rows.length,b.more),rows:b.rows,more:b.more}));};
  const bandH=(band:typeof base)=>Math.max(0,...band.map(b=>heightOf(b.rows.length,b.more)));
  const topH=bandH(topBand),midH=bandH(facts),y1=PAD,y2=y1+(topH?topH+BAND_GAP:0),y3=y2+(midH?midH+BAND_GAP:0);
  place(topBand,y1);
  facts.forEach(f=>boxes.push({name:f.t.name,kind:f.t.kind,x:factX.get(f.t.name)!,y:y2,w:bw,h:heightOf(f.rows.length,f.more),rows:f.rows,more:f.more}));
  place(bottomBand,y3);
 }
 const byName=new Map(boxes.map(b=>[b.name,b]));
 const links:ModelLink[]=item.relationships.flatMap(r=>{const a=byName.get(tableOf(r.from)),b=byName.get(tableOf(r.to));if(!a||!b)return [];
  const p=edge(a,b.x+b.w/2,b.y+b.h/2),q=edge(b,a.x+a.w/2,a.y+a.h/2),[fm,tm]=r.cardinality.split(':');
  return [{x1:p.x,y1:p.y,x2:q.x,y2:q.y,fromMark:fm,toMark:tm,active:r.active}];});
 const h=Math.max(...boxes.map(b=>b.y+b.h))+PAD;
 return {w:width,h,boxes,links};
}
