import {test,expect,type Page} from '@playwright/test';
import {samples} from '../../src/data/samples';
import {clone,documentSchema,validateDocument} from '../../src/core/model';
const total=samples.find(d=>d.id==='total-project-controls')!;
const SIDECAR='.datapass/diagramcloud.json';
type Repo={__repo:Record<string,string>;__fail?:'close';__land?:boolean};

/** In-memory folder picker whose write can fail after createWritable (window.__fail), optionally after the bytes landed (window.__land). */
function installFlakyPicker(){
 const w=window as unknown as Repo&{showDirectoryPicker:unknown};
 w.__repo={};
 const missing=()=>new DOMException('not found','NotFoundError');
 const file=(path:string)=>({getFile:async()=>new File([w.__repo[path]??''],path.split('/').pop()!),createWritable:async()=>{let buffer='';return{write:async(d:string)=>{buffer+=d;},close:async()=>{if(w.__fail==='close'){if(w.__land)w.__repo[path]=buffer;throw new DOMException('The handle was closed','InvalidStateError');}w.__repo[path]=buffer;}};}});
 const dir=(prefix:string,name:string):unknown=>({kind:'directory',name,requestPermission:async()=>'granted',
  getDirectoryHandle:async(child:string,o?:{create?:boolean})=>{const path=`${prefix}${child}/`;if(!o?.create&&!Object.keys(w.__repo).some(f=>f.startsWith(path)))throw missing();return dir(path,child);},
  getFileHandle:async(child:string,o?:{create?:boolean})=>{const path=`${prefix}${child}`;if(!(path in w.__repo)){if(!o?.create)throw missing();w.__repo[path]='';}return file(path);}});
 w.showDirectoryPicker=async()=>dir('','foil-repo');
}
const repoFile=(page:Page)=>page.evaluate(path=>(window as unknown as Repo).__repo[path],SIDECAR);
const failNext=(page:Page,fail:boolean,land=false)=>page.evaluate(([f,l])=>{const w=window as unknown as Repo;w.__fail=f?'close':undefined;w.__land=l;},[fail,land] as const);

async function linkRepository(page:Page){
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.evaluate(([path,text])=>{(window as unknown as Repo).__repo[path]=text;},[SIDECAR,JSON.stringify(clone(total),null,2)]);
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByRole('button',{name:'Open project folder…',exact:true}).click();
 await page.getByRole('dialog',{name:'JSON / AI workspace'}).getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.locator('.repo-status')).toContainText('in sync');
 await page.getByRole('button',{name:'Inspector',exact:true}).click();
}
async function editTitle(page:Page,title:string){await page.getByLabel('Project title').fill(title);await page.getByRole('button',{name:'Apply project',exact:true}).click();}
const save=(page:Page)=>page.locator('.repo-status').getByRole('button',{name:'Save to repository',exact:true}).click();

test.beforeEach(async({page})=>{await page.addInitScript(installFlakyPicker);});

test('an uncertain repository save says outcome unknown, then refuses a blind retry when the attempt is not on disk',async({page})=>{
 await linkRepository(page);const before=await repoFile(page);
 await editTitle(page,'Uncertain edit');await failNext(page,true);await save(page);
 await expect(page.getByRole('alert')).toContainText('Outcome unknown, not saved');
 await expect(page.getByRole('alert')).toContainText(`revision ${total.revision+1}`);
 await expect(page.locator('.repo-status')).toContainText('unsaved changes');
 await failNext(page,false);await save(page);
 await expect(page.getByRole('alert')).toContainText('did not confirm');
 await expect(page.getByRole('alert')).toContainText('Nothing was written');
 expect(await repoFile(page)).toBe(before);
 await expect(page.locator('.repo-status')).toContainText('unsaved changes');
});

test('an uncertain repository save that landed counts as saved on the next save',async({page})=>{
 await linkRepository(page);
 await editTitle(page,'Landed edit');await failNext(page,true,true);await save(page);
 await expect(page.getByRole('alert')).toContainText('Outcome unknown, not saved');
 await failNext(page,false);await save(page);
 await expect(page.locator('.repo-status')).toContainText('in sync');
 expect(JSON.parse(await repoFile(page)).title).toBe('Landed edit');
});

test('unsupported modules: cancel imports nothing, confirming imports the rest without them',async({page})=>{
 const doc={...validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-future-modules',title:'Synthetic future modules',rootViewId:'root',nodes:[{id:'app',label:'Synthetic application'}],edges:[],views:[{id:'root',title:'Synthetic scope',nodeIds:['app']}]})),runLedger:{grants:['publish']},brainLinks:[]};
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'JSON / AI workspace'});
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));await dialog.getByRole('button',{name:'Validate JSON',exact:true}).click();
 const review=dialog.getByRole('group',{name:'Unsupported modules'});
 await expect(review).toContainText('Unsupported: brainLinks, runLedger');
 await expect(dialog.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 await review.getByRole('button',{name:'Cancel import',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('Nothing was imported');
 await expect(dialog.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await review.getByRole('button',{name:'Import the rest without them',exact:true}).click();
 await expect(dialog.getByTestId('dropped-modules')).toContainText('brainLinks, runLedger');
 await dialog.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.locator('h1')).toHaveText('Synthetic future modules');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await dialog.getByRole('button',{name:'Load current JSON',exact:true}).click();
 const current=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue());
 expect(current.runLedger).toBeUndefined();expect(current.brainLinks).toBeUndefined();
});

test('attaching identical image bytes offers reuse or keep both, and keep both is never asked again for that pair',async({page})=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-duplicate-images',title:'Synthetic duplicate images',rootViewId:'root',nodes:[{id:'app',label:'Synthetic application'}],edges:[],views:[{id:'root',title:'Synthetic scope',nodeIds:['app']}]}));
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.locator('.react-flow__node').filter({hasText:'Synthetic application'}).first().click();
 const attach=(name:string)=>page.getByLabel('Attach image',{exact:true}).setInputFiles({name,mimeType:'image/png',buffer:png});
 await attach('chart.png');
 await expect(page.getByRole('group',{name:'Duplicate image'})).toHaveCount(0);
 await attach('chart-copy.png');
 const choice=page.getByRole('group',{name:'Duplicate image'});
 await expect(choice).toContainText('This image is already in the project');
 await choice.getByRole('button',{name:'Keep both',exact:true}).click();
 await expect(page.getByText(/^Kept both: /)).toBeVisible();
 await attach('chart-third.png');
 await choice.getByRole('button',{name:'Reuse existing image',exact:true}).click();
 await expect(page.getByText(/^Reused the existing image /)).toBeVisible();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByRole('button',{name:'Load current JSON',exact:true}).click();
 const current=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue());
 expect(current.assets).toHaveLength(2);
 expect(current.assets.every((a:{digest?:string})=>/^sha256:[0-9a-f]{64}$/.test(a.digest??''))).toBe(true);
 expect(current.assets[1].keptDistinctFrom).toEqual([current.assets[0].id]);
 expect(current.blocks.filter((b:{type:string})=>b.type==='image')).toHaveLength(3);
});
