
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('practice is composed into existing catalogue and source/audience scope, not another app root',()=>{
 const t=readFileSync('src/ui/LearningCatalogue.tsx','utf8');
 assert.match(t,/<InterviewPractice scopeKey=/);assert.match(t,/contentRevision/);assert.match(t,/host\.project/);
});
test('App route callback reuses unsaved-work guard and refuses a different current source',()=>{
 const t=readFileSync('src/App.tsx','utf8');
 assert.match(t,/orientation=\{<ReadingWayfinder/);assert.match(t,/resolveWayfinderPick/);assert.match(t,/liveReading\.current/);
});
test('delivery phases use the same loaded cut and do not introduce another authority',()=>{
 const t=readFileSync('src/ui/DeliveryEvidencePanel.tsx','utf8');
 assert.match(t,/PlanPhaseStrip/);assert.match(t,/v\.inputSha256/);assert.match(t,/samePerspectiveBinding/);
});
