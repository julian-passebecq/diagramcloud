/** R1006: dev-server side of the shell's live pick-up of diagrams/. No route, no middleware: one HMR filter.
 *  Vite reads diagrams/x.svg?raw through a plain module of the file itself. When the file is deleted, that plain module
 *  loses its only importer and Vite would reload the whole page; the ?raw module still reaches liveDiagrams.ts, which
 *  accepts the update. So on a delete (or a re-create) under diagrams/ an orphaned module is left out and the shell updates in place. */
import {resolve,sep} from 'node:path';
import type {Plugin} from 'vite';

/** True when an absolute file path lies under <root>/diagrams/ (any slash, any case on Windows and macOS). */
export function inDiagrams(root:string,file:string):boolean{
 const fold=(f:string)=>{const p=resolve(f);return process.platform==='linux'?p:p.toLowerCase();};
 return fold(file).startsWith(fold(resolve(root,'diagrams'))+sep);
}

export function liveDeletes(root=process.cwd()):Plugin{
 return {name:'diagramcloud-shell-live-deletes',apply:'serve',
  hotUpdate({type,file,modules}){
   // A file created again after a delete still has its old, orphaned module in the graph: the same filter applies.
   if(type==='update'||!inDiagrams(root,file))return;
   return modules.filter(m=>m.importers.size>0);
  }};
}
