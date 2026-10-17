import {readFileSync} from 'node:fs';
import {test,expect,type Locator,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {reviewChoice} from '../../src/core/decisionReview';

// This synthetic fixture supplies authored design/evidence only. No observations,
// review decisions, actual execution or real client assertions are manufactured.
const privateMarker='SYNTHETIC_PRIVATE_GUIDANCE_INSTANCE';
const privateSourceId='private-instance-source';
const privateDraft='synthetic-private-guidance-prefix';
function fixture(id:string):Project{return validateDocument(documentSchema.parse({
 schemaVersion:1,id,revision:7,title:'Synthetic pattern guidance reference',category:'Reference',rootViewId:'root',
 summary:'Synthetic teaching fixture; no deployment, benchmark or runtime result.',
 nodes:[
  {id:'raw',label:'Declared input',kind:'storage',basis:'planned',tags:['fabric'],sourceIds:['instance-source']},
  {id:'refinement',label:'Refinement stage',kind:'process',basis:'planned',tags:['databricks'],sourceIds:['instance-source'],childViewId:'inside'},
  {id:'entry',label:'Entry point',kind:'function',basis:'planned',sourceIds:['instance-source'],blockIds:['entry-note']},
  {id:'private-stage',label:privateMarker,kind:'process',basis:'planned',sourceIds:[privateSourceId],visibility:'private'}
 ],
 edges:[{id:'flow',source:'raw',target:'refinement',basis:'planned'},{id:'private-flow',source:'refinement',target:'private-stage',basis:'planned',visibility:'private'}],
 views:[
  {id:'root',title:'Synthetic declared pipeline',description:'Supplied input and refinement responsibilities, not a trace.',perspective:'data',nodeIds:['raw','refinement','private-stage'],edgeIds:['flow','private-flow'],positions:{raw:{x:0,y:0},refinement:{x:320,y:0},'private-stage':{x:640,y:0}}},
  {id:'inside',title:'Synthetic execution detail',description:'Authored entry-point questions; nothing runs.',perspective:'cicd',nodeIds:['entry'],positions:{entry:{x:0,y:0}}}
 ],
 blocks:[{id:'entry-note',title:'Synthetic entry-point questions',type:'text',text:'Input: explicitly supplied arguments. Output: an authored result contract. Constraint: runtime, attempt and recovery are UNKNOWN; no execution is evidenced.',provenance:'synthetic',sourceIds:['instance-source']}],
 sources:[{id:'instance-source',title:'Synthetic instance declaration',location:'Authored browser fixture; not a provider source or execution receipt',url:'https://example.invalid/synthetic-instance'},
  {id:privateSourceId,title:privateMarker,location:privateMarker,visibility:'private'}]
}));}

async function authoringText(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const value=await page.getByLabel('Project JSON',{exact:true}).inputValue();
 validateDocument(JSON.parse(value));
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 return value;
}
async function importFixture(page:Page,id:string){
 const input=fixture(id);
 await page.goto('/');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(input));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const before=await authoringText(page);
 expect(JSON.parse(before)).toEqual(input);
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const panel=page.getByLabel('Recipe and pattern workbench',{exact:true});
 await expect(panel).toBeVisible();
 return {before,panel};
}
async function disclosure(owner:Locator,name:string){
 const summary=owner.locator('summary').filter({hasText:name});
 await expect(summary).toHaveCount(1);
 const details=summary.locator('..');
 if(!await details.evaluate(element=>(element as HTMLDetailsElement).open))await summary.click();
 return details;
}
async function cards(panel:Locator){
 await disclosure(panel,'More view recipes and unavailable capabilities');
 const catalog=await disclosure(panel,'Illustrative architecture pattern catalog');
 const medallion=await disclosure(catalog,'Authored guidance · lakehouse-medallion');
 const jobs=await disclosure(panel,'Authored guidance · spark-production');
 return {catalog,medallion,jobs};
}
async function sourceLink(card:Locator,title:string,href:string){
 const link=card.getByRole('link',{name:title,exact:true});
 await expect(link).toHaveAttribute('href',href);
 await expect(link).toHaveAttribute('target','_blank');
 await expect(link).toHaveAttribute('rel','noopener noreferrer');
 // Assert href only: never navigate to, fetch or probe external documentation.
}

test('native reference shows useful authored guidance, exact source links and existing detail without authoring mutation',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const {before,panel}=await importFixture(page,'synthetic-guidance-journey');
 const origin=new URL(page.url()).origin,externalRequests:string[]=[];
 page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)externalRequests.push(request.url());});
 const {catalog,medallion,jobs}=await cards(panel);
 await expect(catalog).toContainText('Project-wide comparison within the supplied projection');
 await expect(catalog).toContainText('repository/environment preview selectors do not constrain pattern recognition');
 await expect(medallion.locator('..')).toContainText(privateSourceId);
 for(const card of [medallion,jobs]){
  for(const name of ['Problem','Conditions to assess','Contraindications','Alternatives','Tradeoffs','Questions by level','Limits','Static documentation sources'])await expect(card.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(card).toContainText('applicability UNKNOWN / not assessed');
  await expect(card).toContainText('Content revision 2026-10-15.1 · packet reviewed 2026-10-14');
  await expect(card).toContainText('retrieved 2026-10-15');
  await expect(card).toContainText('external revision UNKNOWN');
  await expect(card).toContainText('does not establish a mapping');
  await expect(card).not.toContainText(privateSourceId);
  await expect(card).not.toContainText('Synthetic instance declaration');
 }
 await expect(medallion).toContainText('three physical copies');
 await expect(jobs).toContainText('orchestrated notebook');
 await expect(jobs).toContainText('shared package and thin job entry point');
 await expect(jobs).toContainText('SQL transformation');
 await expect(jobs).toContainText('Never conclude notebooks are inherently bad or jobs inherently reliable');
 const requirements=await disclosure(jobs.locator('..'),'Why this view? Preview requirements');
 await expect(requirements).toContainText('Perspectives: cicd.');
 await expect(requirements).toContainText('Relationships: needed for complete view.');
 await expect(requirements).toContainText('Missing facts stay unknown.');
 await sourceLink(medallion,'Understand medallion architecture for Fabric with OneLake','https://learn.microsoft.com/en-us/fabric/onelake/onelake-medallion-lakehouse-architecture');
 await sourceLink(medallion,'Microsoft Fabric decision guide: Choose between Warehouse and Lakehouse','https://learn.microsoft.com/en-us/fabric/fundamentals/decision-guide-lakehouse-warehouse');
 await sourceLink(jobs,'Use a Python wheel file in Lakeflow Jobs','https://docs.databricks.com/aws/en/jobs/how-to/use-python-wheels-in-workflows');
 await sourceLink(jobs,'How to create an Apache Spark job definition in Fabric','https://learn.microsoft.com/en-us/fabric/data-engineering/create-spark-job-definition');
 await sourceLink(jobs,'Databricks IDE extension','https://docs.databricks.com/aws/en/dev-tools/vscode-ext/');
 await expect(medallion).toContainText('page updated 2026-07-17');
 await expect(jobs).toContainText('page updated 2025-12-05');
 await expect(panel.locator('details[open] > summary').filter({hasText:'Authored guidance ·'})).toHaveCount(2);
 await medallion.screenshot({path:info.outputPath('medallion-authored-card.png')});
 await jobs.screenshot({path:info.outputPath('jobs-authored-alternatives.png')});
 expect(await authoringText(page)).toBe(before);
 await jobs.locator('..').getByRole('button',{name:'Open existing view',exact:true}).click();
 await expect(page.getByTestId('view-root')).toBeVisible();
 await page.getByTestId('view-root').getByRole('button',{name:'Explore Refinement stage',exact:true}).click();
 await expect(page.getByTestId('view-root')).toBeVisible();
 await expect(page.getByTestId('view-inside')).toBeVisible();
 await page.getByTestId('view-inside').getByRole('button',{name:'Explore Entry point',exact:true}).click();
 await page.getByRole('button',{name:'Details panel',exact:true}).click();
 const context=page.getByTestId('project-context');
 await context.getByRole('tab',{name:'Evidence',exact:true}).click();
 await expect(context).toContainText('Synthetic entry-point questions');
 await expect(context).toContainText('synthetic');
 await expect(context).toContainText('Synthetic instance declaration');
 await context.screenshot({path:info.outputPath('existing-native-detail-context.png')});
 expect(await authoringText(page)).toBe(before);
 expect(externalRequests).toEqual([]);expect(errors).toEqual([]);
});

test('public modes redact private instance facts and clear transient author workbench settings without changing the Project',async({page},info)=>{
 const {before,panel}=await importFixture(page,'synthetic-guidance-boundaries');
 for(const mode of ['Portfolio','Present'] as const){
  const {catalog}=await cards(panel);await expect(catalog).toContainText(privateSourceId);
  await disclosure(panel,'Advanced analysis parameters');
  await panel.getByRole('combobox',{name:'Audience',exact:true}).selectOption('technical');
  await panel.getByLabel('Analysis path prefixes',{exact:true}).fill(privateDraft);
  await expect(panel.getByLabel('Analysis path prefixes',{exact:true})).toHaveValue(privateDraft);
  await page.getByRole('tab',{name:mode,exact:true}).click();
  await expect(panel).toBeVisible();
  await expect(page.locator('body')).not.toContainText(privateMarker);
  await expect(panel).not.toContainText(privateSourceId);
  await expect(panel.locator('details[open] > summary').filter({hasText:'Authored guidance ·'})).toHaveCount(0);
  await disclosure(panel,'Advanced analysis parameters');
  await expect(panel.getByRole('combobox',{name:'Audience',exact:true})).toHaveValue('mixed');
  await expect(panel.getByLabel('Analysis path prefixes',{exact:true})).toHaveValue('');
  const publicCards=await cards(panel);
  await expect(publicCards.medallion).toContainText('applicability UNKNOWN / not assessed');
  await expect(publicCards.medallion).not.toContainText(privateMarker);
  await expect(publicCards.catalog).toContainText('instance-source');
  await publicCards.medallion.screenshot({path:info.outputPath(mode.toLowerCase()+'-guidance-public.png')});
  await page.getByRole('tab',{name:'Edit',exact:true}).click();
  await disclosure(panel,'Advanced analysis parameters');
  await expect(panel.getByRole('combobox',{name:'Audience',exact:true})).toHaveValue('mixed');
  await expect(panel.getByLabel('Analysis path prefixes',{exact:true})).toHaveValue('');
  const authorCards=await cards(panel);await expect(authorCards.catalog).toContainText(privateSourceId);
  expect(await authoringText(page)).toBe(before);
 }
});

test('selected cards remain readable at 390px without opening every legacy entry or overflowing horizontally',async({page},info)=>{
 const {before,panel}=await importFixture(page,'synthetic-guidance-mobile');
 await page.setViewportSize({width:390,height:844});
 const {medallion,jobs}=await cards(panel);
 await expect(panel.locator('details[open] > summary').filter({hasText:'Authored guidance ·'})).toHaveCount(2);
 for(const [name,card] of [['medallion',medallion],['jobs',jobs]] as const){
  await expect(card.getByRole('heading',{name:'Alternatives',exact:true})).toBeVisible();
  const dimensions=await card.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth,bodyFont:Number.parseFloat(getComputedStyle(element.querySelector('p')!).fontSize)}));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.bodyFont).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await card.screenshot({path:info.outputPath(name+'-guidance-390px.png')});
 }
 expect(await authoringText(page)).toBe(before);
});


test('three new reference cards expose bounded choices and exact documentation without selecting a view or mutating canonical facts',async({page},info)=>{
 const {before,panel}=await importFixture(page,'synthetic-three-catalogue-cards'),origin=new URL(page.url()).origin,externalRequests:string[]=[];
 page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)externalRequests.push(request.url());});
 const catalog=await disclosure(panel,'Illustrative architecture pattern catalog');
 const topics=[['c4','System context diagram | C4 model','https://c4model.com/diagrams/system-context','UNKNOWN'],['modular-monolith','Common web application architectures','https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures','2023-03-07'],['event-driven','Event-driven architecture style','https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven','2026-03-07']] as const;
 for(const [topic,title,url,pageUpdated] of topics){
  const summary=catalog.locator('summary').filter({hasText:'Authored guidance · '+topic});await summary.focus();await page.keyboard.press('Enter');const card=summary.locator('..');await expect(card).toHaveAttribute('open','');
  for(const heading of ['Problem','Conditions to assess','Contraindications','Alternatives','Tradeoffs','Questions by level','Limits','Static documentation sources'])await expect(card.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  await expect(card).toContainText('applicability UNKNOWN / not assessed');await expect(card).toContainText('Content revision 2026-10-15.1 · packet reviewed 2026-10-14');await expect(card).toContainText('retrieved 2026-10-15');await expect(card).toContainText('page updated '+pageUpdated);await expect(card).toContainText('external revision UNKNOWN');await expect(card).toContainText('Synthetic example: input');await expect(card).not.toContainText(privateMarker);await expect(card).not.toContainText(privateSourceId);await expect(card).not.toContainText('Synthetic instance declaration');await sourceLink(card,title,url);
  await expect(card.getByRole('button')).toHaveCount(0);await expect(panel).toBeVisible();expect(await authoringText(page)).toBe(before);await summary.click();
 }
 await page.setViewportSize({width:390,height:844});const small=await disclosure(catalog,'Authored guidance · c4');const text=await small.innerText();await expect(small.getByRole('heading',{name:'Alternatives',exact:true})).toBeVisible();const dimensions=await small.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth}));expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await small.screenshot({path:info.outputPath('c4-authored-guidance-390.png')});
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(panel.locator('details[open] > summary').filter({hasText:'Authored guidance ·'})).toHaveCount(0);const publicCatalog=await disclosure(panel,'Illustrative architecture pattern catalog'),publicCard=await disclosure(publicCatalog,'Authored guidance · c4');expect(await publicCard.innerText()).toBe(text);await expect(publicCatalog).not.toContainText(privateSourceId);await expect(page.locator('body')).not.toContainText(privateMarker);expect(await authoringText(page)).toBe(before);
 await page.getByRole('tab',{name:'Edit',exact:true}).click();await expect(panel.locator('details[open] > summary').filter({hasText:'Authored guidance ·'})).toHaveCount(0);expect(await authoringText(page)).toBe(before);expect(externalRequests).toEqual([]);
});


test('catalogue display filters find static questions and cards without changing scope, profiles or canonical facts',async({page},info)=>{
 const {before,panel}=await importFixture(page,'synthetic-catalogue-display-filters');
 await disclosure(panel,'Advanced analysis parameters');await panel.getByLabel('View purpose',{exact:true}).selectOption('audit');await panel.getByRole('combobox',{name:'Audience',exact:true}).selectOption('technical');await panel.getByLabel('Analysis path prefixes',{exact:true}).fill(privateDraft);
 const profileText=async()=>{const pending=page.waitForEvent('download');await panel.getByRole('button',{name:'Download validated analysis profile',exact:true}).click();const path=await(await pending).path();expect(path).not.toBeNull();return readFileSync(path!,'utf8');};
 const profileBefore=await profileText(),search=panel.getByRole('searchbox',{name:'Search catalogue',exact:true}),type=panel.getByRole('combobox',{name:'Catalogue entry type',exact:true}),guidance=panel.getByRole('combobox',{name:'Detailed guidance',exact:true}),results=panel.getByRole('status',{name:'Catalogue filter results',exact:true});
 await expect(results).toHaveText('View recipes: 7 of 7 · Illustrative patterns: 5 of 5.');await type.selectOption('pattern');await guidance.selectOption('supplied');await search.fill(' C4 ');await expect(search).toBeFocused();
 const catalog=await disclosure(panel,'Illustrative architecture pattern catalog');await expect(catalog.locator(':scope > ul > li')).toHaveCount(1);await expect(catalog).toContainText('Illustrative pattern · version 1 · not-established');await expect(results).toHaveText('View recipes: 0 of 7 · Illustrative patterns: 1 of 5.');
 const card=await disclosure(catalog,'Authored guidance · c4');await sourceLink(card,'System context diagram | C4 model','https://c4model.com/diagrams/system-context');await expect(card).toContainText('applicability UNKNOWN / not assessed');await expect(panel).toBeVisible();expect(await authoringText(page)).toBe(before);
 await search.fill(privateSourceId);await expect(results).toHaveText('View recipes: 0 of 7 · Illustrative patterns: 0 of 5.');await expect(panel).toContainText('Missing guidance or facets do not mean a product is incompatible');
 await type.selectOption('recipe');await search.fill('which declared work items');await expect(results).toHaveText('View recipes: 1 of 7 · Illustrative patterns: 0 of 5.');const jobs=await disclosure(panel,'Authored guidance · spark-production');await expect(jobs.locator('..')).toContainText('View recipe');await expect(jobs.locator('..').getByRole('button',{name:'Open existing view',exact:true})).toBeVisible();
 await search.fill('');await type.selectOption('all');await guidance.selectOption('not-supplied');await expect(results).toHaveText('View recipes: 6 of 7 · Illustrative patterns: 0 of 5.');await expect(catalog.locator(':scope > ul > li')).toHaveCount(0);await disclosure(panel,'More view recipes and unavailable capabilities');const legacyRecipe=panel.getByText('Interfaces and schema dependencies',{exact:true}).locator('..');await expect(legacyRecipe).toContainText('Detailed authored guidance is not supplied for this legacy entry.');
 await panel.getByRole('button',{name:'Reset catalogue filters',exact:true}).click();await expect(search).toHaveValue('');await expect(type).toHaveValue('all');await expect(guidance).toHaveValue('all');await expect(results).toHaveText('View recipes: 7 of 7 · Illustrative patterns: 5 of 5.');expect(await profileText()).toBe(profileBefore);await expect(panel.getByLabel('View purpose',{exact:true})).toHaveValue('audit');expect(await authoringText(page)).toBe(before);
 await panel.locator('summary').filter({hasText:'Advanced analysis parameters'}).click();await page.setViewportSize({width:390,height:844});await search.focus();await page.keyboard.press('Tab');await expect(type).toBeFocused();await page.keyboard.press('Tab');await expect(guidance).toBeFocused();const filters=panel.getByRole('group',{name:'Catalogue display filters',exact:true});const dimensions=await filters.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth}));expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await filters.screenshot({path:info.outputPath('catalogue-filters-390.png')});
 await type.selectOption('recipe');await guidance.selectOption('supplied');await search.fill('jobs');const selectedJobs=await disclosure(panel,'Authored guidance · spark-production');await selectedJobs.locator('..').getByRole('button',{name:'Open existing view',exact:true}).click();await expect(page.getByTestId('view-root')).toBeVisible();await page.getByTestId('view-root').getByRole('button',{name:'Explore Refinement stage',exact:true}).click();await expect(page.getByTestId('view-root')).toBeVisible();await expect(page.getByTestId('view-inside')).toBeVisible();expect(await authoringText(page)).toBe(before);await page.getByRole('button',{name:'Business overview',exact:true}).click();await expect(search).toHaveValue('');
 for(const mode of ['Portfolio','Present'] as const){
  await search.fill(privateDraft);await type.selectOption('pattern');await guidance.selectOption('supplied');await page.getByRole('tab',{name:mode,exact:true}).click();await expect(search).toHaveValue('');await expect(type).toHaveValue('all');await expect(guidance).toHaveValue('all');await expect(results).toHaveText('View recipes: 7 of 7 · Illustrative patterns: 5 of 5.');const publicCatalog=await disclosure(panel,'Illustrative architecture pattern catalog');await expect(publicCatalog).not.toContainText(privateSourceId);await expect(page.locator('body')).not.toContainText(privateMarker);await page.getByRole('tab',{name:'Edit',exact:true}).click();await expect(search).toHaveValue('');expect(await authoringText(page)).toBe(before);
 }
 await search.fill(privateDraft);const next=fixture('synthetic-catalogue-new-project');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(next));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Business overview',exact:true}).click();await expect(search).toHaveValue('');await expect(type).toHaveValue('all');await expect(guidance).toHaveValue('all');expect(JSON.parse(await authoringText(page))).toEqual(next);
});


test('editorial reference families expose known cards and unknown legacy entries without changing facts',async({page},info)=>{
 const {before,panel}=await importFixture(page,'synthetic-reference-family-discovery'),externalRequests:string[]=[];
 page.on('request',request=>{if(new URL(request.url()).origin!==new URL(page.url()).origin)externalRequests.push(request.url());});
 const family=panel.getByRole('combobox',{name:'Reference topic family',exact:true}),results=panel.getByRole('status',{name:'Catalogue filter results',exact:true});
 await family.selectOption('Data');await expect(results).toHaveText('View recipes: 1 of 7 · Illustrative patterns: 1 of 5.');
 const catalog=await disclosure(panel,'Illustrative architecture pattern catalog'),medallion=await disclosure(catalog,'Authored guidance · lakehouse-medallion'),jobs=await disclosure(panel,'Authored guidance · spark-production');
 for(const card of [medallion,jobs]){await expect(card).toContainText('Reference topic family: Data');await expect(card).toContainText('Editorial content classification only');await expect(card).toContainText('CSV SHA-256 991cdfcfac2dab0218a56df35808d0c9ebfe65eeb9c60eb5ff3dd00139666c4d');await expect(card).toContainText('applicability UNKNOWN / not assessed');}
 await expect(catalog.locator(':scope > ul > li')).toHaveCount(1);await medallion.screenshot({path:info.outputPath('reference-family-data.png')});
 await family.selectOption('Applications');await expect(results).toHaveText('View recipes: 0 of 7 · Illustrative patterns: 2 of 5.');await expect(catalog).toContainText('Modular application candidate');await expect(catalog).toContainText('Event-driven flow candidate');
 await family.selectOption('Fondations');await expect(results).toHaveText('View recipes: 0 of 7 · Illustrative patterns: 1 of 5.');await expect(catalog).toContainText('System and container explanation');
 await family.selectOption('not-supplied');await expect(results).toHaveText('View recipes: 6 of 7 · Illustrative patterns: 1 of 5.');await expect(catalog).toContainText('Migration design candidate');await expect(catalog).toContainText('Reference topic family: UNKNOWN / not supplied.');await catalog.screenshot({path:info.outputPath('reference-family-unknown.png')});
 await family.selectOption('Applications');await panel.getByRole('searchbox',{name:'Search catalogue',exact:true}).fill('jobs');await expect(results).toHaveText('View recipes: 0 of 7 · Illustrative patterns: 0 of 5.');await expect(panel).toContainText('Missing guidance or facets do not mean a product is incompatible');
 await panel.getByRole('button',{name:'Reset catalogue filters',exact:true}).click();await expect(family).toHaveValue('all');await expect(results).toHaveText('View recipes: 7 of 7 · Illustrative patterns: 5 of 5.');expect(await authoringText(page)).toBe(before);expect(externalRequests).toEqual([]);
});

test('family controls remain reachable on mobile and reset across public modes and project changes',async({page},info)=>{
 const {before,panel}=await importFixture(page,'synthetic-reference-family-boundaries'),family=panel.getByRole('combobox',{name:'Reference topic family',exact:true}),guidance=panel.getByRole('combobox',{name:'Detailed guidance',exact:true}),search=panel.getByRole('searchbox',{name:'Search catalogue',exact:true});
 await page.setViewportSize({width:390,height:844});await guidance.focus();await page.keyboard.press('Tab');await expect(family).toBeFocused();await family.selectOption('Data');
 const filters=panel.getByRole('group',{name:'Catalogue display filters',exact:true});await filters.scrollIntoViewIfNeeded();const dimensions=await filters.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth}));expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await filters.screenshot({path:info.outputPath('reference-family-controls-390.png')});
 for(const mode of ['Portfolio','Present'] as const){await family.selectOption('Data');await search.fill(privateDraft);await page.getByRole('tab',{name:mode,exact:true}).click();await expect(family).toHaveValue('all');await expect(search).toHaveValue('');const catalog=await disclosure(panel,'Illustrative architecture pattern catalog');await expect(catalog).not.toContainText(privateSourceId);await expect(page.locator('body')).not.toContainText(privateMarker);await page.getByRole('tab',{name:'Edit',exact:true}).click();await expect(family).toHaveValue('all');expect(await authoringText(page)).toBe(before);}
 await family.selectOption('Applications');const next=fixture('synthetic-reference-family-new-project');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(next));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Business overview',exact:true}).click();await expect(family).toHaveValue('all');expect(JSON.parse(await authoringText(page))).toEqual(next);
});


test('migration reference supplies conditional guidance without transition proof or inferred Cloud applicability',async({page},info)=>{
 const {before,panel}=await importFixture(page,'synthetic-migration-guidance'),origin=new URL(page.url()).origin,externalRequests:string[]=[];
 page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)externalRequests.push(request.url());});
 const search=panel.getByRole('searchbox',{name:'Search catalogue',exact:true}),guidance=panel.getByRole('combobox',{name:'Detailed guidance',exact:true}),family=panel.getByRole('combobox',{name:'Reference topic family',exact:true}),type=panel.getByRole('combobox',{name:'Catalogue entry type',exact:true});
 await type.selectOption('pattern');await guidance.selectOption('supplied');await family.selectOption('not-supplied');await search.fill('migration');await expect(panel.getByRole('status',{name:'Catalogue filter results',exact:true})).toHaveText('View recipes: 0 of 7 · Illustrative patterns: 1 of 5.');
 const catalog=await disclosure(panel,'Illustrative architecture pattern catalog'),row=catalog.locator(':scope > ul > li');await expect(row).toHaveCount(1);await expect(row).toContainText('Migration design candidate');await expect(row).toContainText('Illustrative pattern · version 1 · not-established');await expect(row).toContainText('Explicit before/after scope; Author-approved transition plan; External migration checks');
 const path=await page.locator('.breadcrumb').innerText(),summary=catalog.locator('summary').filter({hasText:'Authored guidance · migration'});await summary.focus();await page.keyboard.press('Enter');const card=summary.locator('..');await expect(card).toHaveAttribute('open','');
 for(const heading of ['Problem','Conditions to assess','Contraindications','Alternatives','Tradeoffs','Questions by level','Limits','Static documentation sources'])await expect(card.getByRole('heading',{name:heading,exact:true})).toBeVisible();
 await expect(card).toContainText('applicability UNKNOWN / not assessed');await expect(card).toContainText('Reference topic family: UNKNOWN / not supplied');await expect(card).toContainText('Content revision 2026-10-15.1 · packet reviewed 2026-10-14');await expect(card).toContainText('Synthetic example: input');await expect(card).toContainText('recovery point objective');await expect(card).toContainText('A return plan is not evidence of recoverability');await expect(card.getByRole('button')).toHaveCount(0);
 for(const [title,url,updated] of [['Strangler Fig pattern','https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig','2026-06-02'],['Anti-Corruption Layer pattern','https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer','2026-05-30'],['Plan your migration','https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/migrate/plan-migration','2025-08-01']] as const){await sourceLink(card,title,url);await expect(card.getByRole('link',{name:title,exact:true}).locator('..')).toContainText('retrieved 2026-10-15 · page updated '+updated+' · external revision UNKNOWN');}
 await expect(card).not.toContainText(privateMarker);await expect(card).not.toContainText(privateSourceId);await expect(card).not.toContainText('Synthetic instance declaration');const text=await card.innerText();expect(await page.locator('.breadcrumb').innerText()).toBe(path);expect(await authoringText(page)).toBe(before);
 await page.setViewportSize({width:390,height:844});await summary.focus();await expect(summary).toBeFocused();await expect(card.getByRole('heading',{name:'Alternatives',exact:true})).toBeVisible();const dimensions=await card.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth}));expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await card.screenshot({path:info.outputPath('migration-guidance-390.png')});
 for(const mode of ['Portfolio','Present'] as const){await search.fill(privateDraft);await page.getByRole('tab',{name:mode,exact:true}).click();await expect(search).toHaveValue('');await expect(guidance).toHaveValue('all');await expect(family).toHaveValue('all');const publicCatalog=await disclosure(panel,'Illustrative architecture pattern catalog'),publicCard=await disclosure(publicCatalog,'Authored guidance · migration');expect(await publicCard.innerText()).toBe(text);await expect(publicCatalog).not.toContainText(privateSourceId);await expect(page.locator('body')).not.toContainText(privateMarker);await expect(page.locator('body')).not.toContainText(privateDraft);await page.getByRole('tab',{name:'Edit',exact:true}).click();expect(await authoringText(page)).toBe(before);}
 expect(externalRequests).toEqual([]);
});


const witnessAId='input-a-'+ 'a'.repeat(70),witnessLongLabel='S'.repeat(160),witnessLongLocation='Synthetic C declared tag at file:9; '+'L'.repeat(200);
function witnessFixture(id:string,paged=false,privateTag=false):Project{
 const input=documentSchema.parse({schemaVersion:1,id,revision:7,title:'Synthetic pattern input explanations',rootViewId:'root',summary:'Authored synthetic declarations only; no observation or approved mapping.',
  nodes:[{id:witnessAId,label:witnessLongLabel,kind:'app',basis:'static-source',sourceIds:['a-citation']},{id:'input-b',label:'Synthetic function B',kind:'function',basis:'unknown'},
   {id:'input-c',label:privateTag?privateMarker:'Unrelated tag-only component C',kind:'control',basis:'planned',tags:['dotnet'],sourceIds:['c-citation'],visibility:privateTag?'private':'public'}],
  edges:[{id:'ab-dependency',source:witnessAId,target:'input-b',label:'Supplied A to B dependency',kind:'dependency',basis:'planned'},{id:'ac-context',source:witnessAId,target:'input-c',label:'Different-kind context',kind:'control',basis:'unknown'}],
  views:[{id:'root',title:'Supplied synthetic code view',perspective:'code',nodeIds:[witnessAId,'input-b','input-c'],edgeIds:['ab-dependency','ac-context'],positions:{[witnessAId]:{x:0,y:0},'input-b':{x:500,y:0},'input-c':{x:1000,y:0}}}],
  sources:[{id:'a-citation',title:'Synthetic A citation',location:'Synthetic declared app at file:1'},{id:'c-citation',title:privateTag?privateMarker:'Synthetic C tag citation',location:privateTag?privateMarker:witnessLongLocation,visibility:privateTag?'private':'public'}]});
 if(paged)for(let i=0;i<12;i++){const nodeId='extra-tag-'+i;input.nodes.push({...input.nodes[2],id:nodeId,label:'Extra declared tag '+i,sourceIds:[]});input.views[0].nodeIds.push(nodeId);input.views[0].positions[nodeId]={x:i*200,y:500};}
 return validateDocument(input);
}
async function importWitnessInput(page:Page,input:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(input));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 // Ordinary import intentionally selects Edit; the positive reading journey explicitly chooses Explore.
 await page.getByRole('tab',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Business overview',exact:true}).click();const panel=page.getByLabel('Recipe and pattern workbench',{exact:true});await expect(panel).toBeVisible();return panel;
}
async function modularInputRow(panel:Locator){await panel.getByRole('combobox',{name:'Catalogue entry type',exact:true}).selectOption('pattern');await panel.getByRole('searchbox',{name:'Search catalogue',exact:true}).fill('modular');const catalog=await disclosure(panel,'Illustrative architecture pattern catalog');const row=catalog.locator(':scope > ul > li');await expect(row).toHaveCount(1);await expect(row).toContainText('Modular application candidate');return row;}
async function readProfileDownload(page:Page,panel:Locator){await disclosure(panel,'Advanced analysis parameters');const pending=page.waitForEvent('download');await panel.getByRole('button',{name:'Download validated analysis profile',exact:true}).click();const path=await(await pending).path();expect(path).not.toBeNull();const text=readFileSync(path!,'utf8');await panel.locator('summary').filter({hasText:'Advanced analysis parameters'}).click();return text;}

test('native pattern input disclosure identifies global tag contributors, retains unanswered evidence and pages full mobile text without authoring changes',async({page},info)=>{
 await page.goto('/');const input=witnessFixture('synthetic-pattern-input-native',true),panel=await importWitnessInput(page,input),before=await authoringText(page),profile=await readProfileDownload(page,panel),row=await modularInputRow(panel);
 await expect(row).toContainText('Illustrative pattern · version 1 · candidate');await expect(row).toContainText('Evidence required: Module boundaries; Source-backed entry point and references; Deployment topology.');
 const summary=row.locator('summary').filter({hasText:'Inputs behind this suggestion'});await summary.focus();await page.keyboard.press('Enter');const inputs=summary.locator('..');await expect(inputs).toHaveAttribute('open','');await expect(inputs).toContainText('ALL required kinds');await expect(inputs).toContainText('app: supplied; function: supplied');await expect(inputs).toContainText('ANY required tag may occur on any component, including an unrelated component: dotnet: supplied');
 const componentTable=inputs.getByRole('region',{name:'Component inputs table',exact:true}),connections=inputs.getByRole('region',{name:'Connection inputs table',exact:true}),citations=inputs.getByRole('region',{name:'Citation inputs table',exact:true});
 await expect(componentTable).toContainText('Unrelated tag-only component C');await expect(componentTable).toContainText('Required kinds: none.');await expect(componentTable).toContainText('Required tags: dotnet.');await expect(componentTable).toContainText('Basis: static-source');await expect(componentTable).toContainText('Basis: unknown');await expect(componentTable).toContainText('Basis: planned');
 await expect(connections).toContainText('ab-dependency');await expect(connections).not.toContainText('ac-context');await expect(connections).toContainText('Endpoint citation IDs: a-citation');await expect(connections).not.toContainText('c-citation');await expect(citations).toContainText('c-citation');await expect(citations).toContainText(witnessLongLocation);await expect(inputs).toContainText('Endpoint citations do not independently prove a connection');await expect(inputs).toContainText('Evidence questions remain unestablished');await expect(inputs).toContainText('No evidence requirement is checked or satisfied');await expect(inputs.getByRole('link')).toHaveCount(0);await expect(inputs.getByRole('textbox')).toHaveCount(0);await expect(inputs.getByRole('checkbox')).toHaveCount(0);
 const counts=inputs.getByRole('status',{name:'component input counts',exact:true});await expect(counts).toHaveText('Showing 1–12 of 15 · displayed 12 · omitted from this page 3.');const next=inputs.getByRole('button',{name:'Next component inputs',exact:true});await next.focus();await page.keyboard.press('Enter');await expect(counts).toHaveText('Showing 13–15 of 15 · displayed 3 · omitted from this page 12.');await expect(componentTable).toContainText('Extra declared tag 11');await expect(next).toBeDisabled();await inputs.getByRole('button',{name:'Previous component inputs',exact:true}).click();await expect(counts).toHaveText('Showing 1–12 of 15 · displayed 12 · omitted from this page 3.');
 await page.setViewportSize({width:390,height:844});await summary.focus();await expect(summary).toBeFocused();await expect(componentTable).toContainText(witnessLongLabel);await expect(componentTable.getByText(witnessAId,{exact:true})).toHaveText(witnessAId);await expect(citations).toContainText(witnessLongLocation);expect(await inputs.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await inputs.screenshot({path:info.outputPath('pattern-input-explanations-390.png')});
 await panel.getByRole('button',{name:'Reset catalogue filters',exact:true}).click();await expect(panel.getByRole('status',{name:'Catalogue filter results',exact:true})).toHaveText('View recipes: 7 of 7 · Illustrative patterns: 5 of 5.');expect(await readProfileDownload(page,panel)).toBe(profile);expect(await authoringText(page)).toBe(before);expect(JSON.parse(before).observations).toEqual([]);
});

test('pattern inputs reset with permitted public modes, revision replacement and another project without retaining private contributors',async({page})=>{
 await page.goto('/');let panel=await importWitnessInput(page,witnessFixture('synthetic-pattern-input-boundaries',false,true)),before=await authoringText(page),row=await modularInputRow(panel);let inputs=await disclosure(row,'Inputs behind this suggestion');await expect(inputs).toContainText(privateMarker);await expect(inputs.getByRole('status',{name:'component input counts',exact:true})).toHaveText('Showing 1–3 of 3 · displayed 3 · omitted from this page 0.');
 for(const mode of ['Portfolio','Present'] as const){await page.getByRole('tab',{name:mode,exact:true}).click();await expect(panel.locator('details[open] > summary').filter({hasText:'Inputs behind this suggestion'})).toHaveCount(0);row=await modularInputRow(panel);await expect(row).toContainText('Illustrative pattern · version 1 · not-established');inputs=await disclosure(row,'Inputs behind this suggestion');await expect(inputs).toContainText('dotnet: not supplied');await expect(inputs.getByRole('status',{name:'component input counts',exact:true})).toHaveText('Showing 1–2 of 2 · displayed 2 · omitted from this page 0.');await expect(inputs).not.toContainText('input-c');await expect(inputs).not.toContainText('c-citation');await expect(page.locator('body')).not.toContainText(privateMarker);await page.getByRole('tab',{name:'Explore',exact:true}).click();await expect(panel.locator('details[open] > summary').filter({hasText:'Inputs behind this suggestion'})).toHaveCount(0);row=await modularInputRow(panel);inputs=await disclosure(row,'Inputs behind this suggestion');await expect(inputs).toContainText(privateMarker);expect(await authoringText(page)).toBe(before);}
 // Apply an ordinary reviewed same-ID document at its current revision; canonical Apply owns the revision increment.
 const revised=JSON.parse(before) as Project;revised.nodes.find(node=>node.id==='input-c')!.tags=[];revised.nodes.find(node=>node.id==='input-c')!.label='Synthetic replacement without tag';panel=await importWitnessInput(page,validateDocument(revised));before=await authoringText(page);expect(JSON.parse(before).revision).toBe(revised.revision+1);await expect(panel.locator('details[open] > summary').filter({hasText:'Inputs behind this suggestion'})).toHaveCount(0);row=await modularInputRow(panel);inputs=await disclosure(row,'Inputs behind this suggestion');await expect(inputs).toContainText('Existing result: not-established');await expect(inputs).toContainText('dotnet: not supplied');await expect(inputs).not.toContainText(privateMarker);await expect(inputs.getByRole('status',{name:'component input counts',exact:true})).toHaveText('Showing 1–2 of 2 · displayed 2 · omitted from this page 0.');expect(await authoringText(page)).toBe(before);
 panel=await importWitnessInput(page,witnessFixture('synthetic-pattern-input-replacement',false));before=await authoringText(page);await expect(panel.locator('details[open] > summary').filter({hasText:'Inputs behind this suggestion'})).toHaveCount(0);row=await modularInputRow(panel);inputs=await disclosure(row,'Inputs behind this suggestion');await expect(inputs).toContainText('Unrelated tag-only component C');await expect(inputs).not.toContainText(privateMarker);await expect(inputs).toContainText('Existing result: candidate');expect(await authoringText(page)).toBe(before);
});

test('choices show assumptions, alternatives with an UNKNOWN substitution check and a derived review state; review and acceptance are explicit Edit actions',async({page},info)=>{
 // Synthetic candidate written by an AI, reviewed once, then its cited source moved: review is needed, and that is derived, not stored.
 const base=fixture('synthetic-decision-review');
 base.nodes.find(n=>n.id==='raw')!.choices=[{id:'input-format',title:'Input format',goal:'Keep the declared input readable by refinement',options:[{id:'delta',label:'Delta table',summary:''},{id:'csv',label:'CSV drop',summary:''}],recommendedOptionId:'delta',
  reasons:['Schema travels with the data'],tradeoffs:['Needs a table reader'],assumptions:['Synthetic volume stays small'],status:'candidate',origin:'ai',suggestedBy:'claude',sourceIds:['instance-source'],visibility:'public'}];
 const reviewed=reviewChoice(validateDocument(base),'input-format',{reviewedBy:'Fixture author'});
 reviewed.sources.find(s=>s.id==='instance-source')!.location='Authored browser fixture; moved after the review';
 const input=validateDocument(reviewed);
 await page.goto('/');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(input));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const open=async()=>{await page.getByTestId('view-root').getByRole('button',{name:'Explore Declared input',exact:true}).click();await page.getByRole('button',{name:'Inspector',exact:true}).click();return page.getByRole('region',{name:'Choice Input format',exact:true});};
 let card=await open();
 const state=()=>card.getByRole('status',{name:'Review state of Input format',exact:true});
 await expect(state()).toContainText('Review needed · supporting facts changed');await expect(state()).toContainText('Nothing is re-bound automatically');
 await expect(card).toContainText('Synthetic volume stays small');await expect(card).toContainText('Schema travels with the data');await expect(card).toContainText('Candidate · not an accepted decision');
 const alternatives=card.getByRole('region',{name:'Alternatives to Delta table',exact:true});
 await expect(alternatives).toContainText('“CSV drop” instead of “Delta table”');await expect(alternatives).toContainText('UNKNOWN · compatibility not established');
 const check=await disclosure(alternatives,'Substitution check');
 await expect(check).toContainText('Provides the batch output to “Refinement stage”');await expect(check).toContainText('Keeps the assumption: Synthetic volume stays small');await expect(check).toContainText('is not proof');
 // The recommender cannot review itself; nothing changes.
 const reviewer=card.getByLabel('Reviewer of Input format',{exact:true});
 await reviewer.fill('claude');await card.getByRole('button',{name:'Mark reviewed against current facts',exact:true}).click();
 await expect(page.getByText(/cannot review itself/).first()).toBeVisible();await expect(state()).toContainText('Review needed');
 await reviewer.fill('Julian');await card.getByRole('button',{name:'Mark reviewed against current facts',exact:true}).click();
 await expect(state()).toContainText('Reviewed against the current facts');
 await card.getByLabel('Option to accept for Input format',{exact:true}).selectOption('delta');
 await card.getByLabel('Decision date for Input format',{exact:true}).fill('2026-10-17');
 await card.getByRole('button',{name:'Accept as my decision',exact:true}).click();
 await expect(card).toContainText('Accepted decision');await expect(card).toContainText('decided by Julian on 2026-10-17');
 await expect(card.getByRole('button',{name:'Accept as my decision',exact:true})).toHaveCount(0);
 await card.screenshot({path:info.outputPath('decision-review-accepted.png')});
 const saved=JSON.parse(await authoringText(page)) as Project,choice=saved.nodes.find(n=>n.id==='raw')!.choices![0];
 expect([choice.status,choice.chosenOptionId,choice.decidedBy,choice.suggestedBy]).toEqual(['accepted','delta','Julian','claude']);
 expect(choice.reviewBasis!.fingerprint).toMatch(/^[0-9a-f]{16}$/);expect(JSON.stringify(saved)).not.toContain('review-needed');
 // One Undo restores the candidate, still reviewed.
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(card).toContainText('Candidate · not an accepted decision');await expect(state()).toContainText('Reviewed against the current facts');
 // Public mode: the rationale and the current review stay readable; no review or accept action exists.
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();card=await open();
 await expect(state()).toContainText('Reviewed against the current facts');
 await expect(card).toContainText('UNKNOWN · compatibility not established');
 await expect(page.getByRole('button',{name:'Mark reviewed against current facts',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Accept as my decision',exact:true})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText(privateMarker);
});
