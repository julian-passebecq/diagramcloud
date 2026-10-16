import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {validateDocument,type Project} from '../src/core/model';
import {learningCatalogue,learningSources,validateLearningCatalogue,catalogueRows} from '../src/intelligence/learning/catalogue';
import {R4_LEARNING_CARDS} from '../src/intelligence/learning/cards';
import {lessonStatements,weightsContextConflations,brainImplementationClaims} from '../src/intelligence/learning/guards';
import {grainCheck,grainExercise,scdExercise} from '../src/intelligence/learning/examples';
import {lessonInstanceFacts,mappingCandidates,suggestMapping,reviewMapping} from '../src/intelligence/learning/mappings';
import {LearningCatalogue} from '../src/ui/LearningCatalogue';

// R4 content guards (AC-16, AC-17, AC-18, AC-20, AC-22). Lesson text is authored synthetic teaching content; nothing here is an owner project.
const all=()=>learningCatalogue.map(entry=>structuredClone(entry));
const lesson=(id:string)=>structuredClone(learningCatalogue.find(entry=>entry.id===id)!);
const DEPTHS=['overview','architecture','detail'] as const;
const render=(id:string,depth:typeof DEPTHS[number],entries:unknown[]=[...learningCatalogue],host:Record<string,unknown>={})=>renderToStaticMarkup(createElement(LearningCatalogue,{entries,host:{initial:{lessonId:id,depth,contentRevision:(entries as {id:string;editorial:{contentRevision:string}}[]).find(e=>e.id===id)!.editorial.contentRevision},...host}}));
const unescape=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const fixture=(nodes:{id:string;label:string;tags?:string[]}[]):Project=>validateDocument({schemaVersion:1,id:'guard-fixture',title:'Synthetic guard fixture',rootViewId:'root',author:'Synthetic author',
 sources:[{id:'notes',title:'Synthetic notes',location:'synthetic/notes.md:1'}],nodes:nodes.map(n=>({kind:'process',sourceIds:['notes'],...n})),edges:[],views:[{id:'root',title:'Root',nodeIds:nodes.map(n=>n.id)}]});

test('AC-16 training-inference-rag keeps "changes weights" and "supplies context" distinct at every depth; no lesson says RAG changes weights',()=>{
 const entry=lesson('training-inference-rag'),definition=entry.lesson.definition.map(c=>c.text).join(' ');
 assert.match(definition,/Fine-tuning continues training a pretrained model\./);assert.match(definition,/RAG supplies retrieved material to generation;/);assert.match(definition,/retrieval is not the same operation as changing model weights/);
 for(const depth of DEPTHS){
  const text=unescape(render(entry.id,depth));
  assert.ok(text.includes(entry.lesson.levels[depth]),depth);
  // The definition (both paths, kept apart) is shown at every depth, not only in the detail.
  for(const sentence of ['Fine-tuning continues training a pretrained model.','RAG supplies retrieved material to generation; retrieval is not the same operation as changing model weights.'])assert.ok(text.includes(sentence),depth+': '+sentence);
  assert.equal(/\b(?:RAG|retriev\w*)\b[^.;]*\b(?:changes?|updates?|modif\w*|retrains?)\b[^.;]*\bweights?\b/i.test(text.replace(/is not the same operation as changing model weights/g,'')),false,depth);
 }
 assert.match(entry.lesson.levels.architecture,/weights path separately from an index\/query\/context\/answer path/);
 for(const row of learningCatalogue)assert.deepEqual(weightsContextConflations(row),[],row.id);
 // A conflating sentence is refused at adoption wherever it appears; keeping the paths apart passes.
 for(const [at,sentence] of [['detail','RAG updates the model weights with each retrieved document.'],['overview','Retrieval writes new knowledge into the weights.'],['architecture','Indexing a document changes what the model weights encode.']] as const){
  const bad=all(),target=bad.find(e=>e.id==='training-inference-rag')!;target.lesson.levels[at]=sentence;
  assert.throws(()=>validateLearningCatalogue(bad),/training-inference-rag: .*conflates retrieval context with a weight change/,sentence);
 }
 const hint=all();hint.find(e=>e.id==='rag-pipeline')!.lesson.interview!.answerHints.push('RAG changes the weights at query time.');
 assert.throws(()=>validateLearningCatalogue(hint),/rag-pipeline: answer hint conflates/);
 const kept=all();kept.find(e=>e.id==='training-inference-rag')!.lesson.levels.detail='Fine-tuning changes weights, whereas RAG supplies context at query time.';
 assert.equal(validateLearningCatalogue(kept).length,learningCatalogue.length);
});

test('AC-17 no lesson claims the DataPass or local Brain uses GraphRAG; Brain applicability stays unknown without a reviewed mapping',()=>{
 const graph=lesson('graph-memory');
 assert.ok(lessonStatements(graph).some(s=>s.text==='No claim that DataPass Brain uses Microsoft GraphRAG.'));
 assert.ok(graph.lesson.definition.every(c=>!/\bBrain\b/.test(c.text)));assert.match(graph.lesson.definition[0].text,/Microsoft GraphRAG is a particular graph-based retrieval approach/);
 for(const row of learningCatalogue){
  assert.deepEqual(brainImplementationClaims(row),[],row.id);assert.equal(row.editorial.applicability,'UNKNOWN_NOT_ASSESSED');assert.deepEqual(row.instanceMappings,[]);
  for(const s of lessonStatements(row))if(/Graph\s?RAG/i.test(s.text)&&/\bBrain\b/.test(s.text))assert.match(s.text,/^No claim that/,row.id);
 }
 for(const card of R4_LEARNING_CARDS)assert.equal((card as {applicability:string}).applicability,'UNKNOWN_NOT_ASSESSED');
 for(const source of learningSources)assert.equal(/\bBrain\b/.test(source.title+' '+source.limits),false,source.id);
 for(const sentence of ['DataPass Brain uses Microsoft GraphRAG for memory.','The local Brain is built on GraphRAG.','Brain stores durable notes in a graph.']){
  const bad=all();bad.find(e=>e.id==='graph-memory')!.lesson.example!.limits[0]=sentence;
  assert.throws(()=>validateLearningCatalogue(bad),/graph-memory: example limit asserts a Brain implementation/,sentence);
  const other=all();other.find(e=>e.id==='rag-pipeline')!.lesson.levels.detail=sentence;
  assert.throws(()=>validateLearningCatalogue(other),/rag-pipeline: detail asserts a Brain implementation/,sentence);
 }
 // A component named after the Brain is a name candidate, never an instance: only an author review with a citation establishes one.
 const doc=fixture([{id:'brain',label:'DataPass Brain graph memory',tags:['graph','memory']}]);
 assert.deepEqual(lessonInstanceFacts(doc,graph).established,[]);assert.match(lessonInstanceFacts(doc,graph).gap!,/No reviewed mapping/);
 assert.deepEqual(mappingCandidates(doc,graph).map(c=>[c.nodeId,c.basis]),[['brain','candidate, not evidence']]);
 const suggested=suggestMapping(doc,{conceptId:'graph-memory',target:{kind:'node',id:'brain'}},{origin:'ai',suggestedBy:'claude'});
 assert.deepEqual(lessonInstanceFacts(suggested,graph).established,[]);assert.equal(lessonInstanceFacts(suggested,graph,{publicMode:true}).suggested.length,0);
 assert.throws(()=>reviewMapping(suggested,suggested.learningMappings![0].id,{reviewedBy:'claude',evidence:{sourceIds:['notes'],blockIds:[]}}),/cannot review itself/);
 assert.throws(()=>reviewMapping(suggested,suggested.learningMappings![0].id,{reviewedBy:'Julian',evidence:{sourceIds:[],blockIds:[]}}),/cites at least one/);
});

test('AC-18 grain check: an order-line fact joined on a non-unique customer key is reported as double counting 35 -> 70; the temporal join keeps 35',()=>{
 const {expectedSales,naive,temporal}=grainExercise();
 assert.equal(expectedSales,35);assert.equal(scdExercise().sales,35);
 assert.deepEqual({state:naive.state,factRows:naive.factRows,joinedRows:naive.joinedRows,before:naive.before,after:naive.after,multiplied:naive.multiplied,dropped:naive.dropped},
  {state:'double-counting',factRows:2,joinedRows:4,before:35,after:70,multiplied:[{line:'L1',matches:2},{line:'L2',matches:2}],dropped:[]});
 assert.equal(naive.report,'Double counting: Joining 2 order line rows to the customer dimension on the customer key alone returns 4 rows; the total changes from 35 to 70. L1 matches 2 dimension rows; L2 matches 2 dimension rows.');
 assert.deepEqual({state:temporal.state,joinedRows:temporal.joinedRows,before:temporal.before,after:temporal.after},{state:'clean',joinedRows:2,before:35,after:35});
 assert.match(temporal.report,/^Grain kept: .* the total stays 35\.$/);assert.equal(temporal.provenance,'authored-synthetic');
 // Clean case on a unique dimension key; a missing key is reported as dropped, never as clean.
 const facts=[{line:'L1',customer:'C1',date:'2026-06-15',amount:20},{line:'L2',customer:'C2',date:'2026-08-15',amount:15}],byKey={label:'on the customer key',matches:(f:{customer:string},r:{customer:string})=>f.customer===r.customer};
 const unique=grainCheck(facts,[{customer:'C1',region:'North',from:'2026-01-01',to:'2027-01-01'},{customer:'C2',region:'South',from:'2026-01-01',to:'2027-01-01'}],byKey);
 assert.deepEqual([unique.state,unique.before,unique.after,unique.multiplied],['clean',35,35,[]]);
 const one=grainCheck(facts,[{customer:'C1',region:'North',from:'2026-01-01',to:'2027-01-01'},{customer:'C1',region:'East',from:'2026-01-01',to:'2027-01-01'}],byKey);
 assert.deepEqual([one.state,one.before,one.after,one.multiplied,one.dropped],['double-counting',35,40,[{line:'L1',matches:2}],['L2']]);
 const missing=grainCheck(facts,[{customer:'C1',region:'North',from:'2026-01-01',to:'2027-01-01'}],byKey);
 assert.deepEqual([missing.state,missing.after,missing.dropped],['dropped-rows',20,['L2']]);assert.match(missing.report,/No dimension row for L2/);
 assert.throws(()=>grainExercise({provenance:'observed'}));
 // The star-grain lesson names the same failure the check reports.
 assert.ok(lesson('star-grain').lesson.failureModes!.some(f=>/nonunique dimension key, which silently multiplies totals/.test(f.text)));
});

// The four subject identities in the packet reference intake (reference-intake/receipt.json); only the Anthropic one has a primary source.
const RECEIPT=[{id:'ref-anthropic-scion',state:'PRIMARY_SOURCE_LOCATED',sourceRef:'S-SCION'},{id:'ref-network-scion',state:'UNVERIFIED_SUPPLIED_LEAD',pattern:/SCION network/i},
 {id:'ref-finance-scion',state:'UNVERIFIED_SUPPLIED_CLAIM',pattern:/Asset Management|\binvestment\b|\bfinancial\b|Burry/i},{id:'ref-fiction-scion',state:'UNVERIFIED_SUPPLIED_LEAD',pattern:/Oracle|book review/i}] as const;
test('AC-20 SCION networking and the unrelated investment and book search results never become a source, card or mapping; only the Anthropic dated case study exists',()=>{
 const scionCards=R4_LEARNING_CARDS.filter(card=>/scion/i.test(JSON.stringify(card))).map(card=>(card as {id:string}).id);
 assert.deepEqual(scionCards,['anthropic-scion']);
 assert.deepEqual(learningCatalogue.filter(e=>e.caseStudy).map(e=>[e.id,e.caseStudy!.sourceRef,e.caseStudy!.relation]),[['anthropic-scion','S-SCION','CASE_STUDY_ONLY_NOT_A_DEPENDENCY']]);
 assert.deepEqual(catalogueRows().filter(row=>/scion/i.test(row.id??'')||/scion/i.test(row.title??'')).map(row=>row.id),['anthropic-scion']);
 assert.deepEqual(learningSources.filter(s=>/scion/i.test(s.id+s.title+s.url)).map(s=>[s.id,new URL(s.url).hostname]),[['S-SCION','www.anthropic.com'],['S-SCION-AGENTS','github.com']]);
 const scion=lesson('anthropic-scion');
 for(const item of RECEIPT){
  if(!('pattern' in item)){assert.equal(scion.caseStudy!.sourceRef,item.sourceRef);continue;}
  assert.equal(learningSources.some(s=>item.pattern.test(s.id+' '+s.title+' '+s.url+' '+s.limits)),false,item.id+' is not a source');
  for(const entry of learningCatalogue){
   assert.equal(item.pattern.test(entry.id+' '+entry.title+' '+entry.summary),false,item.id+' is not a card: '+entry.id);
   // It may only be named to say it is a different entity, never as content.
   for(const s of lessonStatements(entry))if(item.pattern.test(s.text))assert.ok(entry.id==='anthropic-scion'&&(s.where==='distinct from'||/^Do not confuse it with/.test(s.text)),item.id+': '+entry.id+' '+s.where);
  }
  const distinct=scion.caseStudy!.distinctFrom.filter(d=>item.pattern.test(d.label));
  assert.ok(distinct.every(d=>d.sourceRef===null),item.id+' has no source record');
 }
 assert.deepEqual(scion.caseStudy!.distinctFrom.map(d=>[d.label,d.sourceRef]),[['GoogleCloudPlatform Scion (an unrelated project)','S-SCION-AGENTS'],['SCION networking',null],['Scion Asset Management',null]]);
 // Name matches are candidates only; nothing is mapped, and no other lesson is offered for them.
 const doc=fixture([{id:'net',label:'SCION networking path server'},{id:'fund',label:'Scion Asset Management portfolio'}]);
 for(const entry of learningCatalogue){assert.deepEqual(lessonInstanceFacts(doc,entry).established,[]);if(entry.id!=='anthropic-scion')assert.deepEqual(mappingCandidates(doc,entry),[],entry.id);}
 assert.ok(mappingCandidates(doc,scion).every(c=>c.basis==='candidate, not evidence'));
});

test('AC-22 lesson snippets are inert text: no script, eval or raw HTML path, no run control, and opening a lesson edits nothing',()=>{
 const snippet='<script>window.__ran=1</script><img src=x onerror="fetch(\'https://example.invalid\')">';
 const custom={...lesson('dbt-spark-sql'),id:'snippet-fixture',title:'Synthetic snippet lesson'};
 custom.lesson.example={provenance:'authored-synthetic',input:'SELECT customer, SUM(amount) FROM sales GROUP BY customer; DROP TABLE sales; '+snippet,steps:['eval("process.exit(1)")','python -c "import os; os.remove(\'x\')"','npm run deploy && git push --force'],output:'javascript:alert(1)',limits:['No snippet is executed.']};
 let edits=0,lessons=0;const host={onEdit:()=>{edits++;},onLesson:()=>{lessons++;},reviewer:'Julian'};
 for(const depth of DEPTHS){
  const html=render(custom.id,depth,[...learningCatalogue,custom],host);
  assert.equal(/<script|<img|<[^>]*\son\w+=|href="javascript:/i.test(html),false,depth);assert.match(html,/&lt;img src=x onerror=&quot;fetch/);
  assert.match(html,/&lt;script&gt;window.__ran=1&lt;\/script&gt;/);assert.ok(unescape(html).includes('eval("process.exit(1)")'));assert.ok(unescape(html).includes('DROP TABLE sales;'));
  const controls=[...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(m=>m[0]);
  assert.ok(controls.length>0);assert.equal(controls.some(b=>/\b(?:run|execute|exec|eval|deploy|launch|start)\b/i.test(b)),false,controls.join('\n'));
 }
 assert.equal(edits,0);assert.equal(lessons,0);
 // No code path can execute or inject lesson text: the catalogue UI and the learning modules have no eval, raw HTML, network or storage call.
 const files=['src/ui/LearningCatalogue.tsx',...readdirSync(new URL('../src/intelligence/learning/',import.meta.url)).map(f=>'src/intelligence/learning/'+f)];
 for(const file of files){const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.equal(/dangerouslySetInnerHTML|\.innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function\b|child_process|\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|import\s*\(/.test(source),false,file);}
});
