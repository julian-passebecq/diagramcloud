import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type LearningMapping,type Project} from '../src/core/model';
import {publicDocument,removeNode} from '../src/core/operations';
import {describeChanges} from '../src/core/changeDetail';
import {targetFingerprint} from '../src/core/learningMapping';
import {learningCatalogue} from '../src/intelligence/learning/catalogue';
import {conceptsExplaining,lessonInstanceFacts,mappingCandidates,mappingStatus,rejectMapping,reviewMapping,savedExplanation,suggestMapping,CANDIDATE_LABEL} from '../src/intelligence/learning/mappings';

const star=learningCatalogue.find(e=>e.id==='star-grain')!;
const base=():Project=>validateDocument({schemaVersion:1,id:'mapping-fixture',title:'Mapping fixture',rootViewId:'overview',author:'Julian',
 sources:[{id:'src-pub',title:'Warehouse model doc',location:'docs/model.md'},{id:'src-priv',title:'Private sizing notes',location:'notes/secret.md',visibility:'private'}],
 blocks:[{id:'blk-pub',type:'text',title:'Grain statement',text:'One row per order line.'}],
 nodes:[{id:'facts',label:'Sales star schema',kind:'table',tags:['warehouse'],sourceIds:['src-pub'],blockIds:['blk-pub'],childViewId:'detail'},
  {id:'named',label:'Star grain dashboard',kind:'report'},
  {id:'hidden',label:'Hidden star grain mart',kind:'table',sourceIds:['src-pub'],visibility:'private'},
  {id:'mixed',label:'Orders',kind:'table',sourceIds:['src-pub','src-priv']},
  {id:'inner',label:'Inner step',kind:'process',sourceIds:['src-pub']}],
 edges:[],views:[{id:'overview',title:'Overview',nodeIds:['facts','named','hidden','mixed']},{id:'detail',title:'Detail',nodeIds:['inner']},{id:'private-view',title:'Private view',nodeIds:['inner'],visibility:'private'}]});
const suggested=(doc:Project,id:string,kind:'node'|'view'='node')=>suggestMapping(doc,{conceptId:star.id,target:{kind,id}});
const reviewed=(doc:Project,id:string,kind:'node'|'view'='node')=>{const d=suggested(doc,id,kind);const m=d.learningMappings!.at(-1)!;return reviewMapping(d,m.id,{reviewedBy:'Julian',reviewedAt:'2026-10-16T10:00:00Z',evidence:{sourceIds:['src-pub'],blockIds:[]}});};

test('a basic document stays valid without mappings and publishes none',()=>{
 const d=base();assert.equal(d.learningMappings,undefined);assert.equal(publicDocument(d).learningMappings,undefined);
 assert.equal(lessonInstanceFacts(d,star).gap?.startsWith('No reviewed mapping.'),true);
});

test('a suggestion binds exact revisions and cannot arrive reviewed',()=>{
 const d=suggested(base(),'facts'),m=d.learningMappings![0];
 assert.deepEqual({state:m.state,origin:m.origin,concept:m.conceptId,rev:m.contentRevision,project:m.target.projectId,docRev:m.target.projectRevision},{state:'suggested',origin:'author',concept:'star-grain',rev:star.editorial.contentRevision,project:'mapping-fixture',docRev:0});
 assert.equal(m.target.fingerprint,targetFingerprint(d,{kind:'node',id:'facts'}));
 for(const extra of [{state:'reviewed'},{reviewedBy:'assistant'},{reviewedAt:'2026-10-16T10:00:00Z'}])
  assert.throws(()=>suggestMapping(base(),{conceptId:star.id,target:{kind:'node',id:'facts'},...extra}));
 assert.throws(()=>suggestMapping(base(),{conceptId:'not-a-concept',target:{kind:'node',id:'facts'}}),/Unknown concept/);
 assert.throws(()=>suggestMapping(base(),{conceptId:star.id,target:{kind:'node',id:'nope'}}),/Unknown node/);
 assert.throws(()=>suggested(d,'facts'),/already mapped/);
 assert.equal(mappingStatus(d,m).state,'suggested');
 const facts=lessonInstanceFacts(d,star);assert.equal(facts.established.length,0);assert.equal(facts.suggested.length,1);assert.match(facts.gap!,/1 suggestion awaits review/);
});

test('a name-only match stays a candidate: no evidence, no review',()=>{
 const candidates=mappingCandidates(base(),star);
 assert.ok(candidates.some(c=>c.nodeId==='named'));assert.ok(candidates.every(c=>c.basis===CANDIDATE_LABEL));
 const d=suggested(base(),'named'),id=d.learningMappings![0].id;
 assert.throws(()=>reviewMapping(d,id,{reviewedBy:'Julian'}),/not evidence/);
 assert.throws(()=>reviewMapping(d,id,{reviewedBy:'Julian',evidence:{sourceIds:['missing-source'],blockIds:[]}}),/not evidence/);
 for(const state of ['reviewed','source-declared'] as const){const bad=clone(d);Object.assign(bad.learningMappings![0],{state,...(state==='reviewed'?{reviewedBy:'Julian',reviewedAt:'2026-10-16T10:00:00Z'}:{})});assert.throws(()=>validateDocument(bad),/not evidence/);}
 assert.equal(mappingCandidates(d,star).some(c=>c.nodeId==='named'),false,'an existing mapping is not proposed again');
});

test('no self-review: an AI suggestion is reviewed only by a person',()=>{
 const d=suggestMapping(base(),{conceptId:star.id,target:{kind:'node',id:'facts'},origin:'ai',suggestedBy:'assistant',evidence:{sourceIds:['src-pub'],blockIds:[]}}),id=d.learningMappings![0].id;
 assert.throws(()=>suggestMapping(base(),{conceptId:star.id,target:{kind:'node',id:'facts'},origin:'ai'}),/suggestedBy/);
 assert.throws(()=>reviewMapping(d,id,{reviewedBy:' Assistant '}),/cannot review itself/);
 const forged=clone(d);Object.assign(forged.learningMappings![0],{state:'reviewed',reviewedBy:'assistant',reviewedAt:'2026-10-16T10:00:00Z'});assert.throws(()=>validateDocument(forged),/cannot review itself/);
 const declared=clone(d);declared.learningMappings![0].state='source-declared';assert.throws(()=>validateDocument(declared),/not a source declaration/);
 const ok=reviewMapping(d,id,{reviewedBy:'Julian',reviewedAt:'2026-10-16T10:00:00Z'});
 assert.deepEqual({state:ok.learningMappings![0].state,by:ok.learningMappings![0].reviewedBy,origin:ok.learningMappings![0].origin},{state:'reviewed',by:'Julian',origin:'ai'});
 const unreviewed=clone(d);unreviewed.learningMappings![0].reviewedAt='2026-10-16T10:00:00Z';assert.throws(()=>validateDocument(unreviewed),/only a reviewed or rejected mapping records a reviewer/);
 const detail=describeChanges(base(),ok);assert.ok(detail.cautions.some(c=>c.includes('arrives already reviewed')));
 assert.ok(describeChanges(d,ok).cautions.some(c=>c.includes('Marks concept mapping')));
});

test('content revision, target evidence or target removal make a mapping stale, never silently rebound',()=>{
 const d=reviewed(base(),'facts'),m=d.learningMappings![0];
 assert.equal(mappingStatus(d,m).state,'reviewed');
 const changedCatalogue=learningCatalogue.map(e=>e.id===star.id?{...e,editorial:{...e.editorial,contentRevision:'2026-11-01.1'}}:e);
 const status=mappingStatus(d,m,changedCatalogue);assert.equal(status.state,'stale');assert.match(status.staleReasons.join(' '),/2026-10-16\.1 to 2026-11-01\.1/);
 const facts=lessonInstanceFacts(d,star,{catalogue:changedCatalogue});assert.equal(facts.established.length,0);assert.equal(facts.stale.length,1);assert.equal(facts.stale[0].open,null);assert.match(facts.gap!,/stale/);
 // Presentation edits do not change evidence; a cited source does.
 const relabelled=clone(d);relabelled.nodes.find(n=>n.id==='facts')!.label='Renamed';relabelled.nodes.find(n=>n.id==='facts')!.summary='New text';assert.equal(mappingStatus(validateDocument(relabelled),m).state,'reviewed');
 const evidence=clone(d);evidence.sources.find(s=>s.id==='src-pub')!.location='docs/other.md';assert.match(mappingStatus(validateDocument(evidence),m).staleReasons.join(' '),/evidence of node facts changed/);
 assert.equal(validateDocument(evidence).learningMappings![0].target.fingerprint,m.target.fingerprint,'stored binding is unchanged');
 const removed=removeNode(d,'facts');assert.match(mappingStatus(removed,removed.learningMappings![0]).staleReasons.join(' '),/no longer exists/);
 assert.throws(()=>reviewMapping(removed,m.id,{reviewedBy:'Julian'}),/no longer exists/);
 const other=clone(d);other.id='another-project';assert.match(mappingStatus(validateDocument(other),m).staleReasons.join(' '),/not this project/);
 // An explicit review is the only rebinding.
 const again=reviewMapping(validateDocument(evidence),m.id,{reviewedBy:'Julian',reviewedAt:'2026-10-17T10:00:00Z'});assert.equal(mappingStatus(again,again.learningMappings![0]).state,'reviewed');
 const rejected=rejectMapping(d,m.id,{reviewedBy:'Julian'});assert.equal(mappingStatus(rejected,rejected.learningMappings![0],changedCatalogue).state,'rejected');
 assert.equal(lessonInstanceFacts(rejected,star).rejected,1);assert.equal(conceptsExplaining(rejected,'facts').length,0);
});

test('reviewed mapping opens the exact component in a reachable view; Explained by links back',()=>{
 const d=reviewed(reviewed(base(),'facts'),'detail','view'),facts=lessonInstanceFacts(d,star);
 assert.equal(facts.gap,null);
 assert.deepEqual(facts.established.map(r=>[r.target.kind,r.target.id,r.open]),[['node','facts',{viewId:'overview',nodeId:'facts'}],['view','detail',{viewId:'detail'}]]);
 assert.deepEqual(facts.established[0].evidence,[{id:'src-pub',kind:'source',title:'Warehouse model doc'}]);
 const explained=conceptsExplaining(d,'facts');assert.deepEqual(explained.map(r=>[r.conceptId,r.title,r.state,r.contentRevision]),[['star-grain',star.title,'reviewed',star.editorial.contentRevision]]);
 const orphan=reviewed(base(),'private-view','view');assert.equal(lessonInstanceFacts(orphan,star).established[0].open,null,'an unreachable view has no fallback target');
});

test('public projection first: hidden components, views and private evidence never appear in lists, counts, search or exports',()=>{
 let d=reviewed(base(),'facts');d=reviewed(d,'hidden');d=reviewed(d,'private-view','view');d=suggested(d,'named');
 const mixed=suggestMapping(d,{conceptId:star.id,target:{kind:'node',id:'mixed'}});d=reviewMapping(mixed,mixed.learningMappings!.at(-1)!.id,{reviewedBy:'Julian',evidence:{sourceIds:['src-pub','src-priv'],blockIds:[]}});
 const onlyPrivate=suggestMapping(d,{conceptId:'oltp-olap',target:{kind:'node',id:'mixed'}});d=reviewMapping(onlyPrivate,onlyPrivate.learningMappings!.at(-1)!.id,{reviewedBy:'Julian',evidence:{sourceIds:['src-priv'],blockIds:[]}});
 assert.equal(lessonInstanceFacts(d,star).established.length,4);
 const pub=publicDocument(d),text=JSON.stringify(pub);
 assert.deepEqual(pub.learningMappings!.map(m=>[m.conceptId,m.target.id,m.evidence.sourceIds]),[['star-grain','facts',['src-pub']],['star-grain','mixed',['src-pub']]]);
 for(const leak of ['hidden','private-view','src-priv','map-star-grain-named','oltp-olap','Private sizing'])assert.equal(text.includes(leak),false,leak+' leaked into public output');
 const facts=lessonInstanceFacts(d,star,{publicMode:true});
 assert.deepEqual(facts.established.map(r=>r.target.id),['facts','mixed']);assert.equal(facts.suggested.length,0);assert.equal(facts.stale.length,0);assert.equal(facts.rejected,0);
 assert.equal(JSON.stringify(facts).includes('hidden'),false);
 assert.equal(mappingCandidates(d,star,{publicMode:true}).some(c=>c.nodeId==='hidden'),false,'candidate search runs on the public projection');
 assert.ok(mappingCandidates(base(),star).some(c=>c.nodeId==='hidden'),'the author still sees private candidates');
 assert.deepEqual(conceptsExplaining(d,'hidden',{publicMode:true}),[]);
 assert.deepEqual(conceptsExplaining(d,'mixed',{publicMode:true}).map(r=>r.conceptId),['star-grain'],'a mapping backed only by private evidence is not published');
 assert.deepEqual(publicDocument(pub).learningMappings,pub.learningMappings,'projection is idempotent');
 const saved=savedExplanation(d,star,'architecture');
 assert.deepEqual({format:saved.format,rev:saved.contentRevision,depth:saved.depth,targets:saved.instances.map(i=>i.target.id)},{format:'diagramcloud.saved-explanation/1',rev:star.editorial.contentRevision,depth:'architecture',targets:['facts','mixed']});
 assert.equal(saved.explanation,star.lesson.levels.architecture);assert.equal(JSON.stringify(saved).includes('hidden'),false);
 const privateMapping=clone(d);(privateMapping.learningMappings as LearningMapping[]).forEach(m=>m.visibility='private');assert.equal(publicDocument(validateDocument(privateMapping)).learningMappings,undefined);
});
