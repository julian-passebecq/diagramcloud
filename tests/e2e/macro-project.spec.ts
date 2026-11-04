import {test,expect,type Locator,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {Project} from '../../src/core/model';
import {retailOperations} from '../../src/data/retailOperations';

const TITLE='Retail · opérations & échanges';
const METADATA='Métadonnées & sens métier';
const entry=(page:Page)=>page.getByRole('region',{name:'Commencer par la vue d’ensemble',exact:true});
const canvas=(page:Page,id:string)=>page.getByTestId('view-'+id);
const card=(page:Page,view:string,label:string)=>canvas(page,view).getByRole('button',{name:'Explore '+label,exact:true});
async function currentProject(page:Page):Promise<Project>{
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const project=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()) as Project;
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();return project;
}
async function tabTo(page:Page,target:Locator,max=180){
 await expect(target).toBeVisible();
 for(let i=0;i<max;i++){
  if(await target.evaluate(element=>element===document.activeElement))return;
  await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.activeElement!==document.body),'Tab keeps focus on a control').toBe(true);
 }
 throw new Error('Macro control was not reached with the keyboard');
}

test('retail macro entry opens one canonical project and keeps the overview when drilling into its domains',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?workspace=studio');
 await expect(entry(page)).toBeVisible();
 await entry(page).getByRole('button',{name:/^Retail · opérations/}).click();
 await expect(page.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 await expect(canvas(page,'overview')).toBeVisible();
 const before=await currentProject(page);
 expect(before.id).toBe('retail-operations');expect(before.views).toHaveLength(5);
 expect(before.observations).toEqual([]);
 for(const [label,view] of [
  ['Fichiers & interfaces','retail-exchanges'],
  ['Du besoin au changement','retail-workflow'],
  ['Qui fait quoi ?','retail-responsibilities-view'],
  ['Évolution & pistes IA','retail-ai-opportunities']]){
  await card(page,'overview',label).click();
  await expect(canvas(page,view)).toBeVisible();
  await expect(canvas(page,'overview')).toBeVisible();
  await expect(card(page,view,METADATA)).toBeVisible();
 }
 expect(await currentProject(page),'changing perspective never rewrites the shared project').toEqual(before);
 expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/macro-retail-domains.png',fullPage:true});
});

test('one component edit updates both views, Undo and reload preserve identity, and a rejected import changes nothing',async({page})=>{
 await page.goto('/?workspace=v3&project=retail-operations&view=overview');
 await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await card(page,'overview','Fichiers & interfaces').click();
 await card(page,'retail-exchanges',METADATA).click();
 const before=await currentProject(page),renamed='Métadonnées · clarification QA';
 await page.getByLabel('Component label',{exact:true}).fill(renamed);
 await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(card(page,'overview',renamed)).toBeVisible();
 await expect(card(page,'retail-exchanges',renamed)).toBeVisible();
 let updated=await currentProject(page);
 expect(updated.nodes.filter(node=>node.id==='retail-metadata')).toHaveLength(1);
 expect(updated.views.filter(view=>view.nodeIds.includes('retail-metadata'))).toHaveLength(5);
 expect(updated.revision).toBe(before.revision+1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(card(page,'overview',METADATA)).toBeVisible();
 await expect(card(page,'retail-exchanges',METADATA)).toBeVisible();
 await page.getByRole('button',{name:'Redo',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();
 await expect(card(page,'retail-exchanges',renamed)).toBeVisible();
 updated=await currentProject(page);
 expect(updated.nodes.find(node=>node.id==='retail-metadata')!.label).toBe(renamed);
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill('{"schemaVersion":9000}');
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.locator('.validation-error')).toBeVisible();
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect(await currentProject(page)).toEqual(updated);
});

test('macro launchers preserve Foil drilldown and open the general catalogue independently',async({page,context})=>{
 await page.goto('/?workspace=studio');
 await entry(page).getByRole('button',{name:/^Foil · cloud/}).click();
 await expect(page.getByRole('heading',{name:'Foil’O Écologie',exact:true})).toBeVisible();
 await card(page,'overview','Site and machine inputs').click();
 await expect(canvas(page,'hydrofoil')).toBeVisible();
 await expect(canvas(page,'overview')).toBeVisible();
 await page.getByRole('button',{name:'Project gallery',exact:true}).click();
 const link=entry(page).getByRole('link',{name:/^Catalogue général/});
 await expect(link).toHaveAttribute('href','?catalogue');
 // A new tab keeps an editor draft in its owning tab; no source content is transferred.
 await expect(link).toHaveAttribute('target','_blank');
 const opened=context.waitForEvent('page');await link.click();const cataloguePage=await opened;
 await cataloguePage.waitForLoadState('domcontentloaded');
 const catalogue=cataloguePage.getByRole('region',{name:'Learning catalogue',exact:true});
 await expect(catalogue.getByRole('status',{name:'Learning catalogue results'})).toHaveText('Showing 36 of 36 catalogue entries.');
 await expect(cataloguePage.getByRole('note').first()).toContainText('No project is open.');
 await expect(page.getByRole('heading',{name:'Foil’O Écologie',exact:true})).toBeVisible();
 await cataloguePage.close();
 await entry(page).getByRole('button',{name:/Décrire un nouveau projet/}).click();
 await expect(page.getByRole('dialog',{name:'Start project analysis',exact:true})).toBeVisible();
});

test('retail public HTML retains illustrative scope and drilldown offline while excluding private evidence',async({page,browser})=>{
 const source=retailOperations(),canary='SYNTHETIC_MACRO_PRIVATE_EVIDENCE';
 source.privateNotes=canary;
 source.blocks.push({id:'retail-private-note',title:'Private preparation',type:'text',text:canary,visibility:'private',sourceIds:[],provenance:'synthetic'});
 source.nodes.find(node=>node.id==='retail-controls')!.blockIds.push('retail-private-note');
 await page.goto('/?workspace=studio');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(source));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:/^Interactive HTML/}).click();
 const downloaded=await pending;expect(await downloaded.failure()).toBeNull();
 const html=readFileSync((await downloaded.path())!,'utf8');
 expect(html).not.toContain(canary);
 expect(html).toContain('modèle illustratif');
 expect(html).toContain('pas des flux constatés');
 const offline=await browser.newContext(),viewer=await offline.newPage(),requests:string[]=[],errors:string[]=[];
 await offline.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
 viewer.on('pageerror',error=>errors.push(error.message));
 await viewer.setContent(html);
 await expect(viewer.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 await viewer.getByRole('button',{name:'Fichiers & interfaces',exact:true}).click();
 await expect(viewer.getByRole('heading',{name:'↳ Échanges · applications, fichiers & API',exact:true})).toBeVisible();
 await expect(viewer.getByText('pas des flux constatés',{exact:false}).first()).toBeVisible();
 await viewer.screenshot({path:'test-results/macro-retail-offline.png',fullPage:true});
 expect(requests.filter(url=>!url.startsWith('data:'))).toEqual([]);expect(errors).toEqual([]);
 await offline.close();
});

test('macro entry and retail drilldown are keyboard reachable at 390px with reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?workspace=studio');
 const retail=entry(page).getByRole('button',{name:/^Retail · opérations/});
 await tabTo(page,retail);await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:TITLE,exact:true})).toBeVisible();
 await tabTo(page,card(page,'overview','Fichiers & interfaces'));await page.keyboard.press('Enter');
 await expect(canvas(page,'retail-exchanges')).toBeVisible();
 await expect(canvas(page,'overview')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
 await page.screenshot({path:'test-results/macro-retail-mobile.png',fullPage:true});
});
