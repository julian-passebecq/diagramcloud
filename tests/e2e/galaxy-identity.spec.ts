import {test,expect,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';

// Synthetic declarations only. This exercises the actual Hybrid UI, not a parser mock or a folder/account reader.
const retainedId='synthetic-galaxy-identity-retained';
const privateId='SYNTHETIC_PRIVATE_REJECTED_APP_ID';
const privatePath='C:/SYNTHETIC_PRIVATE_REJECTED_PATH';
const privateName='SYNTHETIC_PRIVATE_REJECTED_NAME';
const rejected={apps:[{id:privateId,name:privateName,path:privatePath+'/first'},{id:privateId,name:privateName,path:privatePath+'/second'}],contracts:[],connections:[]};
const corrected={apps:[{id:'shared_name',name:'Synthetic homonymous repository'},{id:'shared-name',name:'Synthetic homonymous repository'}],contracts:[],connections:[{from:'shared_name',to:'shared-name',kind:'file',contract:'Synthetic declared output',status:'planned'}]};
const seed=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:retainedId,title:'Synthetic retained Galaxy author work',rootViewId:'root',privateNotes:'SYNTHETIC_EXISTING_AUTHOR_NOTE',nodes:[{id:'retained',label:'Synthetic retained component',summary:'Retain this author declaration.',visibility:'private'}],edges:[],views:[{id:'root',title:'Synthetic retained view',nodeIds:['retained'],positions:{retained:{x:0,y:0}}}]}));
async function currentText(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const text=await page.getByLabel('Project JSON',{exact:true}).inputValue();validateDocument(JSON.parse(text));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return text;}
async function storedText(page:Page,id:string):Promise<string|null>{return page.evaluate(id=>new Promise<string|null>((resolve,reject)=>{const opening=indexedDB.open('diagramcloud-v1',1);opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('projects','readonly'),read=tx.objectStore('projects').get(id);read.onerror=()=>reject(read.error);read.onsuccess=()=>resolve(read.result?.json??null);tx.oncomplete=()=>db.close();};}),id);}
async function startHybrid(page:Page){await page.locator('.header-actions').getByRole('button',{name:'New analysis',exact:true}).click();await page.getByRole('radio',{name:/Hybrid/}).check();}
function assertMappings(doc:Project){
 expect(doc.id).toBe('atlas-galaxy');expect(doc.observations).toEqual([]);
 const snapshot=doc.atlas!.snapshots.find(s=>s.id===doc.atlas!.activeSnapshotId)!;
 expect(snapshot.repositories.map(r=>({id:r.id,locator:r.locator,nodeId:r.nodeId}))).toEqual([
  {id:'shared-name',locator:'shared_name',nodeId:'repo-shared-name'},
  {id:'shared-name-2',locator:'shared-name',nodeId:'repo-shared-name-2'},
 ]);
 expect(snapshot.repositories.every(r=>r.scanStatus==='not-scanned'&&r.revision===undefined&&r.authority==='manifest')).toBe(true);
 expect(doc.nodes.map(n=>({id:n.id,label:n.label}))).toEqual([{id:'repo-shared-name',label:'Synthetic homonymous repository'},{id:'repo-shared-name-2',label:'Synthetic homonymous repository'}]);
 expect(doc.edges.map(e=>({source:e.source,target:e.target,basis:e.basis}))).toEqual([{source:'repo-shared-name',target:'repo-shared-name-2',basis:'planned'}]);
 expect(doc.nodes.every(n=>n.visibility==='private')).toBe(true);expect(doc.edges.every(e=>e.visibility==='private')).toBe(true);expect(doc.blocks.every(b=>b.visibility==='private')).toBe(true);
 for(const marker of [privateId,privatePath,privateName,'SYNTHETIC_EXISTING_AUTHOR_NOTE'])expect(JSON.stringify(doc)).not.toContain(marker);
}

test('Hybrid refuses ambiguous Galaxy identity without mutating author work, then reviews distinct colliding source IDs',async({page},testInfo)=>{
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(seed()));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 const before=await currentText(page);await expect.poll(()=>storedText(page,retainedId)).not.toBeNull();const savedBefore=await storedText(page,retainedId);
 expect(await storedText(page,'atlas-galaxy')).toBeNull();await startHybrid(page);
 const editor=page.getByLabel('Project brief JSON',{exact:true});await editor.fill(JSON.stringify(rejected));await page.getByRole('button',{name:'Preview project',exact:true}).click();
 const feedback=page.getByTestId('project-start').getByRole('alert');await expect(feedback).toHaveText('Ambiguous Galaxy app identities. No project was created.');
 // The selected private draft remains editable. Only feedback must not echo its IDs/names/paths.
 for(const marker of [privateId,privatePath,privateName])await expect(feedback).not.toContainText(marker);
 await expect(editor).toHaveValue(JSON.stringify(rejected));await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toHaveCount(0);
 expect(await storedText(page,retainedId)).toBe(savedBefore);expect(await storedText(page,'atlas-galaxy')).toBeNull();await feedback.screenshot({path:testInfo.outputPath('galaxy-identity-generic-rejection.png')});
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await currentText(page)).toBe(before);
 await startHybrid(page);await editor.fill(JSON.stringify(corrected));await page.getByRole('button',{name:'Preview project',exact:true}).click();
 const candidateText=await page.getByLabel('Project JSON',{exact:true}).inputValue(),candidate=validateDocument(JSON.parse(candidateText));assertMappings(candidate);
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();expect(await storedText(page,'atlas-galaxy')).toBeNull();expect(await storedText(page,retainedId)).toBe(savedBefore);
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 const appliedText=await currentText(page),applied=validateDocument(JSON.parse(appliedText));assertMappings(applied);expect(appliedText).toBe(candidateText);
 await expect.poll(()=>storedText(page,applied.id)).not.toBeNull();expect(await storedText(page,retainedId)).toBe(savedBefore);
});

import {createHash as galaxyTextHash} from 'node:crypto';
import {readFileSync as readGalaxyDownload} from 'node:fs';
import {publicDocument} from '../../src/core/operations';
import {GALAXY_IMPORT_PROVENANCE_BLOCK,parseGalaxyImportProvenance} from '../../src/core/atlas/manifest';

const forwardGalaxy={apps:[{id:'shared_name',name:'Synthetic forward app',repo:'example/synthetic-one'},{id:'shared-name',name:'Synthetic forward peer',repo:'example/synthetic-two'}],contracts:[],connections:[{from:'shared_name',to:'shared-name',kind:'file',status:'planned'}]};
const forwardText=' '+JSON.stringify(forwardGalaxy,null,2)+'\n';
const captureControl=(page:Page)=>page.getByRole('dialog').getByRole('checkbox',{name:'Capture private Galaxy import provenance',exact:true});
function forwardReceipt(doc:Project){const block=doc.blocks.find(b=>b.id===GALAXY_IMPORT_PROVENANCE_BLOCK);return block?.type==='code'?parseGalaxyImportProvenance(block.code):undefined;}
async function forwardExport(page:Page,name:RegExp){await page.getByRole('button',{name:'Export & share',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('dialog').getByRole('button',{name}).click();const download=await wait,path=await download.path();expect(path).not.toBeNull();const text=readGalaxyDownload(path!,'utf8');await page.getByRole('button',{name:'Close dialog',exact:true}).click();return text;}
async function previewForward(page:Page,capture:boolean){await startHybrid(page);await expect(captureControl(page)).not.toBeChecked();if(capture)await captureControl(page).check();await page.getByLabel('Project brief JSON',{exact:true}).fill(forwardText);await page.getByRole('button',{name:'Preview project',exact:true}).click();return validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));}

test('Forward Galaxy capture is opt-in, private, survives full backup/reopen and refuses implicit existing-project association',async({page},testInfo)=>{
 await page.goto('/');const before=await currentText(page),without=await previewForward(page,false);expect(forwardReceipt(without)).toBeUndefined();await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await currentText(page)).toBe(before);
 const candidate=await previewForward(page,true),receipt=forwardReceipt(candidate)!;expect(receipt).toBeDefined();expect(receipt.input.digestDomain).toBe('decoded-text-utf8');expect(receipt.input.sha256).toBe(galaxyTextHash('sha256').update(forwardText,'utf8').digest('hex'));expect(receipt.namespace).toBeNull();expect(receipt.synthetic).toBeNull();expect(receipt.bindingState).toBe('unbound');
 expect(receipt.mappings.map(m=>[m.sourceAppId,m.repositoryId])).toEqual([['shared_name','shared-name'],['shared-name','shared-name-2']]);expect(candidate.observations).toEqual([]);await expect(page.getByText('Private Galaxy import provenance captured. No namespace binding or ID reuse.',{exact:true})).toBeVisible();expect(await storedText(page,'atlas-galaxy')).toBeNull();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();const applied=await currentText(page);expect(validateDocument(JSON.parse(applied))).toEqual(candidate);
 const backup=await forwardExport(page,/^Authoring JSON/);expect(validateDocument(JSON.parse(backup))).toEqual(candidate);await expect.poll(()=>storedText(page,candidate.id)).not.toBeNull();await page.reload();await page.locator('.project-card').filter({hasText:'App Galaxy'}).click();expect(await currentText(page)).toBe(applied);await page.screenshot({path:testInfo.outputPath('galaxy-forward-private-reopened.png'),fullPage:true});
 await startHybrid(page);await expect(captureControl(page)).not.toBeChecked();await captureControl(page).check();await page.getByLabel('Project brief JSON',{exact:true}).fill(forwardText);await page.getByRole('button',{name:'Preview project',exact:true}).click();await expect(page.getByText('Galaxy provenance capture unavailable. The normal import is unchanged; no IDs were reused.',{exact:true})).toBeVisible();const retained=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));expect(forwardReceipt(retained)).toEqual(receipt);await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await currentText(page)).toBe(applied);
});

test('Forward Galaxy receipt stays out of public JSON and offline HTML despite evidence visibility edits',async({page,browser},testInfo)=>{
 await page.goto('/');await previewForward(page,true);await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();const captured=validateDocument(JSON.parse(await currentText(page))),receipt=forwardReceipt(captured)!;
 const published=structuredClone(captured);for(const node of published.nodes)node.visibility='public';for(const edge of published.edges)edge.visibility='public';for(const block of published.blocks)block.visibility='public';for(const view of published.views)view.visibility='public';
 // Synthetic human-author visibility edit through the normal review; no observation/review is fabricated.
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(published));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();const live=validateDocument(JSON.parse(await currentText(page))),expected=publicDocument(live),publicJson=await forwardExport(page,/^Public JSON/);expect(JSON.parse(publicJson)).toEqual(expected);expect(publicJson).not.toContain(receipt.input.sha256);expect(publicJson).not.toContain(GALAXY_IMPORT_PROVENANCE_BLOCK);expect(publicJson).not.toContain('shared_name');
 const html=await forwardExport(page,/^Interactive HTML/);for(const marker of [receipt.input.sha256,GALAXY_IMPORT_PROVENANCE_BLOCK,'diagramcloud.galaxy-import-provenance/1','shared_name'])expect(html).not.toContain(marker);expect(validateDocument(JSON.parse(await currentText(page)))).toEqual(live);
 const offline=await browser.newContext();try{await offline.setOffline(true);await offline.route('**/*',route=>route.abort('blockedbyclient'));const tab=await offline.newPage();await tab.setContent(html);await tab.getByRole('button',{name:'Synthetic forward app',exact:true}).click();await expect(tab.getByText('Synthetic forward app',{exact:true}).first()).toBeVisible();await expect(tab.locator('body')).not.toContainText('Private Galaxy import provenance');await tab.screenshot({path:testInfo.outputPath('galaxy-forward-public-offline.png'),fullPage:true});}finally{await offline.close();}
});

test('Cancelled forward provenance digest cannot stage a late Galaxy candidate or modify the selected Project',async({page})=>{
 await page.goto('/');const before=await currentText(page);await startHybrid(page);await captureControl(page).check();await page.getByLabel('Project brief JSON',{exact:true}).fill(forwardText);
 await page.evaluate(()=>{const state={pending:false,completed:false,release:undefined as (()=>void)|undefined,restore:undefined as (()=>void)|undefined},target=window as Window&{__galaxyDigestHold?:typeof state};target.__galaxyDigestHold=state;const original=crypto.subtle.digest;Object.defineProperty(crypto.subtle,'digest',{configurable:true,value:async(algorithm:AlgorithmIdentifier,data:BufferSource)=>{state.pending=true;await new Promise<void>(resolve=>{state.release=resolve;});try{return await original.call(crypto.subtle,algorithm,data);}finally{state.completed=true;}}});state.restore=()=>Object.defineProperty(crypto.subtle,'digest',{configurable:true,writable:true,value:original});});
 try{await page.getByRole('button',{name:'Preview project',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!(window as Window&{__galaxyDigestHold?:{pending:boolean}}).__galaxyDigestHold?.pending)).toBe(true);await page.getByRole('button',{name:'Cancel analysis',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.evaluate(()=>{const state=(window as Window&{__galaxyDigestHold?:{release?:()=>void}}).__galaxyDigestHold;state?.release?.();});await expect.poll(()=>page.evaluate(()=>!!(window as Window&{__galaxyDigestHold?:{completed:boolean}}).__galaxyDigestHold?.completed)).toBe(true);expect(await currentText(page)).toBe(before);expect(await storedText(page,'atlas-galaxy')).toBeNull();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toHaveCount(0);
 }finally{await page.evaluate(()=>{const state=(window as Window&{__galaxyDigestHold?:{release?:()=>void;restore?:()=>void}}).__galaxyDigestHold;state?.release?.();state?.restore?.();});}
});


test('Gallery selected manifest capture uses the opt-in and decoded file text without applying at390px',async({page},testInfo)=>{
 await page.goto('/');const before=await currentText(page);await page.setViewportSize({width:390,height:844});const option=page.getByRole('checkbox',{name:'Capture private Galaxy import provenance',exact:true});await expect(option).not.toBeChecked();await option.check();
 await page.getByLabel('Import project manifest',{exact:true}).setInputFiles({name:'synthetic-forward-galaxy.json',mimeType:'application/json',buffer:Buffer.from(forwardText,'utf8')});await expect(page.getByLabel('Project JSON',{exact:true})).toBeVisible();const candidate=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue())),receipt=forwardReceipt(candidate)!;expect(receipt.input.sha256).toBe(galaxyTextHash('sha256').update(forwardText,'utf8').digest('hex'));expect(receipt.namespace).toBeNull();expect(candidate.observations).toEqual([]);expect(await storedText(page,'atlas-galaxy')).toBeNull();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.getByRole('dialog').screenshot({path:testInfo.outputPath('galaxy-forward-gallery-mobile.png')});await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await currentText(page)).toBe(before);
});


test('Hybrid keeps draft A readonly during its held digest, then Cancel permits draft B and rejects late A',async({page})=>{
 await page.goto('/');const before=await currentText(page);await startHybrid(page);await captureControl(page).check();const editor=page.getByLabel('Project brief JSON',{exact:true});await editor.fill(forwardText);
 const second=structuredClone(forwardGalaxy);second.apps[0].name='Synthetic draft B retained';const secondText=JSON.stringify(second,null,2)+'\n';
 await page.evaluate(()=>{const state={pending:false,completed:false,calls:0,release:undefined as (()=>void)|undefined,restore:undefined as (()=>void)|undefined},target=window as Window&{__galaxyDraftHold?:typeof state};target.__galaxyDraftHold=state;const original=crypto.subtle.digest;Object.defineProperty(crypto.subtle,'digest',{configurable:true,value:async(algorithm:AlgorithmIdentifier,data:BufferSource)=>{state.calls++;if(state.calls!==1)return original.call(crypto.subtle,algorithm,data);state.pending=true;await new Promise<void>(resolve=>{state.release=resolve;});try{return await original.call(crypto.subtle,algorithm,data);}finally{state.completed=true;}}});state.restore=()=>Object.defineProperty(crypto.subtle,'digest',{configurable:true,writable:true,value:original});});
 try{
  await page.getByRole('button',{name:'Preview project',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!(window as Window&{__galaxyDraftHold?:{pending:boolean}}).__galaxyDraftHold?.pending)).toBe(true);
  await expect(editor).toHaveJSProperty('readOnly',true);await expect(editor).toBeEnabled();await editor.focus();await expect(editor).toBeFocused();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('SYNTHETIC_ATTEMPTED_B');await expect(editor).toHaveValue(forwardText);
  await page.getByRole('button',{name:'Cancel analysis',exact:true}).click();await expect(editor).toBeEditable();await editor.fill(secondText);await expect(editor).toHaveValue(secondText);
  await page.evaluate(()=>{(window as Window&{__galaxyDraftHold?:{release?:()=>void}}).__galaxyDraftHold?.release?.();});await expect.poll(()=>page.evaluate(()=>!!(window as Window&{__galaxyDraftHold?:{completed:boolean}}).__galaxyDraftHold?.completed)).toBe(true);
  await expect(editor).toHaveValue(secondText);await expect(page.getByLabel('Project JSON',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toHaveCount(0);expect(await storedText(page,'atlas-galaxy')).toBeNull();
  await page.getByRole('button',{name:'Preview project',exact:true}).click();const candidate=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));expect(candidate.nodes.some(n=>n.label==='Synthetic draft B retained')).toBe(true);expect(candidate.nodes.some(n=>n.label==='Synthetic forward app')).toBe(false);expect(forwardReceipt(candidate)!.input.sha256).toBe(galaxyTextHash('sha256').update(secondText,'utf8').digest('hex'));expect(candidate.observations).toEqual([]);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await currentText(page)).toBe(before);
 }finally{await page.evaluate(()=>{const state=(window as Window&{__galaxyDraftHold?:{release?:()=>void;restore?:()=>void}}).__galaxyDraftHold;state?.release?.();state?.restore?.();});}
});
