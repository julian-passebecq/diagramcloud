/** Explicit offline export. No fetch, provider execution, overwrite or public upload. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDocument} from '../src/core/model';
import {prepareLinkedReading,type LinkedReadingOptions} from '../src/core/linkedReading';
import {linkedReadingHtml} from '../src/export/linkedReadingHtml';
async function plainPath(file:string){let current=path.parse(file).root;for(const part of file.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);if((await fs.lstat(current)).isSymbolicLink())throw Error('Symbolic links are not accepted.');}}
async function readBounded(file:string,max:number){await plainPath(file);const handle=await fs.open(file,'r');try{const s=await handle.stat();if(!s.isFile()||s.size>max)throw Error('Input is not a bounded regular file.');const bytes=Buffer.alloc(max+1);const {bytesRead}=await handle.read(bytes,0,bytes.length,0);if(bytesRead>max)throw Error('Input exceeds byte limit.');const b=bytes.subarray(0,bytesRead),text=b.toString('utf8');if(!Buffer.from(text).equals(b))throw Error('Input must be UTF-8.');return text;}finally{await handle.close();}}
export async function exportLinkedReading(projectFile:string,readingFile:string,outputDir:string,now?:Date){
 const p=path.resolve(projectFile),r=path.resolve(readingFile),out=path.resolve(outputDir);await plainPath(path.dirname(out));
 const project=parseDocument(await readBounded(p,12*1024*1024));const options=JSON.parse(await readBounded(r,64*1024)) as LinkedReadingOptions;prepareLinkedReading(project,options);
 // Render and validate before creating output. Existing directories refuse with EEXIST.
 const html=linkedReadingHtml(project,options,{now});await fs.mkdir(out);const target=path.join(out,'linked-reading.html');await fs.writeFile(target,html,{flag:'wx'});return target;
}
export async function exportTechnicalCatalogue(outputDir:string,now?:Date){
 const out=path.resolve(outputDir);await plainPath(path.dirname(out));
 const {buildTechnicalCatalogue}=await import('../examples/client-atlas/build');
 const {project,reading}=buildTechnicalCatalogue();const html=linkedReadingHtml(project,reading,{now});
 await fs.mkdir(out);
 for(const [name,value]of [['Technology-Catalogue.project.json',JSON.stringify(project,null,2)+'\n'],['Technology-Catalogue.reading.json',JSON.stringify(reading,null,2)+'\n'],['linked-reading.html',html]])await fs.writeFile(path.join(out,name),value,{flag:'wx'});
 return path.join(out,'linked-reading.html');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const run=args.length===2&&args[0]==='--catalogue'?exportTechnicalCatalogue(args[1]):args.length===3?exportLinkedReading(args[0],args[1],args[2]):null;
 if(!run){console.error('Usage: tsx scripts/export-linked-reading.ts PROJECT.json READING.json NEW_DIRECTORY | --catalogue NEW_DIRECTORY');process.exitCode=2;}
 else run.then(file=>console.log(file)).catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
}
