import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema} from '../../src/core/model';

/**
 * Independent operation: every request that is not to the loopback test server is aborted and recorded, and each
 * journey must finish without attempting one. No Git, cloud, provider or model service is reachable or needed.
 */
const LOOPBACK=/^(?:https?|wss?):\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//i;
async function offline(context:BrowserContext){
 const attempted:string[]=[];
 await context.route('**/*',route=>{const url=route.request().url();if(LOOPBACK.test(url)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();attempted.push(url);return route.abort('internetdisconnected');});
 const watch=(page:Page)=>page.on('websocket',ws=>{if(!LOOPBACK.test(ws.url()))attempted.push(ws.url());});
 context.pages().forEach(watch);context.on('page',watch);
 return attempted;
}
const synthetic=(id:string)=>documentSchema.parse({schemaVersion:1,id,title:'Synthetic offline project',revision:0,rootViewId:'root',
 nodes:[{id:'ingest',label:'Synthetic ingest',summary:'Reads synthetic rows.'},{id:'store',label:'Synthetic store',kind:'storage'},{id:'secret',label:'PRIVATE_OFFLINE_SENTINEL',visibility:'private'}],
 edges:[{id:'flow',source:'ingest',target:'store',label:'rows'}],views:[{id:'root',title:'Root',nodeIds:['ingest','store','secret'],edgeIds:['flow'],positions:{ingest:{x:0,y:0},store:{x:320,y:0},secret:{x:0,y:220}}}]});
async function importDocument(page:Page,text:string){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(text);
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
}
async function currentJson(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const text=await page.getByLabel('Project JSON',{exact:true}).inputValue();await page.getByRole('button',{name:'Close dialog',exact:true}).click();return JSON.parse(text);
}

test('offline journey: import a source, inspect, edit, save, reopen, export the public copy and open a lesson with no outside request',async({page,browser})=>{
 const attempted=await offline(page.context()),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 // Source: a selected synthetic document enters through the reviewed import.
 await importDocument(page,JSON.stringify(synthetic('synthetic-offline-journey')));
 await expect(page.getByRole('heading',{name:'Synthetic offline project',exact:true})).toBeVisible();
 // Inspect and edit one component in Edit mode, then save.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Explore Synthetic ingest',exact:true}).click();
 await page.getByLabel('Component label',{exact:true}).fill('Synthetic ingest, renamed offline');await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Synthetic ingest, renamed offline',exact:true})).toBeVisible();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 // Reopen: the edit survives a reload from local storage only.
 await page.reload();await page.locator('.project-card').filter({hasText:'Synthetic offline project'}).click();
 await expect(page.getByRole('button',{name:'Explore Synthetic ingest, renamed offline',exact:true})).toBeVisible();
 expect((await currentJson(page)).nodes.find((n:{id:string})=>n.id==='ingest').label).toBe('Synthetic ingest, renamed offline');
 // Export the intended public copy and open it with every request aborted.
 await page.getByRole('button',{name:'Export & share',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:/^Interactive HTML/}).click();const download=await pending;
 const html=readFileSync((await download.path())!,'utf8');expect(html).not.toContain('PRIVATE_OFFLINE_SENTINEL');expect(html).toContain('Synthetic ingest, renamed offline');
 const exported=await browser.newContext(),viewer=await exported.newPage(),viewerRequests:string[]=[];await exported.route('**/*',route=>{viewerRequests.push(route.request().url());return route.abort();});
 const viewerErrors:string[]=[];viewer.on('pageerror',e=>viewerErrors.push(e.message));await viewer.setContent(html);
 await expect(viewer.getByRole('heading',{name:'Synthetic offline project',exact:true})).toBeVisible();expect(viewerErrors).toEqual([]);expect(viewerRequests.filter(u=>!u.startsWith('data:'))).toEqual([]);await exported.close();
 await page.keyboard.press('Escape');
 // One learning journey: a static authored lesson, no service behind it.
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});await expect(catalogue).toBeVisible();
 await catalogue.getByRole('button',{name:'Open lesson Slowly changing dimensions and temporal joins',exact:true}).click();
 const lesson=catalogue.getByRole('article',{name:'Lesson: Slowly changing dimensions and temporal joins'});
 await lesson.getByRole('radio',{name:'Detail',exact:true}).check();await expect(lesson.getByRole('status',{name:'Explanation at selected depth'})).toContainText('half-open validity intervals');
 expect(attempted).toEqual([]);expect(errors).toEqual([]);
});

test('offline proposal review: an applied patch cannot be replayed after Undo, and a provider request is refused without a request',async({page})=>{
 const attempted=await offline(page.context());
 await page.goto('/');const doc=synthetic('synthetic-offline-replay');await importDocument(page,JSON.stringify(doc));
 await expect(page.getByRole('heading',{name:'Synthetic offline project',exact:true})).toBeVisible();
 const base=(await currentJson(page)).revision;
 const patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:base,summary:'Synthetic rename',operations:[{op:'test',path:'/nodes/@store/label',value:'Synthetic store'},{op:'replace',path:'/nodes/@store/label',value:'Synthetic store, patched'}]};
 await importDocument(page,JSON.stringify(patch));
 await expect(page.getByRole('button',{name:'Explore Synthetic store, patched',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('button',{name:'Explore Synthetic store',exact:true})).toBeVisible();
 expect((await currentJson(page)).revision).toBe(base);
 const editor=page.getByLabel('Project JSON',{exact:true}),validate=page.getByRole('button',{name:'Validate JSON',exact:true}),apply=page.getByRole('button',{name:'Apply imported document',exact:true});
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await editor.fill(JSON.stringify(patch));await validate.click();
 await expect(page.getByRole('alert')).toContainText('Replay: this proposal was already applied');await expect(apply).toBeDisabled();
 // Relabelling the base revision does not make it new.
 await editor.fill(JSON.stringify({...patch,baseRevision:base+7,summary:'Relabelled'}));await validate.click();
 await expect(page.getByRole('alert')).toContainText('relabelling its base revision does not make it new');await expect(apply).toBeDisabled();
 await editor.fill(JSON.stringify({provider:'synthetic-model',prompt:'Rewrite this project',command:'run'}));await validate.click();
 await expect(page.getByRole('alert')).toContainText('cannot launch a provider');await expect(apply).toBeDisabled();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect((await currentJson(page)).nodes.find((n:{id:string})=>n.id==='store').label).toBe('Synthetic store');
 expect(attempted).toEqual([]);
});
