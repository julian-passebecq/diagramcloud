import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDocument,parseDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {adoptionJourneys,selfDescription,galaxyProcess,foilEnvironments,SELF_CITATIONS,JOURNEY_TAG} from '../src/intelligence/learning/journeys';
import {explanationGaps} from '../src/intelligence/learning/gaps';
import {lessonInstanceFacts,conceptsExplaining,mappingStatus} from '../src/intelligence/learning/mappings';
import {learningCatalogue} from '../src/intelligence/learning/catalogue';
import {galleryBucket,galleryCaption} from '../src/ui/Gallery';

const lines=(path:string)=>readFileSync(path,'utf8').split('\n');

test('adoption journeys: three valid gallery projects, registered with stable IDs, none observed',()=>{
 const journeys=adoptionJourneys();
 assert.deepEqual(journeys.map(p=>p.id),['journey-diagramcloud-self','journey-galaxy-agent-process','journey-foil-environments']);
 for(const p of journeys){
  assert.equal(validateDocument(p).id,p.id);assert.ok(samples.some(s=>s.id===p.id),p.id+' is in the gallery');
  assert.equal(galleryBucket(p),'journeys');assert.match(galleryCaption(p),/^Adoption journey · /);assert.ok(p.tags.includes(JOURNEY_TAG));
  assert.equal(p.observations.length,0,'no observed claim');assert.ok(p.nodes.every(n=>n.status==='idle'&&n.basis!==undefined),'designed status stays idle; every component has a basis');
  assert.deepEqual(parseDocument(JSON.stringify(p)),p,'save/reopen keeps the same identities');
  assert.deepEqual(publicDocument(p).nodes.map(n=>n.id),p.nodes.map(n=>n.id),'everything in a journey is public');
 }
 assert.equal(samples.filter(s=>galleryBucket(s)==='recipes').length,5,'the recipe bucket is unchanged');
});

test('self-description: only static-source components, each citing a real file:line of this repository',()=>{
 const d=selfDescription();
 assert.ok(d.nodes.every(n=>n.basis==='static-source'&&n.sourceIds.length>0));
 for(const c of SELF_CITATIONS){assert.ok(lines(c.path)[c.line-1]?.includes(c.token),`${c.path}:${c.line} still contains ${c.token}`);assert.equal(d.sources.find(s=>s.id===c.id)?.location,`${c.path}:${c.line}`);}
 assert.ok(lines('AGENTS.md')[18].includes('Use a feature branch'),'Galaxy procedure citation AGENTS.md:19');
 assert.ok(d.blocks.every(b=>b.provenance==='source-derived'));
});

test('self-description: two source-declared concept mappings with file:line evidence, shown in the lesson and on the component',()=>{
 const d=selfDescription(),maps=d.learningMappings??[];
 assert.deepEqual(maps.map(m=>[m.conceptId,m.target.id,m.state,m.origin]),[['workflow-agent','review','source-declared','source'],['worktrees-ci','ci','source-declared','source']]);
 for(const m of maps){
  assert.equal(mappingStatus(d,m).state,'source-declared','not stale');assert.ok(m.evidence.sourceIds.every(id=>/:\d+$/.test(d.sources.find(s=>s.id===id)!.location)));
  const entry=learningCatalogue.find(e=>e.id===m.conceptId)!;assert.equal(m.contentRevision,entry.editorial.contentRevision);
  const facts=lessonInstanceFacts(d,entry,{publicMode:true});assert.equal(facts.gap,null);assert.equal(facts.established[0].open?.nodeId,m.target.id);
 }
 assert.equal(conceptsExplaining(d,'review',{publicMode:true})[0].title,'Deterministic workflow versus model-directed agent');
 assert.equal(publicDocument(d).learningMappings?.length,2,'source-declared mappings survive public projection');
});

test('Galaxy process: procedure, synthetic attempt, lesson and live process stay distinct; nothing pretends to be a run',()=>{
 const d=galaxyProcess(),root=d.views.find(v=>v.id===d.rootViewId)!;
 assert.deepEqual(root.nodeIds,['procedure','attempt','lesson-ref','live']);
 assert.equal(d.views.find(v=>v.id==='procedure-steps')!.nodeIds.join(' '),'session worktree pr ci-run merge handoff');
 assert.ok(d.blocks.filter(b=>b.type==='table').every(b=>b.provenance==='synthetic'),'the attempt is synthetic');
 assert.ok(d.nodes.filter(n=>!n.sourceIds.length&&n.basis==='planned'&&d.views.find(v=>v.id==='procedure-steps')!.nodeIds.includes(n.id)).every(n=>/Synthetic/.test(n.role)),'unsourced steps say so');
 assert.ok(!d.atlas,'no commit graph or snapshot: Lens stays the Git microscope');
 assert.equal(d.learningMappings,undefined);
});

test('FOIL slice: environments are instances, refinement is separate, PROD has no declared realization',()=>{
 const d=foilEnvironments(),delivery=d.delivery!;
 assert.deepEqual(delivery.environments.map(e=>e.label),['DEV','TEST','PROD']);
 assert.deepEqual(delivery.instances.map(i=>[i.environmentId,i.componentId]),[['env-dev','capability'],['env-test','capability']]);
 const refinement=d.views.find(v=>v.id==='refinement-detail')!,environments=d.views.find(v=>v.id==='environment-detail')!;
 assert.deepEqual(refinement.nodeIds,['bronze','silver','gold']);assert.ok(!environments.nodeIds.some(id=>refinement.nodeIds.includes(id)),'bronze/silver/gold is not DEV/TEST/PROD');
 assert.equal(d.views.find(v=>v.id===d.rootViewId)!.nodeIds.length,4,'macro by default');
 assert.ok(d.tags.includes('Synthetic')&&d.blocks.filter(b=>b.type==='table').every(b=>b.provenance==='synthetic'));
});

test('explanation gaps: timing, quantities and mappings are named as missing instead of drawn',()=>{
 const g=explanationGaps(galaxyProcess(),'procedure-steps')!;
 assert.deepEqual(g.gaps.map(x=>[x.key,x.state]),[['timing','missing'],['quantities','missing'],['mappings','missing']]);
 assert.equal(g.gaps[0].withheld,'Scheduled timeline (Gantt)');assert.equal(g.gaps[1].withheld,'Sankey flow figure');assert.equal(g.missing,3);
 const self=explanationGaps(selfDescription(),'overview')!;
 assert.equal(self.gaps.find(x=>x.key==='mappings')!.state,'supplied');assert.match(self.gaps[0].reason,/story order is a presentation sequence, not timing/);
 const q=structuredClone(foilEnvironments());q.edges.find(e=>e.id==='refinement-detail-e0')!.quantity={value:112,unit:'rows',provenance:'synthetic'};
 assert.equal(explanationGaps(q,'refinement-detail')!.gaps[1].state,'partial');
 for(const e of q.edges.filter(e=>e.id.startsWith('refinement-detail')))e.quantity={value:1,unit:'rows',provenance:'synthetic'};
 assert.deepEqual(explanationGaps(q,'refinement-detail')!.gaps[1],{...explanationGaps(q,'refinement-detail')!.gaps[1],state:'supplied',withheld:null});
 assert.equal(explanationGaps(q,'missing-view'),null);
});
