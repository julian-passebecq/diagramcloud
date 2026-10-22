import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authoringJson} from '../src/core/authoringJson';
import {documentSchema,parseDocument,MAX_DOCUMENT_BYTES} from '../src/core/model';
import {stageImportText} from '../src/app/stageImport';
import {authoringBoundaryProject} from './fixtures/authoring-boundary';

test('ordinary authoring copies stay readable and retain private and unattached content',()=>{
 const doc=documentSchema.parse({schemaVersion:1,id:'ordinary-backup',title:'Synthetic private backup',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:[{id:'unattached',type:'text',title:'Private note',text:'Synthetic private canary',visibility:'private'}],privateNotes:'Keep this private note too',sources:[]});
 const raw=authoringJson(doc);assert.equal(raw,JSON.stringify(doc,null,2));assert.deepEqual(parseDocument(raw),doc);
});

test('a saved near-limit authoring project backs up and reimports without losing content',async()=>{
 const doc=authoringBoundaryProject(),pretty=JSON.stringify(doc,null,2),raw=authoringJson(doc);
 assert.ok(new TextEncoder().encode(pretty).byteLength>MAX_DOCUMENT_BYTES);
 assert.ok(new TextEncoder().encode(raw).byteLength<=MAX_DOCUMENT_BYTES);
 assert.deepEqual(parseDocument(raw),doc);
 const staged=await stageImportText({project:doc,library:[doc],raw,importName:'synthetic.authoring.json',completionRequest:null,applied:[]});
 assert.deepEqual(staged.staged,doc);assert.equal(staged.patched,null);
});

test('the fallback checks UTF-8 bytes rather than JavaScript character count',()=>{
 const doc=authoringBoundaryProject(),pretty=JSON.stringify(doc,null,2);
 assert.ok(pretty.length<MAX_DOCUMENT_BYTES);assert.ok(new TextEncoder().encode(pretty).byteLength>MAX_DOCUMENT_BYTES);
 assert.equal(authoringJson(doc),JSON.stringify(doc));
});

test('an oversized emergency draft is backed up completely without claiming importability',async()=>{
 const doc=authoringBoundaryProject();doc.summary='界'.repeat(1000);
 const raw=authoringJson(doc);assert.ok(new TextEncoder().encode(raw).byteLength>MAX_DOCUMENT_BYTES);
 assert.deepEqual(JSON.parse(raw),doc);assert.equal(JSON.parse(raw).blocks.length,84);
 assert.throws(()=>parseDocument(raw),/12 MiB/);
 await assert.rejects(stageImportText({project:doc,library:[doc],raw,importName:'synthetic.authoring.json',completionRequest:null,applied:[]}),/12 MiB/);
});
