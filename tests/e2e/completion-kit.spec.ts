import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import type {Patch} from '../../src/core/patch';

const title='Synthetic bounded completion';
const privateMarker='SYNTHETIC_COMPLETION_PRIVATE_SOURCE';
function fixture(id:string):Project{return validateDocument(documentSchema.parse({schemaVersion:1,id,title,revision:4,rootViewId:'root',
 summary:'Synthetic authoring fixture. No runtime or client result.',
 nodes:[{id:'app',label:'Selected service',summary:'Retain this annotation until a human accepts a candidate.',role:'Authored role retained',sourceIds:['public-source'],blockIds:['author-note','private-note'],childViewId:'inside'},
 {id:'sibling',label:'Other service',summary:'Unrelated authored annotation.',sourceIds:['other-source']},
 {id:'task',label:'Retained child',summary:'Authored child remains.'}],edges:[],
 views:[{id:'root',title:'Synthetic parent',nodeIds:['app','sibling'],positions:{app:{x:0,y:0},sibling:{x:320,y:0}}},
 {id:'inside',title:'Synthetic child',nodeIds:['task'],positions:{task:{x:0,y:0}}}],
 blocks:[{id:'author-note',title:'Selected author note',type:'text',text:'Keep this authored evidence.',provenance:'author'},
 {id:'private-note',title:privateMarker,type:'text',text:privateMarker,provenance:'author',visibility:'private'}],
 sources:[{id:'public-source',title:'Synthetic selected declaration',location:'Synthetic fixture only'},
 {id:'other-source',title:'Unrelated source',location:'Unrelated synthetic locator'},
 {id:'private-source',title:privateMarker,location:privateMarker,visibility:'private'}]}));}
async function current(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const p=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return p;}
async function prepare(page:Page,id:string){await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(fixture(id)));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.getByTestId('view-root').getByRole('button',{name:'Explore Selected service',exact:true}).click();await page.getByRole('button',{name:'Details panel',exact:true}).click();const context=page.getByTestId('project-context');await context.getByRole('tab',{name:'Evidence',exact:true}).click();await context.getByText('Completion request',{exact:true}).click();await context.getByLabel('Completion question',{exact:true}).fill('Clarify the selected caption using the supplied declaration; retain unknown runtime.');return context;}
const response=(p:Project,operations:Patch['operations']):Patch=>({format:'diagramcloud.patch',version:1,target:'project',targetId:p.id,baseRevision:p.revision,
 summary:'Provenance: author candidate; Sources: public-source; Limits: Synthetic wording only, runtime remains unknown.',operations});

test('selected completion exports an explicit request, previews a bounded patch and reopens the accepted edit',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const context=await prepare(page,'synthetic-completion-accepted'),before=await current(page);
 await context.getByLabel('Completion audience',{exact:true}).selectOption('public');
 await context.getByLabel('Completion question',{exact:true}).fill('Clarify the supplied public caption; keep runtime unknown.');
 await context.getByRole('button',{name:'Prepare completion context',exact:true}).click();
 await expect(context.getByRole('button',{name:'Download completion request',exact:true})).toBeDisabled();
 await context.getByLabel('I reviewed the selected context for disclosure',{exact:true}).check();
 const waiting=page.waitForEvent('download');await context.getByRole('button',{name:'Download completion request',exact:true}).click();const file=await waiting,target=info.outputPath('completion-request.public.json');await file.saveAs(target);
 const raw=readFileSync(target,'utf8'),request=JSON.parse(raw);expect(request.format).toBe('diagramcloud.selected-context/1');expect(request.projectId).toBe(before.id);expect(request.projectRevision).toBe(before.revision);expect(request.selection).toEqual({nodeId:'app',viewId:'root'});expect(request.components.map((n:{id:string})=>n.id)).toEqual(['app']);
 for(const value of [privateMarker,'private-note','private-source','other-source','Other service','Unrelated authored annotation.'])expect(raw).not.toContain(value);
 await context.screenshot({path:info.outputPath('completion-prepared-public.png')});
 await context.getByRole('button',{name:'Pin context',exact:true}).click();await page.getByTestId('view-root').getByRole('button',{name:'Explore Other service',exact:true}).click();await expect(context.getByRole('status',{name:'Context follow mode'})).toContainText('Pinned scope: Selected service');
 await context.getByRole('button',{name:'Review completion response',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Bounded completion response'})).toContainText(request.completion.requestId);
 const patch=response(before,[{op:'test',path:'/nodes/@app/summary',value:before.nodes[0].summary},{op:'replace',path:'/nodes/@app/summary',value:'Human accepted synthetic caption; runtime unknown.'}]);
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(patch,null,2));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();const changes=page.getByRole('region',{name:'Proposed changes'});await expect(changes).toContainText('Human accepted synthetic caption');
 await changes.scrollIntoViewIfNeeded();await page.getByRole('dialog').screenshot({path:info.outputPath('completion-review.png')});await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 const after=await current(page);expect(after.revision).toBe(before.revision+1);expect(after.nodes[0].summary).toBe('Human accepted synthetic caption; runtime unknown.');expect(after.nodes[0].role).toBe(before.nodes[0].role);expect(after.nodes.slice(1)).toEqual(before.nodes.slice(1));for(const key of ['views','edges','sources','blocks','story','observations'] as const)expect(after[key]).toEqual(before[key]);
 await page.reload();await page.locator('.project-card').filter({hasText:title}).click();expect(await current(page)).toEqual(after);await page.getByTestId('view-root').getByRole('button',{name:'Explore Selected service',exact:true}).click();await expect(page.getByTestId('view-inside')).toBeVisible();await page.screenshot({path:info.outputPath('completion-reopened.png'),fullPage:true});expect(errors).toEqual([]);
});

test('completion rejects stale, unrelated and unknown-source responses, and cancel preserves authored bytes',async({page})=>{
 const context=await prepare(page,'synthetic-completion-rejected'),before=await current(page);await context.getByRole('button',{name:'Prepare completion context',exact:true}).click();await context.getByLabel('I reviewed the selected context for disclosure',{exact:true}).check();await context.getByRole('button',{name:'Review completion response',exact:true}).click();
 const valid=response(before,[{op:'replace',path:'/nodes/@app/summary',value:'Candidate never applied.'}]);
 const invalid=[{...valid,baseRevision:before.revision-1},response(before,[{op:'replace',path:'/nodes/@sibling/summary',value:'Out of scope.'}]),{...valid,summary:'Provenance: author candidate; Sources: other-source; Limits: Not supplied to this request.'},response(before,[{op:'replace',path:'/nodes/@app/visibility',value:'public'}]),{...valid,approved:true}];
 for(const patch of invalid){await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(patch));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();}
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(valid));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('region',{name:'Proposed changes'})).toContainText('Candidate never applied.');await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await current(page)).toEqual(before);
});

test('public mode clears a private draft question and a test-only response never creates an authoring revision',async({page})=>{
 const context=await prepare(page,'synthetic-completion-abstention'),before=await current(page),question='SYNTHETIC_PRIVATE_QUESTION_FOR_AUTHOR_ONLY';
 await context.getByLabel('Completion question',{exact:true}).fill(question);await context.getByRole('button',{name:'Prepare completion context',exact:true}).click();await context.getByLabel('I reviewed the selected context for disclosure',{exact:true}).check();
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await context.getByText('Completion request',{exact:true}).click();await expect(context.getByLabel('Completion question',{exact:true})).not.toHaveValue(question);await expect(context.getByRole('region',{name:'Prepared completion context'})).toHaveCount(0);
 await page.getByRole('tab',{name:'Edit',exact:true}).click();await context.getByText('Completion request',{exact:true}).click();await expect(context.getByLabel('Completion question',{exact:true})).not.toHaveValue(question);await context.getByRole('button',{name:'Prepare completion context',exact:true}).click();await context.getByLabel('I reviewed the selected context for disclosure',{exact:true}).check();
 await context.getByRole('button',{name:'Review completion response',exact:true}).click();const patch=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue());expect(patch.operations).toEqual([{op:'test',path:'/revision',value:before.revision}]);await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(await current(page)).toEqual(before);
});
