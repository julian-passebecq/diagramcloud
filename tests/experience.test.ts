import test from 'node:test';
import assert from 'node:assert/strict';
import {examplePack} from '../src/experience/sample';
import {parsePack,publicPack,reviewReplacement,validatePack} from '../src/experience/model';
import {importCodeWiki,importDataPass} from '../src/experience/adapters';
import {samples} from '../src/data/samples';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {chartSvg,itemBody,itemSvg,workspaceHtml} from '../src/experience/render';

test('experience round trip retains stable references and layout',()=>{
 const p=examplePack();assert.deepEqual(parsePack(JSON.stringify(p)),p);
 const charts=p.items.filter(i=>i.type==='chart'&&i.dataItemId==='capex-data');assert.equal(charts.length,2);
 assert(p.workspaces.find(w=>w.id==='remix-screen')!.placements.some(s=>s.itemId==='quality-sql'));
});
test('bad references, duplicate IDs, cycles, overlaps and rows are rejected',()=>{
 let p=examplePack();p.workspaces[0].placements[0].itemId='missing';assert.throws(()=>validatePack(p),/unknown reference/);
 p=examplePack();p.entities[0].children.push(p.rootId);assert.throws(()=>validatePack(p),/cycle/);
 p=examplePack();p.workspaces[0].placements[1].x=0;assert.throws(()=>validatePack(p),/overlapping/);
 p=examplePack();p.items.push(p.items[0]);assert.throws(()=>validatePack(p),/Duplicate item/);
 p=examplePack();const t=p.items.find(i=>i.id==='capex-data');if(t?.type==='table')t.rows[0].pop();assert.throws(()=>validatePack(p),/Row width/);
});
test('chart series must be numeric and refer to named columns',()=>{
 const p=examplePack(),i=p.items.find(i=>i.id==='capex-chart');if(i?.type==='chart')i.valueColumns=['missing'];assert.throws(()=>validatePack(p),/unknown column/);
});
test('public projection removes private, draft and dependent chart content',()=>{
 const p=examplePack();p.items.find(i=>i.id==='capex-data')!.visibility='private';p.items.find(i=>i.id==='quality-sql')!.approval='draft';
 const safe=publicPack(p);assert(!safe.items.some(i=>['capex-data','capex-chart','capex-curve','quality-sql'].includes(i.id)));validatePack(safe);
});
test('private source removes public item that cites it',()=>{
 const p=examplePack();p.sources.find(s=>s.id==='portfolio-six')!.visibility='private';const safe=publicPack(p);assert(!safe.items.some(i=>i.sourceIds.includes('portfolio-six')));
});
test('code text is escaped and exports have no external fetch dependency',()=>{
 const p=examplePack(),i=p.items.find(i=>i.id==='quality-sql')!;if(i.type==='code')i.code='<script>window.HACKED=1</script>';
 const html=workspaceHtml(p,'quality-screen');assert(!html.includes('<script>window.HACKED'));assert(html.includes('&lt;script&gt;'));assert(html.includes('data-document-role="page"'));assert(!html.includes('<iframe'));
 assert(itemBody(p,i).includes('&lt;script&gt;'));assert(itemSvg(p,i).includes('&lt;script&gt;'));
});
test('SVG charts remain finite with zero/negative input',()=>{
 const p=examplePack(),t=p.items.find(i=>i.id==='capex-data'),c=p.items.find(i=>i.id==='capex-chart');
 if(t?.type==='table')t.rows=[['A',-5,-5],['B',0,-5]];if(c?.type==='chart'){const s=chartSvg(validatePack(p),c);assert(!/NaN|Infinity/.test(s));}
});
test('stale AI imports cannot replace a newer draft',()=>{
 const p=examplePack(),old=examplePack();p.revision=4;assert.throws(()=>reviewReplacement(p,old),/Revision conflict/);old.revision=4;assert.equal(reviewReplacement(p,old).workspaces,5);
});
test('DataPass adapter allows known declarations and drops paths commands and secrets',()=>{
 const p=importDataPass({schemaVersion:1,project:{id:'foil',title:'FOIL'},repositories:{code:{path:'/private/secretpath',label:'Bundle'}},platforms:{fabric:{workspaceId:'PRIVATE_ID'},grafana:{generatorCommand:'PRIVATE_COMMAND'},oracle:{sshHost:'PRIVATE_HOST'},newthing:{secret:'PRIVATE_SECRET'}},links:[{url:'https://secret.example'}]});
 const text=JSON.stringify(p);assert(!/PRIVATE_|secretpath|secret.example/.test(text));assert.equal(p.entities.length,5);assert(p.entities.every(e=>e.visibility==='private'));assert.throws(()=>importDataPass({schemaVersion:2,project:{id:'x',title:'X'}}));
});
test('CodeWiki adapter imports observed tree shape, deduplicates symbols and invents no tasks',()=>{
 const p=importCodeWiki({Core:{path:'src/core',components:['src/a.ts::A'],children:{Inner:{components:['src/a.ts::A','src/b.ts::B'],children:{}}}}});
 assert.equal(p.entities.filter(e=>e.type==='component').length,2);assert(!p.entities.some(e=>e.type==='task'));assert(p.entities.every(e=>e.visibility==='private'));assert.equal(p.items.length,0);assert.throws(()=>importCodeWiki({Core:'bad'}));
});


test('canonical project persistence validates workspace links and redacts nested private content',()=>{
 const d=structuredClone(samples[0]);d.experience=examplePack();d.nodes[0].experienceWorkspaceId='quality-screen';
 assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(d))),d);
 d.experience.items.find(i=>i.id==='quality-sql')!.visibility='private';
 const safe=publicDocument(d);assert(!safe.experience?.items.some(i=>i.id==='quality-sql'));
 d.nodes[0].experienceWorkspaceId='unknown';assert.throws(()=>validateDocument(d),/workspace/i);
});
