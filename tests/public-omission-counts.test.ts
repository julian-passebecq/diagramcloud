import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {DESIGN_TYPES,validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {targetFingerprint} from '../src/core/learningMapping';
import {viewSpec,PUBLIC_OMISSION_NOTICE} from '../src/core/viewspec';
import {svgDiagram,mermaidDiagram} from '../src/export/diagram';
import {styledSvg} from '../src/export/styled';
import {portfolioHtml} from '../src/export/html';
import {designSvg} from '../src/export/design';
import {designBookHtml} from '../src/export/design/book';
import {technicalManualHtml} from '../src/export/manual';
import {drawioDiagram} from '../src/export/drawio';
import {atlasnoteCheatsheetJson} from '../src/export/atlasnote';
import {conceptSpec} from '../src/export/concept';
import {portfolioIndexJson} from '../src/export/portfolioIndex';
import {publicationPages} from '../src/export/publicationPages';
import {projectOverviewHtml} from '../src/export/projectOverview';
import {intelligenceReportHtml} from '../src/export/intelligenceReport';
import {howItWorksFacts} from '../src/export/howItWorks';
import {queryProject,renderPublicView,renderPublicArtifact} from '../src/intelligence/context';
import {prepareViewer,REACT_VIEWER_API_VERSION,type ViewerInput} from '../src/react/viewerBoundary';
import JSZip from 'jszip';import PptxGenJS from 'pptxgenjs';
import {meetingSummaryHtml} from '../src/export/meetingSummary';
import {buildMeetingSummaryDeck} from '../src/export/meetingSummaryPptx';
import {linkedReadingHtml} from '../src/export/linkedReadingHtml';
import {linkedReadingKey,type LinkedReadingOptions} from '../src/core/linkedReading';
import type {PublicationBrief} from '../src/intelligence/publicationBrief';

/**
 * AC25, strict reading: a public copy's omissions stay unnamed and uncounted. Two authoring documents that differ only
 * in how many private items they hold (1 against 5 private cards, connections, views, story steps and blocks per view)
 * must give byte-identical public output in every public format. A public figure may say that some content is not
 * shown; it never says how much.
 */
const NOW=new Date('2026-10-17T00:00:00.000Z');

function withPrivate(input:Project,n:number):Project{
 const d=structuredClone(input);
 for(let k=0;k<n;k++){
  d.sources.push({id:`zz-private-source-${k}`,title:'PRIVATE_SOURCE',location:'PRIVATE_LOCATION',visibility:'private'});
  d.story.push({title:'PRIVATE_STEP',viewId:`zz-private-view-${k}`,narration:'PRIVATE_NARRATION',highlightEdgeIds:[]});
  d.views.push({id:`zz-private-view-${k}`,title:'PRIVATE_VIEW',visibility:'private',nodeIds:[],edgeIds:[],positions:{}} as unknown as Project['views'][number]);
 }
 for(const view of [...d.views]){
  if(view.id.startsWith('zz-private-view-')||!view.nodeIds.length)continue;
  const first=view.nodeIds[0],edge=d.edges.find(e=>view.edgeIds.includes(e.id)),at=view.positions[first]??{x:0,y:0};
  for(let k=0;k<n;k++){
   const node=`zz-private-${view.id}-${k}`;
   d.nodes.push({...structuredClone(d.nodes.find(x=>x.id===first)!),id:node,label:'PRIVATE_NODE',summary:'PRIVATE_SUMMARY',visibility:'private',blockIds:[],sourceIds:[`zz-private-source-${k}`],childViewId:undefined} as Project['nodes'][number]);
   view.nodeIds.push(node);view.positions[node]={x:at.x+40*k,y:at.y+900+40*k};
   d.blocks.push({id:`zz-private-note-${view.id}-${k}`,type:'text',title:'PRIVATE_NOTE',text:'PRIVATE_TEXT',visibility:'private',sourceIds:[]} as unknown as Project['blocks'][number]);
   d.nodes.find(x=>x.id===first)!.blockIds.push(`zz-private-note-${view.id}-${k}`);
   if(edge){d.edges.push({...structuredClone(edge),id:`zz-private-edge-${view.id}-${k}`,label:'PRIVATE_EDGE',visibility:'private'});view.edgeIds.push(`zz-private-edge-${view.id}-${k}`);}
  }
 }
 // A changed membership makes a concept mapping stale by design; model the author's re-review so only the private count differs.
 for(const m of d.learningMappings??[]){const f=targetFingerprint(d,m.target);if(f)m.target.fingerprint=f;}
 return validateDocument(d);
}

const cases=samples.map(s=>{const p=publicDocument(s);return {p,one:withPrivate(p,1),five:withPrivate(p,5)};}).filter(c=>c.p.views.some(v=>v.nodeIds.length));
const COUNTED=/\d+\s+(?:private|hidden|not public)|private or unreachable \w+\(s\) removed|step\(s\) on private views/i;

/** Every public format the app, the CLI and the MCP tools produce, rendered from one authoring document. */
function publicOutputs(d:Project):[string,string][]{
 const out:[string,string][]=[];
 const viewIds=publicDocument(d).views.map(v=>v.id);
 for(const viewId of viewIds){
  out.push([`viewspec ${viewId}`,JSON.stringify(viewSpec(d,viewId,{now:NOW}))]);
  for(const type of DESIGN_TYPES)out.push([`design ${type} ${viewId}`,designSvg(d,viewId,{type,now:NOW})]);
  out.push([`design dark ${viewId}`,designSvg(d,viewId,{type:'architecture',theme:'dark',now:NOW})],[`design editorial ${viewId}`,designSvg(d,viewId,{type:'architecture',theme:'editorial',now:NOW})]);
  for(const style of ['blueprint','editorial'] as const)out.push([`${style} ${viewId}`,styledSvg(d,viewId,style,NOW)]);
  out.push([`svg ${viewId}`,svgDiagram(d,viewId)],[`mermaid ${viewId}`,mermaidDiagram(d,viewId)]);
  out.push([`concept ${viewId}`,JSON.stringify(conceptSpec(d,viewId,{now:NOW}))]);
  out.push([`publication pages ${viewId}`,JSON.stringify(publicationPages(d,viewId))]);
  out.push([`mcp render ${viewId}`,JSON.stringify(renderPublicView(d,{viewId}))]);
  out.push([`mcp quality ${viewId}`,JSON.stringify(renderPublicArtifact(d,{kind:'quality',viewId}))]);
 }
 out.push(['manual',technicalManualHtml(d,{now:NOW})],['book',designBookHtml(d,{now:NOW})],['html',portfolioHtml(d)],['drawio',drawioDiagram(d,NOW)],
  ['atlasnote',atlasnoteCheatsheetJson(d,NOW)],['portfolio index',portfolioIndexJson(d,{generatedAt:NOW})],['mcp summary',JSON.stringify(queryProject(d,{kind:'summary'}))],
  // The MCP query stamps the clock, not the project: only that timestamp is normalised.
  ['business overview',projectOverviewHtml(d)],['intelligence report',intelligenceReportHtml(d)],['how it works',JSON.stringify(howItWorksFacts(d,{mode:'story'},true))],
  ['mcp views',JSON.stringify(queryProject(d,{kind:'views'})).replace(/"generatedAt":"[^"]+"/g,'"generatedAt":"-"')]);
 const root=publicDocument(d).rootViewId;
 // documentIdentity is the host's own object reference (never rendered); the viewer shows the rest.
 const viewer=prepareViewer({document:d,apiVersion:REACT_VIEWER_API_VERSION,allowedViewIds:[root],selection:{projectId:d.id,baseRevision:d.revision,viewId:root}} as ViewerInput);
 assert.equal(viewer.state,'ready');
 out.push(['react viewer',JSON.stringify({...viewer,documentIdentity:undefined})]);
 return out;
}

test('public omission counts: 1 or 5 private items give byte-identical output in every public format',()=>{
 let compared=0;
 for(const {p,one,five} of cases){
  const a=publicOutputs(one),b=publicOutputs(five);
  assert.deepEqual(a.map(([k])=>k),b.map(([k])=>k),`${p.id}: same outputs`);
  for(let i=0;i<a.length;i++){assert.equal(a[i][1],b[i][1],`${p.id}: ${a[i][0]} depends on the number of private items`);compared++;
   assert.doesNotMatch(a[i][1],COUNTED,`${p.id}: ${a[i][0]} counts private items`);assert.doesNotMatch(a[i][1],/PRIVATE_|zz-private/,`${p.id}: ${a[i][0]} leaks a private item`);}
 }
 assert.ok(compared>500,`compared ${compared} outputs`);
});

test('public omission counts: a public figure says some content is not shown, uncounted; the author view keeps every item',()=>{
 for(const {p,five} of cases){
  const viewId=publicDocument(five).views.find(v=>v.nodeIds.length)!.id,spec=viewSpec(five,viewId,{now:NOW});
  assert.ok(spec.omissions.includes(PUBLIC_OMISSION_NOTICE),`${p.id}: generic notice`);
  assert.equal(spec.omissions.filter(o=>o===PUBLIC_OMISSION_NOTICE).length,1,`${p.id}: one notice for cards and connections`);
  assert.doesNotMatch(designSvg(five,viewId,{type:'architecture',now:NOW}),COUNTED);
  assert.ok(technicalManualHtml(five,{now:NOW}).includes(PUBLIC_OMISSION_NOTICE),`${p.id}: manual cover`);
  // Nothing hidden: no notice at all.
  assert.ok(!viewSpec(p,viewId,{now:NOW}).omissions.includes(PUBLIC_OMISSION_NOTICE),`${p.id}: no notice without private content`);
  // The author audience removes nothing and lists every member.
  const author=viewSpec(five,viewId,{audience:'author',now:NOW});
  assert.equal(author.nodes.length,five.views.find(v=>v.id===viewId)!.nodeIds.length,`${p.id}: author spec keeps private cards`);
  assert.ok(!author.omissions.includes(PUBLIC_OMISSION_NOTICE));
 }
});

/** Formats that render from an already-redacted copy (meeting summary HTML and PPTX, linked reading): the notice is
 * computed against the authoring document, printed once per view, uncounted, and absent when nothing is hidden. */
const READING_KEY=/^[a-z][a-z0-9_.-]{0,79}$/;
const briefOf=(d:Project,profile:'design'|'business'):PublicationBrief=>({format:'diagramcloud.publication-brief/1',title:'Omission check',audience:'Reviewer',
 viewIds:publicDocument(d).views.filter(v=>v.nodeIds.length).slice(0,6).map(v=>v.id),detail:'standard',paper:'A4',profile,storyIndices:[]});
const readingOf=(d:Project):LinkedReadingOptions=>({projectId:d.id,sourceKey:linkedReadingKey(d),
 chapters:publicDocument(d).views.filter(v=>v.nodeIds.length&&READING_KEY.test(v.id)).slice(0,3).map((v,k)=>({id:`c${k}`,leftViewId:v.id,rightViewId:v.id,leftDesign:'architecture' as const,rightDesign:'status' as const}))});
async function deckText(d:Project,brief:PublicationBrief):Promise<string>{
 const {pptx}=await buildMeetingSummaryDeck(PptxGenJS,d,brief),zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
 // Slides and notes only: document properties carry the write time.
 const names=Object.keys(zip.files).filter(n=>/^ppt\/(slides|notesSlides)\/[a-zA-Z]+\d+\.xml$/.test(n)).sort();
 return (await Promise.all(names.map(async n=>`${n}\n${await zip.file(n)!.async('string')}`))).join('\n');
}
async function redactedOutputs(d:Project):Promise<[string,string][]>{
 const out:[string,string][]=[];
 for(const profile of ['design','business'] as const){const brief=briefOf(d,profile);
  out.push([`meeting html ${profile}`,meetingSummaryHtml(d,brief,{now:NOW})],[`meeting pptx ${profile}`,await deckText(d,brief)]);}
 const reading=readingOf(d);if(reading.chapters.length)out.push(['linked reading',linkedReadingHtml(d,reading,{now:NOW})]);
 return out;
}

test('public omission counts: meeting summary (HTML, PPTX) and linked reading print the generic notice, uncounted',async()=>{
 let compared=0;
 for(const {p,one,five} of cases){
  const a=await redactedOutputs(one),b=await redactedOutputs(five),none=await redactedOutputs(p);
  assert.deepEqual(a.map(([k])=>k),b.map(([k])=>k),`${p.id}: same outputs`);
  for(let i=0;i<a.length;i++){
   assert.equal(a[i][1],b[i][1],`${p.id}: ${a[i][0]} depends on the number of private items`);compared++;
   assert.ok(a[i][1].includes(PUBLIC_OMISSION_NOTICE),`${p.id}: ${a[i][0]} says some content is not shown`);
   assert.doesNotMatch(a[i][1],COUNTED,`${p.id}: ${a[i][0]} counts private items`);
   assert.doesNotMatch(a[i][1],/PRIVATE_|zz-private/,`${p.id}: ${a[i][0]} leaks a private item`);
   assert.ok(!none[i][1].includes(PUBLIC_OMISSION_NOTICE),`${p.id}: ${none[i][0]} has no notice without private content`);
  }
 }
 assert.ok(compared>=cases.length*4,`compared ${compared} outputs`);
});

const occurrences=(text:string)=>text.split(PUBLIC_OMISSION_NOTICE).length-1;
/** Meeting summary, one selected view per output: the notice appears exactly once (HTML and PPTX, design and business
 * profiles; the design figure and the PPTX speaker notes never repeat it), byte-identical for 1 and 5 private items,
 * and absent when nothing is hidden. With several selected views it appears once per view. */
test('public omission counts: the meeting summary prints the notice exactly once per output, never twice',async()=>{
 let checked=0;
 for(const {p,one,five} of cases){
  const viewIds=publicDocument(one).views.filter(v=>v.nodeIds.length).map(v=>v.id).slice(0,6);
  for(const profile of ['design','business'] as const){
   const single=(d:Project):PublicationBrief=>({...briefOf(d,profile),viewIds:[viewIds[0]]});
   const outputs=async(d:Project,brief:PublicationBrief):Promise<[string,string][]>=>[[`html ${profile}`,meetingSummaryHtml(d,brief,{now:NOW})],[`pptx ${profile}`,await deckText(d,brief)]];
   const a=await outputs(one,single(one)),b=await outputs(five,single(five)),none=await outputs(p,single(p));
   const all=await outputs(one,briefOf(one,profile));
   for(let i=0;i<a.length;i++){
    assert.equal(occurrences(a[i][1]),1,`${p.id}: ${a[i][0]} prints the notice once (1 private item)`);
    assert.equal(occurrences(b[i][1]),1,`${p.id}: ${b[i][0]} prints the notice once (5 private items)`);
    assert.equal(a[i][1],b[i][1],`${p.id}: ${a[i][0]} depends on the number of private items`);
    assert.equal(occurrences(none[i][1]),0,`${p.id}: ${none[i][0]} has no notice without private content`);
    assert.equal(occurrences(all[i][1]),viewIds.length,`${p.id}: ${all[i][0]} prints one notice per selected view`);
    checked++;
   }
  }
 }
 assert.ok(checked>=cases.length*4,`checked ${checked} outputs`);
});
