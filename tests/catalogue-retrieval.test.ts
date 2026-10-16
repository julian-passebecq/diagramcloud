import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateDocument,type Project} from '../src/core/model';
import {applyDocumentPatch,type Patch} from '../src/core/patch';
import {catalogueRows,learningCatalogue,matchesCatalogueRow} from '../src/intelligence/learning/catalogue';
import {lessonInstanceFacts,mappingCandidates,reviewMapping,suggestMapping} from '../src/intelligence/learning/mappings';
import {catalogueQuery,proposeMappingSuggestion,type CatalogueQuery} from '../src/intelligence/learning/query';

/** R4-AC-25: one catalogue and mapping model reached from the UI module, the CLI and the stdio MCP; proposals never apply. */
const AUTHOR={origin:'author',suggestedBy:'Julian'} as const,SENTINEL='HIDDEN_PARITY_SENTINEL';
const star=learningCatalogue.find(e=>e.id==='star-grain')!,other=learningCatalogue.find(e=>e.id!=='star-grain')!,withPrereqs=learningCatalogue.find(e=>e.lesson.prerequisites.length)!;
const reviewed=(doc:Project,conceptId:string,id:string)=>{const d=suggestMapping(doc,{conceptId,target:{kind:'node',id}},AUTHOR);return reviewMapping(d,d.learningMappings!.at(-1)!.id,{reviewedBy:'Julian',reviewedAt:'2026-10-16T10:00:00Z',evidence:{sourceIds:['src-pub'],blockIds:[]}});};
const fixture=():Project=>{const base=validateDocument({schemaVersion:1,id:'parity-fixture',title:'Parity fixture',rootViewId:'overview',
 sources:[{id:'src-pub',title:'Warehouse model doc',location:'docs/model.md'},{id:'src-priv',title:'Private sizing notes',location:'notes/secret.md',visibility:'private'}],
 blocks:[{id:'blk-pub',type:'text',title:'Grain statement',text:'One row per order line.'}],
 nodes:[{id:'facts',label:'Sales star schema',kind:'table',tags:['warehouse'],sourceIds:['src-pub'],blockIds:['blk-pub']},{id:'named',label:'Star grain dashboard',kind:'report'},
  {id:'hidden',label:SENTINEL+' star grain mart',kind:'table',sourceIds:['src-pub'],visibility:'private'}],
 edges:[],views:[{id:'overview',title:'Overview',nodeIds:['facts','named','hidden']}]});
 return reviewed(reviewed(base,star.id,'facts'),other.id,'hidden');};
const flags:Record<string,string>={op:'--op',query:'--query',kind:'--kind',domain:'--domain',family:'--family',limit:'--limit',id:'--id',depth:'--depth',conceptId:'--concept',nodeId:'--node'};
const json=(value:unknown)=>JSON.parse(JSON.stringify(value));
function withFiles<T>(run:(dir:string,input:string)=>T):T{const dir=mkdtempSync(join(tmpdir(),'dc-catalogue-'));try{const input=join(dir,'project.json');writeFileSync(input,JSON.stringify(fixture()));return run(dir,input);}finally{rmSync(dir,{recursive:true,force:true});}}
function cli(dir:string,args:string[],file:string){const out=join(dir,'out-'+Math.random().toString(36).slice(2));const r=spawnSync(process.execPath,['--import','tsx','scripts/intelligence.ts',...args,'--out',out],{encoding:'utf8',timeout:60000});
 assert.equal(r.status,0,r.stderr);return JSON.parse(readFileSync(join(out,file),'utf8'));}
function mcp(input:string,calls:[string,unknown][]){const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'synthetic-agent',version:'1'}}},{method:'notifications/initialized'},{id:2,method:'tools/list'},...calls.map(([name,args],i)=>({id:i+3,method:'tools/call',params:{name,arguments:args}}))];
 const r=spawnSync(process.execPath,['--import','tsx','scripts/intelligence-mcp.ts',input],{input:requests.map(q=>JSON.stringify({jsonrpc:'2.0',...q})).join('\n')+'\n',encoding:'utf8',timeout:60000});
 assert.equal(r.status,0,r.stderr);const replies=r.stdout.trim().split('\n').map(line=>JSON.parse(line));
 return {stdout:r.stdout,tools:replies.find(x=>x.id===2).result.tools as {name:string}[],results:calls.map((_,i)=>replies.find(x=>x.id===i+3).result as {isError?:boolean;content:{text:string}[]})};}

test('catalogue search, lesson, prerequisites and mappings return the same results through the UI module, CLI and MCP',()=>{
 const doc=fixture(),requests:CatalogueQuery[]=[{op:'search',query:'star'},{op:'search',kind:'pattern',family:'not-supplied',limit:3},{op:'search',domain:'warehousing'},{op:'lesson',id:star.id,depth:'detail'},{op:'prerequisites',id:withPrereqs.id},{op:'mappings'},{op:'mappings',conceptId:star.id},{op:'mappings',nodeId:'facts'}];
 // The module is the UI's own catalogue and mapping functions.
 for(const q of requests.filter(q=>q.op==='search')){const s=q as Extract<CatalogueQuery,{op:'search'}>,out=catalogueQuery(q) as {data:{total:number;rows:{id:string}[]}};
  const ui=catalogueRows().filter(row=>matchesCatalogueRow(row,s.query??'',{kind:s.kind,domain:s.domain,family:s.family}));
  assert.equal(out.data.total,ui.length);assert.deepEqual(out.data.rows.map(r=>r.id),ui.slice(0,s.limit??50).map(r=>r.id));assert.ok(out.data.total>0);}
 const lesson=catalogueQuery({op:'lesson',id:star.id,depth:'detail'}) as {data:{explanation:string;lesson:{levels?:unknown}}};
 assert.equal(lesson.data.explanation,star.lesson.levels.detail);assert.equal(lesson.data.lesson.levels,undefined,'one depth, as the UI shows');
 const prereqs=catalogueQuery({op:'prerequisites',id:withPrereqs.id}) as {data:{direct:{id:string}[];order:{id:string}[]}};
 assert.deepEqual(prereqs.data.direct.map(r=>r.id),withPrereqs.lesson.prerequisites);for(const id of withPrereqs.lesson.prerequisites)assert.ok(prereqs.data.order.some(r=>r.id===id));
 const facts=catalogueQuery({op:'mappings',conceptId:star.id},doc) as {data:{concepts:{established:unknown}[]}};
 assert.deepEqual(facts.data.concepts[0].established,json(lessonInstanceFacts(doc,star,{publicMode:true}).established));
 assert.throws(()=>catalogueQuery({op:'lesson',id:'medallion'}),/registry entry without an authored lesson/);assert.throws(()=>catalogueQuery({op:'mappings'}),/selected project/);assert.throws(()=>catalogueQuery({op:'search',path:'x'}));
 withFiles((dir,input)=>{
  const viaMcp=mcp(input,requests.map(q=>['diagramcloud_catalogue',q]));
  assert.ok(viaMcp.tools.some(t=>t.name==='diagramcloud_catalogue')&&viaMcp.tools.some(t=>t.name==='diagramcloud_propose_mapping'));
  requests.forEach((q,i)=>{const expected=json(catalogueQuery(q,doc));
   assert.ok(!viaMcp.results[i].isError,viaMcp.results[i].content[0].text);assert.deepEqual(JSON.parse(viaMcp.results[i].content[0].text),expected,'MCP '+JSON.stringify(q));
   const args=Object.entries(q).flatMap(([k,v])=>[flags[k],String(v)]);
   assert.deepEqual(cli(dir,['catalogue',...args,...(q.op==='mappings'?['--input',input]:[])],q.op==='mappings'?'catalogue.public.json':'catalogue.json'),expected,'CLI '+JSON.stringify(q));});
 });
});

test('hidden components never appear in catalogue results, counts or mapping proposals',()=>{
 const doc=fixture();assert.equal(doc.learningMappings!.filter(m=>m.state==='reviewed').length,2,'the authoring document maps two concepts');
 const all=catalogueQuery({op:'mappings'},doc) as {data:{concepts:{conceptId:string}[];withoutReviewedMapping:number}};
 assert.deepEqual(all.data.concepts.map(c=>c.conceptId),[star.id]);assert.equal(all.data.withoutReviewedMapping,learningCatalogue.length-1);assert.doesNotMatch(JSON.stringify(all),new RegExp(SENTINEL+'|"hidden"'));
 assert.doesNotMatch(JSON.stringify(catalogueQuery({op:'mappings',conceptId:other.id},doc)),new RegExp(SENTINEL+'|"hidden"'));
 for(const nodeId of ['hidden','absent'])assert.throws(()=>catalogueQuery({op:'mappings',nodeId},doc),/^Error: Component unavailable in public projection$/);
 assert.ok(mappingCandidates(doc,star).some(c=>c.nodeId==='hidden'),'authoring ranking would include it');
 const candidates=proposeMappingSuggestion(doc,{conceptId:star.id},{origin:'ai',suggestedBy:'agent'}) as {candidates:{nodeId:string}[]};
 assert.deepEqual(candidates.candidates.map(c=>c.nodeId),['named']);
 for(const id of ['hidden','absent'])assert.throws(()=>proposeMappingSuggestion(doc,{conceptId:star.id,target:{kind:'node',id}},{origin:'ai',suggestedBy:'agent'}),/^Error: Target unavailable in public projection$/);
 assert.throws(()=>proposeMappingSuggestion(doc,{conceptId:star.id,target:{kind:'node',id:'named'},evidence:{sourceIds:['src-priv'],blockIds:[]}},{origin:'ai',suggestedBy:'agent'}),/Cited evidence unavailable/);
 withFiles((_dir,input)=>{const run=mcp(input,[['diagramcloud_catalogue',{op:'mappings'}],['diagramcloud_catalogue',{op:'mappings',nodeId:'hidden'}],['diagramcloud_propose_mapping',{conceptId:star.id}],['diagramcloud_propose_mapping',{conceptId:star.id,target:{kind:'node',id:'hidden'}}]]);
  assert.doesNotMatch(run.stdout,new RegExp(SENTINEL));assert.deepEqual(run.results.map(r=>Boolean(r.isError)),[false,true,false,true]);});
});

test('a mapping proposal is a suggested, never reviewed patch whose origin is set by the calling path',()=>{
 const doc=fixture();
 for(const extra of [{state:'reviewed'},{origin:'author'},{suggestedBy:'Julian'},{reviewedBy:'Julian'},{reviewedAt:'2026-10-16T10:00:00Z'}])
  assert.throws(()=>proposeMappingSuggestion(doc,{conceptId:star.id,target:{kind:'node',id:'named'},...extra},{origin:'ai',suggestedBy:'agent'}));
 withFiles((dir,input)=>{const before=readFileSync(input,'utf8'),request={conceptId:star.id,target:{kind:'node',id:'named'}};
  const run=mcp(input,[['diagramcloud_propose_mapping',request],['diagramcloud_propose_mapping',{...request,origin:'author'}],['diagramcloud_propose_mapping',{...request,state:'reviewed'}]]);
  const viaMcp=JSON.parse(run.results[0].content[0].text) as {state:string;origin:string;patch:Patch};assert.deepEqual([run.results[1].isError,run.results[2].isError],[true,true]);
  const imported=cli(dir,['suggest-mapping','--input',input,'--concept',star.id,'--target','named'],'proposal.patch.json') as Patch;
  const human=cli(dir,['suggest-mapping','--input',input,'--concept',star.id,'--target','named','--author','Julian'],'mapping-suggestion.json') as {origin:string;patch:Patch};
  const candidatesOnly=cli(dir,['suggest-mapping','--input',input,'--concept',star.id],'mapping-suggestion.json') as {state:string;candidates:{nodeId:string}[]};
  assert.equal(candidatesOnly.state,'CANDIDATES_ONLY');assert.deepEqual(candidatesOnly.candidates.map(c=>c.nodeId),['named']);
  assert.equal(readFileSync(input,'utf8'),before,'no path writes the selected project');
  assert.deepEqual([viaMcp.state,viaMcp.origin,human.origin],['REQUIRES_AUTHOR_REVIEW','ai','author']);
  for(const [patch,origin,by] of [[viaMcp.patch,'ai','synthetic-agent'],[imported,'imported','diagramcloud intelligence CLI'],[human.patch,'author','Julian']] as const){
   assert.equal(patch.format,'diagramcloud.patch');assert.equal(patch.baseRevision,doc.revision);
   const {result}=applyDocumentPatch(doc,patch),m=result.learningMappings!.at(-1)!;
   assert.deepEqual({state:m.state,origin:m.origin,suggestedBy:m.suggestedBy,target:m.target.id,reviewedBy:m.reviewedBy},{state:'suggested',origin,suggestedBy:by,target:'named',reviewedBy:undefined});
   if(origin==='ai')assert.throws(()=>reviewMapping(result,m.id,{reviewedBy:'synthetic-agent',evidence:{sourceIds:['src-pub'],blockIds:[]}}),/cannot review itself/);
   assert.throws(()=>applyDocumentPatch({...doc,revision:doc.revision+1},patch),'a stale base is refused');}
 });
});
