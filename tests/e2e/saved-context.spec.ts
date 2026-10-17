import {test,expect,type Page} from '@playwright/test';
import {clone,documentSchema,validateDocument,type Project} from '../../src/core/model';

const PRIVATE='SYNTHETIC_PRIVATE_SAVED_CONTEXT_LABEL';
function fixture(id:string):Project{return validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic saved context studio',rootViewId:'root',summary:'Synthetic UI pointers only; no external runtime facts.',
 nodes:[{id:'parent',label:'Synthetic parent',childViewId:'child'},{id:'other',label:'Synthetic other'},{id:'code',label:'Synthetic child code'},{id:'store',label:'Synthetic child store'},
  {id:'secret',label:PRIVATE,visibility:'private'}],
 edges:[{id:'flow',source:'code',target:'store',label:'Synthetic flow'}],
 views:[{id:'root',title:'Synthetic saved root',nodeIds:['parent','other','secret'],positions:{parent:{x:0,y:0},other:{x:300,y:0},secret:{x:600,y:0}}},
  {id:'child',title:'Synthetic saved child',nodeIds:['code','store'],edgeIds:['flow'],positions:{code:{x:0,y:0},store:{x:300,y:0}}}]}));}
const panel=(page:Page)=>page.getByTestId('saved-contexts');
async function ready(page:Page){await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();}
async function importDoc(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function openNavigate(page:Page){await page.getByRole('button',{name:'Navigate',exact:true}).click();await expect(panel(page)).toBeVisible();}
async function revision(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const value=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()).revision as number;await page.getByRole('button',{name:'Close dialog',exact:true}).click();return value;}
const dimension=(page:Page,name:string)=>panel(page).locator(`[data-dimension="${name}"]`);

test('a saved context restores path, view and selection after reload; a removed target falls back while valid dimensions stay',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const doc=fixture('synthetic-saved-context');
 await page.goto('/');await ready(page);await importDoc(page,doc);
 await page.getByTestId('view-root').getByRole('button',{name:'Explore Synthetic parent',exact:true}).click();
 const child=page.getByTestId('view-child');await expect(child).toBeVisible();
 await child.getByRole('button',{name:'Explore Synthetic child code',exact:true}).click();
 await openNavigate(page);
 await panel(page).getByLabel('Saved context name',{exact:true}).fill('Code detail');await panel(page).getByRole('button',{name:'Save context',exact:true}).click();
 await expect(panel(page).getByRole('status')).toContainText('Saved “Code detail” in this browser.');
 const stored=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('diagramcloud.saved-contexts.v1:')).map(k=>[k,localStorage.getItem(k)!]));
 expect(stored).toHaveLength(1);expect(stored[0][0]).toContain('"author"');expect(stored[0][1]).not.toContain('Synthetic child code');expect(stored[0][1]).toContain('"selected":"code"');

 // Reload: the session history is gone; the saved context is not. Restoring changes no revision.
 await page.goto('/?project='+doc.id);await ready(page);await expect(page.getByTestId('view-child')).toHaveCount(0);
 const before=await revision(page);await openNavigate(page);const restore=panel(page).getByRole('button',{name:'Restore Code detail',exact:true});
 await restore.focus();await page.keyboard.press('Enter');
 await expect(page.getByTestId('view-child')).toBeVisible();await expect(page.getByTestId('view-root')).toBeVisible();
 for(const name of ['path','view','selection','sheet'])await expect(dimension(page,name)).toHaveAttribute('data-state','kept');
 expect(await revision(page)).toBe(before);

 // A newer revision removes the saved component from the child view: the selection falls back, path and view stay.
 const next=clone(doc);next.revision=before;const view=next.views.find(v=>v.id==='child')!;view.nodeIds=['store'];view.edgeIds=[];delete view.positions.code;next.edges=[];
 await importDoc(page,validateDocument(next));await openNavigate(page);
 await panel(page).getByRole('button',{name:'Restore Code detail',exact:true}).click();
 await expect(page.getByTestId('view-child')).toBeVisible();
 await expect(dimension(page,'selection')).toHaveAttribute('data-state','fallback');await expect(dimension(page,'selection')).toContainText('unavailable in the current permitted document');
 await expect(dimension(page,'view')).toHaveAttribute('data-state','kept');await expect(dimension(page,'path')).toHaveAttribute('data-state','kept');
 expect(errors).toEqual([]);
});

test('public modes never read author saved contexts and never store private targets',async({page})=>{
 const doc=fixture('synthetic-saved-context-public');
 await page.goto('/');await ready(page);await importDoc(page,doc);await openNavigate(page);
 await panel(page).getByRole('button',{name:'Save context',exact:true}).click();await expect(panel(page).locator('[data-saved-context]')).toHaveCount(1);
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await openNavigate(page);
 await expect(panel(page).locator('[data-saved-context]')).toHaveCount(0);await expect(panel(page)).toContainText('No saved context for this project yet.');
 await panel(page).getByRole('button',{name:'Save context',exact:true}).click();await expect(panel(page).locator('[data-saved-context]')).toHaveCount(1);
 const values=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('diagramcloud.saved-contexts.v1:')).map(k=>k+localStorage.getItem(k)));
 expect(values).toHaveLength(2);expect(values.filter(v=>v.includes('"public"'))).toHaveLength(1);for(const v of values)expect(v).not.toContain(PRIVATE);
 await page.getByRole('tab',{name:'Edit',exact:true}).click();await openNavigate(page);await expect(panel(page).locator('[data-saved-context]')).toHaveCount(1);
});

test('corrupt saved contexts stay untouched until cleared; another tab’s save reloads the list',async({page,context})=>{
 const doc=fixture('synthetic-saved-context-recovery');
 await page.goto('/');await ready(page);await importDoc(page,doc);
 const key=await page.evaluate(id=>`diagramcloud.saved-contexts.v1:${JSON.stringify([id,'author',location.host])}`,doc.id);
 await page.evaluate(key=>localStorage.setItem(key,'{corrupt'),key);
 await page.goto('/?project='+doc.id);await ready(page);await openNavigate(page);
 await expect(panel(page).getByRole('alert')).toContainText('cannot be read');await expect(panel(page).getByRole('button',{name:'Save context',exact:true})).toHaveCount(0);
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('{corrupt');
 await panel(page).getByRole('button',{name:'Clear saved contexts',exact:true}).click();await expect(panel(page).getByRole('button',{name:'Save context',exact:true})).toBeVisible();

 const other=await context.newPage();await other.goto('/?project='+doc.id);await ready(other);await openNavigate(other);
 await panel(other).getByLabel('Saved context name',{exact:true}).fill('From another tab');await panel(other).getByRole('button',{name:'Save context',exact:true}).click();
 await expect(panel(page).getByRole('status')).toContainText('changed in another tab');await expect(panel(page).getByRole('button',{name:'Restore From another tab',exact:true})).toBeVisible();
 // A save in this tab keeps the other tab's entry (read-modify-write against the freshest value).
 await panel(page).getByRole('button',{name:'Save context',exact:true}).click();await expect(panel(page).locator('[data-saved-context]')).toHaveCount(2);await other.close();
});

test('blocked browser storage keeps navigation usable and says contexts cannot be kept',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Blocked','SecurityError');}});});
 await page.goto('/');await ready(page);await openNavigate(page);
 await expect(panel(page).getByRole('alert')).toContainText('Browser storage is unavailable here');await expect(panel(page).getByRole('button',{name:'Save context',exact:true})).toHaveCount(0);
});

test('saved contexts fit a real 390x844 phone viewport without horizontal scroll',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await ready(page);
 const toggle=page.getByRole('button',{name:'Navigate',exact:true});if(!(await toggle.isVisible()))test.skip(true,'Sidebar is not shown at this width');
 await openNavigate(page);await panel(page).getByRole('button',{name:'Save context',exact:true}).click();await expect(panel(page).locator('[data-saved-context]')).toHaveCount(1);
 const save=panel(page).getByRole('button',{name:'Save context',exact:true});await save.scrollIntoViewIfNeeded();const box=await save.boundingBox();expect(box&&box.x>=0&&box.x+box.width<=390).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('a project opened before the local workspace answers stays open (no reset to the first sample)',async({page})=>{
 // Delay IndexedDB open until the test releases it, so the click lands before loadWorkspace resolves.
 await page.addInitScript(()=>{
  const real=IDBFactory.prototype.open;let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});(window as unknown as {releaseIdb:()=>void}).releaseIdb=()=>release();
  IDBFactory.prototype.open=function(this:IDBFactory,...args:[string,number?]){
   const factory=this,fake:Record<string,unknown>={onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};let req:IDBOpenDBRequest|undefined;
   Object.defineProperty(fake,'result',{get:()=>req!.result});Object.defineProperty(fake,'error',{get:()=>req?.error??null});
   void gate.then(()=>{req=real.apply(factory,args);for(const ev of ['success','error','upgradeneeded','blocked'])req.addEventListener(ev,e=>{const h=fake['on'+ev];if(typeof h==='function')h.call(fake,e);});});
   return fake as unknown as IDBOpenDBRequest;
  };
 });
 await page.goto('/');await expect(page.getByText('Opening local workspace…',{exact:true})).toBeVisible();
 await page.locator('.project-card').filter({hasText:'Microsoft Fabric'}).click();await expect(page.getByRole('heading',{name:'Microsoft Fabric',exact:true})).toBeVisible();
 const hero=page.locator('.project-hero');await expect(hero.getByRole('heading',{name:'Microsoft Fabric',exact:true})).toBeVisible();
 await page.evaluate(()=>(window as unknown as {releaseIdb:()=>void}).releaseIdb());await ready(page);
 await expect(hero.getByRole('heading',{name:'Microsoft Fabric',exact:true})).toBeVisible();await expect(hero.getByRole('heading',{name:'Data Projects | constellation',exact:true})).toHaveCount(0);
});
