import {validateDocument, type Project, type EvidenceBlock} from '../core/model';
import {publicDocument} from '../core/operations';
import {overviewProjection} from './projectOverview';
import {validatePublicationBrief, type PublicationBrief} from '../intelligence/publicationBrief';
import {publicationPages, scopePublicationSvg} from './publicationPages';
import {designSvg} from './design';
import {xml} from './diagram';

/** Meeting-summary limits. A brief beyond them is refused; the full native handbook covers the rest. */
export const MEETING_SUMMARY_LIMITS = {views: 6, titleLength: 160, audienceLength: 160} as const;
export const MEETING_SUMMARY_PROFILES = ['design', 'business'] as const;
export const MEETING_SUMMARY_DETAILS = ['overview', 'standard', 'full'] as const;
export const MEETING_SUMMARY_PAPERS = ['A4', 'letter'] as const;
/** Shown wherever a meeting summary is offered: what browser print gives, and what it is not. */
export const MEETING_SUMMARY_FIDELITY_NOTE = 'Browser print gives the PDF. The PDF is a snapshot, not a backup: keep the Project JSON as the editable model. No PPTX is produced here.';

const paragraph = (value: string) => `<p>${xml(value)}</p>`;

function table(columns: string[], rows: (string | number | boolean | null)[][]) {
  const head = columns.map(c => `<th>${xml(c)}</th>`).join('');
  const body = rows.map(r => `<tr>${r.map(v => `<td>${xml(v === null ? 'NULL / not supplied' : String(v))}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function evidence(b: EvidenceBlock): string {
  // A synthetic block keeps a visible label in every format; it is never presented as a measured result.
  const synthetic = b.provenance === 'synthetic' ? '<strong class="synthetic">Synthetic example data, not a measured result.</strong> ' : '';
  const head = `<section class="evidence" id="block-${xml(b.id)}" tabindex="-1"><h3>${xml(b.title)}</h3><small>${synthetic}Basis: ${xml(b.provenance)}${b.transform ? ' / ' + xml(b.transform) : ''}</small>`;
  const body =
    b.type === 'text' ? paragraph(b.text)
    : b.type === 'code' ? `<pre>${xml(b.code)}</pre>`
    : b.type === 'table' ? table(b.columns, b.rows)
    : b.type === 'metrics' ? table(['Metric', 'Supplied value', 'Note'], b.items.map(i => [i.label, i.value, i.note]))
    : b.type === 'schedule' ? table(['Item', 'Start', 'End / duration', 'Basis'], b.items.map(i => [i.label, i.start, i.end ?? i.duration ?? 'Unknown', i.basis]))
    : paragraph('Image pixels are not embedded by this summary recipe. The source document retains the selected asset and rights record.');
  return head + body + '</section>';
}

/** Public views reachable from the public root by explicit childViewId drilldown, in discovery order. */
function reachablePublicViews(safe: Project) {
  const order: string[] = [], queue = [safe.rootViewId];
  while (queue.length) {
    const id = queue.shift()!;
    const view = safe.views.find(v => v.id === id);
    if (!view || order.includes(id)) continue;
    order.push(id);
    for (const nodeId of view.nodeIds) {
      const child = safe.nodes.find(n => n.id === nodeId)?.childViewId;
      if (child && !order.includes(child)) queue.push(child);
    }
  }
  return order.map(id => safe.views.find(v => v.id === id)!);
}

/** What a meeting brief may select: public reachable views only (through publicDocument), and the public story length. */
export function meetingBriefChoices(project: Project): {views: {id: string; title: string}[]; storyCount: number; profiles: readonly ['design', 'business']} {
  const safe = publicDocument(validateDocument(project));
  return {views: reachablePublicViews(safe).map(v => ({id: v.id, title: v.title})), storyCount: safe.story.length, profiles: MEETING_SUMMARY_PROFILES};
}

/** Concise publication recipe over existing Project and PublicationBrief contracts.
 * Read-only HTML with internal glossary links and A4 or letter print CSS. It never executes code,
 * calls a provider, implies lossless PDF/PPTX interactivity, or changes the source document.
 * Public captions backed by private sources are suppressed by the existing overview projection.
 * A private and an unknown view are refused with the same reason.
 */
export function meetingSummaryHtml(input: Project, briefInput: PublicationBrief, options: {now?: Date} = {}): string {
  const p = overviewProjection(validateDocument(input), true), brief = validatePublicationBrief(briefInput, p);
  if (brief.viewIds.length > MEETING_SUMMARY_LIMITS.views) throw new Error('Meeting summary supports at most six selected views; use the full native handbook for more.');
  if (!(MEETING_SUMMARY_PROFILES as readonly string[]).includes(brief.profile)) throw new Error('Meeting summary supports design or business profiles; use the native full publication for other profiles.');
  const paper = brief.paper === 'letter' ? 'letter' : 'A4';
  const views = brief.viewIds.map(id => p.views.find(v => v.id === id)!);
  const nodes = [...new Set(views.flatMap(v => v.nodeIds))].map(id => p.nodes.find(n => n.id === id)!);
  const blockIds = new Set(nodes.flatMap(n => n.blockIds));
  const blocks = p.blocks.filter(b => blockIds.has(b.id));
  const sourceIds = new Set([...nodes.flatMap(n => n.sourceIds), ...blocks.flatMap(b => b.sourceIds)]);
  const sources = p.sources.filter(s => sourceIds.has(s.id));
  const highlights = nodes.filter(n => !n.childViewId).slice(0, 6);
  const selectedStory = brief.storyIndices.map(i => p.story[i]);

  const viewPages = views.map((v, index) => {
    const plan = publicationPages(p, v.id, brief.viewIds, {paper: brief.paper, profile: 'design'});
    const members = v.nodeIds.map(id => p.nodes.find(n => n.id === id)!);
    // Do not reduce an unreadable poster until its primary labels disappear.
    const figure = brief.profile === 'business' ? ''
      : plan.dense ? paragraph('This view exceeds the readable summary budget. The full handbook supplies paginated figures; the complete selected component list is below.')
      : `<div class="figure">${scopePublicationSvg(designSvg(p, v.id, {type: v.design?.type ?? 'architecture', theme: 'light', now: options.now ?? new Date()}), 'meeting-' + index)}</div>`;
    const component = (n: Project['nodes'][number]) => {
      const links = brief.detail !== 'overview' && n.blockIds.length
        ? `<p>${n.blockIds.filter(id => blockIds.has(id)).map(id => `<a href="#block-${xml(id)}">${xml(p.blocks.find(b => b.id === id)?.title ?? id)}</a>`).join(' / ')}</p>`
        : '';
      return `<article id="node-${index}-${xml(n.id)}"><h3>${xml(n.label)}</h3>${paragraph(n.summary || 'Meaning not supplied.')}<small>Source basis: ${xml(n.basis ?? 'unknown')}. Design status: ${xml(n.status)}; not runtime evidence.</small>${links}</article>`;
    };
    const grid = brief.detail === 'overview' && !plan.dense ? '' : `<div class="component-grid">${members.map(component).join('')}</div>`;
    return `<section class="view-page" id="view-${xml(v.id)}" tabindex="-1"><small>SELECTED VIEW ${index + 1} / ${views.length}</small><h2>${xml(v.title)}</h2>${paragraph(v.description ?? '')}${figure}${grid}</section>`;
  }).join('');

  const style = `
*{box-sizing:border-box}body{margin:0;background:#edf1f4;color:#182a3a;font:15px/1.5 system-ui,sans-serif}main{max-width:1000px;margin:24px auto;padding:32px;background:#fff}h1{font-size:32px;line-height:1.15;margin:10px 0 16px}h2{font-size:23px;line-height:1.2}h3{font-size:16px;line-height:1.3;margin:8px 0}p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}small{color:#526272}a{color:#1954a0;overflow-wrap:anywhere}nav{padding:12px 0;border-block:1px solid #c4d0da}nav a{display:inline-block;margin:5px 16px 5px 0}.intro{border-left:4px solid #246ab6;padding-left:16px;margin:20px 0}.view-page{margin:24px 0}.figure{margin:16px 0;max-width:100%;}.figure>svg{max-width:100%;height:auto;display:block}.component-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.component-grid article{border-top:1px solid #c9d4de;padding:8px 0}table{border-collapse:collapse;width:100%;table-layout:auto}th,td{padding:9px 10px;border-bottom:1px solid #cbd5de;text-align:left;vertical-align:middle;overflow-wrap:anywhere}th{background:#edf3f8}thead{display:table-header-group}.table-wrap{overflow:auto}pre{padding:16px;background:#eff4f8;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.evidence{margin:20px 0}.synthetic{color:#7a4a00}footer{font-size:12px;border-top:1px solid #b8c7d3;padding-top:12px;margin-top:24px}.sources li{margin:9px 0}a:focus-visible,[tabindex="-1"]:focus{outline:3px solid #165da8;outline-offset:3px}@media(max-width:650px){main{padding:18px;margin:0}.component-grid{grid-template-columns:1fr}h1{font-size:26px}.table-wrap{max-width:100%}}@page{size:${paper};margin:14mm}@media print{body{background:#fff;font-size:10pt;line-height:1.4}main{margin:0;padding:0;max-width:none}h1{font-size:23pt}h2{font-size:16pt}h3{font-size:11pt}nav{font-size:9pt}.figure{break-inside:avoid}.view-page{break-before:page;margin:0}.component-grid{gap:10px}article{break-inside:avoid}.table-wrap{overflow:visible}pre{font-size:8pt}th,td{padding:5px 6px}h2,h3{break-after:avoid}.sources{font-size:9pt}footer{font-size:8pt}}
`;
  const glossary = `<nav aria-label="Summary glossary">${views.map(v => `<a href="#view-${xml(v.id)}">${xml(v.title)}</a>`).join('')}<a href="#sources">Sources and limits</a></nav>`;
  const story = selectedStory.length ? `<section><h2>Prepared talking points</h2>${selectedStory.map(s => `<h3>${xml(s.title)}</h3>${paragraph(s.narration)}`).join('')}</section>` : '';
  const findings = `<section><h2>Key findings and decisions</h2><div class="component-grid">${highlights.map(n => `<article><h3>${xml(n.label)}</h3>${paragraph(n.summary || 'Interpretation not supplied.')}</article>`).join('')}</div></section>`;
  const readingLimit = `<section class="reading-limit"><h3>Reading this brief</h3>${paragraph(brief.detail === 'overview' ? 'Overview: selected findings and diagram only. Evidence bodies remain in the companion Project or full handbook.' : 'Selected evidence is included below. Displayed code is not executed.')}${paragraph('Scope and provenance are supplied above. This summary is not a new approval or runtime result. PDF retains pages, not live pane interactions.')}</section>`;
  const evidencePage = brief.detail === 'overview' ? '' : `<section class="view-page"><h2>Selected supporting evidence</h2>${blocks.map(evidence).join('') || paragraph('No public evidence attached.')}</section>`;
  const sourceList = `<section id="sources" tabindex="-1"><h2>Sources and limits</h2><ul class="sources">${sources.map(s => `<li><strong>${xml(s.title)}</strong>${paragraph(s.location)}${s.url ? `<a href="${xml(s.url)}" rel="noopener noreferrer">Open source</a>` : ''}</li>`).join('') || '<li>No public sources attached to these views.</li>'}</ul></section>`;
  const footer = `<footer>Selected views: ${views.length}. Public content only. DiagramCloud Project JSON retains the editable model; summary HTML/PDF is a publication, not a backup. Static reading: no live refresh, provider requests or animation.</footer>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${xml(brief.title)}</title><style>${style}</style></head><body><main><header><small>DIAGRAMCLOUD / MEETING SUMMARY / READ-ONLY PUBLIC CUT</small><h1>${xml(brief.title)}</h1><p>Audience: ${xml(brief.audience)} / Project: ${xml(p.id)} / Revision: ${p.revision}</p></header><div class="intro"><h2>Question and scope</h2>${paragraph(p.summary || 'Question not supplied.')}${paragraph(p.provenance || 'Provenance not supplied.')}</div>${glossary}${story}${findings}${readingLimit}${viewPages}${evidencePage}${sourceList}${footer}</main></body></html>`;
}

/** The meeting summary as a file: `<project id>.meeting-summary.html`, public projection applied inside. */
export function meetingSummaryFile(project: Project, brief: PublicationBrief, now?: Date): {fileName: string; html: string} {
  const html = meetingSummaryHtml(project, brief, now ? {now} : {});
  return {fileName: `${project.id}.meeting-summary.html`, html};
}
