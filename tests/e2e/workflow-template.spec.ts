import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {validateProjectBrief} from '../../src/intelligence/brief';

const original=JSON.parse(readFileSync('examples/workflows/01-petit-client.project-brief.json','utf8'));
const sourceHash='d1c33ff28eea2584d9125b433e3891fdcf373ed6de202ab1c7f552508202f8a8';
const humanDraft=JSON.stringify({...original,project:{id:'synthetic-human-draft',title:'Synthetic human draft',summary:'A human draft retained byte for byte.'}},null,3)+'\n';
const seed=(id:string)=>validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic current project retained',rootViewId:'root',summary:'Synthetic pre-existing author work.',privateNotes:'SYNTHETIC_EXISTING_ANNOTATION',nodes:[{id:'retained',label:'Synthetic retained component',summary:'Existing author annotation.'}],edges:[],views:[{id:'root',title:'Synthetic root',nodeIds:['retained'],positions:{retained:{x:0,y:0}}}]}));
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;}
async function prepare(page:Page,id:string){await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(seed(id)));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();return current(page);}
async function start(page:Page){await page.locator('.header-actions').getByRole('button',{name:'New analysis',exact:true}).click();await page.getByRole('radio',{name:/Guided/}).check();}
async function stored(page:Page,id:string):Promise<Project|null>{return page.evaluate(id=>new Promise<Project|null>((resolve,reject)=>{const opening=indexedDB.open('diagramcloud-v1',1);opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('projects','readonly'),read=tx.objectStore('projects').get(id);read.onerror=()=>reject(read.error);read.onsuccess=()=>resolve(read.result?JSON.parse(read.result.json):null);tx.oncomplete=()=>db.close();};}),id);}

test('explicit private workflow load preserves drafts and existing author work, then uses ordinary Preview and Apply',async({page},testInfo)=>{
 const before=await prepare(page,'synthetic-template-retained');await start(page);
 const editor=page.getByLabel('Project brief JSON',{exact:true}),catalogue=page.getByRole('region',{name:'Private workflow templates',exact:true});
 await editor.fill(humanDraft);await catalogue.getByRole('button',{name:'Load private workflow template',exact:true}).click();
 const first=JSON.parse(await editor.inputValue());expect(first.project.id).toMatch(/^client-[a-f0-9]{32}$/);expect(first.project.id).not.toBe(original.project.id);
 expect(first.scope).toEqual(validateProjectBrief(original).scope);expect(first.relationships).toEqual(original.relationships);expect(first.questions).toEqual(original.questions);
 for(const label of ['Synthetic','Source-declared','PRIVATE_DRAFT','Occurrence UNKNOWN',sourceHash])await expect(catalogue).toContainText(label);
 await catalogue.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('workflow-template-catalogue.png'),fullPage:true});
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toHaveCount(0);expect(await stored(page,before.id)).toEqual(before);
 await catalogue.getByRole('button',{name:'Restore previous draft',exact:true}).click();await expect(editor).toHaveValue(humanDraft);
 await catalogue.getByRole('button',{name:'Load private workflow template',exact:true}).click();const second=JSON.parse(await editor.inputValue());expect(second.project.id).not.toBe(first.project.id);expect(second.scope).toEqual(first.scope);
 expect(await stored(page,before.id)).toEqual(before);expect(await stored(page,'brief-'+second.project.id)).toBeNull();
 await page.getByRole('button',{name:'Preview project',exact:true}).click();const candidate=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));
 expect(candidate.id).toBe('brief-'+second.project.id);expect(candidate.observations).toEqual([]);expect(candidate.nodes.every(n=>n.visibility==='private')).toBe(true);expect(candidate.edges.every(e=>e.visibility==='private')).toBe(true);expect(candidate.summary).toContain(sourceHash);
 expect(candidate.experience!.items.every(item=>item.visibility==='private'&&item.approval==='draft')).toBe(true);expect(await stored(page,candidate.id)).toBeNull();expect(await stored(page,before.id)).toEqual(before);
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByTestId('project-overview')).toBeVisible();
 const applied=await current(page);expect(applied.id).toBe(candidate.id);expect(applied.observations).toEqual([]);expect(await stored(page,before.id)).toEqual(before);
 await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByTestId('view-brief-overview').getByRole('button',{name:'Explore Client demonstrateur',exact:true}).click();
 await expect(page.getByTestId('view-brief-overview')).toBeVisible();await expect(page.getByTestId('view-brief-children-scope')).toBeVisible();
 await page.getByTestId('view-brief-children-scope').getByRole('button',{name:'Explore API du projet',exact:true}).click();await expect(page.getByTestId('view-brief-children-api')).toBeVisible();await expect(page.getByTestId('view-brief-overview')).toBeVisible();
 await page.locator('.main-workspace').screenshot({path:testInfo.outputPath('workflow-template-private-drilldown.png')});
 await expect.poll(()=>stored(page,applied.id)).toEqual(applied);await page.reload();await page.locator('.project-card').filter({hasText:'Petit client sans outils'}).click();expect(await current(page)).toEqual(applied);
 await page.screenshot({path:testInfo.outputPath('workflow-template-reopened.png'),fullPage:true});
 await start(page);await page.getByLabel('Guided project title',{exact:true}).fill('Synthetic small-project form');await page.getByLabel('Guided project steps',{exact:true}).fill('Keep this human form');await page.getByRole('button',{name:'Load private workflow template',exact:true}).click();await page.getByRole('button',{name:'Restore previous draft',exact:true}).click();await expect(editor).toHaveValue('');await expect(page.getByLabel('Guided project title',{exact:true})).toHaveValue('Synthetic small-project form');await expect(page.getByLabel('Guided project steps',{exact:true})).toHaveValue('Keep this human form');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('workflow-template-mobile.png'),fullPage:true});await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.locator('body')).not.toContainText('SYNTHETIC_EXISTING_ANNOTATION');await expect(page.getByRole('button',{name:'Explore Client demonstrateur',exact:true})).toHaveCount(0);
});

test('late or failed selected-file reads cannot overwrite template, restored/manual draft, source switch or a reopened editor',async({page})=>{
 await page.addInitScript(()=>{
  const original=File.prototype.text;
  File.prototype.text=function(){if(this.name==='denied-private.json')return Promise.reject(new DOMException('PRIVATE_TEMPLATE_READ_SENTINEL','NotAllowedError'));if(this.name!=='late-template.json')return original.call(this);
   const selected=this;return new Promise<string>(resolve=>{(window as unknown as {releaseTemplateRead?:()=>Promise<void>}).releaseTemplateRead=async()=>{resolve(await original.call(selected));await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));};});};
 });
 const before=await prepare(page,'synthetic-template-read-guard');await start(page);const editor=page.getByLabel('Project brief JSON',{exact:true});
 const hold=async()=>{await page.getByLabel('Project brief file',{exact:true}).setInputFiles({name:'late-template.json',mimeType:'application/json',buffer:Buffer.from(humanDraft)});await expect(page.getByRole('status').filter({hasText:'Reading selected JSON file'})).toBeVisible();await expect(page.getByRole('button',{name:'Preview project',exact:true})).toBeDisabled();};
 const release=()=>page.evaluate(async()=>{const state=window as unknown as {releaseTemplateRead?:()=>Promise<void>};if(!state.releaseTemplateRead)throw new Error('Missing synthetic held read');const release=state.releaseTemplateRead;delete state.releaseTemplateRead;await release();});
 for(const [label,value] of [['Guided project title','Synthetic latest form title'],['Guided project ID','synthetic-latest-form'],['Guided project summary','Human explanation entered after selecting a file.'],['Guided project steps','Keep the latest human workstream']]){await hold();await page.getByLabel(label,{exact:true}).fill(value);await release();await expect(editor).toHaveValue('');await expect(page.getByLabel(label,{exact:true})).toHaveValue(value);}
 await hold();await page.getByRole('button',{name:'Load private workflow template',exact:true}).click();const template=await editor.inputValue();await release();await expect(editor).toHaveValue(template);
 await hold();await editor.fill(humanDraft);await release();await expect(editor).toHaveValue(humanDraft);
 await page.getByRole('button',{name:'Load private workflow template',exact:true}).click();await hold();await page.getByRole('button',{name:'Restore previous draft',exact:true}).click();await release();await expect(editor).toHaveValue(humanDraft);
 await hold();await page.getByRole('radio',{name:/Hybrid/}).check();await release();await expect(editor).toHaveValue(humanDraft);await page.getByRole('radio',{name:/Guided/}).check();
 await page.getByLabel('Project brief file',{exact:true}).setInputFiles({name:'denied-private.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(page.getByRole('alert')).toHaveText('Selected JSON file could not be read. Your current draft is unchanged.');await expect(page.locator('body')).not.toContainText('PRIVATE_TEMPLATE_READ_SENTINEL');await expect(editor).toHaveValue(humanDraft);
 await hold();await page.getByRole('button',{name:'Close dialog',exact:true}).click();await start(page);await release();await expect(editor).toHaveValue('');await expect(page.getByRole('button',{name:'Restore previous draft',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await current(page)).toEqual(before);expect(await stored(page,before.id)).toEqual(before);
});
