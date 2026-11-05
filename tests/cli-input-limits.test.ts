/**
 * CLI and local stdio MCP input limits (src/core/inputLimits.ts, scripts/lib/boundedInput.ts): every selected file is
 * size-checked before it is read whole; at its limit it is accepted, one byte over it is refused with a message naming
 * the limit, a non-zero exit (or the MCP's isError result) and no output written.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {documentSchema,validateDocument,MAX_DOCUMENT_BYTES} from '../src/core/model';
import {DOCUMENT_INPUT,EXPLANATION_REQUEST_FILE_LIMIT,InputLimitError,MAX_BRIEF_BYTES,MAX_MCP_REQUEST_BYTES,MAX_READING_OPTIONS_BYTES,checkImportFileSize,checkPayloadSize,formatBytes,importFileLimit} from '../src/core/inputLimits';
import * as appLimits from '../src/app/importFileLimit';
import {readBoundedText} from '../scripts/lib/boundedInput';
import {runConceptPreview} from '../scripts/concept-preview';
import {exportLinkedReading} from '../scripts/export-linked-reading';
import {prepareExplanationFiles} from '../scripts/prepare-explanation';
import {runConceptHost} from '../scripts/concept-host';

const REFUSED=/Nothing was read or written\./;
function workspace(t:{after:(fn:()=>void)=>void}){const root=mkdtempSync(join(tmpdir(),'dc-input-limits-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
const doc=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'limit-test',title:'Synthetic limit input',rootViewId:'root',edges:[],
 nodes:[{id:'app',label:'Synthetic app'}],views:[{id:'root',title:'Root',nodeIds:['app']}]}));
/** A valid JSON value padded with trailing whitespace to exactly `bytes` bytes. */
function padded(path:string,value:unknown,bytes:number){const text=JSON.stringify(value);assert.ok(Buffer.byteLength(text)<=bytes);writeFileSync(path,text+' '.repeat(bytes-Buffer.byteLength(text)));return path;}
const tsx=(script:string,args:string[],input?:string)=>spawnSync(process.execPath,['--import','tsx',script,...args],{encoding:'utf8',timeout:120000,input,maxBuffer:64*1024*1024});

test('one module holds the limits; the App dialog re-exports the same check and wording',()=>{
 assert.equal(DOCUMENT_INPUT.bytes,MAX_DOCUMENT_BYTES);assert.equal(MAX_DOCUMENT_BYTES,12*1024*1024);
 assert.equal(appLimits.importFileLimit,importFileLimit);assert.equal(appLimits.checkImportFileSize,checkImportFileSize);
 assert.throws(()=>checkImportFileSize({name:'big.json',size:MAX_DOCUMENT_BYTES+1}),/^Error: big\.json is 12 MiB: a JSON document is imported up to 12 MiB\. Nothing was read or imported\.$/);
 assert.equal(formatBytes(MAX_BRIEF_BYTES),'512 KiB');assert.equal(formatBytes(EXPLANATION_REQUEST_FILE_LIMIT),'4 MiB');assert.equal(formatBytes(20),'20 bytes');
 assert.doesNotThrow(()=>checkPayloadSize('p','x'.repeat(16),{kind:'test',bytes:16}));
 assert.throws(()=>checkPayloadSize('p','x'.repeat(17),{kind:'test payload',bytes:16}),/p is 17 bytes: a test payload is accepted up to 16 bytes\. Nothing was parsed or written\./);
});

test('readBoundedText accepts a file at its limit and refuses one byte more before reading',t=>{
 const root=workspace(t),at=join(root,'at.txt'),over=join(root,'over.txt'),limit={kind:'test input',bytes:32};
 writeFileSync(at,'a'.repeat(32));writeFileSync(over,'a'.repeat(33));
 assert.equal(readBoundedText(at,limit).length,32);
 assert.throws(()=>readBoundedText(over,limit),(e:unknown)=>e instanceof InputLimitError&&e.size===33&&/over\.txt is 33 bytes: a test input is read up to 32 bytes\. Nothing was read or written\./.test(e.message));
 assert.throws(()=>readBoundedText(root,limit),/not a regular file/);
});

test('intelligence CLI: a 12 MiB document is read, one byte more is refused with no output directory',t=>{
 const root=workspace(t),at=padded(join(root,'at.json'),doc(),MAX_DOCUMENT_BYTES),over=padded(join(root,'over.json'),doc(),MAX_DOCUMENT_BYTES+1);
 const ok=tsx('scripts/intelligence.ts',['inspect','--input',at,'--out',join(root,'ok')]);assert.equal(ok.status,0,ok.stderr);assert.ok(readdirSync(join(root,'ok')).includes('readiness.json'));
 const no=tsx('scripts/intelligence.ts',['inspect','--input',over,'--out',join(root,'no')]);assert.equal(no.status,1);
 assert.match(no.stderr,/over\.json is 12 MiB: a JSON document is read up to 12 MiB\./);assert.match(no.stderr,REFUSED);assert.ok(!existsSync(join(root,'no')));
 // --current goes through the same check (validate-proposal, the proposal-parity path).
 const cur=tsx('scripts/intelligence.ts',['validate-proposal','--input',at,'--current',over,'--out',join(root,'cur')]);assert.equal(cur.status,1);
 assert.match(cur.stderr,/a JSON document is read up to 12 MiB/);assert.ok(!existsSync(join(root,'cur')));
 // A ProjectBrief keeps its 512 KiB limit.
 const brief=padded(join(root,'brief.json'),{format:'diagramcloud.project-brief',version:1},MAX_BRIEF_BYTES+1);
 const b=tsx('scripts/intelligence.ts',['brief','--input',brief,'--out',join(root,'brief-out')]);assert.equal(b.status,1);
 assert.match(b.stderr,/a ProjectBrief is read up to 512 KiB/);assert.ok(!existsSync(join(root,'brief-out')));
});

test('intelligence MCP: a document at 12 MiB starts, one byte more is refused at startup; an oversized brief argument is an isError result',t=>{
 const root=workspace(t),at=padded(join(root,'at.json'),doc(),MAX_DOCUMENT_BYTES),over=padded(join(root,'over.json'),doc(),MAX_DOCUMENT_BYTES+1);
 const big='x'.repeat(MAX_BRIEF_BYTES);assert.ok(Buffer.byteLength(big)<MAX_MCP_REQUEST_BYTES-1024);
 const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'limit-test'}}},{method:'notifications/initialized'},
  {id:2,method:'tools/call',params:{name:'diagramcloud_propose_project',arguments:{format:'diagramcloud.project-brief',version:1,project:{title:big}}}},
  {id:3,method:'tools/call',params:{name:'diagramcloud_propose_design',arguments:{format:'diagramcloud.design-brief',version:1,projectId:'limit-test',views:[{viewId:'root',caption:big}]}}}];
 const run=tsx('scripts/intelligence-mcp.ts',[at],requests.map(r=>JSON.stringify({jsonrpc:'2.0',...r})).join('\n')+'\n');assert.equal(run.status,0,run.stderr);
 const replies=run.stdout.trim().split('\n').map(l=>JSON.parse(l));
 assert.equal(replies[0].result.serverInfo.name,'diagramcloud-file-client');
 for(const [i,kind] of [[1,'ProjectBrief'],[2,'design brief']] as const){assert.equal(replies[i].result.isError,true);assert.match(replies[i].result.content[0].text,new RegExp(`a ${kind} is accepted up to 512 KiB\\. Nothing was parsed or written\\.`));}
 const refused=tsx('scripts/intelligence-mcp.ts',[over],JSON.stringify({jsonrpc:'2.0',...requests[0]})+'\n');
 assert.equal(refused.status,1);assert.equal(refused.stdout,'');assert.match(refused.stderr,/over\.json is 12 MiB: a JSON document is read up to 12 MiB\./);
 const analysis=tsx('scripts/intelligence-mcp.ts',[at,'--analysis',over],'');
 assert.equal(analysis.status,1);assert.equal(analysis.stdout,'');assert.match(analysis.stderr,/a selected AnalysisBundle is read up to 12 MiB/);
});

test('atlas and design CLIs refuse an over-limit selected file before writing',t=>{
 const root=workspace(t),over=padded(join(root,'over.json'),doc(),MAX_DOCUMENT_BYTES+1),small=padded(join(root,'doc.json'),doc(),1024);
 const atlas=tsx('scripts/atlas.ts',[over,'--out',join(root,'atlas.json')]);assert.equal(atlas.status,1);
 assert.match(atlas.stderr,/a project manifest is read up to 12 MiB/);assert.ok(!existsSync(join(root,'atlas.json')));
 const design=tsx('scripts/design.ts',[over,'--out',join(root,'figures')]);assert.equal(design.status,1);
 assert.match(design.stderr,/a JSON document is read up to 12 MiB/);assert.ok(!existsSync(join(root,'figures')));
 // The earlier version (--delta) is read before the output folder is created.
 const delta=tsx('scripts/design.ts',[small,'--delta',over,'--out',join(root,'figures-delta')]);assert.equal(delta.status,1);
 assert.match(delta.stderr,/over\.json is 12 MiB/);assert.ok(!existsSync(join(root,'figures-delta')));
 const brief=padded(join(root,'brief.json'),{format:'diagramcloud.design-brief',version:1},MAX_BRIEF_BYTES+1);
 const b=tsx('scripts/design.ts',[small,'--brief',brief,'--out',join(root,'figures-brief')]);assert.equal(b.status,1);
 assert.match(b.stderr,/a design brief is read up to 512 KiB/);assert.ok(!existsSync(join(root,'figures-brief')));
});

test('concept preview, linked reading and explanation commands name their limit and create no output',async t=>{
 const root=workspace(t),over=padded(join(root,'over.json'),doc(),MAX_DOCUMENT_BYTES+1),small=padded(join(root,'doc.json'),doc(),1024);
 await assert.rejects(runConceptPreview([over,'--view','root','--audience','author','--out',join(root,'preview')]),/a JSON document is read up to 12 MiB\. Nothing was read or written\./);
 assert.ok(!existsSync(join(root,'preview')));
 const reading=join(root,'reading.json');writeFileSync(reading,' '.repeat(MAX_READING_OPTIONS_BYTES+1));
 await assert.rejects(exportLinkedReading(small,reading,join(root,'reading-out')),/bounded regular file: .*a linked-reading options file is read up to 64 KiB/);
 assert.ok(!existsSync(join(root,'reading-out')));
 const request=padded(join(root,'request.json'),{},EXPLANATION_REQUEST_FILE_LIMIT+1);
 await assert.rejects(prepareExplanationFiles(['--project',small,'--request',request,'--out',join(root,'explain')]),/a selected explanation file is read up to 4 MiB/);
 await assert.rejects(fs.stat(join(root,'explain')),{code:'ENOENT'});
 // At its limit the explanation input is read (and then refused for its content, not its size).
 const atRequest=padded(join(root,'request-at.json'),{},EXPLANATION_REQUEST_FILE_LIMIT);
 await assert.rejects(prepareExplanationFiles(['--project',small,'--request',atRequest,'--out',join(root,'explain-at')]),(e:unknown)=>e instanceof Error&&!/read up to/.test(e.message));
});

test('concept host refuses an over-limit document before it starts a server',async t=>{
 const root=workspace(t),over=padded(join(root,'over.json'),doc(),MAX_DOCUMENT_BYTES+1),viewer=join(root,'viewer.html');writeFileSync(viewer,'<!doctype html>');
 await assert.rejects(runConceptHost([over,'--view','root','--audience','public','--viewer',viewer,'--viewer-sha256','0'.repeat(64)]),/over\.json is 12 MiB: a JSON document is read up to 12 MiB\./);
});
