import type {Project} from '../../core/model';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {clipMono,f,footerLine,header,legendStrip,markers,monoWidth,MONO,sansWidth,svgDocument,txt,type Box,type LegendItem,type Tokens} from './kit';
import {xml} from '../diagram';

const M=48,W=880,H=520,BAND=18,GAP=4,MAXDEPTH=3,MAX=60,MINW=56,MINH=34;
export type TreemapNode={viewId:string;title:string;own:number;total:number;depth:number;via?:string;children:TreemapNode[]};
export type TreemapTile={node:TreemapNode;box:Box;own?:Box};

/** Drilldown hierarchy from the public document: first parent wins, at most three levels below the root. */
export function treemapHierarchy(doc:Project):{root:TreemapNode;count:number}{
 const seen=new Set<string>();let count=0;
 function build(id:string,depth:number,via?:string):TreemapNode|undefined{
  if(seen.has(id)||count>=MAX)return undefined;const v=doc.views.find(v=>v.id===id);if(!v)return undefined;seen.add(id);count++;
  const ns=v.nodeIds.map(id=>doc.nodes.find(n=>n.id===id)).filter(n=>n!==undefined),node:TreemapNode={viewId:id,title:v.title,own:ns.length,total:ns.length,depth,via,children:[]};
  if(depth<MAXDEPTH)for(const n of ns)if(n.childViewId){const ch=build(n.childViewId,depth+1,n.label);if(ch){node.children.push(ch);node.total+=ch.total;}}
  return node;
 }
 return {root:build(doc.rootViewId,0)!,count};
}

/** Squarified layout (Bruls et al.): values sorted descending (ties by key), rows laid along the shorter side. */
export function squarify<T>(items:{key:string;value:number;item:T}[],r:Box):{item:T;box:Box}[]{
 const xs=items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value||a.key.localeCompare(b.key)),sum=xs.reduce((s,i)=>s+i.value,0),out:{item:T;box:Box}[]=[];
 if(!xs.length||r.w<=0||r.h<=0)return out;
 const scale=r.w*r.h/sum;let rect={...r},i=0;
 const worst=(row:number[],side:number)=>{const s=row.reduce((a,b)=>a+b,0),mx=Math.max(...row),mn=Math.min(...row);return Math.max(side*side*mx/(s*s),s*s/(side*side*mn));};
 while(i<xs.length){
  const side=Math.min(rect.w,rect.h),row=[xs[i].value*scale];let j=i+1;
  while(j<xs.length&&worst([...row,xs[j].value*scale],side)<=worst(row,side)){row.push(xs[j].value*scale);j++;}
  const s=row.reduce((a,b)=>a+b,0),horiz=rect.w>=rect.h,thick=s/side;let at=0;
  row.forEach((a,k)=>{const len=a/thick;out.push({item:xs[i+k].item,box:horiz?{x:rect.x,y:rect.y+at,w:thick,h:len}:{x:rect.x+at,y:rect.y,w:len,h:thick}});at+=len;});
  rect=horiz?{x:rect.x+thick,y:rect.y,w:rect.w-thick,h:rect.h}:{x:rect.x,y:rect.y+thick,w:rect.w,h:rect.h-thick};i=j;
 }
 return out;
}

/** Nested tiles: each parent keeps an 18 px header band; its children and its own components share the area below. */
export function treemapTiles(root:TreemapNode,box:Box):TreemapTile[]{
 const out:TreemapTile[]=[];
 (function place(n:TreemapNode,b:Box){
  const tile:TreemapTile={node:n,box:b};out.push(tile);if(!n.children.length)return;
  const inner={x:b.x+GAP,y:b.y+BAND,w:b.w-2*GAP,h:b.h-BAND-GAP};if(inner.w<8||inner.h<8)return;
  const parts=squarify<TreemapNode|null>([...n.children.map(ch=>({key:ch.viewId,value:ch.total,item:ch as TreemapNode|null})),{key:'￿',value:n.own,item:null}],inner);
  for(const p of parts){const g={x:Math.round(p.box.x+GAP/2),y:Math.round(p.box.y+GAP/2),w:Math.round(p.box.w-GAP),h:Math.round(p.box.h-GAP)};
   if(g.w<=2||g.h<=2)continue;if(p.item)place(p.item,g);else tile.own=g;}
 })(root,box);
 return out;
}

function clipSans(s:string,width:number,size:number):string{
 if(sansWidth(s,size,true)<=width)return s;const ch=[...s];let n=ch.length;
 while(n>1&&sansWidth(ch.slice(0,n).join('')+'…',size,true)>width)n--;return n>1?ch.slice(0,n).join('').trimEnd()+'…':'';
}
const plural=(n:number)=>`${n} component${n===1?'':'s'}`;
const depthFill=(d:number,t:Tokens)=>[t.wash,t.backend,t.faceLeft,t.store][Math.min(d,3)];

/**
 * Treemap of the drilldown hierarchy: the project is one rectangle, subdivided into the public views reachable from
 * the root (first parent wins, three levels at most). A tile's area is the number of components in its view plus its
 * descendants; the unlabelled remainder of a parent is its own components. The current view is the only accent.
 */
export function treemapSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'treemap',options),{doc,spec,t}=c,{root,count}=treemapHierarchy(doc),omitted=doc.views.length-count;
 const hdr=header(eyebrowOf(c,'Drilldown treemap'),spec.projectTitle,`Area is the number of components in a view and the views it opens. Current view: ${spec.title}.`,M,M,W,t,c.editorial);
 const oy=M+hdr.height+28,tiles=treemapTiles(root,{x:M,y:oy,w:W,h:H}),body:string[]=[];
 for(const {node:n,box:b,own} of tiles){
  const cur=n.viewId===spec.viewId,parent=n.children.length>0,stroke=cur?t.accent:n.depth===0?t.ink:t.muted,label=`${n.title} · ${plural(n.total)}${n.children.length?` (${n.own} in this view)`:''}${n.via?` · opened from ${n.via}`:''}`;
  const g=[`<g data-view-ref="${xml(n.viewId)}" data-depth="${n.depth}" data-weight="${n.total}"${cur?' data-current="true"':''}><title>${xml(label)}</title>`,
   `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" rx="4" fill="${t.paper}"/>`,
   `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" rx="4" fill="${cur?t.accentTint:depthFill(n.depth,t)}" stroke="${stroke}" stroke-width="${cur?1.4:1}"/>`];
  if(parent)g.push(`<line x1="${f(b.x)}" y1="${f(b.y+BAND)}" x2="${f(b.x+b.w)}" y2="${f(b.y+BAND)}" stroke="${cur?t.accent:t.rule}" stroke-width="1"/>`);
  const roomy=b.w>=MINW&&b.h>=(parent?BAND:MINH);
  if(roomy){
   const count=parent?`${n.total}`:plural(n.own),cw=monoWidth(count,9)+8;
   if(parent){
    const showCount=b.w-16>cw+40,title=clipSans(n.title,b.w-16-(showCount?cw:0),11);
    if(title)g.push(txt(title,b.x+8,b.y+13,{size:11,fill:t.ink,weight:600}));
    if(showCount)g.push(txt(count,b.x+b.w-8,b.y+13,{size:9,fill:cur?t.accent:t.muted,font:MONO,anchor:'end'}));
   }else{
    const title=clipSans(n.title,b.w-16,11),sub=clipMono(count,b.w-16,9);
    if(title)g.push(txt(title,b.x+8,b.y+18,{size:11,fill:t.ink,weight:600}));
    if(b.h>=MINH+6)g.push(txt(sub,b.x+8,b.y+32,{size:9,fill:cur?t.accent:t.muted,font:MONO}));
   }
  }
  if(own){g.push(`<rect data-own="${xml(n.viewId)}" x="${f(own.x)}" y="${f(own.y)}" width="${f(own.w)}" height="${f(own.h)}" rx="3" fill="none" stroke="${t.ruleSolid}" stroke-width="0.8" stroke-dasharray="3,3"/>`);
   const s=`${n.own} HERE`;if(own.w-12>=monoWidth(s,8,0.06)&&own.h>=20)g.push(txt(s,own.x+6,own.y+13,{size:8,fill:t.soft,font:MONO,tracking:0.06}));}
  g.push('</g>');body.push(g.join(''));
 }
 const items:LegendItem[]=[{kind:'box',treatment:'focal',label:'Current view'},{kind:'swatch',fill:depthFill(1,t),label:'Level 1'},{kind:'swatch',fill:depthFill(2,t),label:'Level 2+'},{kind:'line',stroke:'muted',dashed:true,label:'Components of the parent view'}];
 const legend=legendStrip(items,M,oy+H+28,W,t);
 let y=oy+H+28+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,W):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:W+2*M,height:y+M,title:`${spec.projectTitle} · drilldown treemap`,
  desc:`Treemap of ${count} public view(s) holding ${root.total} component placement(s); area is proportional to components in a view and its descendants${omitted>0?`; ${omitted} view(s) not drawn (deeper than ${MAXDEPTH} levels, limit ${MAX} or not reachable)`:''}. Current view: ${spec.title}.`,
  t,theme:c.theme,type:'treemap',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+body.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,W,t)});
}
