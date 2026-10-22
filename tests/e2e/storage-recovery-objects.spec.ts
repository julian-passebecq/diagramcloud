import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument} from '../../src/core/model';

const id='object-recovery';
const repaired=()=>validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic object recovery',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:[],sources:[]}));
async function put(page:Page,kind:'json'|'metadata',value='original'){
 await page.evaluate(({id,kind,value})=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('projects','readwrite');
   tx.objectStore('projects').put(kind==='json'?{id,json:{broken:[value,{retained:true}]},writer:'synthetic-writer',savedAt:1}:{id,json:'{broken',writer:{invalid:['writer']},savedAt:{invalid:'generation'}});
   tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};
  };
 }),{id,kind,value});
}
async function stored(page:Page){
 return page.evaluate(id=>new Promise<{json:unknown;writer:unknown;savedAt:unknown}|null>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,read=db.transaction('projects','readonly').objectStore('projects').get(id);read.onsuccess=()=>{db.close();resolve(read.result??null);};read.onerror=()=>{db.close();reject(read.error);};};
 }),id);
}
async function recovery(page:Page,kind:'json'|'metadata'){
 await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 await put(page,kind);await page.reload();await page.getByRole('button',{name:'Recovery (1)',exact:true}).click();
 return page.getByRole('region',{name:'Unreadable saved projects'});
}

for(const width of [1440,390])test.describe(`structured-cloned recovery rows ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('an unchanged non-text row can be backed up and explicitly deleted',async({page})=>{
  const panel=await recovery(page,'json');await expect(panel.getByRole('button',{name:'Open in JSON editor',exact:true})).toBeDisabled();
  const downloading=page.waitForEvent('download');await panel.getByRole('button',{name:'Download raw copy',exact:true}).click();const file=await downloading;
  expect(await file.failure()).toBeNull();expect(JSON.parse(readFileSync((await file.path())!,'utf8')).json).toEqual({broken:['original',{retained:true}]});
  await panel.getByRole('button',{name:'Delete from this browser…',exact:true}).click();await panel.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await expect(page.getByText('Every saved project in this browser loads normally. Nothing needs recovery.',{exact:true})).toBeVisible();expect(await stored(page)).toBeNull();
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Recovery \(/})).toHaveCount(0);
 });
 test('a nested replacement after confirmation keeps the newer row intact',async({page})=>{
  const panel=await recovery(page,'json');await panel.getByRole('button',{name:'Delete from this browser…',exact:true}).click();await put(page,'json','newer');
  await panel.getByRole('button',{name:'Delete permanently',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('stored project changed');
  expect((await stored(page))?.json).toEqual({broken:['newer',{retained:true}]});await expect(panel.getByRole('button',{name:'Keep it',exact:true})).toBeVisible();
 });
 test('object-valued metadata can be explicitly repaired and reopened',async({page})=>{
  const panel=await recovery(page,'metadata');await panel.getByRole('button',{name:'Open in JSON editor',exact:true}).click();
  await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(repaired()));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();const saved=await stored(page);expect(typeof saved?.writer).toBe('string');expect(Number.isSafeInteger(saved?.savedAt)).toBe(true);expect(JSON.parse(saved?.json as string).title).toBe('Synthetic object recovery');
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Recovery \(/})).toHaveCount(0);expect((await stored(page))?.json).toBe(saved?.json);
 });
});
