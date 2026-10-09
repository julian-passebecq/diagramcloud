import {readdirSync,readFileSync,statSync,lstatSync} from 'node:fs';
import {join,relative,sep} from 'node:path';
import {IGNORED_DIR,MAX_FILE_BYTES,MAX_FILES,wantedFile,type ScanFile} from '../../src/core/scan/scanner';
import {VENDOR_PATH,GENERATED_PATH} from '../../src/core/scan/inventory';

/**
 * Read a repository folder the way the browser folder picker does: only files the scanner wants (no ignored folders,
 * no secret files, size and count limits). From `.git` only HEAD, packed-refs and refs/heads are read, to record the
 * branch and commit. Never runs git, never touches the network.
 */
/** True when a sub-folder carries its own `.git` (a folder for a clone, a file for a worktree or submodule). */
export function nestedRepository(dir:string):boolean{try{lstatSync(join(dir,'.git'));return true;}catch{return false;}}

export function readRepositorySelection(root:string):{files:ScanFile[];boundaryPaths:string[];boundaryMarkers:ScanFile[];omitted:Record<string,number>}{
 const files:ScanFile[]=[],boundaryPaths:string[]=[],boundaryMarkers:ScanFile[]=[],omitted:Record<string,number>={};const omit=(why:string)=>{omitted[why]=(omitted[why]??0)+1;};
 function walkRefs(dir:string,prefix:string){try{for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink()){omit('symlink Git metadata excluded');continue;}if(files.length>=MAX_FILES){omit('Git metadata count budget');break;}if(e.isDirectory())walkRefs(join(dir,e.name),`${prefix}/${e.name}`);else if(e.isFile()){const full=join(dir,e.name);if(statSync(full).size>MAX_FILE_BYTES){omit('Git metadata byte budget');continue;}files.push({path:`${prefix}/${e.name}`,text:readFileSync(full,'utf8')});}}}catch{/* no refs */}}
 function walk(dir:string){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   const full=join(dir,entry.name),rel=relative(root,full).split(sep).join('/');
   if(entry.isSymbolicLink()){omit('symlink entry excluded');continue;}
   if(entry.isDirectory()){if(rel==='.git'){for(const f of ['HEAD','packed-refs'])try{const selected=join(full,f);if(lstatSync(selected).isSymbolicLink()||statSync(selected).size>MAX_FILE_BYTES){omit('unsafe/large Git metadata');continue;}files.push({path:`.git/${f}`,text:readFileSync(selected,'utf8')});}catch{/* absent */}walkRefs(join(full,'refs','heads'),'.git/refs/heads');continue;}
    // A nested repository, submodule or git worktree (its own .git file or folder) is another repository: never part of this one.
    if(IGNORED_DIR.test(`${rel}/`)){omit('ignored directory excluded (not counted as files)');if(VENDOR_PATH.test(rel+'/'))omit('vendor directory excluded (not counted as files)');else if(GENERATED_PATH.test(rel+'/'))omit('generated directory excluded (not counted as files)');continue;}
    if(nestedRepository(full)){boundaryPaths.push(rel+'/.git');omit('nested Git boundary excluded');try{const marker=join(full,'.git'),metadata=lstatSync(marker);if(metadata.isFile()&&!metadata.isSymbolicLink()&&metadata.size<=2048)boundaryMarkers.push({path:rel+'/.git',text:readFileSync(marker,'utf8')});}catch{/* path-only boundary remains */}continue;}
    walk(full);continue;}
   if(files.length>=MAX_FILES){omit('file count budget');continue;}
   if(GENERATED_PATH.test(rel)&&!/(?:^|\/)target\/manifest\.json$/i.test(rel)){omit('generated file excluded by metadata');continue;}
   if(entry.isFile()&&wantedFile(rel)){if(statSync(full).size<=MAX_FILE_BYTES)files.push({path:rel,text:readFileSync(full,'utf8')});else omit('file byte budget');}else omit('unsupported or sensitive file excluded');
  }
 }
 walk(root);
 return {files,boundaryPaths,boundaryMarkers,omitted};
}
export function readRepository(root:string):ScanFile[]{return readRepositorySelection(root).files;}
