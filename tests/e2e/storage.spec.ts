import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

/** Save and recovery paths against the browser's real IndexedDB: conflicts, unavailable storage, failures mid-session. */

async function openTotal(page:Page){
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
}
async function rename(page:Page,from:string,to:string){
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
 for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.goto('/');await openTotal(p);}
 await rename(a,'SQL quality checks','Edited in tab A');
 await expect(a.getByText('Saved locally',{exact:true})).toBeVisible();

 await rename(b,'SQL quality checks','Edited in tab B');
 await expect(saveAlert(b)).toContainText('Another tab changed this project');
 await expect(b.getByText('Not saved · export JSON',{exact:true})).toBeVisible();
 const backup=JSON.parse(await backupText(b));
 expect(backup.nodes.find((n:{id:string})=>n.id==='checks').label).toBe('Edited in tab B');
 await expectCloseGuard(b);

 await a.reload();await openTotal(a);
 await expect(a.getByRole('button',{name:'Explore Edited in tab A',exact:true})).toBeVisible();

 // After reloading, tab B sees tab A's version and can save again.
 b.once('dialog',d=>void d.accept());await b.reload();await openTotal(b);
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
