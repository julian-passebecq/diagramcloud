/**
 * Installed-host proof of the standalone DiagramCloud viewer VSIX in a real VS Code, or in Cursor.
 *
 *   npm run test:host:vscode
 *   DIAGRAMCLOUD_HOST=cursor npm run test:host:vscode     (local Cursor; DIAGRAMCLOUD_CURSOR_EXECUTABLE overrides
 *                                                          %LOCALAPPDATA%/Programs/cursor/Cursor.exe)
 *
 * Builds the VSIX with scripts/package-vsix.ts, downloads VS Code with @vscode/test-electron (cached in
 * .local/vscode-host/vscode-test; DIAGRAMCLOUD_VSCODE_VERSION picks a version, default stable, or
 * DIAGRAMCLOUD_VSCODE_EXECUTABLE points at an existing Code executable), installs the VSIX with VS Code's own CLI into
 * an isolated --extensions-dir / --user-data-dir under .local/vscode-host/<run>, never the person's own profile, then
 * drives the workbench and the viewer webview with Playwright's Electron driver: read-only default negotiation, host
 * selection, live selection return, return files (accepted once, replay and stale refused), dispose, reopen as a new
 * session (earlier session refused), a refused return kept unchanged and saved with "Download return file", a kind the
 * host has no route for refused as unsupported-route, explicit grants (render granted, apply refused) and uninstall.
 * Outcomes are read from the extension's own "DiagramCloud viewer" output channel log. A receipt with the VS Code
 * version and VSIX hash is written to .local/vscode-host/<run>/receipt.json. Synthetic document only. Local only: it
 * is not part of `npm test` or CI (it needs a desktop session and a VS Code download, or an installed Cursor).
 * Cursor is the same VS Code workbench: the run installs the same VSIX with Cursor's own CLI (resources/app/bin).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {_electron,type ElectronApplication,type Frame,type Page} from '@playwright/test';
import {downloadAndUnzipVSCode,resolveCliPathFromVSCodeExecutablePath} from '@vscode/test-electron';

/** Host under test: VS Code (default, downloaded) or the locally installed Cursor (DIAGRAMCLOUD_HOST=cursor). */
const HOST=process.env.DIAGRAMCLOUD_HOST==='cursor'?'cursor':'vscode',HOST_NAME=HOST==='cursor'?'Cursor':'VS Code';
const root=resolve('.'),base=join(root,'.local/vscode-host'),run=join(base,`${HOST}-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const userData=join(run,'user-data'),extensions=join(run,'extensions'),workspace=join(run,'workspace');
const EXTENSION_ID='diagramcloud-local.diagramcloud-viewer';
const steps:{step:string;result:string}[]=[];
const record=(step:string,result:string)=>{steps.push({step,result});};

// Synthetic document only: one public and one private component, a private source and private notes.
const PRIVATE=['PRIVATE_NODE_SENTINEL','PRIVATE_SOURCE_SENTINEL','PRIVATE_NOTE_SENTINEL'];
const doc={schemaVersion:1,id:'synthetic-vsix',revision:3,title:'Synthetic VSIX viewer',rootViewId:'root',privateNotes:'PRIVATE_NOTE_SENTINEL',
 nodes:[{id:'a',label:'Public input',sourceIds:['s']},{id:'b',label:'Public output'},{id:'p',label:'PRIVATE_NODE_SENTINEL',visibility:'private'}],
 edges:[{id:'e1',source:'a',target:'b'}],views:[{id:'root',title:'Root',nodeIds:['a','b','p'],edgeIds:['e1']}],
 sources:[{id:'s',title:'Public citation'},{id:'q',title:'PRIVATE_SOURCE_SENTINEL',visibility:'private'}]};

/** A diagramcloud.host-return/1 intent written by hand, as a return file from some earlier or foreign session. */
const intent=(sessionId:string,over:Record<string,unknown>={})=>({format:'diagramcloud.host-return/1',intentId:randomBytes(16).toString('hex'),sessionId,kind:'selection',
 projectId:'synthetic-vsix',baseRevision:3,audience:'public',viewId:'root',nodeId:'b',...over});
const writeReturn=(name:string,value:unknown)=>{const path=join(workspace,'returns',name);writeFileSync(path,JSON.stringify(value,null,2)+'\n');return path;};

/** The host's own CLI: VS Code's bin/code(.cmd), or Cursor's resources/app/bin/cursor(.cmd). */
const cliPath=(exe:string)=>HOST==='cursor'?join(dirname(exe),'resources','app','bin',process.platform==='win32'?'cursor.cmd':'cursor'):resolveCliPathFromVSCodeExecutablePath(exe);
function cursorExecutable(){
 const exe=process.env.DIAGRAMCLOUD_CURSOR_EXECUTABLE??join(process.env.LOCALAPPDATA??'','Programs','cursor','Cursor.exe');
 assert.ok(existsSync(exe),`Cursor not found at ${exe}; set DIAGRAMCLOUD_CURSOR_EXECUTABLE`);return exe;
}
function cli(exe:string,...args:string[]){
 const command=cliPath(exe),quote=(s:string)=>'"'+s.replace(/"/g,'\\"')+'"';
 const result=spawnSync(quote(command),[...args,'--extensions-dir',extensions,'--user-data-dir',userData].map(quote),{encoding:'utf8',shell:true,timeout:180000,env:cleanEnv()});
 assert.equal(result.status,0,`code ${args.join(' ')}: ${result.stderr}${result.stdout}`);return result.stdout.trim();
}
/** No inherited VS Code / Electron variables: the test instance must never attach to a running VS Code. */
function cleanEnv(){const env:Record<string,string>={};for(const [k,v] of Object.entries(process.env))if(v!==undefined&&!/^(VSCODE_|ELECTRON_)/i.test(k))env[k]=v;return env;}

function viewerLog(){
 const logs=join(userData,'logs');if(!existsSync(logs))return '';
 const found:string[]=[];const walk=(dir:string)=>{for(const item of readdirSync(dir,{withFileTypes:true})){const p=join(dir,item.name);if(item.isDirectory())walk(p);else if(item.name.endsWith('DiagramCloud viewer.log'))found.push(p);}};walk(logs);
 return found.sort((a,b)=>statSync(a).mtimeMs-statSync(b).mtimeMs).map(p=>readFileSync(p,'utf8')).join('\n');
}
/** Wait until the extension's output channel has one more line matching `pattern` than it had at `from`. */
async function logLine(pattern:RegExp,from:number,timeout=20000):Promise<string>{
 const until=Date.now()+timeout;
 for(;;){const lines=viewerLog().split(/\r?\n/).slice(from),hit=lines.find(l=>pattern.test(l));if(hit)return hit;
  if(Date.now()>until)throw new Error(`No viewer log line ${pattern} after line ${from}. Log:\n${viewerLog()}`);await new Promise(r=>setTimeout(r,250));}
}
const lineCount=()=>viewerLog().split(/\r?\n/).length-1;

/** The quick-input text box (Cursor's quick input also has "toggle all" and per-row checkboxes). */
const QUICK_INPUT='.quick-input-widget input:not([type="checkbox"])';
/** Run a command from the palette. A webview that is still taking focus can close the palette: open it again. */
async function command(page:Page,title:string){
 const input=page.locator(QUICK_INPUT);
 for(let attempt=1;;attempt++){
  try{await page.keyboard.press('F1');await input.waitFor({state:'visible',timeout:5000});await input.fill('>'+title,{timeout:5000});
   await page.locator('.quick-input-list .monaco-list-row',{hasText:title}).first().waitFor({timeout:5000});await input.press('Enter');return;}
  catch(error){if(attempt>=3)throw error;await page.keyboard.press('Escape');await page.waitForTimeout(500);}
 }
}
async function quickOpen(page:Page,name:string){
 await page.keyboard.press('Control+P');const input=page.locator(QUICK_INPUT);await input.waitFor({state:'visible'});
 await input.fill(name);await page.locator('.quick-input-list .monaco-list-row',{hasText:name}).first().waitFor();await input.press('Enter');
 await page.locator('.tabs-container .tab.active',{hasText:name}).first().waitFor();
}
/** The viewer webview (VS Code nests it in a host iframe and an active-frame iframe). */
async function viewerFrame(page:Page,timeout=30000):Promise<Frame>{
 const until=Date.now()+timeout;
 let last='';
 for(;;){for(const frame of page.frames()){try{if(await frame.locator('#diagramcloud-root .diagramcloud-viewer').count())return await withSelectionPanel(frame);}catch(error){last=String(error).slice(0,400);/* detached */}}
  if(Date.now()>until){
   await page.screenshot({path:join(run,'viewer-not-found.png')}).catch(()=>undefined);
   if(last)throw new Error('Viewer webview not usable: '+last);
   const seen=await Promise.all(page.frames().map(async f=>`${f.url().slice(0,100)} [${await f.locator('body').innerText({timeout:1000}).then(t=>t.slice(0,160).replace(/\s+/g,' ')).catch(()=>'unreadable')}]`));
   throw new Error('Viewer webview not found. Frames: '+seen.join(' , '));}
  await page.waitForTimeout(250);}
}
/** The permitted selection buttons sit in the collapsed "Selected public context" disclosure: open it as a person would. */
async function withSelectionPanel(frame:Frame){
 const details=frame.locator('details',{has:frame.locator('summary',{hasText:'Selected public context'})});
 if(await details.getAttribute('open')===null)await details.locator('summary').click();return frame;
}
async function loadReturnFile(page:Page,path:string){
 await command(page,'DiagramCloud: Load viewer return file');
 const input=page.locator(QUICK_INPUT);await input.waitFor({state:'visible'});await input.fill(path);await page.waitForTimeout(400);await input.press('Enter');
}
async function closeViewer(page:Page){
 await page.locator('.tabs-container .tab',{hasText:'DiagramCloud: Synthetic VSIX viewer'}).first().click();await command(page,'View: Close Editor');
}

test(`installed VSIX in ${HOST_NAME}: negotiation, selection return, dispose/reopen, stale and replayed intents`,{timeout:15*60000},async t=>{
 mkdirSync(join(workspace,'returns'),{recursive:true});mkdirSync(join(userData,'User'),{recursive:true});mkdirSync(extensions,{recursive:true});
 writeFileSync(join(workspace,'synthetic.json'),JSON.stringify(doc,null,2)+'\n');
 const settings={'files.simpleDialog.enable':true,'security.workspace.trust.enabled':false,'workbench.startupEditor':'none','window.restoreWindows':'none','update.mode':'none',
  'telemetry.telemetryLevel':'off','extensions.autoUpdate':false,'extensions.autoCheckUpdates':false,'workbench.enableExperiments':false,'chat.disableAIFeatures':true,'workbench.tips.enabled':false};
 const settingsPath=join(userData,'User','settings.json');writeFileSync(settingsPath,JSON.stringify(settings,null,2));

 // 1. Build the VSIX from this source.
 const pkg=join(run,'pkg'),built=spawnSync(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),'scripts/package-vsix.ts','--out',pkg],{encoding:'utf8',timeout:300000});
 assert.equal(built.status,0,built.stderr);
 const receipt=JSON.parse(readFileSync(join(pkg,'vsix-receipt.json'),'utf8')) as {vsix:string;sha256:string;sourceCommit:string;sourceDirty:boolean};
 const vsix=join(pkg,receipt.vsix);record('package',`built ${receipt.vsix} sha256 ${receipt.sha256}`);

 // 2. Host under test: Cursor as installed, or VS Code (downloaded by @vscode/test-electron unless an executable is given).
 const exe=HOST==='cursor'?cursorExecutable():process.env.DIAGRAMCLOUD_VSCODE_EXECUTABLE??await downloadAndUnzipVSCode({cachePath:join(base,'vscode-test'),version:process.env.DIAGRAMCLOUD_VSCODE_VERSION??'stable'});
 const vscodeVersion=cli(exe,'--version').split(/\r?\n/).slice(0,2).join(' ');record(HOST,`${exe} ${vscodeVersion}`);

 // 3. Install with VS Code's own installer into the isolated extensions directory.
 cli(exe,'--install-extension',vsix,'--force');
 const listed=cli(exe,'--list-extensions','--show-versions');assert.match(listed,new RegExp(`^${EXTENSION_ID.replace('.','\\.')}@0\\.1\\.0$`,'m'));record('install',listed);

 let app:ElectronApplication|undefined;
 try{
  app=await _electron.launch({executablePath:exe,env:cleanEnv(),timeout:120000,
   args:[workspace,`--user-data-dir=${userData}`,`--extensions-dir=${extensions}`,'--skip-welcome','--skip-release-notes','--disable-workspace-trust','--disable-telemetry','--disable-updates','--new-window']});
  const page=await app.firstWindow();await page.locator('.monaco-workbench').waitFor({timeout:120000});await page.waitForTimeout(1500);
  if(HOST==='cursor'){
   // A fresh Cursor profile covers the workbench with its account onboarding (log in / sign up for AI features). The
   // viewer needs no Cursor account: the overlay is hidden for this isolated profile, nobody signs in, and the
   // receipt says so.
   await page.addStyleTag({content:'.onboarding-v2-overlay{display:none!important}'});await page.waitForTimeout(500);
   record('cursor-onboarding','account onboarding overlay hidden in the isolated test profile; no sign-in, no AI feature used');
  }

  let session1='';
  await t.test('activation and read-only default negotiation',async()=>{
   await quickOpen(page,'synthetic.json');const from=lineCount();await command(page,'DiagramCloud: Open in DiagramCloud viewer');
   const opened=await logLine(/^Opened synthetic-vsix@3 in session (vscode-[a-f0-9]{24}); granted: none \(read-only\)\.$/,from);session1=opened.match(/session (vscode-[a-f0-9]{24})/)![1];
   const frame=await viewerFrame(page);await frame.getByRole('button',{name:'Select Public input'}).waitFor({timeout:30000});
   assert.equal(await frame.getByRole('button',{name:'Return selected context to host'}).isEnabled(),true);
   assert.equal(await frame.getByRole('button',{name:'Ask host about this context'}).isDisabled(),true);
   assert.equal(await frame.getByRole('button',{name:'Return public SVG of this view'}).isDisabled(),true);
   const text=await frame.locator('body').innerText();for(const s of PRIVATE)assert.ok(!text.includes(s),s);
   record('negotiation',opened);
  });

  await t.test('host-guarded selection and live context return',async()=>{
   const frame=await viewerFrame(page);let from=lineCount();
   await frame.getByRole('button',{name:'Select Public input'}).click();const selected=await logLine(/^selection: synthetic-vsix@3 root \/ a$/,from);
   await assertPressed(frame,'Select Public input');
   from=lineCount();await frame.getByRole('button',{name:'Return selected context to host'}).click();
   const returned=await logLine(/^live: accepted selection synthetic-vsix@3 root \/ a$/,from);record('selection',`${selected} | ${returned}`);
  });

  const once=writeReturn('once.json',intent(session1)),stale=writeReturn('stale.json',intent(session1,{baseRevision:2})),later=writeReturn('later.json',intent(session1,{nodeId:'a'}));
  await t.test('return file accepted once, replay and stale revision refused',async()=>{
   let from=lineCount();await loadReturnFile(page,once);const accepted=await logLine(/^file: accepted selection synthetic-vsix@3 root \/ b$/,from);
   await assertPressed(await viewerFrame(page),'Select Public output');
   from=lineCount();await loadReturnFile(page,once);const replayed=await logLine(/^file: Refused: this intent was already received once\.$/,from);
   from=lineCount();await loadReturnFile(page,stale);const staleLine=await logLine(/^file: Refused: the intent was made for another project, document revision or audience\.$/,from);
   record('return-file',`${accepted} | ${replayed} | ${staleLine}`);
  });

  await t.test('a refused return is kept unchanged: Download return file saves the same intent',async()=>{
   const frame=await viewerFrame(page),alert=frame.getByRole('alert',{name:'Host refused the return'});
   await alert.getByText('Refused: the intent was made for another project, document revision or audience.',{exact:false}).waitFor({timeout:10000});
   const saved=join(workspace,'returns','saved-stale.json'),from=lineCount();
   await alert.getByRole('button',{name:'Download return file'}).click();
   const input=page.locator(QUICK_INPUT);await input.waitFor({state:'visible'});await input.fill(saved);await page.waitForTimeout(400);await input.press('Enter');
   const line=await logLine(/^Download return file: saved refused intent [a-f0-9]{32} unchanged to .*saved-stale\.json\. This host refuses it for the same reason\.$/,from);
   assert.deepEqual(JSON.parse(readFileSync(saved,'utf8')),JSON.parse(readFileSync(stale,'utf8')),'the saved file is the refused intent, unchanged');
   let at=lineCount();await loadReturnFile(page,saved);const again=await logLine(/^file: Refused: the intent was made for another project, document revision or audience\.$/,at);
   const source=writeReturn('source.json',intent(session1,{kind:'source',sourceId:'s'}));
   at=lineCount();await loadReturnFile(page,source);const unrouted=await logLine(/^file: Refused: this host has no route for this return kind\.$/,at);
   await alert.getByText('Refused: this host has no route for this return kind.',{exact:false}).waitFor({timeout:10000});
   record('refusal-retained',`${line} | ${again} | ${unrouted}`);
  });

  let session2='';
  await t.test('dispose refuses returns; reopen is a new session that refuses the earlier one',async()=>{
   let from=lineCount();await closeViewer(page);const closed=await logLine(/^Viewer session closed\. Its returns and return files are now refused\.$/,from);
   from=lineCount();await loadReturnFile(page,later);const disposed=await logLine(/^file: Refused: this viewer session was closed\.$/,from);
   await quickOpen(page,'synthetic.json');from=lineCount();await command(page,'DiagramCloud: Open in DiagramCloud viewer');
   const reopened=await logLine(/^Opened synthetic-vsix@3 in session (vscode-[a-f0-9]{24}); granted: none \(read-only\)\.$/,from);session2=reopened.match(/session (vscode-[a-f0-9]{24})/)![1];
   assert.notEqual(session2,session1);
   const frame=await viewerFrame(page);await frame.getByRole('button',{name:'Select Public output'}).waitFor();
   from=lineCount();await loadReturnFile(page,later);const foreign=await logLine(/^file: Refused: the intent belongs to another viewer session\.$/,from);
   from=lineCount();await frame.getByRole('button',{name:'Select Public output'}).click();await logLine(/^selection: synthetic-vsix@3 root \/ b$/,from);
   from=lineCount();await frame.getByRole('button',{name:'Return selected context to host'}).click();const live=await logLine(/^live: accepted selection synthetic-vsix@3 root \/ b$/,from);
   record('dispose-reopen',`${closed} | ${disposed} | ${reopened} | ${foreign} | ${live}`);
  });

  await t.test('explicit grants: render granted, apply refused',async()=>{
   writeFileSync(settingsPath,JSON.stringify({...settings,'diagramcloud.viewer.grants':['render','apply']},null,2));await page.waitForTimeout(2000);
   // Start from one editor group so the viewer opened beside it has room (Cursor may also open its agent side bar).
   await command(page,'View: Close All Editor Groups');if(HOST==='cursor')await command(page,'View: Close Secondary Side Bar').catch(()=>undefined);
   await quickOpen(page,'synthetic.json');let from=lineCount();await command(page,'DiagramCloud: Open in DiagramCloud viewer');
   const opened=await logLine(/^Opened synthetic-vsix@3 in session vscode-[a-f0-9]{24}; granted: render\.$/,from);
   const frame=await viewerFrame(page);const svg=frame.getByRole('button',{name:'Return public SVG of this view'});await svg.waitFor();
   assert.equal(await svg.isEnabled(),true);await frame.getByRole('list',{name:'Capabilities not granted'}).getByText('apply: This read-only viewer never applies changes.',{exact:false}).waitFor();assert.equal(await frame.getByRole('button',{name:'Ask host about this context'}).isDisabled(),true);
   from=lineCount();await svg.click();const rendered=await logLine(/^live: accepted render synthetic-vsix@3 root.*opened as an untitled, unsaved document\.$/,from);
   await page.locator('.tabs-container .tab',{hasText:'Untitled'}).first().waitFor();
   record('grants',`${opened} | ${rendered}`);
  });
 }finally{
  await app?.close().catch(()=>undefined);
  writeFileSync(join(run,'receipt.json'),JSON.stringify({format:'diagramcloud.vscode-host-proof/1',vsix:receipt.vsix,sha256:receipt.sha256,sourceCommit:receipt.sourceCommit,sourceDirty:receipt.sourceDirty,
   host:`${HOST_NAME} (installed from the VSIX, isolated user-data and extensions directories)`,steps,notClaimed:[...(HOST==='cursor'?['VS Code']:['Cursor']),'Marketplace or Open VSX publication or signing','update and rollback']},null,2)+'\n');
 }

 // 4. Uninstall with the same CLI.
 cli(exe,'--uninstall-extension',EXTENSION_ID);assert.doesNotMatch(cli(exe,'--list-extensions'),new RegExp(EXTENSION_ID.replace('.','\\.')));record('uninstall','removed');
 writeFileSync(join(run,'receipt.json'),JSON.stringify({...JSON.parse(readFileSync(join(run,'receipt.json'),'utf8')),steps},null,2)+'\n');
});

async function assertPressed(frame:Frame,name:string){
 const button=frame.getByRole('button',{name});const until=Date.now()+10000;
 while(await button.getAttribute('aria-pressed')!=='true'){if(Date.now()>until)assert.fail(`${name} not pressed`);await new Promise(r=>setTimeout(r,200));}
}
