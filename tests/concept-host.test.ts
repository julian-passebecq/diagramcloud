import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request,createServer,type Server} from 'node:http';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {prepareConceptPreview,resolveConceptPick,resolveUniqueConceptPick} from '../src/interop/conceptPreview';
import {conceptHostOrigin,conceptHostPage,prepareConceptHostPacket} from '../src/interop/conceptHost';
import {runConceptHost,startConceptHost} from '../scripts/concept-host';
const now=new Date('2026-10-14T12:00:00.000Z');
const viewer=`<!doctype html><meta http-equiv="Content-Security-Policy" content="script-src 'sha256-${createHash('sha256').update('void 0').digest('base64')}'"><script>void 0</script>`;
const viewerSha256=createHash('sha256').update(viewer).digest('hex');
function project(merged=false):Project{return validateDocument(documentSchema.parse({schemaVersion:1,id:'host-fixture',title:'Synthetic host fixture',rootViewId:'root',nodes:[{id:'app',kind:'app',label:'App'},{id:'store',kind:'storage',label:'Store'},{id:'secret',kind:'app',label:'PRIVATE_FIXTURE',visibility:'private'}],edges:(merged?['a','b']:['a']).map(id=>({id,source:'app',target:'store',label:'reads',kind:'query'})),views:[{id:'root',title:'Root',nodeIds:['app','store','secret'],edgeIds:merged?['a','b']:['a'],positions:{}}]}));}
const packet=(p:Project,audience:'public'|'author'='public')=>prepareConceptPreview(p,{projectId:p.id,baseRevision:p.revision,viewId:'root'},{audience,now});
const get=(url:string,host?:string,address='127.0.0.1')=>new Promise<{status:number;body:string;headers:import('node:http').IncomingHttpHeaders}>((yes,no)=>{const u=new URL(url);const req=request({hostname:address,port:u.port,path:u.pathname+u.search,headers:{Host:host??u.host},timeout:2000},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>yes({status:res.statusCode!,body,headers:res.headers}));});req.on('error',no);req.on('timeout',()=>req.destroy(new Error('Bounded local HTTP request timed out.')));req.end();});

test('host regenerates selected packet with its exact timestamp and explicit audience',async()=>{
 const p=project(),a=await packet(p);assert.equal(a.generatedAt,now.toISOString());assert.deepEqual(await prepareConceptHostPacket(p,'root','public',a),a);
 assert.doesNotMatch(JSON.stringify(a),/PRIVATE_FIXTURE/);assert.match(JSON.stringify(await prepareConceptHostPacket(p,'root','author')),/PRIVATE_FIXTURE/);
 for(const bad of [{...a,generatedAt:undefined},{...a,audience:'author'},{...a,baseRevision:p.revision+1},{...a,projectionSha256:'0'.repeat(64)},{...a,extra:true}])await assert.rejects(()=>prepareConceptHostPacket(p,'root','public',bad));
 const tampered=structuredClone(a);tampered.projection.spec.title='Untrusted';await assert.rejects(()=>prepareConceptHostPacket(p,'root','public',tampered));
 p.nodes[0].label='Changed without revision';await assert.rejects(()=>prepareConceptHostPacket(p,'root','public',a));
});
test('navigation rejects ambiguous mappings while inspection preserves them',async()=>{
 const a=await packet(project(true)),msg={format:'diagramcloud.concept-pick',version:1,projectionSha256:a.projectionSha256,kind:'flow',targetId:a.projection.spec.flows[0].id};
 const inspection=resolveConceptPick(a,msg);assert.ok(inspection.ok&&inspection.ambiguous);assert.deepEqual(resolveUniqueConceptPick(a,msg),{ok:false,reason:'ambiguous-target'});
 assert.ok(resolveUniqueConceptPick(a,{...msg,kind:'node',targetId:'app'}).ok);
});
test('host origin and generated script reject opaque origins and escape imported text',async()=>{
 for(const bad of ['*','null','file://','https://user:pw@example.test','http://localhost:123/path','http://localhost:123/'])assert.equal(conceptHostOrigin(bad),null);
 assert.equal(conceptHostOrigin('http://localhost:123'),'http://localhost:123');
 const a=await packet(project());a.projection.spec.title='</script><script>bad()</script>';
 const page=conceptHostPage(a,'http://127.0.0.1:123');assert.doesNotMatch(page.script,/<\/script>/);assert.match(page.script,/e.origin!==viewerOrigin\|\|e.source!==frame.contentWindow/);assert.doesNotMatch(page.script,/postMessage\([^\n]*['"]\*['"]/);
 assert.match(page.script,/authorizedOpenerOrigin=null/);assert.match(page.script,/raw===authorizedOpenerOrigin/);
 const linked=conceptHostPage(a,'http://127.0.0.1:123','http://localhost:4173');assert.match(linked.script,/authorizedOpenerOrigin="http:\/\/localhost:4173"/);
 assert.throws(()=>conceptHostPage(a,'http://127.0.0.1:123','*'),/authorized DiagramCloud origin/);
});
test('loopback server limits routes and hosts, binds separate origins, blocks viewer network and never enables CORS',async()=>{
 const host=await startConceptHost({document:project(),viewId:'root',audience:'public',viewerHtml:viewer,viewerSha256});
 try{
  assert.notEqual(host.origin,host.viewerOrigin);const main=await get(host.url),owner=await get(host.viewerOrigin+'/viewer.html'),sidecar=await get(host.origin+'/packet.json');
  assert.equal(main.status,200);assert.equal(owner.status,200);assert.equal(sidecar.status,200);assert.doesNotMatch(main.body+sidecar.body,/PRIVATE_FIXTURE/);
  assert.match(String(main.headers['content-security-policy']),new RegExp('frame-src '+host.viewerOrigin));assert.match(String(owner.headers['content-security-policy']),/connect-src 'none'/);assert.match(String(owner.headers['content-security-policy']),/font-src 'none'/);assert.equal(owner.headers['access-control-allow-origin'],undefined);assert.equal(main.headers['cache-control'],'no-store');
  assert.equal((await get(host.url,'evil.example')).status,403);assert.equal((await get(host.viewerOrigin+'/packet.json')).status,404);assert.equal((await get(host.origin+'/viewer.html')).status,404);
  for(const path of ['/arbitrary.json','/../package.json','/%2e%2e/package.json','/viewer.html?src=https://external.test'])assert.equal((await get(host.origin+path)).status,404);
 }finally{await host.close();}
});
test('viewer hash, port and selected-file CLI guards reject before serving',async()=>{
 const options={document:project(),viewId:'root',audience:'public' as const,viewerHtml:viewer,viewerSha256};
 await assert.rejects(()=>startConceptHost({...options,viewerSha256:'0'.repeat(64)}),/hash/);await assert.rejects(()=>startConceptHost({...options,port:-1}),/port/);
 await assert.rejects(()=>startConceptHost({...options,viewerHtml:'<html></html>',viewerSha256:createHash('sha256').update('<html></html>').digest('hex')}),/script hash/);
 const dir=mkdtempSync(join(tmpdir(),'diagramcloud-host-'));try{
  const doc=join(dir,'doc.json'),owner=join(dir,'owner.html'),side=join(dir,'packet.json');writeFileSync(doc,JSON.stringify(project()));writeFileSync(owner,viewer);writeFileSync(side,JSON.stringify(await packet(project())));
  const args=[doc,'--view','root','--audience','public','--viewer',owner,'--viewer-sha256',viewerSha256,'--packet',side];
  const host=await runConceptHost(args);await host.close();
  await assert.rejects(()=>runConceptHost([...args,'--port','NaN']));await assert.rejects(()=>runConceptHost([...args,'--audience','author']));await assert.rejects(()=>runConceptHost([doc,'--view','root']));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('localhost serves identical fixed routes over both IPv4 and IPv6, preserving the two origins',async()=>{
 const host=await startConceptHost({document:project(),viewId:'root',audience:'public',viewerHtml:viewer,viewerSha256});
 const port=new URL(host.url).port;
 try{
  for(const path of ['/','/packet.json']){
   const ipv4=await get(host.origin+path,undefined,'127.0.0.1'),ipv6=await get(host.origin+path,undefined,'::1'),resolved=await get(host.origin+path,undefined,'localhost');
   assert.equal(ipv4.status,200);assert.equal(ipv6.status,200);assert.equal(resolved.status,200);assert.equal(ipv6.body,ipv4.body);assert.equal(resolved.body,ipv4.body);assert.deepEqual(ipv6.headers['content-security-policy'],ipv4.headers['content-security-policy']);
  }
  assert.equal((await get(host.viewerOrigin+'/viewer.html',undefined,'::1')).body,viewer);
  assert.equal((await get(host.url,'[::1]:'+port,'::1')).status,403); // transport support does not introduce a third origin
  assert.equal((await get(host.origin+'/viewer.html',undefined,'::1')).status,404);
  assert.equal((await get(host.viewerOrigin+'/packet.json',undefined,'::1')).status,404);
 }finally{await host.close();}
 await assert.rejects(()=>get(host.url,undefined,'127.0.0.1'));await assert.rejects(()=>get(host.url,undefined,'::1'));
});

test('an unavailable IPv6 port fails closed and releases the IPv4 listener',async()=>{
 const blocker=createServer();
 const listen=(server:Server,port:number,host:string)=>new Promise<void>((yes,no)=>{server.once('error',no);server.listen({host,port,ipv6Only:host==='::1'},()=>{server.off('error',no);yes();});});
 const close=(server:Server)=>new Promise<void>((yes,no)=>{server.close(e=>e?no(e):yes());server.closeAllConnections();});
 await listen(blocker,0,'::1');const address=blocker.address();assert.ok(address&&typeof address!=='string');
 const probe=createServer();try{
  await assert.rejects(()=>startConceptHost({document:project(),viewId:'root',audience:'public',viewerHtml:viewer,viewerSha256,port:address.port}),/Both IPv4.*IPv6/);
  await listen(probe,address.port,'127.0.0.1'); // failed startup did not leave a partial advertised service
 }finally{if(probe.listening)await close(probe);await close(blocker);}
});
