import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {documentSchema,validateDocument} from '../src/core/model';
import {runConceptPreview} from '../scripts/concept-preview';
function fixture(t:{after:(fn:()=>void)=>void}){
 const root=mkdtempSync(join(tmpdir(),'dc-preview-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const input=join(root,'doc.json'),out=join(root,'out');
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'cli-test',title:'Synthetic CLI input',rootViewId:'root',edges:[],
  nodes:[{id:'app',label:'Private synthetic app',visibility:'private'}],views:[{id:'root',title:'Root',nodeIds:['app']}]}));
 writeFileSync(input,JSON.stringify(doc));return {root,input,out,doc,args:[input,'--view','root','--audience','author','--out',out,'--now','2026-10-14T12:00:00Z']};
}
test('CLI explicitly selected private output has checked bytes and does not change its input',async t=>{
 const f=fixture(t),before=readFileSync(f.input);const result=await runConceptPreview(f.args);assert.equal(result.audience,'author');
 const ready=JSON.parse(readFileSync(join(f.out,'READY.json'),'utf8'));assert.equal(ready.state,'LOCAL_CANDIDATE');
 for(const file of ready.files){const data=readFileSync(join(f.out,file.path));assert.equal(data.byteLength,file.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);}
 assert.deepEqual(readFileSync(f.input),before);assert.equal(readdirSync(f.out).length,5);
});
test('CLI never replaces an existing output directory',async t=>{
 const f=fixture(t);await runConceptPreview(f.args);const before=readFileSync(join(f.out,'READY.json'));
 await assert.rejects(runConceptPreview(f.args));assert.deepEqual(readFileSync(join(f.out,'READY.json')),before);
});
test('CLI requires explicit audience',async t=>{const f=fixture(t);await assert.rejects(runConceptPreview([f.input,'--view','root','--out',f.out]),/Usage/);assert.ok(!existsSync(f.out));});
test('CLI rejects unknown, duplicate and unsupported flags before IO',async t=>{
 const f=fixture(t);for(const args of [[...f.args,'--upload','yes'],[...f.args,'--view','other'],f.args.map(v=>v==='author'?'internal':v)])await assert.rejects(runConceptPreview(args));assert.ok(!existsSync(f.out));
});
test('CLI rejects invalid timestamps and malformed documents without creating output',async t=>{
 const f=fixture(t);await assert.rejects(runConceptPreview(f.args.map(v=>v==='2026-10-14T12:00:00Z'?'nonsense':v)),/timestamp/);
 writeFileSync(f.input,'not-json');await assert.rejects(runConceptPreview(f.args));assert.ok(!existsSync(f.out));
});
test('public CLI route cannot include a completely private selection',async t=>{const f=fixture(t);await assert.rejects(runConceptPreview(f.args.map(v=>v==='author'?'public':v)),/No components/);assert.ok(!existsSync(f.out));});
test('CLI source document does not confer authority to create missing parent directories',async t=>{
 const f=fixture(t);await assert.rejects(runConceptPreview(f.args.map(v=>v===f.out?join(f.root,'missing','output'):v)));assert.ok(!existsSync(join(f.root,'missing')));
});
