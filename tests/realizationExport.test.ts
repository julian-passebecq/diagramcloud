import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {samples} from '../src/data/samples';
import {clone,validateDocument,type Observation,type Project} from '../src/core/model';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
import {REALIZATION_EXPORT_NOTE,observationPatch,type ObservationInput} from '../src/core/realization';
import {buildScene} from '../src/export/scene';
import {mermaidDiagram,svgDiagram} from '../src/export/diagram';
import {portfolioHtml} from '../src/export/html';
import {addArchitectureSlides} from '../src/export/pptx';
import {buildDeck,projectPlan} from '../src/export/deck';
import {textWidth} from '../src/export/measure';

/*
 * Realization export parity: a component an author reviewed and made public as "verified externally" must not
 * look merely planned in any export, and a private or unreviewed claim must not leak into any of them.
 */
const total=samples.find(s=>s.id==='total-project-controls')!;
const verified:ObservationInput={id:'obs-checks-verified',nodeId:'checks',sourceApp:'datapass-vscode',authority:'GitHub Actions workflow quality',observedAt:'2026-09-20T08:30:00Z',sourceRevision:'4ad1f4d',claim:'verified',summary:'Required-field checks passed on the reference dataset.',caveat:'Reference dataset only'};
const pending:ObservationInput={id:'obs-pending-secret',nodeId:'oracle',sourceApp:'datapass-vscode',authority:'Unreviewed source',observedAt:'2026-09-22T08:30:00Z',sourceRevision:'aaaa111',claim:'partial',summary:'UNREVIEWED-CLAIM-TEXT'};
function imported(doc:Project,obs:ObservationInput):Project{return validateDocument({...applyDocumentPatch(doc,observationPatch(doc,obs)).result,revision:doc.revision+1});}
/** The author's review in Edit mode: reviewed and public. Tests stand in for the human here, as the e2e suite does. */
function presented(doc:Project,id:string):Project{const d=clone(doc),o=d.observations.find(o=>o.id===id)!;Object.assign(o,{reviewedAt:'2026-09-21T09:00:00Z',visibility:'public'} satisfies Partial<Observation>);return validateDocument(d);}
const doc=presented(imported(imported(total,verified),pending),verified.id);
const rootView=doc.views.find(v=>v.nodeIds.includes('checks'))!;

test('the shared scene badges only Presented observations, inside the box, without squeezing the footer text out',()=>{
 const scene=buildScene(publicDocument(doc),rootView),node=scene.nodes.find(n=>n.id==='checks')!;
 assert.equal(node.realization?.claim,'verified');
 assert.equal(node.realization?.text.lines[0],'Verified');
 const r=node.realization!;
 assert(r.x>=node.x&&r.x+r.w<=node.x+node.w&&r.y>=node.y&&r.y+r.h<=node.y+node.h,'badge stays inside its box');
 assert(node.footer.x+Math.max(0,...node.footer.lines.map(l=>textWidth(l,10)))<=r.x,'footer text ends before the badge');
 assert.equal(node.footer.truncated,false);
 assert.match(r.title,/datapass-vscode.*4ad1f4d/);
 // The unreviewed observation exists in the authoring document but gets no badge, even from the raw document.
 assert(doc.observations.some(o=>o.id===pending.id));
 assert(!buildScene(doc,doc.views.find(v=>v.nodeIds.includes('oracle'))!).nodes.find(n=>n.id==='oracle')?.realization);
});

test('SVG, PNG source and standalone HTML carry the badge and the realization note, never the unreviewed claim',()=>{
 const svg=svgDiagram(doc,rootView.id,true);
 assert.match(svg,/data-realization="verified"/);
 assert(svg.includes(REALIZATION_EXPORT_NOTE));
 assert(!svg.includes('UNREVIEWED-CLAIM-TEXT')&&!svg.includes(pending.id),'metadata is the public document');
 const png=svgDiagram(doc,rootView.id,false);
 assert.match(png,/data-realization="verified"/);
 const html=portfolioHtml(doc);
 assert.match(html,/data-realization=\\?"verified\\?"/);
 assert(!html.includes('UNREVIEWED-CLAIM-TEXT'));
 // Without any presented observation, nothing realization-related is added.
 const plain=svgDiagram(total,rootView.id,false);
 assert(!plain.includes('data-realization')&&!plain.includes(REALIZATION_EXPORT_NOTE));
});

test('Mermaid keeps realization as a class plus a provenance comment and documents what it leaves out',()=>{
 const m=mermaidDiagram(doc,rootView.id);
 assert.match(m,/%% n\d+ Verified by datapass-vscode @ 4ad1f4d \(2026-09-20\)/);
 assert.match(m,/classDef verified /);
 assert.match(m,/class n\d+ verified/);
 assert(!m.includes('UNREVIEWED-CLAIM-TEXT'));
 assert.match(m,/evidence and hierarchy remain in JSON/);
});

async function slides(pptx:InstanceType<typeof PptxGenJS>){
 const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),names=Object.keys(zip.files).filter(n=>/^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n));
 return (await Promise.all(names.map(n=>zip.file(n)!.async('string')))).join('\n');
}

test('project PowerPoint: native badge on the view slide, provenance in notes, and a realization appendix',async()=>{
 const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';
 const d=publicDocument(doc);
 await addArchitectureSlides(pptx,d,{cover:true,evidence:false,sources:true,realization:true,firstViewSlide:2});
 const xml=await slides(pptx);
 assert(xml.includes('>Verified<'),'badge text is a native text box');
 assert(xml.includes('Realization'),'appendix slide');
 assert(xml.includes('GitHub Actions workflow quality'),'authority survives');
 assert(xml.includes('4ad1f4d'),'source revision survives');
 assert(xml.includes('Caveat: Reference dataset only'));
 assert(!xml.includes('UNREVIEWED-CLAIM-TEXT')&&!xml.includes('Unreviewed source'));
});

test('project deck: the realization section sits before sources and every link still lands',async()=>{
 const {pptx,sections,slides:count}=await buildDeck(PptxGenJS,projectPlan(doc));
 assert.deepEqual(sections.map(s=>s.label).slice(-2),['Realization','Sources and provenance']);
 const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
 assert.equal(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,count);
 const realization=await zip.file(`ppt/slides/slide${sections.at(-2)!.slide}.xml`)!.async('string');
 assert(realization.includes('What other apps observed')&&realization.includes('4ad1f4d'));
 const all=await slides(pptx);
 assert(!all.includes('UNREVIEWED-CLAIM-TEXT'));
 // A project without presented observations keeps its previous deck structure.
 const plain=await buildDeck(PptxGenJS,projectPlan(total));
 assert(!plain.sections.some(s=>s.label==='Realization'));
});
