/** Explicit selected-file producer. No viewer is launched and no data is published or uploaded. */
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync,fstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseDocument,MAX_DOCUMENT_BYTES} from '../src/core/model';
import {prepareConceptPreview} from '../src/interop/conceptPreview';

const usage='Usage: npm run concept:preview -- <document.json> --view <id> --audience <public|author> --out <NEW-directory> [--now <ISO-time>]';
/** Callable for IO tests; the ordinary CLI uses exactly this function. Existing output is never overwritten. */
export async function runConceptPreview(args:string[]):Promise<{files:number;audience:'public'|'author';projectionSha256:string}>{
 const [input,...rest]=args;
 if(!input||input.startsWith('--')||rest.length%2)throw new Error(usage);
 const values=new Map<string,string>();
 for(let i=0;i<rest.length;i+=2){const key=rest[i],value=rest[i+1];
  if(!['--view','--audience','--out','--now'].includes(key)||values.has(key)||!value||value.startsWith('--'))throw new Error(usage);
  values.set(key,value);
 }
 const viewId=values.get('--view'),audience=values.get('--audience'),out=values.get('--out');
 if(!viewId||!out||(audience!=='public'&&audience!=='author'))throw new Error(usage);
 const now=values.has('--now')?new Date(values.get('--now')!):undefined;
 if(now&&!Number.isFinite(now.getTime()))throw new Error('Invalid --now timestamp.');
 let document:ReturnType<typeof parseDocument>,inputSha256:string;
 // Check and read the same descriptor; paths in document content are never followed.
 const fd=openSync(resolve(input),'r');
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size>MAX_DOCUMENT_BYTES)throw new Error('Selected document is not a supported bounded file.');const bytes=readFileSync(fd);inputSha256=createHash('sha256').update(bytes).digest('hex');document=parseDocument(bytes.toString('utf8'));}finally{closeSync(fd);}
 const packet=await prepareConceptPreview(document,{projectId:document.id,baseRevision:document.revision,viewId},{audience,now});
 const files:{name:string;data:string}[]=[
  {name:'preview.concept.json',data:JSON.stringify(packet.projection.spec,null,2)+'\n'},
  {name:'preview.packet.json',data:JSON.stringify(packet,null,2)+'\n'},
  {name:'mapping-report.json',data:JSON.stringify(packet.projection.report,null,2)+'\n'},
 ];
 const root=resolve(out);
 // No recursive creation: callers select an existing parent and a new leaf. Never touch existing output.
 mkdirSync(root);
 const write=(name:string,value:unknown)=>writeFileSync(join(root,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 write('PREPARING.json',{format:'diagramcloud.preview-preparation',version:1,state:'PREPARING',audience});
 for(const file of files)writeFileSync(join(root,file.name),file.data,{flag:'wx'});
 write('READY.json',{format:'diagramcloud.preview-receipt',version:1,state:'LOCAL_CANDIDATE',audience,
  projectId:packet.projectId,viewId:packet.viewId,baseRevision:packet.baseRevision,inputSha256,projectionSha256:packet.projectionSha256,
  files:files.map(f=>({path:f.name,bytes:Buffer.byteLength(f.data),sha256:createHash('sha256').update(f.data).digest('hex')})),
  limitations:['READY is written last; PREPARING without READY is incomplete.','No native viewer, T3, publication or runtime behavior was qualified by this command.','Author output is private; public output still requires the author publication review.']});
 return {files:files.length,audience,projectionSha256:packet.projectionSha256};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runConceptPreview(process.argv.slice(2)).then(r=>process.stdout.write(`Prepared ${r.files} ${r.audience} projection files; no publication performed.\n`)).catch(()=>{
  // Do not echo untrusted document text, full paths or JSON into an agent log.
  process.stderr.write('Concept preview failed. Check arguments, selected document, view, and a new output directory; existing files were not replaced.\n');process.exitCode=1;
 });
}
