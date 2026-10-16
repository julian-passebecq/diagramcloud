import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {observationPatch,type ObservationInput} from '../src/core/realization';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
import {environmentMatrix,deliveryGates,deliveryCoverageMatrix} from '../src/intelligence/delivery';
import {verificationGaps,proposeVerificationSpec} from '../src/intelligence/verification';
import {impactFacts,architectureAudit} from '../src/intelligence/recipes';
import {queryProject} from '../src/intelligence/context';
import {evolutionSnapshot,compareEvolutionSnapshots,retainEvolutionSnapshotPatch,readEvolutionHistory} from '../src/intelligence/evolution';
import {deliverySvg} from '../src/export/design/operations';
import {intelligenceReportHtml} from '../src/export/intelligenceReport';
import {howItWorksHtml} from '../src/export/howItWorks';
import {portfolioHtml} from '../src/export/html';
import {addArchitectureSlides} from '../src/export/pptx';

// All source statements and review decisions below are isolated synthetic QA simulations.
const commit='a'.repeat(40),otherCommit='b'.repeat(40),at='2026-10-15T11:00:00Z';
function seed():Project{return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-facet-consumers',title:'Synthetic consumer fixture',rootViewId:'root',
 provenance:'Synthetic QA fixture; no real deployment or author review.',
 nodes:[{id:'api',label:'Synthetic API'},{id:'instance',label:'Synthetic instance'}],edges:[],
 views:[{id:'root',title:'Synthetic system',nodeIds:['api','instance']}],
 delivery:{environments:[{id:'dev',label:'Synthetic development'},{id:'prod',label:'Synthetic production'}],artifacts:[{id:'artifact',label:'Synthetic artifact',version:'qa-1',sourceRevision:commit}],instances:[{id:'deployment',nodeId:'instance',componentId:'api',environmentId:'dev',artifactId:'artifact',declaredRevision:commit}],promotions:[{id:'promotion',fromEnvironmentId:'dev',toEnvironmentId:'prod',artifactId:'artifact',gates:[{id:'gate',label:'Synthetic check'}]}]}}));}
function input(id:string,over:Partial<ObservationInput>={}):ObservationInput{return {id,nodeId:'instance',sourceApp:'synthetic-owner',authority:'Synthetic QA source',observedAt:'2026-10-15T10:00:00Z',sourceRevision:commit,claim:'verified',summary:'Synthetic snapshot only.',caveat:'No real runtime claim.',...over};}
const scoped=(id='facet',over:Partial<ObservationInput>={})=>input(id,{observedAt:at,sourceRevision:otherCommit,stateFacet:{facet:'lifecycle',value:'FROZEN',scope:'release-qa'},...over});
function add(doc:Project,observation:ObservationInput,visibility:'public'|'private'='public'):Project{
 const proposal=applyDocumentPatch(doc,observationPatch(doc,observation)).result;
 const next=proposal.observations.find(o=>o.id===observation.id)!;
 assert.equal(next.reviewedAt,undefined);assert.equal(next.visibility,'private');
 // Simulated human review, confined to this explicitly synthetic test fixture.
 Object.assign(next,{reviewedAt:at,visibility});return validateDocument({...proposal,revision:doc.revision+1});
}

test('scoped lifecycle verification neither creates runtime evidence nor replaces an older general claim',()=>{
 const only=add(seed(),scoped()),before=JSON.stringify(only),row=environmentMatrix(only,{at})[0];
 assert.equal(row.observed,null);assert.equal(row.freshness,'UNKNOWN');assert.equal(row.drift,'UNKNOWN');
 assert.equal(deliveryCoverageMatrix(only,{at})[0].state,'declared');
 const svg=deliverySvg(only,'release-chain',{at});assert(svg.includes('Runtime UNKNOWN'));assert(!svg.includes('claim source '+otherCommit));
 const mixed=add(add(seed(),input('runtime',{claim:'observed'})),scoped());
 assert.deepEqual(environmentMatrix(mixed,{at})[0].observed,{claim:'observed',capturedAt:'2026-10-15T10:00:00Z',revision:commit,authority:'Synthetic QA source'});
 assert.equal(environmentMatrix(mixed,{at})[0].drift,'same-revision');assert.equal(JSON.stringify(only),before);
});

test('an explicitly linked facet stays linked but cannot satisfy a general gate',()=>{
 const p=add(seed(),scoped());p.delivery!.promotions[0].gates[0].observationId='facet';
 const gate=deliveryGates(validateDocument(p),{at})[0].gates[0];
 assert.equal(gate.observationId,'facet');assert.equal(gate.result,undefined);assert.equal(gate.freshness,'UNKNOWN');assert.equal(gate.revisionMatch,'UNKNOWN');assert.equal(gate.reason,'scoped-state-claim-not-general-gate');
 const mixed=add(p,input('runtime'));mixed.delivery!.promotions[0].gates[0].observationId='runtime';
 const general=deliveryGates(validateDocument(mixed),{at})[0].gates[0];
 assert.equal(general.result?.id,'runtime');assert.equal(general.revisionMatch,'exact-source-revision');assert(!Object.hasOwn(general,'reason'));
});

test('even exact check-shaped backing cannot promote a facet into execution-check coverage',()=>{
 let p=seed();p.blocks.push({id:'check-backing',type:'code',language:'json',title:'Synthetic external receipt fixture',code:JSON.stringify({check:{check_id:'test'},revision:{commit}}),provenance:'source-derived',visibility:'public',sourceIds:[]});p.nodes[1].blockIds.push('check-backing');p=validateDocument(p);
 p=add(p,scoped('facet',{sourceRevision:commit,blockIds:['check-backing']}));
 const spec=(doc:Project)=>proposeVerificationSpec(doc,{id:'qa-spec',repositories:[{id:'repo',repository:'synthetic/repository',commit}],checks:[{id:'test',nodeId:'instance',repositoryId:'repo',question:'Synthetic check?',expected:'Synthetic external receipt',kind:'test'}]});
 assert.equal(verificationGaps(p,spec(p))[0].state,'UNKNOWN');
 p=add(p,input('runtime',{blockIds:['check-backing']}));
 assert.deepEqual(verificationGaps(p,spec(p))[0].observationIds,['runtime']);
});

test('impact and public verification queries retain missing general-check gaps and typed source objects',()=>{
 let p=add(seed(),scoped());p=add(p,scoped('private-facet',{stateFacet:{facet:'runtime',value:'PRIVATE_FACET_SENTINEL',scope:'PRIVATE_SCOPE_SENTINEL'}}),'private');
 const before=JSON.stringify(p),impact=impactFacts(p,'instance',{direction:'downstream',includeInferred:false});
 assert.deepEqual(impact.checks,[]);assert.deepEqual(impact.gaps.map(g=>g.nodeId),['instance']);
 const data=queryProject(p,{kind:'verification'}).data as {reviewedClaims:Project['observations'];gaps:{nodeId:string}[]};
 assert(data.gaps.some(g=>g.nodeId==='instance'));assert.deepEqual(data.reviewedClaims[0].stateFacet,{facet:'lifecycle',value:'FROZEN',scope:'release-qa'});assert(!JSON.stringify(data).includes('PRIVATE_'));
 const mixed=add(p,input('runtime'));assert(!impactFacts(mixed,'instance',{direction:'downstream',includeInferred:false}).gaps.length);
 assert(!(queryProject(mixed,{kind:'verification'}).data as typeof data).gaps.some(g=>g.nodeId==='instance'));assert.equal(JSON.stringify(p),before);
});

test('audit separates independent axes/scopes while retaining same-axis disagreements',()=>{
 let p=add(seed(),scoped('frozen',{sourceRevision:commit}));
 p=add(p,scoped('distribution',{sourceRevision:commit,claim:'partial',stateFacet:{facet:'distribution',value:'DEPLOYED',scope:'release-qa'}}));
 p=add(p,scoped('other-release',{sourceRevision:commit,claim:'partial',stateFacet:{facet:'lifecycle',value:'CANCELLED',scope:'other-release'}}));
 assert.deepEqual(architectureAudit(p).conflicts,[]);
 p=add(p,scoped('cancelled',{sourceRevision:commit,stateFacet:{facet:'lifecycle',value:'CANCELLED',scope:'release-qa'}}));
 const conflicts=architectureAudit(p).conflicts;assert.equal(conflicts.length,1);assert.deepEqual(conflicts[0].observationIds,['frozen','cancelled']);assert.deepEqual(conflicts[0].stateFacet,{facet:'lifecycle',scope:'release-qa'});
});

test('evolution preserves typed state in retained private history and qualified diff text',()=>{
 const before=add(seed(),scoped()),after=add(before,scoped('later',{observedAt:'2026-10-15T12:00:00Z',stateFacet:{facet:'lifecycle',value:'CANCELLED',scope:'release-qa'}}));
 const a=evolutionSnapshot(before,{id:'before',capturedAt:at}),b=evolutionSnapshot(after,{id:'after',capturedAt:'2026-10-15T12:00:00Z'});
 assert.deepEqual(b.nodes.find(n=>n.id==='instance')!.claims.find(c=>c.id==='later')!.stateFacet,{facet:'lifecycle',value:'CANCELLED',scope:'release-qa'});
 const diff=compareEvolutionSnapshots(a,b),change=diff.changes.find(c=>c.change==='verification')!;
 assert(change.after!.includes('Lifecycle: CANCELLED (scope: release-qa)'));assert(change.reason.includes('not a current runtime verdict'));assert.deepEqual(diff.staleEvidence,[]);
 const retained=applyDocumentPatch(after,retainEvolutionSnapshotPatch(after,b)).result;
 assert.deepEqual(readEvolutionHistory(retained,true).snapshots[0].nodes.find(n=>n.id==='instance')!.claims,b.nodes.find(n=>n.id==='instance')!.claims);
 assert(!JSON.stringify(publicDocument(retained)).includes('diagramcloud.evolution-snapshot/1'));
 const legacy=evolutionSnapshot(add(seed(),input('runtime')));assert(!Object.hasOwn(legacy.nodes.find(n=>n.id==='instance')!.claims[0],'stateFacet'));
});

test('public summaries and PPTX notes retain scoped claims and omit private state text',async()=>{
 const scope='release <qa> & owner',value='FROZEN <qa>';let p=add(seed(),scoped('public-facet',{stateFacet:{facet:'lifecycle',value,scope}}));
 p=add(p,scoped('private-facet',{stateFacet:{facet:'runtime',value:'PRIVATE_FACET_SENTINEL',scope:'PRIVATE_SCOPE_SENTINEL'}}),'private');
 p.story=[{title:'Synthetic story',viewId:'root',nodeId:'instance',narration:'Synthetic step',highlightEdgeIds:[],observationIds:['public-facet','private-facet']}];p=validateDocument(p);
 const before=JSON.stringify(p);
 for(const html of [intelligenceReportHtml(p),howItWorksHtml(p,{mode:'story'}),portfolioHtml(p)]){assert(!html.includes('PRIVATE_'));assert(html.includes('release'));assert(html.includes('FROZEN'));}
 for(const html of [intelligenceReportHtml(p),howItWorksHtml(p,{mode:'story'})])assert(html.includes('Lifecycle: FROZEN &lt;qa&gt; (scope: release &lt;qa&gt; &amp; owner)'));
 const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';await addArchitectureSlides(pptx,publicDocument(p),{cover:false,evidence:false,sources:false,realization:true,firstViewSlide:1});
 const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'})),names=Object.keys(zip.files).filter(n=>/\.(?:xml|rels)$/.test(n)),xml=(await Promise.all(names.map(n=>zip.file(n)!.async('string')))).join('\n');
 assert(!xml.includes('PRIVATE_'));const noteNames=names.filter(n=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
 const notes=(await Promise.all(noteNames.map(n=>zip.file(n)!.async('string')))).join('\n');assert(notes.includes('Lifecycle: FROZEN &lt;qa&gt; (scope: release &lt;qa&gt; &amp; owner)'));assert(notes.includes('synthetic-owner'));assert.equal(JSON.stringify(p),before);
});
