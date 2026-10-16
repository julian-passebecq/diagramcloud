import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {documentSchema} from '../src/core/model';
import {renderPublicArtifact} from '../src/intelligence/context';
import {checkConceptSpec} from './contracts/mosaicstudio/schema';
const fixture=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-concept-mcp',title:'Synthetic MCP',rootViewId:'root',privateNotes:'PRIVATE_MCP_NOTE',edges:[],nodes:[{id:'app',label:'Synthetic app'},{id:'private',label:'PRIVATE_MCP_NODE',visibility:'private'}],views:[{id:'root',title:'Root',nodeIds:['app','private']}]});
test('public context renderer returns owner-valid concept and redacted typed mapping',()=>{
 const out=renderPublicArtifact(fixture(),{kind:'concept',viewId:'root'}) as ReturnType<typeof import('../src/export/concept').conceptSpec>;
 assert.equal(out.report.audience,'public');assert.ok(checkConceptSpec(out.spec).ok);assert.doesNotMatch(JSON.stringify(out),/PRIVATE_MCP/);assert.equal(out.report.nodes.length,1);
 assert.throws(()=>renderPublicArtifact(fixture(),{kind:'concept',viewId:'root',audience:'author'}));
});
test('MCP advertises source version and concept within the same seven public tools',t=>{
 const root=mkdtempSync(join(tmpdir(),'dc-concept-mcp-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const input=join(root,'project.json');writeFileSync(input,JSON.stringify(fixture()));
 const messages=[{jsonrpc:'2.0',id:1,method:'initialize'},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},...['public','author'].map((audience,i)=>({jsonrpc:'2.0',id:i+3,method:'tools/call',params:{name:'diagramcloud_render',arguments:{kind:'concept',viewId:'root',...(audience==='author'?{audience}:{})}}}))];
 const processResult=spawnSync(process.execPath,['--import','tsx','scripts/intelligence-mcp.ts',input],{input:messages.map(m=>JSON.stringify(m)).join('\n')+'\n',encoding:'utf8',timeout:30000});
 assert.equal(processResult.status,0,processResult.stderr);const rows=processResult.stdout.trim().split('\n').map(row=>JSON.parse(row));
 assert.equal(rows.find(r=>r.id===1).result.serverInfo.version,JSON.parse(readFileSync('package.json','utf8')).version);
 const tools=rows.find(r=>r.id===2).result.tools;assert.equal(tools.length,7);assert.ok(tools.find((tool:{name:string})=>tool.name==='diagramcloud_render').inputSchema.properties.kind.enum.includes('concept'));
 assert.ok(checkConceptSpec(JSON.parse(rows.find(r=>r.id===3).result.content[0].text).spec).ok);assert.equal(rows.find(r=>r.id===4).result.isError,true);assert.doesNotMatch(processResult.stdout,/PRIVATE_MCP/);
});
