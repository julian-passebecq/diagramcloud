import test from 'node:test';
import assert from 'node:assert/strict';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {DESIGN_TYPES,documentSchema,validateDocument} from '../src/core/model';
import {DESIGN_TYPE_LABEL} from '../src/export/design';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {samples} from '../src/data/samples';

/** The optional V2 contract additions: backward compatible, validated, and published in the generated JSON Schema. */
const base=()=>({schemaVersion:1,id:'contract',title:'Contract',rootViewId:'root',nodes:[{id:'a',label:'A'}],edges:[],views:[{id:'root',title:'Root',nodeIds:['a'],edgeIds:[]}]});
const FP='0123456789abcdef';

test('contract: every legacy sample stays valid and the new figure types have labels',()=>{
 for(const d of [contosoForecasting(),...samples])assert.ok(validateDocument(structuredClone(d)));
 for(const t of ['gantt','comparison'] as const){assert.ok(DESIGN_TYPES.includes(t));assert.ok(DESIGN_TYPE_LABEL[t]);}
 assert.ok(validateDocument({...base(),views:[{...base().views[0],design:{type:'gantt'}}]}));
});

test('contract: a tour stop ID is optional and unique within its tour; an omitted stop keeps none',()=>{
 const stop=(id?:string)=>({...(id?{id}:{}),viewId:'root',subjects:[{kind:'node',id:'a'}],fingerprint:FP});
 const tour=(stops:unknown[])=>({...base(),tours:[{id:'t',title:'T',sourceRevision:0,stops}]});
 assert.ok(validateDocument(tour([stop('intro'),stop('detail'),stop()])));
 assert.throws(()=>validateDocument(tour([stop('intro'),stop('intro')])),/t: duplicate stop ID; a stop ID is unique within its tour/);
 assert.ok(validateDocument({...base(),tours:[{id:'t',title:'T',sourceRevision:0,stops:[stop('intro')]},{id:'u',title:'U',sourceRevision:0,stops:[stop('intro')]}]}),'unique per tour, not per document');
 assert.throws(()=>validateDocument(tour([{id:'gone',omitted:'stop'}])),/an omitted stop keeps no view, subjects, fingerprint, narration or ID/);
 assert.throws(()=>validateDocument(tour([stop('Bad ID')])));
});

test('contract: a choice may record the revision and fingerprint it was reviewed against',()=>{
 const choice=(reviewBasis:unknown)=>({...base(),nodes:[{id:'a',label:'A',choices:[{id:'c',title:'Store',goal:'Pick a store',options:[{id:'x',label:'X'}],reviewBasis}]}]});
 assert.equal(validateDocument(choice({revision:4,fingerprint:FP})).nodes[0].choices![0].reviewBasis?.revision,4);
 assert.throws(()=>validateDocument(choice({revision:4,fingerprint:'abc'})));assert.throws(()=>validateDocument(choice({revision:-1,fingerprint:FP})));
 assert.throws(()=>validateDocument(choice({revision:4,fingerprint:FP,stale:true})),'no stored staleness');
});

test('contract: the generated JSON Schema publishes schedules, measures, quantity identity, stop IDs and review bases',()=>{
 const schema=JSON.stringify(zodToJsonSchema(documentSchema,{name:'DiagramCloudDocument',target:'jsonSchema7'}));
 for(const key of ['"schedule"','"timezone"','"measure"','"measurementId"','"window"','"reviewBasis"','"gantt"','"comparison"','"estimate"','"baseline"'])assert.ok(schema.includes(key),key);
});
