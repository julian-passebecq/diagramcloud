import {publicDocument,positionFor} from '../core/operations';
import {parseDocument,type Project,type ProjectView} from '../core/model';
import {SCENE_FONT,buildScene,sceneBounds,svgPolylinePath,type SceneText} from './scene';
import {noIcons,type IconData} from './iconData';
import type {IconEntry} from '../core/icons';
export const xml=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function bounds(view:ProjectView){return sceneBounds(view.nodeIds.map(id=>positionFor(view,id)));}
/** SVG text for a scene text block: one tspan per measured line, so no renderer re-wraps it. */
export function svgText(t:SceneText,extra=''):string{
 if(!t.lines.length)return '';
 return `<text x="${t.x}" y="${t.y}" font-size="${t.size}"${t.bold?' font-weight="700"':''} fill="#${t.color}"${t.anchor==='middle'?' text-anchor="middle"':''}${extra}>${t.lines.map((l,i)=>`<tspan x="${t.x}"${i?` dy="${t.lineHeight}"`:''}>${xml(l)}</tspan>`).join('')}</text>`;
}
/** Attribution for vendor icons embedded in an export. */
export function iconCredit(entries:IconEntry[]):string{
 return entries.length?`Icons: ${entries.map(e=>`${e.label} (${e.vendor} artwork, ${e.terms?.name})`).join('; ')}. Not covered by the DiagramCloud MIT licence.`:'';
}
export function svgDiagram(input:Project,viewId=input.rootViewId,metadata=true,icons:IconData=noIcons):string{
 const d=publicDocument(input),v=d.views.find(v=>v.id===viewId)??d.views.find(v=>v.id===d.rootViewId)!,scene=buildScene(d,v),b=scene.bounds,offsetY=86;
 // Lines, then boxes, then connection labels on a background halo: a label is never hidden under a box or a line.
 const lines=scene.edges.map(e=>`<path d="${svgPolylinePath(e.points)}" fill="none" stroke="#6d7f96" stroke-width="2" ${e.dashed?'stroke-dasharray="5 5"':''} marker-end="url(#arrow)"/>`).join('');
 const labels=scene.edges.map(e=>e.label?svgText(e.label,' paint-order="stroke" stroke="#f8fafc" stroke-width="4" stroke-linejoin="round"'):'').join('');
 const embedded:IconEntry[]=[];
 const boxes=scene.nodes.map(n=>{
  const data=n.icon?icons(n.icon.entry):undefined;if(n.icon&&data&&!embedded.includes(n.icon.entry))embedded.push(n.icon.entry);
  const icon=n.icon&&data?`<image href="${xml(data)}" x="${n.icon.x}" y="${n.icon.y}" width="${n.icon.size}" height="${n.icon.size}" preserveAspectRatio="xMidYMid meet"><title>${xml(`${n.icon.entry.label} · ${n.icon.entry.vendor} artwork`)}</title></image>`:'';
  return `<g data-node-id="${xml(n.id)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="#ffffff" stroke="#cbd5e1"/><rect x="${n.x}" y="${n.y+12}" width="4" height="28" rx="2" fill="#2563eb"/>${icon}${svgText(n.provider)}${svgText(n.label)}${svgText(n.summary)}${svgText(n.footer)}</g>`;
 }).join('');
 const credit=iconCredit(embedded),footY=b.height+offsetY+16,height=b.height+offsetY+(credit?46:32);
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${height}" viewBox="0 0 ${b.width} ${height}" role="img" aria-label="${xml(v.title)}"><title>${xml(v.title)}</title>${metadata?`<metadata id="diagramcloud-document">${xml(JSON.stringify(d))}</metadata>`:''}<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6d7f96"/></marker></defs><rect width="100%" height="100%" fill="#f8fafc"/><g font-family="${SCENE_FONT}, Helvetica, 'Liberation Sans', sans-serif"><text x="30" y="30" fill="#64748b" font-size="11">DIAGRAMCLOUD / ${xml(d.category.toUpperCase())}</text><text x="30" y="59" fill="#16263d" font-size="20" font-weight="600">${xml(v.title.slice(0,75))}</text><g transform="translate(${-b.x},${offsetY-b.y})">${lines}${boxes}${labels}</g><text x="30" y="${footY}" fill="#64748b" font-size="10">Static explanatory view · No live telemetry · Details retained in DiagramCloud metadata</text>${credit?`<text x="30" y="${footY+14}" fill="#64748b" font-size="10">${xml(credit)}</text>`:''}</g></svg>`;
}
/** Only our own metadata is a diagram document; arbitrary SVG is not a graph import. */
export function documentFromSvg(raw:string):Project{
 if(new TextEncoder().encode(raw).length>16*1024*1024)throw new Error('SVG exceeds 16 MiB');
 const match=raw.match(/<metadata\s+id=["']diagramcloud-document["']\s*>([\s\S]*?)<\/metadata>/i);
 if(!match)throw new Error('No DiagramCloud metadata. Import this SVG as an image instead.');
 const decoded=match[1].replace(/&(amp|lt|gt|quot|apos);/g,(_,key:string)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]!));
 return parseDocument(decoded);
}
export function mermaidDiagram(input:Project,viewId=input.rootViewId):string{const d=publicDocument(input),v=d.views.find(v=>v.id===viewId)??d.views[0],ids=new Map(v.nodeIds.map((id,i)=>[id,`n${i}`]));const label=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/\|/g,'&#124;').replace(/[\r\n]/g,' ').replace(/</g,'&lt;').replace(/>/g,'&gt;');return['flowchart LR','  %% DiagramCloud: current view only; evidence and hierarchy remain in JSON.',...d.nodes.filter(n=>v.nodeIds.includes(n.id)).map(n=>`  ${ids.get(n.id)}["${label(n.label)}"]`),...d.edges.filter(e=>v.edgeIds.includes(e.id)).map(e=>`  ${ids.get(e.source)} -->|"${label(e.label)}"| ${ids.get(e.target)}`)].join('\n');}
