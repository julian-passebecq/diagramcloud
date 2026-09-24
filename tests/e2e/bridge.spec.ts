import {test,expect,type Page} from '@playwright/test';
import {samples} from '../../src/data/samples';
import {clone} from '../../src/core/model';
const total=samples.find(d=>d.id==='total-project-controls')!;
const SIDECAR='.datapass/diagramcloud.json';

/** In-memory stand-in for window.showDirectoryPicker. Files live in window.__repo so the test can play DataPass/Git. */
function installRepositoryPicker(){
 const w=window as unknown as {__repo:Record<string,string>;showDirectoryPicker:unknown};
 w.__repo={};
 const missing=()=>new DOMException('not found','NotFoundError');
 const file=(path:string)=>({getFile:async()=>new File([w.__repo[path]??''],path.split('/').pop()!),createWritable:async()=>{let buffer='';return{write:async(d:string)=>{buffer+=d;},close:async()=>{w.__repo[path]=buffer;}};}});
 const dir=(prefix:string,name:string):unknown=>({kind:'directory',name,requestPermission:async()=>'granted',
  getDirectoryHandle:async(child:string,o?:{create?:boolean})=>{const path=`${prefix}${child}/`;if(!o?.create&&!Object.keys(w.__repo).some(f=>f.startsWith(path)))throw missing();return dir(path,child);},
  getFileHandle:async(child:string,o?:{create?:boolean})=>{const path=`${prefix}${child}`;if(!(path in w.__repo)){if(!o?.create)throw missing();w.__repo[path]='';}return file(path);}});
 w.showDirectoryPicker=async()=>dir('','foil-repo');
}
const repoFile=(page:Page)=>page.evaluate(path=>(window as unknown as {__repo:Record<string,string>}).__repo[path],SIDECAR);
const setRepoFile=(page:Page,text:string)=>page.evaluate(([path,value])=>{(window as unknown as {__repo:Record<string,string>}).__repo[path]=value;},[SIDECAR,text]);
const openFolder=async(page:Page)=>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByRole('button',{name:'Open project folder…',exact:true}).click();};

test.beforeEach(async({page})=>{await page.addInitScript(installRepositoryPicker);});

test('repository sidecar opens through review and saves back with a conflict guard',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 const fromRepo={...clone(total),title:'TotalEnergies | repository copy'};
 await setRepoFile(page,JSON.stringify(fromRepo,null,2));
 await page.evaluate(()=>{(window as unknown as {__repo:Record<string,string>}).__repo['.datapass/project.json']=JSON.stringify({project:{id:'total',title:'Total repo'},secrets:{token:'never shown'}});});

 // Open: validated and previewed, not applied yet.
 await openFolder(page);
 const dialog=page.getByRole('dialog',{name:'JSON / AI workspace'});
 await expect(dialog.getByText('foil-repo/.datapass/diagramcloud.json')).toBeVisible();
 await expect(dialog.getByText('DataPass project “Total repo”')).toBeVisible();
 await expect(dialog.getByText('never shown')).toHaveCount(0);
 await expect(dialog.locator('.change-preview')).toContainText('title');
 await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.locator('h1')).toHaveText('TotalEnergies | repository copy');
 await expect(page.locator('.repo-status')).toContainText('in sync');

 // Local edit, then save back to the repository file.
 await page.getByRole('button',{name:'Inspector',exact:true}).click();
 await page.getByLabel('Project title').fill('Edited in DiagramCloud');
 await page.getByRole('button',{name:'Apply project',exact:true}).click();
 await expect(page.locator('.repo-status')).toContainText('unsaved changes');
 await page.locator('.repo-status').getByRole('button',{name:'Save to repository',exact:true}).click();
 await expect(page.locator('.repo-status')).toContainText('in sync');
 const saved=JSON.parse(await repoFile(page));
 expect(saved.title).toBe('Edited in DiagramCloud');
 expect(saved.revision).toBe(total.revision+1);

 // DataPass applies a plan to the file meanwhile: DiagramCloud must refuse to overwrite it.
 await setRepoFile(page,JSON.stringify({...saved,title:'Changed by DataPass'},null,2)+'\n');
 await page.getByLabel('Project title').fill('Second local edit');
 await page.getByRole('button',{name:'Apply project',exact:true}).click();
 await page.locator('.repo-status').getByRole('button',{name:'Save to repository',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('changed after DiagramCloud last read it');
 expect(JSON.parse(await repoFile(page)).title).toBe('Changed by DataPass');

 // Reopen shows the newer repository version; the stale-revision guard needs an explicit backup-then-replace.
 await page.getByRole('button',{name:'Reopen repository file',exact:true}).click();
 await expect(dialog.locator('.revision-warning')).toContainText('Revision mismatch');
 await expect(dialog.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 const backup=page.waitForEvent('download');
 await dialog.getByRole('button',{name:'Back up local copy, then open repository version',exact:true}).click();
 expect((await backup).suggestedFilename()).toBe('total-project-controls.authoring.json');
 await expect(page.locator('h1')).toHaveText('Changed by DataPass');
 await expect(page.locator('.repo-status')).toContainText('in sync');
});

test('an invalid repository sidecar is rejected without touching the open project or the file',async({page})=>{
 await page.goto('/');
 const broken=JSON.stringify({...clone(total),nodes:[...clone(total).nodes,{id:'BAD ID',label:'x'}]});
 await setRepoFile(page,broken);
 await openFolder(page);
 const dialog=page.getByRole('dialog',{name:'JSON / AI workspace'});
 await expect(dialog.getByRole('alert')).toContainText('stable lowercase ID');
 await expect(dialog.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'Close dialog'}).click();
 await expect(page.getByRole('heading',{name:'Data Projects | constellation',exact:true})).toBeVisible();
 await expect(page.locator('.repo-status')).toHaveCount(0);
 expect(await repoFile(page)).toBe(broken);
});

test('a folder without a sidecar can create one from the open project',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await openFolder(page);
 const dialog=page.getByRole('dialog',{name:'JSON / AI workspace'});
 await expect(dialog.getByText('No .datapass/diagramcloud.json in foil-repo')).toBeVisible();
 await dialog.getByRole('button',{name:'Create repository file',exact:true}).click();
 await expect(dialog.getByText('in sync')).toBeVisible();
 const created=JSON.parse(await repoFile(page));
 expect(created.id).toBe('total-project-controls');
 expect(created.experience).toBeTruthy();
});
