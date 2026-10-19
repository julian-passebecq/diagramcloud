import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {buildPracticalPatternCandidates,buildPracticalPatternProject,practicalSources} from '../examples/domain-data/patterns';
import {validateLearningCatalogue,learningEntrySchema,learningCatalogue,learningSources,catalogueRows,matchesCatalogueRow,lessonsForNativeEntry,problemKey} from '../src/intelligence/learning/catalogue';
import {PRACTICAL_RECONCILIATION,MIGRATION_LESSONS,WORLD_DATA_CASES} from '../src/intelligence/learning/practicalCards';
import {lessonContentProblems} from '../src/intelligence/learning/guards';
import {prepareLinkedReading,linkedReadingKey} from '../src/core/linkedReading';import {linkedReadingHtml} from '../src/export/linkedReadingHtml';
const {entries}=buildPracticalPatternCandidates();
test('six patterns validate through real unchanged learning schema',()=>{assert.equal(entries.length,6);assert.equal(validateLearningCatalogue(entries,practicalSources).length,6);entries.forEach(x=>learningEntrySchema.parse(x))});
test('new patterns do not assign legacy reference family or client mapping',()=>entries.forEach(x=>{assert.equal(x.editorial.applicability,'UNKNOWN_NOT_ASSESSED');assert.deepEqual(x.instanceMappings,[]);assert.equal('family' in x,false)}));
test('alternatives do not approve themselves',()=>entries.forEach(x=>x.lesson.alternatives?.forEach(o=>assert.equal(o.status,'CANDIDATE_NOT_SELECTED'))));
test('community experiment is not mislabeled primary-provider case study',()=>{assert.ok(entries.every(x=>x.entryKind==='pattern'));assert.ok(!JSON.stringify(practicalSources).includes('reddit'));assert.ok(entries.every(x=>x.lesson.example?.provenance==='authored-synthetic'))});
test('all patterns have a reproducible proposed check and limitations',()=>entries.forEach(x=>{assert.ok(x.lesson.example!.steps.length>=4);assert.ok(x.lesson.example!.limits.length>=2);assert.ok(x.lesson.failureModes!.length)}));
test('missing primary citation is refused not guessed',()=>assert.throws(()=>validateLearningCatalogue(entries,practicalSources.filter(s=>s.id!=='DC-RAYFIN-SEMANTIC')),/unknown source reference DC-RAYFIN-SEMANTIC/));
test('the science pattern retains explicit unmapped validity',()=>assert.ok(JSON.stringify(entries[0]).includes('unknown calibration')));
test('cost example preserves both denominators and no telemetry claim',()=>{const text=JSON.stringify(entries.find(x=>x.id==='capacity-denominators'));assert.ok(text.includes('3/(2*30)=5'));assert.ok(text.includes('3/(2*300)=0.5'));assert.ok(text.includes('No Capacity Metrics data was fetched'))});
test('notebooks are not declared unsuitable for production',()=>assert.ok(JSON.stringify(entries.find(x=>x.id==='notebook-vs-job')).includes('Scheduled notebooks can be production work')));
test('Power BI coexistence is a candidate, not a compulsory migration',()=>assert.ok(JSON.stringify(entries.find(x=>x.id==='report-app-coexistence')).includes('reversible coexistence')));
test('source model and linked config validate with no observations',()=>{const {project,reading}=buildPracticalPatternProject();assert.equal(project.observations.length,0);assert.equal(prepareLinkedReading(project,reading).chapters.length,6);assert.equal(reading.sourceKey,linkedReadingKey(project))});
test('pattern HTML compiled script remains parseable and inert offline',()=>{const {project,reading}=buildPracticalPatternProject();const html=linkedReadingHtml(project,reading,{now:new Date('2026-10-19T12:00:00Z')});assert.doesNotThrow(()=>new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)![1]));assert.ok(html.includes("connect-src 'none'"));assert.ok(!/<script[^>]+src=/.test(html))});

test('practical cards are in the App catalogue without duplicates',()=>{
 const kept=PRACTICAL_RECONCILIATION.filter(d=>d.decision==='keep').map(d=>d.id),dropped=PRACTICAL_RECONCILIATION.filter(d=>d.decision==='drop').map(d=>d.id);
 // Each of the fourteen candidates has exactly one recorded decision, with a reason and the cards it was judged against.
 assert.equal(PRACTICAL_RECONCILIATION.length,14);
 assert.deepEqual(new Set(PRACTICAL_RECONCILIATION.map(d=>d.id)),new Set([...MIGRATION_LESSONS.map(l=>l.id),...WORLD_DATA_CASES.map(c=>c.id)]));
 for(const d of PRACTICAL_RECONCILIATION){assert.ok(d.reason.length>20,d.id);assert.ok(d.judgedAgainst.length>0,d.id);}
 // The overlaps named by the brief were judged explicitly.
 const judged=(id:string)=>PRACTICAL_RECONCILIATION.find(d=>d.id===id)!.judgedAgainst;
 assert.ok(judged('ci-runner-boundaries').includes('worktrees-ci'));assert.ok(judged('pro-native-handoff').includes('worktrees-ci'));assert.ok(judged('join-lineage-review').includes('star-grain'));
 // Kept cards are in the App catalogue exactly once; dropped cards are not.
 const ids=learningCatalogue.map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 for(const id of kept)assert.equal(ids.filter(x=>x===id).length,1,id);
 for(const id of dropped)assert.ok(!ids.includes(id),id);
 // No card repeats another card's problem.
 const problems=learningCatalogue.map(e=>problemKey(e.lesson.problem));assert.equal(new Set(problems).size,problems.length);
 // Source IDs and URLs are unique across the R4 and practical registries; a source cited only by a dropped card is not added.
 assert.equal(new Set(learningSources.map(s=>s.id)).size,learningSources.length);
 assert.equal(new Set(learningSources.map(s=>s.url)).size,learningSources.length);
 assert.ok(!learningSources.some(s=>s.id==='DC-CLAUDE-SUBAGENTS'));
 // Every kept card passes the real validator and the content guards inside the composed catalogue.
 assert.doesNotThrow(()=>validateLearningCatalogue(learningCatalogue,learningSources));
 for(const e of learningCatalogue.filter(e=>kept.includes(e.id)))assert.deepEqual(lessonContentProblems(e),[],e.id);
 // docs/product/CATALOGUE-RETURN.md records the same decision for every candidate.
 const page=readFileSync(new URL('../docs/product/CATALOGUE-RETURN.md',import.meta.url),'utf8');
 const recorded=new Map([...page.matchAll(/^\| `([a-z0-9-]+)` \| [^|]+ \| (?:\*\*)?(keep|drop)(?:\*\*)? \|/gm)].map(m=>[m[1],m[2]]));
 assert.deepEqual(recorded,new Map(PRACTICAL_RECONCILIATION.map(d=>[d.id,d.decision])));
 // The App bundle reads the cards from src/, never from examples/.
 for(const file of ['../src/intelligence/learning/catalogue.ts','../src/intelligence/learning/practicalCards.ts'])assert.ok(!/from '[^']*examples\//.test(readFileSync(new URL(file,import.meta.url),'utf8')),file);
});
test('no practical card receives a source-pinned family',()=>{
 const kept=new Set(PRACTICAL_RECONCILIATION.filter(d=>d.decision==='keep').map(d=>d.id));
 const rows=catalogueRows().filter(r=>r.state==='lesson'&&kept.has(r.id));assert.equal(rows.length,kept.size);
 for(const row of rows){
  if(row.state!=='lesson')continue;const e=row.entry;
  assert.ok(!('catalogueClassification' in e)&&!('family' in e),e.id);
  assert.ok(matchesCatalogueRow(row,'',{family:'not-supplied'}),e.id);
  for(const family of ['Fondations','Applications','Data'] as const)assert.equal(matchesCatalogueRow(row,'',{family}),false,e.id+' '+family);
  assert.equal(e.editorial.applicability,'UNKNOWN_NOT_ASSESSED');assert.deepEqual(e.instanceMappings,[]);
  assert.equal(e.related.status,'RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE');assert.equal(e.related.canonicalTopicId,null);
  assert.ok(e.lesson.alternatives!.every(a=>a.status==='CANDIDATE_NOT_SELECTED'),e.id);
 }
 // The native cards keep their links; no practical card is linked to a native entry.
 assert.deepEqual(lessonsForNativeEntry('medallion','pattern'),['medallion-environments']);assert.deepEqual(lessonsForNativeEntry('jobs','view-recipe'),['dbt-spark-sql']);
});
