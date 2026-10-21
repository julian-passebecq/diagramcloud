import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument,MAX_DOCUMENT_BYTES} from '../../src/core/model';

/** Synthetic private notes close to the UTF-8 limit; the project remains structurally valid. */
function nearLimit(){
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'storage-size-boundary',title:'Synthetic size boundary',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:Array.from({length:84},(_,i)=>({id:`note-${i}`,type:'text',title:'Synthetic evidence',text:'界'.repeat(50000),provenance:'synthetic',visibility:'private'})),sources:[]}));
 const excess=Buffer.byteLength(JSON.stringify(doc),'utf8')-(MAX_DOCUMENT_BYTES-1000),last=doc.blocks.at(-1)!;
 if(last.type!=='text')throw new Error('Synthetic fixture must end in a text block');
 last.text=last.text.slice(0,-Math.ceil(excess/3));
 return validateDocument(doc);
}
async function stored(page:Page){
 return page.evaluate(()=>new Promise<string>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,read=db.transaction('projects','readonly').objectStore('projects').get('storage-size-boundary');read.onsuccess=()=>{db.close();resolve(read.result.json);};read.onerror=()=>{db.close();reject(read.error);};};
 }));
}
for(const width of [1440,390])test.describe(`UTF-8 save boundary ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('an oversized form edit preserves the saved copy and backup; Undo restores a saveable draft',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const doc=nearLimit(),text=JSON.stringify(doc);expect(Buffer.byteLength(text,'utf8')).toBeLessThan(MAX_DOCUMENT_BYTES);
  expect(Buffer.byteLength(JSON.stringify({...doc,summary:'界'.repeat(1000)}),'utf8')).toBeGreaterThan(MAX_DOCUMENT_BYTES);
  await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(text);
  await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();const before=await stored(page);
  await page.getByRole('tab',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Inspector',exact:true}).click();
  await page.getByLabel('Summary',{exact:true}).fill('界'.repeat(1000));await page.getByRole('button',{name:'Apply project',exact:true}).click();
  const alert=page.getByRole('alert').filter({hasText:'Local save needs attention'});await expect(alert).toContainText('12 MiB');expect(await stored(page)).toBe(before);
  const pending=page.waitForEvent('download');await alert.getByRole('button',{name:'Download backup',exact:true}).click();const file=await pending;
  expect(await file.failure()).toBeNull();const backup=JSON.parse(readFileSync((await file.path())!,'utf8'));expect(backup.summary).toBe('界'.repeat(1000));expect(backup.blocks).toHaveLength(84);
  await expect(alert).toBeVisible();expect(await stored(page)).toBe(before);
  // A repository-format download must report the same bound, without an uncaught exception.
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByRole('button',{name:'Download diagramcloud.json',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'JSON / AI workspace'}).getByRole('alert')).toContainText('12 MiB');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await expect(alert).toHaveCount(0);expect(await stored(page)).toBe(before);
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Recovery \(/})).toHaveCount(0);
  expect(await stored(page)).toBe(before);expect(errors).toEqual([]);
 });
});
