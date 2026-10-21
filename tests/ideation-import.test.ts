import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {stageImportText} from '../src/app/stageImport';import {buildFullStackPractice} from '../examples/interview-client/build';
const brief=()=>JSON.parse(readFileSync(new URL('../examples/idea-client/orchard.brief.json',import.meta.url),'utf8'));
const input=()=>({project:buildFullStackPractice().project,library:[],raw:JSON.stringify(brief()),importName:'ideas.json',completionRequest:null});
test('actual stage dispatcher prepares an ordinary Project without mutation or acceptance',async()=>{const x=input(),before=JSON.stringify(x),o=await stageImportText(x);assert.equal(o.staged.id,'ideas-'+brief().id);assert.equal(o.patched,null);assert.equal(o.staged.observations.length,0);assert.equal(JSON.stringify(x),before);});
test('existing current idea project is never overwritten by a repeat import',async()=>{const x=input(),o=await stageImportText(x);await assert.rejects(()=>stageImportText({...x,project:o.staged}),/already exists/);});
test('existing library project is never overwritten',async()=>{const x=input(),o=await stageImportText(x);await assert.rejects(()=>stageImportText({...x,library:[o.staged]}),/already exists/);});
test('malformed idea brief refuses before any project is staged',async()=>{const x=input(),b=brief();b.ideas[0].sourceIds=['missing'];await assert.rejects(()=>stageImportText({...x,raw:JSON.stringify(b)}),/Unresolved/);});
test('authored discussion content is always privately staged',async()=>{const x=input(),b=brief();b.visibility='private';b.provenance='supplied-discussion';const out=await stageImportText({...x,raw:JSON.stringify(b)});assert.ok(out.staged.nodes.every(n=>n.visibility==='private'));});
