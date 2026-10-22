import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {parseDocument,MAX_DOCUMENT_BYTES} from '../../src/core/model';
import {authoringBoundaryProject} from '../fixtures/authoring-boundary';

async function importFile(page:Page,raw:string){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Import document',{exact:true}).setInputFiles({name:'synthetic.authoring.json',mimeType:'application/json',buffer:Buffer.from(raw)});
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByText('Valid: Synthetic authoring boundary',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}

for(const width of [1440,390])test.describe(`Authoring backup roundtrip ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('a saved near-limit project validates current JSON and reimports its complete authoring backup',async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const doc=authoringBoundaryProject(),raw=JSON.stringify(doc);
  expect(Buffer.byteLength(raw)).toBeLessThan(MAX_DOCUMENT_BYTES);
  expect(Buffer.byteLength(JSON.stringify(doc,null,2))).toBeGreaterThan(MAX_DOCUMENT_BYTES);
  await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await importFile(page,raw);
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
  await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByText('Valid: Synthetic authoring boundary',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Load current JSON',exact:true}).click();
  await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByText('Valid: Synthetic authoring boundary',{exact:true})).toBeVisible();
  expect(parseDocument(await page.getByLabel('Project JSON',{exact:true}).inputValue())).toEqual(doc);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Export & share',exact:true}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:/^Authoring JSON/}).click();const file=await pending;
  expect(await file.failure()).toBeNull();const backup=readFileSync((await file.path())!,'utf8');
  expect(Buffer.byteLength(backup)).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES);expect(parseDocument(backup)).toEqual(doc);
  const fresh=await browser.newContext({baseURL:new URL('/',page.url()).href,viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
  try{
   const target=await fresh.newPage();target.on('pageerror',error=>errors.push(error.message));
   await target.goto('/?workspace=v3');await expect(target.getByText('Local workspace ready',{exact:true})).toBeVisible();await importFile(target,backup);
   await target.reload();await expect(target.getByText('Local workspace ready',{exact:true})).toBeVisible();
   await target.goto('/?workspace=v3&project='+doc.id);await expect(target.getByText('Local workspace ready',{exact:true})).toBeVisible();
   await target.getByRole('button',{name:'JSON / AI',exact:true}).click();
   expect(parseDocument(await target.getByLabel('Project JSON',{exact:true}).inputValue())).toEqual(doc);
   expect(errors).toEqual([]);
  }finally{await fresh.close();}
 });
});
