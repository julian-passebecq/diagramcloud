import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zooSources} from './fixtures/projects/zoo/selectedSources';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
import {analyzeDomainFiles} from '../src/intelligence/domainAdapters';
import {projectReadiness} from '../src/intelligence/readiness';
import {scanRepository,type ScanFile} from '../src/core/scan';
import {documentSchema,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {documentFromAtlas,validateManifest} from '../src/core/atlas';
import {crossRepositoryCandidates,retainedRepositoryAnalyses} from '../src/intelligence/crossRepository';
import {deepAnalyze} from '../src/intelligence/deepAnalysis';
import {analysisProfile} from '../src/intelligence/profile';
import {nodeDeepRuntime} from '../scripts/lib/deepRuntime';
import {gitHistory} from './helpers/gitHistory';
import {readRepositorySelection} from '../scripts/lib/readRepo';
import {migrationPlanPatch,readEvolutionHistory,evolutionSnapshot,compareEvolutionSnapshots} from '../src/intelligence/evolution';
import {applyDocumentPatch} from '../src/core/patch';
import {previewDeliveryBrief,deliveryCoverageMatrix} from '../src/intelligence/delivery';
import {planAssets} from '../src/intelligence/assets';
import {compileGraphSnapshot,previewGraphReimport,graphTombstonePatch} from '../src/intelligence/graphSnapshot';

const sourceFiles=(id:string):ScanFile[]=>Object.entries(zooSources[id]).map(([path,text])=>({path,text}));
const revision='a'.repeat(40),otherRevision='b'.repeat(40);
async function acquire(id:string){
 const reads=new Set<string>(),input=sourceFiles(id).map(({path,text})=>({name:path.split('/').at(-1),webkitRelativePath:'synthetic-'+id+'/'+path,size:Buffer.byteLength(text),arrayBuffer:async()=>{reads.add(path);if(text.startsWith('SYNTHETIC_NEVER_READ'))throw Error('Metadata exclusion attempted to read '+path);return Uint8Array.from(Buffer.from(text)).buffer;}} as File));
 const result=await analyzePickedFolder(input,{depth:'standard'});return {...result,reads};
}
function blank(){return documentSchema.parse({schemaVersion:1,id:'synthetic-zoo-authoring',title:'Synthetic reviewed qualification inputs',rootViewId:'root',nodes:[{id:'api',label:'API',sourceIds:['source']},{id:'data',label:'Data',sourceIds:['source']}],edges:[],views:[{id:'root',title:'Synthetic system',nodeIds:['api','data'],edgeIds:[],positions:{api:{x:0,y:0},data:{x:300,y:0}}}],sources:[{id:'source',title:'Synthetic qualification source',location:'fixture.ts:1 @ '+revision,visibility:'private'}]});}
const originalIds=readFileSync('docs/product/QUALIFICATION_ZOO_PREPRO_20261008.csv','utf8').trim().split(/\r?\n/).slice(1).map(line=>line.split(',')[0]);
test('original zoo identity set is preserved; Z025 remains an external read-only qualification',()=>{
 assert.deepEqual(originalIds,Array.from({length:25},(_,i)=>'Z'+String(i+1).padStart(3,'0')));
 assert.deepEqual([...Object.keys(zooSources),'Z019','Z020','Z021','Z022'].sort(),originalIds.filter(id=>id!=='Z025'));
 assert.equal(zooSources.Z025,undefined,'Private real sources are never copied into committed synthetic fixtures');
});
for(const id of Object.keys(zooSources))test(id+' selected synthetic source root: provenance, gaps and forbidden runtime claims',async()=>{
 const result=await acquire(id),doc=validateDocument(result.document);
 assert.deepEqual(projectReadiness(doc).views.filter(v=>v.required).map(v=>v.id),['overview','structure','relations','evidence-gaps']);
 assert.equal(doc.observations.length,0);assert.equal(doc.atlas,undefined,'No inferred project membership');
 for(const f of result.domain.facts){const source=zooSources[id][f.path];assert.notEqual(source,undefined);assert(f.line>=1&&f.line<=source.split('\n').length,f.path+':'+f.line);}
 for(const e of result.domain.links){assert(result.domain.facts.some(f=>f.key===e.from));assert(result.domain.facts.some(f=>f.key===e.to));assert(e.line>=1&&e.line<=zooSources[id][e.path].split('\n').length);}
 assert(!JSON.stringify(doc).includes('SYNTHETIC_NEVER_READ'));assert(!JSON.stringify(publicDocument(doc)).includes('Synthetic PulseBus'));
 if(id==='Z002'){assert.equal(result.domain.facts.length,0);assert(doc.nodes.length>0);assert(projectReadiness(doc).gaps.length>0);assert([...result.model.items.values()].every(i=>i.evidence.every(e=>e.kind==='selection-metadata')));}
 if(id==='Z003'){assert(result.model.links.some(l=>l.label==='depends on'));assert([...result.model.items.values()].some(i=>i.layer==='ci'));assert([...result.model.items.values()].some(i=>i.tech==='postgresql'));}
 if(id==='Z005'){assert.equal(result.domain.facts.length,0);assert.deepEqual(result.analysis.documentMap.documents.map(d=>d.kind).sort(),['csv','json','markdown','markdown','yaml']);assert(result.analysis.documentMap.links.some(l=>l.fromPath==='adr/decision.md'&&l.fromLine===2&&l.toPath==='data.csv'));assert(result.analysis.documentMap.links.some(l=>l.fromPath==='spec.json'&&l.fromLine===2&&l.toPath==='notes.yaml'));assert(!doc.delivery);}
 if(id==='Z006'){assert(result.domain.facts.some(f=>f.key==='dbt:test.synthetic.not_null'));assert(result.domain.facts.some(f=>f.key==='dbt:exposure.synthetic.dashboard'));assert.equal(result.domain.links.filter(l=>l.label==='dbt manifest parent_map').length,4);assert.equal(result.model.detectors.get('selected dbt manifest preferred over SQL heuristics'),2);}
 if(id==='Z007'){assert(result.domain.facts.some(f=>f.label==='dev'));assert(result.domain.facts.some(f=>f.label==='prod'));assert(result.domain.links.some(l=>l.label==='declared depends_on'&&l.path==='resources/jobs.yaml'&&l.line===13));assert(result.domain.links.some(l=>l.label==='explicit bundle resource reference'));assert(result.domain.links.some(l=>l.label==='declared notebook/library path'));assert(!doc.delivery);}
 if(id==='Z008'){assert(result.domain.links.some(l=>l.label==='PBIR declared datasetReference'));assert.equal(result.domain.links.filter(l=>/^TMDL (from|to)Column$/.test(l.label)).length,2);assert(!result.domain.facts.some(f=>/workspace|deployed/i.test(f.label)));}
 if(id==='Z009'){for(const label of ['ProjectReference','Bicep explicit dependsOn','azd explicit selected service project'])assert(result.domain.links.some(l=>l.label===label),label);assert(result.domain.facts.some(f=>f.label==='GET /orders'));}
 if(id==='Z010'){for(const label of ['declared sends','declared receives','declared SQS dead-letter redrive'])assert(result.domain.links.some(l=>l.label===label));assert.equal(result.domain.links.find(l=>l.label==='declared SQS dead-letter redrive')?.line,16);assert(result.domain.facts.some(f=>f.label==='synthetic-events-dlq'));assert(!JSON.stringify(doc).includes('message traffic'));}
 if(id==='Z013'){assert([...result.model.items.values()].some(i=>i.provider==='AWS'));assert([...result.model.items.values()].some(i=>i.provider==='Google Cloud'));assert(result.domain.capabilities.includes('azure'));assert(result.domain.capabilities.includes('kubernetes'));assert(!doc.atlas);}
 if(id==='Z014'){assert(result.analysis.documentMap.diagnostics.some(d=>d.message.includes('Source discrepancy candidate:')&&d.message.includes('README.md:2')&&d.message.includes('package.json:1')));assert(projectReadiness(doc).gaps.some(g=>g.state==='conflicting'));assert(!JSON.stringify(publicDocument(doc)).includes('Source discrepancy candidate:'));}
 if(id==='Z015'){const drivers=[...result.model.items.values()].filter(i=>i.tech==='postgresql'||i.tech==='sqlserver');assert.equal(drivers.length,2);assert(drivers.every(i=>i.confidence!=='confirmed'));assert(drivers.every(i=>i.evidence.some(e=>e.kind!=='selection-metadata'&&e.file==='package.json')));}
 if(id==='Z016'){for(const path of Object.keys(zooSources[id]).filter(p=>p!=='package.json')){assert(!result.reads.has(path));assert(!result.analysis.inventory.entries.some(e=>e.path===path));}}
 if(id==='Z017'){assert.equal(result.domain.facts.filter(f=>f.label==='api').length,2);assert.equal(new Set(result.domain.facts.filter(f=>f.label==='api').map(f=>f.key)).size,2);assert.equal(result.domain.links.length,0);}
 if(id==='Z018'){for(const path of ['vendor/external.py','generated/client.ts','dist/bundle.js'])assert(!result.reads.has(path));assert(result.analysis.inventory.ignored>=2);assert(result.analysis.inventory.unsupported>=1);assert(result.reads.has('src/authored.py'));}
 if(id==='Z023'){assert([...result.model.items.values()].some(i=>i.layer==='ci'));assert(!doc.delivery?.instances.length);assert(projectReadiness(doc,{purpose:'audit'}).gaps.some(g=>g.state==='unsupported'));}
 if(id==='Z024'){assert(result.domain.capabilities.includes('azure'));const provider=doc.nodes.find(n=>n.label.includes('httpTrigger'))??doc.nodes.find(n=>n.tags.includes('azure'));assert(provider);provider.provider='Azure';provider.icon='missing-azure-function';const plan=planAssets(doc,[{id:'generic',origin:'original'}]);const fallback=plan.requirements.find(r=>r.nodeId===provider.id);assert.equal(fallback?.resolvedIcon,'generic');assert.equal(fallback?.blocksRendering,false);assert.equal(fallback?.recommendation,'official-asset-review');assert.equal(doc.assets.length,0);}
});
test('Z001 actual syntax distinguishes tiny CLI modules and test without inventing microservices',async()=>{
 const bundle=await deepAnalyze(sourceFiles('Z001'),analysisProfile('deep'),await nodeDeepRuntime(),{repositoryId:'pocket-cli',revision});
 assert(bundle.items.some(i=>i.label==='main'));assert(bundle.items.some(i=>i.label==='run'));assert(bundle.items.some(i=>i.label==='test_run'));assert.equal(bundle.links.filter(l=>l.kind==='exact-selected-module-path').length,2);assert(bundle.sources.some(s=>s.path==='test_cli.py'));assert(!bundle.items.some(i=>/prod|service|deployed/i.test(i.label)));
});
test('Z004 exact multi-repository package declaration joins only explicit members at individual revisions',()=>{
 const ids=['producer','consumer','data','infra','bi'];const scans=Object.fromEntries(ids.map((id,index)=>{const files=sourceFiles('Z004').filter(f=>f.path.startsWith(id+'/')).map(f=>({...f,path:f.path.slice(id.length+1)}));return [id,{model:scanRepository([{path:'.git/HEAD',text:index?otherRevision:revision},...files]),domain:analyzeDomainFiles(files)}];}));
 const atlas=documentFromAtlas(validateManifest({format:'diagramcloud.project-manifest',version:1,project:{id:'synthetic-acme',title:'Synthetic Acme Commerce'},repositories:ids.map(id=>({id,title:id,host:'local',locator:id,role:'service'})),relationships:[]}),scans).document;
 assert.equal(atlas.atlas?.snapshots.at(-1)?.repositories.length,5);assert.equal(new Set(atlas.atlas!.snapshots.at(-1)!.repositories.map(r=>r.revision)).size,2);const reports=retainedRepositoryAnalyses(atlas),candidates=crossRepositoryCandidates(atlas,reports);assert.equal(candidates.candidates.length,1);assert(candidates.candidates[0].evidence.every(e=>e.path==='package.json'&&e.line===1));assert.equal(atlas.observations.length,0);const altered=structuredClone(reports);altered.find(r=>r.repositoryId==='producer')!.contracts=[];assert.equal(crossRepositoryCandidates(atlas,altered).candidates.length,0,'Matching names cannot replace producer declaration');
});
test('Z011 actual ML source distinguishes train and serve; training syntax never verifies production serving',async()=>{
 const bundle=await deepAnalyze(sourceFiles('Z011'),analysisProfile('deep'),await nodeDeepRuntime(),{repositoryId:'model-lab',revision});
 const train=bundle.items.find(i=>i.label==='train'),serve=bundle.items.find(i=>i.label==='serve');assert(train&&serve&&train.id!==serve.id);assert.equal(bundle.sources.find(s=>s.id===train.sourceIds[0])?.path,'train.py');assert.equal(bundle.sources.find(s=>s.id===serve.sourceIds[0])?.path,'serve.py');assert(bundle.items.some(i=>i.label==='test_train'));assert(!bundle.items.some(i=>/registry|production|verified/i.test(i.kind)));
});
test('Z012 reviewed migration phases keep current, transition and target intent separate from deployment',()=>{
 const doc=blank(),after=applyDocumentPatch(doc,migrationPlanPatch(doc,{format:'diagramcloud.migration-plan/1',id:'migration',projectId:doc.id,label:'Synthetic Oracle to Fabric',phases:[{id:'old',label:'Oracle source',stage:'current',basis:'unknown',nodeIds:['data'],sourceIds:['source'],note:'Current source declaration; no runtime observation'},{id:'transitional',label:'Azure Databricks coexistence',stage:'transition',basis:'planned',nodeIds:['api','data'],sourceIds:['source'],note:'Planned coexistence'},{id:'target',label:'Fabric target',stage:'target',basis:'planned',nodeIds:['data'],sourceIds:['source'],note:'Planned target'}],coexistence:'Planned side-by-side qualification',cutover:'UNKNOWN',rollback:'Retain original source'})).result;
 const plan=readEvolutionHistory(after).plans[0];assert.deepEqual(plan.phases.map(p=>p.stage),['current','transition','target']);assert.equal(plan.phases[2].basis,'planned');assert.equal(after.observations.length,0);assert(!after.delivery);assert.deepEqual(after.nodes.map(({blockIds,...n})=>n),doc.nodes.map(({blockIds,...n})=>n));assert(!JSON.stringify(publicDocument(after)).includes('Synthetic Oracle to Fabric'));
});
test('Z019 isolated Git branch, rename and nested worktree retain revision and boundary identities',()=>{
 const history=gitHistory();try{const first=history.commit({'src/original.py':'def original():\n    return 1\n'},'Synthetic source');history.git('mv','src/original.py','src/renamed.py');const renamed=history.commit({},'Synthetic rename');history.worktree('synthetic-feature');history.git('worktree','move',history.base+'/worktree-synthetic-feature',history.repository+'/nested-worktree');const selected=readRepositorySelection(history.repository),model=scanRepository(selected.files,{boundaryPaths:selected.boundaryPaths,boundaryMarkers:selected.boundaryMarkers});assert.equal(model.commit,renamed);assert.notEqual(first,renamed);assert.equal(model.branch,'main');assert(selected.files.some(f=>f.path==='src/renamed.py'));assert(!selected.files.some(f=>f.path==='src/original.py'||f.path.startsWith('nested-worktree/')));assert(model.boundaries?.some(b=>b.path==='nested-worktree'&&b.kind==='worktree'));}finally{history.cleanup();}
});
test('Z020 custom Dev/Test/Stage/Prod names and flags remain declarations at separate source revisions',()=>{
 const seed=blank(),names=['dev','test','stage','prod'];const doc=previewDeliveryBrief(seed,{format:'diagramcloud.delivery-brief',version:1,projectId:seed.id,baseRevision:seed.revision,delivery:{artifacts:[],promotions:[],environments:names.map(id=>({id,label:'Custom '+id,sourceIds:['source']})),instances:names.map((id,index)=>({id:'api-'+id,nodeId:'instance-'+id,componentId:'api',environmentId:id,declaredRevision:index?'b'.repeat(40):revision,sourceIds:['source']})),configurations:names.map(id=>({id:'flag-'+id,componentId:'api',environmentId:id,kind:'flag',name:'Synthetic feature',valueState:id==='prod'?'declared-disabled':'unknown',sourceIds:['source']}))}}).document;
 assert.deepEqual(doc.delivery?.environments.map(e=>e.label),names.map(id=>'Custom '+id));assert.equal(new Set(doc.delivery?.instances.map(i=>i.declaredRevision)).size,2);assert.equal(doc.delivery?.configurations?.find(c=>c.environmentId==='prod')?.valueState,'declared-disabled');assert.equal(doc.observations.length,0);assert(deliveryCoverageMatrix(doc).filter(e=>e.componentId==='api').every(e=>e.state==='declared'));
});
test('Z021 comparable same-repository snapshots expose additions and absence without fake moves or removals',async()=>{
 const a=(await acquire('Z001')).document;const changed={...zooSources.Z001,'extra/package.json':'{"name":"synthetic-added-package","private":true}'};const selected=Object.entries(changed).map(([path,text])=>Object.assign(new File([text],path),{webkitRelativePath:'synthetic-Z001/'+path}));const b=(await analyzePickedFolder(selected,{depth:'standard'})).document;
 const before=evolutionSnapshot(a,{id:'t0',capturedAt:'2026-10-09T00:00:00Z'}),after=evolutionSnapshot(b,{id:'t1',capturedAt:'2026-10-09T01:00:00Z'}),delta=compareEvolutionSnapshots(before,after);assert.equal(delta.state,'comparable');assert(delta.changes.some(c=>c.change==='added'));assert(!delta.changes.some(c=>(c.change as string)==='removed'||c.change==='moved'));
 const absent=structuredClone(after);absent.nodes=absent.nodes.filter(n=>n.id!==before.nodes[0].id);const absence=compareEvolutionSnapshots(before,absent);assert(absence.changes.some(c=>c.change==='not-in-scope'));assert(!absence.changes.some(c=>(c.change as string)==='removed'));const drift=structuredClone(after);drift.scope.analyzerVersion='different-parser';assert.equal(compareEvolutionSnapshots(before,drift).state,'incomparable');assert.equal(compareEvolutionSnapshots(before,drift).changes.length,0);
});
test('Z022 incomplete t1 permission or scope loss yields uncertainty, never a removal',async()=>{
 const doc=(await acquire('Z001')).document,a=evolutionSnapshot(doc,{id:'t0'}),b=structuredClone(a);b.id='t1';b.scope.complete=false;b.nodes=b.nodes.slice(0,1);b.edges=[];const delta=compareEvolutionSnapshots(a,b);assert.equal(delta.state,'partial');assert(delta.reasons.some(r=>r.includes('Completeness')));assert(delta.changes.some(c=>c.change==='not-in-scope'));assert(!delta.changes.some(c=>(c.change as string)==='removed'));
});
test('Z013 reviewed region context cites literal selected provider declarations while delivery remains unknown',()=>{
 const seed=blank();seed.sources=[{id:'aws-region',title:'Synthetic AWS declaration',location:'main.tf:1 @ '+revision,visibility:'private'},{id:'gcp-region',title:'Synthetic Google declaration',location:'main.tf:3 @ '+revision,visibility:'private'}];seed.nodes.forEach(n=>n.sourceIds=[]);
 assert(zooSources.Z013['main.tf'].split('\n')[0].includes('region = "eu-west-1"'));assert(zooSources.Z013['main.tf'].split('\n')[2].includes('region = "europe-west1"'));
 const reviewed=previewDeliveryBrief(seed,{format:'diagramcloud.delivery-brief',version:1,projectId:seed.id,baseRevision:seed.revision,delivery:{environments:[{id:'aws',label:'Synthetic AWS boundary',bindings:[{kind:'region',label:'eu-west-1',sourceIds:['aws-region']}]},{id:'gcp',label:'Synthetic Google boundary',bindings:[{kind:'region',label:'europe-west1',sourceIds:['gcp-region']}]}],artifacts:[],instances:[],promotions:[]}}).document;
 assert.deepEqual(reviewed.delivery?.environments.map(e=>e.bindings?.[0].sourceIds),[['aws-region'],['gcp-region']]);assert(deliveryCoverageMatrix(reviewed,{componentIds:['api']}).every(e=>e.state==='UNKNOWN'));assert.equal(reviewed.observations.length,0);assert(!JSON.stringify(publicDocument(reviewed)).includes('eu-west-1'));
});
test('Z022 actual selected source read denial is retained as partial evidence rather than deletion',async()=>{
 const before=(await acquire('Z001')).document,input=sourceFiles('Z001').map(({path,text})=>Object.assign(new File([text],path),{webkitRelativePath:'synthetic-Z001/'+path}));
 const denied=input.find(f=>f.name==='core.py')!;denied.arrayBuffer=async()=>{throw new DOMException('Synthetic read denial','NotReadableError');};
 const result=await analyzePickedFolder(input,{depth:'standard'}),delta=compareEvolutionSnapshots(evolutionSnapshot(before),evolutionSnapshot(result.document));
 assert.equal(result.analysis.sourceIdentity.scopeComplete,false);assert(result.analysis.inventory.entries.some(e=>e.path==='core.py'&&e.state==='failed'));assert.equal(delta.state,'partial');assert(!delta.changes.some(c=>c.change==='removed'));assert.equal(result.document.observations.length,0);
});
test('Z021 source-qualified reviewed graph predecessor tombstones prove assertion removal and retain author evidence',()=>{
 const selected=JSON.parse(readFileSync('tests/fixtures/night4/graph-fixture.json','utf8'));selected.complete_scope=true;
 selected.source_vector[0].revision=revision;selected.source_refs[0].revision=revision;
 const before=compileGraphSnapshot(selected).document,a=evolutionSnapshot(before,{id:'zoo-graph-t0',capturedAt:'2026-10-09T00:00:00Z'}),incoming=structuredClone(selected);
 incoming.generation_id='zoo-next';incoming.predecessor_generation=selected.generation_id;incoming.captured_at='2026-10-09T01:00:00Z';incoming.source_vector[0].revision=otherRevision;incoming.source_refs[0].revision=otherRevision;
 const removed=incoming.assertions.shift();incoming.removed_assertion_ids=[removed.id];
 incoming.assertions.push({...incoming.assertions[0],id:'zoo-added-assertion',predicate:'references',from:'prompt',to:'project'});
 const proposed=previewGraphReimport(before,incoming,before.revision).document;
 assert(!compareEvolutionSnapshots(a,evolutionSnapshot(proposed)).changes.some(c=>c.change==='removed'),'Reimport does not review removals');
 const patch=graphTombstonePatch(proposed);assert(patch);const reviewed=applyDocumentPatch(proposed,patch).result,delta=compareEvolutionSnapshots(a,evolutionSnapshot(reviewed,{id:'zoo-graph-t1',capturedAt:incoming.captured_at}));
 assert.equal(delta.state,'comparable');assert.equal(delta.changes.filter(c=>c.change==='removed').length,1);assert.equal(delta.changes.find(c=>c.change==='removed')?.entity,'connection');assert(delta.changes.some(c=>c.change==='added'));assert(delta.changes.find(c=>c.change==='removed')?.sourceRefs.length);assert.equal(reviewed.nodes.length,proposed.nodes.length);assert.equal(reviewed.blocks.length,proposed.blocks.length);assert.equal(reviewed.observations.length,0);
 const noProof=structuredClone(incoming);noProof.predecessor_generation='other';assert.equal(graphTombstonePatch(previewGraphReimport(before,noProof,before.revision).document),undefined);
});
test('Z025 optional independent real-stage gate reads receipt metadata only, never selected private source', {skip:!process.env.DIAGRAMCLOUD_REAL_QUALIFICATION_RECEIPT},()=>{
 const receipt=JSON.parse(readFileSync(process.env.DIAGRAMCLOUD_REAL_QUALIFICATION_RECEIPT!,'utf8'));
 assert.equal(receipt.format,'diagramcloud.real-source-qualification/1');assert.equal(receipt.contentsIncluded,false);assert.equal(receipt.ownerVerified,false);assert(/^[a-f0-9]{40}$/.test(receipt.candidateSourceSha));assert(receipt.sources.length>=3);
 for(const source of receipt.sources){assert(/^[a-f0-9]{40}$/.test(source.sourceRevision));assert(/^sha256:[a-f0-9]{64}$/.test(source.selectedContentDigest));assert(source.readFiles>0);assert.deepEqual(source.checks.map((c:{id:string})=>c.id),['no-runtime-fabrication','source-backed-findings','minimum-outputs','secret-safe-model','public-redaction']);assert(source.checks.every((c:{status:string})=>c.status==='PASS'));assert.equal(source.contents,undefined);}
});
test('event declaration negative oracle refuses aliases, external channel refs and mismatching DLQ identity',()=>{
 const base=zooSources.Z010['asyncapi.yaml'];const mismatch=analyzeDomainFiles([{path:'asyncapi.json',text:JSON.stringify({asyncapi:'3.0.0',channels:{x:{bindings:{sqs:{queue:{name:'q',redrivePolicy:{deadLetterQueue:{name:'missing'}}},deadLetterQueue:{name:'dlq'}}}}},operations:{send:{action:'send',channel:{$ref:'https://example.invalid/channel'}}}})}]);assert.equal(mismatch.links.length,0);assert(mismatch.diagnostics.some(d=>d.includes('unresolved')));assert(!JSON.stringify(mismatch.facts).includes('example.invalid'));
 const aliased=analyzeDomainFiles([{path:'asyncapi.yaml',text:base+'\nextra: &unsafe {a: 1}\ncopy: *unsafe\n'}]);assert.equal(aliased.facts.length,0);assert(aliased.diagnostics.some(d=>d.includes('aliased')));
 const v2=analyzeDomainFiles([{path:'asyncapi.yaml',text:'asyncapi: 2.6.0\nchannels:\n topic:\n  subscribe:\n   operationId: applicationSends\n  publish:\n   operationId: applicationReceives\n'}]);assert(v2.links.some(l=>l.from.endsWith(':subscribe')&&l.label==='declared sends'));assert(v2.links.some(l=>l.to.endsWith(':publish')&&l.label==='declared receives'));
});
test('native domain selections gate invocation and prevent disabled parser diagnostics',()=>{
 const selected=[{path:'asyncapi.yaml',text:'asyncapi: invalid\n'},{path:'Api.csproj',text:'<Project><ProjectReference Include="missing.csproj" /></Project>'},{path:'databricks.yml',text:'bundle:\n name: synthetic\n'}];assert.deepEqual(analyzeDomainFiles(selected,{domains:[]}).facts,[]);assert.deepEqual(analyzeDomainFiles(selected,{domains:['databricks']}).capabilities,['databricks']);assert.equal(analyzeDomainFiles(selected,{domains:['databricks']}).diagnostics.length,0);assert(analyzeDomainFiles(selected,{domains:['events']}).diagnostics.some(d=>d.includes('AsyncAPI')));
});
