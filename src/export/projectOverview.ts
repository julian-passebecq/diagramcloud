import {clone, type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {projectReadiness} from '../intelligence/readiness';

/** Public facts first; captions backed by a private source are not public context. */
export function overviewProjection(input: Project, publicMode = false): Project {
  if (!publicMode) return input;
  const safe = clone(input), privateSources = new Set(input.sources.filter(s => s.visibility !== 'public').map(s => s.id));
  safe.nodes.forEach(n => {if(n.sourceIds.some(id => privateSources.has(id))) {n.summary = ''; n.role = '';}});
  safe.blocks = safe.blocks.map(b => b.sourceIds.some(id => privateSources.has(id)) ? {...b, visibility: 'private'} : b);
  return publicDocument(safe);
}
export function overviewFacts(input: Project, publicMode = false) {
  const project = overviewProjection(input, publicMode), root = project.views.find(v => v.id === project.rootViewId)!;
  const nodes = root.nodeIds.map(id => project.nodes.find(n => n.id === id)!).filter(n => n && !n.tags.includes('Navigation'));
  const components = (nodes.length ? nodes : project.nodes).slice(0, 5);
  return {project, components, omitted: Math.max(0, nodes.length - components.length), report: projectReadiness(project, {purpose: 'project'})};
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
/** Semantic, self-contained public business sheet; no scripts or remote assets. */
export function projectOverviewHtml(input: Project): string {
  const {project: p, components, omitted, report} = overviewFacts(input, true);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} · Project Overview</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#182b40;background:#f2f5f8;margin:0}main{max-width:960px;margin:32px auto;padding:36px;background:white;border-radius:16px}h1{font-size:36px;line-height:1.2}h2{margin-top:32px}article{border-top:1px solid #dce3ec;padding:16px 0}small{color:#526579}li{margin:8px 0}code{overflow-wrap:anywhere}@media(max-width:600px){main{margin:0;padding:20px}h1{font-size:28px}}@media print{body{background:white}main{margin:0}}</style></head><body><main><small>DiagramCloud · Public Project Overview · revision ${p.revision}</small><h1>${esc(p.title)}</h1><h2>Purpose and scope</h2><p>${esc(p.summary || 'Purpose has not been supplied.')}</p><h2>Steps and components</h2>${components.map((n,i) => `<article><h3>${i+1}. ${esc(n.label)}</h3><p>${esc(n.summary || 'Contribution and scope not supplied.')}</p><p>Stated role / owner: ${esc(n.role || 'Unknown')}</p><small>Basis: ${esc(n.basis || 'unknown')}. Designed status: ${esc(n.status)}; not an observed deployment.</small></article>`).join('') || '<p>No public components selected. Review publication visibility in Edit mode.</p>'}${omitted ? `<p>${omitted} additional public components remain in the diagram.</p>` : ''}<h2>Evidence and provenance</h2><p>${esc(p.provenance || 'Provenance not supplied.')}</p><ul>${p.blocks.map(b => `<li>${esc(b.title)} — ${esc(b.provenance)}</li>`).join('') || '<li>No public evidence attached.</li>'}</ul><ul>${p.sources.map(s => `<li>${esc(s.title)} — <code>${esc(s.location)}</code></li>`).join('')}</ul><h2>Caveats</h2><ul>${report.gaps.map(g => `<li>${esc(g.title)}: ${esc(g.reason)} ${esc(g.resolution)}</li>`).join('')}<li>Declared and static-source facts do not establish runtime outcomes. Synthetic evidence remains synthetic.</li><li>Only the public projection is included. Missing private context does not establish absence.</li></ul></main></body></html>`;
}
