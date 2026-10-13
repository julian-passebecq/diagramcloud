import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
import {sourceConflictCandidates} from '../src/intelligence/sourceConflicts';
import {projectReadiness} from '../src/intelligence/readiness';
import {publicDocument} from '../src/core/operations';
test('explicit source discrepancy retains exact citations without choosing a datastore or inventing runtime',async()=>{
 const files=[{path:'README.md',text:'# Synthetic scope\nPrimary datastore: PostgreSQL\n'},{path:'package.json',text:'{\n "dependencies": {"better-sqlite3": "1.0.0"}\n}'}];
 const candidates=sourceConflictCandidates([files[0]],[files[1]]);assert.equal(candidates.length,1);assert.equal(candidates[0].line,2);assert.match(candidates[0].message,/package.json:2/);assert.match(candidates[0].message,/coexisting stores is unknown/);
 const picked=files.map(f=>Object.assign(new File([f.text],f.path),{webkitRelativePath:'synthetic/'+f.path})),out=await analyzePickedFolder(picked,{depth:'quick'});assert.equal(out.document.observations.length,0);assert.ok(out.analysis.documentMap.diagnostics.some(d=>d.message.startsWith('Source discrepancy candidate:')));assert.ok(projectReadiness(out.document).gaps.some(g=>g.state==='conflicting'&&g.resolution.includes('Review both')));assert.ok(!JSON.stringify(publicDocument(out.document)).includes('Primary datastore'));assert.ok(!projectReadiness(publicDocument(out.document)).gaps.some(g=>g.state==='conflicting'));
});
test('casual prose, supported coexistence and matching declarations are not labelled conflicting',()=>{
 const sqlite=[{path:'package.json',text:'{"dependencies":{"better-sqlite3":"1"}}'}];assert.deepEqual(sourceConflictCandidates([{path:'README.md',text:'We previously discussed PostgreSQL.'}],sqlite),[]);assert.deepEqual(sourceConflictCandidates([{path:'README.md',text:'Database: SQLite'}],sqlite),[]);assert.deepEqual(sourceConflictCandidates([{path:'README.md',text:'Database: PostgreSQL'}],[{path:'package.json',text:'{"dependencies":{"pg":"1","better-sqlite3":"1"}}'}]),[]);
});
