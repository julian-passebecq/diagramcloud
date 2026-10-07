import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {designSvg,resolveDesignType} from '../src/export/design';
import {explodedPlanes} from '../src/export/design/layers';
import {designContext} from '../src/export/design/context';
import {elbowPath} from '../src/export/design/kit';
import {fanAttachPoints} from '../src/export/design/architecture';
import {applyDesignBrief,parseDesignBrief} from '../src/core/designBrief';
import {niceTicks} from '../src/export/design/chart';
import {flowRanks,flowMessages,swimlaneLayout} from '../src/export/design/flow';
import {validateDocument,DESIGN_THEMES,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {viewSpec} from '../src/core/viewspec';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z'),TYPES=['architecture','layers','exploded','tree','swimlane','sequence','timeline','chart'] as const;
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');

test('Diagram Design: every type and theme is well-formed, accessible, offline, script-free and deterministic',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,4)])for(const type of TYPES)for(const theme of DESIGN_THEMES){
  const svg=designSvg(d,d.rootViewId,{type,theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${type} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],type,label);assert.equal(root.attrs['data-theme'],theme,label);
  const [titleId,descId]=root.attrs['aria-labelledby'].split(' '),ids=attr(svg,'id');
  assert.ok(ids.includes(titleId)&&ids.includes(descId),label);assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  assert.equal(root.children.find(c=>c.name)?.name,'title',`${label}: title first`);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|@import|@font-face|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(designSvg(d,d.rootViewId,{type,theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('Diagram Design architecture draws every public component and connection with rounded right-angle connectors only',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,6)]){
  const spec=viewSpec(d,d.rootViewId,{now:NOW}),svg=designSvg(d,d.rootViewId,{type:'architecture',now:NOW});
  assert.deepEqual(attr(svg,'data-node-id').sort(),spec.nodes.map(n=>n.id).sort(),d.id);
  assert.deepEqual(attr(svg,'data-edge-id').sort(),spec.edges.map(e=>e.id).sort(),d.id);
  for(const e of els(svg).filter(e=>e.attrs['data-edge-id'])){
   // Straight runs (L) are horizontal or vertical; bends are quarter curves (Q) between two such runs.
   const cmds=e.attrs.d.match(/[MLQ][^MLQ]*/g)!;let at={x:0,y:0};
   for(const c of cmds){const n=c.slice(1).trim().split(/\s+/).map(Number);
    if(c[0]==='L')assert.ok(Math.abs(n[0]-at.x)<0.11||Math.abs(n[1]-at.y)<0.11,`${d.id} ${e.attrs['data-edge-id']}: diagonal run ${c}`);
    at={x:n[n.length-2],y:n[n.length-1]};}
  }
 }
});

test('connectors sharing one side of a box fan out at L·k/(N+1); bends have radius 8',()=>{
 const box={id:'a',x:0,y:0,w:100,h:60},routes=fanAttachPoints([[{x:100,y:30},{x:200,y:30}],[{x:100,y:30},{x:150,y:30},{x:150,y:120},{x:200,y:120}]],[box]);
 assert.deepEqual(routes.map(r=>r[0].y),[20,40]);assert.ok(routes.every(r=>r[0].y===r[1].y));
 assert.equal(elbowPath([{x:0,y:0},{x:50,y:0},{x:50,y:50}]),'M 0 0 L 42 0 Q 50 0 50 8 L 50 50');
});

test('Diagram Design figures are public: private components, labels and focal hints never appear',()=>{
 const d=contosoForecasting(),secret=d.nodes.find(n=>n.id==='bronze')!;secret.visibility='private';secret.label='Secret console <&>';
 const root=d.views.find(v=>v.id===d.rootViewId)!;root.design={type:'architecture',focal:['bronze'],theme:'dark'};
 const doc=validateDocument(d);
 assert.deepEqual(publicDocument(doc).views.find(v=>v.id===d.rootViewId)!.design!.focal,[]);
 for(const type of TYPES){const svg=designSvg(doc,doc.rootViewId,{type,now:NOW});
  assert.ok(!svg.includes('Secret console')&&!svg.includes('"bronze"'),type);assert.ok(!attr(svg,'data-node-id').includes('bronze'),type);}
});

test('focal: design hints win (at most two), else one strictly most-connected component, else none; accent stays on focal only',()=>{
 const d=contosoForecasting(),root=d.views.find(v=>v.id===d.rootViewId)!;
 assert.throws(()=>validateDocument({...d,views:d.views.map(v=>v.id===root.id?{...v,design:{type:'auto',focal:['nope'],}}:v)}),/focal component nope is not in this view/);
 assert.throws(()=>validateDocument({...d,views:d.views.map(v=>v.id===root.id?{...v,design:{type:'auto',focal:root.nodeIds.slice(0,3)}}:v)}));
 const auto=designContext(d,root.id,'architecture',{now:NOW});assert.ok(auto.focal.size<=1);
 const hinted=structuredClone(d);hinted.views.find(v=>v.id===root.id)!.design={type:'architecture',focal:root.nodeIds.slice(0,2)};
 const c=designContext(validateDocument(hinted),root.id,'architecture',{now:NOW});assert.deepEqual([...c.focal],root.nodeIds.slice(0,2));assert.equal(c.focalReason,'hint');
 const svg=designSvg(validateDocument(hinted),root.id,{now:NOW}),accented=els(svg).filter(e=>e.attrs['data-node-id']&&e.children.some(r=>r.name==='rect'&&r.attrs.stroke==='#eb6c36'));
 assert.deepEqual(accented.map(e=>e.attrs['data-node-id']).sort(),root.nodeIds.slice(0,2).sort());
});

test('the view hint picks the figure; Auto means Architecture',()=>{
 const d=structuredClone(contosoForecasting());assert.equal(resolveDesignType(d,d.rootViewId),'architecture');
 d.views.find(v=>v.id===d.rootViewId)!.design={type:'exploded',focal:[],caption:'Three levels, one save'};
 const doc=validateDocument(d),svg=designSvg(doc,doc.rootViewId,{now:NOW});
 assert.equal(find(parseXml(svg),'svg')!.attrs['data-design-type'],'exploded');assert.ok(texts(svg).includes('Three levels, one save'));
 assert.equal(find(parseXml(designSvg(doc,doc.rootViewId,{type:'tree',now:NOW})),'svg')!.attrs['data-design-type'],'tree');
});

test('exploded stack keeps the parent: the drilldown chain through the view, else the view layers',()=>{
 const d=contosoForecasting(),child=d.nodes.find(n=>n.childViewId&&d.views.find(v=>v.id===d.rootViewId)!.nodeIds.includes(n.id))!.childViewId!;
 const atChild=explodedPlanes(designContext(d,child,'exploded',{now:NOW}));
 assert.equal(atChild.basis,'drilldown');assert.equal(atChild.planes[0].key,d.rootViewId);assert.ok(atChild.planes.some(p=>p.key===child&&p.focal));
 const flat=validateDocument({...structuredClone(d),nodes:d.nodes.map(n=>({...n,childViewId:undefined}))});
 const layers=explodedPlanes(designContext(flat,flat.rootViewId,'exploded',{now:NOW}));
 assert.equal(layers.basis,'layers');assert.ok(layers.planes.length>=2);
});

test('drilldown tree draws every public view reachable from the root, once',()=>{
 for(const d of [contosoForecasting(),samples[0]]){const safe=publicDocument(d),svg=designSvg(d,d.rootViewId,{type:'tree',now:NOW}),refs=attr(svg,'data-view-ref');
  assert.equal(new Set(refs).size,refs.length,d.id);assert.equal(refs.length,Math.min(40,safe.views.length),d.id);}
});

test('design brief: presentation hints only, reviewed like an import; mismatches reported, nothing else changes',()=>{
 const d=contosoForecasting(),root=d.views.find(v=>v.id===d.rootViewId)!;
 const brief=parseDesignBrief(JSON.stringify({format:'diagramcloud.design-brief',version:1,projectId:d.id,author:'agent',views:[
  {viewId:root.id,type:'exploded',focal:[...root.nodeIds.slice(0,3),'ghost'],theme:'editorial',caption:'Ask: where does a save go?',why:'hero figure'},{viewId:'missing',type:'tree'}]}));
 const out=applyDesignBrief(d,brief,{fileName:'brief.json'}),v=out.document.views.find(v=>v.id===root.id)!;
 assert.deepEqual(v.design,{type:'exploded',focal:root.nodeIds.slice(0,2),theme:'editorial',caption:'Ask: where does a save go?'});
 assert.equal(out.report.format,'design-brief');assert.equal(out.report.pages,1);
 assert.ok(out.report.lost.some(l=>l.includes('missing: no such view')));assert.ok(out.report.lost.some(l=>l.includes('ghost')));assert.ok(out.report.lost.some(l=>l.includes('keeps two')));
 assert.deepEqual(out.document.nodes,d.nodes);assert.deepEqual(out.document.edges,d.edges);assert.deepEqual(out.document.observations,d.observations);assert.deepEqual(out.document.atlas,d.atlas);
 assert.deepEqual(out.document.views.map(({design:_,...rest})=>rest),d.views.map(({design:_,...rest})=>rest));
 assert.throws(()=>applyDesignBrief(d,{...brief,projectId:'other'}),/not contoso-forecasting/);
 assert.throws(()=>parseDesignBrief('{"format":"diagramcloud.design-brief","version":1,"views":[{"viewId":"x","nodes":[]}]}'),/rejected/);
 assert.throws(()=>parseDesignBrief('nope'),/not valid JSON/);
 assert.throws(()=>applyDesignBrief(d,parseDesignBrief(JSON.stringify({format:'diagramcloud.design-brief',version:1,views:[{viewId:'zzz'}]}))),/No view of this brief/);
});

test('the bundled example brief applies to the Contoso sample',()=>{
 const brief=parseDesignBrief(readFileSync('docs/design-brief.example.json','utf8')),out=applyDesignBrief(contosoForecasting(),brief);
 assert.equal(out.report.lost.length,0);
});

test('text is escaped once: markup in labels stays text',()=>{
 const d=structuredClone(contosoForecasting()),n=d.nodes.find(n=>d.views.find(v=>v.id===d.rootViewId)!.nodeIds.includes(n.id))!;n.label='A <b>&</b> "q"';
 const doc=validateDocument(d as Project);
 for(const type of TYPES){const svg=designSvg(doc,doc.rootViewId,{type,now:NOW});assert.ok(!svg.includes('<b>'),type);parseXml(svg);}
});

test('reading order: longest path from the components nothing points to, cycles broken deterministically',()=>{
 const n=(id:string,x:number)=>({id,label:id,kind:'process' as const,provider:'',summary:'',basis:'unspecified' as const,designStatus:'idle' as const,evidenceRefs:[],sourceRefs:[],position:{x,y:0}});
 const e=(id:string,from:string,to:string)=>({id,from,to,label:'',kind:'batch' as const,basis:'unspecified' as const});
 const nodes=[n('a',0),n('b',300),n('c',600),n('d',900)],edges=[e('1','a','b'),e('2','b','c'),e('3','c','b'),e('4','a','c'),e('5','c','d')];
 assert.deepEqual(Object.fromEntries(flowRanks(nodes,edges)),{a:0,b:1,c:2,d:3});
 assert.deepEqual(flowMessages(nodes,edges).map(m=>m.id),['1','4','2','3','5']);
});

test('swimlane: one lane per layer (or repository), every component in exactly one lane, columns in reading order',()=>{
 const d=contosoForecasting(),c=designContext(d,d.rootViewId,'swimlane',{now:NOW}),plan=swimlaneLayout(c);
 const members=plan.lanes!.flatMap(l=>l.members);assert.deepEqual([...members].sort(),c.spec.nodes.map(n=>n.id).sort());
 const svg=designSvg(d,d.rootViewId,{type:'swimlane',now:NOW});assert.equal(attr(svg,'data-lane').length,plan.lanes!.length);
 assert.ok(plan.positions.planner.x<plan.positions.chart.x);
});

test('sequence: every connection of the view is one numbered message; the order is labelled as reading order',()=>{
 const d=contosoForecasting(),spec=viewSpec(d,d.rootViewId,{now:NOW}),svg=designSvg(d,d.rootViewId,{type:'sequence',now:NOW});
 assert.deepEqual(attr(svg,'data-edge-id').sort(),spec.edges.map(e=>e.id).sort());assert.ok(texts(svg).includes('not from timing'));
});

test('story timeline: public steps only, private ones counted; no story is said, not invented',()=>{
 const d=structuredClone(contosoForecasting());d.views.find(v=>v.id==='policy')!.visibility='private';
 const doc=validateDocument(d),svg=designSvg(doc,doc.rootViewId,{type:'timeline',now:NOW}),shown=publicDocument(doc).story.length;
 assert.equal(attr(svg,'data-step').length,shown);if(shown<doc.story.length)assert.ok(texts(svg).includes('on private views not drawn'));
 const empty=validateDocument({...structuredClone(contosoForecasting()),story:[]});assert.ok(texts(designSvg(empty,empty.rootViewId,{type:'timeline',now:NOW})).includes('no public story yet'));
});

test('chart: a table evidence block of the view, its provenance printed on the figure; axis covers every value',()=>{
 const total=samples.find(s=>s.id==='total-project-controls')!,svg=designSvg(total,'reporting',{type:'chart',now:NOW});
 assert.equal(attr(svg,'data-provenance')[0],'synthetic');assert.ok(texts(svg).includes('SYNTHETIC DATA'));assert.ok(texts(svg).includes('Not a measured or verified result'));
 assert.deepEqual(attr(svg,'data-value').map(Number),[120,120,180,300,220,520,260,780]);
 const ticks=niceTicks(0,780);assert.ok(ticks[ticks.length-1]>=780&&ticks[0]===0);assert.deepEqual(niceTicks(-1000,420000).slice(0,2),[-100000,0]);
 const none=designSvg(contosoForecasting(),'overview',{type:'chart',now:NOW});assert.ok(texts(none).includes('No table evidence with numbers'));assert.equal(attr(none,'data-value').length,0);
});
