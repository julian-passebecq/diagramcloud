import {test,expect,type Page} from '@playwright/test';
import {documentSchema,validateDocument} from '../../src/core/model';

const recovered=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'generation-recovery',title:'Synthetic generation recovery',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:[],sources:[]}));
async function writeRow(page:Page,json:string,generation:'nan'|'infinity'|'text'|'valid'){
 await page.evaluate(({json,generation})=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('projects','readwrite');
   const savedAt=generation==='nan'?NaN:generation==='infinity'?Infinity:generation==='text'?'corrupt':2;
   tx.objectStore('projects').put({id:'generation-recovery',json,writer:'synthetic-recovery-writer',savedAt});
   tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};
  };
 }),{json,generation});
}
async function readRow(page:Page){
 return page.evaluate(()=>new Promise<{json:string;savedAt:number}>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,get=db.transaction('projects','readonly').objectStore('projects').get('generation-recovery');
   get.onsuccess=()=>{db.close();resolve(get.result);};get.onerror=()=>{db.close();reject(get.error);};
  };
 }));
}
async function recovery(page:Page,generation:'nan'|'infinity'|'text'|'valid'){
 await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 await writeRow(page,'{broken',generation);await page.reload();
 await page.getByRole('button',{name:'Recovery (1)',exact:true}).click();
 return page.getByRole('region',{name:'Unreadable saved projects'});
}

for(const width of [1440,390])test.describe(`recovery generation and source identity ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 for(const generation of ['nan','infinity','text'] as const)test(`${generation} timestamp repairs to a reopenable native row`,async({page})=>{
  const panel=await recovery(page,generation);
  await panel.getByRole('button',{name:'Open in JSON editor',exact:true}).click();
  await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(recovered()));
  await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
  await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const saved=await readRow(page);expect(Number.isSafeInteger(saved.savedAt)).toBe(true);expect(JSON.parse(saved.json).title).toBe('Synthetic generation recovery');
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Recovery \(/})).toHaveCount(0);
  expect((await readRow(page)).json).toBe(saved.json);
 });
 test('a newer row cannot be adopted through an older recovery warning',async({page})=>{
  const panel=await recovery(page,'valid'),newer=JSON.stringify({...recovered(),title:'Newer synthetic recovered copy'});
  await writeRow(page,newer,'valid');
  await panel.getByRole('button',{name:'Open in JSON editor',exact:true}).click();
  await expect(panel.getByRole('alert')).toContainText('stored recovery row changed');
  expect((await readRow(page)).json).toBe(newer);
  await expect(page.getByLabel('Project JSON',{exact:true})).toHaveCount(0);
 });
});
