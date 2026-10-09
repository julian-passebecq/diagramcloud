import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {compileHybridBrief} from '../src/intelligence/bridge';
import {projectNavigation,selectionContext} from '../src/intelligence/navigation';
import {evolutionSnapshot,retainEvolutionSnapshotPatch} from '../src/intelligence/evolution';
import {applyDocumentPatch} from '../src/core/patch';

const fixture=()=>{
 const p=compileHybridBrief({format:'diagramcloud.project-brief',version:1,project:{id:'navigation-fixture',title:'Synthetic navigation fixture'},scope:[{id:'work',title:'Declared workstream',kind:'workstream',repositoryIds:['app']},{id:'task',title:'Selected task',kind:'task',parentId:'work'}],repositories:[{id:'app',title:'Implementation',host:'local',locator:'app',revision:'a'.repeat(40)},{id:'other',title:'Implementation copy',host:'local',locator:'other',revision:'b'.repeat(40)}]}, {},{now:new Date('2026-10-09T00:00:00Z')}).document;
 const added=documentSchema.parse({schemaVersion:1,id:'physical-fixture',title:'Physical',rootViewId:'physical',edges:[],nodes:[{id:'app.module',label:'Source module',kind:'app',basis:'static-source',childViewId:'app.files',sourceIds:['project-brief-source']},{id:'app.file',label:'module.ts',kind:'function',basis:'static-source',sourceIds:['project-brief-source']}],views:[{id:'physical',title:'Unused'},{id:'app.structure',title:'Physical structure',perspective:'code',nodeIds:['app.module']},{id:'app.files',title:'Selected source files',description:'Inspect exact physical files',perspective:'code',nodeIds:['app.file']}],sources:[p.sources.find(s=>s.id==='project-brief-source')]});
 p.nodes.push(...added.nodes);p.views.push(...added.views.filter(v=>v.id!=='physical'));p.nodes.find(n=>n.id==='repo-app')!.childViewId='app.structure';return validateDocument(p);
};
test('logical and physical hierarchies retain canonical IDs and only declared crosswalks',()=>{
 const p=fixture(),before=structuredClone(p),n=projectNavigation(p);assert.deepEqual(p,before);assert.equal(n.project[0].id,'brief-scope-work');assert.equal(n.project[0].children[0].id,'brief-scope-task');assert.ok(!n.project.some(n=>n.id==='repo-app'));assert.equal(n.repositories[0].children[0].id,'app.module');assert.equal(n.repositories[0].children[0].children[0].id,'app.file');assert.equal(n.crosswalk.length,1);assert.equal(n.crosswalk[0].physicalId,'repo-app');assert.equal(n.crosswalk[0].origin,'Explicit experience relation');assert.deepEqual(n.crosswalk[0].sourceIds,['project-brief-source']);assert.equal(n.repositories[1].revision,'b'.repeat(40));
});
test('search keeps physical ancestors; view search includes purpose and canonical legacy perspective',()=>{
 const p=fixture(),n=projectNavigation(p,{query:'module.ts'});assert.equal(n.repositories.length,1);assert.equal(n.repositories[0].children[0].id,'app.module');assert.equal(n.repositories[0].children[0].children[0].id,'app.file');assert.equal(projectNavigation(p,{query:'exact physical'}).groupedViews.code[0].id,'app.files');delete p.views[0].perspective;assert.ok(projectNavigation(p).groupedViews.system.some(v=>v.id===p.rootViewId));
});
test('environment and retained evolution filters intersect stable IDs without mutating selection or history',()=>{
 let p=fixture();const old=evolutionSnapshot(p,{id:'old',label:'Prior selected source',capturedAt:'2026-10-09T00:00:00Z'});old.nodes=old.nodes.filter(n=>n.id!=='app.file');p=applyDocumentPatch(p,retainEvolutionSnapshotPatch(p,old)).result;p.delivery={environments:[{id:'env',label:'Declared environment',description:'',sourceIds:[],visibility:'private'}],instances:[{id:'instance',nodeId:'app.file',componentId:'app.module',environmentId:'env',sourceIds:[],visibility:'private'}],artifacts:[],promotions:[]};validateDocument(p);const before=structuredClone(p),n=projectNavigation(p,{environmentId:'env',snapshotId:'old'});assert.equal(n.selectionVisible('app.file'),false);assert.equal(n.selectionVisible('app.module'),true);assert.equal(n.repositories[0].children[0].id,'app.module');assert.equal(n.repositories[0].children[0].children.length,0);assert.deepEqual(p,before);assert.ok(projectNavigation(p,{snapshotId:'unavailable'}).filterProblems.length);assert.equal(projectNavigation(p,{environmentId:'unknown'}).project.length,0);
});
test('public navigation never exposes private repository, snapshot or selected evidence context',()=>{
 const p=fixture(),n=projectNavigation(p,{publicMode:true}),serialized=JSON.stringify(n);assert.equal(n.repositories.length,0);assert.equal(n.crosswalk.length,0);assert.ok(!serialized.includes('a'.repeat(40)));assert.ok(!serialized.includes('Selected task'));assert.equal(n.snapshots.length,0);
});
test('selection context is source-qualified and bounded tree reports omitted descendants',()=>{
 const p=fixture(),context=selectionContext(p,{nodeId:'app.file',viewId:'app.files'});assert.equal(context.components.length,1);assert.equal(context.repository?.id,'app');assert.equal(context.sources.length,1);assert.equal(context.blocks.length,0);assert.equal(context.scope,'selected-component');const bounded=projectNavigation(p,{maxNodes:1,maxDepth:0});assert.ok(bounded.omitted>0);assert.equal(bounded.project[0].children.length,0);assert.equal(bounded.budget.nodesPerHierarchy,1);
});


