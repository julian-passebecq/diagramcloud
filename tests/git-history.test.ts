import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gitHistory} from './helpers/gitHistory';
import {readRepository} from '../scripts/lib/readRepo';
import {scanRepository} from '../src/core/scan/scanner';
test('temporary Git history has deterministic revisions, branches and independent worktrees',()=>{
 const a=gitHistory(),b=gitHistory();try{
  assert.equal(a.first,b.first);const files={'src/worker.py':'def synthetic_worker():\n    return 1\n'};
  const next=a.commit(files,'Synthetic next revision');assert.equal(next,b.commit(files,'Synthetic next revision'));assert.notEqual(next,a.first);
  const linked=a.worktree('review');assert.equal(a.git('branch','--show-current'),'main');const main=scanRepository(readRepository(a.repository),{name:'Synthetic'});
  assert.equal(main.commit,next);assert.equal(main.branch,'main');assert.ok(!readRepository(a.repository).some(f=>f.path.startsWith('worktree-review/')));
  assert.ok(linked.startsWith(a.base));assert.ok(a.git('worktree','list','--porcelain').includes('refs/heads/review'));
 }finally{a.cleanup();b.cleanup();}
});
