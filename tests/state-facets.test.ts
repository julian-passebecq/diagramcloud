import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {clone,documentSchema,validateDocument,type Project,type StateFacet} from '../src/core/model';
import {applyDocumentPatch} from '../src/core/patch';
import {describeChanges} from '../src/core/changeDetail';
import {publicDocument} from '../src/core/operations';
import {observationLine,observationPatch,presentedObservation,presentedObservations,realizationOf,stateFacetsFor,type ObservationInput} from '../src/core/realization';
import {viewSpec} from '../src/core/viewspec';
import {buildScene} from '../src/export/scene';
import {documentFromSvg,svgDiagram} from '../src/export/diagram';
import {portfolioHtml} from '../src/export/html';
import {addArchitectureSlides} from '../src/export/pptx';
import {publicationSnapshot} from '../src/core/galaxy';
import {portfolioIndex} from '../src/export/portfolioIndex';
import {conceptSpec,authorConceptPreview} from '../src/export/concept';

const axes=['lifecycle','selection','implementation','verification','distribution','runtime'] as const;
const labels=['Lifecycle','Selection','Implementation','Verification','Distribution','Runtime'];
function seed():Project{return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-state-facets',revision:7,title:'Synthetic independent state fixture',rootViewId:'root',
 nodes:[{id:'app',label:'Synthetic application',status:'idle',basis:'planned',blockIds:['fixture-code']},{id:'other',label:'Other synthetic application'},{id:'hidden',label:'Hidden synthetic application',visibility:'private'}],edges:[],
 views:[{id:'root',title:'Synthetic states',nodeIds:['app','other','hidden'],positions:{app:{x:0,y:0},other:{x:300,y:0},hidden:{x:600,y:0}}}],
 blocks:[{id:'fixture-code',type:'code',title:'Authored synthetic example',language:'text',code:'export const syntheticFixture = true;',provenance:'author'}]}));}
function input(id:string,facet?:StateFacet,value='FROZEN',scope='release-1',over:Partial<ObservationInput>={}):ObservationInput{
 return {id,nodeId:'app',sourceApp:'synthetic-owner',authority:'Synthetic fixture owner; no real runtime claim',observedAt:'2026-10-15T09:00:00Z',sourceRevision:'source-fixture-1',claim:'observed',summary:'Synthetic source snapshot only.',caveat:'Test fixture; no deployment or execution.',...(facet?{stateFacet:{facet,value,scope}}:{}),...over};
}
/** Exercise the real review-patch path; bumping a fixture revision simulates the subsequent author commit. */
function add(doc:Project,observation:ObservationInput):Project{return validateDocument({...applyDocumentPatch(doc,observationPatch(doc,observation)).result,revision:doc.revision+1});}
/** Tests alone stand in for a human reviewing these explicitly synthetic fixtures. */
function simulateReview(doc:Project,ids:string[],visibility:'private'|'public'='public'):Project{
 const next=clone(doc);for(const observation of next.observations)if(ids.includes(observation.id))Object.assign(observation,{reviewedAt:'2026-10-15T15:00:00Z',visibility});return validateDocument(next);
}
function row(doc:Project,facet:StateFacet){return stateFacetsFor(doc,'app').find(r=>r.facet===facet)!;}

test('facet observations enter as revision-guarded private proposals without changing design facts',()=>{
 const doc=seed(),before=JSON.stringify(doc),external=input('frozen','lifecycle'),patch=observationPatch(doc,external),proposal=applyDocumentPatch(doc,patch).result;
 assert.equal(JSON.stringify(doc),before);assert.equal(patch.baseRevision,7);assert.equal(proposal.revision,7,'a review proposal does not silently commit');
 assert.deepEqual(proposal.observations[0],{...external,blockIds:[],visibility:'private',shareable:false});
 assert.equal(proposal.observations[0].reviewedAt,undefined);assert.deepEqual(proposal.nodes,doc.nodes);assert.deepEqual(proposal.blocks,doc.blocks);
 assert.deepEqual(publicDocument(proposal).observations,[]);
 assert.throws(()=>applyDocumentPatch({...doc,revision:8},patch),/Stale patch/);
 assert.throws(()=>applyDocumentPatch({...doc,id:'other-project'},patch),/patch is for/);
 assert.throws(()=>applyDocumentPatch(doc,observationPatch(doc,{...external,nodeId:'missing'})),/no item with id/);
 assert.equal(JSON.stringify(doc),before,'all refusals preserve the original document');
 const smuggled=applyDocumentPatch(doc,observationPatch(doc,{...external,reviewedAt:'2026-10-15T10:00:00Z',visibility:'public',shareable:true} as ObservationInput)).result.observations[0];
 assert.equal(smuggled.reviewedAt,undefined);assert.equal(smuggled.visibility,'private');assert.equal(smuggled.shareable,false,'source producers cannot make author decisions');
});

test('FROZEN lifecycle and DEPLOYED distribution coexist while unspecified runtime stays unknown',()=>{
 let doc=add(seed(),input('frozen','lifecycle'));
 doc=add(doc,input('deployed','distribution','DEPLOYED','production',{sourceApp:'synthetic-distributor',sourceRevision:'distribution-fixture-9'}));
 const before=JSON.stringify(doc),rows=stateFacetsFor(doc,'app');
 assert.deepEqual(rows.map(r=>r.facet),axes);assert.deepEqual(rows.map(r=>r.label),labels);
 assert.deepEqual(row(doc,'lifecycle').observations.map(o=>o.stateFacet),[{facet:'lifecycle',value:'FROZEN',scope:'release-1'}]);
 assert.deepEqual(row(doc,'distribution').observations.map(o=>o.stateFacet),[{facet:'distribution',value:'DEPLOYED',scope:'production'}]);
 for(const facet of ['selection','implementation','verification','runtime'] as const)assert.deepEqual(row(doc,facet).observations,[],facet+' has no invented state');
 assert.equal(doc.nodes[0].status,'idle');assert.equal(doc.nodes[0].basis,'planned');assert.equal(JSON.stringify(doc),before);
 assert(stateFacetsFor(doc,'missing').every(r=>r.observations.length===0),'an unknown node has no inferred state');
});

test('a CANCELLED lifecycle retains its component, authored code, memberships and other source claims',()=>{
 let doc=add(seed(),input('implemented','implementation','IMPLEMENTED','source-fixture-1'));
 const before=clone(doc);doc=add(doc,input('cancelled','lifecycle','CANCELLED','release-2'));
 for(const key of ['nodes','edges','views','blocks','sources','story'] as const)assert.deepEqual(doc[key],before[key],key+' remains intact');
 assert.equal(doc.blocks[0].type,'code');assert.equal(row(doc,'implementation').observations[0].stateFacet!.value,'IMPLEMENTED');
 assert.equal(row(doc,'lifecycle').observations[0].stateFacet!.value,'CANCELLED');
});

test('all six axes preserve source vocabulary exactly, including nonblank spacing and the 160-character boundary',()=>{
 const values=[' FROZEN ','Cancelled','implemented-by-owner','NOT_RUN','DEPLOYED','x'.repeat(160)],scopes=[' Release-1 ','source-scope-2','branch-3','suite-4','production','s'.repeat(160)];
 let doc=seed();for(const [index,facet] of axes.entries())doc=add(doc,input('axis-'+facet,facet,values[index],scopes[index]));
 assert.deepEqual(stateFacetsFor(doc,'app').map(r=>r.observations[0].stateFacet),axes.map((facet,index)=>({facet,value:values[index],scope:scopes[index]})));
});

test('history keeps independent owners and scopes; equal instants sort by stable ID without selecting a winner',()=>{
 let doc=seed();
 const observations=[
  input('same-b','lifecycle','FROZEN','release-1',{observedAt:'2026-10-15T12:00:00+02:00',sourceApp:'owner-b',sourceRevision:'b'.repeat(40)}),
  input('old','lifecycle','ACTIVE','release-1',{observedAt:'2026-10-14T09:00:00Z'}),
  input('same-a','lifecycle','CANCELLED','release-2',{observedAt:'2026-10-15T10:00:00Z',sourceApp:'owner-a',sourceRevision:'a'.repeat(40)}),
  input('new','lifecycle','ACTIVE','release-3',{observedAt:'2026-10-15T14:00:00Z'}),
  input('other-node','lifecycle','OTHER_COMPONENT','release-1',{nodeId:'other',observedAt:'2026-10-15T16:00:00Z'})
 ];
 for(const observation of observations)doc=add(doc,observation);
 const before=JSON.stringify(doc),history=row(doc,'lifecycle').observations;
 assert.deepEqual(history.map(o=>o.id),['new','same-a','same-b','old']);
 assert.deepEqual(history.find(o=>o.id==='same-a'),doc.observations.find(o=>o.id==='same-a'),'source, scope, authority, time, revision and claim stay attached');
 assert.deepEqual(history.find(o=>o.id==='same-b'),doc.observations.find(o=>o.id==='same-b'));
 assert.deepEqual(Object.keys(row(doc,'lifecycle')).sort(),['facet','label','observations'],'no synthetic current-state or winner field');
 assert.equal(JSON.stringify(doc),before,'projection sorting does not reorder source history');
 history.reverse();assert.equal(JSON.stringify(doc),before,'returned history arrays do not alias the document array');
});

test('untyped status-like summaries and old documents remain unclassified and byte-compatible',()=>{
 const doc=add(seed(),input('ordinary',undefined,'unused','unused',{summary:'FROZEN; DEPLOYED; CANCELLED are words in a summary.'}));
 assert(!Object.hasOwn(doc.observations[0],'stateFacet'));assert(stateFacetsFor(doc,'app').every(r=>r.observations.length===0));
 assert.equal(JSON.stringify(validateDocument(JSON.parse(JSON.stringify(doc)))),JSON.stringify(doc));
 assert.equal(observationLine(doc.observations[0],'Synthetic application'),'Synthetic application: Observed by synthetic-owner (authority: Synthetic fixture owner; no real runtime claim) at revision source-fixture-1, observed 2026-10-15. FROZEN; DEPLOYED; CANCELLED are words in a summary. Caveat: Test fixture; no deployment or execution.');
});

test('a verified facet never promotes a whole component to generic Verified or replaces its ordinary badge',()=>{
 const facetOnly=simulateReview(add(seed(),input('facet-verified','lifecycle','FROZEN','release-1',{claim:'verified',observedAt:'2026-10-15T12:00:00Z'})),['facet-verified']);
 assert.equal(realizationOf(facetOnly,'app').state,'designed');assert.equal(realizationOf(facetOnly,'app').text,'Designed');
 assert.equal(presentedObservation(facetOnly,'app'),undefined);
 assert.equal(viewSpec(facetOnly,'root').nodes.find(n=>n.id==='app')!.observation,undefined);
 assert.equal(buildScene(publicDocument(facetOnly),publicDocument(facetOnly).views[0]).nodes.find(n=>n.id==='app')!.realization,undefined);
 assert.deepEqual(presentedObservations(facetOnly).map(o=>o.id),['facet-verified'],'typed presented claims still reach notes and appendices');
 assert.equal(row(facetOnly,'lifecycle').observations[0].claim,'verified');
 const mixed=simulateReview(add(facetOnly,input('ordinary-observed',undefined,'unused','unused',{claim:'observed',observedAt:'2026-10-14T09:00:00Z'})),['ordinary-observed']);
 assert.equal(realizationOf(mixed,'app').latest!.id,'ordinary-observed');assert.equal(realizationOf(mixed,'app').count,1);
 assert.equal(presentedObservation(mixed,'app')!.id,'ordinary-observed');
 assert.equal(viewSpec(mixed,'root').nodes.find(n=>n.id==='app')!.observation!.claim,'Observed');
 assert.equal(buildScene(publicDocument(mixed),publicDocument(mixed).views[0]).nodes.find(n=>n.id==='app')!.realization!.claim,'observed');
 assert.equal(row(mixed,'lifecycle').observations[0].id,'facet-verified');
});

test('added, changed and removed facet details expose actual axis, value and scope for human review',()=>{
 const base=seed(),added=add(base,input('detail','lifecycle'));
 const entry=describeChanges(base,added).changes.find(c=>c.group==='observations'&&c.id==='detail')!;
 assert.equal(entry.kind,'added');const field=entry.fields.find(f=>f.field==='stateFacet')!;
 for(const value of ['lifecycle','FROZEN','release-1'])assert(field.after.includes(value));
 const changed=clone(added);changed.observations[0].stateFacet={facet:'distribution',value:'DEPLOYED',scope:'production'};
 const delta=describeChanges(added,validateDocument(changed)).changes.find(c=>c.group==='observations'&&c.id==='detail')!.fields.find(f=>f.field==='stateFacet')!;
 for(const value of ['lifecycle','FROZEN','release-1'])assert(delta.before.includes(value));
 for(const value of ['distribution','DEPLOYED','production'])assert(delta.after.includes(value));
 const untyped=clone(changed);delete untyped.observations[0].stateFacet;
 const removed=describeChanges(changed,validateDocument(untyped)).changes.find(c=>c.group==='observations')!.fields.find(f=>f.field==='stateFacet')!;
 assert(removed.before.includes('DEPLOYED'));assert(!removed.after.includes('DEPLOYED'));
 assert.equal(added.observations[0].stateFacet!.value,'FROZEN','review detail never mutates the source');
});

test('facet validation refuses blanks, malformed axes, extra fields and secrets without mutating or echoing secret values',()=>{
 const doc=seed(),before=JSON.stringify(doc),valid={facet:'lifecycle',value:'FROZEN',scope:'release-1'};
 const invalid:unknown[]=[null,[],{}, {...valid,facet:'status'},{...valid,facet:'Lifecycle'}, {...valid,value:''},{...valid,value:' \t\n '},{...valid,scope:'  '},
  {...valid,value:'x'.repeat(161)},{...valid,scope:'x'.repeat(161)},{...valid,value:3},{...valid,scope:[]},{...valid,latest:true},
  {...valid,value:'password=PRIVATE_REFUSED_VALUE'},{...valid,scope:'postgres://person:PRIVATE_REFUSED_VALUE@localhost/db'}];
 for(const stateFacet of invalid){
  const external={...input('invalid','lifecycle'),stateFacet} as ObservationInput;
  assert.throws(()=>applyDocumentPatch(doc,observationPatch(doc,external)));
  assert.throws(()=>validateDocument({...doc,observations:[{...input('invalid','lifecycle'),blockIds:[],visibility:'private',shareable:false,stateFacet}]}));
  assert.equal(JSON.stringify(doc),before);
 }
 for(const key of ['value','scope'] as const){
  const external=input('secret','lifecycle');external.stateFacet={...valid,facet:'lifecycle',[key]:'password=PRIVATE_REFUSED_VALUE'};
  assert.throws(()=>applyDocumentPatch(doc,observationPatch(doc,external)),(error:unknown)=>error instanceof Error&&/credential-like/.test(error.message)&&!error.message.includes('PRIVATE_REFUSED_VALUE'));
 }
});

function publicationFixture(){
 let doc=seed();
 for(const observation of [input('public-frozen','lifecycle'),input('public-deployed','distribution','DEPLOYED','production'),
  input('private','selection','PRIVATE_SELECTION_MARKER','PRIVATE_SCOPE_MARKER'),input('unreviewed','runtime','UNREVIEWED_RUNTIME_MARKER','UNREVIEWED_SCOPE_MARKER'),
  input('hidden-node','implementation','HIDDEN_IMPLEMENTATION_MARKER','HIDDEN_SCOPE_MARKER',{nodeId:'hidden'})])doc=add(doc,observation);
 doc=simulateReview(doc,['public-frozen','public-deployed','hidden-node']);doc=simulateReview(doc,['private'],'private');
 // Public visibility alone is insufficient: a synthetic author has not reviewed this runtime claim.
 const unreviewed=clone(doc);unreviewed.observations.find(o=>o.id==='unreviewed')!.visibility='public';return validateDocument(unreviewed);
}
const privateMarkers=['PRIVATE_SELECTION_MARKER','PRIVATE_SCOPE_MARKER','UNREVIEWED_RUNTIME_MARKER','UNREVIEWED_SCOPE_MARKER','HIDDEN_IMPLEMENTATION_MARKER','HIDDEN_SCOPE_MARKER'];

test('ViewSpec and concept loss ledgers report only selected-audience scoped state omissions',()=>{
 const doc=publicationFixture(),publicSpec=viewSpec(doc,'root'),authorSpec=viewSpec(doc,'root',{audience:'author'});
 const omission='2 scoped state-facet claim(s) retained in Project observation history; not represented as general component realization in this view.';
 assert(publicSpec.omissions.includes(omission));assert(authorSpec.omissions.some(s=>s.startsWith('5 scoped state-facet claim(s)')));
 assert(conceptSpec(doc,'root').report.lost.includes(omission));
 assert(authorConceptPreview(doc,{projectId:doc.id,baseRevision:doc.revision,viewId:'root'}).report.lost.some(s=>s.startsWith('5 scoped state-facet claim(s)')));
 for(const marker of privateMarkers)assert(!JSON.stringify(publicSpec).includes(marker));
 assert(!viewSpec(seed(),'root').omissions.some(s=>s.includes('state-facet')),'legacy views gain no invented omission');
});

test('Galaxy reports omitted typed facets instead of flattening them to general claims; portfolio titles keep their scope',()=>{
 const doc=publicationFixture();
 const snapshot=publicationSnapshot(doc,{productVersion:'1.25.0',generatedAt:new Date('2026-10-15T16:00:00Z'),reviewedAt:new Date('2026-10-15T16:00:00Z'),humanConfirmed:true,intendedVisibility:'internal'});
 assert.deepEqual(snapshot.realization_claims,[]);
 assert.equal((snapshot.extensions!['diagramcloud.omissions'] as {state_facet_claims:number}).state_facet_claims,2);
 const withSharing=clone(doc);withSharing.observations.find(o=>o.id==='public-frozen')!.shareable=true;
 const index=portfolioIndex(validateDocument(withSharing));assert(index.items[0].title.includes('Lifecycle: FROZEN (scope: release-1)'));
 assert.equal(index.counts.observed_components,0);assert.equal(index.counts.designed_only_components,2);assert.equal(index.counts.shareable_realization_cards,1);
 for(const marker of privateMarkers)assert(!JSON.stringify(snapshot).includes(marker));
});

test('public redaction and HTML/SVG metadata preserve permitted facets without leaking private or unreviewed axes',()=>{
 const doc=publicationFixture(),before=JSON.stringify(doc),safe=publicDocument(doc);
 assert.deepEqual(safe.observations.map(o=>o.id),['public-frozen','public-deployed']);assert.equal(row(safe,'runtime').observations.length,0);
 assert.equal(row(doc,'selection').observations.length,1,'the author projection can inspect its private source claim');
 const html=portfolioHtml(doc),svg=svgDiagram(doc,'root',true),pngSource=svgDiagram(doc,'root',false);
 for(const text of [JSON.stringify(safe),html,svg,pngSource])for(const marker of privateMarkers)assert(!text.includes(marker),'public output leaked '+marker);
 const roundTrip=documentFromSvg(svg);assert.deepEqual(roundTrip.observations,safe.observations);
 for(const value of ['FROZEN','DEPLOYED','release-1','production']){assert(html.includes(value));assert(svg.includes(value));}
 assert.equal(JSON.stringify(doc),before,'export and redaction do not perform author review or mutate private state');
});

test('PowerPoint notes carry scoped facet lines and source provenance through the existing observationLine path',async()=>{
 const doc=publicationFixture(),safe=publicDocument(doc),pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';
 await addArchitectureSlides(pptx,safe,{cover:false,evidence:false,sources:false,realization:true,firstViewSlide:1});
 const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),notes=Object.keys(zip.files).filter(n=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
 assert(notes.length>0);const xml=(await Promise.all(notes.map(n=>zip.file(n)!.async('string')))).join('\n');
 for(const phrase of ['Lifecycle: FROZEN (scope: release-1)','Distribution: DEPLOYED (scope: production)','synthetic-owner','source-fixture-1','2026-10-15'])assert(xml.includes(phrase),'notes omitted '+phrase);
 for(const marker of privateMarkers)assert(!xml.includes(marker),'notes leaked '+marker);
 for(const observation of safe.observations)assert(observationLine(observation,'Synthetic application').includes(observation.stateFacet!.value));
});
