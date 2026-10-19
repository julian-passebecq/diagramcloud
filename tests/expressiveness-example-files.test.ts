import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {validateDocument,parseDocument} from '../src/core/model';
import {prepareExplanationWalkthrough} from '../src/intelligence/explanationWalkthrough';
import {EXAMPLES_DIR,expressivenessExampleFiles} from '../scripts/generate-expressiveness-examples';

const read=(name:string)=>fs.readFileSync(path.join(EXAMPLES_DIR,name),'utf8').replace(/\r\n/g,'\n');
const expected=expressivenessExampleFiles();
const projects=Object.keys(expected).filter(n=>n.endsWith('.project.json'));

test('six committed synthetic example projects are regenerated exactly from cases.ts',()=>{
 assert.equal(projects.length,6);
 for(const [name,content] of Object.entries(expected))assert.equal(read(name),content,`${name} is stale: run tsx scripts/generate-expressiveness-examples.ts`);
});
for(const name of projects)test(`example ${name} validates, is labelled synthetic and carries no observation`,()=>{
 const doc=parseDocument(read(name));
 assert.deepEqual(validateDocument(doc),doc);
 assert.equal(doc.observations.length,0);
 assert.match(doc.provenance,/synthetic/i);
 assert.ok(doc.blocks.every(b=>b.provenance==='synthetic'||b.provenance==='author'),'only synthetic or authored explanation blocks');
});
for(const name of Object.keys(expected).filter(n=>n.endsWith('.walkthrough.json')))test(`example ${name} prepares against its committed base without changing it`,()=>{
 const base=parseDocument(read(name.replace('.walkthrough.json','.base.json'))),before=JSON.stringify(base);
 const out=prepareExplanationWalkthrough(base,JSON.parse(read(name)));
 assert.equal(out.preview.observations.length,0);
 assert.equal(JSON.stringify(base),before);
});
