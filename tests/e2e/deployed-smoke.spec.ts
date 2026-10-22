import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {deploymentTarget,assertDeploymentHandshake} from '../../scripts/lib/e2eTarget';

// Existing Playwright runner, explicitly selected deployed scope; no new server,
// persistent profile, owner data, auth bypass or remote write endpoint.
const target=deploymentTarget(process.env);
if(!target)throw new Error('deployed-smoke.spec.ts requires all three DIAGRAMCLOUD deployment variables');
const selected=target;
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}
async function showPane(page:Page,name:'View'|'Explorer'){
 const panes=page.getByRole('navigation',{name:'Workspace panes',exact:true});
 if(await panes.isVisible())await panes.getByRole('button',{name,exact:true}).click();
}
async function readAuthorDocument(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const doc=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue());
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;
}
async function verifyIdentity(page:Page){
 const url=selected.origin+'/galaxy/version-handshake.json';
 const response=await page.request.get(url,{maxRedirects:0,timeout:15000});
 expect(response.status(),'Anonymous handshake must return 200 without sign-in or bypass').toBe(200);
 expect(response.headers()['content-type']).toMatch(/application\/json/);
 assertDeploymentHandshake(await response.json(),selected);
}
for(const width of [1440,390])test.describe('deployed smoke '+width,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',storageState:{cookies:[],origins:[]},serviceWorkers:'block'});
 test.beforeEach(async({page})=>{await verifyIdentity(page);});
 test('anonymous deep link keeps parent context without page errors',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto('/?project=total-project-controls&view=validation&node=mandatory');
  expect(response?.status()).toBe(200);expect(new URL(page.url()).origin).toBe(selected.origin);
  await expect(page.getByTestId('view-validation')).toBeVisible();
  await expect(page.getByTestId('view-overview')).toBeVisible();
  await expect(page.getByRole('button',{name:'Export & share',exact:true})).toBeVisible();
  await noOverflow(page);await page.screenshot({path:info.outputPath('deep-link.png'),fullPage:true});
  expect(errors).toEqual([]);await verifyIdentity(page);
 });
 test('synthetic import persists through real IndexedDB reload and public export withholds private text',async({page},info)=>{
  const errors:string[]=[],refusedRequests:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Editing is local to a new context. Refuse HTTP mutations and foreign hosts.
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD'].includes(request.method())||url.origin!==selected.origin){refusedRequests.push(request.method()+' '+url.origin+url.pathname);await route.abort('blockedbyclient');return;}
   await route.continue();
  });
  const doc=JSON.parse(readFileSync(new URL('../../examples/interview-client/beacon.project.json',import.meta.url),'utf8'));
  doc.id='deployment-smoke-'+width;doc.title='Synthetic deployment smoke '+width;
  const canary='PRIVATE_DEPLOYMENT_SMOKE_CANARY_'+width;
  // Clone an existing valid node without relationships; public projection must omit it.
  const hidden={...doc.nodes[0],id:'deployment-private-canary',label:canary,summary:canary,visibility:'private',blockIds:[],sourceIds:[]};
  delete hidden.childViewId;doc.nodes.push(hidden);
  const root=doc.views.find((view:{id:string})=>view.id===doc.rootViewId);
  root.nodeIds.push(hidden.id);root.positions[hidden.id]={x:600,y:340};
  await page.goto('/?workspace=v3');
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
  await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
  await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
  await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const stored=await page.evaluate(id=>new Promise<string>((resolve,reject)=>{
   const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const db=request.result,get=db.transaction('projects','readonly').objectStore('projects').get(id);
    get.onerror=()=>{db.close();reject(get.error);};get.onsuccess=()=>{const json=get.result?.json;db.close();typeof json==='string'?resolve(json):reject(Error('Stored synthetic copy missing'));};};
  }),doc.id);
  expect(JSON.parse(stored)).toEqual(doc);
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await page.goto('/?workspace=v3&project='+doc.id);
  await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  expect(await readAuthorDocument(page)).toEqual(doc);
  await showPane(page,'View');await noOverflow(page);
  await page.getByRole('button',{name:'Export & share',exact:true}).click();
  for(const [label,file] of [[/^Interactive HTML/,'synthetic.html'],[/^SVG diagram/,'synthetic.svg']] as const){
   const wait=page.waitForEvent('download');await page.getByRole('button',{name:label}).click();
   const download=await wait;expect(await download.failure()).toBeNull();
   const path=info.outputPath(file);await download.saveAs(path);
   const exported=readFileSync(path,'utf8');expect(exported.length).toBeGreaterThan(100);
   expect(exported).toContain('Business question');expect(exported).not.toContain(canary);
  }
  expect(refusedRequests).toEqual([]);expect(errors).toEqual([]);await verifyIdentity(page);
 });
});
