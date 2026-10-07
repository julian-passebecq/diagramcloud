import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,sep} from 'node:path';
import {IGNORED_DIR,MAX_FILE_BYTES,MAX_FILES,wantedFile,type ScanFile} from '../../src/core/scan/scanner';

/**
 * Read a repository folder the way the browser folder picker does: only files the scanner wants (no ignored folders,
 * no secret files, size and count limits). From `.git` only HEAD, packed-refs and refs/heads are read, to record the
 * branch and commit. Never runs git, never touches the network.
 */
/** True when a sub-folder carries its own `.git` (a folder for a clone, a file for a worktree or submodule). */
export function nestedRepository(dir:string):boolean{try{statSync(join(dir,'.git'));return true;}catch{return false;}}

export function readRepository(root:string):ScanFile[]{
 const files:ScanFile[]=[];
 function walkRefs(dir:string,prefix:string){try{for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isDirectory())walkRefs(join(dir,e.name),`${prefix}/${e.name}`);else files.push({path:`${prefix}/${e.name}`,text:readFileSync(join(dir,e.name),'utf8')});}}catch{/* no refs */}}
 function walk(dir:string){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   const full=join(dir,entry.name),rel=relative(root,full).split(sep).join('/');
   if(entry.isDirectory()){if(rel==='.git'){for(const f of ['HEAD','packed-refs'])try{files.push({path:`.git/${f}`,text:readFileSync(join(full,f),'utf8')});}catch{/* absent */}walkRefs(join(full,'refs','heads'),'.git/refs/heads');continue;}
    // A nested repository, submodule or git worktree (its own .git file or folder) is another repository: never part of this one.
    if(!IGNORED_DIR.test(`${rel}/`)&&!nestedRepository(full))walk(full);continue;}
   if(files.length>=MAX_FILES)return;
   if(entry.isFile()&&wantedFile(rel)&&statSync(full).size<=MAX_FILE_BYTES)files.push({path:rel,text:readFileSync(full,'utf8')});
  }
 }
 walk(root);
 return files;
}
