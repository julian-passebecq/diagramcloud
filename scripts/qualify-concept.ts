/**
 * Cross-app qualification of the MosaicStudio adapter: load DiagramCloud concept exports into MosaicStudio's own
 * standalone viewer through its embed API (postMessage `datapass.concept-spec/load`) and record the viewer's verdict.
 *   npx tsx scripts/qualify-concept.ts <concept-viewer.html> [--out dir] [sample/view …]
 * The viewer is not bundled here (it belongs to datapass-mosaicstudio); pass a local copy. Headless Chromium, no
 * network: any request that is not file:, data: or blob: fails the run.
 */
import {copyFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
import {samples} from '../src/data/samples';
import {conceptSpec} from '../src/export/concept';

const args=process.argv.slice(2),flag=(n:string)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:undefined;};
const out=resolve(flag('--out')??'test-results/concept-qualification'),viewer=args.shift();
if(!viewer){console.error('Usage: npx tsx scripts/qualify-concept.ts <concept-viewer.html> [--out dir] [sample/view …]');process.exit(2);}
const targets=args.length?args:['contoso-forecasting/overview','contoso-forecasting/fabric-target','total-project-controls/overview'];
mkdirSync(out,{recursive:true});copyFileSync(viewer,`${out}/concept-viewer.html`);
const browser=await chromium.launch(),results:{target:string;ok:boolean;warnings:unknown[];network:string[];screenshot:string}[]=[];
for(const target of targets){
 const [sampleId,viewId]=target.split('/'),doc=samples.find(s=>s.id===sampleId);
 if(!doc){console.error(`Unknown sample ${sampleId}`);process.exit(2);}
 const {spec}=conceptSpec(doc,viewId),name=target.replace('/','.');
 writeFileSync(`${out}/${name}.concept.json`,JSON.stringify(spec,null,2)+'\n');
 writeFileSync(`${out}/${name}.host.html`,`<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe id="c" src="concept-viewer.html" style="width:1500px;height:950px;border:0"></iframe><script>
const spec=${JSON.stringify(JSON.stringify(spec)).replace(/</g,'\\u003c')};let sent=false;window.result=null;
addEventListener('message',e=>{if(e.data?.type!=='datapass.concept-spec/ready')return;if(!sent){sent=true;document.getElementById('c').contentWindow.postMessage({type:'datapass.concept-spec/load',spec,options:{view:'layered',fit:true,chrome:'embed'}},'*');}else if(e.data.result)window.result=e.data.result;});
</script>`);
 const page=await browser.newPage({viewport:{width:1500,height:950}}),network:string[]=[];
 page.on('request',r=>{if(!/^(file|data|blob):/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(`${out}/${name}.host.html`).href);
 await page.waitForFunction(()=>(window as unknown as {result:unknown}).result,null,{timeout:30000});
 const result=await page.evaluate(()=>(window as unknown as {result:{ok:boolean;warnings?:unknown[]}}).result);
 await page.waitForTimeout(800);await page.screenshot({path:`${out}/${name}.png`});await page.close();
 results.push({target,ok:result.ok,warnings:result.warnings??[],network,screenshot:`${name}.png`});
}
await browser.close();
writeFileSync(`${out}/result.json`,JSON.stringify({viewer,generatedAt:new Date().toISOString(),results},null,2)+'\n');
for(const r of results)console.log(`${r.ok&&!r.warnings.length&&!r.network.length?'PASS':'FAIL'} ${r.target}: ok=${r.ok} warnings=${r.warnings.length} network=${r.network.length}`);
process.exit(results.every(r=>r.ok&&!r.warnings.length&&!r.network.length)?0:1);
