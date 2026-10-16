import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {validateDocument} from '../src/core/model';
import {patternCatalog,recipeRegistry} from '../src/intelligence/recipes';
import {learningCatalogue,learningSources,catalogueRows,decodeCatalogueEntry,validateLearningCatalogue,adoptLearningCard,matchesCatalogueRow,lessonsForNativeEntry,CATALOGUE_ENTRY_KINDS} from '../src/intelligence/learning/catalogue';
import {compileLearningExample,scdExercise,temporalJoin,LEARNING_EXAMPLES} from '../src/intelligence/learning/examples';
import {learningCookbook,referenceCookbook} from '../src/intelligence/cookbook';
import {samples} from '../src/data/samples';
import {LearningCatalogue} from '../src/ui/LearningCatalogue';
import {matcherSnapshot} from './helpers/matcherSnapshot';
import {R4_LEARNING_CARDS} from '../src/intelligence/learning/cards';
const ragCard=R4_LEARNING_CARDS.find(card=>(card as {id:string}).id==='rag-pipeline') as Record<string,unknown>;

const lesson=(id:string)=>structuredClone(learningCatalogue.find(entry=>entry.id===id)!);
test('legacy matcher output is byte-identical to the snapshot recorded before the catalogue extension',()=>{
 const recorded=JSON.parse(readFileSync(new URL('./fixtures/catalogue-matcher-snapshot.json',import.meta.url),'utf8'));
 assert.deepEqual(matcherSnapshot(),recorded);
});
test('twelve authored lessons adopt as typed entries; legacy pattern and recipe entries decode unchanged',()=>{
 assert.equal(learningCatalogue.length,12);
 assert.deepEqual([...new Set(learningCatalogue.map(entry=>entry.entryKind))].sort(),['case-study','concept']);
 const rows=catalogueRows();
 assert.deepEqual(rows.filter(row=>row.state==='legacy-pattern').map(row=>row.state==='legacy-pattern'&&row.pattern),patternCatalog);
 assert.deepEqual(rows.filter(row=>row.state==='legacy-recipe').map(row=>row.state==='legacy-recipe'&&row.recipe),recipeRegistry);
 assert.equal(rows.filter(row=>row.state==='lesson').length,12);
 // Tagged legacy entries also decode; decoded rows are copies, never the matcher's registry objects.
 const tagged=decodeCatalogueEntry({...structuredClone(patternCatalog[0]),entryKind:'pattern'});assert.equal(tagged.state,'legacy-pattern');
 assert.equal(decodeCatalogueEntry({...structuredClone(recipeRegistry[0]),entryKind:'view-recipe'}).state,'legacy-recipe');
 const row=rows.find(r=>r.state==='legacy-pattern')!;assert.ok(row.state==='legacy-pattern'&&row.pattern!==patternCatalog[0]);
});
test('entry kinds are never silently coerced into each other',()=>{
 assert.deepEqual([...CATALOGUE_ENTRY_KINDS],['concept','pattern','procedure','technology','case-study','view-recipe']);
 assert.equal(decodeCatalogueEntry({...structuredClone(patternCatalog[0]),entryKind:'view-recipe'}).state,'invalid');
 assert.equal(decodeCatalogueEntry({...structuredClone(recipeRegistry[0]),entryKind:'pattern'}).state,'invalid');
 const {lesson:_lesson,editorial:_editorial,...bare}=lesson('oltp-olap');
 const coerced=decodeCatalogueEntry(bare);assert.equal(coerced.state,'invalid');assert.match(coerced.state==='invalid'?coerced.reason:'',/not coerced/);
 const technology=decodeCatalogueEntry({...lesson('dbt-spark-sql'),entryKind:'technology'});assert.equal(technology.state,'lesson');assert.equal(technology.kind,'technology');
 // A case study requires dated case-study metadata; a concept may not carry it.
 assert.equal(decodeCatalogueEntry({...lesson('oltp-olap'),entryKind:'case-study'}).state,'invalid');
 assert.equal(decodeCatalogueEntry({...lesson('anthropic-scion'),entryKind:'concept'}).state,'invalid');
});
test('unknown future kinds are visible omissions, not crashes, in decoding and in the catalogue UI',()=>{
 const future={...lesson('rag-pipeline'),id:'future-entry',entryKind:'simulation'};
 const row=decodeCatalogueEntry(future);assert.equal(row.state,'unsupported-kind');assert.equal(row.kind,'simulation');
 assert.equal(decodeCatalogueEntry(null).state,'invalid');assert.equal(decodeCatalogueEntry({entryKind:42}).state,'unsupported-kind');
 const html=renderToStaticMarkup(createElement(LearningCatalogue,{entries:[...learningCatalogue,future]}));
 assert.match(html,/Omitted catalogue entry future-entry of unsupported kind simulation/);
 assert.match(html,/RAG indexing, query-time retrieval and evaluation/);
 assert.match(html,/Showing 25 of 25 catalogue entries/);
});
test('a learning proposal envelope is adopted, never decoded or validated as a native document',()=>{
 assert.equal(decodeCatalogueEntry(ragCard).state,'invalid');
 assert.throws(()=>validateDocument(ragCard as never));
 assert.deepEqual(adoptLearningCard(ragCard),lesson('rag-pipeline'));
 assert.throws(()=>adoptLearningCard({...ragCard,instanceMappings:[{target:'owner-node'}]}));
 assert.throws(()=>adoptLearningCard({...ragCard,applicability:'APPLICABLE'}));
});
test('prerequisites must be known and acyclic; sources must resolve to the packet source records',()=>{
 const all=()=>learningCatalogue.map(entry=>structuredClone(entry));
 const cycle=all();cycle.find(e=>e.id==='oltp-olap')!.lesson.prerequisites=['scd-history'];
 assert.throws(()=>validateLearningCatalogue(cycle),/Prerequisite cycle: .*oltp-olap/);
 const self=all();self[0].lesson.prerequisites=[self[0].id];assert.throws(()=>validateLearningCatalogue(self),/itself/);
 const unknown=all();unknown[0].lesson.prerequisites=['not-a-lesson'];assert.throws(()=>validateLearningCatalogue(unknown),/unknown prerequisite not-a-lesson/);
 const source=all();source[0].lesson.sourceRefs=['S-MISSING'];assert.throws(()=>validateLearningCatalogue(source),/unknown source reference S-MISSING/);
 const duplicate=all();duplicate.push(structuredClone(duplicate[0]));assert.throws(()=>validateLearningCatalogue(duplicate),/Duplicate/);
 const legacyId=all();legacyId[0].id='medallion';assert.throws(()=>validateLearningCatalogue(legacyId),/collides/);
 const ids=new Set(learningSources.map(s=>s.id));
 for(const entry of learningCatalogue)for(const ref of [...entry.editorial.sourceRefs,...entry.lesson.sourceRefs,...entry.lesson.definition.flatMap(c=>c.sourceRefs)])assert.ok(ids.has(ref),entry.id+' '+ref);
 assert.ok(learningSources.every(s=>s.url.startsWith('https://')&&s.externalRevision===null||/^[a-f0-9]{40}$/.test(s.externalRevision??'')));
});
test('new topics carry editorial metadata, never the five source-pinned families; native cards are linked, not overwritten',()=>{
 for(const entry of learningCatalogue){assert.equal(entry.editorial.applicability,'UNKNOWN_NOT_ASSESSED');assert.equal(entry.editorial.provenance,'r4-packet-authored-draft');assert.deepEqual(entry.instanceMappings,[]);assert.ok(!('catalogueClassification' in entry));}
 assert.equal(decodeCatalogueEntry({...lesson('oltp-olap'),catalogueClassification:patternCatalog[0].guidance!.catalogueClassification}).state,'invalid');
 const medallion=lesson('medallion-environments'),dbt=lesson('dbt-spark-sql');
 assert.deepEqual(medallion.related,{status:'EXISTING_NATIVE_TOPIC_REUSE',canonicalTopicId:'lakehouse-medallion',nativePatternId:'medallion'});
 assert.deepEqual(dbt.related,{status:'EXISTING_NATIVE_TOPIC_REUSE',canonicalTopicId:'spark-production',nativeRecipeId:'jobs'});
 assert.deepEqual(lessonsForNativeEntry('medallion','pattern'),['medallion-environments']);assert.deepEqual(lessonsForNativeEntry('jobs','view-recipe'),['dbt-spark-sql']);
 const wrongTopic=learningCatalogue.map(entry=>structuredClone(entry));wrongTopic.find(e=>e.id==='dbt-spark-sql')!.related.canonicalTopicId='lakehouse-medallion';
 assert.throws(()=>validateLearningCatalogue(wrongTopic),/canonical topic/);
 const rows=catalogueRows();
 assert.deepEqual(rows.filter(row=>matchesCatalogueRow(row,'',{family:'Data'})).map(row=>row.id),['medallion','jobs']);
 assert.equal(rows.filter(row=>row.state==='lesson'&&matchesCatalogueRow(row,'',{family:'not-supplied'})).length,12);
 assert.deepEqual(rows.filter(row=>matchesCatalogueRow(row,'',{kind:'case-study'})).map(row=>row.id),['anthropic-scion']);
 assert.deepEqual(rows.filter(row=>matchesCatalogueRow(row,'',{domain:'warehousing'})).map(row=>row.id),['oltp-olap','star-grain','scd-history']);
 assert.deepEqual(rows.filter(row=>matchesCatalogueRow(row,'temporal')).map(row=>row.id),['scd-history']);
});
test('the Scion card stays a dated Anthropic case study, distinct from GoogleCloudPlatform Scion and never a dependency',()=>{
 const scion=lesson('anthropic-scion');
 assert.equal(scion.entryKind,'case-study');assert.equal(scion.caseStudy!.relation,'CASE_STUDY_ONLY_NOT_A_DEPENDENCY');assert.equal(scion.caseStudy!.retrievedOn,'2026-10-16');assert.equal(scion.caseStudy!.sourceRef,'S-SCION');
 assert.ok(learningSources.find(s=>s.id==='S-SCION')!.url.startsWith('https://www.anthropic.com/'));
 assert.deepEqual(scion.caseStudy!.distinctFrom.find(row=>row.sourceRef==='S-SCION-AGENTS')?.label,'GoogleCloudPlatform Scion (an unrelated project)');
 assert.equal(scion.lesson.definition[0].basis,'provider-reported');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));assert.ok(!Object.keys({...pkg.dependencies,...pkg.devDependencies}).some(name=>/scion/i.test(name)));
});
test('synthetic learning examples compile through the native brief compiler into labelled, collision-free candidates',()=>{
 const docs=learningCookbook();assert.equal(docs.length,LEARNING_EXAMPLES.length);
 const existing=new Set([...samples,...referenceCookbook()].map(p=>p.id));
 for(const doc of docs){
  assert.deepEqual(validateDocument(doc),doc);assert.ok(!existing.has(doc.id),doc.id);assert.match(doc.id,/^lesson-example-/);
  assert.ok(doc.tags.includes('Synthetic'));assert.match(doc.provenance??'',/Synthetic learning example/);assert.ok(doc.blocks.every(b=>b.provenance==='synthetic'));
  assert.equal(doc.observations.length,0);assert.ok(doc.nodes.every(n=>n.basis===undefined||n.basis==='planned'));
 }
 assert.deepEqual(compileLearningExample('rag'),compileLearningExample('rag'));
 assert.ok(compileLearningExample('warehouse').nodes.some(n=>n.label==='Customer dimension'));
 assert.throws(()=>compileLearningExample('missing'),/Unknown/);
});
test('SCD temporal join arithmetic: June maps to North, August to South, sales total 35, overlaps fail visibly',()=>{
 const result=scdExercise();
 assert.equal(result.sales,35);assert.equal(result.salesAsExpected,true);assert.equal(result.regionsAsExpected,true);
 assert.deepEqual(result.matches,[{date:'2026-06-15',state:'matched',region:'North'},{date:'2026-08-15',state:'matched',region:'South'}]);
 const versions=[{region:'North',from:'2026-01-01',to:'2026-07-01'},{region:'South',from:'2026-07-01',to:'2027-01-01'}];
 assert.deepEqual(temporalJoin(versions,['2026-07-01','2026-06-30']),[{date:'2026-07-01',state:'matched',region:'South'},{date:'2026-06-30',state:'matched',region:'North'}]);
 assert.deepEqual(temporalJoin([...versions,{region:'East',from:'2026-06-01',to:'2026-08-01'}],['2026-06-15'])[0],{date:'2026-06-15',state:'ambiguous',regions:['North','East']});
 assert.deepEqual(temporalJoin(versions,['2025-12-31'])[0],{date:'2025-12-31',state:'no-version',regions:[]});
 assert.throws(()=>scdExercise({provenance:'observed'}));
});
