import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

/** docs/product/R4_CROSSWALK.md maps the R4 packet's work packages and acceptance rows to code. A row is never
 * "implemented" without a test, and every test it cites must exist under that exact title. */
const doc=readFileSync('docs/product/R4_CROSSWALK.md','utf8').split('\r').join('');
const rows=doc.split('\n').filter(l=>/^\| (R4-W\d|R4-AC-\d\d|R3-AC-\d\d|AC\d\d) \|/.test(l)).map(l=>{const cells=l.split(' | ');return {id:cells[0].slice(2),status:cells[cells.length-2],evidence:cells[cells.length-1]};});
const range=(prefix:string,from:number,to:number,width=2)=>Array.from({length:to-from+1},(_,i)=>prefix+String(from+i).padStart(width,'0'));
const expected=[...range('R4-W',0,7,1),...range('R4-AC-',1,28),...range('R3-AC-',1,33),...range('AC',1,30)];
/** A title may itself contain quotes: it ends at the quote followed by the end of the cell or a separator. */
const cites=(evidence:string)=>[...evidence.matchAll(/`(tests\/[^`]+\.ts)` "(.+?)"(?=\s*(?:[;.,|(]|$))/g)].map(m=>({file:m[1],title:m[2]}));
const cited=(file:string,title:string)=>existsSync(file)&&readFileSync(file,'utf8').includes(title);

test('a cited title is read whole, quotes included, and a fake title is refused',()=>{
 const quoted='AC-16 training-inference-rag keeps "changes weights" and "supplies context" distinct at every depth; no lesson says RAG changes weights';
 assert.deepEqual(cites('`tests/learning-content-guards.test.ts` "'+quoted+'" |'),[{file:'tests/learning-content-guards.test.ts',title:quoted}]);
 assert.deepEqual(cites('`tests/a.test.ts` "one"; `tests/b.test.ts` "two" (1.27.0).').map(c=>c.title),['one','two']);
 assert.equal(cited('tests/learning-content-guards.test.ts',quoted),true);
 assert.equal(cited('tests/learning-content-guards.test.ts','AC-16 training-inference-rag keeps "changes weights" and "a fake claim"'),false,'a fake title fails');
});

test('every R4 work package, new and inherited acceptance row is listed once with a known status',()=>{
 assert.deepEqual(rows.map(r=>r.id).sort(),[...expected].sort());
 for(const r of rows)assert.ok(['implemented','partial','not implemented','unmapped'].includes(r.status),r.id+' has status '+r.status);
 assert.match(doc,/not a complete V2/);assert.match(doc,/## Local branch recovery disposition/);
 assert.equal(/[A-Z]:[\\/](?:Users|PROJ)/i.test(doc),false,'no absolute host path in a public document');
});

test('every implemented row cites at least one existing test by its exact title',()=>{
 for(const r of rows){
  const refs=cites(r.evidence);
  if(r.status==='implemented')assert.ok(refs.length>0,r.id+' is implemented without a cited test');
  for(const {file,title} of refs){assert.ok(existsSync(file),`${r.id}: ${file} exists`);assert.ok(cited(file,title),`${r.id}: ${file} has a test titled "${title}"`);}
 }
});
