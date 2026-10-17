import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {zipEntries,zipText} from '../src/core/interchange/zip';
import {createReturnGuard,createReturnIntent,negotiateCapabilities,returnFileText,type HostSession} from '../src/react/hostSession';
import {openMessage,handleReturn,handleReturnFile,handleSelectionRequest,webviewHtml,OPEN_REFUSED} from '../hosts/vscode/src/hostCore';

// Synthetic document only: one public and one private component, a private source.
const doc=()=>({schemaVersion:1,id:'synthetic-vsix',revision:3,title:'Synthetic VSIX viewer',rootViewId:'root',privateNotes:'PRIVATE_NOTE_SENTINEL',
 nodes:[{id:'a',label:'Public input',sourceIds:['s']},{id:'p',label:'PRIVATE_NODE_SENTINEL',visibility:'private'}],edges:[],views:[{id:'root',title:'Root',nodeIds:['a','p']}],
 sources:[{id:'s',title:'Public citation'},{id:'q',title:'PRIVATE_SOURCE_SENTINEL',visibility:'private'}]});

test('VS Code host opens only the public projection with an explicit, read-only-by-default session',()=>{
 const opened=openMessage(JSON.stringify(doc()),[],'vscode-session-1');assert.ok(opened.ok);
 const text=JSON.stringify(opened.message);for(const s of ['PRIVATE_NODE_SENTINEL','PRIVATE_SOURCE_SENTINEL','PRIVATE_NOTE_SENTINEL'])assert.ok(!text.includes(s),s);
 assert.deepEqual(opened.message.selection,{projectId:'synthetic-vsix',baseRevision:3,viewId:'root'});assert.deepEqual(opened.binding.granted,[]);
 const granted=openMessage(JSON.stringify(doc()),['render','apply','publish'],'vscode-session-2');assert.ok(granted.ok);assert.deepEqual(granted.binding.granted,['render']);
 for(const bad of ['not json','{}',JSON.stringify({...doc(),views:[]})])assert.deepEqual(openMessage(bad,[],'vscode-session-3'),{ok:false,reason:OPEN_REFUSED});
});

test('VS Code host routes guarded returns: selection replies, inert documents, refusals, closed panel',()=>{
 const opened=openMessage(JSON.stringify(doc()),['query','render'],'vscode-session-4');assert.ok(opened.ok);
 const guard=createReturnGuard(opened.binding),session=negotiateCapabilities(opened.message.session) as HostSession,target={projectId:'synthetic-vsix',baseRevision:3,viewId:'root',nodeId:'a'};
 const selection=createReturnIntent(session,'selection',target)!;
 assert.deepEqual(handleReturn(guard,selection,'live').reply,{type:'select',selection:target});
 assert.equal(handleReturn(guard,selection,'live').warn,'Refused: this intent was already received once.');
 const render=handleReturn(guard,createReturnIntent(session,'render',target,'<svg/>'),'live');assert.deepEqual(render.show,{language:'xml',content:'<svg/>'});assert.equal(render.reply,undefined);
 assert.equal(handleReturnFile(guard,returnFileText(createReturnIntent(session,'selection',{...target,baseRevision:2})!)).warn,'Refused: the intent was made for another project, document revision or audience.');
 assert.equal(handleReturnFile(guard,returnFileText(createReturnIntent(session,'navigate',target)!)).reply?.type,'select');
 assert.deepEqual(handleSelectionRequest(guard,target).reply,{type:'select',selection:target});
 assert.equal(handleSelectionRequest(guard,{...target,baseRevision:9}).reply,undefined);
 guard.dispose();assert.equal(handleReturn(guard,createReturnIntent(session,'selection',target),'live').warn,'Refused: this viewer session was closed.');
 assert.equal(handleSelectionRequest(guard,target).reply,undefined);assert.equal(handleReturn(undefined,selection,'file').warn,'Refused: this viewer session was closed.');
});

test('webview policy allows one nonce script, no network, fonts or frames',()=>{
 const html=webviewHtml('vscode-webview://abc','vscode-webview://abc/media/webview.js','vscode-webview://abc/media/webview.css','0123456789abcdef0123');
 assert.match(html,/default-src 'none'/);assert.match(html,/connect-src 'none'/);assert.match(html,/font-src 'none'/);assert.match(html,/script-src 'nonce-0123456789abcdef0123'/);
 assert.equal(html.match(/<script/g)!.length,1);assert.ok(!html.includes('unsafe-eval'));assert.throws(()=>webviewHtml('x','y','z','short'));
});

test('package-vsix builds a readable VSIX source package with an exact, safe member list',async()=>{
 const out=join(mkdtempSync(join(tmpdir(),'dc-vsix-')),'pkg');
 try{
  const run=spawnSync(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),'scripts/package-vsix.ts','--out',out],{encoding:'utf8',timeout:240000});
  assert.equal(run.status,0,run.stderr);
  const receipt=JSON.parse(readFileSync(join(out,'vsix-receipt.json'),'utf8')) as {vsix:string;members:string[];bundledPackages:string[];sourceCommit:string};
  assert.deepEqual(receipt.members,['[Content_Types].xml','extension.vsixmanifest','extension/LICENSE.txt','extension/README.md','extension/THIRD_PARTY_LICENSES.txt','extension/THIRD_PARTY_NOTICES.md','extension/dist/extension.cjs','extension/media/webview.css','extension/media/webview.js','extension/package.json']);
  for(const name of ['react','react-dom','@xyflow/react','zod'])assert.ok(receipt.bundledPackages.includes(name),name);
  const bytes=new Uint8Array(readFileSync(join(out,receipt.vsix))),entries=zipEntries(bytes);
   const manifest=JSON.parse((await zipText(bytes,entries,'extension/package.json'))!) as {main:string;activationEvents:string[];contributes:{commands:{command:string}[];configuration:{properties:Record<string,{default:unknown}>}};diagramcloud:{sourceCommit:string}};
   assert.equal(manifest.main,'./dist/extension.cjs');assert.deepEqual(manifest.activationEvents,[]);assert.deepEqual(manifest.contributes.configuration.properties['diagramcloud.viewer.grants'].default,[]);
   assert.deepEqual(manifest.contributes.commands.map(c=>c.command),['diagramcloud.viewer.open','diagramcloud.viewer.loadReturnFile']);assert.equal(manifest.diagramcloud.sourceCommit,receipt.sourceCommit);
   assert.match((await zipText(bytes,entries,'extension.vsixmanifest'))!,/Microsoft\.VisualStudio\.Code\.Engine" Value="\^1\.90\.0"/);
   const licenses=(await zipText(bytes,entries,'extension/THIRD_PARTY_LICENSES.txt'))!;assert.match(licenses,/@xyflow\/react@/);assert.match(licenses,/MIT/);
   for(const name of ['extension/dist/extension.cjs','extension/media/webview.js','extension/media/webview.css']){const text=(await zipText(bytes,entries,name))!;
    assert.ok(!/[A-Za-z]:[\\/](?:PROJ|Users)|\/home\/|sourceMappingURL/.test(text),name);assert.ok(!/fetch\(|XMLHttpRequest|WebSocket\(/.test(name.endsWith('.cjs')?text:''),name);}
 }finally{rmSync(join(out,'..'),{recursive:true,force:true});}
});
