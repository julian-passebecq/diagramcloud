/** Dev-server side of "New from template" (R964): copies templates/<t>.svg to diagrams/<name>.svg, never outside diagrams/. */
import {readdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {basename,dirname,join,resolve,sep} from 'node:path';
import type {Plugin} from 'vite';
import {checkNewName} from './shellModel';

export function writeFromTemplate(root:string,name:string,template:string):string{
 const dir=resolve(root,'diagrams');const tdir=resolve(root,'templates');
 if(!readdirSync(tdir).filter(n=>n.endsWith('.svg')).includes(template))throw new Error(`Unknown template "${template}".`);
 const refused=checkNewName(name,readdirSync(dir));if(refused)throw new Error(refused);
 const file=resolve(dir,`${name}.svg`);
 if(!file.startsWith(dir+sep))throw new Error('Refused: the file would be outside diagrams/.');
 writeFileSync(file,readFileSync(join(tdir,template)),{flag:'wx'}); // wx: never overwrite, even in a race
 return `diagrams/${name}.svg`;
}

/** True when the Host header names this machine: localhost, 127.0.0.1 or [::1], with or without a port. */
export const isLoopbackHost=(host:string|undefined)=>/^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i.test(host??'');
/** True when the file a dev request is served from lies under diagrams/ or templates/ (any extension, any spelling):
 *  the path is decoded, normalised, /@fs/ followed and symlinks resolved, so the check is on what is served. */
export function servesUserFile(root:string,url:string|undefined):boolean{
 let p=(url??'').split(/[?#]/)[0];
 // A malformed percent-encoding cannot be judged: sandbox it rather than guess what Vite would serve (R990).
 try{p=decodeURIComponent(p);}catch{return true;}
 p=p.replace(/\\/g,'/');
 // A file that does not exist (yet) is judged by its nearest existing folder, resolved like diagrams/ itself: a root
 // reached through a link (macOS /var -> /private/var, a junction) otherwise compares two spellings of one place (R990).
 const real=(f:string):string=>{try{return realpathSync.native(f);}catch{const up=dirname(f);return up===f?f:join(real(up),basename(f));}};
 const file=real(p.startsWith('/@fs/')?resolve(p.slice(4).replace(/^\/([A-Za-z]:)/,'$1')):resolve(root,'.'+p));
 const fold=(f:string)=>process.platform==='linux'?f:f.toLowerCase(); // Windows and macOS folders ignore case
 return ['diagrams','templates'].some(d=>{const dir=fold(real(resolve(root,d)));return fold(file)===dir||fold(file).startsWith(dir+sep);});
}
/** True when the TCP peer is this machine (IPv4, IPv6 or IPv4-mapped loopback). */
export const isLoopbackPeer=(addr:string|undefined)=>/^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/i.test(addr??'');

/** POST /__shell/new {name, template} while `npm run dev` runs, from a page on localhost only. A built or previewed page has no such route. */
export function diagramWriter(root=process.cwd()):Plugin{
 return {name:'diagramcloud-shell-writer',apply:'serve',configureServer(server){
  // Every file served from diagrams/ or templates/, however it is asked for, is a sandboxed document that is never
  // sniffed: its own script never runs in the dev origin. The shell still reads the text (a module import is not a document).
  server.middlewares.use((req,res,next)=>{if(servesUserFile(root,req.url)){res.setHeader('Content-Security-Policy','sandbox');res.setHeader('X-Content-Type-Options','nosniff');}next();});
  server.middlewares.use('/__shell/new',(req,res)=>{
   const reply=(code:number,body:object)=>{res.statusCode=code;res.setHeader('content-type','application/json');res.end(JSON.stringify(body));};
   // A JSON content type forces a CORS preflight, so another site cannot post here.
   // Only a page opened on this machine may write: a LAN visitor or a rebinding DNS name gets 403 (dev runs on 0.0.0.0).
   // A browser always sends Origin on a POST: it must be this very page (http://<Host>).
   const origin=req.headers.origin;
   if(!isLoopbackHost(req.headers.host)||!isLoopbackPeer(req.socket?.remoteAddress)||(origin!==undefined&&origin!==`http://${req.headers.host}`))
    return reply(403,{ok:false,error:'Refused: New from template writes only for a page opened on localhost.'});
   if(req.method!=='POST'||String(req.headers['content-type']).trim().toLowerCase()!=='application/json')return reply(405,{ok:false,error:'POST JSON only.'});
   let body='';
   req.on('data',c=>{body+=c;if(body.length>2048)req.destroy();});
   req.on('end',()=>{try{const {name,template}=JSON.parse(body);reply(200,{ok:true,path:writeFromTemplate(root,String(name),String(template))});}
    catch(e){reply(400,{ok:false,error:(e as Error).message});}});
  });
 }};
}
