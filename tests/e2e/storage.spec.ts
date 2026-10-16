import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

/** Save and recovery paths against the browser's real IndexedDB: conflicts, unavailable storage, failures mid-session. */

async function openTotal(page:Page){
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
}
async function rename(page:Page,from:string,to:string){
 await page.bringToFront();
 await page.getByRole('button',{name:`Explore ${from}`,exact:true}).click();
 await page.getByLabel('Component label').fill(to);
 await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(page.getByRole('button',{name:`Explore ${to}`,exact:true})).toBeVisible();
}
const saveAlert=(page:Page)=>page.getByRole('alert').filter({hasText:'Local save needs attention'});
async function backupText(page:Page){
 const wait=page.waitForEvent('download');await saveAlert(page).getByRole('button',{name:'Download backup',exact:true}).click();
 return readFileSync(await (await wait).path(),'utf8');
}
/** Try to close the tab; the unsaved-work guard must ask, and dismissing keeps the page. */
async function expectCloseGuard(page:Page){
 const asked=page.waitForEvent('dialog');await page.close({runBeforeUnload:true});
 const dialog=await asked;expect(dialog.type()).toBe('beforeunload');await dialog.dismiss();
 expect(page.isClosed()).toBe(false);
}

test('two tabs: the later writer is refused, keeps its edit as a backup, and never overwrites the first tab',async({context})=>{
 const a=await context.newPage(),b=await context.newPage(),errors:string[]=[];
 for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.bringToFront();await p.goto('/');await openTotal(p);}
 await rename(a,'SQL quality checks','Edited in tab A');
 await expect(a.getByText('Saved locally',{exact:true})).toBeVisible();

 await rename(b,'SQL quality checks','Edited in tab B');
 await expect(saveAlert(b)).toContainText('Another tab changed this project');
 await expect(b.getByText('Not saved · export JSON',{exact:true})).toBeVisible();
 const backup=JSON.parse(await backupText(b));
 expect(backup.nodes.find((n:{id:string})=>n.id==='checks').label).toBe('Edited in tab B');
 await expectCloseGuard(b);

 await a.bringToFront();await a.reload();await openTotal(a);
 await expect(a.getByRole('button',{name:'Explore Edited in tab A',exact:true})).toBeVisible();

 // After reloading, tab B sees tab A's version and can save again.
 await b.bringToFront();b.once('dialog',d=>void d.accept());await b.reload();await openTotal(b);
 await expect(b.getByRole('button',{name:'Explore Edited in tab A',exact:true})).toBeVisible();
 await rename(b,'Edited in tab A','Edited in B after reload');
 await expect(b.getByText('Saved locally',{exact:true})).toBeVisible();
 await expect(saveAlert(b)).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('storage that cannot open: editing still works, the reason is shown, and the backup holds the edit',async({page})=>{
 await page.addInitScript(()=>{IDBFactory.prototype.open=function(){throw new DOMException('Site data is blocked','SecurityError');};});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(saveAlert(page)).toContainText('does not allow local storage');
 await openTotal(page);
 await rename(page,'SQL quality checks','Kept only in memory');
 await expect(page.getByText('Not saved · export JSON',{exact:true})).toBeVisible();
 expect(await backupText(page)).toContain('Kept only in memory');
 await expectCloseGuard(page);
 expect(errors).toEqual([]);
});

test('a save that fails mid-session is explained, guarded, and recovered by the next successful save',async({page})=>{
 await page.goto('/');await openTotal(page);
 await rename(page,'SQL quality checks','Saved before the failure');
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;(window as unknown as {restorePut:()=>void}).restorePut=()=>{IDBObjectStore.prototype.put=put;};
  IDBObjectStore.prototype.put=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
 await rename(page,'Saved before the failure','Edited while storage was full');
 await expect(saveAlert(page)).toContainText('Browser storage is full');
 await expect(page.getByText('Not saved · export JSON',{exact:true})).toBeVisible();
 // The interrupted write left the previously stored document intact.
 const stored=await page.evaluate(()=>new Promise<string>((resolve,reject)=>{const r=indexedDB.open('diagramcloud-v1',1);r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{const g=r.result.transaction('projects','readonly').objectStore('projects').get('total-project-controls');g.onsuccess=()=>{r.result.close();resolve(g.result.json);};g.onerror=()=>reject(g.error);};}));
 expect(JSON.parse(stored).nodes.find((n:{id:string})=>n.id==='checks').label).toBe('Saved before the failure');
 await expectCloseGuard(page);

 // Space is freed; the next edit saves a full snapshot that includes the edit that failed.
 await page.evaluate(()=>(window as unknown as {restorePut:()=>void}).restorePut());
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await expect(saveAlert(page)).toHaveCount(0);
 await page.reload();await openTotal(page);
 await expect(page.getByRole('button',{name:'Explore Edited while storage was full',exact:true})).toBeVisible();
});

test('recovery screen: download a raw row, delete with confirmation, repair a row in the JSON editor',async({page})=>{
 await page.goto('/');await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.evaluate(async()=>{
  const doc=await (await fetch('examples/fabric-medallion.json')).json();
  doc.id='fixable';doc.title='Recovered project';doc.nodes[0].childViewId='missing-view';
  await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('diagramcloud-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('projects','readwrite'),st=tx.objectStore('projects');
   st.put({id:'broken-json',json:'{broken',writer:'qa',savedAt:Date.now()});st.put({id:'fixable',json:JSON.stringify(doc),writer:'qa',savedAt:Date.now()});st.put({id:'no-json',writer:'qa',savedAt:1});
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 });
 await page.reload();
 await expect(page.getByText(/3 saved projects could not be read.*Open Recovery/)).toBeVisible();
 await page.getByRole('button',{name:'Recovery (3)',exact:true}).click();
 const panel=page.getByRole('region',{name:'Unreadable saved projects'}),row=(id:string)=>panel.locator('li').filter({hasText:id});
 await expect(row('fixable')).toContainText('unknown reference');
 await expect(row('no-json').getByRole('button',{name:'Open in JSON editor',exact:true})).toBeDisabled();

 const wait=page.waitForEvent('download');await row('broken-json').getByRole('button',{name:'Download raw copy',exact:true}).click();
 const raw=JSON.parse(readFileSync(await (await wait).path(),'utf8'));expect(raw).toMatchObject({id:'broken-json',json:'{broken',writer:'qa'});
 await row('broken-json').getByRole('button',{name:'Delete from this browser…',exact:true}).click();
 await expect(row('broken-json').getByRole('note')).toContainText('You downloaded a raw copy. Deleting removes the row from this browser for good.');
 await row('broken-json').getByRole('button',{name:'Delete permanently',exact:true}).click();
 await expect(row('broken-json')).toHaveCount(0);

 await row('fixable').getByRole('button',{name:'Open in JSON editor',exact:true}).click();
 await expect(page.locator('.patch-note')).toContainText('Repairing the unreadable saved project “fixable”');
 const editor=page.getByLabel('Project JSON'),doc=JSON.parse(await editor.inputValue());delete doc.nodes[0].childViewId;
 await editor.fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Recovered project',exact:true})).toBeVisible();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Recovery (1)',exact:true})).toBeVisible();

 await page.reload();
 await expect(page.getByText(/1 saved project could not be read/)).toBeVisible();
 await expect(page.locator('.project-card').filter({hasText:'Recovered project'})).toBeVisible();
 await page.getByRole('button',{name:'Recovery (1)',exact:true}).click();
 await expect(panel.locator('li')).toHaveCount(1);await expect(row('no-json')).toBeVisible();
});

import {documentSchema,validateDocument} from '../../src/core/model';
import {publicDocument} from '../../src/core/operations';
import type {Route} from '@playwright/test';

const exportRecoveryPrivate='SYNTHETIC_PRIVATE_EXPORT_RECOVERY';
function exportRecoveryProject(id:string){return validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic export recovery',rootViewId:'root',privateNotes:exportRecoveryPrivate,
 nodes:[{id:'lakehouse',label:'Synthetic Fabric Lakehouse',kind:'storage',provider:'Microsoft Fabric',icon:'fabric-lakehouse',basis:'planned'},{id:'private',label:exportRecoveryPrivate,visibility:'private'}],edges:[],
 views:[{id:'root',title:'Synthetic export scope',nodeIds:['lakehouse','private'],positions:{lakehouse:{x:0,y:0},private:{x:300,y:0}}}],
 blocks:[{id:'unattached-private',title:'Synthetic unattached backup evidence',type:'text',text:exportRecoveryPrivate,visibility:'private',provenance:'synthetic'}],
 sources:[{id:'unattached-source',title:'Synthetic unattached backup source',location:exportRecoveryPrivate,visibility:'private'}]}));}
async function exportRecoveryCurrent(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const raw=await page.getByLabel('Project JSON',{exact:true}).inputValue();validateDocument(JSON.parse(raw));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return raw;}
async function importExportRecovery(page:Page,id:string){await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(exportRecoveryProject(id)));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();return exportRecoveryCurrent(page);}
async function holdExportIconFetches(page:Page){
 const held:Route[]=[],pattern='**/icons/*.svg*';const handler=async(route:Route)=>{if(route.request().resourceType()==='fetch'){held.push(route);return;}await route.continue();};await page.route(pattern,handler);
 return {held,cleanup:async()=>{for(const route of held)await route.abort('aborted').catch(()=>{});await page.unroute(pattern,handler);}};
}

test('save-error authoring backup completes exactly while a real icon fetch remains pending and unreleased',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await importExportRecovery(page,'synthetic-backup-icon-pending');await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as unknown as {restoreExportRecoveryPut:()=>void}).restoreExportRecoveryPut=()=>{IDBObjectStore.prototype.put=original;};IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic storage full','QuotaExceededError');};});
 const routes=await holdExportIconFetches(page);
 try{
  await rename(page,'Synthetic Fabric Lakehouse','Synthetic edit retained during icon wait');await expect(saveAlert(page)).toContainText('Browser storage is full');const expected=await exportRecoveryCurrent(page);
  await page.evaluate(()=>{const state={status:'pending'},url=new URL('icons/fabric-lakehouse.svg',window.location.href);url.search='synthetic-held-recovery=1';const promise=fetch(url,{cache:'no-store'}).then(()=>{state.status='completed';},()=>{state.status='rejected';});Object.assign(window,{exportRecoveryHeldState:state,exportRecoveryHeldPromise:promise});});
  await expect.poll(()=>routes.held.length).toBe(1);expect(await page.evaluate(()=>(window as unknown as {exportRecoveryHeldState:{status:string}}).exportRecoveryHeldState.status)).toBe('pending');
  const text=await backupText(page);expect(text).toBe(expected);expect(validateDocument(JSON.parse(text)).privateNotes).toBe(exportRecoveryPrivate);expect(text).toContain('unattached-private');expect(text).toContain('unattached-source');expect(text).toContain('Synthetic edit retained during icon wait');
  // Assert before cleanup: the request has neither fulfilled nor rejected, and backup issued no second icon fetch.
  expect(routes.held).toHaveLength(1);expect(await page.evaluate(()=>(window as unknown as {exportRecoveryHeldState:{status:string}}).exportRecoveryHeldState.status)).toBe('pending');await expect(saveAlert(page)).toBeVisible();expect(await exportRecoveryCurrent(page)).toBe(expected);expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('authoring-backup-icon-still-pending.png')});
 }finally{await routes.cleanup();await page.evaluate(async()=>{const w=window as unknown as {restoreExportRecoveryPut:()=>void;exportRecoveryHeldPromise?:Promise<void>};w.restoreExportRecoveryPut();await w.exportRecoveryHeldPromise;});}
});

test('Public JSON has exact publicDocument redaction without issuing an unrelated export icon fetch',async({page},info)=>{
 const before=await importExportRecovery(page,'synthetic-public-json-no-icon'),expected=publicDocument(validateDocument(JSON.parse(before))),routes=await holdExportIconFetches(page);
 try{await page.getByRole('button',{name:'Export & share',exact:true}).click();const pending=page.waitForEvent('download');void pending.catch(()=>{});await page.getByRole('button',{name:/^Public JSON/}).click();const file=await pending;expect(await file.failure()).toBeNull();const raw=readFileSync(await file.path(),'utf8');expect(raw).toBe(JSON.stringify(expected,null,2));expect(raw).not.toContain(exportRecoveryPrivate);expect(routes.held).toHaveLength(0);await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await exportRecoveryCurrent(page)).toBe(before);await page.screenshot({path:info.outputPath('public-json-without-icon-fetch.png')});}
 finally{await routes.cleanup();}
});

test('SVG still awaits and embeds the exact existing public vendor icon bytes with privacy intact',async({page})=>{
 const before=await importExportRecovery(page,'synthetic-svg-icon-positive'),routes=await holdExportIconFetches(page);const originalBytes=readFileSync('public/icons/fabric-lakehouse.svg');
 try{await page.getByRole('button',{name:'Export & share',exact:true}).click();const pending=page.waitForEvent('download');void pending.catch(()=>{});await page.getByRole('button',{name:/^SVG diagram/}).click();await expect.poll(()=>routes.held.length).toBe(1);expect(new URL(routes.held[0].request().url()).origin).toBe(new URL(page.url()).origin);expect(new URL(routes.held[0].request().url()).pathname).toMatch(/\/icons\/fabric-lakehouse\.svg$/);
  // This positive control explicitly releases exact existing artwork; the backup case never does.
  await routes.held[0].fulfill({contentType:'image/svg+xml',body:originalBytes});const file=await pending;expect(await file.failure()).toBeNull();const svg=readFileSync(await file.path(),'utf8');expect(svg).toContain('data:image/svg+xml;base64,'+originalBytes.toString('base64'));expect(svg).toContain('fabric-lakehouse');expect(svg).toContain('Microsoft');expect(svg).not.toContain(exportRecoveryPrivate);expect(routes.held).toHaveLength(1);await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await exportRecoveryCurrent(page)).toBe(before);
 }finally{await routes.cleanup();}
});
