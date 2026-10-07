import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DESIGN_TYPES} from '../src/core/model';
import {validateManifest} from '../src/core/atlas';
import {applyDesignBrief,parseDesignBrief} from '../src/core/designBrief';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
import {contosoForecasting} from '../src/data/contosoForecasting';

/** docs/AI_GUIDE.md is read by agents as instructions: its examples, figure types, commands and links must stay true. */
const guide=readFileSync('docs/AI_GUIDE.md','utf8'),blocks=[...guide.matchAll(/```json\n([\s\S]*?)```/g)].map(m=>JSON.parse(m[1]));
const byFormat=(f:string)=>{const b=blocks.find(x=>x.format===f);assert.ok(b,`the guide has a ${f} example`);return b;};

test('AI guide: every JSON example passes the real validator and applies cleanly',()=>{
 assert.equal(blocks.length,3);
 const manifest=validateManifest(byFormat('diagramcloud.project-manifest'));assert.equal(manifest.repositories.length,2);
 const brief=applyDesignBrief(contosoForecasting(),parseDesignBrief(JSON.stringify(byFormat('diagramcloud.design-brief'))));
 assert.equal(brief.document.views.find(v=>v.id==='overview')!.design?.type,'exploded');assert.deepEqual(brief.report.lost,[],'nothing in the example brief is dropped');
 const {result}=applyDocumentPatch(contosoForecasting(),byFormat('diagramcloud.patch'));
 const q=result.edges.find(e=>e.id==='overview-e0')!.quantity;assert.deepEqual(q,{value:1200,unit:'rows/day',provenance:'synthetic',note:'Illustrative, not measured.'});
 assert.ok(publicDocument(result).edges.find(e=>e.id==='overview-e0')!.quantity,'the quantity survives public export');
});

test('AI guide: figure types, counts, commands and file links match the code',()=>{
 const figures=DESIGN_TYPES.filter(t=>t!=='auto');
 assert.match(guide,new RegExp(`one of ${figures.length} figure types`));
 const table=guide.slice(guide.indexOf('## 5.'),guide.indexOf('## 6.'));
 for(const t of figures)assert.ok(table.includes(`\`${t}\``),`figure ${t} is in the chooser table`);
 for(const t of [...table.matchAll(/`([a-z]+)`/g)].map(m=>m[1]).filter(t=>t!=='type'&&t!=='quantity'))assert.ok((DESIGN_TYPES as readonly string[]).includes(t),`${t} is a real figure type`);
 const scripts=Object.keys(JSON.parse(readFileSync('package.json','utf8')).scripts);
 for(const s of new Set([...guide.matchAll(/npm run ([a-z:-]+)/g)].map(m=>m[1])))assert.ok(scripts.includes(s),`npm run ${s} exists`);
 for(const f of new Set([...guide.matchAll(/`((?:src|docs|skills|tests)\/[\w./-]+)`/g),...readFileSync('llms.txt','utf8').matchAll(/\]\(([\w./-]+)\)/g)].map(m=>m[1])))assert.ok(existsSync(f),`${f} exists`);
});
