import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {answerHistoryQuestion,parseHistorySlice,projectHistory,revisionKey,HISTORY_QUESTIONS,HISTORY_SLICE_LIMITS,type HistoryRecord,type HistorySlice,type HistoryQuery} from '../src/development/historyLens';
import {HistoryLensPanel} from '../src/ui/HistoryLensPanel';
const rec=(id:string,parents:string[]|null=[],extra:Partial<HistoryRecord>={}):HistoryRecord=>({ref:{repository:'repo-a',id},kind:'revision',vcs:'git',title:'Change '+id,visibility:'public',occurredAt:'2026-10-18T10:00:00Z',basis:'source',sourceRef:'receipt-1',ancestry:parents===null?null:{parents:parents.map(id=>({repository:'repo-a',id})),completeness:'complete',semantics:'native'},facets:{},...extra});
const slice=(records:HistoryRecord[]):HistorySlice=>({capturedAt:'2026-10-18T12:00:00Z',coverage:'partial',records});
const ids=(d:ReturnType<typeof projectHistory>)=>d.rows.map(r=>r.ref.id);
test('topology outranks commit clock skew',()=>{const d=projectHistory(slice([rec('parent',[],{occurredAt:'2026-10-19T12:00:00Z'}),rec('child',['parent'])]));assert.deepEqual(ids(d),['child','parent']);assert.equal(d.edges.length,1);});
test('roots and unknown ancestry are distinct',()=>{const d=projectHistory(slice([rec('root'),rec('unknown',null)]));assert.equal(d.rows.find(r=>r.ref.id==='root')?.ancestry,'root');assert.equal(d.rows.find(r=>r.ref.id==='unknown')?.ancestry,'unknown');});
test('filtered intermediate does not become direct parent',()=>{const d=projectHistory(slice([rec('a',['b'],{facets:{feature:['f']}}),rec('b',['c']),rec('c',[],{facets:{feature:['f']}})]),{facets:{feature:{values:['f']}}});assert.deepEqual(ids(d),['a','c']);assert.equal(d.edges.length,0);assert.equal(d.rows[0].ancestry,'boundary');});
test('merge retains both real parents',()=>{const d=projectHistory(slice([rec('m',['a','b']),rec('a'),rec('b')]));assert.equal(d.edges.length,2);assert.deepEqual(d.edges.map(e=>e.ordinal),[0,1]);});
test('dangling parent is generic boundary, never output as private identity',()=>{const d=projectHistory(slice([rec('a',['PRIVATE_PARENT'])]),{},'public');assert.equal(d.rows[0].ancestry,'boundary');assert.ok(!JSON.stringify(d).includes('PRIVATE_PARENT'));});
test('native parent cycle refuses',()=>assert.throws(()=>projectHistory(slice([rec('a',['b']),rec('b',['a'])])),/Invalid history/));
test('duplicate record identity refuses',()=>assert.throws(()=>projectHistory(slice([rec('a'),rec('a')])),/Invalid history/));
test('same revision string in different repositories stays distinct',()=>{const d=projectHistory(slice([rec('x'),rec('x',[],{ref:{repository:'repo-b',id:'x'}})]));assert.equal(d.rows.length,2);assert.notEqual(d.rows[0].key,d.rows[1].key);});
test('cross-repository parent is not Git ancestry',()=>assert.throws(()=>projectHistory(slice([rec('a',[],{ancestry:{parents:[{repository:'repo-b',id:'b'}],completeness:'complete',semantics:'native'}})])),/Invalid history/));
test('filter dimensions AND, multiple values within one dimension OR',()=>{const d=projectHistory(slice([rec('a',[],{facets:{feature:['f'],actor:['a1']}}),rec('b',[],{facets:{feature:['f'],actor:['a2']}}),rec('c',[],{facets:{feature:['g'],actor:['a1']}})]),{facets:{feature:{values:['f']},actor:{values:['a1','a2']}}});assert.deepEqual(ids(d),['a','b']);});
test('missing metadata can be included explicitly; known-empty is not unknown',()=>{const d=projectHistory(slice([rec('missing'),rec('empty',[],{facets:{feature:[]}}),rec('known',[],{facets:{feature:['f']}})]),{facets:{feature:{values:['f'],includeUnknown:true}}});assert.deepEqual(ids(d),['known','missing']);assert.equal(d.availableFacets.feature.unknown,1);});
test('unknown-only filter is explicit',()=>{const d=projectHistory(slice([rec('missing'),rec('known',[],{facets:{feature:['f']}})]),{facets:{feature:{values:[],includeUnknown:true}}});assert.deepEqual(ids(d),['missing']);});
test('explicit empty repository selection does not fall back globally',()=>assert.equal(projectHistory(slice([rec('a')]),{repositories:[]}).matched,0));
test('title mentioning a feature does not create a feature mapping',()=>{const d=projectHistory(slice([rec('a',[],{title:'Fix feature-123'})]),{facets:{feature:{values:['feature-123']}}});assert.equal(d.matched,0);});
test('text search is search, not attributed actor evidence',()=>{const d=projectHistory(slice([rec('a',[],{title:'Claude suggestion'})]),{text:'Claude'});assert.equal(d.matched,1);assert.equal(d.availableFacets.actor.unknown,1);});
test('public search and facets never inspect private records',()=>{const d=projectHistory(slice([rec('a'),rec('secret',[],{visibility:'private',facets:{feature:['PRIVATE_FEATURE']}})]),{text:'secret'},'public');assert.equal(d.matched,0);assert.ok(!JSON.stringify(d).includes('PRIVATE'));assert.equal(d.permitted,1);});
test('one or many private rows produce identical public projections',()=>{const base=projectHistory(slice([rec('a'),rec('hidden',[],{visibility:'private'})]),{},'public');const more=projectHistory(slice([rec('a'),...Array.from({length:8},(_,i)=>rec('secret'+i,[],{visibility:'private'}))]),{},'public');assert.deepEqual(base,more);});
test('private malformed rows do not affect permitted public result',()=>{const bad=rec('hidden',[],{visibility:'private'});bad.title='';assert.deepEqual(projectHistory(slice([rec('a'),bad]),{},'public'),projectHistory(slice([rec('a')]),{},'public'));});
test('public edge ordinal cannot disclose number of omitted parents',()=>{const a=projectHistory(slice([rec('m',['hidden','p']),rec('p')]),{},'public');const b=projectHistory(slice([rec('m',['h1','h2','h3','p']),rec('p')]),{},'public');assert.deepEqual(a,b);assert.equal(a.edges[0].ordinal,null);});
test('private-parent absence and unavailable parent are indistinguishable',()=>{const a=projectHistory(slice([rec('a',['p']),rec('p',[],{visibility:'private'})]),{},'public');const b=projectHistory(slice([rec('a',['p'])]),{},'public');assert.deepEqual(a,b);});
test('simplified parent lists are never rendered as native ancestry',()=>{const m=rec('a',['b']);m.ancestry!.semantics='simplified';const d=projectHistory(slice([m,rec('b')]));assert.equal(d.edges.length,0);assert.equal(d.rows[0].ancestry,'simplified');});
test('non-revision attempt is an event, not a commit',()=>{const d=projectHistory(slice([rec('run1',null,{kind:'attempt'})]));assert.equal(d.rows[0].ancestry,'not-applicable');assert.equal(d.edges.length,0);});
test('parent pointing at attempt is refused',()=>assert.throws(()=>projectHistory(slice([rec('a',['attempt']),rec('attempt',null,{kind:'attempt'})])),/Invalid history/));
test('opaque non-Git change IDs are supported',()=>{const d=projectHistory(slice([rec('change:482',[],{vcs:'other-scm'})]));assert.equal(d.rows[0].ref.id,'change:482');assert.equal(d.rows[0].vcs,'other-scm');});
test('time ranges preserve unknown-time distinction',()=>{const s=slice([rec('known'),rec('unknown',[],{occurredAt:null})]);assert.equal(projectHistory(s,{from:'2026-10-18T09:00:00Z'}).matched,1);assert.equal(projectHistory(s,{from:'2026-10-18T09:00:00Z',includeUnknownTime:true}).matched,2);});
test('invalid date and reversed interval are refused',()=>{for(const q of [{from:'2026-02-30T10:00:00Z'},{from:'2026-10-19T10:00:00Z',to:'2026-10-18T10:00:00Z'}])assert.throws(()=>projectHistory(slice([rec('a')]),q),/Invalid history/);});
test('pagination makes every permitted match reachable, without false connections',()=>{const s=slice([rec('a',['b']),rec('b',['c']),rec('c')]);const a=projectHistory(s,{limit:1}),b=projectHistory(s,{limit:1,offset:1}),c=projectHistory(s,{limit:1,offset:2});assert.deepEqual([...ids(a),...ids(b),...ids(c)],['a','b','c']);assert.equal(a.hasMore,true);assert.equal(c.hasMore,false);assert.equal(a.edges.length,0);});
test('source and projection are copy-isolated',()=>{const s=slice([rec('a',[],{facets:{actor:['a1']}})]),before=structuredClone(s),d=projectHistory(s);d.rows[0].facets.actor!.push('change');d.rows[0].ref.id='bad';assert.deepEqual(s,before);});
test('unknown query fields refuse instead of silently ignoring a filter',()=>assert.throws(()=>projectHistory(slice([rec('a')]),{featre:'f'} as unknown as HistoryQuery),/Invalid history/));
test('unsupported facet refuses',()=>assert.throws(()=>projectHistory(slice([rec('a')]),{facets:{cost:{values:['cheap']}}} as unknown as HistoryQuery),/Invalid history/));
test('projection keeps source evidence basis and coverage',()=>{const d=projectHistory(slice([rec('a',[],{basis:'inferred'})]));assert.equal(d.rows[0].basis,'inferred');assert.equal(d.coverage,'partial');});
test('revision keys avoid ambiguous delimiter concatenation',()=>assert.notEqual(revisionKey({repository:'a:b',id:'c'}),revisionKey({repository:'a',id:'b:c'})));
test('bounded large history has stable topology and complete pagination count',()=>{const rs=Array.from({length:2000},(_,i)=>rec(String(i),i<1999?[String(i+1)]:[]));const d=projectHistory(slice(rs),{limit:100});assert.equal(d.matched,2000);assert.deepEqual(ids(d).slice(0,3),['0','1','2']);assert.equal(d.rows.length,100);});

test('Git author and committer remain distinct attributed filters',()=>{const data=slice([rec('a',[],{facets:{author:['human'],committer:['bot']}})]);assert.equal(projectHistory(data,{text:'human'}).matched,1);assert.equal(projectHistory(data,{facets:{author:{values:['bot']}}}).matched,0);assert.equal(projectHistory(data,{facets:{committer:{values:['bot']}}}).matched,1);});
test('system model and operation filters never infer one from another',()=>{const data=slice([rec('a',[],{facets:{model:['model-x'],system:['assistant-a']}})]);assert.equal(projectHistory(data,{facets:{model:{values:['model-x']}}}).matched,1);assert.equal(projectHistory(data,{facets:{operation:{values:['model-x']}}}).matched,0);});
test('reference membership must be supplied, not guessed from ancestry',()=>{const data=slice([rec('a',['b'],{facets:{ref:['main']}}),rec('b')]);assert.deepEqual(ids(projectHistory(data,{facets:{ref:{values:['main']}}})),['a']);});
test('public lane geometry does not reveal an omitted parent position',()=>{const a=projectHistory(slice([rec('m',['p','hidden']),rec('p')]),{},'public');const b=projectHistory(slice([rec('m',['hidden','p']),rec('p')]),{},'public');assert.deepEqual(a,b);});

// Five history questions over a synthetic slice (tests/fixtures/history-questions/example-history.json).
const QRAW=readFileSync(new URL('./fixtures/history-questions/example-history.json',import.meta.url),'utf8');
const qslice=()=>parseHistorySlice(QRAW);
const key=(id:string)=>revisionKey({repository:'example/service',id});
const qbinding={projectId:'p',audience:'author' as const,epoch:1};
test('five questions: ancestry never uses associations',()=>{
 const a=answerHistoryQuestion(qslice(),'ancestry','author');
 assert.equal(a.answerable,true);assert.deepEqual(a.groups,[]);
 // r9 shares the request-form feature with r3 and r2 but has no native parent: it stays a root, never a child.
 assert.equal(a.rows.find(r=>r.ref.id==='r9')?.ancestry,'root');
 assert.equal(a.rows.find(r=>r.ref.id==='r3')?.ancestry,'shown');
 // Same answer whatever the association facets say.
 const s=qslice();for(const r of s.records)delete r.facets.feature;
 assert.deepEqual(answerHistoryQuestion(s,'ancestry','author').rows.map(r=>[r.key,r.ancestry]),a.rows.map(r=>[r.key,r.ancestry]));
 assert.deepEqual([...HISTORY_QUESTIONS],['ancestry','associations','attempts','impact','lineage']);
});
test('associations never create parent edges',()=>{
 const a=answerHistoryQuestion(qslice(),'associations','author');
 assert.deepEqual(a.groups.map(g=>[g.facet,g.value,g.recordKeys.length]),[['feature','PRIVATE_FEATURE',1],['feature','request-form',3],['problem','schema-drift',1],['decision','use-json-schema',1]]);
 assert.ok(a.rows.every(r=>r.ancestry==='not-applicable'&&r.lane===0));
 assert.ok(!('edges' in a));
 // The ancestry projection is unchanged by the association: r9 still has no edge.
 assert.ok(!projectHistory(qslice()).edges.some(e=>e.child===key('r9')||e.parent===key('r9')));
 // Attempts are listed in recorded time order, unknown times apart.
 const t=answerHistoryQuestion(qslice(),'attempts','author');
 assert.deepEqual(t.rows.map(r=>r.ref.id),['run-1','run-2']);assert.deepEqual(t.unresolved,[key('run-x')]);
 // Lineage groups supplied release/check values per record.
 assert.deepEqual(answerHistoryQuestion(qslice(),'lineage','author').groups.map(g=>[g.facet,g.value,g.recordKeys]),[['release','0.4.0',[key('r2')]],['release','PRIVATE_RELEASE',[key('hidden')]],['check','unit-tests',[key('r3')]]]);
 const html=renderToStaticMarkup(createElement(HistoryLensPanel,{slice:qslice(),controls:{binding:qbinding,query:{}},binding:qbinding,onQuery:()=>{},onSelect:()=>{},question:'associations',onQuestion:()=>{}}));
 assert.match(html,/request-form/);assert.match(html,/never connected by an edge/);
});
test('impact matches exact component IDs only',()=>{
 const a=answerHistoryQuestion(qslice(),'impact','author',['svc.ui','svc.api','svc.API','request form']);
 assert.deepEqual(a.componentMatches,[{componentId:'svc.api',recordKeys:[key('r2')]},{componentId:'svc.ui',recordKeys:[key('r3')]}]);
 // A label-like value and a path stay unresolved, never matched by label, case or prefix.
 assert.deepEqual(a.unresolved,['Request Form','src/api/routes.ts','svc.secret']);
 assert.deepEqual(answerHistoryQuestion(qslice(),'impact','author').componentMatches,[]);
 const html=renderToStaticMarkup(createElement(HistoryLensPanel,{slice:qslice(),controls:{binding:qbinding,query:{}},binding:qbinding,onQuery:()=>{},onSelect:()=>{},question:'impact',onQuestion:()=>{},componentIds:['svc.ui'],onSelectComponent:()=>{}}));
 assert.match(html,/History question/);assert.match(html,/<button[^>]*>svc\.ui<\/button>/);assert.match(html,/Unresolved/);
});
test('unanswerable question names the missing facet',()=>{
 const s=parseHistorySlice(JSON.stringify({capturedAt:'2026-10-01T12:00:00Z',coverage:'unknown',records:[{ref:{repository:'r',id:'a'},kind:'revision',vcs:'git',title:'Synthetic',visibility:'public',occurredAt:null,basis:'source',sourceRef:'x',ancestry:null,facets:{}}]}));
 const missing=Object.fromEntries(HISTORY_QUESTIONS.map(q=>{const a=answerHistoryQuestion(s,q,'author');assert.equal(a.answerable,false);return [q,a.missing];}));
 assert.deepEqual(missing,{ancestry:['ancestry'],associations:['feature','problem','decision'],attempts:['run'],impact:['surface','path'],lineage:['release','artifact','check','review']});
 const html=renderToStaticMarkup(createElement(HistoryLensPanel,{slice:s,controls:{binding:qbinding,query:{}},binding:qbinding,onQuery:()=>{},onSelect:()=>{},question:'lineage',onQuestion:()=>{}}));
 assert.match(html,/Not answerable from the supplied records/);assert.match(html,/release, artifact, check, review/);
 // Bounded, strict file reading refuses the whole input.
 assert.throws(()=>parseHistorySlice('{'),/Invalid history/);
 assert.throws(()=>parseHistorySlice(JSON.stringify({...JSON.parse(QRAW),extra:1})),/Invalid history/);
 assert.throws(()=>parseHistorySlice(' '.repeat(HISTORY_SLICE_LIMITS.bytes+1)),/Invalid history/);
 const cyc=JSON.parse(QRAW);cyc.records[2].ancestry.parents=[{repository:'example/service',id:'r3'}];assert.throws(()=>parseHistorySlice(JSON.stringify(cyc)),/Invalid history/);
});
test('public filter precedes every question',()=>{
 for(const q of HISTORY_QUESTIONS){
  const a=answerHistoryQuestion(qslice(),q,'public',['svc.ui','svc.secret']);
  assert.ok(!/PRIVATE|hidden|svc\.secret/.test(JSON.stringify(a)),q);
  // One or many private records give the same public answer.
  const more=qslice();more.records.push(...Array.from({length:5},(_,i)=>({...structuredClone(more.records[7]),ref:{repository:'example/service',id:'hidden'+i}})));
  assert.deepEqual(answerHistoryQuestion(more,q,'public',['svc.ui','svc.secret']),a,q);
 }
 // A private malformed record never affects a public answer.
 const bad=qslice();bad.records[7].title='';
 assert.deepEqual(answerHistoryQuestion(bad,'associations','public'),answerHistoryQuestion(qslice(),'associations','public'));
});
