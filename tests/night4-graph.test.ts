import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {compileGraphSnapshot,graphProjectId,validateGraphSnapshot} from '../src/intelligence/graphSnapshot';

const fixture=()=>JSON.parse(readFileSync('tests/fixtures/night4/graph-fixture.json','utf8'));

test('NIGHT4 synthetic fixture opens seven private perspectives in the existing Project',()=>{
 const graph=fixture();
 const first=compileGraphSnapshot(graph).document, second=compileGraphSnapshot(graph).document;
 assert.equal(first.id,graphProjectId('demo-galaxy-client'));
 assert.deepEqual(first.nodes.map(n=>n.id),second.nodes.map(n=>n.id));
 assert.equal(first.views.length,8);
 assert.equal(first.nodes.filter(n=>n.visibility==='private').length,graph.nodes.length+7);
 assert.equal(first.edges.length,graph.assertions.length);
 assert.equal(first.edges.filter(e=>e.visibility==='private').length,10);
 assert.ok(first.blocks.some(b=>b.provenance==='synthetic'));
 assert.doesNotThrow(()=>validateDocument(first));
 assert.ok(first.views.some(v=>v.title==='Agent topology snapshot'));
 const pub=publicDocument(first);
 assert.equal(pub.edges.length,0);
 assert.ok(pub.nodes.every(n=>n.id==='graph-private-entry'));
 assert.ok(!JSON.stringify(pub).includes('Example session'));
});
test('NIGHT4 external references, duplicate IDs and invalid locators fail before mutation',()=>{
 const original=fixture(),s=JSON.stringify(original);
 const bad=structuredClone(original);bad.assertions[0].to='not-in-scope';
 assert.throws(()=>validateGraphSnapshot(bad),/unresolved/);
 const duplicate=structuredClone(original);duplicate.nodes.push({...duplicate.nodes[0]});
 assert.throws(()=>validateGraphSnapshot(duplicate),/Duplicate node/);
 const escape=structuredClone(original);escape.source_refs[0].path='../etc/passwd';
 assert.throws(()=>validateGraphSnapshot(escape));
 const outside=structuredClone(original);outside.nodes[0].organization_id='hidden-org';
 assert.throws(()=>validateGraphSnapshot(outside),/outside/);
 assert.equal(JSON.stringify(original),s);
});
test('NIGHT4 snapshots do not turn claimed observation or tombstones into reviewed runtime',()=>{
 const graph=fixture();graph.assertions[0].evidence_kind='OBSERVED';
 graph.removed_assertion_ids=['old-assertion'];
 const {document,warnings}=compileGraphSnapshot(graph);
 assert.equal(document.observations.length,0);
 assert.equal(document.edges[0].basis,'unknown');
 assert.ok(warnings.some(text=>/Tombstone/.test(text)));
 assert.ok(warnings.some(text=>/PARTIAL/.test(text)));
});
