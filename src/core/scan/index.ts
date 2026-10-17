import {documentFromScan} from './document';
import {MAX_FILE_BYTES,MAX_FILES,scanRepository,wantedFile,type ScanFile,outsideNestedRepositories,checkAbort} from './scanner';
import type {ImportResult} from '../interchange/graph';

export {scanRepository,wantedFile,documentFromScan};
export {INSTRUCTION_FILE} from './scanner';
export type {ScanFile,ScanModel,Confidence,Evidence} from './scanner';

/** Scan files already read (CLI, tests) into a validated project plus a report. */
export function scanToDocument(files:ScanFile[],options:{name?:string;now?:Date;fileName?:string;signal?:AbortSignal}={}):ImportResult{
 const model=scanRepository(files,{name:options.name,signal:options.signal});checkAbort(options.signal);
 return documentFromScan(model,{now:options.now,fileName:options.fileName??options.name});
}

/**
 * Browser folder picker (`<input type="file" webkitdirectory>`): keep only the files the scanner reads, by path and size,
 * before reading any content. The folder name (first path segment) names the repository.
 */
export async function scanPickedFolder(list:ArrayLike<File>,now=new Date(),signal?:AbortSignal):Promise<ImportResult&{read:number}>{
 const {files,name,folder,omitted}=await readPickedFolder(list,signal);
 const result=scanToDocument(files,{name,now,fileName:folder,signal});
 // Files left out before reading are omissions too: the report names them instead of dropping them silently.
 if(omitted.oversized)result.report.lost.unshift(`${omitted.oversized} selected file(s) over 512 KiB not read.`);
 if(omitted.beyondLimit)result.report.lost.unshift(`${omitted.beyondLimit} selected file(s) beyond the first ${MAX_FILES} not read.`);
 return {...result,read:files.length};
}
/** The scan model of a picked folder (project atlas rescans embed it under the repository's ID prefix). */
export async function scanPickedFolderModel(list:ArrayLike<File>,name?:string){const {files,name:found,folder}=await readPickedFolder(list);return {model:scanRepository(files,{name:name||found}),read:files.length,folder};}
async function readPickedFolder(list:ArrayLike<File>,signal?:AbortSignal){
 checkAbort(signal);
 const all=Array.from(list);if(!all.length)throw new Error('The folder is empty.');
 const rel=(f:File)=>(f.webkitRelativePath||f.name).replace(/\\/g,'/');
 const folder=rel(all[0]).split('/')[0]||'repository';
 // A sub-folder with its own .git (nested clone, submodule, git worktree) is another repository, as in the CLI reader.
 const wanted=outsideNestedRepositories(all.map(f=>({f,path:rel(f).split('/').slice(1).join('/')}))).filter(x=>x.path&&wantedFile(x.path));
 const small=wanted.filter(x=>x.f.size<=MAX_FILE_BYTES),picked=small.slice(0,MAX_FILES);
 const omitted={oversized:wanted.length-small.length,beyondLimit:small.length-picked.length};
 if(!picked.length)throw new Error(`Nothing to scan in “${folder}”: no manifest, configuration, schema or source file was found.`);
 const files:ScanFile[]=[];
 for(let i=0;i<picked.length;i+=64){checkAbort(signal);files.push(...await Promise.all(picked.slice(i,i+64).map(async x=>({path:x.path,text:await x.f.text()}))));}
 checkAbort(signal);
 const pkgName=(()=>{try{const p=files.find(f=>f.path==='package.json');return p?String(JSON.parse(p.text).name??'').replace(/^@[^/]+\//,''):'';}catch{return '';}})();
 return {files,name:pkgName||folder,folder,omitted};
}
