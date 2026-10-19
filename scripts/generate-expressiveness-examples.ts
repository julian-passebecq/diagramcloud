/** Regenerates the committed synthetic teaching examples in examples/pro-expressiveness/ from cases.ts.
 * Offline and deterministic: writes JSON only (no HTML exports, which are reproducible from the Project).
 * Usage: tsx scripts/generate-expressiveness-examples.ts [--check]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {teachingCases,teachingProject} from '../examples/pro-expressiveness/cases';

export const EXAMPLES_DIR=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../examples/pro-expressiveness');
const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n';

/** File name to exact content for every committed example file. */
export function expressivenessExampleFiles():Record<string,string>{
 const files:Record<string,string>={};
 for(const c of teachingCases()){
  files[`${c.id}.base.json`]=json(c.base);
  files[`${c.id}.walkthrough.json`]=json(c.request);
  files[`${c.id}.project.json`]=json(teachingProject(c));
 }
 return files;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const check=process.argv.includes('--check');
 const stale:string[]=[];
 for(const [name,content] of Object.entries(expressivenessExampleFiles())){
  const file=path.join(EXAMPLES_DIR,name);
  if(check){const current=await fs.readFile(file,'utf8').then(t=>t.replace(/\r\n/g,'\n'),()=>null);if(current!==content)stale.push(name);}
  else await fs.writeFile(file,content);
 }
 if(stale.length){console.error(`Stale examples: ${stale.join(', ')}. Run tsx scripts/generate-expressiveness-examples.ts.`);process.exitCode=1;}
 else console.log(check?'Examples are current.':'Examples written.');
}
