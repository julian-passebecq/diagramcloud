/** Dev-server side of "New from template" (R964): copies templates/<t>.svg to diagrams/<name>.svg, never outside diagrams/. */
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
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
/** True when the TCP peer is this machine (IPv4, IPv6 or IPv4-mapped loopback). */
export const isLoopbackPeer=(addr:string|undefined)=>/^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/i.test(addr??'');

/** POST /__shell/new {name, template} while `npm run dev` runs, from a page on localhost only. A built or previewed page has no such route. */
export function diagramWriter(root=process.cwd()):Plugin{
 return {name:'diagramcloud-shell-writer',apply:'serve',configureServer(server){
  // Opened directly in the dev server, a diagram or template is a sandboxed document: its own script never runs.
  for(const dir of ['/diagrams/','/templates/'])server.middlewares.use(dir,(_req,res,next)=>{res.setHeader('Content-Security-Policy','sandbox');next();});
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
