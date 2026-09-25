import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {validateDocument} from '../src/core/model';
import {MAX_METRICS,draftOf,emptyMetric,metricsBlock,metricsWarning,type MetricsDraft} from '../src/core/metrics';

const draft=(over:Partial<MetricsDraft>={}):MetricsDraft=>({title:' Quality gate ',provenance:'synthetic',sourceIds:[],items:[{label:' Rows checked ',value:' 12 400 ',note:''},emptyMetric()],...over});

test('metrics draft: trims, drops empty rows, keeps id and visibility, and round-trips through draftOf',()=>{
 const b=metricsBlock(draft(),{id:'metrics-a',visibility:'private'});
 assert.deepEqual(b.items,[{label:'Rows checked',value:'12 400',note:''}]);
 assert.equal(b.title,'Quality gate');assert.equal(b.type,'metrics');assert.equal(b.provenance,'synthetic');assert.equal(b.visibility,'private');
 assert.equal(metricsBlock(draft(),{id:'metrics-b'}).visibility,'public');
 assert.deepEqual(metricsBlock(draftOf(b),b),b,'editing without changes gives the same block');
 assert.deepEqual(draftOf({...b,items:[]}).items,[emptyMetric()],'an empty block opens with one blank row');
});

test('metrics draft: rejects a value without a label, no metrics, too many metrics, a blank title and an over-long value',()=>{
 assert.throws(()=>metricsBlock(draft({items:[{label:'A',value:'1',note:''},{label:' ',value:'2',note:''}]}),{id:'m'}),/Metric 2: add a label/);
 assert.throws(()=>metricsBlock(draft({items:[emptyMetric()]}),{id:'m'}),/at least one metric/);
 assert.throws(()=>metricsBlock(draft({items:Array.from({length:MAX_METRICS+1},(_,i)=>({label:`M${i}`,value:'1',note:''}))}),{id:'m'}),/at most 12/);
 assert.throws(()=>metricsBlock(draft({title:'  '}),{id:'m'}));
 assert.throws(()=>metricsBlock(draft({items:[{label:'A',value:'9'.repeat(81),note:''}]}),{id:'m'}));
});

test('metrics warning: unsourced numbers must be marked synthetic or linked to a source',()=>{
 assert.equal(metricsWarning({provenance:'synthetic',sourceIds:[]}),null);
 assert.match(metricsWarning({provenance:'author',sourceIds:[]})!,/Mark illustrative figures as synthetic/);
 assert.match(metricsWarning({provenance:'source-derived',sourceIds:[]})!,/link the source/);
 assert.equal(metricsWarning({provenance:'source-derived',sourceIds:['cv']}),null);
});

test('a metrics block built by the editor validates in a document, and a private one is redacted from public output',()=>{
 const doc=structuredClone(samples.find(s=>s.nodes.length&&s.views.length)!),node=doc.nodes[0];
 const shown=metricsBlock(draft(),{id:'metrics-shown'}),hidden=metricsBlock(draft({title:'Private KPI'}),{id:'metrics-hidden',visibility:'private'});
 doc.blocks.push(shown,hidden);node.blockIds.push(shown.id,hidden.id);
 const valid=validateDocument(doc),pub=publicDocument(valid);
 assert(pub.blocks.some(b=>b.id==='metrics-shown'));
 assert(!pub.blocks.some(b=>b.id==='metrics-hidden'));assert(!JSON.stringify(pub).includes('Private KPI'));
});
