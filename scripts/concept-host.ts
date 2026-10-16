/** Isolated loopback host for an explicitly selected owner viewer. No arbitrary file route or runtime. */
import {createServer,type RequestListener} from 'node:http';
import {createHash} from 'node:crypto';
import {openSync,readFileSync,fstatSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseDocument,MAX_DOCUMENT_BYTES,type Project} from '../src/core/model';
import {conceptHostPage,prepareConceptHostPacket} from '../src/interop/conceptHost';
import type {ConceptPreview} from '../src/interop/conceptPreview';

const VIEWER_MAX_BYTES=8*1024*1024,PACKET_MAX_BYTES=32*1024*1024;
function selectedBytes(path:string,max:number):Buffer{
 const fd=openSync(resolve(path),'r');try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size>max)throw new Error('Selected file exceeds its bounded profile.');const bytes=readFileSync(fd);if(bytes.length>max)throw new Error('Selected file exceeds its bounded profile.');return bytes;}finally{closeSync(fd);}
}
export type LocalConceptHost={url:string;origin:string;viewerOrigin:string;packet:ConceptPreview;close():Promise<void>};
export async function startConceptHost(options:{document:Project;viewId:string;audience:'public'|'author';viewerHtml:Buffer|string;viewerSha256:string;packet?:unknown;port?:number;diagramcloudOrigin?:string}):Promise<LocalConceptHost>{
 const bytes=Buffer.isBuffer(options.viewerHtml)?Buffer.from(options.viewerHtml):Buffer.from(options.viewerHtml,'utf8');
 if(bytes.length>VIEWER_MAX_BYTES||!/^[a-f0-9]{64}$/.test(options.viewerSha256)||createHash('sha256').update(bytes).digest('hex')!==options.viewerSha256)throw new Error('Selected viewer hash does not match.');
 const viewer=bytes.toString('utf8');
 // Keep the owner's existing hashed executable. An additional response CSP denies every external request.
 const hashes=[...viewer.matchAll(/script-src 'sha256-([A-Za-z0-9+/]{43}=)'/g)].map(m=>m[1]);
 if(hashes.length!==1)throw new Error('Selected viewer must declare one owner script hash.');
 const packet=await prepareConceptHostPacket(options.document,options.viewId,options.audience,options.packet);
 const port=options.port??0;if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local port.');
 let origin='',viewerOrigin='',hostHtml='',hostCsp='',viewerCsp='';
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
  const page=conceptHostPage(packet,viewerOrigin,options.diagramcloudOrigin);hostHtml=page.html;
  hostCsp=`default-src 'none'; script-src 'sha256-${createHash('sha256').update(page.script).digest('base64')}'; style-src 'unsafe-inline'; frame-src ${viewerOrigin}; connect-src 'none'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  viewerCsp=`default-src 'none'; script-src 'sha256-${hashes[0]}'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${origin}`;
  // localhost can resolve to ::1 first. Both sockets use the same port/handler, and neither binds all interfaces.
  // Require the pair: silently advertising localhost with only IPv4 can hang browsers before an HTTP response.
  try{await listen(ipv6,address.port,'::1');}catch{throw new Error('Both IPv4 (127.0.0.1) and IPv6 (::1) loopback must be available on the selected port. No host was left running.');}
 }catch(error){await close();throw error;}
 // allow-scripts + allow-same-origin is restricted to this separate 127.0.0.1 origin; it cannot read the localhost host.
 return {url:origin+'/',origin,viewerOrigin,packet,close};
}
const usage='Usage: npm run concept:host -- <document.json> --view <id> --audience <public|author> --viewer <local-owner.html> --viewer-sha256 <sha256> [--packet <preview.packet.json>] [--port <0..65535>] [--diagramcloud-origin <explicit-http-origin>]';
export async function runConceptHost(args:string[]):Promise<LocalConceptHost>{
 const [input,...rest]=args;if(!input||input.startsWith('--')||rest.length%2)throw new Error(usage);
 const values=new Map<string,string>();for(let i=0;i<rest.length;i+=2){const key=rest[i],value=rest[i+1];if(!['--view','--audience','--viewer','--viewer-sha256','--packet','--port','--diagramcloud-origin'].includes(key)||values.has(key)||!value||value.startsWith('--'))throw new Error(usage);values.set(key,value);}
 const viewId=values.get('--view'),audience=values.get('--audience'),viewer=values.get('--viewer'),viewerSha256=values.get('--viewer-sha256');
 if(!viewId||!viewer||!viewerSha256||(audience!=='public'&&audience!=='author'))throw new Error(usage);
 if(values.has('--port')&&!/^\d{1,5}$/.test(values.get('--port')!))throw new Error('Invalid local port.');
 const document=parseDocument(selectedBytes(input,MAX_DOCUMENT_BYTES).toString('utf8'));
 const packet=values.has('--packet')?JSON.parse(selectedBytes(values.get('--packet')!,PACKET_MAX_BYTES).toString('utf8')):undefined;
 return startConceptHost({document,viewId,audience,viewerHtml:selectedBytes(viewer,VIEWER_MAX_BYTES),viewerSha256,packet,port:values.has('--port')?Number(values.get('--port')):0,diagramcloudOrigin:values.get('--diagramcloud-origin')});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runConceptHost(process.argv.slice(2)).then(host=>{process.stdout.write(`Local concept host: ${host.url}\nViewer origin: ${host.viewerOrigin}\nAudience: ${host.packet.audience}; viewer selection return unsupported. Press Ctrl+C to close.\n`);for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void host.close();});}).catch(()=>{process.stderr.write('Concept host failed. Check the explicit view/audience, authorized document, packet and selected owner viewer hash. Both IPv4 and IPv6 loopback must be available on the selected port.\n');process.exitCode=1;});
}
