import type {DesignTheme,ProjectNode} from '../../core/model';
import {measureLines,textWidth} from '../measure';
import {xml} from '../diagram';

/**
 * Diagram Design kit: tokens and primitives for DiagramCloud's "Diagram Design" mode. The visual grammar (semantic
 * colour roles, rectangular type tags, rounded right-angle connectors with masked uppercase labels, fanned attach
 * points, zones, bottom legend strip, accessible SVG) is adapted from diagram-design by Cathryn Lavery (MIT, commit
 * d137637; see THIRD_PARTY_NOTICES.md). No code, fonts or artwork are copied: the families are named with system
 * fallbacks, so an export never fetches anything. Every renderer here draws from a ViewSpec and the public document.
 */
export type Tokens={paper:string;paper2:string;ink:string;inkStrong:string;muted:string;soft:string;rule:string;ruleSolid:string;accent:string;accentTint:string;link:string;
 backend:string;store:string;external:string;externalStroke:string;optionalStroke:string;wash:string;faceLeft:string;faceRight:string;accentLeft:string;accentRight:string;series:string[]};
export const LIGHT:Tokens={paper:'#f5f5f5',paper2:'#ececec',ink:'#2d3142',inkStrong:'#111111',muted:'#4f5d75',soft:'#7a8399',rule:'rgba(45,49,66,0.12)',ruleSolid:'#bfc0c0',
 accent:'#eb6c36',accentTint:'rgba(235,108,54,0.08)',link:'#2e5aa8',backend:'#ffffff',store:'rgba(45,49,66,0.05)',external:'rgba(45,49,66,0.03)',externalStroke:'rgba(45,49,66,0.30)',
 optionalStroke:'rgba(45,49,66,0.20)',wash:'rgba(45,49,66,0.02)',faceLeft:'rgba(45,49,66,0.07)',faceRight:'rgba(45,49,66,0.15)',accentLeft:'rgba(235,108,54,0.20)',accentRight:'rgba(235,108,54,0.32)',series:['#5e7a9b','#7c8f6f','#b8915a','#9c6b50','#6e6479']};
export const DARK:Tokens={paper:'#2d3142',paper2:'#393e53',ink:'#f5f5f5',inkStrong:'#111111',muted:'#bfc0c0',soft:'#8e98ac',rule:'rgba(245,245,245,0.12)',ruleSolid:'rgba(191,192,192,0.25)',
 accent:'#f08a59',accentTint:'rgba(240,138,89,0.10)',link:'#6a95d8',backend:'#393e53',store:'rgba(245,245,245,0.06)',external:'rgba(245,245,245,0.04)',externalStroke:'rgba(245,245,245,0.30)',
 optionalStroke:'rgba(245,245,245,0.22)',wash:'rgba(245,245,245,0.03)',faceLeft:'rgba(0,0,0,0.18)',faceRight:'rgba(0,0,0,0.32)',accentLeft:'rgba(240,138,89,0.22)',accentRight:'rgba(240,138,89,0.34)',series:['#82a0c0','#9caf8f','#d3ad7a','#b88670','#8d8298']};
export const tokensFor=(theme:DesignTheme):Tokens=>theme==='dark'?DARK:LIGHT;
export const SANS="Geist, Inter, 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
export const MONO="'Geist Mono', ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Consolas, 'Liberation Mono', monospace";
export const SERIF="'Instrument Serif', 'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif";

export type P={x:number;y:number};
export type Box={x:number;y:number;w:number;h:number};
export const f=(n:number)=>String(Math.round(n*10)/10);
/** Mono text is budgeted at 0.62 em per character (calibrated for Geist Mono and the usual substitutes). */
export const monoWidth=(s:string,size:number,tracking=0)=>[...s].length*size*(0.62+tracking);
export function clipMono(s:string,width:number,size:number,tracking=0):string{
 const max=Math.max(1,Math.floor(width/(size*(0.62+tracking))));const chars=[...s];return chars.length<=max?s:`${chars.slice(0,Math.max(1,max-1)).join('')}…`;
}
/** Sans widths use Arial advance widths plus 8 % slack, since Geist and Inter run slightly wider. */
export const sansLines=(s:string,width:number,size:number,max:number,bold=false)=>measureLines(s,width/1.08,{size,bold},max).lines;
export const sansWidth=(s:string,size:number,bold=false)=>textWidth(s,size,bold)*1.08;

export function txt(s:string,x:number,y:number,o:{size:number;fill:string;font?:string;weight?:number;anchor?:'start'|'middle'|'end';tracking?:number;italic?:boolean;extra?:string}):string{
 return `<text x="${f(x)}" y="${f(y)}" font-size="${o.size}" fill="${o.fill}"${o.font?` font-family="${o.font}"`:''}${o.weight?` font-weight="${o.weight}"`:''}${o.anchor&&o.anchor!=='start'?` text-anchor="${o.anchor}"`:''}${o.tracking?` letter-spacing="${o.tracking}em"`:''}${o.italic?' font-style="italic"':''}${o.extra??''}>${xml(s)}</text>`;
}
export function lines(ls:string[],x:number,y:number,lh:number,o:Parameters<typeof txt>[3]):string{return ls.map((l,i)=>txt(l,x,y+i*lh,o)).join('');}

/** Rounded right-angle path: every bend is a quarter turn of radius r (8 by default, shorter on short segments). */
export function elbowPath(pts:P[],radius=8):string{
 if(pts.length<2)return '';
 let d=`M ${f(pts[0].x)} ${f(pts[0].y)}`;
 for(let i=1;i<pts.length-1;i++){
  const a=pts[i-1],p=pts[i],b=pts[i+1],l1=Math.hypot(p.x-a.x,p.y-a.y),l2=Math.hypot(b.x-p.x,b.y-p.y),rr=Math.min(radius,l1/2,l2/2);
  if(rr<0.5||!l1||!l2){d+=` L ${f(p.x)} ${f(p.y)}`;continue;}
  const ux=(p.x-a.x)/l1,uy=(p.y-a.y)/l1,vx=(b.x-p.x)/l2,vy=(b.y-p.y)/l2;
  d+=` L ${f(p.x-ux*rr)} ${f(p.y-uy*rr)} Q ${f(p.x)} ${f(p.y)} ${f(p.x+vx*rr)} ${f(p.y+vy*rr)}`;
 }
 const z=pts[pts.length-1];return `${d} L ${f(z.x)} ${f(z.y)}`;
}

export function markers(prefix:string,t:Tokens):string{
 return (['arrow','accent','link'] as const).map(k=>`<marker id="${prefix}-${k}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${k==='accent'?t.accent:k==='link'?t.link:t.muted}"/></marker>`).join('');
}

/** Semantic treatment of a component (diagram-design node roles), from its kind and basis: never from its name. */
export type Treatment='focal'|'backend'|'store'|'external'|'input'|'optional';
export function treatmentOf(kind:ProjectNode['kind'],basis:string,focal:boolean):Treatment{
 if(focal)return 'focal';
 if(basis==='unknown')return 'optional';
 if(kind==='storage'||kind==='table')return 'store';
 if(kind==='source')return 'external';
 if(kind==='control')return 'input';
 return 'backend';
}
export const TREATMENT_LABEL:Record<Treatment,string>={focal:'Focal',backend:'Service',store:'Store',external:'Source / external',input:'Control',optional:'Declared, not read'};
export function treatmentStyle(tr:Treatment,t:Tokens):{fill:string;stroke:string;dash?:string}{
 switch(tr){
  case 'focal':return {fill:t.accentTint,stroke:t.accent};
  case 'store':return {fill:t.store,stroke:t.muted};
  case 'external':return {fill:t.external,stroke:t.externalStroke};
  case 'input':return {fill:t.store,stroke:t.soft};
  case 'optional':return {fill:t.wash,stroke:t.optionalStroke,dash:'4,3'};
  default:return {fill:t.backend,stroke:t.ink};
 }
}
export const KIND_TAG:Record<ProjectNode['kind'],string>={source:'SRC',process:'PROC',storage:'STORE',model:'MODEL',report:'RPT',app:'APP',control:'CTRL',physics:'PHYS',function:'FN',table:'TABLE'};

/** Node box: opaque paper mask, styled box (rx 6), rectangular type tag, name (sans 600) and a mono sublabel. */
export function nodeBox(n:{id:string;attr?:string;x:number;y:number;w:number;h:number;name:string;sub?:string;tag:string;treatment:Treatment;opens?:boolean;title?:string},t:Tokens):string{
 const s=treatmentStyle(n.treatment,t),cx=n.x+n.w/2,tagW=Math.max(28,Math.ceil(monoWidth(n.tag,7,0.08)+10));
 const name=sansLines(n.name,n.w-20,12,2,true),sub=n.sub&&!(name.length>1&&n.h<68)?clipMono(n.sub,n.w-16,9):'';
 // The text block is centred in the area under the type tag, so a two-line name never touches the tag.
 const block=name.length*15+(sub?14:0)-4,areaTop=n.y+22,top=areaTop+Math.max(0,(n.y+n.h-6-areaTop-block)/2)+9;
 const tagStroke=n.treatment==='focal'?t.accent:t.soft;
 return `<g ${n.attr??'data-node-id'}="${xml(n.id)}"${n.opens?' data-opens="true"':''}>${n.title?`<title>${xml(n.title)}</title>`:''}`+
  `<rect x="${f(n.x)}" y="${f(n.y)}" width="${f(n.w)}" height="${f(n.h)}" rx="6" fill="${t.paper}"/>`+
  `<rect x="${f(n.x)}" y="${f(n.y)}" width="${f(n.w)}" height="${f(n.h)}" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"${s.dash?` stroke-dasharray="${s.dash}"`:''}/>`+
  `<rect x="${f(n.x+8)}" y="${f(n.y+6)}" width="${tagW}" height="12" rx="2" fill="none" stroke="${tagStroke}" stroke-opacity="0.6" stroke-width="0.8"/>`+
  txt(n.tag,n.x+8+tagW/2,n.y+15,{size:7,fill:tagStroke,font:MONO,anchor:'middle',tracking:0.08})+
  (n.opens?`<path d="M ${f(n.x+n.w-16)} ${f(n.y+8)} h 8 v 8" fill="none" stroke="${t.soft}" stroke-width="1"/><path d="M ${f(n.x+n.w-8)} ${f(n.y+8)} l -6 6" stroke="${t.soft}" stroke-width="1"/>`:'')+
  lines(name,cx,top,15,{size:12,fill:n.treatment==='focal'?t.ink:t.ink,weight:600,anchor:'middle'})+
  (sub?txt(sub,cx,top+(name.length-1)*15+15,{size:9,fill:t.muted,font:MONO,anchor:'middle'}):'')+'</g>';
}

/** Arrow label: uppercase mono on an opaque mask, never on its own stroke. */
export const labelText=(s:string)=>clipMono(s.toUpperCase().replace(/\s+/g,' ').trim(),14*8*0.62*1.06+1,8,0.06);
export function labelChip(s:string,cx:number,baseline:number,t:Tokens,anchor:'middle'|'start'='middle'):{svg:string;box:Box}{
 const w=Math.ceil(monoWidth(s,8,0.06))+8,x=anchor==='middle'?cx-w/2:cx-4,box={x,y:baseline-9,w,h:12};
 return {box,svg:`<rect x="${f(box.x)}" y="${f(box.y)}" width="${w}" height="12" rx="2" fill="${t.paper}"/>${txt(s,anchor==='middle'?cx:cx,baseline,{size:8,fill:t.soft,font:MONO,anchor,tracking:0.06})}`};
}

export type LegendItem={label:string;kind:'box';treatment:Treatment}|{label:string;kind:'swatch';fill:string}|{label:string;kind:'line';stroke:'muted'|'accent'|'link';dashed?:boolean};
/** Legend strip: a hairline above a single row (wrapping when needed) of samples with mono uppercase labels. */
export function legendStrip(items:LegendItem[],x:number,y:number,width:number,t:Tokens):{svg:string;height:number}{
 if(!items.length)return {svg:'',height:0};
 const out=[`<line x1="${f(x)}" y1="${f(y)}" x2="${f(x+width)}" y2="${f(y)}" stroke="${t.rule}" stroke-width="1"/>`,txt('LEGEND',x,y+22,{size:8,fill:t.soft,font:MONO,tracking:0.14})];
 let cx=x+72,cy=y+22;
 for(const it of items){
  const label=it.label.toUpperCase(),w=28+monoWidth(label,8,0.08)+20;
  if(cx+w>x+width){cx=x+72;cy+=20;}
  if(it.kind==='swatch')out.push(`<rect x="${f(cx)}" y="${f(cy-9)}" width="18" height="12" rx="2" fill="${it.fill}"/>`);
  else if(it.kind==='box'){const s=treatmentStyle(it.treatment,t);out.push(`<rect x="${f(cx)}" y="${f(cy-9)}" width="18" height="12" rx="3" fill="${s.fill}" stroke="${s.stroke}"${s.dash?` stroke-dasharray="${s.dash}"`:''}/>`);}
  else out.push(`<line x1="${f(cx)}" y1="${f(cy-3)}" x2="${f(cx+18)}" y2="${f(cy-3)}" stroke="${t[it.stroke]}" stroke-width="1.2"${it.dashed?' stroke-dasharray="5,4"':''}/>`);
  out.push(txt(label,cx+26,cy,{size:8,fill:t.muted,font:MONO,tracking:0.08}));cx+=w;
 }
 return {svg:out.join(''),height:cy-y+14};
}

/** Header: tracked mono eyebrow, serif title, one muted line of purpose. */
export function header(eyebrow:string,title:string,purpose:string,x:number,y:number,width:number,t:Tokens,editorial:boolean):{svg:string;height:number}{
 // The title is wrapped on the (wider) sans budget rather than clipped: a long view name stays whole inside the canvas.
 const size=editorial?34:26,ts=sansLines(title,width,size,3),tl=Math.round(size*1.15),extra=(ts.length-1)*tl,ps=sansLines(purpose,width,12,2);
 return {height:24+size+extra+8+ps.length*17+(editorial?8:0),svg:txt(clipMono(eyebrow.toUpperCase(),width,9,0.14),x,y+10,{size:9,fill:editorial?t.accent:t.soft,font:MONO,tracking:0.14})+
  lines(ts,x,y+18+size,tl,{size,fill:t.ink,font:SERIF})+lines(ps,x,y+18+size+extra+22,17,{size:12,fill:t.muted})};
}

/** Footer line: identity, revision vector, date and publication policy, in soft mono. */
export function footerLine(parts:string[],x:number,y:number,width:number,t:Tokens):string{
 return txt(clipMono(parts.filter(Boolean).join(' · '),width,8,0.04),x,y,{size:8,fill:t.soft,font:MONO,tracking:0.04});
}

export function svgDocument(o:{slug:string;width:number;height:number;title:string;desc:string;t:Tokens;theme:DesignTheme;type:string;viewId:string;defs:string;body:string}):string{
 const w=Math.ceil(o.width),h=Math.ceil(o.height);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${o.slug}-title ${o.slug}-desc" data-style="design" data-design-type="${xml(o.type)}" data-theme="${o.theme}" data-view-id="${xml(o.viewId)}">`+
  `<title id="${o.slug}-title">${xml(o.title)}</title><desc id="${o.slug}-desc">${xml(o.desc)}</desc><defs>${o.defs}</defs>`+
  `<rect width="100%" height="100%" fill="${o.t.paper}"/><g font-family="${SANS}">${o.body}</g></svg>`;
}

export const overlaps=(a:Box,b:Box,pad=0)=>a.x<b.x+b.w+pad&&b.x<a.x+a.w+pad&&a.y<b.y+b.h+pad&&b.y<a.y+a.h+pad;
export const slugOf=(s:string)=>`dd-${s.replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,40)}`;
