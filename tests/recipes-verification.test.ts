import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
import {analysisProfile,validateAnalysisProfile,validateAnalysisBundle,AnalysisCache,analysisCacheKey} from '../src/intelligence/profile';
import {recipeRegistry,validateRecipeRegistry,contextualRecipes,classifyPatterns,learningPath,architectureAudit,impactFacts} from '../src/intelligence/recipes';
import {referenceCookbook,cookbookManifest} from '../src/intelligence/cookbook';
import {proposeVerificationSpec,validateVerificationSpec,stageVerificationReceipt,verificationGaps,testCoverageGaps,workVerificationBrief,stageCockpitSnapshot,operationalSourceLinks,trustBoundaryHooks} from '../src/intelligence/verification';
import {stageEntityProposal} from '../src/intelligence/entityProposal';
import {queryProject,renderPublicArtifact,proposePublication,proposePublicProject,proposePublicVerification} from '../src/intelligence/context';
import {DEFAULT_OPTIONS} from '../src/intelligence/types';
import {samples} from '../src/data/samples';
import {buildDocumentAnalysisBundle} from '../src/intelligence/documentBundle';
import {defects} from './helpers/designGeometry';
import {designSvg} from '../src/export/design';
const commit='a'.repeat(40);
const project=()=>documentSchema.parse({schemaVersion:1,id:'fixture',title:'Synthetic verification fixture',rootViewId:'root',nodes:[{id:'api',label:'API',kind:'app',basis:'static-source',sourceIds:['source'],tags:['dotnet','policy']},{id:'data',label:'Data',kind:'storage',basis:'planned'}],edges:[{id:'link',source:'api',target:'data',basis:'static-source'}],views:[{id:'root',title:'Root',perspective:'system',nodeIds:['api','data'],edgeIds:['link'],positions:{api:{x:0,y:0},data:{x:300,y:0}}}],sources:[{id:'source',title:'Runbook source',location:'README.md:1',url:'https://example.invalid/runbook'}]});
const spec=()=>proposeVerificationSpec(project(),{id:'fixture-checks',repositories:[{id:'repo',repository:'owner/synthetic',commit}],checks:[{id:'test',nodeId:'api',edgeId:'link',repositoryId:'repo',question:'Does supplied check pass?',expected:'Exact source commit and evidence',kind:'test'}]});
const receipt=()=>({schema_version:1,receipt_id:'synthetic-external-fixture',subject:{schema_version:1,entity_id:'fixture:release',owner_app:'external-ci',entity_type:'release',local_id:'fixture'},app_id:'external-ci',product_version:'1.0',document_schema_version:1,galaxy_level:'G0',revision:{vcs:'git',repository:'owner/synthetic',commit,dirty:false},verification_level:'DECLARED',status:'passed',checks:[{check_id:'test',status:'passed',evidence_ref_ids:['check-evidence']}],evidence_refs:[{schema_version:1,evidence_id:'check-evidence',kind:'test_run',source_system:'ci',locator:{run_id:'synthetic-fixture'},captured_at:'2026-10-09T00:00:00Z',observed_revision:commit,visibility:'private',synthetic:false,review_state:'unreviewed'}],created_at:'2026-10-09T00:00:00Z',caveats:['Synthetic test fixture; never release qualification evidence.']});
test('document bundle rebuilds same selected inputs with source-line links and bounded omissions',async()=>{
 const inputs=[{path:'README.md',text:'# Synthetic handbook\nSee [sources](sources.csv).\n'},{path:'sources.csv',text:'id,title\nsource-a,Synthetic source\n'},{path:'notes.csv',text:'id,source_ids\nrecord-a,source-a\n'}],profile=analysisProfile('quick',{analyzers:['documents']}),rev={repositoryId:'repo',revision:commit};
 const bundle=await buildDocumentAnalysisBundle(inputs,rev,profile),again=await buildDocumentAnalysisBundle([...inputs].reverse(),rev,profile);assert.deepEqual(again,bundle);assert.equal(await analysisCacheKey(bundle),await analysisCacheKey(again));assert.ok(bundle.items.some(i=>i.kind==='section'));assert.ok(bundle.links.some(l=>l.kind==='document-link'));assert.ok(bundle.links.some(l=>l.kind==='source-record'));assert.ok(bundle.sources.every(s=>s.line>0&&s.revision===commit));const limited=await buildDocumentAnalysisBundle(inputs,rev,analysisProfile('custom',{analyzers:['documents'],budgets:{nodes:1,links:1}}));assert.equal(limited.items.length,1);assert.ok(limited.omitted.items>0);assert.equal(project().nodes.length,2);
});
test('generated lexical analysis may exceed authoring limits without becoming a persistent Project',async()=>{
 const files=Array.from({length:3},(_,f)=>({path:'chapter-'+f+'.md',text:Array.from({length:200},(_,i)=>'# Synthetic section '+i+'\nExplanation.').join('\n')}));const bundle=await buildDocumentAnalysisBundle(files,{repositoryId:'repo',revision:commit},analysisProfile('deep',{analyzers:['documents']}));assert.equal(bundle.items.length,603);assert.equal(bundle.omitted.items,0);assert.equal(project().nodes.length,2);assert.ok(!('positions' in bundle.items[0]));assert.ok(!('observations' in bundle));
});
test('profiles include actual bounded deep/custom and purpose presets; normalized selectors deterministic',()=>{
 const a=analysisProfile('deep',{purpose:'education',analyzers:['documents','inventory'],archetypes:['data','application']}),b=analysisProfile('deep',{purpose:'education',analyzers:['inventory','documents'],archetypes:['application','data']});assert.deepEqual(a,b);assert.equal(a.budgets.nodes,10000);assert.equal(analysisProfile('custom',{budgets:{nodes:21}}).budgets.nodes,21);
 assert.throws(()=>validateAnalysisProfile({...a,analyzers:['inventory','inventory']}),/Duplicate/);assert.throws(()=>validateAnalysisProfile({...a,autonomy:'execute'}));assert.equal(analysisProfile('quick',{purpose:'work-review'}).autonomy,'review-required');
});
test('generated bundles keep source revisions and stable IDs; cache refuses nondeterministic result',async()=>{
 const raw={format:'diagramcloud.analysis-bundle',version:1,parserVersion:'fixture/1',profile:analysisProfile('quick'),revisions:[{repositoryId:'repo',revision:commit,contentDigest:'b'.repeat(64)}],sources:[{id:'source',path:'README.md',repositoryId:'repo',revision:commit,line:1,contentDigest:'c'.repeat(64)}],items:[{id:'node',label:'Source node',kind:'document',sourceIds:['source'],confidence:'confirmed'}],links:[],diagnostics:[],omitted:{items:0,links:0,sources:0}};
 const b=validateAnalysisBundle(raw),cache=new AnalysisCache(1),key=await cache.put(b);assert.equal(key,await analysisCacheKey(b));assert.deepEqual(cache.get(key),b);cache.get(key)!.items[0].label='Mutation';assert.equal(cache.get(key)!.items[0].label,'Source node');
 await assert.rejects(()=>cache.put({...b,items:[{...b.items[0],label:'Other result'}]}),/different result/);assert.throws(()=>validateAnalysisBundle({...b,sources:[{...b.sources[0],revision:'different'}]}),/revision/);assert.throws(()=>validateAnalysisBundle({...b,links:[{id:'bad',from:'node',to:'missing',kind:'dependency',sourceIds:['source'],confidence:'inferred'}]}),/endpoint/);
});
test('registry requirements and contextual views explain missing data; pattern names never deploy facts',()=>{
 assert.equal(recipeRegistry.length,7);assert.throws(()=>validateRecipeRegistry([...recipeRegistry,recipeRegistry[0]]),/Duplicate/);
 const doc=project();assert.equal(contextualRecipes(doc,DEFAULT_OPTIONS).find(r=>r.id==='data')!.state,'unavailable');assert.ok(contextualRecipes(doc,DEFAULT_OPTIONS).some(r=>r.state==='recommended'));
 doc.nodes[0].label='Bronze Silver Gold';assert.equal(classifyPatterns(doc).find(p=>p.id==='medallion')!.state,'not-established');assert.equal(learningPath(doc)[0].viewId,'root');assert.ok(architectureAudit(doc).missingSources.some(g=>g.nodeId==='data'));
});
test('legacy views use canonical default system perspective when recommending recipes',()=>{
 const legacy=samples.find(p=>p.id==='data-projects')??samples[0];assert.ok(legacy.views.some(v=>v.perspective===undefined));const system=contextualRecipes(legacy,DEFAULT_OPTIONS).find(r=>r.id==='system')!;assert.ok(system.viewIds.includes(legacy.rootViewId));assert.equal(system.availability,'available');assert.equal(system.state,'recommended');
});
test('cookbook regenerated fixtures validate, retain synthetic provenance and expected geometry',()=>{
 const fixtures=referenceCookbook();assert.equal(fixtures.length,cookbookManifest.fixtures.length);assert.deepEqual(referenceCookbook(),fixtures);
 for(const p of fixtures){validateDocument(p);assert.ok(p.blocks.every(b=>b.provenance==='synthetic'));assert.equal(p.observations.length,0);assert.deepEqual(p.views.map(v=>v.id),cookbookManifest.fixtures.find(f=>f.projectId===p.id)!.expectedViews);for(const v of p.views)for(const theme of ['light','dark'] as const){const result=defects(designSvg(p,v.id,{theme,now:new Date('2026-10-09T00:00:00Z')}),p.id+'/'+v.id);assert.deepEqual(result.failures,[]);}}
});
test('impact gives bounded affected views and citation context, explicitly distinct from relationship proof',()=>{
 const result=impactFacts(project(),'api',{direction:'downstream',includeInferred:false,limit:1});assert.equal(result.nodes.length,1);assert.equal(result.limited,true);assert.equal(result.views[0].id,'root');const full=impactFacts(project(),'api',{direction:'downstream',includeInferred:false});assert.ok(full.relationships[0].note.includes('do not independently prove'));assert.equal(full.gaps.length,2);
});
test('verification spec is NOT_RUN and refuses wrong project, relationship or revision',()=>{
 const s=spec();assert.equal(s.state,'PROPOSED');assert.equal(s.checks[0].result,'NOT_RUN');assert.throws(()=>validateVerificationSpec({...s,projectRevision:1},project()),/revision/);assert.throws(()=>validateVerificationSpec({...s,checks:[{...s.checks[0],edgeId:'missing'}]},project()),/relationship/);
});
test('external exact revision receipt stages private unreviewed evidence and cannot silently repeat',()=>{
 const doc=project(),result=stageVerificationReceipt(doc,spec(),receipt(),{name:'Synthetic external runner fixture',runId:'fixture-1'});assert.equal(doc.observations.length,0);const staged=applyDocumentPatch(doc,result.patch).result;assert.equal(staged.observations[0].claim,'verified');assert.equal(staged.observations[0].reviewedAt,undefined);assert.equal(staged.observations[0].shareable,false);assert.equal(staged.observations[0].visibility,'private');assert.equal(publicDocument(staged).observations.length,0);assert.equal(publicDocument(staged).blocks.length,0);assert.throws(()=>stageVerificationReceipt(staged,{...spec(),projectRevision:staged.revision},receipt(),{name:'Fixture',runId:'fixture-1'}),/already staged/);
 assert.equal(verificationGaps(doc,spec())[0].state,'UNKNOWN');const approved=structuredClone(staged);approved.observations[0].reviewedAt='2026-10-09T01:00:00Z';assert.equal(verificationGaps(approved,{...spec(),projectRevision:approved.revision})[0].state,'reviewed-external-evidence');
});
test('receipts reject mismatched commit, synthetic support and unsupported passed assertions',()=>{
 const r=receipt();assert.throws(()=>stageVerificationReceipt(project(),spec(),{...r,revision:{...r.revision,commit:'b'.repeat(40)}},{name:'Fixture',runId:'x'}),/differs/);
 assert.throws(()=>stageVerificationReceipt(project(),spec(),{...r,checks:[{...r.checks[0],evidence_ref_ids:[]}]},{name:'Fixture',runId:'x'}),/no external evidence/);
 assert.throws(()=>stageVerificationReceipt(project(),spec(),{...r,evidence_refs:[{...r.evidence_refs[0],synthetic:true}]},{name:'Fixture',runId:'x'}),/synthetic/);
 assert.throws(()=>stageVerificationReceipt(project(),spec(),{...r,evidence_refs:[{...r.evidence_refs[0],observed_revision:'b'.repeat(40)}]},{name:'Fixture',runId:'x'}),/exact receipt commit/);
});
test('host-fed cockpit requires explicit scope and fresh permission, never creates verified claim',()=>{
 const s={format:'diagramcloud.cockpit-snapshot',version:1,id:'snapshot',sourceApp:'external-host',authority:'Synthetic host fixture',capturedAt:'2026-10-09T00:00:00Z',expiresAt:'2026-10-09T01:00:00Z',permission:{selectedProjectId:'fixture',dataAccessGranted:true,scope:'selected-project'},observations:[{id:'host-observation',nodeId:'api',sourceRevision:commit,summary:'Synthetic host test fixture',claim:'observed'}]};
 const staged=stageCockpitSnapshot(project(),s,new Date('2026-10-09T00:30:00Z'));assert.equal(applyDocumentPatch(project(),staged.patch).result.observations[0].reviewedAt,undefined);assert.throws(()=>stageCockpitSnapshot(project(),s,new Date('2026-10-09T02:00:00Z')),/expired/);assert.throws(()=>stageCockpitSnapshot(project(),{...s,permission:{...s.permission,dataAccessGranted:false}},new Date('2026-10-09T00:30:00Z')));assert.throws(()=>stageCockpitSnapshot(project(),{...s,observations:[{...s.observations[0],claim:'verified'}]},new Date('2026-10-09T00:30:00Z')));
 assert.equal(operationalSourceLinks(project())[0].health,'UNKNOWN');assert.ok(trustBoundaryHooks(project())[0].note.includes('not a security certification'));
});
test('agent entity proposals demand exact selected-source quotes and produce unknown candidate patches',()=>{
 const input={format:'diagramcloud.entity-proposal',version:1,projectId:'fixture',baseRevision:0,entities:[{id:'candidate-api',label:'Candidate',kind:'app',citations:[{sourceId:'source',line:1,endLine:1,quote:'Input API'}]}],relations:[]};
 const staged=stageEntityProposal(project(),input,{source:'Input API receives data.'}),doc=applyDocumentPatch(project(),staged.patch).result;assert.equal(doc.nodes.find(n=>n.id==='candidate-api')!.basis,'unknown');assert.equal(doc.observations.length,0);assert.throws(()=>stageEntityProposal(project(),input,{source:'Something else'}),/absent/);assert.throws(()=>stageEntityProposal(project(),input,{}),/not explicitly selected/);
});
test('extended context keeps proposals inert and renders public bounded artifacts',()=>{
 const p=project();p.nodes[1].visibility='private';for(const kind of ['sources','recipes','learning','gaps','analysis'])assert.ok(!JSON.stringify(queryProject(p,{kind})).includes('"label":"Data"'));
 assert.equal(proposePublication(p,{viewIds:['root'],title:'Story'}).state,'REQUIRES_AUTHOR_REVIEW');assert.throws(()=>proposePublication(p,{viewIds:['private-view'],title:'Story'}));assert.equal(proposePublicProject({format:'diagramcloud.project-brief',version:1,project:{id:'new',title:'New'}}).state,'REQUIRES_AUTHOR_REVIEW');assert.equal(proposePublicVerification(p,{id:spec().id,repositories:spec().repositories,checks:spec().checks.map(({result,edgeId,...c})=>c)}).spec.checks[0].result,'NOT_RUN');
 assert.ok((renderPublicArtifact(p,{kind:'book'}) as string).startsWith('<!doctype html>'));assert.equal((renderPublicArtifact(p,{kind:'quality',viewId:'root'}) as {qualification:string}).qualification,'GEOMETRY_CHECKED');const before=structuredClone(p);before.nodes[0].label='Earlier';assert.ok((renderPublicArtifact(p,{kind:'delta',viewId:'root',before}) as string).includes('CHANGED'));
});
test('publication proposal retains legacy selection and validated presentation choices without modifying facts',()=>{
 const p=project(),before=structuredClone(p),out=proposePublication(p,{viewIds:['root'],title:'Synthetic technical story',audience:'technical readers',detail:'full',paper:'A4',profile:'blueprint',storyIndices:[]});assert.equal(out.state,'REQUIRES_AUTHOR_REVIEW');assert.deepEqual(out.viewIds,['root']);assert.equal(out.brief.profile,'blueprint');assert.equal(out.brief.detail,'full');assert.equal(out.brief.audience,'technical readers');assert.deepEqual(p,before);assert.throws(()=>proposePublication(p,{viewIds:['root'],title:'Bad',profile:'execute'}));
});
test('architecture audit reports exact-revision staleness and scope differences without guessing runtime outcomes',()=>{
 const p=project();p.atlas={activeSnapshotId:'current',snapshots:[{id:'current',capturedAt:'2026-10-09T00:00:00Z',repositories:[{id:'repo',title:'Synthetic repository',host:'local',locator:'synthetic',revision:'b'.repeat(40),scannedAt:'2026-10-09T00:00:00Z',scanStatus:'scanned',authority:'git',nodeId:'api'}],runtimeRefs:[],contextRefs:[]}]};const claim={id:'claim-a',nodeId:'api',sourceApp:'external-ci',authority:'Synthetic runner fixture',observedAt:'2026-10-09T00:00:00Z',sourceRevision:commit,claim:'verified' as const,summary:'Synthetic test fixture',blockIds:[],caveat:'No release qualification',visibility:'private' as const,reviewedAt:'2026-10-09T01:00:00Z',shareable:false};p.observations=[claim,{...claim,id:'claim-b',claim:'partial'}];const out=architectureAudit(validateDocument(p));assert.equal(out.stale.length,2);assert.equal(out.conflicts.length,1);assert.ok(out.conflicts[0].reason.includes('individual check scope'));p.observations[1].observedAt='2026-10-10T00:00:00Z';assert.equal(architectureAudit(p).conflicts.length,0);
});
test('coverage gaps distinguish missing component/connection mappings and impact lists only explicit check IDs',()=>{
 const p=project(),s=spec(),before=structuredClone(p),coverage=testCoverageGaps(p,s);assert.deepEqual(coverage.components.map(g=>g.nodeId),['data']);assert.deepEqual(coverage.connections,[]);assert.equal(coverage.checks[0].state,'UNKNOWN');const out=workVerificationBrief(p,s,{summary:'Synthetic proposed change',nodeIds:['api']});assert.deepEqual(out.affectedCheckIds,['test']);assert.equal(out.state,'NOT_RUN');assert.deepEqual(p,before);const {edgeId,...check}=s.checks[0];assert.deepEqual(testCoverageGaps(p,{...s,checks:[check]}).connections.map(g=>g.edgeId),['link']);
});

