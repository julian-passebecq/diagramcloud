import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {validateDocument} from '../../src/core/model';
const draft=(id:string,title:string,revision=1)=>validateDocument({schemaVersion:1,id,title,revision,rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Overview',nodeIds:[],edgeIds:[],positions:{}}],blocks:[],sources:[],assets:[],observations:[],story:[]});
async function apply(page:Page,doc:unknown){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();}
async function stored(page:Page,id:string){return page.evaluate(id=>new Promise<string>((resolve,reject)=>{const r=indexedDB.open('diagramcloud-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,g=db.transaction('projects','readonly').objectStore('projects').get(id);g.onsuccess=()=>{db.close();resolve(g.result.json);};g.onerror=()=>{db.close();reject(g.error);};};}),id);}
const alert=(page:Page)=>page.getByRole('alert').filter({hasText:'Local save needs attention'});
for(const width of [1440,390])test.describe(`multi-project save recovery ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('a different successful project cannot clear the failure or back up the wrong draft',async({page})=>{
  await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  const a=draft('save-project-a','A stored');await apply(page,a);await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  await page.evaluate(()=>{const real=IDBObjectStore.prototype.put;(window as unknown as {restorePut:()=>void}).restorePut=()=>{IDBObjectStore.prototype.put=real;};IDBObjectStore.prototype.put=function(value,key){if(value?.id==='save-project-a')throw new DOMException('Quota exceeded','QuotaExceededError');return key===undefined?real.call(this,value):real.call(this,value,key);};});
  await apply(page,{...a,title:'A memory-only'});await expect(alert(page)).toContainText('storage is full');
  await apply(page,draft('save-project-b','B saved'));await expect.poll(async()=>JSON.parse(await stored(page,'save-project-b')).title).toBe('B saved');
  await expect(page.getByText('Not saved \u00b7 export JSON',{exact:true})).toBeVisible();
  const backup=alert(page).getByRole('button',{name:'Download backup for A memory-only (save-project-a)',exact:true});await expect(backup).toBeVisible();
  expect(await alert(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const download=page.waitForEvent('download');await backup.click();const file=await download;expect(await file.failure()).toBeNull();const data=JSON.parse(readFileSync((await file.path())!,'utf8'));expect(data.id).toBe('save-project-a');expect(data.title).toBe('A memory-only');
  expect(JSON.parse(await stored(page,'save-project-a')).title).toBe('A stored');
  // Public presentation must not expose a private failure's names or full authoring backups.
  await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(alert(page).getByRole('button')).toHaveCount(0);await expect(alert(page)).not.toContainText('A memory-only');
  await page.getByRole('tab',{name:'Explore',exact:true}).click();await expect(backup).toBeVisible();
 });
 test('same revision is not permission to overwrite a stored copy during delayed startup',async({page})=>{
  const a=draft('startup-project','Stored startup',4);await page.goto('/?workspace=v3');await apply(page,a);await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  await page.addInitScript(()=>{const real=IDBFactory.prototype.open;let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});(window as unknown as {releaseStorage:()=>void}).releaseStorage=release;
   IDBFactory.prototype.open=function(...args:[string,number?]){const factory=this,fake:Record<string,unknown>={onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};let req:IDBOpenDBRequest;Object.defineProperty(fake,'result',{get:()=>req.result});Object.defineProperty(fake,'error',{get:()=>req?.error??null});void gate.then(()=>{req=real.apply(factory,args);for(const name of ['success','error','upgradeneeded','blocked'])req.addEventListener(name,event=>{const handler=fake['on'+name];if(typeof handler==='function')handler.call(fake,event);});});return fake as unknown as IDBOpenDBRequest;};});
  await page.reload();await expect(page.getByText('Opening local workspace\u2026',{exact:true})).toBeVisible();
  await apply(page,{...a,title:'Early startup draft'});await page.evaluate(()=>(window as unknown as {releaseStorage:()=>void}).releaseStorage());
  await expect(alert(page)).toContainText('stored copy differs');expect(JSON.parse(await stored(page,a.id)).title).toBe('Stored startup');
  // A further edit in the unresolved startup draft cannot silently write the stored copy either.
  await apply(page,{...a,title:'Edited unresolved draft'});await expect(alert(page)).toContainText('stored copy differs');expect(JSON.parse(await stored(page,a.id)).title).toBe('Stored startup');
  const download=page.waitForEvent('download');await alert(page).getByRole('button',{name:'Download backup',exact:true}).click();const file=await download;expect(JSON.parse(readFileSync((await file.path())!,'utf8')).title).toBe('Edited unresolved draft');
 });
});

for(const width of [1440,390])test.describe(`external deletion protection ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('a deleted stored project remains deleted while its new draft is recoverable',async({page,context})=>{
  const original=draft('externally-deleted','Stored before deletion');
  await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await apply(page,original);await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const other=await context.newPage();await other.goto('/?catalogue');
  await other.evaluate(id=>new Promise<void>((resolve,reject)=>{const r=indexedDB.open('diagramcloud-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};};}),original.id);await other.close();
  await apply(page,{...original,title:'Draft after deletion'});await expect(alert(page)).toContainText('Another tab removed');
  expect(await page.evaluate(id=>new Promise<boolean>((resolve,reject)=>{const r=indexedDB.open('diagramcloud-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,g=db.transaction('projects','readonly').objectStore('projects').get(id);g.onsuccess=()=>{db.close();resolve(g.result===undefined);};g.onerror=()=>reject(g.error);};}),original.id)).toBe(true);
  const pending=page.waitForEvent('download');await alert(page).getByRole('button',{name:'Download backup',exact:true}).click();const file=await pending;
  expect(JSON.parse(readFileSync((await file.path())!,'utf8')).title).toBe('Draft after deletion');await expect(alert(page)).toContainText('Another tab removed');
 });
});
