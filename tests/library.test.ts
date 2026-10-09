import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clone,documentSchema,validateDocument} from '../src/core/model';
import {samples} from '../src/data/samples';
import {collectionFacts,createPublication,publicCollection,validateCollection,validatePublication,validateLibraryRows} from '../src/intelligence/library';
import {technicalManualHtml} from '../src/export/manual';
test('independent collection preserves missing members and separate project/repository revisions',()=>{
 const p=clone(samples[0]),q=clone(samples[1]);q.revision=19;
 const c=validateCollection({format:'diagramcloud.collection/1',id:'collection-test',title:'Synthetic collection',revision:0,projectIds:[p.id,q.id,'unavailable'],publicationIds:[],visibility:'private'});
 const facts=collectionFacts(c,[p,q]);assert.equal(facts.members[1].documentRevision,19);assert.equal(facts.members[2].state,'missing');assert.equal(facts.members[2].documentRevision,null);assert.match(facts.revisionPolicy,/no collection SHA/);
 assert.throws(()=>validateCollection({...c,projectIds:[p.id,p.id]}),/Duplicate/);
 const privateProject=clone(p);privateProject.nodes.forEach(n=>n.visibility='private');const exported=publicCollection({...c,visibility:'public'},[privateProject,q]);assert.ok(!JSON.stringify(exported).includes(p.title));assert.ok(!JSON.stringify(exported).includes('unavailable'));
});
test('immutable publication hashes public contents, refuses hidden or modified payload and exports selected views offline',async()=>{
 const p=clone(samples[0]);p.privateNotes='PRIVATE_LIBRARY_SENTINEL';
 const snapshot=await createPublication(validateDocument(p),{title:'Synthetic handbook',audience:'Reviewer',viewIds:[p.rootViewId]},'2026-10-09T00:00:00Z');
 assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_LIBRARY_SENTINEL'));const saved=JSON.stringify(snapshot);
 p.title='Later editable caption';p.revision++;assert.equal(JSON.stringify(snapshot),saved);
 await validatePublication(snapshot);
 await assert.rejects(()=>validatePublication({...snapshot,document:{...snapshot.document,privateNotes:'PRIVATE_LEAK'}}),/non-public/);
 await assert.rejects(()=>validatePublication({...snapshot,document:{...snapshot.document,title:'Tampered'}}),/digest mismatch/);
 const html=technicalManualHtml(snapshot.document,{viewIds:snapshot.viewIds});assert.ok(!html.includes('PRIVATE_LIBRARY_SENTINEL'));assert.ok(html.includes('selected publication brief'));assert.throws(()=>technicalManualHtml(snapshot.document,{viewIds:['unknown-view']}),/unavailable/);
});
test('output digest binds normalized presentation and snapshot identity independently of the document digest',async()=>{
 const p=clone(samples[0]),snapshot=await createPublication(p,{title:'Synthetic frozen brief',audience:'Reviewer',viewIds:[p.rootViewId]},'2026-10-09T00:00:00Z');
 assert.equal(snapshot.outputBinding,'bound');assert.match(snapshot.outputDigest!,/^sha256:/);assert.notEqual(snapshot.outputDigest,snapshot.digest);
 const changes:((s:typeof snapshot)=>void)[]=[s=>{s.id='publication-renamed';},s=>{s.createdAt='2026-10-10T00:00:00Z';},s=>{s.title='Changed title';s.brief!.title=s.title;},s=>{s.audience='Changed audience';s.brief!.audience=s.audience;},s=>{s.brief!.profile='business';},s=>{s.brief!.detail='overview';},s=>{s.brief!.paper='letter';}];
 for(const change of changes){const tampered=structuredClone(snapshot);change(tampered);assert.equal(tampered.digest,snapshot.digest);await assert.rejects(()=>validatePublication(tampered),/output digest mismatch/);}
 const duplicate=structuredClone(snapshot);duplicate.viewIds.push(duplicate.viewIds[0]);await assert.rejects(()=>validatePublication(duplicate),/Duplicate/);
 const normalized=JSON.parse(JSON.stringify(snapshot));delete normalized.brief.detail;delete normalized.brief.paper;delete normalized.brief.profile;delete normalized.brief.storyIndices;
 assert.equal((await validatePublication(normalized)).outputDigest,snapshot.outputDigest,'Default presentation settings normalize before output hashing');
 const canonical=await validatePublication(snapshot);assert.deepEqual(await validatePublication(canonical),canonical);
});
test('legacy publication compatibility validates header privacy and declares unbound output rather than attesting it',async()=>{
 const snapshot=await createPublication(samples[0],{title:'Synthetic legacy brief',audience:'Reviewer',viewIds:[samples[0].rootViewId]},'2026-10-09T00:00:00Z');
 const legacy=structuredClone(snapshot);delete legacy.outputDigest;delete legacy.brief;legacy.outputBinding='bound';
 const loaded=await validatePublication(legacy);assert.equal(loaded.outputBinding,'legacy-unbound');assert.equal(loaded.outputDigest,undefined);assert.equal(loaded.digest,snapshot.digest);
 const secret='Synthetic access identity AKIA'+'A'.repeat(16);
 for(const field of ['title','audience'] as const)await assert.rejects(()=>validatePublication({...legacy,[field]:secret}),/sensitive text/);
 const invalid=structuredClone(legacy);invalid.sourceVector=[{repositoryId:'synthetic-source',revision:secret}];await assert.rejects(()=>validatePublication(invalid),/sensitive text/);
});
test('frozen output receipt binds selected view order and authored story without modifying canonical facts',async()=>{
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-curated-order',title:'Synthetic curated order',rootViewId:'root',nodes:[{id:'parent',label:'Parent',childViewId:'child'},{id:'inside',label:'Inside'}],edges:[],views:[{id:'root',title:'Root',nodeIds:['parent'],edgeIds:[]},{id:'child',title:'Child',nodeIds:['inside'],edgeIds:[]}],story:[{title:'Root narration',narration:'Supplied root narrative',viewId:'root'},{title:'Detail narration',narration:'Supplied child narrative',viewId:'child'}]})),before=JSON.stringify(doc);
 const snapshot=await createPublication(doc,{title:'Synthetic release',audience:'Reviewer',viewIds:['root','child'],storyIndices:[0]},'2026-10-09T00:00:00Z');
 const order=structuredClone(snapshot);order.viewIds.reverse();order.brief!.viewIds.reverse();await assert.rejects(()=>validatePublication(order),/output digest mismatch/);
 const story=structuredClone(snapshot);story.brief!.storyIndices=[1];await assert.rejects(()=>validatePublication(story),/output digest mismatch/);
 assert.equal(JSON.stringify(doc),before);assert.deepEqual((await validatePublication(snapshot)).brief?.storyIndices,[0]);
});
test('library load validates rows independently, excludes unsafe and tampered outputs, preserves raw rows and warns about legacy binding',async()=>{
 const bound=await createPublication(samples[0],{title:'Safe snapshot',audience:'Reviewer',viewIds:[samples[0].rootViewId]},'2026-10-09T00:00:00Z');
 const legacy=structuredClone(bound);legacy.id='legacy-output';delete legacy.outputDigest;delete legacy.brief;
 const unsafe=structuredClone(legacy);unsafe.id='unsafe-output';unsafe.title='Synthetic token: forbidden-value';
 const tampered=structuredClone(bound);tampered.brief!.paper='letter';
 const validCollection={format:'diagramcloud.collection/1',id:'safe-collection',title:'Synthetic collection',revision:0,projectIds:[samples[0].id],publicationIds:[],visibility:'private'};
 const rows=[bound,legacy,unsafe,tampered],collections=[validCollection,{...validCollection,title:'Synthetic token: forbidden-value'}],before=JSON.stringify({rows,collections});
 const result=await validateLibraryRows(collections,rows);assert.equal(result.collections.length,1);assert.deepEqual(result.publications.map(p=>p.id),[bound.id,'legacy-output']);assert.equal(result.warnings.filter(w=>w.includes('invalid publication')).length,2);assert.ok(result.warnings.some(w=>w.includes('legacy-unbound')));assert.equal(JSON.stringify({rows,collections}),before);
 assert.equal(JSON.stringify(result).includes('forbidden-value'),false);assert.equal(result.publications[1].outputDigest,undefined);
});
