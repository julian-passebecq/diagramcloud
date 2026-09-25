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

test('group moves keep every panel on the grid and are checked against the other panels',async()=>{
 const {groupShift,groupProblem,aligned}=await import('../src/experience/layout');
 const p=board(),pick=(ids:string[])=>Object.fromEntries(ids.map(id=>{const s=p.find(x=>x.id===id)!;return [id,{x:s.x,y:s.y,w:s.w,h:s.h}];}));
 const two=pick(['p-chart','p-line']);
 assert.deepEqual(groupShift(two,5,0),two,'the right-hand panel already touches the edge, so the group cannot move right');
 assert.deepEqual(groupShift(two,-3,-9),{'p-chart':{x:0,y:0,w:6,h:4},'p-line':{x:6,y:0,w:6,h:4}},'left is blocked at column 1; up stops at row 1');
 const down=groupShift(two,0,20);
 assert.equal(groupProblem(p,down),null,'moving both below the board is free');
 assert.match(groupProblem(p,groupShift(two,0,1),()=> 'X')!,/would overlap/,'one row down hits the Gantt and table');
 // Aligning panels from different rows.
 const kpiAndChart=pick(['p-kpi','p-gantt']);
 assert.deepEqual(aligned(kpiAndChart,'width'),{'p-kpi':{x:0,y:0,w:7,h:2},'p-gantt':{x:0,y:6,w:7,h:4}});
 assert.match(groupProblem(p,aligned(kpiAndChart,'width'),()=> 'Y')!,/overlap/,'the widened KPI would hit the narrative panel');
 const right=aligned(pick(['p-kpi','p-chart']),'right');
 assert.deepEqual([right['p-kpi'].x+right['p-kpi'].w,right['p-chart'].x+right['p-chart'].w],[6,6]);
 assert.deepEqual(aligned(pick(['p-chart','p-gantt']),'top'),{'p-chart':{x:0,y:2,w:6,h:4},'p-gantt':{x:0,y:2,w:7,h:4}});
 assert.deepEqual(aligned(pick(['p-context','p-table']),'bottom')['p-context'].y,8,'bottom edges meet the lowest panel');
 assert.deepEqual(aligned(pick(['p-kpi','p-gantt']),'height')['p-kpi'].h,4);
 assert.deepEqual(aligned(pick(['p-context','p-table']),'left')['p-context'].x,4);
});
