import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {startConceptHost,type LocalConceptHost} from '../../scripts/concept-host';
import {checkConceptSpec} from '../contracts/mosaicstudio/schema';
import {appOrigin} from '../../scripts/lib/e2ePorts';

function fixture():Project{return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-mosaic-workspace',title:'Synthetic standalone workspace',rootViewId:'root',
 sources:[{id:'fixture-source',title:'Synthetic local source',location:'fixture.ts:1',visibility:'public'}],
 nodes:[{id:'service',label:'Service',childViewId:'detail',kind:'app',sourceIds:['fixture-source']},{id:'store',label:'Store',kind:'storage'},{id:'internal',label:'Internal step',kind:'function',sourceIds:['fixture-source'],blockIds:['example']},{id:'private',label:'PRIVATE_MOSAIC_WORKSPACE',visibility:'private'}],
 edges:[{id:'write',source:'service',target:'store',label:'writes (possible)',kind:'query'}],
 views:[{id:'root',title:'Architecture',nodeIds:['service','store','private'],edgeIds:['write'],positions:{service:{x:0,y:0},store:{x:300,y:0}}},{id:'detail',title:'Inside service',nodeIds:['internal'],positions:{internal:{x:0,y:0}}}],
 blocks:[{id:'example',title:'Synthetic input/output',type:'code',language:'text',code:'input: example\noutput: illustration',provenance:'synthetic'}]}));}
async function importFixture(page:Page){await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON').fill(JSON.stringify(fixture()));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();}

test('Mosaic workspace prepares explicit audiences and returns a unique source with parent context retained',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await importFixture(page);
 await page.getByRole('button',{name:'Mosaic preview',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Mosaic preview'});
 await dialog.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();await expect(dialog.getByRole('button',{name:'Download Mosaic concept'})).toBeEnabled();
 const downloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download Mosaic concept'}).click();const text=readFileSync(await(await downloading).path(),'utf8');expect(text).not.toContain('PRIVATE_MOSAIC_WORKSPACE');expect(checkConceptSpec(JSON.parse(text)).ok).toBe(true);
 await dialog.getByLabel('Preview audience').selectOption('author');await dialog.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();await expect(dialog.getByRole('button',{name:'Return to private',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'Explore Service',exact:true}).click();await page.getByRole('button',{name:'Explore Internal step',exact:true}).click();
 await page.getByRole('button',{name:'Mosaic preview',exact:true}).click();dialog=page.getByRole('dialog',{name:'Mosaic preview'});await dialog.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();await dialog.getByRole('button',{name:'Return to internal',exact:true}).click();
 await expect(page.getByTestId('view-root')).toBeVisible();await expect(page.getByTestId('view-detail')).toBeVisible();await expect(page.getByLabel('Component label')).toHaveValue('Internal step');
 expect(errors).toEqual([]);
});

test('native local host opens from the workspace and returns only the matching current mapping',async({page})=>{
 const viewer=process.env.DIAGRAMCLOUD_MOSAIC_VIEWER;test.skip(!viewer,'Owner Mosaic standalone viewer was not selected for this host.');
 await importFixture(page);await page.getByRole('button',{name:'Mosaic preview',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Mosaic preview'});await dialog.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();
 const downloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download preview packet'}).click();const packet=JSON.parse(readFileSync(await(await downloading).path(),'utf8'));
 const host:LocalConceptHost=await startConceptHost({document:fixture(),viewId:'root',audience:'public',viewerHtml:readFileSync(viewer!),viewerSha256:process.env.DIAGRAMCLOUD_MOSAIC_VIEWER_SHA256??'62b451fd3e98a5303b88cca407be1eeff6f05c1c78eb166188df6bff0ac7670c',packet,diagramcloudOrigin:appOrigin});
 try{
  await dialog.getByText('Open the local viewer host',{exact:true}).click();await dialog.getByLabel('Local preview host URL').fill(host.url);
  const opening=page.waitForEvent('popup');await dialog.getByRole('button',{name:'Connect local preview host'}).click();const preview=await opening;
  await expect(dialog.getByRole('status')).toContainText('Local host matched this projection');await expect(preview.getByRole('status')).toContainText('Viewer accepted');
  await preview.getByRole('button',{name:/node: Store → store/}).click();await expect(dialog).toHaveCount(0);await expect(page.getByLabel('Component label')).toHaveValue('Store');await preview.close();
 }finally{await host.close();}
});

test('a public-mode transition hides an author mapping and rejects its in-flight replacement',async({page})=>{
 await importFixture(page);await page.getByRole('button',{name:'Mosaic preview',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Mosaic preview'});
 await dialog.getByLabel('Preview audience').selectOption('author');await dialog.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();await expect(dialog.getByRole('button',{name:'Return to private',exact:true})).toBeVisible();
 await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);const state=window as unknown as {releasePreviewDigest?:()=>void;restorePreviewDigest?:()=>void};state.restorePreviewDigest=()=>{crypto.subtle.digest=original;state.releasePreviewDigest?.();};crypto.subtle.digest=((algorithm:AlgorithmIdentifier,data:BufferSource)=>new Promise<ArrayBuffer>((resolve,reject)=>{state.releasePreviewDigest=()=>void original(algorithm,data).then(resolve,reject);}));});
 try{
  await dialog.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();
  await page.locator('.app-header [role=tab]').filter({hasText:'Portfolio'}).evaluate(element=>(element as HTMLElement).click());
  await expect(dialog.getByRole('button',{name:'Return to private',exact:true})).toHaveCount(0);await expect(dialog.getByLabel('Preview audience').locator('option')).toHaveText(['Public projection']);
  await page.evaluate(()=>{(window as unknown as {releasePreviewDigest?:()=>void}).releasePreviewDigest?.();});
  await expect(dialog.getByRole('button',{name:'Prepare Mosaic preview',exact:true})).toBeEnabled();await expect(dialog.getByRole('button',{name:'Return to private',exact:true})).toHaveCount(0);
 }finally{await page.evaluate(()=>{(window as unknown as {restorePreviewDigest?:()=>void}).restorePreviewDigest?.();});}
});
