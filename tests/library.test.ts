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


import {preparePublicationRestore,restorePublication,PUBLICATION_RESTORE_REFUSED} from '../src/intelligence/library';
import {imageManualProject} from './helpers/manualImages';
function restoreTestProject(){return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-public-restore',title:'Synthetic structured publication',rootViewId:'root',nodes:[{id:'a',label:'Synthetic public component',blockIds:['code'],sourceIds:['source']}],edges:[],views:[{id:'root',title:'Synthetic public view',nodeIds:['a'],edgeIds:[]}],blocks:[{id:'code',title:'Literal code',type:'code',language:'text',code:'<script>window.syntheticExecuted=true</script>',provenance:'synthetic'}],sources:[{id:'source',title:'Synthetic reference',location:'Supplied synthetic source',url:'https://example.invalid/reference',visibility:'public'}]}));}
async function restoreTestSnapshot(doc=restoreTestProject()){return createPublication(doc,{title:'Synthetic restore',audience:'Synthetic reviewer',viewIds:[doc.rootViewId],profile:'classic'},'2026-10-15T12:00:00Z');}
test('native restore admission keeps structured frozen identity and literal code without changing authoring inputs',async()=>{
 const doc=restoreTestProject();doc.privateNotes='SYNTHETIC_PRIVATE_RESTORE';const before=JSON.stringify(doc),snapshot=await restoreTestSnapshot(doc),raw=JSON.stringify(snapshot),prepared=await preparePublicationRestore(snapshot);
 assert.deepEqual(prepared,snapshot);assert.equal(JSON.stringify(snapshot),raw);assert.equal(JSON.stringify(doc),before);assert.ok(!raw.includes('SYNTHETIC_PRIVATE_RESTORE'));assert.equal(prepared.document.observations.length,0);
 const html=technicalManualHtml(prepared.document,{viewIds:prepared.viewIds,brief:prepared.brief,now:new Date(prepared.createdAt)});assert.ok(html.includes('&lt;script&gt;window.syntheticExecuted=true&lt;/script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes("default-src 'none'"));
});
test('restore refuses valid opaque assets, experience and reviewed observations without stripping them or touching native validator',async()=>{
 const media=await restoreTestSnapshot(imageManualProject());await validatePublication(media);assert.ok(media.document.assets.length);await assert.rejects(()=>preparePublicationRestore(media),error=>error instanceof Error&&error.message===PUBLICATION_RESTORE_REFUSED);
 const doc=restoreTestProject();doc.experience={format:'diagramcloud.experience',schemaVersion:1,id:'synthetic-pack',title:'Synthetic pack',revision:0,rootId:'entity',sources:[],entities:[{id:'entity',label:'Synthetic entity',type:'project',summary:'',children:[],workspaceIds:[],sourceIds:[],visibility:'public',assertion:'illustrative'}],relations:[],items:[],workspaces:[]};
 const workspace=await restoreTestSnapshot(validateDocument(doc));await validatePublication(workspace);assert.ok(workspace.document.experience);await assert.rejects(()=>preparePublicationRestore(workspace),{message:PUBLICATION_RESTORE_REFUSED});
 const withClaim=restoreTestProject();withClaim.observations=[{id:'synthetic-claim',nodeId:'a',sourceApp:'synthetic-test',authority:'Synthetic negative-test producer',observedAt:'2026-10-15T10:00:00Z',sourceRevision:'synthetic-revision',claim:'partial',summary:'Synthetic boundary fixture, not a runtime result.',caveat:'Never admitted by publication file restoration.',blockIds:[],visibility:'public',reviewedAt:'2026-10-15T11:00:00Z',shareable:false}];
 const claim=await restoreTestSnapshot(validateDocument(withClaim)),raw=JSON.stringify(claim);await validatePublication(claim);assert.equal(claim.document.observations.length,1);await assert.rejects(()=>preparePublicationRestore(claim),{message:PUBLICATION_RESTORE_REFUSED});assert.equal(JSON.stringify(claim),raw);
});
test('restore rejects whole-document known sensitive text and active/foreign fields with only generic diagnostics',async()=>{
 const doc=restoreTestProject();doc.nodes[0].summary='token: SYNTHETIC_BOUNDARY_VALUE';const sensitive=await restoreTestSnapshot(doc);await validatePublication(sensitive);
 const snapshot=await restoreTestSnapshot();for(const input of [sensitive,{...snapshot,frozenHTML:'<script>SYNTHETIC_PRIVATE_HTML</script>'},{...snapshot,document:{...snapshot.document,privateNotes:'SYNTHETIC_PRIVATE_NOTES'}},{...snapshot,document:{...snapshot.document,title:'Tampered'}},{format:'galaxy.publication-snapshot/1',snapshot_id:'other',contract_versions:[]}]){
  await assert.rejects(()=>preparePublicationRestore(input),error=>error instanceof Error&&error.message===PUBLICATION_RESTORE_REFUSED&&!/SYNTHETIC_PRIVATE|BOUNDARY_VALUE/.test(error.message));
 }
});
test('legacy input remains unbound and revoked restore stops before opening any IndexedDB transaction',async()=>{
 const value=await restoreTestSnapshot(),legacy=structuredClone(value);delete legacy.outputDigest;delete legacy.brief;legacy.outputBinding='bound';const prepared=await preparePublicationRestore(legacy);assert.equal(prepared.outputBinding,'legacy-unbound');assert.equal(prepared.outputDigest,undefined);assert.equal(prepared.id,value.id);assert.equal(prepared.digest,value.digest);
 await assert.rejects(()=>restorePublication(prepared,()=>false),{message:PUBLICATION_RESTORE_REFUSED});
});


test('restore admission refuses credential-bearing source links even when canonical snapshot validation succeeds',async()=>{
 const doc=restoreTestProject();doc.sources[0].url='https://synthetic-user:synthetic-password@example.invalid/reference';const snapshot=await restoreTestSnapshot(doc);await validatePublication(snapshot);await assert.rejects(()=>preparePublicationRestore(snapshot),{message:PUBLICATION_RESTORE_REFUSED});
});
