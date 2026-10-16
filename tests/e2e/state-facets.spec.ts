import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {observationPatch,type ObservationInput} from '../../src/core/realization';

const title='Synthetic independent source states';
const sentinel='SYNTHETIC_PRIVATE_VERIFICATION_FACET';
const privateScope='SYNTHETIC_PRIVATE_VERIFICATION_SCOPE';
const code='const SYNTHETIC_CODE_REMAINS = true;';
function fixture(id:string):Project{return validateDocument(documentSchema.parse({schemaVersion:1,id,title,rootViewId:'root',summary:'Synthetic browser fixture only; no deployment or runtime verification.',
 nodes:[{id:'app',label:'Synthetic service',summary:'A synthetic component with an implementation child.',status:'idle',basis:'planned',childViewId:'implementation'},
  {id:'code',label:'Synthetic implementation',summary:'Authored synthetic example; never executed.',basis:'planned',blockIds:['sample-code']}],edges:[],
 views:[{id:'root',title:'Synthetic parent architecture',nodeIds:['app'],positions:{app:{x:0,y:0}}},{id:'implementation',title:'Synthetic code child',nodeIds:['code'],positions:{code:{x:0,y:0}},perspective:'code'}],
 blocks:[{id:'sample-code',type:'code',title:'Synthetic retained code',language:'text',code,provenance:'author'}]}));}
const claim=(id:string,facet:NonNullable<ObservationInput['stateFacet']>['facet'],value:string,scope:string,sourceApp:string,observedAt:string,over:Partial<ObservationInput>={}):ObservationInput=>({
 id,nodeId:'app',sourceApp,authority:'Synthetic '+sourceApp+' fixture owner',observedAt,sourceRevision:'synthetic-source-'+id,claim:'observed',summary:'Synthetic dated source claim; no code executed.',
 caveat:'Synthetic browser fixture, not a real deployment or business result.',stateFacet:{facet,value,scope},...over
});
const claims=[
 claim('lifecycle-frozen','lifecycle','FROZEN','release-ui-1','synthetic-lifecycle','2026-10-14T08:00:00Z',{claim:'verified'}),
 claim('distribution-deployed','distribution','DEPLOYED','production','synthetic-distribution','2026-10-14T09:00:00Z'),
 claim('selection-not-selected','selection','NOT_SELECTED','development','synthetic-selection','2026-10-14T10:00:00Z'),
 claim('private-verification','verification',sentinel,privateScope,'synthetic-private-verifier','2026-10-14T11:00:00Z',{claim:'verified'})
];
const cancelled=claim('lifecycle-cancelled','lifecycle','CANCELLED','release-ui-1','synthetic-lifecycle','2026-10-14T12:00:00Z');
const service=(page:Page)=>page.getByTestId('view-root').getByRole('button',{name:'Explore Synthetic service',exact:true});
const facet=(page:Page,axis:string)=>page.locator('.side-panel details.state-facets').locator(`[data-state-facet="${axis}"]`);

async function current(page:Page):Promise<Project>{
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;
}
async function stored(page:Page,id:string):Promise<Project>{
 const json=await page.evaluate(id=>new Promise<string>((resolve,reject)=>{
  const opening=indexedDB.open('diagramcloud-v1',1);opening.onerror=()=>reject(opening.error);
  opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('projects','readonly'),reading=tx.objectStore('projects').get(id);
   reading.onerror=()=>reject(reading.error);reading.onsuccess=()=>typeof reading.result?.json==='string'?resolve(reading.result.json):reject(new Error('Expected saved synthetic project'));
   tx.oncomplete=()=>db.close();};
 }),id);return validateDocument(JSON.parse(json));
}
async function prepare(page:Page,id:string){
 const initial=fixture(id);expect(initial.observations).toEqual([]);
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(initial));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByText('Valid: '+title,{exact:true})).toBeVisible();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:title,level:1,exact:true})).toBeVisible();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await service(page).click();await expect(page.getByTestId('view-root')).toBeVisible();await expect(page.getByTestId('view-implementation')).toBeVisible();
 return initial;
}
async function addThroughReview(page:Page,external:ObservationInput,present:boolean){
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByRole('button',{name:'New observation patch',exact:true}).click();
 const editor=page.getByLabel('Project JSON',{exact:true}),template=JSON.parse(await editor.inputValue());
 expect([template.format,template.target,template.operations[1].path]).toEqual(['diagramcloud.patch','project','/observations/-']);
 const patch=observationPatch({id:template.targetId,revision:template.baseRevision},external);
 await editor.fill(JSON.stringify(patch));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 const review=page.getByRole('region',{name:'Proposed changes'});
 for(const value of [external.stateFacet!.facet,external.stateFacet!.value,external.stateFacet!.scope,external.sourceApp,external.observedAt,external.sourceRevision])await expect(review).toContainText(value);
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 const card=page.getByTestId('observation-'+external.id);
 await expect(card).toContainText('Not reviewed · private');await expect(card.getByLabel('Visibility of observation '+external.id)).toBeDisabled();
 // This is the synthetic fixture author's explicit UI decision, never a producer-set reviewed flag.
 await card.getByRole('button',{name:'Mark reviewed',exact:true}).click();
 if(present){await card.getByLabel('Visibility of observation '+external.id).selectOption('public');await expect(card).toContainText('Presented');}
 else await expect(card).toContainText('Reviewed · private');
 await expect(service(page).locator('.node-realization')).toHaveText('Designed');
}
async function addInitialClaims(page:Page){for(const external of claims)await addThroughReview(page,external,external.id!=='private-verification');}

test('independent source states preserve reviewed history, parent/code and saved identity after cancellation',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const initial=await prepare(page,'synthetic-state-facets-history');
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await expect(page.locator('.side-panel details.state-facets')).toHaveJSProperty('open',false);
 await addInitialClaims(page);await page.getByRole('tab',{name:'Explore',exact:true}).click();
 const states=page.locator('.side-panel details.state-facets');await expect(states).toHaveJSProperty('open',true);
 await expect(facet(page,'lifecycle')).toContainText('FROZEN');await expect(facet(page,'distribution')).toContainText('DEPLOYED');
 await expect(facet(page,'selection')).toContainText('NOT_SELECTED');await expect(facet(page,'selection')).toContainText('Scope: development');
 await expect(facet(page,'runtime')).toHaveText(/Runtime.*Unknown · no typed source claim/);
 for(const external of claims.slice(0,3))for(const value of [external.sourceApp,external.authority,external.observedAt,external.sourceRevision,'Scope: '+external.stateFacet!.scope])await expect(facet(page,external.stateFacet!.facet)).toContainText(value);
 await expect(service(page).locator('.node-realization')).toHaveText('Designed');
 const realization=page.locator('.side-panel').getByRole('group',{name:'Realization',exact:true});await expect(realization).toContainText('Not verified by a source app');
 await page.getByRole('button',{name:'Details panel',exact:true}).click();
 const context=page.getByTestId('project-context');await context.getByRole('tab',{name:'Details',exact:true}).click();
 await expect(context.locator('details.state-facets')).toHaveJSProperty('open',true);
 await expect(context.locator('[data-state-facet="lifecycle"]')).toContainText('Scope: release-ui-1');
 await expect(context.locator('[data-state-facet="distribution"]')).toContainText('Scope: production');
 await expect(context.locator('[data-state-facet="runtime"]')).toContainText('Unknown · no typed source claim');
 await page.getByRole('button',{name:'Details panel',exact:true}).click();
 await addThroughReview(page,cancelled,true);await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await expect(facet(page,'lifecycle').locator('li strong')).toHaveText(['CANCELLED','FROZEN']);
 await expect(facet(page,'lifecycle')).toContainText(cancelled.observedAt);await expect(facet(page,'lifecycle')).toContainText(claims[0].observedAt);
 await expect(facet(page,'selection')).toContainText('NOT_SELECTED');
 const before=await current(page);expect(before.observations).toHaveLength(5);
 for(const key of ['nodes','edges','views','blocks','sources','story'] as const)expect(before[key]).toEqual(initial[key]);
 await expect.poll(async()=>(await stored(page,before.id)).revision).toBe(before.revision);
 await page.reload();await page.locator('.project-card').filter({hasText:title}).click();await expect(page.getByRole('heading',{name:title,level:1,exact:true})).toBeVisible();
 expect(await current(page)).toEqual(before);await page.getByRole('tab',{name:'Explore',exact:true}).click();await service(page).click();
 await expect(facet(page,'lifecycle').locator('li strong')).toHaveText(['CANCELLED','FROZEN']);
 await expect(service(page).locator('.node-realization')).toHaveText('Designed');
 await page.screenshot({path:testInfo.outputPath('state-facets-reopened.png'),fullPage:true});
 await page.getByTestId('view-implementation').getByRole('button',{name:'Explore Synthetic implementation',exact:true}).click();
 await expect(page.getByTestId('view-root')).toBeVisible();await expect(page.getByTestId('view-implementation')).toBeVisible();
 await expect(page.locator('.evidence-section')).toContainText(code);expect(await current(page)).toEqual(before);expect(errors).toEqual([]);
});

test('Portfolio and offline HTML show only public scoped source claims without leaking private verification',async({page,browser},testInfo)=>{
 await prepare(page,'synthetic-state-facets-public');await addInitialClaims(page);const before=await current(page);
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await service(page).click();
 await expect(page.locator('body')).not.toContainText(sentinel);await expect(page.locator('body')).not.toContainText(privateScope);
 await expect(facet(page,'verification')).toContainText('Unknown · no typed source claim');await expect(facet(page,'runtime')).toContainText('Unknown · no typed source claim');
 await expect(facet(page,'lifecycle')).toContainText('FROZEN');await expect(facet(page,'distribution')).toContainText('DEPLOYED');
 await expect(service(page).locator('.node-realization')).toHaveText('Designed');
 await page.getByRole('button',{name:'Export & share',exact:true}).click();const waiting=page.waitForEvent('download');
 await page.getByRole('button',{name:/^Interactive HTML/}).click();const download=await waiting;expect(await download.failure()).toBeNull();
 const target=testInfo.outputPath('state-facets.public.html');await download.saveAs(target);const html=readFileSync(target,'utf8');
 for(const value of [sentinel,privateScope,'synthetic-private-verifier'])expect(html).not.toContain(value);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await current(page)).toEqual(before);
 const offline=await browser.newContext({offline:true});
 try{
  const view=await offline.newPage(),requests:string[]=[],errors:string[]=[];view.on('pageerror',error=>errors.push(error.message));
  await view.route('**/*',route=>{requests.push(route.request().url());return route.abort();});await view.setContent(html);
  await expect(view.getByRole('heading',{name:title,level:1,exact:true})).toBeVisible();
  await view.locator('[data-node-id="app"]').click();const evidence=view.getByRole('complementary',{name:'Component evidence'});
  await expect(evidence).toContainText('lifecycle: FROZEN (scope: release-ui-1)');await expect(evidence).toContainText('distribution: DEPLOYED (scope: production)');
  await expect(evidence).toContainText('selection: NOT_SELECTED (scope: development)');
  for(const external of claims.slice(0,3))for(const value of [external.sourceApp,external.authority,external.observedAt,external.sourceRevision])await expect(evidence).toContainText(value);
  for(const value of [sentinel,privateScope,'synthetic-private-verifier'])await expect(view.locator('body')).not.toContainText(value);
  await view.locator('[data-node-id="code"]').click();await expect(evidence).toContainText(code);await expect(view.locator('[data-node-id="app"]')).toBeVisible();
  await view.screenshot({path:testInfo.outputPath('state-facets-offline.png'),fullPage:true});expect(requests).toEqual([]);expect(errors).toEqual([]);
 }finally{await offline.close();}
});
