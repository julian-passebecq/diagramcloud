/**
 * Repository scanner CLI: the same deterministic scanner as the browser, for agents and CI.
 *   npm run scan -- <repository folder> [--out diagramcloud.json] [--name "Display name"]
 * Writes a validated DiagramCloud document (import it with JSON / AI) and prints the report. Read-only: it walks the
 * folder, skips ignored and secret files, never runs git or any code, and uses no network.
 */
import {readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {basename,join,relative,resolve} from 'node:path';
import {IGNORED_DIR,MAX_FILE_BYTES,MAX_FILES,wantedFile} from '../src/core/scan/scanner';
import {scanToDocument} from '../src/core/scan';

const args=process.argv.slice(2),flag=(n:string)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:undefined;};
const out=flag('--out'),name=flag('--name'),root=resolve(args[0]??'.');
const files:{path:string;text:string}[]=[];
function walk(dir:string){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const full=join(dir,entry.name),rel=relative(root,full).replace(/\\/g,'/');
  if(entry.isDirectory()){if(rel==='.git'){for(const f of ['HEAD','packed-refs'])try{files.push({path:`.git/${f}`,text:readFileSync(join(full,f),'utf8')});}catch{/* absent */}walkRefs(join(full,'refs','heads'),'.git/refs/heads');continue;}
   if(!IGNORED_DIR.test(`${rel}/`))walk(full);continue;}
  if(files.length>=MAX_FILES)return;
  if(entry.isFile()&&wantedFile(rel)&&statSync(full).size<=MAX_FILE_BYTES)files.push({path:rel,text:readFileSync(full,'utf8')});
 }
}
function walkRefs(dir:string,prefix:string){try{for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isDirectory())walkRefs(join(dir,e.name),`${prefix}/${e.name}`);else files.push({path:`${prefix}/${e.name}`,text:readFileSync(join(dir,e.name),'utf8')});}}catch{/* no refs */}}
walk(root);
const {document,report}=scanToDocument(files,{name,fileName:basename(root)});
const json=JSON.stringify(document,null,2);
if(out)writeFileSync(out,json+'\n');else process.stdout.write(json+'\n');
process.stderr.write([`Scanned ${files.length} files in ${basename(root)}: ${report.nodes} components, ${report.edges} connections, ${report.pages} views.`,...report.kept.map(k=>`  kept: ${k}`),...report.lost.map(l=>`  not detected: ${l}`)].join('\n')+'\n');
