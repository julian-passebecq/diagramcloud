import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {depthScene,depthSceneViewSpec,explore,type ExplorerState} from '../src/intelligence/learning/depth';
import {backTarget,drillTarget,figureInteraction,selectedIn,FIGURE_INITIAL} from '../src/intelligence/learning/figureInteraction';
import {foilEnvironments} from '../src/intelligence/learning/journeys';
import {learningCatalogue} from '../src/intelligence/learning/catalogue';
import {LearningCatalogue} from '../src/ui/LearningCatalogue';
import {LessonDiagramFigure} from '../src/ui/LessonDiagramFigure';

// Synthetic chain (not an owner project): root shows A, A opens v2 (B), B opens v3 (C), C opens v4 (D).
const chain=():Project=>validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-figure',title:'Synthetic figure chain',rootViewId:'v1',
 nodes:[{id:'a',label:'A',kind:'app',childViewId:'v2'},{id:'b',label:'B',kind:'function',childViewId:'v3'},{id:'c',label:'C',kind:'storage',childViewId:'v4'},{id:'d',label:'D',kind:'table'}],edges:[],
 views:[{id:'v1',title:'Root',nodeIds:['a']},{id:'v2',title:'Inside A',nodeIds:['b']},{id:'v3',title:'Inside B',nodeIds:['c']},{id:'v4',title:'Inside C',nodeIds:['d']}]}));

test('one selection: select, toggle off and a component outside the scene is never shown as selected',()=>{
 const doc=foilEnvironments(),overview=depthScene(doc,'overview','overview'),mechanism=depthScene(doc,'overview','architecture');
 let s=figureInteraction(FIGURE_INITIAL,{type:'select',nodeId:'refinement'});
 assert.equal(selectedIn(overview,s),'refinement');
 s=figureInteraction(s,{type:'select',nodeId:'silver'});
 assert.equal(selectedIn(overview,s),null,'silver is not drawn at Overview');assert.equal(selectedIn(mechanism,s),'silver');
 assert.deepEqual(figureInteraction(s,{type:'select',nodeId:null}),{selected:null,trail:[]});
});
test('Open inside drills one depth only for a collapsed component, follows explicit childViewId and stops at two levels',()=>{
 const doc=chain(),overview=depthScene(doc,'v1','overview');
 assert.deepEqual(drillTarget(overview,'a'),{depth:'architecture',viewId:'v2',title:'Inside A'});
 assert.equal(drillTarget(overview,'missing'),null);assert.equal(drillTarget(overview,null),null);
 const mechanism=depthScene(doc,'v1','architecture');
 assert.equal(drillTarget(mechanism,'a'),null,'A is already open');
 assert.deepEqual(drillTarget(mechanism,'b'),{depth:'detail',viewId:'v3',title:'Inside B'});
 // The drilled scene really opens the target view through the drilled component.
 assert.ok(mechanism.views.some(v=>v.viewId==='v2'&&v.via==='a'));
 const detail=depthScene(doc,'v1','detail');
 assert.deepEqual(detail.collapsed.map(c=>c.nodeId),['c']);assert.equal(drillTarget(detail,'c'),null,'two-level bound');
 // FOIL journey: every Overview container opens at Mechanism, and a leaf opens nothing.
 const foil=depthScene(foilEnvironments(),'overview','overview');
 assert.equal(drillTarget(foil,'refinement')?.depth,'architecture');assert.equal(drillTarget(foil,'capability'),null);
});
test('drill and Back form a trail of depths; Back reselects the drilled component and never goes below the lesson depth',()=>{
 let s=figureInteraction(FIGURE_INITIAL,{type:'select',nodeId:'a'});
 s=figureInteraction(s,{type:'drill',nodeId:'a',from:'overview'});
 s=figureInteraction(figureInteraction(s,{type:'select',nodeId:'b'}),{type:'drill',nodeId:'b',from:'architecture'});
 assert.deepEqual(s.trail,[{from:'overview',nodeId:'a'},{from:'architecture',nodeId:'b'}]);assert.equal(backTarget(s)?.from,'architecture');
 s=figureInteraction(s,{type:'back'});assert.deepEqual(s,{selected:'b',trail:[{from:'overview',nodeId:'a'}]});
 s=figureInteraction(s,{type:'back'});assert.deepEqual(s,{selected:'a',trail:[]});
 assert.equal(backTarget(s),null);assert.equal(figureInteraction(s,{type:'back'}),s);
 // A lesson depth change resets the trail and keeps the selection.
 assert.deepEqual(figureInteraction({selected:'a',trail:[{from:'overview',nodeId:'a'}]},{type:'reset'}),{selected:'a',trail:[]});
});
test('drilling moves only the depth: zoom, environment and perspective stay, and the document is untouched',()=>{
 const doc=foilEnvironments(),before=JSON.stringify(doc),scene=depthScene(doc,'overview','overview');
 const start:ExplorerState={depth:'overview',zoom:1.5,environmentId:'test',perspective:'data'};
 const target=drillTarget(scene,'environments')!,after=explore(start,{type:'depth',depth:target.depth});
 assert.deepEqual(after,{...start,depth:'architecture'});
 figureInteraction(FIGURE_INITIAL,{type:'drill',nodeId:'environments',from:'overview'});
 assert.equal(JSON.stringify(doc),before);
});
test('each drawn component is a real button named by its label, pressed only when selected',()=>{
 const doc=foilEnvironments(),scene=depthScene(doc,'overview','architecture'),figure=depthSceneViewSpec(scene,doc);
 const html=renderToStaticMarkup(createElement(LessonDiagramFigure,{doc,scene,figure,zoom:1,highlight:{nodeIds:[],edgeIds:[]},instances:new Set<string>(),depthLabel:'Mechanism',selected:'silver',onSelect:()=>{}}));
 const buttons=html.match(/<button[^>]*data-figure-hit="[^"]+"[^>]*>/g)??[];
 assert.equal(buttons.length,scene.nodes.length);
 for(const n of scene.nodes)assert.ok(buttons.some(b=>b.includes(`data-figure-hit="${n.id}"`)&&b.includes(`aria-label="${n.label}"`)&&b.includes('type="button"')),n.id);
 assert.deepEqual(buttons.filter(b=>b.includes('aria-pressed="true"')).map(b=>/data-figure-hit="([^"]+)"/.exec(b)![1]),['silver']);
});
test('the lesson shows an empty selected-component panel and list Select buttons until a component is chosen',()=>{
 const entry=learningCatalogue.find(e=>e.id==='medallion-environments')!;
 const html=renderToStaticMarkup(createElement(LearningCatalogue,{host:{initial:{lessonId:entry.id,depth:'overview',contentRevision:entry.editorial.contentRevision}}}));
 assert.match(html,/aria-label="Selected component"/);assert.match(html,/Select a component in the figure/);
 assert.equal((html.match(/aria-label="Select [^"]+ in the figure"/g)??[]).length,depthScene(foilEnvironments(),'overview','overview').nodes.length);
 assert.ok(!html.includes('data-figure-back'));
});
