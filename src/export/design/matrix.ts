import type {Project} from '../../core/model';
import type {SpecNode} from '../../core/viewspec';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {clipMono,f,footerLine,header,legendStrip,markers,monoWidth,MONO,svgDocument,txt,type LegendItem} from './kit';
import {xml} from '../diagram';

const M=48;
/** Columns: how a component is known (its basis), in reading order; only the ones that occur are drawn. */
export const MATRIX_BASES:{id:SpecNode['basis'];name:string}[]=[{id:'static-source',name:'Read from source'},{id:'planned',name:'Planned'},{id:'unknown',name:'Declared, not read'},{id:'unspecified',name:'Not stated'}];
/** Rows: the confidence a scan or author attached to the component; every row is drawn, so an empty one is visible. */
export const MATRIX_CONFIDENCES:{id:string;name:string}[]=[{id:'confirmed',name:'Confirmed'},{id:'inferred',name:'Inferred'},{id:'possible',name:'Possible'},{id:'none',name:'No confidence'}];
export const matrixCell=(n:SpecNode)=>`${n.basis}|${n.confidence??'none'}`;

/**
 * Evidence matrix: the view's components placed by basis (columns) and confidence (rows), as chips counted per cell.
 * It shows how much of the view is backed by source; it adds no score, only the document's own basis and confidence.
 */
export function matrixSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'matrix',options),{spec,t}=c,contentW=880,ns=spec.nodes;
 const cols=MATRIX_BASES.filter(b=>ns.some(n=>n.basis===b.id)),read=ns.filter(n=>n.basis==='static-source').length,stated=ns.filter(n=>n.confidence).length;
 const hdr=header(eyebrowOf(c,'Evidence matrix'),ns.length?`${read} of ${ns.length} component${ns.length===1?'':'s'} read from source`:'No public components',
  `${spec.title}: how much of this view is backed by source. Columns are the basis, rows the stated confidence${stated?'':' (none is stated on this view)'}.`,M,M,contentW,t,c.editorial);
 const rowHead=136,colHead=40,cw=cols.length?Math.min(372,Math.floor((contentW-rowHead)/cols.length/4)*4):0,gridW=rowHead+cw*cols.length,top=M+hdr.height+28,chipH=16,pad=12;
 // Chip placement per cell: left-to-right wrapping under the corner count; heights decide each row's height.
 const place=(cell:SpecNode[])=>{let x=0,y=0;return cell.map(n=>{const label=clipMono(n.label,cw-2*pad-14,8,0.04),w=Math.ceil(monoWidth(label,8,0.04))+14;
  if(x&&x+w>cw-2*pad){x=0;y+=chipH+6;}const p={n,label,x,y,w};x+=w+6;return p;});};
 const cells=MATRIX_CONFIDENCES.map(r=>cols.map(b=>place(ns.filter(n=>n.basis===b.id&&(n.confidence??'none')===r.id))));
 const rowH=cells.map(row=>Math.max(44,...row.map(ch=>ch.length?Math.ceil((28+Math.max(...ch.map(p=>p.y))+chipH+pad)/4)*4:0)));
 const out:string[]=[];let y=top+colHead;
 cols.forEach((b,j)=>{const x=M+rowHead+j*cw,k=ns.filter(n=>n.basis===b.id).length;
  out.push(`<g data-basis="${b.id}">`,txt(clipMono(b.name.toUpperCase(),cw-48,8,0.12),x+pad,top+18,{size:8,fill:t.muted,font:MONO,tracking:0.12}),
   txt(String(k),x+cw-pad,top+18,{size:8,fill:t.soft,font:MONO,anchor:'end'}),`<line x1="${x+pad}" y1="${top+28}" x2="${x+cw-pad}" y2="${top+28}" stroke="${b.id==='static-source'?t.ink:t.ruleSolid}" stroke-width="${b.id==='static-source'?1.2:1}"/></g>`);});
 MATRIX_CONFIDENCES.forEach((r,i)=>{const h=rowH[i],k=ns.filter(n=>(n.confidence??'none')===r.id).length;
  out.push(`<g data-row="${r.id}">`,txt(r.name.toUpperCase(),M,y+22,{size:8,fill:k?t.muted:t.soft,font:MONO,tracking:0.12}),txt(`${k} component${k===1?'':'s'}`,M,y+36,{size:9,fill:t.soft,font:MONO}));
  cols.forEach((b,j)=>{const x=M+rowHead+j*cw,ch=cells[i][j];
   out.push(`<g data-cell="${xml(`${b.id}|${r.id}`)}" data-count="${ch.length}"><rect x="${x+4}" y="${y+4}" width="${cw-8}" height="${h-8}" rx="4" fill="${ch.length?t.backend:t.wash}" stroke="${t.rule}" stroke-width="1"/>`,
    txt(ch.length?String(ch.length):'—',x+cw-pad,y+20,{size:8,fill:ch.length?t.muted:t.soft,font:MONO,anchor:'end'}));
   for(const p of ch){const fc=c.focal.has(p.n.id),cx=x+pad+p.x,cy=y+28+p.y;
    out.push(`<g data-node-id="${xml(p.n.id)}"${fc?' data-focal="true"':''}><title>${xml(`${p.n.label} · ${p.n.kind} · basis ${p.n.basis} · confidence ${p.n.confidence??'not stated'}`)}</title>`+
     `<rect x="${f(cx)}" y="${f(cy)}" width="${p.w}" height="${chipH}" rx="2" fill="${fc?t.accentTint:t.paper}" stroke="${fc?t.accent:t.ruleSolid}" stroke-width="1"${p.n.basis==='unknown'?' stroke-dasharray="4,3"':''}/>`+
     txt(p.label,cx+7,cy+11,{size:8,fill:fc?t.ink:t.muted,font:MONO,tracking:0.04})+'</g>');}
   out.push('</g>');});
  out.push('</g>');y+=h;});
 if(!cols.length)out.push(txt('This view has no public component to place.',M,top+20,{size:11,fill:t.muted,italic:true}));
 const bottom=y;
 const items:LegendItem[]=[...(ns.some(n=>c.focal.has(n.id))?[{kind:'swatch' as const,fill:t.accent,label:c.focalReason==='auto'?'Focal · most connected':'Focal'}]:[]),{kind:'swatch',fill:t.ruleSolid,label:'Component'},
  ...(ns.some(n=>n.basis==='unknown')?[{kind:'box' as const,treatment:'optional' as const,label:'Declared, not read'}]:[])];
 const legend=legendStrip(items,M,bottom+28,contentW,t);
 let fy=bottom+28+legend.height+12;const cards=c.editorial?summaryCards(c,M,fy+8,contentW):undefined;if(cards)fy+=cards.height+24;
 const counts=cols.map(b=>`${b.name.toLowerCase()} ${ns.filter(n=>n.basis===b.id).length}`).join(', ');
 return svgDocument({slug:c.slug,width:Math.max(contentW,gridW)+2*M,height:fy+12+M-12,title:`${spec.title} · evidence matrix`,
  desc:`Evidence matrix of the public view ${spec.viewId}: ${ns.length} components by basis (${counts||'none'}) and stated confidence (${stated} stated).`,
  t,theme:c.theme,type:'matrix',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,fy+12,contentW,t)});
}
