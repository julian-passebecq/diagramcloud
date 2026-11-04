import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {depthFigureDocument,depthHighlight,depthScene,depthSceneViewSpec,explore,lessonDiagrams,DEPTH_FIGURE,LESSON_JOURNEYS,SEMANTIC_DEPTHS,type ExplorerAction,type ExplorerState} from '../src/intelligence/learning/depth';
import {buildScene} from '../src/export/scene';
import {LessonDiagramFigure} from '../src/ui/LessonDiagramFigure';
import {lessonPlayback,playbackFrame,procedurePlayback,PLAYBACK_LABEL} from '../src/intelligence/learning/playback';
import {foilEnvironments,galaxyProcess} from '../src/intelligence/learning/journeys';
import {learningCatalogue} from '../src/intelligence/learning/catalogue';
import {LearningCatalogue} from '../src/ui/LearningCatalogue';

// Synthetic chain: root shows A, A opens v2 (B and a private node), B opens v3 (C), C opens v4 (D). Not an owner project.
const chain=():Project=>validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-depth',title:'Synthetic depth chain',rootViewId:'v1',
 nodes:[{id:'a',label:'A',kind:'app',childViewId:'v2'},{id:'b',label:'B',kind:'function',childViewId:'v3'},{id:'secret',label:'SYNTHETIC_PRIVATE',kind:'storage',visibility:'private'},{id:'c',label:'C',kind:'storage',childViewId:'v4'},{id:'d',label:'D',kind:'table'}],
 edges:[{id:'b-secret',source:'b',target:'secret',label:'private link'}],
 views:[{id:'v1',title:'Root',nodeIds:['a']},{id:'v2',title:'Inside A',nodeIds:['b','secret'],edgeIds:['b-secret']},{id:'v3',title:'Inside B',nodeIds:['c']},{id:'v4',title:'Inside C',nodeIds:['d']}]}));
const ids=(doc:Project,depth:typeof SEMANTIC_DEPTHS[number]['id'])=>depthScene(doc,doc.rootViewId,depth).nodes.map(n=>n.id);

test('semantic depth: Overview, Mechanism and Detail are explicit containment levels over the view',()=>{
 const doc=foilEnvironments(),overview=depthScene(doc,'overview','overview'),mechanism=depthScene(doc,'overview','architecture'),detail=depthScene(doc,'overview','detail');
 assert.deepEqual(overview.nodes.map(n=>n.id),['capability','refinement','environments','serving']);
 assert.deepEqual(overview.collapsed.map(c=>c.viewId),['refinement-detail','environment-detail']);
 assert.deepEqual(mechanism.nodes.map(n=>n.id),['capability','refinement','environments','serving','bronze','silver','gold','local-run','cloud-run']);
 assert.deepEqual(mechanism.nodes.filter(n=>n.container).map(n=>n.container+'>'+n.id),['refinement>bronze','refinement>silver','refinement>gold','environments>local-run','environments>cloud-run']);
 // A component already shown (capability) is not duplicated inside the container that also lists it.
 assert.equal(mechanism.nodes.filter(n=>n.id==='capability').length,1);assert.deepEqual(mechanism.collapsed,[]);
 assert.equal(overview.nodes[0].summary,undefined);assert.equal(mechanism.nodes[0].summary,undefined);
 assert.deepEqual(detail.nodes.find(n=>n.id==='refinement')!.evidence,['Synthetic refinement example']);
 assert.deepEqual([overview.level,mechanism.level,detail.level],[0,1,2]);assert.match(detail.note,/changes no environment, perspective, variant, run, audience or camera zoom/);
});
test('depth follows only explicit childViewId, is bounded at two levels, never revisits a view and applies the public projection',()=>{
 const doc=chain();
 assert.deepEqual(ids(doc,'overview'),['a']);assert.deepEqual(ids(doc,'architecture'),['a','b']);assert.deepEqual(ids(doc,'detail'),['a','b','c']);
 const detail=depthScene(doc,'v1','detail');
 assert.deepEqual(detail.collapsed,[{nodeId:'c',viewId:'v4',title:'Inside C'}]);assert.deepEqual(detail.views.map(v=>v.viewId+'@'+v.level+(v.via?'<'+v.via:'')),['v1@0','v2@1<a','v3@2<b']);
 assert.ok(!JSON.stringify(detail).includes('SYNTHETIC_PRIVATE'));assert.equal(detail.edges.length,0);
 assert.deepEqual(depthScene(doc,'v1','detail',{audience:'author'}).nodes.map(n=>n.id),['a','b','secret','c']);
 // A drilldown loop is rejected by the model itself, so depth never meets one.
 const looped=structuredClone(doc);looped.nodes.find(n=>n.id==='d')!.childViewId='v1';looped.views.find(v=>v.id==='v4')!.nodeIds=['d'];
 assert.throws(()=>validateDocument(looped));
});
test('camera zoom never changes depth or environment: each navigation dimension moves alone',()=>{
 const start:ExplorerState={depth:'architecture',zoom:1,environmentId:'env-test',perspective:'data'};
 const actions:ExplorerAction[]=[{type:'zoom',zoom:2},{type:'zoom',zoom:0.25},{type:'zoom',zoom:9},{type:'depth',depth:'detail'},{type:'environment',environmentId:'env-dev'},{type:'perspective',perspective:'cloud'}];
 const field={zoom:'zoom',depth:'depth',environment:'environmentId',perspective:'perspective'} as const;
 for(const action of actions){const next=explore(start,action),moved=field[action.type];
  for(const key of Object.keys(start) as (keyof ExplorerState)[])if(key!==moved)assert.equal(next[key],start[key],`${action.type} must not change ${key}`);}
 assert.equal(explore(start,{type:'zoom',zoom:9}).zoom,2);assert.equal(explore(start,{type:'zoom',zoom:0.1}).zoom,0.5);
 // The scene is a function of the document, view and depth only: there is no zoom or environment input to depthScene.
 const doc=foilEnvironments(),before=structuredClone(doc);
 assert.deepEqual(depthScene(doc,'overview','architecture'),depthScene(doc,'overview',explore(explore(start,{type:'zoom',zoom:2}),{type:'environment',environmentId:'env-prod'}).depth));
 for(const d of SEMANTIC_DEPTHS)depthScene(doc,'overview',d.id);assert.deepEqual(doc,before);
});
test('lesson examples and adoption journeys are offered as lesson diagrams; every journey link names a real lesson',()=>{
 const titles=(id:string)=>lessonDiagrams(learningCatalogue.find(e=>e.id===id)!).map(d=>d.kind+':'+d.id);
 assert.deepEqual(titles('star-grain'),['example:example-warehouse']);assert.deepEqual(titles('medallion-environments'),['journey:journey-foil']);
 assert.deepEqual(titles('worktrees-ci'),['journey:journey-galaxy','journey:journey-self']);assert.deepEqual(titles('oltp-olap'),[]);
 for(const row of LESSON_JOURNEYS)assert.ok(learningCatalogue.some(e=>e.id===row.lessonId),row.lessonId);
 for(const entry of learningCatalogue)for(const d of lessonDiagrams(entry)){const doc=d.load();for(const depth of SEMANTIC_DEPTHS)assert.ok(depthScene(doc,doc.rootViewId,depth.id,{audience:d.audience}).nodes.length>0);
  assert.equal(d.audience,d.kind==='journey'?'public':'author');}
});
test('lesson step playback walks the declared steps in order, clamped, labelled a presented sequence',()=>{
 for(const entry of learningCatalogue){const source=lessonPlayback(entry);if(!entry.lesson.example){assert.equal(source,null);continue;}
  assert.deepEqual(source!.steps.map(s=>s.label),entry.lesson.example.steps);
  const frames=source!.steps.map((_,i)=>playbackFrame(source!,i));assert.deepEqual(frames.map(f=>f.step.label),entry.lesson.example.steps);
  assert.equal(frames[0].atStart,true);assert.equal(frames.at(-1)!.atEnd,true);assert.equal(frames[0].label,'Presented sequence - not a run, not timing');
  assert.equal(playbackFrame(source!,-3).index,0);assert.equal(playbackFrame(source!,99).index,source!.steps.length-1);assert.equal(playbackFrame(source!,1).position,`Step 2 of ${source!.steps.length}`);}
 assert.equal(PLAYBACK_LABEL,'Presented sequence - not a run, not timing');
});
test('procedure playback follows a declared control chain and refuses to invent an order',()=>{
 const doc=galaxyProcess(),proc=procedurePlayback(doc,'procedure-steps')!;
 assert.deepEqual(proc.steps.map(s=>s.nodeId),['session','worktree','pr','ci-run','merge','handoff']);assert.match(proc.origin,/control connections/);
 assert.equal(procedurePlayback(doc,'overview'),null);assert.equal(procedurePlayback(foilEnvironments(),'overview'),null);assert.equal(procedurePlayback(chain(),'v1'),null);
 const branched=structuredClone(doc);branched.edges.push({...branched.edges.find(e=>e.source==='session')!,id:'extra',target:'pr'});branched.views.find(v=>v.id==='procedure-steps')!.edgeIds.push('extra');
 assert.equal(procedurePlayback(validateDocument(branched),'procedure-steps'),null);
});
test('step playback never creates an observation, attempt or run record and never mutates the document',()=>{
 const doc=galaxyProcess(),before=structuredClone(doc),proc=procedurePlayback(doc,'procedure-steps')!;
 for(let i=0;i<proc.steps.length;i++)playbackFrame(proc,i);
 assert.deepEqual(doc,before);assert.deepEqual(doc.observations,[]);
 for(const frame of proc.steps.map((_,i)=>playbackFrame(proc,i)))assert.deepEqual(Object.keys(frame).sort(),['atEnd','atStart','index','label','position','step']);
});
test('a lesson opened from its return context shows the diagram at that depth with labelled, keyboard-reachable playback',()=>{
 const entry=learningCatalogue.find(e=>e.id==='worktrees-ci')!;
 const html=renderToStaticMarkup(createElement(LearningCatalogue,{host:{initial:{lessonId:entry.id,depth:'architecture',contentRevision:entry.editorial.contentRevision}}}));
 assert.match(html,/Depth Mechanism · containment level 1 · \d+ components · camera zoom 100% · environment not chosen/);
 assert.ok(html.includes('aria-label="Inside Intended procedure (Intended procedure)"'));
 assert.ok(html.includes('Presented sequence - not a run, not timing'));assert.ok(html.includes('aria-label="Step playback: Declared procedure: Intended procedure" tabindex="0"'));
 assert.ok(html.includes('aria-label="Step playback: Lesson example steps" tabindex="0"'));assert.ok(html.includes('aria-current="step"'));
 const overview=renderToStaticMarkup(createElement(LearningCatalogue,{host:{initial:{lessonId:entry.id,depth:'overview',contentRevision:entry.editorial.contentRevision}}}));
 assert.ok(!overview.includes('Step playback: Declared procedure'));assert.match(overview,/Opens Intended procedure: shown at a deeper depth/);
});

// Spatial figure (1.34.0): the depth scene drawn by the shared export scene over a derived view.
test('the depth figure view holds exactly the depth scene IDs for every lesson diagram and depth',()=>{
 for(const entry of learningCatalogue)for(const d of lessonDiagrams(entry)){const doc=d.load(),source=depthFigureDocument(doc,d.audience);
  for(const depth of SEMANTIC_DEPTHS){const scene=depthScene(doc,doc.rootViewId,depth.id,{audience:d.audience}),figure=depthSceneViewSpec(scene,source);
   assert.deepEqual(figure.view.nodeIds,scene.nodes.map(n=>n.id));assert.deepEqual(figure.view.edgeIds,scene.edges.map(e=>e.id));
   assert.deepEqual(Object.keys(figure.view.positions).sort(),scene.nodes.map(n=>n.id).sort());
   const built=buildScene(source,figure.view);
   assert.deepEqual(built.nodes.map(n=>n.id).sort(),scene.nodes.map(n=>n.id).sort());assert.deepEqual(built.edges.map(e=>e.id).sort(),scene.edges.map(e=>e.id).sort());
   assert.deepEqual(figure.frames.map(f=>f.viewId).sort(),scene.views.filter(v=>v.via).map(v=>v.viewId).sort());
   // Every frame encloses the components first shown in its view.
   for(const f of figure.frames)for(const n of scene.nodes.filter(n=>n.viewId===f.viewId)){const p=figure.view.positions[n.id];
    assert.ok(p.x>=f.x&&p.y>=f.y+DEPTH_FIGURE.header&&p.x+DEPTH_FIGURE.box.w<=f.x+f.w&&p.y+DEPTH_FIGURE.box.h<=f.y+f.h,`${n.id} inside ${f.viewId}`);}
  }}
});
test('the depth figure keeps the public projection: author-only components are absent from the public audience',()=>{
 const doc=chain(),pub=depthScene(doc,'v1','detail'),figure=depthSceneViewSpec(pub,depthFigureDocument(doc,'public'));
 assert.ok(!figure.view.nodeIds.includes('secret'));assert.deepEqual(figure.view.edgeIds,[]);assert.ok(!JSON.stringify(figure).includes('SYNTHETIC_PRIVATE'));
 const html=renderToStaticMarkup(createElement(LessonDiagramFigure,{doc:depthFigureDocument(doc,'public'),scene:pub,figure,zoom:1,highlight:depthHighlight(pub,'b'),instances:new Set<string>(),depthLabel:'Detail'}));
 assert.ok(!html.includes('SYNTHETIC_PRIVATE'));assert.ok(!html.includes('private link'));assert.match(html,/data-figure-node-id="b" data-highlighted="true"/);
 const author=depthScene(doc,'v1','detail',{audience:'author'}),authored=depthSceneViewSpec(author,doc);
 assert.ok(authored.view.nodeIds.includes('secret'));assert.deepEqual(authored.view.edgeIds,['b-secret']);
 // Frames nest by drilldown: Inside B sits within the frame of Inside A.
 const [inA,inB]=figure.frames;assert.deepEqual([inA.viewId,inA.via,inB.viewId,inB.via],['v2','a','v3','b']);
 assert.ok(inB.x>inA.x&&inB.y>inA.y&&inB.x+inB.w<=inA.x+inA.w&&inB.y+inB.h<=inA.y+inA.h);
});
test('a connection never becomes a container in the depth figure',()=>{
 const flat=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-flat',title:'Synthetic flat',rootViewId:'v1',
  nodes:[{id:'a',label:'A',kind:'app'},{id:'b',label:'B',kind:'function'}],edges:[{id:'a-b',source:'a',target:'b',label:'contains',kind:'dependency'}],
  views:[{id:'v1',title:'Root',nodeIds:['a','b'],edgeIds:['a-b']},{id:'v2',title:'Unlinked',nodeIds:['b']}]}));
 for(const d of SEMANTIC_DEPTHS){const scene=depthScene(flat,'v1',d.id),figure=depthSceneViewSpec(scene,flat);
  assert.deepEqual(figure.frames,[]);assert.deepEqual(figure.view.nodeIds,['a','b']);assert.deepEqual(figure.view.edgeIds,['a-b']);}
 const foil=foilEnvironments(),scene=depthScene(foil,'overview','architecture');
 assert.deepEqual(depthSceneViewSpec(scene,foil).frames.map(f=>f.via+'>'+f.viewId),['refinement>refinement-detail','environments>environment-detail']);
});
test('a played step highlights its component and only the scene connections that touch it',()=>{
 const doc=galaxyProcess(),scene=depthScene(doc,doc.rootViewId,'architecture'),proc=procedurePlayback(doc,'procedure-steps')!;
 const worktree=depthHighlight(scene,'worktree');assert.deepEqual(worktree.nodeIds,['worktree']);
 assert.ok(worktree.edgeIds.length>=2);for(const id of worktree.edgeIds){const e=scene.edges.find(e=>e.id===id)!;assert.ok(e.from==='worktree'||e.to==='worktree');}
 assert.deepEqual(depthHighlight(scene,null),{nodeIds:[],edgeIds:[]});assert.deepEqual(depthHighlight(scene,'not-in-scene'),{nodeIds:[],edgeIds:[]});
 assert.deepEqual(depthHighlight(depthScene(doc,doc.rootViewId,'overview'),'worktree'),{nodeIds:[],edgeIds:[]});
 for(const step of proc.steps)assert.deepEqual(depthHighlight(scene,step.nodeId).nodeIds,[step.nodeId]);
});
test('the lesson renders a spatial figure for each depth beside the list alternative',()=>{
 const entry=learningCatalogue.find(e=>e.id==='medallion-environments')!;
 for(const d of SEMANTIC_DEPTHS){const html=renderToStaticMarkup(createElement(LearningCatalogue,{host:{initial:{lessonId:entry.id,depth:d.id,contentRevision:entry.editorial.contentRevision}}}));
  const scene=depthScene(foilEnvironments(),'overview',d.id);
  assert.ok(html.includes('data-testid="lesson-diagram-figure"'));assert.ok(html.includes(`data-depth="${d.id}"`));
  assert.equal((html.match(/data-figure-node-id=/g)??[]).length,scene.nodes.length);assert.equal((html.match(/ data-node-id=/g)??[]).length,scene.nodes.length);
  assert.equal((html.match(/data-figure-frame=/g)??[]).length,d.level?2:0);assert.match(html,/The list below is the text and keyboard alternative/);}
});
