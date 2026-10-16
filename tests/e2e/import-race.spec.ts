import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';

const drawio=readFileSync('tests/fixtures/interchange/aws-serverless.drawio');
const candidate=(id:string,title:string)=>validateDocument(documentSchema.parse({schemaVersion:1,id,title,rootViewId:'root',
 nodes:[{id:'app',label:'Synthetic application',summary:'Synthetic import race fixture; runtime unknown.',basis:'unknown'}],edges:[],views:[{id:'root',title:'Synthetic scope',nodeIds:['app']}]}));

async function prepare(page:Page,id:string){
 await page.addInitScript(()=>{
  const original=File.prototype.text;
  File.prototype.text=function(){
   if(this.name!=='old.drawio')return original.call(this);
   const selected=this;
   return new Promise<string>((resolve,reject)=>{Object.assign(window,{releaseOldImportRead:async()=>{try{resolve(await original.call(selected));}catch(error){reject(error);}}});});
  };
 });
 const doc=candidate(id,'Synthetic preserved authoring project');
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const before=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));
 expect(await saved(page,before.id)).toEqual(before);return before;
}

// Read the real saved authoring document without closing or disturbing the import preview.
async function saved(page:Page,id:string):Promise<Project>{
 const json=await page.evaluate(id=>new Promise<string>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('projects','readonly'),row=tx.objectStore('projects').get(id);
   row.onsuccess=()=>typeof row.result?.json==='string'?resolve(row.result.json):reject(new Error('Expected saved authoring document'));
   row.onerror=()=>reject(row.error);tx.oncomplete=()=>db.close();
  };
 }),id);
 return validateDocument(JSON.parse(json));
}
async function hold(page:Page){
 await page.evaluate(()=>{delete(window as unknown as {releaseOldImportRead?:unknown}).releaseOldImportRead;});
 await page.getByLabel('Import document',{exact:true}).setInputFiles({name:'old.drawio',mimeType:'application/xml',buffer:drawio});
 await page.waitForFunction(()=>typeof(window as unknown as {releaseOldImportRead?:unknown}).releaseOldImportRead==='function');
 await expect(page.getByRole('status').filter({hasText:'Reading selected document…'})).toBeVisible();
}
async function release(page:Page){
 await page.evaluate(async()=>{
  await(window as unknown as {releaseOldImportRead:()=>Promise<void>}).releaseOldImportRead();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 });
}

test('a pending draw.io read blocks stale validation and applies only after its reviewed report',async({page})=>{
 const before=await prepare(page,'synthetic-import-read');await hold(page);
 for(const name of ['Validate JSON','Apply imported document','Load current JSON','New JSON Patch','New observation patch'])await expect(page.getByRole('button',{name,exact:true})).toBeDisabled();
 await expect(page.getByLabel('Project JSON',{exact:true})).toBeDisabled();await expect(page.getByLabel('Import document',{exact:true})).toBeEnabled();
 await expect(page.getByTestId('import-report')).toHaveCount(0);expect(await saved(page,before.id)).toEqual(before);
 await release(page);await expect(page.getByRole('button',{name:'Validate JSON',exact:true})).toBeEnabled();
 await expect(page.getByLabel('Project JSON',{exact:true})).toHaveValue(drawio.toString('utf8').replace(/\r\n?/g,'\n'));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();const report=page.getByTestId('import-report');
 await expect(report).toContainText('draw.io import');await expect(report).toContainText('old.drawio');await expect(report).toContainText('2 pages');
 await expect(report.getByRole('region',{name:'Not imported'})).toContainText('without a box at both ends');
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();expect(await saved(page,before.id)).toEqual(before);
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByRole('heading',{name:'old',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'Explore Serverless web app',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Lambda function',exact:true}).or(page.getByRole('button',{name:'Lambda function',exact:true})).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Explore Serverless web app',exact:true})).toBeVisible();expect(await saved(page,before.id)).toEqual(before);
});

test('a late file cannot replace a newer preview or an editor reopened after closing the pending read',async({page})=>{
 const before=await prepare(page,'synthetic-import-generation');await hold(page);
 const newer=candidate('synthetic-newer-import','Synthetic newer selection'),newerText=JSON.stringify(newer);
 await page.getByLabel('Import document',{exact:true}).setInputFiles({name:'newer.json',mimeType:'application/json',buffer:Buffer.from(newerText)});
 await expect(page.getByLabel('Project JSON',{exact:true})).toHaveValue(newerText);await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByText('Valid: Synthetic newer selection',{exact:true})).toBeVisible();
 await release(page);await expect(page.getByLabel('Project JSON',{exact:true})).toHaveValue(newerText);
 await expect(page.getByText('Valid: Synthetic newer selection',{exact:true})).toBeVisible();await expect(page.getByTestId('import-report')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();expect(await saved(page,before.id)).toEqual(before);
 // A second pending read is revoked by closing the modal, even when the same editor opens again.
 await hold(page);await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const reopened=await page.getByLabel('Project JSON',{exact:true}).inputValue();expect(validateDocument(JSON.parse(reopened))).toEqual(before);
 await release(page);await expect(page.getByLabel('Project JSON',{exact:true})).toHaveValue(reopened);
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();await expect(page.getByTestId('import-report')).toHaveCount(0);
 await expect(page.getByText('Valid: Synthetic newer selection',{exact:true})).toHaveCount(0);expect(await saved(page,before.id)).toEqual(before);
});
