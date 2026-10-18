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
