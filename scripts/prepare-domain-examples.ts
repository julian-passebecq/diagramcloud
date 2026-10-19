/** Explicit offline authoring command. Uses existing native validators/exporters;
 * no source scanning, AI call, tenant read, code evaluation or overwrite. */
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {buildDomainDataReference} from '../examples/domain-data/build';
import {buildPracticalPatternCandidates,buildPracticalPatternProject} from '../examples/domain-data/patterns';
import {linkedReadingHtml} from '../src/export/linkedReadingHtml';
export async function prepareDomainExamples(output:string,now?:Date){
 if(!output.trim())throw new Error('A new output directory is required.');
 const out=path.resolve(output),parent=path.dirname(out);let current=path.parse(parent).root;
 for(const part of parent.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);if((await fs.lstat(current)).isSymbolicLink())throw new Error('Symlink output paths are not accepted.');}
 // Validate and render every input before making an output directory.
 const files:Record<string,string>={};const json=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
 for(const [prefix,pair]of [['domain-data',buildDomainDataReference()],['patterns',buildPracticalPatternProject()]] as const){files[prefix+'.project.json']=json(pair.project);files[prefix+'.reading.json']=json(pair.reading);files[prefix+'.html']=linkedReadingHtml(pair.project,pair.reading,{now});}
 const candidates=buildPracticalPatternCandidates();files['patterns.learning.json']=json(candidates.entries);files['patterns.sources.json']=json(candidates.sources);
 await fs.mkdir(out); // EEXIST is intentional; never replace an owner's prior content.
 for(const [name,text]of Object.entries(files))await fs.writeFile(path.join(out,name),text,{flag:'wx'});
 return Object.keys(files).map(name=>path.join(out,name));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.length!==1){console.error('Usage: tsx scripts/prepare-domain-examples.ts NEW_DIRECTORY');process.exitCode=2;}
 else prepareDomainExamples(args[0]).then(files=>console.log(files.join('\n'))).catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
}
