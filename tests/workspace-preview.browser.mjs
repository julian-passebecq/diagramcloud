// Focused real React/browser subscription test; run separately from source units.
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const result=await build({entryPoints:[fileURLToPath(new URL('./fixtures/workspace-preview/probe.tsx',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',logLevel:'error'});
const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?result.outputFiles[0].text:'<div id="root"></div><script type="module" src="/probe.js"></script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Preview',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('output').textContent!=='none');
 const counts=await page.evaluate(()=>window.counts);assert.deepEqual(counts,{app:1,canvas:1,publisher:1,consumer:2});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({environment:'local headless Chromium React mount; not integrated app timing',counts,status:'passed'}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
