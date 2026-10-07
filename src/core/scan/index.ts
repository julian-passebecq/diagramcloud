import {documentFromScan} from './document';
import {MAX_FILE_BYTES,MAX_FILES,scanRepository,wantedFile,type ScanFile,outsideNestedRepositories} from './scanner';
import type {ImportResult} from '../interchange/graph';

export {scanRepository,wantedFile,documentFromScan};
export type {ScanFile,ScanModel,Confidence,Evidence} from './scanner';

/** Scan files already read (CLI, tests) into a validated project plus a report. */
export function scanToDocument(files:ScanFile[],options:{name?:string;now?:Date;fileName?:string}={}):ImportResult{
 return documentFromScan(scanRepository(files,{name:options.name}),{now:options.now,fileName:options.fileName??options.name});
}

/**
 * Browser folder picker (`<input type="file" webkitdirectory>`): keep only the files the scanner reads, by path and size,
 * before reading any content. The folder name (first path segment) names the repository.
 */
export async function scanPickedFolder(list:ArrayLike<File>,now=new Date()):Promise<ImportResult&{read:number}>{
 const {files,name,folder}=await readPickedFolder(list);
 return {...scanToDocument(files,{name,now,fileName:folder}),read:files.length};
}
/** The scan model of a picked folder (project atlas rescans embed it under the repository's ID prefix). */
export async function scanPickedFolderModel(list:ArrayLike<File>,name?:string){const {files,name:found,folder}=await readPickedFolder(list);return {model:scanRepository(files,{name:name||found}),read:files.length,folder};}
async function readPickedFolder(list:ArrayLike<File>){
 const all=Array.from(list);if(!all.length)throw new Error('The folder is empty.');
 const rel=(f:File)=>(f.webkitRelativePath||f.name).replace(/\\/g,'/');
 const folder=rel(all[0]).split('/')[0]||'repository';
 // A sub-folder with its own .git (nested clone, submodule, git worktree) is another repository, as in the CLI reader.
 const picked=outsideNestedRepositories(all.map(f=>({f,path:rel(f).split('/').slice(1).join('/')}))).filter(x=>x.path&&wantedFile(x.path)&&x.f.size<=MAX_FILE_BYTES).slice(0,MAX_FILES);
 if(!picked.length)throw new Error(`Nothing to scan in “${folder}”: no manifest, configuration, schema or source file was found.`);
 const files=await Promise.all(picked.map(async x=>({path:x.path,text:await x.f.text()})));
 const pkgName=(()=>{try{const p=files.find(f=>f.path==='package.json');return p?String(JSON.parse(p.text).name??'').replace(/^@[^/]+\//,''):'';}catch{return '';}})();
 return {files,name:pkgName||folder,folder};
}
