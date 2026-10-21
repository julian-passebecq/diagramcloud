import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument} from '../../src/core/model';

const project=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'recovery-delete',title:'Synthetic recovery deletion',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:[],sources:[]}));
async function put(page:Page,json:string|null,mode:'replace'|'retain-writer'='replace'){
 await page.evaluate(({json,mode})=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');
   if(json===null)store.delete('recovery-delete');
   else if(mode==='retain-writer'){const read=store.get('recovery-delete');read.onsuccess=()=>store.put({...read.result,json});}
   else store.put({id:'recovery-delete',json,writer:'synthetic-recovery-writer',savedAt:1});
   tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};
  };
 }),{json,mode});
}
async function stored(page:Page):Promise<string|null>{
 return page.evaluate(()=>new Promise<string|null>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,read=db.transaction('projects','readonly').objectStore('projects').get('recovery-delete');read.onsuccess=()=>{db.close();resolve(read.result?.json??null);};read.onerror=()=>{db.close();reject(read.error);};};
 }));
}
async function recovery(page:Page){
 await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 await put(page,'{broken');await page.reload();await page.getByRole('button',{name:'Recovery (1)',exact:true}).click();
 return page.getByRole('region',{name:'Unreadable saved projects'});
}
async function apply(page:Page,doc:unknown){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
}
for(const width of [1440,390])test.describe(`guarded storage deletion ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('a replacement arriving after delete confirmation opens is preserved byte for byte',async({page,context})=>{
  const panel=await recovery(page),replacement=JSON.stringify({...project(),title:'Newer recovered synthetic project'});
  await panel.getByRole('button',{name:'Delete from this browser…',exact:true}).click();
  const other=await context.newPage();await other.goto('/?catalogue');await put(other,replacement);await other.close();
  await panel.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await expect(panel.getByRole('alert')).toContainText('stored project changed');expect(await stored(page)).toBe(replacement);
  await expect(page.getByRole('button',{name:'Recovery (1)',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Recovery \(/})).toHaveCount(0);expect(await stored(page)).toBe(replacement);
 });
 test('a disappearance after confirmation is not reported as a successful deletion',async({page})=>{
  const panel=await recovery(page);await panel.getByRole('button',{name:'Delete from this browser…',exact:true}).click();await put(page,null);
  await panel.getByRole('button',{name:'Delete permanently',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('stored project was removed');
  await expect(panel.getByRole('button',{name:'Keep it',exact:true})).toBeVisible();expect(await stored(page)).toBeNull();
 });
 test('explicit deletion still removes the unchanged unreadable row and survives reload',async({page})=>{
  const panel=await recovery(page);await panel.getByRole('button',{name:'Delete from this browser…',exact:true}).click();await panel.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await expect(page.getByText('Every saved project in this browser loads normally. Nothing needs recovery.',{exact:true})).toBeVisible();expect(await stored(page)).toBeNull();
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Recovery \(/})).toHaveCount(0);expect(await stored(page)).toBeNull();
 });
 test('reusing the current writer cannot overwrite changed stored bytes and the draft remains recoverable',async({page})=>{
  await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();const original=project();await apply(page,original);await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const replacement=JSON.stringify({...original,title:'Restored disk copy'});await put(page,replacement,'retain-writer');await apply(page,{...original,title:'Unsaved author draft'});
  const alert=page.getByRole('alert').filter({hasText:'Local save needs attention'});await expect(alert).toContainText('Another tab changed');expect(await stored(page)).toBe(replacement);
  const downloading=page.waitForEvent('download');await alert.getByRole('button',{name:'Download backup',exact:true}).click();const file=await downloading;expect(await file.failure()).toBeNull();
  expect(JSON.parse(readFileSync((await file.path())!,'utf8')).title).toBe('Unsaved author draft');await expect(alert).toBeVisible();expect(await stored(page)).toBe(replacement);
 });
});
