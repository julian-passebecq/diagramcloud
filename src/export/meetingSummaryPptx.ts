import type PptxGenJS from 'pptxgenjs';
import type {EvidenceBlock, Project} from '../core/model';
import type {PublicationBrief} from '../intelligence/publicationBrief';
import {TRANSFORM_LABEL} from '../core/transform';
import {PUBLIC_OMISSION_NOTICE} from '../core/viewspec';
import {addArchitectureSlides} from './pptx';
import {noIcons, type IconData} from './iconData';
import {wrapLines} from './text';
import {meetingSummaryModel, MEETING_SUMMARY_FIDELITY_NOTE, type MeetingSummaryModel} from './meetingSummary';

type Pptx = InstanceType<typeof PptxGenJS>;
type Slide = ReturnType<Pptx['addSlide']>;

/** A meeting deck longer than this is refused; the full native handbook or the editable architecture deck covers more. */
export const MEETING_SUMMARY_MAX_SLIDES = 120;
/** Visible on every evidence slide whose block is synthetic, in the same words as the HTML summary. */
export const MEETING_SUMMARY_SYNTHETIC_LABEL = 'Synthetic example data, not a measured result.';
const FOOTER = 'DiagramCloud meeting summary · public content only · not a backup, approval or runtime result';
const COMPONENT_ROWS = 5, TABLE_ROWS = 12, TEXT_LINES = 18, CODE_LINES = 23, SOURCE_ROWS = 8, STORY_PER_SLIDE = 3;
const INK = '172C48', BODY = '243B58', MUTED = '536780', LABEL = '58718F', SYNTHETIC = '7A4A00', FONT = 'Aptos';
/** The deck's slides in order (pptxgenjs exposes them through an untyped `slides` getter). */
function deckSlides(pptx: Pptx): Slide[] {
  const slides = (pptx as unknown as {slides?: Slide[]}).slides;
  if (!Array.isArray(slides)) throw new Error('This PowerPoint library version does not list its slides; the meeting summary deck cannot place its notice.');
  return slides;
}

/** One planned slide. The plan is computed before any slide is drawn, so slide numbers and links are deterministic. */
export type MeetingSlide =
  | {kind: 'cover'}
  | {kind: 'contents'}
  | {kind: 'talking-points'; part: number; stepIndices: number[]}
  | {kind: 'findings'}
  | {kind: 'view'; viewId: string; figure: boolean}
  | {kind: 'components'; viewId: string; part: number; nodeIds: string[]}
  | {kind: 'evidence'; blockId: string; part: number; start: number}
  | {kind: 'sources'; part: number; start: number};

const table = (b: EvidenceBlock): {columns: string[]; rows: (string | number | boolean | null)[][]} | null =>
  b.type === 'table' ? {columns: b.columns, rows: b.rows}
  : b.type === 'metrics' ? {columns: ['Metric', 'Supplied value', 'Note'], rows: b.items.map(i => [i.label, i.value, i.note])}
  : b.type === 'schedule' ? {columns: ['Item', 'Start', 'End / duration', 'Basis'], rows: b.items.map(i => [i.label, i.start, i.end ?? i.duration ?? 'Unknown', i.basis])}
  : null;
const prose = (b: EvidenceBlock): string[] =>
  b.type === 'text' ? wrapLines(b.text, 95)
  : b.type === 'code' ? wrapLines(b.code, 95, true)
  : ['Image pixels are not embedded by this summary recipe. The source document retains the selected asset and rights record.'];
/** One line of at most `width * lines` characters, ellipsis when cut: PowerPoint wraps it inside its box, so no hard
 * line break lands in the middle of a table cell or paragraph. The full text stays in the speaker notes. */
const caption = (text: string, width: number, lines: number) => {const one = text.replace(/\s+/g, ' ').trim(), max = width * lines; return one.length <= max ? one : one.slice(0, max - 1).trimEnd() + '…';};
const chunks = (count: number, size: number) => Array.from({length: Math.max(1, Math.ceil(count / size))}, (_, k) => k * size);

/** The slide list of one meeting deck, in order. Slide numbers are the 1-based index into this list. */
export function planMeetingSummaryDeck(model: MeetingSummaryModel): MeetingSlide[] {
  const {brief, views, blocks, sources, story} = model, plan: MeetingSlide[] = [{kind: 'cover'}, {kind: 'contents'}];
  for (const [part, start] of (story.length ? chunks(story.length, STORY_PER_SLIDE) : []).entries()) plan.push({kind: 'talking-points', part, stepIndices: story.slice(start, start + STORY_PER_SLIDE).map((_, k) => start + k)});
  plan.push({kind: 'findings'});
  for (const v of views) {
    const dense = model.dense[v.id];
    plan.push({kind: 'view', viewId: v.id, figure: brief.profile === 'design' && !dense});
    // Same rule as the HTML grid: the component list appears unless the overview detail shows a readable figure only.
    if (brief.detail !== 'overview' || dense) for (const [part, start] of chunks(v.nodeIds.length, COMPONENT_ROWS).entries()) plan.push({kind: 'components', viewId: v.id, part, nodeIds: v.nodeIds.slice(start, start + COMPONENT_ROWS)});
  }
  if (brief.detail !== 'overview') for (const b of blocks) {
    const t = table(b), per = t ? TABLE_ROWS : b.type === 'code' ? CODE_LINES : TEXT_LINES;
    for (const [part, start] of chunks(t ? t.rows.length : prose(b).length, per).entries()) plan.push({kind: 'evidence', blockId: b.id, part, start});
  }
  for (const [part, start] of chunks(sources.length, SOURCE_ROWS).entries()) plan.push({kind: 'sources', part, start});
  if (plan.length > MEETING_SUMMARY_MAX_SLIDES) throw new Error(`This meeting summary would have ${plan.length} slides (limit ${MEETING_SUMMARY_MAX_SLIDES}). Choose fewer views or the overview detail; the full native handbook covers more.`);
  return plan;
}

/**
 * Meeting summary as an editable PowerPoint deck: native shapes, text and tables (no screenshots), built from the same
 * public model as the HTML summary (meetingSummaryModel), so the same views, glossary, sources and limits, the same
 * refusals and the same synthetic labels. Architecture figures reuse addArchitectureSlides on a copy of the public
 * projection that holds only the drawn view and the summary's own sources; box drilldown links are dropped there and
 * the contents slide links every selected view instead. It never changes the source document.
 */
export async function buildMeetingSummaryDeck(PptxCtor: typeof PptxGenJS, input: Project, brief: PublicationBrief, options: {icons?: IconData} = {}): Promise<{pptx: Pptx; slides: number; plan: MeetingSlide[]}> {
  const model = meetingSummaryModel(input, brief), plan = planMeetingSummaryDeck(model), p = model.project;
  const slideOf = (match: (s: MeetingSlide) => boolean) => plan.findIndex(match) + 1;
  const viewSlide = (id: string) => slideOf(s => s.kind === 'view' && s.viewId === id);
  const blockSlide = (id: string) => slideOf(s => s.kind === 'evidence' && s.blockId === id);
  const sourcesSlide = slideOf(s => s.kind === 'sources');
  const pptx = new PptxCtor();
  pptx.layout = 'LAYOUT_WIDE'; pptx.title = model.brief.title; pptx.subject = 'Meeting summary (public content only)'; pptx.author = 'DiagramCloud'; pptx.company = 'DiagramCloud';
  pptx.theme = {headFontFace: 'Aptos Display', bodyFontFace: FONT};

  const frame = (kicker: string, title: string, subtitle = ''): Slide => {
    const s = pptx.addSlide(); s.background = {color: 'FFFFFF'};
    s.addText(kicker, {x: .6, y: .3, w: 12.1, h: .25, fontSize: 10, color: LABEL, charSpacing: 2, fontFace: FONT, margin: 0});
    s.addText(caption(title, 74, 2), {x: .6, y: .7, w: 12.1, h: .7, fontSize: title.length > 70 ? 22 : 27, bold: true, color: INK, fontFace: FONT, margin: 0, valign: 'top'});
    if (subtitle) s.addText(caption(subtitle, 145, 2), {x: .6, y: 1.45, w: 12.1, h: .5, fontSize: 12, color: MUTED, fontFace: FONT, margin: 0, valign: 'top'});
    s.addText(FOOTER, {x: .6, y: 7.1, w: 12.1, h: .2, fontSize: 9, color: '6F8197', fontFace: FONT, margin: 0});
    return s;
  };
  const body = (s: Slide, text: string, y: number, h: number, extra: Record<string, unknown> = {}) =>
    s.addText(text, {x: .6, y, w: 12.1, h, fontSize: 14, color: BODY, fontFace: FONT, margin: 0, valign: 'top', paraSpaceAfter: 4, ...extra});
  const grid = (s: Slide, rows: string[][], colW: number[], y = 2.15, fontSize = 10) => s.addTable(rows.map((r, i) => r.map(text => ({text, options: i === 0 ? {bold: true, fill: {color: 'EDF3F8'}} : {}}))),
    {x: .6, y, w: 12.1, colW, fontSize, fontFace: FONT, color: BODY, margin: 4, rowH: .3, border: {type: 'solid', color: 'CBD5DE', pt: .5}, fill: {color: 'FFFFFF'}, autoPage: false, valign: 'top'});
  const cell = (v: string | number | boolean | null) => v === null ? 'NULL / not supplied' : caption(String(v), 60, 3);

  for (const entry of plan) {
    if (entry.kind === 'cover') {
      const s = frame('DIAGRAMCLOUD / MEETING SUMMARY / READ-ONLY PUBLIC CUT', model.brief.title, `Audience: ${model.brief.audience} / Project: ${p.id} / Revision: ${p.revision}`);
      s.addText('Question and scope', {x: .6, y: 2.3, w: 12.1, h: .4, fontSize: 18, bold: true, color: INK, fontFace: FONT, margin: 0});
      body(s, caption(p.summary || 'Question not supplied.', 120, 6) + '\n\n' + caption(p.provenance || 'Provenance not supplied.', 120, 5), 2.8, 4.1);
      s.addNotes([model.brief.title, `Audience: ${model.brief.audience}`, p.summary, p.provenance].join('\n\n'));
    } else if (entry.kind === 'contents') {
      const s = frame('SUMMARY GLOSSARY', 'Contents', `${model.views.length} selected view${model.views.length === 1 ? '' : 's'}. Each entry opens its slide.`);
      const rows = [...model.views.map(v => ({label: v.title, slide: viewSlide(v.id)})), {label: 'Sources and limits', slide: sourcesSlide}];
      rows.forEach((r, k) => s.addText([{text: caption(r.label, 90, 1), options: {bold: true, color: '1954A0', hyperlink: {slide: r.slide, tooltip: `Go to slide ${r.slide}`}}}, {text: `   slide ${r.slide}`, options: {color: MUTED}}],
        {x: .6, y: 2.2 + k * .55, w: 12.1, h: .45, fontSize: 15, fontFace: FONT, margin: 0, valign: 'middle'}));
    } else if (entry.kind === 'talking-points') {
      const s = frame('PREPARED TALKING POINTS', 'Prepared talking points' + (entry.part ? ' (continued)' : ''));
      const steps = entry.stepIndices.map(i => model.story[i]);
      body(s, steps.map(st => `${caption(st.title, 110, 1)}\n${caption(st.narration, 120, 4)}`).join('\n\n'), 2.15, 4.8);
      s.addNotes(steps.map(st => `${st.title}\n${st.narration}`).join('\n\n'));
    } else if (entry.kind === 'findings') {
      const s = frame('KEY FINDINGS AND DECISIONS', 'Key findings and decisions');
      model.highlights.forEach((n, k) => {
        const x = .6 + (k % 2) * 6.15, y = 2.1 + Math.floor(k / 2) * 1.35;
        s.addText([{text: caption(n.label, 60, 1), options: {bold: true, color: INK, breakLine: true}}, {text: caption(n.summary || 'Interpretation not supplied.', 70, 3), options: {fontSize: 11, color: BODY}}], {x, y, w: 5.95, h: 1.25, fontSize: 13, fontFace: FONT, margin: 0, valign: 'top'});
      });
      const reading = model.brief.detail === 'overview' ? 'Overview: selected findings and diagram only. Evidence bodies remain in the companion Project or full handbook.' : 'Selected evidence is included in this deck. Displayed code is not executed.';
      body(s, `Reading this brief. ${reading} Scope and provenance are supplied on the cover. This summary is not a new approval or runtime result. PowerPoint keeps slides, not live pane interactions.`, 6.25, .75, {fontSize: 10, color: MUTED});
      s.addNotes(model.highlights.map(n => `${n.label}\n${n.summary}`).join('\n\n'));
    } else if (entry.kind === 'view') {
      const v = model.views.find(x => x.id === entry.viewId)!, index = model.views.indexOf(v);
      // The one uncounted notice when the public cut of this view leaves members out. A figure slide repeats its
      // description in the speaker notes, so there the notice is its own line on the slide, never part of the description.
      const described = model.omitted[v.id] ? [v.description, PUBLIC_OMISSION_NOTICE].filter(Boolean).join(' ') : v.description;
      if (entry.figure) {
        // Native editable figure: the public projection holding only this view and the summary's sources, without drilldown links.
        const figure: Project = {...p, rootViewId: v.id, views: [v], sources: model.sources, story: [], nodes: p.nodes.map(({childViewId: _drop, ...n}) => n)};
        const first = deckSlides(pptx).length;
        await addArchitectureSlides(pptx, figure, {cover: false, evidence: false, sources: false, realization: false, firstViewSlide: viewSlide(v.id), icons: options.icons ?? noIcons});
        if (model.omitted[v.id]) deckSlides(pptx)[first].addText(PUBLIC_OMISSION_NOTICE, {x: .6, y: 2.03, w: 12.1, h: .16, fontSize: 10, color: MUTED, fontFace: FONT, margin: 0});
      } else {
        const s = frame(`SELECTED VIEW ${index + 1} / ${model.views.length}`, v.title, described ?? '');
        const reason = model.dense[v.id] ? 'This view exceeds the readable summary budget. The full handbook supplies paginated figures; the complete selected component list follows.'
          : 'Business profile: text and tables, no graph.';
        body(s, reason, 2.2, .8, {color: MUTED});
      }
    } else if (entry.kind === 'components') {
      const v = model.views.find(x => x.id === entry.viewId)!, index = model.views.indexOf(v);
      const s = frame(`SELECTED VIEW ${index + 1} / ${model.views.length} · COMPONENTS${entry.part ? ' (CONTINUED)' : ''}`, v.title);
      const nodes = entry.nodeIds.map(id => p.nodes.find(n => n.id === id)!);
      const evidence = (n: Project['nodes'][number]) => model.brief.detail === 'overview' ? '' : n.blockIds.filter(id => model.blocks.some(b => b.id === id)).map(id => `${caption(p.blocks.find(b => b.id === id)!.title, 40, 1)} (slide ${blockSlide(id)})`).join('\n');
      grid(s, [['Component', 'Meaning', 'Source basis and design status', 'Evidence'], ...nodes.map(n => [caption(n.label, 40, 2), caption(n.summary || 'Meaning not supplied.', 70, 4), `Source basis: ${n.basis ?? 'unknown'}. Design status: ${n.status}; not runtime evidence.`, evidence(n)])], [2.4, 4.7, 2.4, 2.6], 1.6, 9);
      s.addNotes(nodes.map(n => `${n.label}\n${n.summary || 'Meaning not supplied.'}`).join('\n\n'));
    } else if (entry.kind === 'evidence') {
      const b = model.blocks.find(x => x.id === entry.blockId)!, t = table(b);
      const basis = `Basis: ${b.provenance}${b.transform ? ' / ' + TRANSFORM_LABEL[b.transform] + ' (explanatory, not executed)' : ''}`;
      const s = frame('SELECTED SUPPORTING EVIDENCE', b.title + (entry.part ? ' (continued)' : ''));
      // A synthetic block keeps its visible label on every slide it spans; it is never presented as a measured result.
      s.addText(b.provenance === 'synthetic' ? [{text: MEETING_SUMMARY_SYNTHETIC_LABEL + ' ', options: {bold: true, color: SYNTHETIC}}, {text: basis, options: {color: MUTED}}] : [{text: basis, options: {color: MUTED}}], {x: .6, y: 1.45, w: 12.1, h: .4, fontSize: 12, fontFace: FONT, margin: 0, valign: 'top'});
      if (t) grid(s, [t.columns.map(c => caption(c, 40, 2)), ...t.rows.slice(entry.start, entry.start + TABLE_ROWS).map(r => r.map(cell))], t.columns.map(() => 12.1 / t.columns.length));
      else {const lines = prose(b), per = b.type === 'code' ? CODE_LINES : TEXT_LINES; body(s, lines.slice(entry.start, entry.start + per).join('\n'), 2.15, 4.8, b.type === 'code' ? {fontFace: 'Consolas', fontSize: 12} : {});}
      s.addNotes([b.title, b.provenance === 'synthetic' ? MEETING_SUMMARY_SYNTHETIC_LABEL : '', basis].filter(Boolean).join('\n'));
    } else {
      const s = frame('SOURCES AND LIMITS', 'Sources and limits' + (entry.part ? ' (continued)' : ''));
      const rows = model.sources.slice(entry.start, entry.start + SOURCE_ROWS);
      if (rows.length) grid(s, [['Source', 'Location', 'Link'], ...rows.map(src => [caption(src.title, 50, 2), caption(src.location, 80, 3), src.url ? caption(src.url, 50, 2) : ''])], [3.2, 5.6, 3.3], 1.6);
      else body(s, 'No public sources attached to these views.', 1.7, .5);
      body(s, [`Selected views: ${model.views.length}. Public content only. DiagramCloud Project JSON retains the editable model; this deck is a publication, not a backup.`, 'Static reading: no live refresh, provider requests or animation.', MEETING_SUMMARY_FIDELITY_NOTE].join('\n'), 5.6, 1.4, {fontSize: 10, color: MUTED});
      s.addNotes(rows.map(src => `${src.title}\n${src.location}${src.url ? '\n' + src.url : ''}`).join('\n\n') || 'No public sources attached to these views.');
    }
  }
  return {pptx, slides: plan.length, plan};
}

/** File name of the meeting deck, next to `<project id>.meeting-summary.html`. */
export const meetingSummaryPptxName = (project: Project) => `${project.id}.meeting-summary.pptx`;

/** Browser download of the meeting deck; pptxgenjs is loaded on demand. Returns the file name and slide count. */
export async function downloadMeetingSummaryPptx(input: Project, brief: PublicationBrief, options: {icons?: IconData} = {}): Promise<{fileName: string; slides: number}> {
  const {default: PptxGenJS} = await import('pptxgenjs'), {pptx, slides} = await buildMeetingSummaryDeck(PptxGenJS, input, brief, options);
  const fileName = meetingSummaryPptxName(input);
  await pptx.writeFile({fileName});
  return {fileName, slides};
}
