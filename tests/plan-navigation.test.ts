import test from 'node:test';import assert from 'node:assert/strict';
import {planNavigation} from '../src/development/planNavigation';
import {parseDeliveryView} from '../src/development/deliveryEvidence';
import {readFileSync} from 'node:fs';
const fixture=()=>parseDeliveryView(readFileSync(new URL('./fixtures/delivery-evidence/linked-plan.json',import.meta.url),'utf8'));
test('private plan is withheld before phase grouping',()=>{const v=fixture();v.visibility='private';assert.deepEqual(planNavigation(v,'public'),[]);});
test('phase zero is not missing',()=>{const v=fixture();v.blocks[0].phase=0;const x=planNavigation(v,'author');assert.ok(x.some(g=>g.label==='Phase 0'&&g.declared));});
test('missing phase is explicit, never inferred from task order',()=>{const v=fixture();v.blocks.forEach(b=>b.phase=null);const x=planNavigation(v,'author');assert.equal(x.length,1);assert.equal(x[0].declared,false);assert.equal(x[0].label,'Phase not supplied');});
test('order and task states remain source declarations',()=>{const v=fixture();v.blocks[0].phase=2;v.blocks[0].state='blocked';v.blocks[1].phase=1;const before=JSON.stringify(v),x=planNavigation(v,'author');assert.equal(x[0].label,'Phase 2');assert.equal(x[0].blocks[0].state,'blocked');assert.equal(JSON.stringify(v),before);});
