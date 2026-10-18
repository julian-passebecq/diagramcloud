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


import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {WORKSPACE_VIEW_UNAVAILABLE,workspaceViewPage,resolveWorkspaceView,WORKSPACE_VIEW_PAGE_SIZE} from '../src/intelligence/library';
function workspaceViewFixture(id='workspace-alpha'){
 return validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic workspace '+id,rootViewId:'root',privateNotes:'SYNTHETIC_PRIVATE_WORKSPACE',nodes:[{id:'portal',label:'Synthetic portal',childViewId:'detail'},{id:'leaf',label:'Synthetic leaf'},{id:'private-portal',label:'SYNTHETIC_PRIVATE_PORTAL',childViewId:'secret',visibility:'private'},{id:'private-leaf',label:'SYNTHETIC_PRIVATE_LEAF',visibility:'private'},{id:'orphan-leaf',label:'Synthetic unplaced scope'}],edges:[],views:[{id:'root',title:'Synthetic overview',description:'Stated root purpose',nodeIds:['portal','private-portal'],edgeIds:[]},{id:'detail',title:'Synthetic detail',description:'Stated detail purpose',nodeIds:['leaf'],edgeIds:[]},{id:'secret',title:'SYNTHETIC_PRIVATE_VIEW',visibility:'private',nodeIds:['private-leaf'],edgeIds:[]},{id:'orphan',title:'Synthetic orphan view',nodeIds:['orphan-leaf'],edgeIds:[]}]}));
}
test('workspace view retrieval uses compound identity and actual retained parents without rewriting canonical content',()=>{
 const a=workspaceViewFixture(),b=workspaceViewFixture('workspace-beta'),before=JSON.stringify([a,b]),target={projectId:b.id,viewId:'detail',revision:b.revision};
 const result=resolveWorkspaceView([a,b],target);assert.equal(result.state,'available');if(result.state!=='available')assert.fail();assert.equal(result.project,b);assert.deepEqual(result.path,['root','detail']);assert.equal(result.row.projectTitle,b.title);assert.equal(result.row.target.projectId,b.id);
 result.path[0]='changed';result.row.target.viewId='changed';result.row.title='changed';assert.deepEqual(resolveWorkspaceView([a,b],target).state,'available');assert.equal(JSON.stringify([a,b]),before);
 const sameId=structuredClone(b);assert.equal(resolveWorkspaceView([b,sameId],target).state,'unavailable');
});
test('workspace view page accounts for every reachable view and returned mutations never alter the next page or Project',()=>{
 const projects=[workspaceViewFixture(),workspaceViewFixture('workspace-beta'),workspaceViewFixture('workspace-gamma')],before=JSON.stringify(projects),first=workspaceViewPage(projects),last=workspaceViewPage(projects,{page:999});
 assert.equal(first.total,9);assert.equal(first.displayed,WORKSPACE_VIEW_PAGE_SIZE);assert.equal(first.omitted,1);assert.equal(first.pages,2);assert.equal(last.page,1);assert.equal(last.displayed,1);assert.equal(last.omitted,8);assert.equal(new Set([...first.rows,...last.rows].map(r=>r.target.projectId+':'+r.target.viewId)).size,9);assert.ok(![...first.rows,...last.rows].some(r=>r.target.viewId==='orphan'));
 first.rows[0].target.projectId='changed';last.rows.pop();assert.equal(workspaceViewPage(projects).rows[0].target.projectId,projects[0].id);assert.equal(JSON.stringify(projects),before);assert.equal(workspaceViewPage([]).pages,0);assert.equal(workspaceViewPage(projects,{page:NaN}).page,0);
});
test('workspace exact target rejects missing, stale, malformed, extra-command and newly unreachable identities without retargeting',()=>{
 const p=workspaceViewFixture(),target={projectId:p.id,viewId:'detail',revision:p.revision},before=JSON.stringify(p);
 for(const candidate of [null,{...target,projectId:'missing'},{...target,viewId:'orphan'},{...target,viewId:'missing'},{...target,revision:target.revision+1},{...target,revision:-1},{...target,viewId:'../SYNTHETIC_PRIVATE_PATH'},{...target,command:'open-source'},{...target,revision:NaN}])assert.deepEqual(resolveWorkspaceView([p],candidate),{state:'unavailable'});
 const removed=structuredClone(p);delete removed.nodes.find(n=>n.id==='portal')!.childViewId;validateDocument(removed);assert.deepEqual(resolveWorkspaceView([removed],target),{state:'unavailable'});assert.equal(JSON.stringify(p),before);assert.ok(!WORKSPACE_VIEW_UNAVAILABLE.includes('SYNTHETIC_PRIVATE'));
});
test('public workspace browsing returns a constant before authoring rows or target getters, independent of private counts',()=>{
 const poison=new Proxy([] as Project[],{get(){throw new Error('Authoring collection must not be read');}}),target=new Proxy({},{get(){throw new Error('Private target must not be read');},ownKeys(){throw new Error('Private target must not be enumerated');}});
 const baseline=workspaceViewPage([],{publicMode:true});assert.deepEqual(workspaceViewPage(poison,{publicMode:true,page:999}),baseline);assert.deepEqual(workspaceViewPage([workspaceViewFixture(),workspaceViewFixture('workspace-beta')],{publicMode:true}),baseline);assert.deepEqual(resolveWorkspaceView(poison,target,{publicMode:true}),{state:'unavailable'});assert.ok(!JSON.stringify(baseline).includes('SYNTHETIC_PRIVATE'));
});
test('explicit workspace view URLs reject malformed/ambiguous fields while retaining project-only and valid native links',()=>{
 for(const query of ['?project=valid&view=../secret','?project=valid&view=','?project=valid&view=root&node=%3Cscript%3E','?project=valid&view=root&view=other','?project=valid&project=other&view=root','?project=valid&view=root&publication=frozen'])assert.equal(readDeepLink(query),null);
 assert.deepEqual(readDeepLink('?project=valid&node=%3Cscript%3E'),{project:'valid'});
 assert.deepEqual(readDeepLink('?project=valid'),{project:'valid'});assert.deepEqual(readDeepLink('?project=valid&view=detail'),{project:'valid',view:'detail'});const url=deepLink('https://example.invalid/studio/?token=SYNTHETIC_PRIVATE_TOKEN#old',{project:'workspace-alpha',view:'detail'});assert.deepEqual(readDeepLink(new URL(url).search),{project:'workspace-alpha',view:'detail'});assert.ok(!url.includes('SYNTHETIC_PRIVATE'));assert.ok(!url.includes('revision'));
});
