import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {startConceptHost,type LocalConceptHost} from '../../scripts/concept-host';
import {documentSchema,validateDocument} from '../../src/core/model';

const viewerPath=process.env.DIAGRAMCLOUD_MOSAIC_VIEWER;
const digest=process.env.DIAGRAMCLOUD_MOSAIC_VIEWER_SHA256;
test.describe('native owner concept viewer in isolated local host',()=>{
 test.skip(!viewerPath||!digest,'Set DIAGRAMCLOUD_MOSAIC_VIEWER and DIAGRAMCLOUD_MOSAIC_VIEWER_SHA256 to explicitly select the owner artifact.');
 let host:LocalConceptHost;
 test.beforeEach(async()=>{
  const bytes=readFileSync(viewerPath!);expect(createHash('sha256').update(bytes).digest('hex')).toBe(digest);
  const document=validateDocument(documentSchema.parse({schemaVersion:1,id:'native-host-fixture',title:'Synthetic local qualification',rootViewId:'root',nodes:[{id:'app',label:'App',kind:'app',basis:'planned'},{id:'store',label:'Store',kind:'storage',basis:'planned'}],edges:[{id:'reads',source:'app',target:'store',label:'reads',kind:'query',basis:'planned'}],views:[{id:'root',title:'Synthetic architecture',nodeIds:['app','store'],edgeIds:['reads'],positions:{}}]}));
  host=await startConceptHost({document,viewId:'root',audience:'public',viewerHtml:bytes,viewerSha256:digest!,diagramcloudOrigin:'http://localhost:39292'});
 });
 test.afterEach(async()=>{await host?.close();});
 test('actual load/ready, both SVGs, exact-source messages and source mapping boundary',async({page},testInfo)=>{
  const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith(host.origin+'/')&&!r.url().startsWith(host.viewerOrigin+'/')&&!/^(data|blob):/.test(r.url()))external.push(r.url());});
  await page.goto(host.url);const frame=page.frameLocator('#viewer'),inner=frame.getByTestId('concept-viewer');
  await expect(page.locator('#status')).toHaveAttribute('data-result','accepted');await expect(inner).toHaveAttribute('data-spec',host.packet.projection.spec.id);await expect(inner).toHaveAttribute('data-view','layered');await expect(frame.locator('[data-testid=concept-layered] svg')).toBeVisible();
  await page.getByRole('button',{name:'Isometric 2D',exact:true}).click();await expect(inner).toHaveAttribute('data-view','isometric');await expect(frame.locator('[data-testid=concept-isometric] svg').first()).toBeVisible();
  await page.getByRole('combobox',{name:'Theme',exact:true}).selectOption('dark');await expect(inner).toHaveAttribute('data-theme','dark');
  await page.screenshot({path:testInfo.outputPath('native-isometric-dark.png'),fullPage:true});
  await expect(page.locator('#viewer')).toHaveAttribute('sandbox','allow-scripts allow-same-origin');await expect(page.locator('#mapping button').first()).toBeDisabled();
  const before=await page.locator('#status').textContent();await page.evaluate(()=>window.postMessage({type:'datapass.concept-spec/ready',specVersion:'1.0.0',result:{ok:false,issues:[]}},location.origin));await expect(page.locator('#status')).toHaveText(before!);
  await expect(page.getByText(/separate from selection inside the viewer/)).toBeVisible();expect(external).toEqual([]);
 });
 test('real WebGL scene, reduced motion, selection and disposal; context loss is explicitly limited',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(host.url);await expect(page.locator('#status')).toHaveAttribute('data-result','accepted');
  const frame=page.frameLocator('#viewer');await page.getByRole('button',{name:'3D scene',exact:true}).click();const canvas=frame.locator('canvas[data-renderer=concept-webgl2]');
  await expect(canvas).toBeVisible();await expect(frame.locator('.aa-canvas')).toHaveAttribute('data-settled','true');
  await frame.locator('.aa-label[data-node]').first().click();await expect(frame.getByTestId('concept-viewer')).not.toHaveAttribute('data-selection','none');
  await page.screenshot({path:testInfo.outputPath('native-webgl-selected.png'),fullPage:true});
  await expect(page.getByText('Automatic context-loss recovery is unqualified for this owner artifact.',{exact:false})).toBeVisible();
  // Diagnose a real loss; this qualifies manual return to SVG, not automatic owner recovery or restoration.
  const lost=await canvas.evaluate(el=>new Promise<boolean>(resolve=>{const gl=(el as HTMLCanvasElement).getContext('webgl2'),extension=gl?.getExtension('WEBGL_lose_context');if(!extension){resolve(false);return;}el.addEventListener('webglcontextlost',()=>resolve(true),{once:true});extension.loseContext();setTimeout(()=>resolve(false),3000);}));expect(lost).toBe(true);
  await page.getByRole('button',{name:'Layered 2D',exact:true}).click();await expect(canvas).toHaveCount(0);await expect(frame.locator('[data-testid=concept-layered] svg')).toBeVisible();
  expect(await frame.locator('body').evaluate(()=>!!(window as unknown as {__conceptStage?:unknown}).__conceptStage)).toBe(false);
 });
 test('unavailable WebGL retains explicit useful SVG modes and accessible controls',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...args:unknown[]){if(kind==='webgl2')return null;return Reflect.apply(original,this,[kind,...args]);} as typeof original;});
  await page.goto(host.url);await expect(page.locator('#status')).toHaveAttribute('data-result','accepted');await page.getByRole('button',{name:'3D scene',exact:true}).click();const frame=page.frameLocator('#viewer');await expect(frame.getByRole('status').filter({hasText:'WebGL2 is unavailable'})).toBeVisible();
  await page.getByRole('button',{name:'Isometric 2D',exact:true}).click();await expect(frame.locator('[data-testid=concept-isometric] svg').first()).toBeVisible();await page.getByRole('button',{name:'Layered 2D',exact:true}).click();await expect(frame.locator('[data-testid=concept-layered] svg')).toBeVisible();
  await page.getByRole('button',{name:'Layered 2D',exact:true}).focus();await expect(page.getByRole('button',{name:'Layered 2D',exact:true})).toBeFocused();
 });
 test('only the explicitly authorized opener receives hello and separate manual source mapping',async({page})=>{
  const openerHtml='<!doctype html><title>DiagramCloud test opener</title><script>window.received=[];addEventListener("message",e=>window.received.push({data:e.data,origin:e.origin}));</script>';
  for(const origin of ['http://localhost:39292','http://localhost:39293'])await page.route(origin+'/**',route=>route.fulfill({status:200,contentType:'text/html',body:openerHtml}));
  await page.goto('http://localhost:39293/');
  const attackerPopup=page.waitForEvent('popup');await page.evaluate(url=>window.open(url),host.url+'?diagramcloudOrigin='+encodeURIComponent('http://localhost:39293'));
  const denied=await attackerPopup;await expect(denied.locator('#status')).toHaveAttribute('data-result','accepted');await expect(denied.locator('#mapping button').first()).toBeDisabled();
  expect(await page.evaluate(()=>(window as unknown as {received:unknown[]}).received)).toEqual([]);await denied.close();
  await page.goto('http://localhost:39292/');const authorizedPopup=page.waitForEvent('popup');await page.evaluate(url=>window.open(url),host.url+'?diagramcloudOrigin='+encodeURIComponent('http://localhost:39292'));
  const allowed=await authorizedPopup;await expect.poll(()=>page.evaluate(()=>(window as unknown as {received:unknown[]}).received.length)).toBe(1);
  const hello=await page.evaluate(()=>(window as unknown as {received:{data:unknown;origin:string}[]}).received[0]);expect(hello.origin).toBe(host.origin);expect(hello.data).toEqual({format:'diagramcloud.concept-host-ready',version:1,projectionSha256:host.packet.projectionSha256,projectId:host.packet.projectId,baseRevision:host.packet.baseRevision,viewId:host.packet.viewId});
  await allowed.locator('#mapping button[data-kind=node]').first().click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {received:unknown[]}).received.length)).toBe(2);
  const pick=await page.evaluate(()=>(window as unknown as {received:{data:{format:string;projectionSha256:string};origin:string}[]}).received[1]);expect(pick.origin).toBe(host.origin);expect(pick.data.format).toBe('diagramcloud.concept-pick');expect(pick.data.projectionSha256).toBe(host.packet.projectionSha256);await allowed.close();
 });
});
