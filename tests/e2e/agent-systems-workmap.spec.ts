import {test,expect,type Locator,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {Project} from '../../src/core/model';
import {agentSystemsWorkmap} from '../../src/data/agentSystemsWorkmap';

const TITLE='Agents · mémoire & travail';
const entry=(page:Page)=>page.getByRole('region',{name:'Commencer par la vue d’ensemble',exact:true});
const canvas=(page:Page,id:string)=>page.getByTestId('view-'+id);
const card=(page:Page,view:string,label:string)=>canvas(page,view).getByRole('button',{name:'Explore '+label,exact:true});
async function currentProject(page:Page):Promise<Project>{
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const d=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()) as Project;
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();return d;
}
async function tabTo(page:Page,target:Locator){
 await expect(target).toBeVisible();
 for(let i=0;i<180;i++){
  if(await target.evaluate(el=>el===document.activeElement))return;
  await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
 }
 throw new Error('Work-map control was not reached with the keyboard');
}

test('agent macro entry opens every domain with parent retained and no model mutation or provider request',async({page})=>{
 const external:string[]=[],errors:string[]=[];
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.protocol!=='data:'){
   external.push(url.href);return route.abort();
  }
  return route.continue();
 });
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?workspace=studio');
 await entry(page).getByRole('button',{name:/^Agents · mémoire & travail/}).click();
 await expect(page.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 const before=await currentProject(page);expect(before.id).toBe('agent-systems-workmap');
 for(const [label,id] of [
  ['Current assessment','baseline'],['Proposed target','target-design'],['Memory layers','memory-design'],
  ['Presentation profiles','profile-design'],['Work categories','work-design'],
  ['Factory viewpoint','factory-design'],['Evidence to establish','evidence-design']
 ]){
  await card(page,'overview',label).click();
  await expect(canvas(page,id)).toBeVisible();await expect(canvas(page,'overview')).toBeVisible();
 }
 await card(page,'overview','Presentation profiles').click();
 await card(page,'profile-design','Optional host / T3').click();
 await expect(page.getByText('Optional presentation, unchanged authority',{exact:true})).toBeVisible();
 expect(await currentProject(page)).toEqual(before);expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('ordinary import requires review, rejects bad input without mutation and exports a redacted offline work map',async({page,browser})=>{
 await page.goto('/?workspace=v3&project=retail-operations&view=overview');
 await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 const previous=await currentProject(page),source=agentSystemsWorkmap(),canary='SYNTHETIC_PRIVATE_AGENT_MAP';
 source.privateNotes=canary;
 source.blocks.push({id:'private-map-note',title:'Private draft',type:'text',text:canary,visibility:'private',sourceIds:[],provenance:'synthetic'});
 source.nodes.find(n=>n.id==='project')!.blockIds.push('private-map-note');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(source));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByRole('heading',{name:previous.title,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect(await currentProject(page)).toEqual(previous);
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(source));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 const imported=await currentProject(page),bad=structuredClone(imported);
 bad.nodes.find(n=>n.id==='archive')!.childViewId='missing-view';
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(bad));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.locator('.validation-error')).toBeVisible();
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect(await currentProject(page)).toEqual(imported);
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:/^Interactive HTML/}).click();
 const download=await pending;expect(await download.failure()).toBeNull();
 const html=readFileSync((await download.path())!,'utf8');expect(html).not.toContain(canary);
 const offline=await browser.newContext(),viewer=await offline.newPage(),requests:string[]=[],errors:string[]=[];
 await offline.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
 viewer.on('pageerror',error=>errors.push(error.message));await viewer.setContent(html);
 await expect(viewer.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 await viewer.getByRole('button',{name:'Memory layers',exact:true}).click();
 await expect(viewer.getByRole('heading',{name:'↳ Memory · layers & review',exact:true})).toBeVisible();
 expect(requests.filter(url=>!url.startsWith('data:'))).toEqual([]);expect(errors).toEqual([]);
 await offline.close();
});

test('agent entry and child view are keyboard reachable on mobile with reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?workspace=studio');
 await tabTo(page,entry(page).getByRole('button',{name:/^Agents · mémoire & travail/}));
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 await tabTo(page,card(page,'overview','Current assessment'));await page.keyboard.press('Enter');
 await expect(canvas(page,'baseline')).toBeVisible();await expect(canvas(page,'overview')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
});
