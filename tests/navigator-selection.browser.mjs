// Actual React update regression: selecting a child must not collapse its ancestors.
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const result=await build({stdin:{contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {ProjectNavigator} from './src/ui/ProjectNavigator';import {validateDocument} from './src/core/model';
const project=validateDocument({schemaVersion:1,id:'tree-selection',title:'Tree',rootViewId:'root',edges:[],nodes:[{id:'parent',label:'Interfaces',childViewId:'children'},{id:'child',label:'Files',childViewId:'leaves'},{id:'leaf',label:'Records'}],views:[{id:'root',title:'Root',nodeIds:['parent']},{id:'children',title:'Children',nodeIds:['child']},{id:'leaves',title:'Leaves',nodeIds:['leaf']}]});
function Probe(){const [selected,setSelected]=useState();return <ProjectNavigator project={project} selectedNodeId={selected} onNode={setSelected} onView={()=>{}} onOverview={()=>{}}/>;}createRoot(document.getElementById('root')).render(<Probe/>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'esm',platform:'browser',jsx:'automatic',logLevel:'error'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?js:'<div id="root"></div><script type="module" src="/probe.js"></script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error(e);});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'Interfaces',exact:true}).click();await page.getByRole('button',{name:'Files',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Files',exact:true}).isVisible(),true,'selected child remains visible');
 await page.getByRole('button',{name:'Records',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Records',exact:true}).isVisible(),true,'all selected ancestors remain open');
 assert.equal(await page.getByRole('button',{name:'Records',exact:true}).getAttribute('aria-current'),'true');
 assert.equal(await page.locator('details[open]').count(),2);assert.deepEqual(errors,[]);
 console.log('PASS: selecting child and grandchild retains expanded ancestors and selected tree item');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
