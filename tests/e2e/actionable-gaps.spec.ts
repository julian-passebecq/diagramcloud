import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {stageCockpitSnapshot,proposeVerificationSpec,validateVerificationSpec} from '../../src/intelligence/verification';

const output=resolve('test-results/actionable-gaps'),folder=resolve('test-results/actionable-gaps-input');
const privateGuide='private-advice-guide.md';
test.beforeAll(()=>{
 mkdirSync(output,{recursive:true});mkdirSync(folder,{recursive:true});
 writeFileSync(resolve(folder,privateGuide),'# Synthetic private source\n[Runtime receipt](missing-runtime.md)\n');
});

async function snapshot(page:Page):Promise<Project>{
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;
}
async function syntheticProject(page:Page,id:string){
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic diagnostic advice',rootViewId:'root',
  nodes:[{id:'app',label:'Synthetic application',summary:'Runtime and deployment unknown.',basis:'unknown'}],edges:[],
  views:[{id:'root',title:'Synthetic scope',nodeIds:['app']}]}));
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function authoringExport(page:Page,fileName:string){
 await page.getByRole('button',{name:'Export & share',exact:true}).click();const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:/^Authoring JSON/}).click();const file=await pending;expect(await file.failure()).toBeNull();
 const target=resolve(output,fileName);await file.saveAs(target);await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 return validateDocument(JSON.parse(readFileSync(target,'utf8')));
}

for(const kind of ['denied','generic'] as const){
 test(`selected-file ${kind} failure offers only producer-supported advice without mutating the document`,async({page})=>{
  const fileName=kind==='denied'?'denied-source.ts':'unclassified-source.ts',marker='PRIVATE_READER_EXCEPTION_DETAIL';
  await page.addInitScript(({fileName,kind,marker})=>{
   const original=File.prototype.arrayBuffer;
   // Identical permission-like private text must not classify a plain Error as a denied permission.
   File.prototype.arrayBuffer=function(){return this.name===fileName?Promise.reject(kind==='denied'?new DOMException('Permission denied: '+marker,'NotAllowedError'):new Error('Permission denied: '+marker)):original.call(this);};
  },{fileName,kind,marker});
  await syntheticProject(page,'synthetic-'+kind+'-advice');const before=await snapshot(page);
  await page.getByRole('button',{name:'Business overview',exact:true}).click();const panel=page.getByLabel('Configured source analysis',{exact:true});await panel.locator('summary').first().click();
  await panel.getByLabel('Select analysis source files',{exact:true}).setInputFiles({name:fileName,mimeType:'text/typescript',buffer:Buffer.from('export const synthetic=1;')});
  await expect(panel.getByRole('alert')).toContainText('Selected file read failed: '+fileName);
  const guidance=panel.getByLabel('Source analysis failure guidance',{exact:true});
  await expect(guidance).toContainText('Reason: '+(kind==='denied'?'access-denied':'unclassified'));
  if(kind==='denied')await expect(guidance).toContainText('Request access through the source owner or choose another authorized source.');
  else{await expect(guidance).not.toContainText('access-denied');await expect(guidance).not.toContainText('Request access');await expect(guidance).not.toContainText('Next step:');}
  await expect(panel).not.toContainText(marker);await expect(panel.getByRole('button',{name:'Build configured source bundle',exact:true})).toBeDisabled();
  expect(await snapshot(page)).toEqual(before);expect(await authoringExport(page,kind+'.authoring.private.json')).toEqual(before);
  await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(page.locator('body')).not.toContainText(fileName);await expect(page.locator('body')).not.toContainText(marker);
  await expect(page.getByLabel('Configured source analysis',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Source analysis failure guidance',{exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Explore',exact:true}).click();const freshPanel=page.getByLabel('Configured source analysis',{exact:true});await freshPanel.locator('summary').first().click();
  await expect(freshPanel.getByRole('status')).toContainText('No files selected.');await expect(freshPanel.getByRole('alert')).toHaveCount(0);await expect(freshPanel).not.toContainText(fileName);expect(await snapshot(page)).toEqual(before);
 });
}

test('an unresolved selected document link retains exact citation and safe advice without inventing source absence',async({page})=>{
 await page.goto('/');await page.locator('.header-actions').getByRole('button',{name:'New analysis',exact:true}).click();
 await page.getByLabel('Analysis repository folder',{exact:true}).setInputFiles(folder);await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 const before=await snapshot(page);await page.getByRole('button',{name:'Structure',exact:true}).click();const structure=page.getByLabel('Structure output',{exact:true});
 const sourceRow=structure.getByRole('listitem').filter({hasText:privateGuide+':2'});await expect(sourceRow).toContainText('Relative link has no authorized target in the selected document set.');
 await expect(sourceRow).toContainText('Cause: unclassified');await expect(sourceRow).toContainText('Review the selected scope and supply an authorized source if available.');
 const inventory=await structure.locator('p').filter({hasText:'files read from'}).innerText();
 const details=page.getByRole('button',{name:'Details panel',exact:true});if(await details.getAttribute('aria-pressed')!=='true')await details.click();
 const context=page.getByTestId('project-context');await context.getByRole('tab',{name:'Gaps',exact:true}).click();
 const contextRow=context.getByRole('listitem').filter({hasText:privateGuide+':2'});await expect(contextRow).toContainText('Cause: unclassified');await expect(contextRow).toContainText('Suggested next step:');
 await expect(contextRow.getByRole('button')).toHaveCount(0);expect(await snapshot(page)).toEqual(before);expect(await authoringExport(page,'document-advice.authoring.private.json')).toEqual(before);
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(page.locator('body')).not.toContainText(privateGuide);await expect(page.getByRole('heading',{name:'Document diagnostics',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Structure output',{exact:true})).not.toContainText(inventory);await expect(page.getByLabel('Structure output',{exact:true})).toContainText('Private source inventories are omitted.');
});

for(const destination of ['Portfolio','Explore'] as const){
test(`a valid late cockpit proposal cannot open review after leaving Edit for ${destination}`,async({page})=>{
 await page.addInitScript(()=>{
  const original=File.prototype.text;
  File.prototype.text=function(){
   if(this.name!=='late-cockpit.json')return original.call(this);
   const selected=this;
   return new Promise<string>((resolve,reject)=>{Object.assign(window,{releaseLateCockpit:async()=>{try{resolve(await original.call(selected));}catch(error){reject(error);}}});});
  };
 });
 await syntheticProject(page,'synthetic-late-cockpit');await page.getByRole('tab',{name:'Edit',exact:true}).click();const before=await snapshot(page);
 const captured=new Date(Date.now()-1000),cockpit={format:'diagramcloud.cockpit-snapshot',version:1,id:'synthetic-late',sourceApp:'synthetic-host',authority:'Synthetic race-test fixture; no real verification',capturedAt:captured.toISOString(),expiresAt:new Date(captured.getTime()+3600000).toISOString(),permission:{selectedProjectId:before.id,dataAccessGranted:true,scope:'selected-project'},observations:[{id:'synthetic-candidate',nodeId:'app',sourceRevision:'a'.repeat(40),summary:'Synthetic external candidate for a stale-read test; never applied or reviewed.',claim:'observed'}]};
 // Ensure an invalid payload cannot make the negative UI assertion pass accidentally. This remains a review patch, never an authored observation.
 const staged=stageCockpitSnapshot(before,cockpit);expect(staged.state).toBe('REQUIRES_AUTHOR_REVIEW');expect(staged.patch.operations.some(op=>op.path.startsWith('/observations/'))).toBe(true);
 await page.getByRole('button',{name:'Business overview',exact:true}).click();await page.getByText('Work and verification brief · external check review',{exact:true}).click();
 await page.getByLabel('Select host-fed cockpit snapshot',{exact:true}).setInputFiles({name:'late-cockpit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cockpit))});
 await page.waitForFunction(()=>typeof(window as unknown as {releaseLateCockpit?:()=>Promise<void>}).releaseLateCockpit==='function');
 await page.getByRole('tab',{name:destination,exact:true}).click();await expect(page.getByLabel('Select host-fed cockpit snapshot',{exact:true})).toHaveCount(0);
 await page.evaluate(async()=>{await(window as unknown as {releaseLateCockpit:()=>Promise<void>}).releaseLateCockpit();await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));});
 await expect(page.getByRole('dialog')).toHaveCount(0);const after=await snapshot(page);expect(after).toEqual(before);expect(after.observations).toEqual([]);
});
}

test('a newly proposed NOT_RUN check supersedes a valid pending spec file without changing the authoring document',async({page})=>{
 await page.addInitScript(()=>{
  const original=File.prototype.text;
  File.prototype.text=function(){
   if(this.name!=='old-verification-spec.json')return original.call(this);
   const selected=this;
   return new Promise<string>((resolve,reject)=>{Object.assign(window,{releaseOldVerificationSpec:async()=>{try{resolve(await original.call(selected));}catch(error){reject(error);}}});});
  };
 });
 await syntheticProject(page,'synthetic-spec-generation');await page.getByRole('tab',{name:'Edit',exact:true}).click();const before=await snapshot(page);
 const old=proposeVerificationSpec(before,{id:'old-file-checks',repositories:[{id:'old-repository',repository:'synthetic/old-fixture',commit:'a'.repeat(40)}],checks:[{id:'old-check',nodeId:'app',repositoryId:'old-repository',question:'Synthetic old requested check?',expected:'External evidence required; no execution.',kind:'test'}]});
 await page.getByRole('button',{name:'Business overview',exact:true}).click();await page.getByText('Work and verification brief · external check review',{exact:true}).click();
 await page.getByLabel('Select verification spec',{exact:true}).setInputFiles({name:'old-verification-spec.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
 await page.waitForFunction(()=>typeof(window as unknown as {releaseOldVerificationSpec?:unknown}).releaseOldVerificationSpec==='function');
 await page.getByLabel('Exact verification repository',{exact:true}).fill('synthetic/new-selected-fixture');await page.getByLabel('Verification source commit',{exact:true}).fill('b'.repeat(40));
 await page.getByLabel('Verification component',{exact:true}).selectOption('app');await page.getByLabel('External check ID',{exact:true}).fill('new-selected-check');
 await page.getByRole('button',{name:'Propose NOT_RUN check',exact:true}).click();await expect(page.getByText(/Spec selected-checks · PROPOSED/)).toBeVisible();
 await page.evaluate(async()=>{await(window as unknown as {releaseOldVerificationSpec:()=>Promise<void>}).releaseOldVerificationSpec();await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
 await expect(page.getByText(/Spec selected-checks · PROPOSED/)).toBeVisible();await expect(page.getByText(/Spec old-file-checks · PROPOSED/)).toHaveCount(0);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download proposed verification spec',exact:true}).click();const download=await pending;
 expect(await download.failure()).toBeNull();const target=resolve(output,'latest-proposed-spec.json');await download.saveAs(target);
 const current=validateVerificationSpec(JSON.parse(readFileSync(target,'utf8')),before);expect(current.id).toBe('selected-checks');expect(current.repositories).toEqual([{id:'selected-repository',repository:'synthetic/new-selected-fixture',commit:'b'.repeat(40)}]);
 expect(current.checks).toHaveLength(1);expect(current.checks[0]).toMatchObject({id:'new-selected-check',nodeId:'app',result:'NOT_RUN'});expect(await snapshot(page)).toEqual(before);
});
