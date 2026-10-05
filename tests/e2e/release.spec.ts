import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import JSZip from 'jszip';

/*
 * V1 release acceptance, in the order a user meets the product:
 *  1. Gallery → project → architecture → drilldown → inspect → task workspace → evidence → edit → save → reload → present → export
 *  2. Galaxy publication snapshot → preview → apply → review → public → shareable → presentation and exports
 *  3. Visual qualification at desktop, laptop, dark, reduced motion and phone widths (no horizontal overflow)
 */
mkdirSync('test-results/release',{recursive:true});
const noOverflow=async(page:Page)=>{const d=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(d.scroll).toBeLessThanOrEqual(d.width+2);};
async function download(page:Page,name:RegExp,file:string){const wait=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name}).click();const d=await wait;expect(await d.failure()).toBeNull();await d.saveAs(`test-results/release/${file}`);return `test-results/release/${file}`;}

test('user journey: gallery to export, with the parent architecture kept and the edit surviving a reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();
 // Architecture → drill down: the parent view stays above the child.
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await expect(page.getByTestId('view-overview')).toBeVisible();await expect(page.getByTestId('view-validation')).toBeVisible();
 // Inspect: the DataPass grammar, then the task workspace, then back to the evidence.
 await expect(page.locator('.inspector-grammar .inspector-group > .eyebrow')).toHaveText(['IDENTITY','MEANING','REALIZATION','EVIDENCE','WORK','PUBLICATION']);
 await page.getByRole('button',{name:'Open task workspace',exact:true}).click();
 const workspace=page.getByRole('dialog',{name:'Evidence workspace pilot'});await expect(workspace).toBeVisible();
 await workspace.getByRole('button',{name:'Close dialog'}).click();await expect(workspace).toHaveCount(0);
 await expect(page.getByTestId('view-validation')).toBeVisible();
 await page.getByRole('button',{name:'Explore Required fields',exact:true}).click();
 await expect(page.locator('.evidence-section h2')).toHaveText('Required fields');
 await page.screenshot({path:'test-results/release/journey-explore.png',fullPage:true});
 // Edit → save → reload.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByLabel('Component label').fill('Required fields (reviewed)');await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Required fields (reviewed)',exact:true})).toBeVisible();
 // Present → export.
 await page.getByRole('tab',{name:'Present',exact:true}).click();
 await expect(page.locator('.story-bar')).toBeVisible();
 await page.screenshot({path:'test-results/release/journey-present.png',fullPage:true});
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const html=readFileSync(await download(page,/^Interactive HTML/,'journey.html'),'utf8');
 expect(html).toContain('Required fields (reviewed)');
 expect(errors).toEqual([]);
});

/** A reviewed Galaxy projection from another app: one verified claim about the TotalEnergies "checks" component. */
const snapshot={
 schema_version:1,snapshot_id:'datapass-vscode:total:r12',producer:{app_id:'datapass-vscode',product_version:'0.26.0',source_revision:'4ad1f4d0c0ffee'},
 subject:{schema_version:1,entity_id:'galaxy:datapass-vscode:project:total',owner_app:'datapass-vscode',entity_type:'project',local_id:'total',aliases:[],metadata:{}},
 created_at:'2026-10-04T09:00:00Z',review:{state:'reviewed',reviewed_at:'2026-10-04T09:05:00Z',human_confirmed:true,intended_visibility:'internal'},
 entities:[
  {schema_version:1,entity_id:'galaxy:datapass-vscode:project:total',owner_app:'datapass-vscode',entity_type:'project',local_id:'total',aliases:[],metadata:{},label:'TotalEnergies controls',visibility:'internal'},
  {schema_version:1,entity_id:'galaxy:datapass-vscode:component:quality',owner_app:'datapass-vscode',entity_type:'component',local_id:'quality',aliases:['galaxy:diagramcloud:node:checks'],metadata:{},label:'Quality checks',visibility:'internal'}
 ],
 relationships:[],evidence_refs:[],
 realization_claims:[{claim_id:'ci-quality-green',subject_entity_id:'galaxy:datapass-vscode:component:quality',state:'verified',observed_at:'2026-10-04T08:30:00Z',producer_app:'datapass-vscode',authority:'GitHub Actions workflow quality',summary:'Quality workflow passed on the reference dataset.',caveat:'Reference dataset only',evidence_ref_ids:[],review_state:'reviewed'}],
 contract_versions:['galaxy.entity/1','galaxy.evidence-ref/1','galaxy.publication-snapshot/1']
};

test('Galaxy snapshot: preview, apply, review, present, share, and the reviewed claim survives SVG, HTML and PowerPoint',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON').fill(JSON.stringify(snapshot));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByTestId('snapshot-note')).toContainText('datapass-vscode owns these facts');
 await expect(page.getByTestId('snapshot-note')).toContainText('1 claim staged as private, unreviewed observations');
 await expect(page.getByRole('region',{name:'Proposed changes'})).toContainText('GitHub Actions workflow quality');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();

 // Applied but private and unreviewed: no badge in any public output yet.
 const checks=page.getByRole('button',{name:'Explore SQL quality checks',exact:true});
 await expect(checks.locator('.node-realization')).toHaveText('Verified · 2026-10-04');
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 expect(readFileSync(await download(page,/^SVG diagram/,'before-review.svg'),'utf8')).not.toContain('data-realization');
 await page.getByRole('button',{name:'Close dialog'}).click();

 await page.getByRole('tab',{name:'Edit',exact:true}).click();await checks.click();
 const card=page.locator('[data-testid^="observation-obs-galaxy-ci-quality-green"]');
 await expect(card).toContainText('Not reviewed · private');
 await card.getByRole('button',{name:'Mark reviewed',exact:true}).click();
 await card.getByRole('combobox').selectOption('public');
 await card.getByRole('checkbox').check();
 await expect(card).toContainText('Presented');await expect(card).toContainText('Shareable in index');

 await page.getByRole('tab',{name:'Present',exact:true}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const svg=readFileSync(await download(page,/^SVG diagram/,'presented.svg'),'utf8');
 expect(svg).toContain('data-realization="verified"');expect(svg).toContain('reviewed, public observations');
 const html=readFileSync(await download(page,/^Interactive HTML/,'presented.html'),'utf8');
 expect(html).toContain('Quality workflow passed on the reference dataset.');expect(html).toMatch(/data-realization=\\?"verified/);
 const pptx=await JSZip.loadAsync(readFileSync(await download(page,/^Editable PowerPoint/,'presented.pptx')));
 const xml=(await Promise.all(Object.keys(pptx.files).filter(f=>/^ppt\/(slides|notesSlides)\/.*\.xml$/.test(f)).map(f=>pptx.file(f)!.async('string')))).join('\n');
 expect(xml).toContain('>Verified<');expect(xml).toContain('GitHub Actions workflow quality');expect(xml).toContain('Caveat: Reference dataset only');
 await download(page,/^PNG image/,'presented.png');
 expect(errors).toEqual([]);
});

for(const v of [
 {name:'desktop-light',width:1440,height:1000,scheme:'light' as const,reduced:false},
 {name:'laptop-dark',width:1280,height:800,scheme:'dark' as const,reduced:false},
 {name:'laptop-reduced-motion',width:1366,height:768,scheme:'light' as const,reduced:true},
 {name:'phone',width:390,height:844,scheme:'light' as const,reduced:false}
]){
 test(`visual qualification: ${v.name}`,async({browser})=>{
  const context=await browser.newContext({viewport:{width:v.width,height:v.height},colorScheme:v.scheme,reducedMotion:v.reduced?'reduce':'no-preference'});
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?project=total-project-controls&view=validation&node=mandatory');
  await expect(page.getByTestId('view-validation')).toBeVisible();
  if(v.scheme==='dark')await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await noOverflow(page);
  // Header actions and the Inspector stay reachable: nothing clipped off-screen to the right.
  for(const name of ['JSON / AI','Export & share']){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box,name).not.toBeNull();expect(box!.x+box!.width).toBeLessThanOrEqual(v.width+1);}
  await page.screenshot({path:`test-results/release/${v.name}.png`,fullPage:true});
  await page.getByRole('tab',{name:'Edit',exact:true}).click();await noOverflow(page);
  await page.screenshot({path:`test-results/release/${v.name}-edit.png`,fullPage:false});
  expect(errors).toEqual([]);await context.close();
 });
}
