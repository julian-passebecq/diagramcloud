import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {documentSchema} from '../src/core/model';
test('selected-file stdio MCP initializes, queries public facts and rejects mutation/paths',()=>{
 const dir=mkdtempSync(join(tmpdir(),'diagramcloud-mcp-'));try{const path=join(dir,'selected.json');
  writeFileSync(path,JSON.stringify(documentSchema.parse({schemaVersion:1,id:'example',title:'Synthetic MCP',rootViewId:'root',nodes:[{id:'public',label:'Public example'},{id:'private',label:'PRIVATE_MCP_SENTINEL',visibility:'private'}],edges:[],views:[{id:'root',title:'Root',nodeIds:['public','private']}]})));
  const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'synthetic-test',version:'1'}}},
   {method:'notifications/initialized'},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'diagramcloud_query',arguments:{kind:'components'}}},
   {id:4,method:'tools/call',params:{name:'diagramcloud_query',arguments:{kind:'summary',path:'arbitrary'}}},{id:5,method:'tools/call',params:{name:'execute',arguments:{command:'ignored'}}}];
  const run=spawnSync(process.execPath,['--import','tsx','scripts/intelligence-mcp.ts',path],{input:requests.map(r=>JSON.stringify({jsonrpc:'2.0',...r})).join('\n')+'\n',encoding:'utf8',timeout:30000});
  assert.equal(run.status,0,run.stderr);const replies=run.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(replies[0].result.protocolVersion,'2025-06-18');assert.equal(replies[1].result.tools.length,4);
  assert.ok(!run.stdout.includes('PRIVATE_MCP_SENTINEL'));assert.ok(replies[3].result.isError);assert.ok(replies[4].result.isError);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
