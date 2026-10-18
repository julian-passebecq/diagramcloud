/** Explicit offline authoring. Run with the repository's installed tsx; no model, network or subprocess. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDocument} from '../src/core/model';
import {prepareExplanationWalkthrough} from '../src/intelligence/explanationWalkthrough';

const LIMIT=4*1024*1024;
async function readRegular(file:string):Promise<string>{
 const handle=await fs.open(file,'r');
 try{const stat=await handle.stat();if(!stat.isFile()||stat.size>LIMIT)throw new Error('Choose a regular input file of at most 4 MiB.');
  const bytes=await handle.readFile();if(bytes.length>LIMIT)throw new Error('Input grew beyond 4 MiB.');
  const text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))throw new Error('Input must be exact UTF-8.');return text;
 }finally{await handle.close();}
}
export async function prepareExplanationFiles(args:string[]):Promise<{output:string;files:string[]}>{
 if(args.length!==6||args[0]!=='--project'||args[2]!=='--request'||args[4]!=='--out'||[args[1],args[3],args[5]].some(v=>!v||v.startsWith('--')))
  throw new Error('Usage: tsx scripts/prepare-explanation.ts --project project.json --request walkthrough.json --out NEW_DIRECTORY');
 const [projectRaw,requestRaw]=await Promise.all([readRegular(path.resolve(args[1])),readRegular(path.resolve(args[3]))]);
 const result=prepareExplanationWalkthrough(parseDocument(projectRaw),JSON.parse(requestRaw));
 const output=path.resolve(args[5]);
 // No overwrite, recursion, command execution or publication; the chosen parent must already exist.
 await fs.mkdir(output,{recursive:false});
 const files:Record<string,unknown>={'explanation.patch.json':result.patch,'explanation.preview.json':result.preview,
  'explanation-map.json':{tourId:result.tourId,entryNodeId:result.entryNodeId,steps:result.steps,notice:result.notice,applied:false}};
 try{for(const [name,value] of Object.entries(files))await fs.writeFile(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
 catch(error){throw new Error(`Output incomplete; original inputs were not changed. Inspect ${output}. ${error instanceof Error?error.message:String(error)}`);}
 return {output,files:Object.keys(files)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 prepareExplanationFiles(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r)),error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
}
