import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planWorkspaceDraftSaves} from '../src/core/storage';
import {validateDocument} from '../src/core/model';
const doc=(id='startup',revision=4,title='Original')=>validateDocument({schemaVersion:1,id,revision,title,rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Overview',nodeIds:[],edgeIds:[],positions:{}}],blocks:[],sources:[],assets:[],observations:[],story:[]});
test('equal revisions with different content are a startup conflict',()=>{
 const stored=doc(),draft=doc('startup',4,'New draft');assert.deepEqual(planWorkspaceDraftSaves([stored],[draft]),{pending:[],conflicts:['startup']});
});
test('different revisions do not implicitly authorize replacing a stored copy',()=>{
 for(const rev of [3,5])assert.deepEqual(planWorkspaceDraftSaves([doc()],[doc('startup',rev)]),{pending:[],conflicts:['startup']});
});
test('unchanged stored copy needs no rewrite',()=>{
 const stored=doc(),draft=JSON.parse(JSON.stringify(stored));assert.deepEqual(planWorkspaceDraftSaves([stored],[draft]),{pending:[],conflicts:[]});
});
test('object property order is not a conflict',()=>{
 const stored=doc(),draft=validateDocument(Object.fromEntries(Object.entries(stored).reverse()));assert.deepEqual(planWorkspaceDraftSaves([stored],[draft]),{pending:[],conflicts:[]});
});
test('new documents can save independently of conflicting and identical drafts',()=>{
 const stored=doc(),draft=doc('startup',4,'Different'),fresh=doc('fresh');const before=JSON.stringify([stored,draft,fresh]);
 const result=planWorkspaceDraftSaves([stored,doc('identical')],[draft,fresh,doc('identical')]);
 assert.deepEqual(result,{pending:[fresh],conflicts:['startup']});assert.equal(JSON.stringify([stored,draft,fresh]),before);
});
test('same revision evidence differences are not silently discarded',()=>{
 const stored=doc(),draft=doc();draft.privateNotes='Unsaved private draft';assert.deepEqual(planWorkspaceDraftSaves([stored],[draft]),{pending:[],conflicts:['startup']});
});
