import test from 'node:test';
import assert from 'node:assert/strict';
import {examplePack} from '../src/experience/sample';
import {validatePack} from '../src/experience/model';
import {describeCell,keyStep,moved,placementProblem,resized,stepsFor} from '../src/experience/layout';

const board=()=>examplePack().workspaces.find(w=>w.id==='controls-screen')!.placements;

test('moving and resizing stay inside the 12-column grid',()=>{
 assert.deepEqual(moved({x:4,y:0,w:4,h:2},20,-5),{x:8,y:0,w:4,h:2});
 assert.deepEqual(moved({x:4,y:3,w:4,h:2},-9,1),{x:0,y:4,w:4,h:2});
 assert.deepEqual(resized({x:6,y:0,w:4,h:2},9,20),{x:6,y:0,w:6,h:12});
 assert.deepEqual(resized({x:6,y:0,w:4,h:2},-9,-9),{x:6,y:0,w:1,h:1});
});

test('pointer distance becomes whole grid steps; jitter below half a step does nothing',()=>{
 assert.equal(stepsFor(40,90),0);assert.equal(stepsFor(46,90),1);assert.equal(stepsFor(-140,90),-2);assert.equal(stepsFor(300,0),0);
});

test('overlaps and out-of-grid cells are refused with a reason naming the other panel',()=>{
 const p=board(),chart=p.find(s=>s.id==='p-chart')!;
 assert.equal(placementProblem(p,'p-chart',{x:0,y:2,w:6,h:4}),null,'its own cell is fine');
 assert.match(placementProblem(p,'p-chart',{x:3,y:2,w:6,h:4},()=> 'Cumulative cost curve')!,/overlap “Cumulative cost curve”/);
 assert.match(placementProblem(p,'p-chart',{x:8,y:2,w:6,h:4})!,/outside the 12-column grid/);
 assert.match(placementProblem(p,'p-chart',{x:0,y:2.5,w:6,h:4})!,/whole grid cells/);
 assert.equal(placementProblem(p,'p-chart',{...chart,y:10}),null,'free rows below the board are allowed');
});

test('arrow keys move with the grip and resize with the corner handle',()=>{
 const c={x:2,y:2,w:4,h:3};
 assert.deepEqual(keyStep('ArrowRight','move',c),{x:3,y:2,w:4,h:3});
 assert.deepEqual(keyStep('ArrowUp','move',c),{x:2,y:1,w:4,h:3});
 assert.deepEqual(keyStep('ArrowRight','resize',c),{x:2,y:2,w:5,h:3});
 assert.deepEqual(keyStep('ArrowUp','resize',c),{x:2,y:2,w:4,h:2});
 assert.equal(keyStep('Enter','move',c),null);
 assert.equal(describeCell(c),'column 3, row 3, 4 wide × 3 tall');
});

test('every cell the helpers accept also passes pack validation',()=>{
 const p=examplePack(),w=p.workspaces.find(x=>x.id==='controls-screen')!;
 for(const s of w.placements)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[5,7]]){
  const cell=moved(s,dx,dy);if(placementProblem(w.placements,s.id,cell))continue;
  const q=structuredClone(p);Object.assign(q.workspaces.find(x=>x.id==='controls-screen')!.placements.find(x=>x.id===s.id)!,cell);
  assert.doesNotThrow(()=>validatePack(q),`${s.id} -> ${JSON.stringify(cell)}`);
 }
});
