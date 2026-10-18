import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {PUBLIC_OMISSION_NOTICE} from '../src/core/viewspec';
import {layeredLayout} from '../src/core/layout';
import {targetFingerprint} from '../src/core/learningMapping';
import {buildScene,sceneRoutes,routeIsOrthogonal} from '../src/export/scene';
import {svgDiagram} from '../src/export/diagram';
import {styledSvg} from '../src/export/styled';
import {portfolioHtml} from '../src/export/html';
import {designSvg} from '../src/export/design';
import {designBookHtml} from '../src/export/design/book';
import {technicalManualHtml} from '../src/export/manual';
import {availabilityOf} from '../src/export/design/availability';
import {defects} from '../src/export/design/quality';
import {explanationGaps} from '../src/intelligence/learning/gaps';
import {queryProject,renderPublicView,renderPublicArtifact} from '../src/intelligence/context';
import {proposeMappingSuggestion} from '../src/intelligence/learning/query';
import {catalogueRows} from '../src/intelligence/learning/catalogue';
import {prepareViewer,viewerSourceIntent,REACT_VIEWER_API_VERSION,VIEWER_UNAVAILABLE,type ViewerInput} from '../src/react/viewerBoundary';
import {negotiateCapabilities,createReturnGuard,createReturnIntent} from '../src/react/hostSession';
import {resolvePublicReference,acceptPublicReturn,PUBLIC_REFERENCE_UNAVAILABLE,type PublicReference} from '../src/interop/publicReference';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function mcpCalls(input:string,calls:[string,unknown][]){
 const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'synthetic-agent',version:'1'}}},{method:'notifications/initialized'},...calls.map(([name,args],i)=>({id:i+2,method:'tools/call',params:{name,arguments:args}}))];
 const r=spawnSync(process.execPath,['--import','tsx','scripts/intelligence-mcp.ts',input],{input:requests.map(q=>JSON.stringify({jsonrpc:'2.0',...q})).join('\n')+'\n',encoding:'utf8',timeout:60000});
 assert.equal(r.status,0,r.stderr);const replies=r.stdout.trim().split('\n').map(line=>JSON.parse(line));
 return calls.map((_,i)=>replies.find(x=>x.id===i+2).result as {isError?:boolean;content:{text:string}[]});
}

/**
 * AC25 public noninterference: adding hidden (private) facts to an authoring document changes nothing a public
 * reader can observe - no scene route or route defect, no count, no story step or gap, no exported layout.
 * The baseline is the public projection itself, so the hidden facts are the only difference.
 */
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function withHidden(input:Project):Project{
 const d=structuredClone(input);
 d.sources.push({id:'zz-hidden-source',title:'HIDDEN_SOURCE_TITLE',location:'HIDDEN_LOCATION',visibility:'private'});
 d.assets.push({id:'zz-hidden-asset',name:'HIDDEN_ASSET',data:PNG,rights:'Author',visibility:'private',remote:{provider:'google-drive',fileId:'HiddenDriveFile123',fileName:'hidden.png',mimeType:'image/png',savedAt:'2026-10-01T00:00:00.000Z'}});
 d.views.push({id:'zz-hidden-view',title:'HIDDEN_VIEW',visibility:'private',nodeIds:[],edgeIds:[],positions:{}} as unknown as Project['views'][number]);
 for(const view of [...d.views]){
  if(view.id==='zz-hidden-view'||!view.nodeIds.length)continue;
  const at=(id:string)=>view.positions[id]??{x:0,y:0};
  // A private card placed squarely between the first connection's two ends, where a public route would detour around it.
  const edge=d.edges.find(e=>view.edgeIds.includes(e.id)),a=at(edge?.source??view.nodeIds[0]),b=at(edge?.target??view.nodeIds[0]);
  const node=`zz-hidden-${view.id}`,first=view.nodeIds[0];
  d.nodes.push({...structuredClone(d.nodes.find(n=>n.id===first)!),id:node,label:'HIDDEN_NODE',summary:'HIDDEN_SUMMARY',visibility:'private',blockIds:['zz-hidden-image-'+view.id],sourceIds:['zz-hidden-source'],childViewId:undefined,customIconAssetId:'zz-hidden-asset'} as Project['nodes'][number]);
  d.blocks.push({id:'zz-hidden-image-'+view.id,type:'image',title:'HIDDEN_IMAGE',assetId:'zz-hidden-asset',caption:'',visibility:'private',sourceIds:[]} as unknown as Project['blocks'][number]);
  // A private evidence block on a public card must not change its "N evidence blocks" count.
  d.blocks.push({id:'zz-hidden-note-'+view.id,type:'text',title:'HIDDEN_NOTE',text:'HIDDEN_TEXT',visibility:'private',sourceIds:[]} as unknown as Project['blocks'][number]);
  d.nodes.find(n=>n.id===first)!.blockIds.push('zz-hidden-note-'+view.id);
  view.nodeIds.push(node);view.positions[node]={x:Math.round((a.x+b.x)/2),y:Math.round((a.y+b.y)/2)};
  // A public connection to a private card and a private connection between public cards.
  if(edge){d.edges.push({...structuredClone(edge),id:`zz-hidden-link-${view.id}`,source:first,target:node,label:'HIDDEN_LINK',visibility:'public'});view.edgeIds.push(`zz-hidden-link-${view.id}`);
d.edges.push({...structuredClone(edge),id:`zz-hidden-edge-${view.id}`,label:'HIDDEN_EDGE',visibility:'private'});view.edgeIds.push(`zz-hidden-edge-${view.id}`);}
  // Story steps about the private card or the private connection.
  d.story.push({title:'HIDDEN_STEP',viewId:view.id,nodeId:node,narration:'HIDDEN_NARRATION',highlightEdgeIds:edge?[`zz-hidden-link-${view.id}`]:[]});
  d.story.push({title:'HIDDEN_VIEW_STEP',viewId:'zz-hidden-view',narration:'HIDDEN_NARRATION',highlightEdgeIds:[]});
 }
 // Changing a mapped component's evidence or a mapped view's membership makes its concept mapping stale by design
 // (an authoring edit to re-review). Model the author's re-review so the hidden facts are the only difference.
 const out=validateDocument(d);
 for(const m of out.learningMappings??[]){const f=targetFingerprint(out,m.target);if(f)m.target.fingerprint=f;}
 return validateDocument(out);
}

const baselines=samples.map(s=>publicDocument(s)),pairs=baselines.map(p=>({p,h:withHidden(p)}));
const drawn=(svg:string)=>[...svg.matchAll(/<(?:g|path|line|polyline|rect)[^>]*data-(?:node|edge)-id="[^"]*"[^>]*>/g)].map(m=>m[0]);
const NOW=new Date('2026-10-17T00:00:00.000Z');
const views=(p:Project)=>p.views.map(v=>v.id);
/**
 * The one deliberate difference: a public figure says, uncounted, that some content of its view is not shown
 * (viewSpec omissions; how much never moves, see public-omission-counts.test.ts). Only that sentence (and a footer that carries it, cut with an ellipsis) is removed here;
 * every other byte must match.
 */
const disclosed=(text:string)=>text.replace(/( · public content only)[^<]*/g,'$1').split(' '+PUBLIC_OMISSION_NOTICE).join('').split(PUBLIC_OMISSION_NOTICE).join('');

test('public noninterference: hidden cards, links, blocks, assets and steps leave the public projection identical',()=>{
 for(const {p,h} of pairs){
  assert.ok(h.nodes.length>p.nodes.length,`${p.id}: fixture adds hidden cards`);
  assert.deepEqual(publicDocument(h),publicDocument(p),`${p.id}: public projection changed`);
  assert.doesNotMatch(JSON.stringify(publicDocument(h)),/HIDDEN_|zz-hidden|HiddenDriveFile/,`${p.id}: a hidden fact reached the projection`);
 }
});
test('public noninterference: export scene routes, bounds, footer counts and route defects do not move',()=>{
 for(const {p,h} of pairs)for(const viewId of views(p)){
  const ph=publicDocument(h),pv=p.views.find(v=>v.id===viewId)!,hv=ph.views.find(v=>v.id===viewId)!;
  assert.deepEqual(buildScene(ph,hv),buildScene(p,pv),`${p.id}/${viewId}: scene`);
  const routes=sceneRoutes(ph,hv);assert.deepEqual(routes,sceneRoutes(p,pv));assert.ok(routes.every(r=>routeIsOrthogonal(r.points)));
  const svg=designSvg(h,viewId,{type:'architecture',now:NOW}),base=designSvg(p,viewId,{type:'architecture',now:NOW});
  assert.equal(disclosed(svg),disclosed(base),`${p.id}/${viewId}: design figure`);
  assert.deepEqual(defects(svg,viewId),defects(base,viewId),`${p.id}/${viewId}: route defects`);
  // Blueprint and Editorial print the omission sentences in their own panel, which grows the page: compare every drawn card and route.
  for(const style of ['blueprint','editorial'] as const)assert.deepEqual(drawn(styledSvg(h,viewId,style,NOW)),drawn(styledSvg(p,viewId,style,NOW)),`${p.id}/${viewId}: ${style}`);
  assert.equal(svgDiagram(h,viewId),svgDiagram(p,viewId),`${p.id}/${viewId}: SVG export`);
 }
});
test('public noninterference: story timeline availability, explanation gaps and public counts are unchanged',()=>{
 for(const {p,h} of pairs){
  for(const viewId of views(p)){
   assert.deepEqual(availabilityOf(h,viewId,'timeline'),availabilityOf(p,viewId,'timeline'),`${p.id}/${viewId}: story gap`);
   assert.deepEqual(explanationGaps(h,viewId,{publicMode:true}),explanationGaps(p,viewId,{publicMode:true}),`${p.id}/${viewId}: explanation gaps`);
  }
  assert.deepEqual(queryProject(h,{kind:'summary'}),queryProject(p,{kind:'summary'}),`${p.id}: public counts`);
  assert.equal(portfolioHtml(h),portfolioHtml(p),`${p.id}: portfolio HTML`);
 }
});
test('public noninterference: auto layout of the public projection is unchanged; authoring layout keeps its own space for hidden cards',()=>{
 for(const {p,h} of pairs)for(const viewId of views(p)){
  assert.deepEqual(layeredLayout(publicDocument(h),viewId),layeredLayout(p,viewId),`${p.id}/${viewId}: public layout`);
  // The authoring layout places every member, hidden cards included; publicDocument then drops the hidden ones without re-layout.
  const authoring=layeredLayout(h,viewId);assert.ok(Object.keys(authoring).includes(`zz-hidden-${viewId}`)||!p.views.find(v=>v.id===viewId)!.nodeIds.length);
 }
});

/** AC16 (bounded): public targets answer a private reference exactly as they answer an ID that never existed. */
const fabric=publicDocument(samples.find(s=>s.id==='fabric-medallion')!),hidden=withHidden(fabric),root=fabric.rootViewId;
const pubNode=fabric.views.find(v=>v.id===root)!.nodeIds[0],pubEdge=fabric.views.find(v=>v.id===root)!.edgeIds[0];
const conceptId=(catalogueRows().find(r=>r.kind==='concept')??catalogueRows()[0]).id;
const privateRefs:PublicReference[]=[{kind:'node',id:`zz-hidden-${root}`},{kind:'node',id:`zz-hidden-${root}`,viewId:root},{kind:'edge',id:`zz-hidden-edge-${root}`},{kind:'edge',id:`zz-hidden-link-${root}`,viewId:root},
 {kind:'view',id:'zz-hidden-view'},{kind:'block',id:`zz-hidden-note-${root}`},{kind:'source',id:'zz-hidden-source'},{kind:'asset',id:'zz-hidden-asset'},{kind:'drive-file',id:'HiddenDriveFile123'}];
const outcome=(run:()=>unknown)=>{try{return {ok:true,value:run()};}catch(e){return {ok:false,message:e instanceof Error?e.message:String(e)};}};

test('AC16: a private node, connection, view, block, source, asset or Drive file ID is refused with the reason of a nonexistent ID',()=>{
 for(const ref of privateRefs){
  const missing={...ref,id:ref.kind==='drive-file'?'NoSuchDriveFile999':`zz-never-${ref.kind}`};
  const a=resolvePublicReference(hidden,ref),b=resolvePublicReference(hidden,missing);
  assert.deepEqual(a,{ok:false,reason:PUBLIC_REFERENCE_UNAVAILABLE},`${ref.kind} ${ref.id}`);assert.deepEqual(a,b);
 }
 assert.deepEqual(resolvePublicReference(hidden,{kind:'node',id:pubNode,viewId:root}),{ok:true,kind:'node',id:pubNode});
 assert.deepEqual(resolvePublicReference(hidden,{kind:'view',id:root}),{ok:true,kind:'view',id:root});
 for(const bad of [null,'node',{kind:'secret',id:'x'},{kind:'node',id:pubNode,extra:1}])assert.deepEqual(resolvePublicReference(hidden,bad),{ok:false,reason:PUBLIC_REFERENCE_UNAVAILABLE});
});
test('AC16: MCP query, render and mapping tools refuse private and nonexistent IDs with one message; catalogue still answers',()=>{
 const node=`zz-hidden-${root}`,calls:[(id:string)=>unknown,string,string][]=[
  [id=>queryProject(hidden,{kind:'evidence',nodeId:id}),node,'zz-never-node'],[id=>queryProject(hidden,{kind:'impact',nodeId:id}),node,'zz-never-node'],
  [id=>renderPublicView(hidden,{viewId:id}),'zz-hidden-view','zz-never-view'],[id=>renderPublicArtifact(hidden,{kind:'quality',viewId:id}),'zz-hidden-view','zz-never-view'],
  [id=>proposeMappingSuggestion(hidden,{conceptId,target:{kind:'node',id}},{origin:'ai',suggestedBy:'synthetic-agent'}),node,'zz-never-node']];
 for(const [run,hiddenId,missingId] of calls){const a=outcome(()=>run(hiddenId)),b=outcome(()=>run(missingId));assert.equal(a.ok,false,hiddenId);assert.deepEqual(a,b);assert.doesNotMatch(JSON.stringify(a),/zz-hidden|HIDDEN_/);}
 assert.ok(outcome(()=>queryProject(hidden,{kind:'evidence',nodeId:pubNode})).ok);
 const dir=mkdtempSync(join(tmpdir(),'dc-ac16-'));try{const file=join(dir,'project.json');writeFileSync(file,JSON.stringify(hidden));
  const results=mcpCalls(file,[['diagramcloud_query',{kind:'impact',nodeId:node}],['diagramcloud_query',{kind:'impact',nodeId:'zz-never-node'}],['diagramcloud_render',{viewId:'zz-hidden-view'}],['diagramcloud_render',{viewId:'zz-never-view'}],['diagramcloud_catalogue',{op:'search',query:'medallion'}]]);
  assert.ok(results[0].isError);assert.deepEqual(results[0],results[1]);assert.ok(results[2].isError);assert.deepEqual(results[2],results[3]);assert.ok(!results[4].isError);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('AC16: the public viewer and host return refuse a private selection or source exactly like an unknown one',()=>{
 const base={document:hidden,apiVersion:REACT_VIEWER_API_VERSION,allowedViewIds:[root],selection:{projectId:hidden.id,baseRevision:hidden.revision,viewId:root}};
 const viewer=(selection:Record<string,unknown>,allowed=[root])=>prepareViewer({...base,allowedViewIds:allowed,selection:{...base.selection,...selection}} as ViewerInput);
 assert.deepEqual(viewer({nodeId:`zz-hidden-${root}`}),viewer({nodeId:'zz-never-node'}));assert.deepEqual(viewer({nodeId:`zz-hidden-${root}`}),{state:'unavailable',message:VIEWER_UNAVAILABLE});
 assert.deepEqual(viewer({edgeId:`zz-hidden-link-${root}`}),viewer({edgeId:'zz-never-edge'}));
 assert.deepEqual(viewer({viewId:'zz-hidden-view'},[root,'zz-hidden-view']),viewer({viewId:'zz-never-view'},[root,'zz-never-view']));
 const ready=prepareViewer(base as ViewerInput);assert.equal(ready.state,'ready');if(ready.state!=='ready')return;
 assert.equal(viewerSourceIntent(ready,base as ViewerInput,'zz-hidden-source'),viewerSourceIntent(ready,base as ViewerInput,'zz-never-source'));
 // Host return: the guard accepts the session, then the public check refuses hidden and unknown targets with one message.
 const session=negotiateCapabilities({format:'diagramcloud.host-session/1',sessionId:'ac16-session',audience:'public',grants:[]});assert.equal(session.state,'ready');if(session.state!=='ready')return;
 const guard=()=>createReturnGuard({sessionId:session.sessionId,projectId:hidden.id,baseRevision:hidden.revision,audience:'public',granted:session.granted});
 const intent=(target:Record<string,string>,kind:'selection'|'source'='selection')=>createReturnIntent(session,kind,{projectId:hidden.id,baseRevision:hidden.revision,viewId:root,...target})!;
 const strip=(v:ReturnType<typeof acceptPublicReturn>)=>v.ok?v:{...v,retained:undefined};
 const cases:[Record<string,string>,Record<string,string>,'selection'|'source'][]=[[{nodeId:`zz-hidden-${root}`},{nodeId:'zz-never-node'},'selection'],[{edgeId:`zz-hidden-link-${root}`},{edgeId:'zz-never-edge'},'selection'],
  [{viewId:'zz-hidden-view'},{viewId:'zz-never-view'},'selection'],[{sourceId:'zz-hidden-source'},{sourceId:'zz-never-source'},'source']];
 for(const [privateTarget,missingTarget,kind] of cases){
  const a=intent(privateTarget,kind),b=intent(missingTarget,kind),va=acceptPublicReturn(guard(),hidden,a),vb=acceptPublicReturn(guard(),hidden,b);
  assert.equal(va.ok,false);assert.deepEqual(strip(va),strip(vb));if(!va.ok)assert.equal(va.retained,a,'refused input is retained unchanged');
 }
 const g=guard(),ok=intent({nodeId:pubNode});assert.ok(acceptPublicReturn(g,hidden,ok).ok);assert.deepEqual(acceptPublicReturn(g,hidden,ok),{ok:false,reason:'replayed',retained:ok});
 if(pubEdge)assert.ok(acceptPublicReturn(guard(),hidden,intent({edgeId:pubEdge})).ok);
});

/** AC29: the static exports a reader without WebGL receives keep text alternatives and their source tables. */
test('AC29: without WebGL, static figures, the HTML book and the manual keep alt text and source tables',()=>{
 const WEBGL=/<canvas\b|webgl|<script\b|<foreignObject\b|(?:href|src)="https?:/i;
 for(const p of baselines.filter(p=>p.views.length&&p.nodes.length).slice(0,8)){
  for(const viewId of views(p))for(const type of ['exploded','layers','architecture'] as const){
   const svg=designSvg(p,viewId,{type,now:NOW});
   assert.doesNotMatch(svg,WEBGL,`${p.id}/${viewId}/${type}: static and offline`);
   assert.match(svg,/^<svg[^>]*role="img"[^>]*aria-labelledby="[^"]+"/,`${p.id}/${viewId}/${type}: labelled figure`);
   const title=/<title id="[^"]+">([^<]+)<\/title>/.exec(svg)?.[1],desc=/<desc id="[^"]+">([^<]+)<\/desc>/.exec(svg)?.[1];
   assert.ok(title&&desc,`${p.id}/${viewId}/${type}: title and description`);
  }
  const book=designBookHtml(p,{type:'exploded',now:NOW});assert.doesNotMatch(book.replace(/<svg[\s\S]*?<\/svg>/g,''),/<canvas\b|webgl|<script\b/i);
  assert.equal((book.match(/<svg\b/g)??[]).length,(book.match(/<svg[^>]*role="img"/g)??[]).length,`${p.id}: every book figure is an image with a text alternative`);
  const manual=technicalManualHtml(p,{now:NOW});assert.doesNotMatch(manual,/<canvas\b|webgl|<script\b/i);
  for(const img of manual.match(/<img\b[^>]*>/g)??[])assert.match(img,/alt="[^"]+"/,`${p.id}: image alt text`);
  if(p.sources.length){const table=/<table aria-label="Sources">([\s\S]*?)<\/table>/.exec(manual)?.[1];assert.ok(table,`${p.id}: source table`);
   assert.equal((table!.match(/<tr>/g)??[]).length-1,p.sources.length,`${p.id}: one row per public source`);}
 }
});
