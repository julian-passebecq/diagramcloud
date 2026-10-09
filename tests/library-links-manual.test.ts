import test from 'node:test';
import assert from 'node:assert/strict';
import {deepLink,readDeepLink,libraryTargetForLink} from '../src/core/links';
import {createPublication,resolveLibraryTarget,validateCollection} from '../src/intelligence/library';
import {publicationFidelity,validatePublicationBrief} from '../src/intelligence/publicationBrief';
import {technicalManualHtml} from '../src/export/manual';
import {customIconData} from './helpers/customIcon';
import {imageManualProject} from './helpers/manualImages';
test('invalid public evidence raster retains caption and rights with an explicit unavailable pixel receipt',()=>{
 const doc=imageManualProject();doc.assets[0].data='data:image/png;base64,AAAA';const before=JSON.stringify(doc),brief=validatePublicationBrief({format:'diagramcloud.publication-brief/1',title:'Synthetic image gap',audience:'Reviewer',viewIds:['root']},doc),html=technicalManualHtml(doc,{brief});assert.ok(html.includes('Image unavailable: raster container or dimensions are invalid'));assert.ok(html.includes('Synthetic caption &lt;img'));assert.ok(html.includes('Recorded rights: Original synthetic'));assert.ok(!html.includes('<img src='));assert.ok(!html.includes('PRIVATE_IMAGE_'));assert.deepEqual(publicationFidelity(doc,brief).views[0].evidence.unavailableImages,[{blockId:'image',reason:'Raster container or dimensions unavailable; caption and recorded rights retained without embedded pixels.'}]);assert.equal(JSON.stringify(doc),before);
});
test('stable library links accept one exact ID, preserve existing project links and contain no output payload',()=>{
 for(const kind of ['collection','publication'] as const){const id=kind+'-saved-identity',url=deepLink('https://diagramcloud.example/app/?old=secret#anchor',{[kind]:id}),parsed=readDeepLink(new URL(url).search)!;
  assert.deepEqual(parsed,{[kind]:id});assert.deepEqual(libraryTargetForLink(parsed),{kind,id});assert.equal(new URL(url).hash,'');assert.ok(!url.includes('secret'));assert.ok(!url.includes('document'));}
 assert.equal(readDeepLink('?collection=a&publication=b'),null);assert.equal(readDeepLink('?publication=<script>&project=valid'),null);assert.equal(readDeepLink('?collection='+('a'.repeat(121))),null);
 assert.throws(()=>deepLink('https://example.invalid',{collection:'a',publication:'b'}),/one/);assert.throws(()=>deepLink('https://example.invalid',{publication:'../bad'}),/Invalid/);
 const original={project:'project',view:'root',node:'api'};assert.deepEqual(readDeepLink(new URL(deepLink('https://example.invalid',original)).search),original);
});
test('library resolution selects exact saved identities and reports missing targets without authoring injection',async()=>{
 const doc=imageManualProject(),before=JSON.stringify(doc),publication=await createPublication(doc,{title:'Frozen image output',audience:'Reviewer',viewIds:['root']},'2026-10-09T00:00:00Z'),collection=validateCollection({format:'diagramcloud.collection/1',id:'collection-test',title:'Synthetic collection',revision:0,projectIds:['unavailable-project'],publicationIds:[publication.id],visibility:'private'}),library={collections:[collection],publications:[publication]};
 const found=resolveLibraryTarget({kind:'publication',id:publication.id},library);assert.equal(found.state,'available');assert.equal(found.kind,'publication');if(found.state==='available'&&found.kind==='publication')assert.equal(found.publication.outputDigest,publication.outputDigest);
 assert.equal(resolveLibraryTarget({kind:'collection',id:collection.id},library).state,'available');assert.equal(resolveLibraryTarget({kind:'publication',id:'missing'},library).state,'unavailable');assert.equal(resolveLibraryTarget({kind:'collection',id:'missing'},library).state,'unavailable');assert.throws(()=>resolveLibraryTarget({kind:'collection',id:'../bad'},library),/Invalid/);assert.equal(JSON.stringify(doc),before);
});
test('full handbook embeds only public image evidence with escaped caption and rights at its aspect ratio; fidelity agrees',()=>{
 const doc=imageManualProject(),before=JSON.stringify(doc),brief=validatePublicationBrief({format:'diagramcloud.publication-brief/1',title:'Synthetic image output',audience:'Reviewer',viewIds:['root']},doc),html=technicalManualHtml(doc,{brief,now:new Date('2026-10-09T00:00:00Z')}),ledger=publicationFidelity(doc,brief);
 assert.ok(html.includes('<img src="'+customIconData()+'"'));assert.ok(html.includes('Synthetic caption &lt;img onerror=&quot;bad&quot;&gt;'));assert.ok(html.includes('Recorded rights: Original synthetic &lt;rights&gt;; MIT fixture.'));assert.ok(html.includes('object-fit:contain'));assert.ok(!html.includes('PRIVATE_IMAGE_'));assert.ok(!html.includes('not in the manual'));assert.deepEqual(ledger.views[0].evidence.shown,['image']);assert.equal(ledger.views[0].evidence.omitted,0);assert.equal(JSON.stringify(doc),before);
 const overview={...brief,detail:'overview' as const};assert.ok(!technicalManualHtml(doc,{brief:overview}).includes(customIconData()));assert.equal(publicationFidelity(doc,overview).views[0].evidence.omitted,1);
});
