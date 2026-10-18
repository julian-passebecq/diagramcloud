import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';

const privateLabel='SYNTHETIC_PRIVATE_PIN_LABEL',privateFact='SYNTHETIC_PRIVATE_PIN_FACT',privateSource='SYNTHETIC_PRIVATE_PIN_SOURCE';
function fixture(id:string):Project{return validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic Follow Pin Studio',rootViewId:'root',
 summary:'Synthetic UI references only; no external runtime facts.',nodes:[
  {id:'a',label:'Synthetic pinned A',summary:'Initial synthetic A explanation',sourceIds:['source-a'],blockIds:['evidence-a'],childViewId:'child'},
  {id:'b',label:'Synthetic active B',summary:'Initial synthetic B explanation'},
  {id:'code',label:'Synthetic child code',blockIds:['code-example']},
  {id:'hidden-pin',label:privateLabel,summary:privateFact,visibility:'private',sourceIds:['private-source'],blockIds:['private-evidence']}],edges:[],
 views:[{id:'root',title:'Synthetic parent scope',nodeIds:['a','b','hidden-pin'],positions:{a:{x:0,y:0},b:{x:300,y:0},'hidden-pin':{x:600,y:0}}},
  {id:'child',title:'Synthetic code child',nodeIds:['code'],positions:{code:{x:0,y:0}}}],
 sources:[{id:'source-a',title:'Synthetic A source',location:'synthetic/a.ts:1',visibility:'public'},{id:'private-source',title:privateSource,location:'synthetic-private-file.txt:1',visibility:'private'}],
 blocks:[{id:'evidence-a',title:'Synthetic A evidence',type:'text',text:'A permitted explanation retained by reference.',provenance:'author',sourceIds:['source-a']},
  {id:'code-example',title:'Synthetic retained code',type:'code',language:'text',code:'const SYNTHETIC_PIN_CODE = true;',provenance:'author'},
  {id:'private-evidence',title:'Private synthetic evidence',type:'text',text:privateFact,visibility:'private',provenance:'author',sourceIds:['private-source']}]}));}
const card=(page:Page,label:string)=>page.getByTestId('view-root').getByRole('button',{name:'Explore '+label,exact:true});
const context=(page:Page)=>page.getByTestId('project-context');
const mode=(page:Page)=>context(page).getByRole('status',{name:'Context follow mode'});
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;}
async function importFixture(page:Page,id:string){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(fixture(id)));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function openContext(page:Page){const toggle=page.getByRole('button',{name:'Details panel',exact:true});if(await toggle.getAttribute('aria-pressed')!=='true')await toggle.click();await expect(context(page)).toBeVisible();}
async function storedRevision(page:Page,id:string){return page.evaluate(id=>new Promise<number>((resolve,reject)=>{const opening=indexedDB.open('diagramcloud-v1',1);opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('projects','readonly'),read=tx.objectStore('projects').get(id);read.onerror=()=>reject(read.error);read.onsuccess=()=>resolve(JSON.parse(read.result.json).revision);tx.oncomplete=()=>db.close();};}),id);}

test('Pin keeps explanatory A while selection and Edit target B; saved Project and reload remain independent',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await importFixture(page,'synthetic-context-pin-browser');await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await card(page,'Synthetic pinned A').click();await openContext(page);const before=await current(page);
 await expect(mode(page)).toContainText('Following selection: Synthetic pinned A');await context(page).getByRole('button',{name:'Pin context',exact:true}).click();
 await card(page,'Synthetic active B').click();await expect(mode(page)).toContainText('Pinned scope: Synthetic pinned A');await expect(mode(page)).toContainText('Active selection: Synthetic active B');
 await expect(context(page).getByRole('heading',{name:'Synthetic pinned A',exact:true})).toBeVisible();await expect(page.getByTestId('view-root')).toBeVisible();
 await context(page).getByRole('tab',{name:'Evidence',exact:true}).click();await context(page).getByText('Manual assistance',{exact:true}).click();
 const pending=page.waitForEvent('download');await context(page).getByRole('button',{name:'Download context',exact:true}).click();const download=await pending;
 expect(download.suggestedFilename()).toBe(before.id+'.context.json');const target=testInfo.outputPath('pinned-selected-context.json');await download.saveAs(target);
 const manual=JSON.parse(readFileSync(target,'utf8'));expect(manual.format).toBe('diagramcloud.selected-context/1');expect(manual.projectRevision).toBe(before.revision);
 expect(manual.selection).toEqual({nodeId:'a',viewId:'root'});expect(manual.components.map((n:{id:string})=>n.id)).toEqual(['a']);expect(manual.evidence.map((b:{id:string})=>b.id)).toEqual(['evidence-a']);
 expect(await current(page),'pinning, navigation and manual download do not edit authoring JSON').toEqual(before);
 await context(page).getByRole('tab',{name:'Details',exact:true}).click();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await expect(page.getByLabel('Component label',{exact:true})).toHaveValue('Synthetic active B');
 await page.getByLabel('Component summary',{exact:true}).fill('Explicit synthetic B edit');await page.getByRole('button',{name:'Apply component',exact:true}).click();
 const edited=await current(page);expect(edited.nodes.find(n=>n.id==='a')).toEqual(before.nodes.find(n=>n.id==='a'));expect(edited.nodes.find(n=>n.id==='b')!.summary).toBe('Explicit synthetic B edit');expect(edited.observations).toEqual([]);
 await expect(mode(page)).toContainText('Pinned scope: Synthetic pinned A');await expect(mode(page)).toContainText('current document revision '+edited.revision);
 await page.getByRole('tab',{name:'Explore',exact:true}).click();await context(page).getByRole('button',{name:'Follow selection',exact:true}).click();await expect(mode(page)).toContainText('Following selection: Synthetic active B');
 await card(page,'Synthetic pinned A').click();await context(page).getByRole('button',{name:'Pin context',exact:true}).click();
 await context(page).getByRole('button',{name:'Open pinned child view',exact:true}).click();await expect(page.getByTestId('view-root')).toBeVisible();await expect(page.getByTestId('view-child')).toBeVisible();
 await expect(mode(page)).toContainText('Pinned scope: Synthetic pinned A');
 await expect.poll(()=>storedRevision(page,edited.id)).toBe(edited.revision);await page.reload();
 await page.locator('.project-card').filter({hasText:'Synthetic Follow Pin Studio'}).click();
 await card(page,'Synthetic active B').click();await openContext(page);await expect(mode(page)).toContainText('Following selection: Synthetic active B');
 await expect(context(page).getByRole('button',{name:'Pin context',exact:true})).toHaveAttribute('aria-pressed','false');expect(await current(page)).toEqual(edited);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await context(page).getByRole('button',{name:'Pin context',exact:true}).focus();await page.keyboard.press('Enter');await expect(context(page).getByRole('button',{name:'Pin context',exact:true})).toHaveAttribute('aria-pressed','true');
 await context(page).screenshot({path:testInfo.outputPath('context-pin-narrow.png')});expect(errors).toEqual([]);
});

test('public projection revokes a private pin without disclosure; project switch starts Follow',async({page})=>{
 await page.goto('/');await importFixture(page,'synthetic-context-pin-privacy');await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await card(page,privateLabel).click();await openContext(page);const before=await current(page);
 await context(page).getByRole('button',{name:'Pin context',exact:true}).click();await card(page,'Synthetic active B').click();
 await expect(mode(page)).toContainText('Pinned scope: '+privateLabel);await context(page).getByRole('tab',{name:'Evidence',exact:true}).click();await expect(context(page)).toContainText(privateSource);
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(mode(page)).toContainText('Pinned context unavailable in the current permitted scope.');
 for(const value of [privateLabel,privateFact,privateSource,'synthetic-private-file.txt'])await expect(page.locator('body')).not.toContainText(value);
 await expect(context(page).getByRole('button',{name:'Download context',exact:true})).toHaveCount(0);await expect(context(page).getByRole('tab',{name:'Evidence',exact:true})).toBeDisabled();
 await page.getByRole('tab',{name:'Explore',exact:true}).click();await expect(mode(page)).toContainText('Pinned context unavailable');
 await expect(context(page).getByRole('heading',{name:'Source provenance',exact:true})).toHaveCount(0);
 await context(page).getByRole('button',{name:'Follow selection',exact:true}).click();await expect(mode(page)).toContainText('Following selection: Synthetic active B');expect(await current(page)).toEqual(before);
 await context(page).getByRole('button',{name:'Pin context',exact:true}).click();await importFixture(page,'synthetic-context-pin-other-project');
 await expect(mode(page)).toContainText('Following selection: Synthetic parent scope');await expect(context(page).getByRole('button',{name:'Pin context',exact:true})).toHaveAttribute('aria-pressed','false');
});
