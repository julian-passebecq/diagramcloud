import {test,expect} from '@playwright/test';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {createServer,type ViteDevServer} from 'vite';
import {diagramWriter} from '../../src/shell/diagramWriter';

// R970: in `npm run dev`, a file of diagrams/ or templates/ opened directly never runs its own script in the dev origin,
// however its address is spelled and whatever its extension. A dev server with the shell's plugin runs on a temp folder.
const RUN='<script>document.documentElement.setAttribute("data-ran","1")</script>';
const SVG=`<svg xmlns="http://www.w3.org/2000/svg">${RUN}</svg>`;
const XHTML=`<html xmlns="http://www.w3.org/1999/xhtml"><body>${RUN}</body></html>`;
const HTML=`<!doctype html><html><body>${RUN}</body></html>`;
const FILES:Record<string,string>={'p.svg':SVG,'p.svgz':SVG,'p.html':HTML,'p.htm':HTML,'p.xhtml':XHTML,'p.xml':XHTML,'p.xht':XHTML,'noext':HTML,'wrong.txt':HTML};

let server:ViteDevServer;let base='';let root='';
test.beforeAll(async()=>{
 root=mkdtempSync(join(tmpdir(),'dc-shell-dev-'));
 for(const d of ['diagrams','templates','other'])mkdirSync(join(root,d));
 for(const [f,t] of Object.entries(FILES))writeFileSync(join(root,'diagrams',f),t);
 writeFileSync(join(root,'templates','t.svg'),SVG);writeFileSync(join(root,'other','control.html'),HTML);
 server=await createServer({configFile:false,root,logLevel:'silent',plugins:[diagramWriter(root)],server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false}});
 await server.listen();
 const addr=server.httpServer!.address() as {port:number};base=`http://127.0.0.1:${addr.port}`;
});
test.afterAll(async()=>{await server?.close();});

/** A raw GET with the path exactly as written (no URL normalisation). */
const get=(path:string)=>new Promise<{status:number;headers:Record<string,unknown>;body:string}>((done,fail)=>{
 const req=request(base+'/',{path,method:'GET'},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>done({status:res.statusCode??0,headers:res.headers,body}));});
 req.on('error',fail);req.end();
});

const spellings=()=>{const fs='/@fs/'+root.replaceAll('\\','/').replace(/^\//,'');return ['/diagrams/p.svg','/%64iagrams/p.svg','/diagrams/p%2Esvg','/diagrams/p%2esvg',
 fs+'/diagrams/p.svg','/./diagrams/p.svg','/other/../diagrams/p.svg','/other/%2e%2e/diagrams/p.svg','/templates/t.svg','/%74emplates/t.svg',
 ...Object.keys(FILES).map(f=>'/diagrams/'+f),...(process.platform==='linux'?[]:['/diagrams/P.SVG','/DIAGRAMS/p.html'])];};

test('every spelling and markup extension of a diagrams/ file is served sandboxed and never sniffed', async () => {
 for(const path of spellings()){
  const r=await get(path);
  if(r.status!==200)continue; // not served at all is fine too
  expect(r.headers['content-security-policy'],path).toBe('sandbox');
  expect(r.headers['x-content-type-options'],path).toBe('nosniff');
 }
 // The control: a file outside diagrams/ and templates/ gets no sandbox, so the check above is not vacuous.
 expect((await get('/other/control.html')).headers['content-security-policy']).toBeUndefined();
});

test('the real dev server (repo config) still shows the shell with its diagrams and groups', async ({page}) => {
 test.setTimeout(120000);
 // With HMR on, as `npm run dev` runs it: the shell's meta CSP (connect-src 'self') must not break the dev socket.
 const dev=await createServer({logLevel:'silent',server:{host:'127.0.0.1',port:0,strictPort:false}});
 const violations:string[]=[];page.on('console',m=>{if(/Content Security Policy|WebSocket/i.test(m.text()))violations.push(m.text());});
 try{
  await dev.listen();
  const port=(dev.httpServer!.address() as {port:number}).port;
  await page.goto(`http://127.0.0.1:${port}/shell.html`);
  await expect.poll(()=>page.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('/@vite/client')))).toBe(true);
  await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'API gateway'})).toBeVisible({timeout:60000});
  await page.getByRole('navigation',{name:'Diagrams'}).getByRole('button',{name:'floor-plan.svg'}).click();
  await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'Kitchen'})).toBeVisible();
  expect(violations).toEqual([]);
 }finally{await dev.close();}
});

test('opened directly in the dev server, a diagrams/ file runs no script, whatever the address', async ({page}) => {
 const ran=async(url:string)=>{
  try{await page.goto(base+url,{waitUntil:'load'});}catch{return 'not shown';} // a download is not a document
  await page.waitForTimeout(150);
  return await page.evaluate(()=>document.documentElement?.getAttribute('data-ran')??'no')==='1'?'ran':'no';
 };
 expect(await ran('/other/control.html')).toBe('ran'); // the probe works
 for(const url of spellings())expect(await ran(url),url).not.toBe('ran');
});
