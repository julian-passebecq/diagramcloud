import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema} from '../src/core/model';
import {designSvg} from '../src/export/design';
import {semanticVisualQuality,compareRenderCandidates} from '../src/intelligence/visualQuality';
import {renderPublicArtifact} from '../src/intelligence/context';
import {samples} from '../src/data/samples';
const fixture=()=>documentSchema.parse({schemaVersion:1,id:'quality-fixture',title:'Synthetic figure QA',rootViewId:'root',nodes:[{id:'input',label:'Input',kind:'source',blockIds:['numeric']},{id:'logic',label:'Logic',kind:'process',status:'running'},{id:'output',label:'Output',kind:'storage'}],edges:[{id:'first',source:'input',target:'logic',quantity:{value:10,unit:'rows/day',provenance:'synthetic'}},{id:'second',source:'logic',target:'output',quantity:{value:5,unit:'rows/day',provenance:'synthetic'}}],views:[{id:'root',title:'Root',nodeIds:['input','logic','output'],edgeIds:['first','second'],positions:{input:{x:0,y:0},logic:{x:300,y:0},output:{x:600,y:0}}}],blocks:[{id:'numeric',title:'Synthetic table',type:'table',columns:['Category','Value'],rows:[['A',5],['B',10]],provenance:'synthetic'}],story:[{title:'Explain synthetic inputs',viewId:'root',narration:'Synthetic example only',highlightEdgeIds:[]}]});
test('semantic QA accepts factual encoding rules and keeps absent/unsupported figure contracts unknown',()=>{
 const p=fixture();for(const figure of ['architecture','sankey','chart','line','heatmap','treemap','sequence','status','timeline']){const q=semanticVisualQuality(p,'root',figure);assert.equal(q.state,figure==='sankey'?'PARTIAL':'SEMANTICS_CHECKED',figure+': '+JSON.stringify(q.checks));}assert.equal(semanticVisualQuality(p,'root','waterfall').state,'PARTIAL');assert.equal(semanticVisualQuality(p,'root','unsupported-figure').state,'UNSUPPORTED');assert.equal(semanticVisualQuality(p,'root','atlas').state,'PARTIAL');
 p.blocks=[];p.nodes[0].blockIds=[];assert.equal(semanticVisualQuality(p,'root','chart').state,'PARTIAL');
});
test('semantic QA sees tampered band values and lost synthetic provenance instead of approving plausible pictures',()=>{
 const p=fixture(),svg=designSvg(p,'root',{type:'sankey'});assert.equal(semanticVisualQuality(p,'root','sankey',svg.replace('data-dd-value="10"','data-dd-value="100"')).state,'DEFECTS_FOUND');
 const widths=semanticVisualQuality(p,'root','sankey',svg.replace(/data-dd-thickness="[^"]+"/,'data-dd-thickness="2"'));assert.equal(widths.state,'DEFECTS_FOUND');
 const balance=semanticVisualQuality(p,'root','sankey',svg).checks.find(c=>c.id==='sankey-balance:logic')!;assert.equal(balance.state,'unknown');assert.match(balance.reason,/10 rows\/day incoming; 5 rows\/day outgoing/);
 const chart=designSvg(p,'root',{type:'chart'});assert.equal(semanticVisualQuality(p,'root','chart',chart.replace('data-provenance="synthetic"','data-provenance="author"')).state,'DEFECTS_FOUND');
 const sequence=designSvg(p,'root',{type:'sequence'});assert.equal(semanticVisualQuality(p,'root','sequence',sequence.replace('not from timing','measured timing')).state,'DEFECTS_FOUND');
 assert.equal(semanticVisualQuality(p,'root','chart',chart.replace('data-value="5"','data-value="50"')).state,'DEFECTS_FOUND');
 const heatmap=designSvg(p,'root',{type:'heatmap'});assert.equal(semanticVisualQuality(p,'root','heatmap',heatmap.replace('data-norm="0"','data-norm="1"')).state,'DEFECTS_FOUND');
 const treemap=designSvg(p,'root',{type:'treemap'});assert.equal(semanticVisualQuality(p,'root','treemap',treemap.replace('data-weight="3"','data-weight="30"')).state,'DEFECTS_FOUND');
});
test('A/B/C are real public renderings with measurable metrics, explicit score weights and unapplied review briefs',()=>{
 const p=fixture(),before=structuredClone(p),comparison=compareRenderCandidates(p,'root');assert.deepEqual(p,before);assert.deepEqual(comparison.candidates.map(c=>c.id),['A','B','C']);
 for(const c of comparison.candidates){assert.equal(c.svg.startsWith('<svg'),true);assert.equal(c.metrics.svgBytes,new TextEncoder().encode(c.svg).byteLength);assert.ok(c.reason);assert.equal(c.state,'REQUIRES_AUTHOR_REVIEW');assert.equal(c.proposal.views[0].type,c.figure);const m=c.metrics;assert.equal(c.score,Math.max(0,100-m.semanticDefects*20-m.geometricDefects*5-Math.min(20,m.unresolvedTransforms)-Math.min(20,m.sourceLayoutCrossings)-Math.min(10,m.sourceSceneTruncations)));}
 assert.equal((renderPublicArtifact(p,{kind:'candidates',viewId:'root'}) as {candidates:unknown[]}).candidates.length,3);
 p.nodes[2].visibility='private';const privateComparison=JSON.stringify(compareRenderCandidates(p,'root'));assert.ok(!privateComparison.includes('Output'));
});
test('semantic QA on actual legacy samples does not invent timing, quantity or employer results',()=>{
 for(const p of samples.slice(0,4))for(const type of ['sequence','treemap','status','sankey']){const result=semanticVisualQuality(p,p.rootViewId,type);assert.notEqual(result.state,'DEFECTS_FOUND',p.id+'/'+type+': '+JSON.stringify(result.checks));}
});
