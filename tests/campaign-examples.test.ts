import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileGraphSnapshot,previewGraphReimport,graphTombstonePatch} from '../src/intelligence/graphSnapshot';
import {applyDocumentPatch} from '../src/core/patch';
import {analyzeDomainFiles} from '../src/intelligence/domainAdapters';
import {compileProjectBrief} from '../src/intelligence/brief';
import {previewDeliveryBrief} from '../src/intelligence/delivery';
import {semanticEvolution} from '../src/intelligence/evolution';
import {intelligenceReportHtml} from '../src/export/intelligenceReport';
import {publicDocument} from '../src/core/operations';
import {designSvg} from '../src/export/design';
import {defects} from './helpers/designGeometry';
const read=(name:string)=>JSON.parse(readFileSync('examples/product-campaign/'+name,'utf8'));
test('versioned synthetic graph has explicit parent hierarchy and a reviewable exact-predecessor tombstone',()=>{
 const a=compileGraphSnapshot(read('graph-1.json')).document,b=previewGraphReimport(a,read('graph-2.json'),a.revision).document;
 assert.ok(a.nodes.some(n=>n.label==='Demo project'&&n.childViewId));const patch=graphTombstonePatch(b);assert.ok(patch);
 assert.equal(b.edges.length,a.edges.length);const applied=applyDocumentPatch(b,patch).result;assert.equal(applied.edges.length,a.edges.length-1);assert.equal(applied.nodes.length,b.nodes.length);assert.equal(applied.blocks.length,b.blocks.length);
 assert.throws(()=>applyDocumentPatch({...b,revision:b.revision+1},patch),/revision/i);
});
test('specialist synthetic truth manifest matches actual parser facts and no observation is emitted',()=>{
 const facts=analyzeDomainFiles(read('native-artifacts.json')),truth=read('truth.json');assert.deepEqual(facts.capabilities,truth.domains);
 for(const label of truth.requiredRelations)assert.ok(facts.links.some(l=>l.label===label),label);assert.ok(facts.facts.every(f=>f.path&&f.line>=1));
});
test('declared environment figures are geometrically qualified and public report redacts private source facts',()=>{
 const seed=compileProjectBrief(read('project-brief.json')).document;const doc=previewDeliveryBrief(seed,read('delivery-brief.json')).document;
 assert.ok(!intelligenceReportHtml(doc).includes('Synthetic production'));assert.equal(publicDocument(doc).delivery,undefined);
 for(const n of doc.nodes)n.visibility='public';for(const v of doc.views)v.visibility='public';for(const e of doc.edges)e.visibility='public';for(const s of doc.sources)s.visibility='public';
 for(const rows of [doc.delivery!.environments,doc.delivery!.artifacts,doc.delivery!.instances,doc.delivery!.promotions])for(const r of rows)r.visibility='public';
 for(const theme of ['light','dark','editorial'] as const){const svg=designSvg(doc,'delivery-environment-matrix',{type:'deployment',theme,now:new Date('2026-10-09T00:00:00Z')});assert.ok(svg.includes('declared environment'));assert.ok(svg.includes('Runtime UNKNOWN'));
 assert.deepEqual(defects(svg,'synthetic-deployment-'+theme).failures,[]);}assert.ok(intelligenceReportHtml(doc).includes('Synthetic development'));
 const next=structuredClone(doc);next.nodes[0].label='Changed author caption';const delta=semanticEvolution(doc,next);assert.equal(delta.state,'partial');assert.ok(delta.changes.some(c=>c.change==='changed'));assert.equal(doc.observations.length,0);
});
