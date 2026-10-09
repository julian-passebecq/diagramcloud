import {publicDocument,positionFor} from '../core/operations';
import {parseDocument,type Project,type ProjectView} from '../core/model';
import {SCENE_FONT,buildScene,sceneBounds,svgPolylinePath,type SceneText} from './scene';
import {noIcons,type IconData} from './iconData';
import type {IconEntry} from '../core/icons';
import {glyphSvg} from '../core/iconGlyph';
import {assetFidelity} from './assetFidelity';
import {CLAIM_LABEL,REALIZATION_EXPORT_NOTE,presentedObservation} from '../core/realization';
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
  const icon=n.customIcon?`<image href="${xml(n.customIcon.asset.data)}" x="${n.customIcon.x}" y="${n.customIcon.y}" width="${n.customIcon.size}" height="${n.customIcon.size}" preserveAspectRatio="xMidYMid meet"><title>${xml(n.customIcon.asset.name+' · '+n.customIcon.asset.rights)}</title></image>`:n.icon&&data?`<image href="${xml(data)}" x="${n.icon.x}" y="${n.icon.y}" width="${n.icon.size}" height="${n.icon.size}" preserveAspectRatio="xMidYMid meet"><title>${xml(`${n.icon.entry.label} · ${n.icon.entry.vendor} artwork`)}</title></image>`:n.genericIcon?`<svg x="${n.genericIcon.x}" y="${n.genericIcon.y}" width="${n.genericIcon.size}" height="${n.genericIcon.size}" viewBox="0 0 24 24" fill="none" stroke="#52647a" stroke-width="1.55"><title>${xml(n.genericIcon.glyph.label+' · original DiagramCloud MIT artwork')}</title>${glyphSvg(n.genericIcon.glyph)}</svg>`:'';
  return `<g data-node-id="${xml(n.id)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="#ffffff" stroke="#cbd5e1"/><rect x="${n.x}" y="${n.y+12}" width="4" height="28" rx="2" fill="#2563eb"/>${icon}${svgText(n.provider)}${svgText(n.label)}${svgText(n.summary)}${svgText(n.footer)}${n.realization?`<g data-realization="${xml(n.realization.claim)}"><title>${xml(n.realization.title)}</title><rect x="${n.realization.x}" y="${n.realization.y}" width="${n.realization.w}" height="${n.realization.h}" rx="4" fill="#${n.realization.fill}" stroke="#${n.realization.stroke}"/>${svgText(n.realization.text)}</g>`:''}</g>`;
 }).join('');
 const fidelity=assetFidelity(d,v.id,'classic',icons),credit=iconCredit(embedded),notes=['Static explanatory view · No live telemetry · Details retained in DiagramCloud metadata',...(scene.nodes.some(n=>n.realization)?[REALIZATION_EXPORT_NOTE]:[]),...(scene.nodes.some(n=>n.customIcon)?['Project artwork: embedded with recorded rights; aspect ratio preserved.']:[]),...(fidelity.entries.some(e=>e.origin==='vendor'&&e.rendered==='semantic-symbol')?['Unavailable registry artwork: original semantic symbols used. See artwork fidelity metadata.']:[]),...(credit?[credit]:[])];
 const footY=b.height+offsetY+16,height=b.height+offsetY+18+14*notes.length;
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${height}" viewBox="0 0 ${b.width} ${height}" role="img" aria-label="${xml(v.title)}"><title>${xml(v.title)}</title><metadata id="diagramcloud-asset-fidelity">${xml(JSON.stringify(fidelity))}</metadata>${metadata?`<metadata id="diagramcloud-document">${xml(JSON.stringify(d))}</metadata>`:''}<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6d7f96"/></marker></defs><rect width="100%" height="100%" fill="#f8fafc"/><g font-family="${SCENE_FONT}, Helvetica, 'Liberation Sans', sans-serif"><text x="30" y="30" fill="#64748b" font-size="11">DIAGRAMCLOUD / ${xml(d.category.toUpperCase())}</text><text x="30" y="59" fill="#16263d" font-size="20" font-weight="600">${xml(v.title.slice(0,75))}</text><g transform="translate(${-b.x},${offsetY-b.y})">${lines}${boxes}${labels}</g>${notes.map((t,i)=>`<text x="30" y="${footY+14*i}" fill="#64748b" font-size="10">${xml(t)}</text>`).join('')}</g></svg>`;
}
/** Only our own metadata is a diagram document; arbitrary SVG is not a graph import. */
export function documentFromSvg(raw:string):Project{
 if(new TextEncoder().encode(raw).length>16*1024*1024)throw new Error('SVG exceeds 16 MiB');
 const match=raw.match(/<metadata\s+id=["']diagramcloud-document["']\s*>([\s\S]*?)<\/metadata>/i);
 if(!match)throw new Error('No DiagramCloud metadata. Import this SVG as an image instead.');
 const decoded=match[1].replace(/&(amp|lt|gt|quot|apos);/g,(_,key:string)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]!));
 return parseDocument(decoded);
}
export function mermaidDiagram(input:Project,viewId=input.rootViewId):string{const d=publicDocument(input),v=d.views.find(v=>v.id===viewId)??d.views[0],ids=new Map(v.nodeIds.map((id,i)=>[id,`n${i}`]));const observed=d.nodes.filter(n=>v.nodeIds.includes(n.id)).flatMap(n=>{const o=presentedObservation(d,n.id);return o?[{n,o}]:[];});const comment=(s:string)=>s.replace(/[\r\n]+/g,' ');const label=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/\|/g,'&#124;').replace(/[\r\n]/g,' ').replace(/</g,'&lt;').replace(/>/g,'&gt;');return['flowchart LR','  %% DiagramCloud: current view only; evidence and hierarchy remain in JSON.',...d.nodes.filter(n=>v.nodeIds.includes(n.id)).map(n=>`  ${ids.get(n.id)}["${label(n.label)}"]`),...d.edges.filter(e=>v.edgeIds.includes(e.id)).map(e=>`  ${ids.get(e.source)} -->|"${label(e.label)}"| ${ids.get(e.target)}`),...(observed.length?['  %% Realization: reviewed, public observations owned by other apps. Unclassed nodes are planned / designed only.',...observed.map(({n,o})=>`  %% ${ids.get(n.id)} ${comment(CLAIM_LABEL[o.claim])} by ${comment(o.sourceApp)} @ ${comment(o.sourceRevision)} (${o.observedAt.slice(0,10)})`),...[...new Set(observed.map(x=>x.o.claim))].map(c=>`  classDef ${c.replace('-','_')} stroke-width:3px,stroke-dasharray:${c==='verified'||c==='observed'?'0':'4 3'}`),...observed.map(({n,o})=>`  class ${ids.get(n.id)} ${o.claim.replace('-','_')}`)]:[])].join('\n');}
