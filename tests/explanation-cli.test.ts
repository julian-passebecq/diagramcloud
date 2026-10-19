import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateDocument} from '../src/core/model';
import {walkthroughFingerprint} from '../src/intelligence/explanationWalkthrough';
import {prepareExplanationFiles} from '../scripts/prepare-explanation';
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dc-explain-'));
 const p=validateDocument({schemaVersion:1,tours:[],id:'example',title:'Example',rootViewId:'root',edges:[],nodes:[{id:'api',label:'API'}],views:[{id:'root',title:'Root',nodeIds:['api']}]});
 const r={format:'diagramcloud.explanation-walkthrough',version:1,id:'walk',projectId:p.id,baseRevision:p.revision,baseFingerprint:walkthroughFingerprint(p),title:'Explain an API',question:'What is it?',steps:[{id:'one',title:'Purpose',viewId:'root',nodeIds:['api'],narration:'Authored example.'}]};
 await fs.writeFile(path.join(root,'project.json'),JSON.stringify(p));await fs.writeFile(path.join(root,'request.json'),JSON.stringify(r));
 return {root,args:['--project',path.join(root,'project.json'),'--request',path.join(root,'request.json'),'--out',path.join(root,'result')]};
}
test('offline preparation writes native patch/preview/map but changes neither input',async()=>{
 const f=await fixture();try{const before=await fs.readFile(f.args[1]);const r=await prepareExplanationFiles(f.args);assert.equal(r.files.length,3);assert.deepEqual(await fs.readFile(f.args[1]),before);
  assert.equal(JSON.parse(await fs.readFile(path.join(r.output,'explanation-map.json'),'utf8')).applied,false);
  await assert.rejects(prepareExplanationFiles(f.args),/EEXIST/);
 }finally{await fs.rm(f.root,{recursive:true,force:true});}
});
for(const bad of [[],['--execute','anything'],['--project','a','--request','b','--out','--delete'],['--project','a','--request','b','--out','c','--force']])test('offline CLI refuses unsupported arguments '+JSON.stringify(bad),async()=>{await assert.rejects(prepareExplanationFiles(bad),/Usage/);});
test('invalid request refuses before creating the output folder',async()=>{
 const f=await fixture();try{await fs.writeFile(f.args[3],'{bad');await assert.rejects(prepareExplanationFiles(f.args));await assert.rejects(fs.stat(f.args[5]),{code:'ENOENT'});}finally{await fs.rm(f.root,{recursive:true,force:true});}
});
test('source drift refuses before output creation',async()=>{
 const f=await fixture();try{const p=JSON.parse(await fs.readFile(f.args[1],'utf8'));p.nodes[0].label='Changed';await fs.writeFile(f.args[1],JSON.stringify(p));await assert.rejects(prepareExplanationFiles(f.args),/source changed/);await assert.rejects(fs.stat(f.args[5]),{code:'ENOENT'});}finally{await fs.rm(f.root,{recursive:true,force:true});}
});
test('non-UTF8 input is refused, not silently repaired',async()=>{
 const f=await fixture();try{await fs.writeFile(f.args[3],Buffer.from([255,254,253]));await assert.rejects(prepareExplanationFiles(f.args),/UTF-8/);}finally{await fs.rm(f.root,{recursive:true,force:true});}
});
