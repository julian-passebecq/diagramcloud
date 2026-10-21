import test from 'node:test';import assert from 'node:assert/strict';
import {interviewBank} from '../src/intelligence/learning/interviewBank';
import {QUESTION_KINDS,validatePracticeBank,practiceBankProblems,newPracticeSession,practiceReduce,practiceCoverage,findPracticeRounds} from '../src/intelligence/learning/interviewPractice';
const clone=()=>JSON.parse(JSON.stringify(interviewBank));
for(const round of interviewBank.rounds)test(`original round ${round.id} has four distinct question purposes and cited explanations`,()=>{
 assert.deepEqual(round.questions.map(q=>q.kind),QUESTION_KINDS);
 assert.equal(new Set(round.questions.map(q=>q.id)).size,4);
 for(const q of round.questions){assert.ok(q.answer.length>30);assert.ok(q.checks.length>=2);assert.ok(q.sourceIds.every(id=>interviewBank.sources.some(s=>s.id===id)));}
});
test('bank has 16 rounds, 64 original questions and fictional contexts only',()=>{
 assert.equal(interviewBank.rounds.length,16);assert.equal(interviewBank.rounds.flatMap(r=>r.questions).length,64);
 assert.ok(interviewBank.cases.every(c=>c.classification==='fictional'));assert.deepEqual(practiceBankProblems(interviewBank),[]);
});
const mutations:[string,(v:any)=>void][]=[
 ['wrong header',v=>v.authorship='verified-hiring-exam'],
 ['unknown root property',v=>v.script='run this'],
 ['duplicate source',v=>v.sources.push(v.sources[0])],
 ['unsafe source URL',v=>v.sources[0].url='javascript:alert(1)'],
 ['credential URL',v=>v.sources[0].url='https://u:p@example.test/'],
 ['duplicate case',v=>v.cases.push(v.cases[0])],
 ['actual employer unverified',v=>v.cases[0].classification='real'],
 ['unknown prerequisite',v=>v.rounds[0].prerequisites=['absent']],
 ['self prerequisite',v=>v.rounds[0].prerequisites=['sql']],
 ['cycle',v=>{v.rounds[0].prerequisites=['warehouse'];}],
 ['duplicate round',v=>v.rounds.push(v.rounds[0])],
 ['duplicate question',v=>v.rounds[1].questions[0].id=v.rounds[0].questions[0].id],
 ['missing kind',v=>v.rounds[0].questions.pop()],
 ['wrong kind order',v=>v.rounds[0].questions.reverse()],
 ['unreferenced source',v=>v.rounds[0].questions[0].sourceIds=['absent']],
 ['missing source',v=>v.rounds[0].questions[0].sourceIds=[]],
 ['empty answer',v=>v.rounds[0].questions[0].answer=''],
 ['oversized answer',v=>v.rounds[0].questions[0].answer='x'.repeat(6001)],
 ['executable property',v=>v.rounds[0].questions[0].run='code'],
 ['invalid diagram edge',v=>v.rounds[0].diagram.edges[0][1]=99],
 ['invalid code contract',v=>v.rounds[0].questions[2].code={language:'sql',text:'x',execute:true}],
];
for(const [name,mutate]of mutations)test(`refuse bank: ${name}`,()=>{const v=clone();mutate(v);assert.throws(()=>validatePracticeBank(v));});
test('validation returns detached content',()=>{const v=clone(),b=validatePracticeBank(v);v.rounds[0].title='Changed';assert.notEqual(b.rounds[0].title,'Changed');});
test('notes survive round navigation but do not mark competency',()=>{
 let s=newPracticeSession(interviewBank);s=practiceReduce(interviewBank,s,{type:'draft',questionId:'sql-1',value:'My answer'});
 s=practiceReduce(interviewBank,s,{type:'choose',roundId:'python'});
 assert.equal(s.records['sql-1'].draft,'My answer');assert.deepEqual(practiceCoverage(interviewBank,s),{state:'current',attempted:1,reviewed:0,total:64});
});
test('review requires reference and answer edits invalidate review',()=>{
 let s=newPracticeSession(interviewBank);assert.throws(()=>practiceReduce(interviewBank,s,{type:'self',questionId:'sql-1',value:'explained'}));
 s=practiceReduce(interviewBank,s,{type:'reveal',questionId:'sql-1',value:true});
 s=practiceReduce(interviewBank,s,{type:'self',questionId:'sql-1',value:'explained'});
 s=practiceReduce(interviewBank,s,{type:'draft',questionId:'sql-1',value:'Changed'});
 assert.equal(s.records['sql-1'].self,'unrated');
});
test('content changes at the same editorial revision refuse old answers',()=>{const s=newPracticeSession(interviewBank),b=clone();b.rounds[0].questions[0].prompt+=' changed';assert.throws(()=>practiceReduce(b,s,{type:'choose',roundId:'python'}));assert.equal(practiceCoverage(b,s).state,'stale');});
test('foreign question and round are refused without mutation',()=>{
 const s=newPracticeSession(interviewBank),before=JSON.stringify(s);
 assert.throws(()=>practiceReduce(interviewBank,s,{type:'draft',questionId:'python-1',value:'x'}));
 assert.throws(()=>practiceReduce(interviewBank,s,{type:'choose',roundId:'missing'}));assert.equal(JSON.stringify(s),before);
});
test('oversized draft and invalid state are refused',()=>{
 const s=newPracticeSession(interviewBank);
 assert.throws(()=>practiceReduce(interviewBank,s,{type:'draft',questionId:'sql-1',value:'x'.repeat(8001)}));
 assert.throws(()=>practiceReduce(interviewBank,s,{type:'reveal',questionId:'sql-1',value:'yes'} as any));
 assert.throws(()=>practiceReduce(interviewBank,s,{type:'delete-everything'} as any));
});
test('clear discards local records only',()=>{let s=newPracticeSession(interviewBank);s=practiceReduce(interviewBank,s,{type:'draft',questionId:'sql-1',value:'x'});assert.deepEqual(practiceReduce(interviewBank,s,{type:'clear'}),newPracticeSession(interviewBank));});
test('search combines terms and respects domain',()=>{assert.ok(findPracticeRounds(interviewBank,'Spark driver').some(r=>r.id==='spark'));assert.equal(findPracticeRounds(interviewBank,'Spark driver','PostgreSQL').length,0);assert.equal(findPracticeRounds(interviewBank,'zzzz').length,0);});

test('reserved object identities cannot become practice records',()=>{const b=clone();b.rounds[0].questions[0].id='constructor';assert.throws(()=>validatePracticeBank(b));});
test('impossible source calendar dates refuse',()=>{const b=clone();b.sources[0].retrievedOn='2026-02-30';assert.throws(()=>validatePracticeBank(b));});
