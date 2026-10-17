import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scanRepository,wantedFile,MAX_FILES} from '../src/core/scan/scanner';
import {scanToDocument,scanPickedFolder,INSTRUCTION_FILE} from '../src/core/scan';
import {validateDocument,documentSchema,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {compileProjectBrief} from '../src/intelligence/brief';
import {completeForPurpose,projectCompleteFor,projectReadiness} from '../src/intelligence/readiness';
import {PURPOSES} from '../src/intelligence/types';
import {galaxyProcess} from '../src/intelligence/learning/journeys';

const NOW=new Date('2026-10-18T12:00:00Z');
const RULE_SUMMARY=/^Declared rule; enforcement and effect UNKNOWN\./;

test('instruction files: AGENTS.md, CLAUDE.md, .cursorrules and Copilot instructions are declared-rule controls with file:line evidence, never observations or permissions',()=>{
 for(const p of ['AGENTS.md','CLAUDE.md','.cursorrules','.github/copilot-instructions.md','packages/api/AGENTS.md'])assert.ok(wantedFile(p)&&INSTRUCTION_FILE.test(p),p);
 for(const p of ['docs/AGENTS.md.bak','README.md','src/.github/copilot-instructions.md'])assert.ok(!INSTRUCTION_FILE.test(p),p);
 const files=[
  {path:'package.json',text:'{"name":"rules-demo"}'},
  {path:'packages/api/package.json',text:'{"name":"api"}'},
  {path:'packages/api/src/index.ts',text:'export const a=1;'},
  {path:'AGENTS.md',text:'# Contributor rules\n\nIntro paragraph.\n\n## Code\n- Never push to main.\n- Run the tests.\n```\n- not a rule inside a fence\n```\n'},
  {path:'CLAUDE.md',text:'# Claude\nYou must keep IDs stable.\n'},
  {path:'.cursorrules',text:'Prefer small functions.\n\nNo network in tests.\n'},
  {path:'.github/copilot-instructions.md',text:'- Use TypeScript.\n'},
  {path:'packages/api/AGENTS.md',text:'# API rules\n- Validate every request.\n'},
 ];
 const model=scanRepository(files,{name:'rules-demo'});
 const rules=[...model.items.values()].filter(i=>i.layer==='rule');
 assert.deepEqual(rules.map(r=>r.label).sort(),['.cursorrules','.github/copilot-instructions.md','AGENTS.md','CLAUDE.md','packages/api/AGENTS.md']);
 for(const r of rules){assert.equal(r.kind,'control');assert.match(r.summary,RULE_SUMMARY);assert.match(r.summary,/not an observation/);assert.match(r.summary,/grants no permission/);
  for(const e of r.evidence){assert.ok(e.kind!=='selection-metadata'&&e.line>=1,'every rule cites file:line');assert.match(e.finding,/enforcement and effect UNKNOWN/);}}
 const agents=model.items.get('rule:AGENTS.md')!;
 assert.deepEqual(agents.evidence.map(e=>e.kind!=='selection-metadata'?e.line:0),[1,1,5,6,7],'heading, section and the two bullets; fenced text is not a rule');
 assert.match(agents.summary,/2 rule line\(s\) in 2 section\(s\)/);
 assert.equal(model.links.find(l=>l.from==='rule:packages/api/AGENTS.md')?.to,'c:packages/api','a nested rule file declares rules for its own container');
 assert.equal(model.links.find(l=>l.from==='rule:.github/copilot-instructions.md')?.to,'system');
 const {document,report}=scanToDocument(files,{name:'rules-demo',now:NOW});
 validateDocument(document);
 const view=document.views.find(v=>v.id==='declared-rules')!;
 assert.equal(view.perspective,'agents');assert.match(view.description,/enforcement and effect are UNKNOWN/);
 const group=document.nodes.find(n=>n.label==='Declared rules')!;
 assert.equal(group.childViewId,'declared-rules');assert.ok(document.views.find(v=>v.id===document.rootViewId)!.nodeIds.includes(group.id),'the system context opens the rule view');
 const ruleNodes=document.nodes.filter(n=>n.tags.includes('Declared rule'));
 assert.equal(ruleNodes.length,5);
 for(const n of ruleNodes){assert.ok(view.nodeIds.includes(n.id));assert.equal(n.basis,'static-source','a declared rule is static source, never Observed/verified');assert.equal(n.status,'idle');
  const block=document.blocks.find(b=>n.blockIds.includes(b.id))!;assert.equal(block.provenance,'source-derived');}
 assert.ok(view.edgeIds.length>=5&&view.edgeIds.every(id=>/enforcement unknown/.test(document.edges.find(e=>e.id===id)!.label)));
 assert.equal((document.observations??[]).length,0,'a rule never becomes an observation');
 assert.ok(report.kept.some(k=>/agent instruction file/.test(k)));
 assert.ok(publicDocument(document).views.some(v=>v.id==='declared-rules'));
 // Files with no rule are never invented: a repository without instruction files has no rule view.
 assert.ok(!scanToDocument(files.filter(f=>!INSTRUCTION_FILE.test(f.path)),{now:NOW}).document.views.some(v=>v.id==='declared-rules'));
});

test('instruction files: this repository\'s AGENTS.md is read as a declared rule citing real heading lines',()=>{
 const text=readFileSync('AGENTS.md','utf8').split('\r').join('');
 const rule=scanRepository([{path:'AGENTS.md',text}]).items.get('rule:AGENTS.md')!;
 assert.ok(rule,'AGENTS.md is admitted');const lines=text.split('\n');
 for(const e of rule.evidence)if(e.kind!=='selection-metadata'){const m=/section “(.+)”/.exec(e.finding);if(m)assert.ok(lines[e.line-1].includes(m[1]),`AGENTS.md:${e.line} is the cited heading`);}
 assert.ok(rule.evidence.some(e=>/section “Documents”/.test(e.finding)));
});

test('data roles: dbt, Spark and SQL items keep distinct kinds and providers; bronze/silver/gold folders produce no environment',()=>{
 const files=[
  {path:'dbt_project.yml',text:'name: lake\nversion: "1.0"\n'},
  {path:'models/silver/orders_clean.sql',text:"select * from {{ source('raw','orders') }}\n"},
  {path:'models/gold/revenue.sql',text:"select sum(amount) from {{ ref('orders_clean') }}\n"},
  {path:'jobs/requirements.txt',text:'pyspark==3.5.0\n'},
  {path:'jobs/bronze/ingest.py',text:'from pyspark.sql import SparkSession\nspark=SparkSession.builder.getOrCreate()\n'},
  {path:'jobs/bronze/util.py',text:'X=1\n'},
  {path:'warehouse/gold/marts.sql',text:'create table mart_sales as select * from staging_sales;\n'},
 ];
 const model=scanRepository(files,{name:'layers'});
 const dbtModel=model.items.get('t:orders_clean')!,dbtSource=model.items.get('t:raw.orders')!,sqlTable=model.items.get('t:mart_sales')!,spark=model.items.get('x:spark')!;
 assert.equal(dbtModel.summary,'dbt model');assert.equal(dbtModel.kind,'table');
 assert.equal(dbtSource.kind,'source');assert.equal(dbtSource.summary,'dbt source');
 assert.equal(sqlTable.summary,'SQL table');assert.equal(sqlTable.kind,'table');
 assert.equal(spark.kind,'process');assert.equal(spark.provider,'Databricks');assert.equal(spark.layer,'external');
 assert.notEqual(dbtModel.summary,sqlTable.summary,'a dbt model is not reported as a plain SQL table');
 const {document}=scanToDocument(files,{name:'layers',now:NOW});
 assert.equal(document.delivery,undefined,'no environment, instance or promotion is invented from layer-named folders');
 for(const n of document.nodes)assert.ok(!/^(bronze|silver|gold)$/i.test(n.label),`${n.label} is not a layer-named environment card`);
 assert.ok(!document.views.some(v=>/\b(bronze|silver|gold)\b/i.test(v.title)));
});

test('scale: a large selection is bounded and names its omissions; cyclic imports terminate; unreadable files are reported',()=>{
 const cyc=Array.from({length:MAX_FILES+40},(_,i)=>({path:`src/m${i%20}/f${i}.ts`,text:`import {x} from '../m${(i+1)%20}/f${(i+1)%(MAX_FILES+40)}';\nexport const y=${i};`}));
 const files=[{path:'package.json',text:'{"name":"big","dependencies":{"react":"1"}}'},{path:'svc/package.json',text:'{not json'},{path:'deploy/k8s.yaml',text:'apiVersion: v1\nkind: [unclosed'},...cyc];
 const started=Date.now();const {document,report}=scanToDocument(files,{now:NOW});
 assert.ok(Date.now()-started<60000);
 assert.ok(document.nodes.length<=480&&document.edges.length<=1400&&document.views.length<=78);
 validateDocument(document);
 assert.ok(report.lost.some(l=>new RegExp(`beyond the first ${MAX_FILES} not read`).test(l)),'the file budget is reported');
 assert.ok(report.lost.some(l=>/not valid JSON/.test(l)),'a partial package.json is reported');
 assert.ok(report.lost.some(l=>/could not be parsed/.test(l)),'a broken YAML file is reported');
 // A cycle m0 → m1 → … → m19 → m0 produces finite links in both directions of the ring.
 const comp=document.views.find(v=>v.id.startsWith('components-'))!;assert.ok(comp.edgeIds.length>=20);
 assert.ok(document.views.every(v=>v.id===document.rootViewId||v.nodeIds.length),'no empty drilldown view is kept');
 assert.ok(report.lost.some(l=>/files view\(s\) not created: the component budget/.test(l)),'files views dropped by the budget are named');
 for(const n of document.nodes)if(n.childViewId)assert.ok(document.views.some(v=>v.id===n.childViewId));
});

test('scale: a scan is cancelable before and during reading, and yields AbortError and no model',async()=>{
 const before=new AbortController();before.abort();
 assert.throws(()=>scanRepository([{path:'package.json',text:'{}'}],{signal:before.signal}),(e:Error)=>e.name==='AbortError');
 const files=Array.from({length:2000},(_,i)=>({path:`src/a${i}.ts`,text:'export {}'}));
 const during=new AbortController();let reads=0;
 const proxy=files.map(f=>({get path(){if(++reads===700)during.abort();return f.path;},text:f.text}));
 assert.throws(()=>scanToDocument(proxy,{signal:during.signal}),(e:Error)=>e.name==='AbortError');
 const picked=Array.from({length:300},(_,i)=>new File([`export const v${i}=1;`],`a${i}.ts`)).map((f,i)=>Object.defineProperty(f,'webkitRelativePath',{value:`repo/src/a${i}.ts`}));
 const ctl=new AbortController();const pending=scanPickedFolder(picked,NOW,ctl.signal);ctl.abort();
 await assert.rejects(pending,(e:Error)=>e.name==='AbortError');
 const big=[...picked,Object.defineProperty(new File([new Uint8Array(600*1024)],'huge.sql'),'webkitRelativePath',{value:'repo/db/huge.sql'})];
 const done=await scanPickedFolder(big,NOW);assert.ok(done.report.lost.some(l=>/1 selected file\(s\) over 512 KiB not read/.test(l)),'a file left out before reading is named');
});

const minimalBrief={format:'diagramcloud.project-brief',version:1,project:{id:'one-process',title:'One declared process',summary:'Synthetic single-step process with one author source; no Git.'},scope:[{id:'reconcile',title:'Reconcile invoices',kind:'task'}]};

test('complete for selected purpose: projectReadiness for that purpose names no missing-required gap',()=>{
 const {document}=compileProjectBrief(minimalBrief);
 assert.equal(document.sources.length,1,'one source: the author-supplied brief');
 for(const purpose of PURPOSES){const report=projectReadiness(document,{purpose}),c=completeForPurpose(report);
  assert.equal(c.purpose,purpose);assert.equal(c.complete,!report.gaps.some(g=>g.state==='missing-required'));
  assert.deepEqual([...c.requiredGapIds,...c.openGapIds].sort(),report.gaps.map(g=>g.id).sort());}
 assert.equal(projectCompleteFor(document,'education').complete,true,'a one-process brief is complete for learning');
 const portfolio=projectCompleteFor(document,'portfolio');
 assert.equal(portfolio.complete,false);assert.deepEqual(portfolio.requiredGapIds,['contribution'],'a portfolio needs an authored contribution');
 const withRole:Project={...document,nodes:document.nodes.map((n,i)=>i===0?{...n,role:'Author: designed the reconciliation'}:n)};
 assert.equal(projectCompleteFor(withRole,'portfolio').complete,true);
 const empty=documentSchema.parse({schemaVersion:1,id:'empty',title:'Empty',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root'}]});
 assert.equal(projectCompleteFor(empty,'understand').complete,false);
});

test('mixed workspace: a rich Galaxy pack and a minimal project get identical MCP tool access',()=>{
 const rich=galaxyProcess(),minimal=compileProjectBrief(minimalBrief).document;
 assert.ok(rich.nodes.length>minimal.nodes.length*2,'the Galaxy pack is richer');
 const dir=mkdtempSync(join(tmpdir(),'diagramcloud-mixed-'));
 try{
  const listing=(doc:Project,name:string)=>{const path=join(dir,`${name}.json`);writeFileSync(path,JSON.stringify(doc));
   const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'mixed-test',version:'1'}}},{method:'notifications/initialized'},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'diagramcloud_query',arguments:{kind:'summary'}}}];
   const run=spawnSync(process.execPath,['--import','tsx','scripts/intelligence-mcp.ts',path],{input:requests.map(r=>JSON.stringify({jsonrpc:'2.0',...r})).join('\n')+'\n',encoding:'utf8',timeout:30000});
   assert.equal(run.status,0,run.stderr);const replies=run.stdout.trim().split('\n').map(l=>JSON.parse(l));
   assert.ok(!replies[2].result.isError,`${name} answers a summary query`);
   return replies[1].result.tools as {name:string}[];};
  const a=listing(rich,'rich'),b=listing(minimal,'minimal');
  assert.ok(a.length>0);assert.deepEqual(a,b,'tool names, descriptions and schemas do not depend on how rich a project is');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
