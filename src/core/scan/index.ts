import {documentFromScan} from './document';
import {MAX_FILE_BYTES,MAX_FILES,scanRepository,wantedFile,type ScanFile} from './scanner';
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
 const all=Array.from(list);if(!all.length)throw new Error('The folder is empty.');
 const rel=(f:File)=>(f.webkitRelativePath||f.name).replace(/\\/g,'/');
 const folder=rel(all[0]).split('/')[0]||'repository';
 const picked=all.map(f=>({f,path:rel(f).split('/').slice(1).join('/')})).filter(x=>x.path&&wantedFile(x.path)&&x.f.size<=MAX_FILE_BYTES).slice(0,MAX_FILES);
 if(!picked.length)throw new Error(`Nothing to scan in “${folder}”: no manifest, configuration, schema or source file was found.`);
 const files=await Promise.all(picked.map(async x=>({path:x.path,text:await x.f.text()})));
 const pkgName=(()=>{try{const p=files.find(f=>f.path==='package.json');return p?String(JSON.parse(p.text).name??'').replace(/^@[^/]+\//,''):'';}catch{return '';}})();
 return {...scanToDocument(files,{name:pkgName||folder,now,fileName:folder}),read:files.length};
}
