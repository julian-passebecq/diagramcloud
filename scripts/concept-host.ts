/** Isolated loopback host for an explicitly selected owner viewer. No arbitrary file route or runtime. */
import {createServer,type RequestListener} from 'node:http';
import {createHash} from 'node:crypto';
import {openSync,readFileSync,fstatSync,closeSync,statSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseDocument,MAX_DOCUMENT_BYTES,type Project} from '../src/core/model';
import {conceptHostPage,prepareConceptHostPacket} from '../src/interop/conceptHost';
import type {ConceptPreview} from '../src/interop/conceptPreview';

const VIEWER_MAX_BYTES=8*1024*1024,PACKET_MAX_BYTES=32*1024*1024;
function selectedBytes(path:string,max:number):Buffer{
 const fd=openSync(resolve(path),'r');try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size>max)throw new Error('Selected file exceeds its bounded profile.');const bytes=readFileSync(fd);if(bytes.length>max)throw new Error('Selected file exceeds its bounded profile.');return bytes;}finally{closeSync(fd);}
}
/**
 * `packet` is the last packet prepared successfully. `regenerate` rebuilds it from a newly selected document (and
 * optional sidecar); while the last regeneration failed (`failure` is set), `/` and `/packet.json` answer 503 with a
 * generic error and never serve the previous packet. A later successful regeneration serves again.
 */
export type LocalConceptHost={url:string;origin:string;viewerOrigin:string;readonly packet:ConceptPreview;readonly failure:string|undefined;
 regenerate(next:{document:Project;packet?:unknown}):Promise<{ok:true;packet:ConceptPreview}|{ok:false;reason:string}>;close():Promise<void>};
export const REGENERATION_FAILED='Preview packet regeneration failed. The previous packet is no longer served; fix the selected document or packet and regenerate.';
export async function startConceptHost(options:{document:Project;viewId:string;audience:'public'|'author';viewerHtml:Buffer|string;viewerSha256:string;packet?:unknown;port?:number;diagramcloudOrigin?:string}):Promise<LocalConceptHost>{
 const bytes=Buffer.isBuffer(options.viewerHtml)?Buffer.from(options.viewerHtml):Buffer.from(options.viewerHtml,'utf8');
 if(bytes.length>VIEWER_MAX_BYTES||!/^[a-f0-9]{64}$/.test(options.viewerSha256)||createHash('sha256').update(bytes).digest('hex')!==options.viewerSha256)throw new Error('Selected viewer hash does not match.');
 const viewer=bytes.toString('utf8');
 // Keep the owner's existing hashed executable. An additional response CSP denies every external request.
 const hashes=[...viewer.matchAll(/script-src 'sha256-([A-Za-z0-9+/]{43}=)'/g)].map(m=>m[1]);
 if(hashes.length!==1)throw new Error('Selected viewer must declare one owner script hash.');
 let packet=await prepareConceptHostPacket(options.document,options.viewId,options.audience,options.packet),failure:string|undefined;
 const port=options.port??0;if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local port.');
 let origin='',viewerOrigin='',hostHtml='',hostCsp='',viewerCsp='';
 const failedPage=`<!doctype html><html lang="en"><meta charset="utf-8"><title>DiagramCloud local concept preview</title><h1>Local concept preview unavailable</h1><p role="alert">${REGENERATION_FAILED}</p></html>`;
 const servePage=(next:ConceptPreview)=>{const page=conceptHostPage(next,viewerOrigin,options.diagramcloudOrigin);hostHtml=page.html;
  hostCsp=`default-src 'none'; script-src 'sha256-${createHash('sha256').update(page.script).digest('base64')}'; style-src 'unsafe-inline'; frame-src ${viewerOrigin}; connect-src 'none'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;};
 const handler:RequestListener=(req,res)=>{
  const hostname=req.headers.host;
  const common={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), usb=(), serial=()'};
  const respond=(status:number,body:string|Buffer,headers:Record<string,string>={})=>{res.writeHead(status,{...common,...headers});res.end(body);};
  if(!origin||!viewerOrigin)return respond(503,'Local host is preparing');
  if(req.method!=='GET'||!hostname||![new URL(origin).host,new URL(viewerOrigin).host].includes(hostname))return respond(403,'Forbidden');
  let url:URL;try{url=new URL(req.url??'/',origin);}catch{return respond(400,'Invalid request');}
  if(url.origin!==origin)return respond(403,'Forbidden'); // reject absolute-form/proxy requests
  if(hostname===new URL(viewerOrigin).host){
   if(url.pathname==='/viewer.html'&&!url.search)return respond(200,bytes,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':viewerCsp});
   return respond(404,'Not found');
  }
  if(failure&&url.pathname==='/')return respond(503,failedPage,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});
  if(failure&&url.pathname==='/packet.json'&&!url.search)return respond(503,JSON.stringify({error:REGENERATION_FAILED}),{'Content-Type':'application/json; charset=utf-8','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});
  if(url.pathname==='/')return respond(200,hostHtml,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':hostCsp});
  if(url.pathname==='/packet.json'&&!url.search)return respond(200,JSON.stringify(packet),{'Content-Type':'application/json; charset=utf-8','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});
  return respond(404,'Not found');
 };
 const ipv4=createServer(handler),ipv6=createServer(handler),servers=[ipv4,ipv6];
 const close=async()=>{await Promise.all(servers.map(server=>new Promise<void>((yes,no)=>{if(!server.listening){yes();return;}server.close(e=>e?no(e):yes());server.closeAllConnections();})));};
 const listen=(server:typeof ipv4,selectedPort:number,host:'127.0.0.1'|'::1')=>new Promise<void>((yes,no)=>{
  server.once('error',no);server.listen({port:selectedPort,host,ipv6Only:host==='::1'},()=>{server.off('error',no);yes();});
 });
 try{
  await listen(ipv4,port,'127.0.0.1');
  const address=ipv4.address();if(!address||typeof address==='string')throw new Error('Local host did not bind.');
  origin='http://localhost:'+address.port;viewerOrigin='http://127.0.0.1:'+address.port;
  servePage(packet);
  viewerCsp=`default-src 'none'; script-src 'sha256-${hashes[0]}'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${origin}`;
  // localhost can resolve to ::1 first. Both sockets use the same port/handler, and neither binds all interfaces.
  // Require the pair: silently advertising localhost with only IPv4 can hang browsers before an HTTP response.
  try{await listen(ipv6,address.port,'::1');}catch{throw new Error('Both IPv4 (127.0.0.1) and IPv6 (::1) loopback must be available on the selected port. No host was left running.');}
 }catch(error){await close();throw error;}
 // allow-scripts + allow-same-origin is restricted to this separate 127.0.0.1 origin; it cannot read the localhost host.
 // The failure flag is raised before preparing, so a request racing a regeneration never sees the previous packet.
 const regenerate:LocalConceptHost['regenerate']=async next=>{
  failure=REGENERATION_FAILED;
  try{const fresh=await prepareConceptHostPacket(next.document,options.viewId,options.audience,next.packet);servePage(fresh);packet=fresh;failure=undefined;return {ok:true,packet:fresh};}
  catch{return {ok:false,reason:REGENERATION_FAILED};}
 };
 return {url:origin+'/',origin,viewerOrigin,get packet(){return packet;},get failure(){return failure;},regenerate,close};
}
const usage='Usage: npm run concept:host -- <document.json> --view <id> --audience <public|author> --viewer <local-owner.html> --viewer-sha256 <sha256> [--packet <preview.packet.json>] [--port <0..65535>] [--diagramcloud-origin <explicit-http-origin>]';
export type RegenerationResult=Awaited<ReturnType<LocalConceptHost['regenerate']>>;
/**
 * A watched host. `ready` resolves once the change baseline is taken; it is taken synchronously before the document is
 * first read, so a save made at any time after `runConceptHost` starts is never lost (at worst it regenerates the same
 * content once). `nextRegeneration()` resolves with the next completed regeneration after the call.
 */
export type WatchedConceptHost=LocalConceptHost&{ready:Promise<void>;nextRegeneration():Promise<RegenerationResult>};
const fileKey=(path:string,read:(path:string)=>{mtimeMs:number;size:number})=>{try{const s=read(path);return `${s.mtimeMs}:${s.size}`;}catch{return 'missing';}};
/** `watch`: when the selected document file changes, re-read it (and the packet) and regenerate; a failed read or regeneration serves the error. */
export async function runConceptHost(args:string[],options:{watch:true;intervalMs?:number}):Promise<WatchedConceptHost>;
export async function runConceptHost(args:string[],options?:{watch?:false;intervalMs?:number}):Promise<LocalConceptHost>;
export async function runConceptHost(args:string[],options:{watch?:boolean;intervalMs?:number}={}):Promise<LocalConceptHost|WatchedConceptHost>{
 const [input,...rest]=args;if(!input||input.startsWith('--')||rest.length%2)throw new Error(usage);
 const values=new Map<string,string>();for(let i=0;i<rest.length;i+=2){const key=rest[i],value=rest[i+1];if(!['--view','--audience','--viewer','--viewer-sha256','--packet','--port','--diagramcloud-origin'].includes(key)||values.has(key)||!value||value.startsWith('--'))throw new Error(usage);values.set(key,value);}
 const viewId=values.get('--view'),audience=values.get('--audience'),viewer=values.get('--viewer'),viewerSha256=values.get('--viewer-sha256');
 if(!viewId||!viewer||!viewerSha256||(audience!=='public'&&audience!=='author'))throw new Error(usage);
 if(values.has('--port')&&!/^\d{1,5}$/.test(values.get('--port')!))throw new Error('Invalid local port.');
 const path=resolve(input);
 // The baseline precedes the first read: a save between the two is seen as a change, never folded into the baseline.
 let last=options.watch?fileKey(path,statSync):'';
 const document=parseDocument(selectedBytes(input,MAX_DOCUMENT_BYTES).toString('utf8'));
 const packet=values.has('--packet')?JSON.parse(selectedBytes(values.get('--packet')!,PACKET_MAX_BYTES).toString('utf8')):undefined;
 const host=await startConceptHost({document,viewId,audience,viewerHtml:selectedBytes(viewer,VIEWER_MAX_BYTES),viewerSha256,packet,port:values.has('--port')?Number(values.get('--port')):0,diagramcloudOrigin:values.get('--diagramcloud-origin')});
 if(!options.watch)return host;
 let queue=Promise.resolve(),waiters:((result:RegenerationResult)=>void)[]=[];
 const reload=()=>{queue=queue.then(async()=>{
  let document:Project|undefined,selected:unknown;
  try{document=parseDocument(selectedBytes(input,MAX_DOCUMENT_BYTES).toString('utf8'));selected=values.has('--packet')?JSON.parse(selectedBytes(values.get('--packet')!,PACKET_MAX_BYTES).toString('utf8')):undefined;}catch{document=undefined;}
  const result=await host.regenerate({document:document as Project,packet:selected});
  process.stderr.write(result.ok?`Regenerated preview packet for revision ${result.packet.baseRevision}.\n`:`${result.reason}\n`);
  const done=waiters;waiters=[];for(const resolveWaiter of done)resolveWaiter(result);
 });};
 let closed=false,timer:ReturnType<typeof setTimeout>|undefined;
 const poll=async()=>{
  const key=await stat(path).then(s=>`${s.mtimeMs}:${s.size}`,()=>'missing');
  if(closed)return;if(key!==last){last=key;reload();}
  timer=setTimeout(poll,options.intervalMs??1000);
 };
 timer=setTimeout(poll,options.intervalMs??1000);
 return {url:host.url,origin:host.origin,viewerOrigin:host.viewerOrigin,get packet(){return host.packet;},get failure(){return host.failure;},regenerate:host.regenerate,
  ready:Promise.resolve(),nextRegeneration:()=>new Promise<RegenerationResult>(yes=>{waiters.push(yes);}),
  close:async()=>{closed=true;clearTimeout(timer);await queue;await host.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runConceptHost(process.argv.slice(2),{watch:true}).then(host=>{process.stdout.write(`Local concept host: ${host.url}\nViewer origin: ${host.viewerOrigin}\nAudience: ${host.packet.audience}; viewer selection return unsupported. Saving the document regenerates the packet; a failed regeneration serves an error. Press Ctrl+C to close.\n`);for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void host.close();});}).catch(()=>{process.stderr.write('Concept host failed. Check the explicit view/audience, authorized document, packet and selected owner viewer hash. Both IPv4 and IPv6 loopback must be available on the selected port.\n');process.exitCode=1;});
}
