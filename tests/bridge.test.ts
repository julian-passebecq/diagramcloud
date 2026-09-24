import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import {clone,parseDocument,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {SIDECAR_PATH,SidecarConflictError,contentHash,contextBlock,readManifestIdentity,readSidecar,serializeSidecar,sidecarNotes,writeSidecar,type SidecarFile,type SidecarFolder,type SidecarLink} from '../src/bridge/sidecar';

const total=samples.find(d=>d.id==='total-project-controls')!;
const lock=JSON.parse(readFileSync('docs/contracts/datapass-diagramcloud-bridge.lock.json','utf8'));
const schemaText=(key:'aiContextSchema'|'aiPlanSchema')=>readFileSync(lock.vendored[key].path,'utf8').replace(/\r\n/g,'\n');
const ajv=new Ajv2020({strict:false,validateFormats:false});
const validateContext=ajv.compile(JSON.parse(schemaText('aiContextSchema')));
const validatePlan=ajv.compile(JSON.parse(schemaText('aiPlanSchema')));

/** In-memory stand-in for a FileSystemDirectoryHandle tree. */
function memoryFolder(name:string,files:Record<string,string>={}):SidecarFolder&{files:Record<string,string>}{
 const missing=()=>Object.assign(new Error('not found'),{name:'NotFoundError'});
 const fileHandle=(path:string):SidecarFile=>({
  getFile:async()=>({size:new TextEncoder().encode(files[path]??'').byteLength,text:async()=>files[path]??''}),
  createWritable:async()=>{let buffer='';return{write:async(data:string)=>{buffer+=data;},close:async()=>{files[path]=buffer;}};}
 });
 const dir=(prefix:string,dirName:string):SidecarFolder=>({
  name:dirName,
  getDirectoryHandle:async(child,options)=>{const path=`${prefix}${child}/`;if(!options?.create&&!Object.keys(files).some(f=>f.startsWith(path)))throw missing();return dir(path,child);},
  getFileHandle:async(child,options)=>{const path=`${prefix}${child}`;if(!(path in files)){if(!options?.create)throw missing();files[path]='';}return fileHandle(path);}
 });
 return Object.assign(dir('',name),{files});
}

test('vendored bridge schemas are the exact pinned DataPass contract blobs',()=>{
 assert.equal(lock.commit,'fde955ab4617ef0a9c6c82ac6727fad14cf67a81');
 for(const key of ['aiContextSchema','aiPlanSchema'] as const){
  const body=Buffer.from(schemaText(key),'utf8');
  const blob=createHash('sha1').update(`blob ${body.byteLength}\0`).update(body).digest('hex');
  assert.equal(blob,lock.vendored[key].gitBlob,`${key} was edited locally; bump the contract lock instead`);
 }
 assert.equal(lock.sidecar.path,SIDECAR_PATH);
});

test('sidecar text round-trips through validateDocument with stable IDs and experience pack',()=>{
 const text=serializeSidecar(total);
 assert.ok(text.endsWith('}\n'));
 assert.equal(serializeSidecar(parseDocument(text)),text,'serialization must be deterministic for Git diffs');
 const back=parseDocument(text);
 assert.deepEqual(back.nodes.map(n=>n.id),total.nodes.map(n=>n.id));
 assert.deepEqual(back.experience,total.experience);
});

test('missing or empty sidecar reports missing without creating files',async()=>{
 const empty=memoryFolder('repo');
 assert.deepEqual(await readSidecar(empty),{status:'missing'});
 assert.deepEqual(empty.files,{});
 const blank=memoryFolder('repo',{'.datapass/diagramcloud.json':'  \n'});
 assert.deepEqual(await readSidecar(blank),{status:'missing'});
});

test('an invalid sidecar is read as text but rejected by the document validator',async()=>{
 const doc=clone(total) as Project&{nodes:unknown[]};doc.nodes.push({id:'BAD ID',label:'x'});
 const folder=memoryFolder('repo',{'.datapass/diagramcloud.json':JSON.stringify(doc)});
 const read=await readSidecar(folder);
 assert.equal(read.status,'found');
 assert.throws(()=>parseDocument(read.status==='found'?read.text:''),/stable lowercase ID/);
});

test('write refuses when the repository file changed since it was read and leaves it untouched',async()=>{
 const original=serializeSidecar(total);
 const folder=memoryFolder('repo',{'.datapass/diagramcloud.json':original});
 const read=await readSidecar(folder);assert.equal(read.status,'found');
 const link:SidecarLink={folder,projectId:total.id,baseRevision:total.revision,baseHash:read.status==='found'?read.hash:null};
 const external={...clone(total),revision:total.revision+1,title:'Applied by DataPass plan'};
 folder.files['.datapass/diagramcloud.json']=serializeSidecar(external);
 const local={...clone(total),revision:total.revision+1,title:'Local edit'};
 await assert.rejects(writeSidecar(link,local),SidecarConflictError);
 assert.equal(parseDocument(folder.files['.datapass/diagramcloud.json']).title,'Applied by DataPass plan');
});

test('write succeeds on an unchanged file and advances the base for the next save',async()=>{
 const folder=memoryFolder('repo',{'.datapass/diagramcloud.json':serializeSidecar(total)});
 const read=await readSidecar(folder);
 let link:SidecarLink={folder,projectId:total.id,baseRevision:total.revision,baseHash:read.status==='found'?read.hash:null};
 const edited={...clone(total),revision:total.revision+1,title:'Edited in DiagramCloud'};
 link=await writeSidecar(link,edited);
 assert.equal(link.baseRevision,edited.revision);
 assert.equal(link.baseHash,await contentHash(folder.files['.datapass/diagramcloud.json']));
 assert.equal(parseDocument(folder.files['.datapass/diagramcloud.json']).title,'Edited in DiagramCloud');
 link=await writeSidecar(link,{...edited,revision:edited.revision+1});
 assert.equal(parseDocument(folder.files['.datapass/diagramcloud.json']).revision,edited.revision+1);
});

test('creating a new sidecar requires that nobody created it in the meantime, and never writes another project',async()=>{
 const folder=memoryFolder('repo');
 const link:SidecarLink={folder,projectId:total.id,baseRevision:null,baseHash:null};
 await assert.rejects(writeSidecar(link,samples[0]),/not the one linked/);
 assert.deepEqual(folder.files,{});
 const created=await writeSidecar(link,total);
 assert.equal(parseDocument(folder.files['.datapass/diagramcloud.json']).id,total.id);
 await assert.rejects(writeSidecar(link,total),SidecarConflictError,'a stale null base must not overwrite the file it just created');
 assert.equal(created.baseRevision,total.revision);
});

test('manifest identity reads only project id and title from .datapass/project.json',async()=>{
 const folder=memoryFolder('repo',{'.datapass/project.json':JSON.stringify({schemaVersion:1,project:{id:'foil',title:'Foil control'},repositories:[{path:'C:/secret/path'}],env:{TOKEN:'x'}})});
 assert.deepEqual(await readManifestIdentity(folder),{id:'foil',title:'Foil control'});
 assert.equal(await readManifestIdentity(memoryFolder('repo',{'.datapass/project.json':'{broken'})),null);
 assert.equal(await readManifestIdentity(memoryFolder('repo')),null);
});

test('review notes flag private objects stored in the repository file',()=>{
 const doc=clone(total);doc.nodes[0].visibility='private';doc.privateNotes='internal';
 assert.match(sidecarNotes(doc).join(' '),/2 private objects/);
 assert.deepEqual(sidecarNotes({...clone(total),nodes:clone(total).nodes.map(n=>({...n,visibility:'public' as const})),edges:[],views:clone(total).views.map(v=>({...v,visibility:'public' as const})),blocks:[],assets:[],sources:[],privateNotes:undefined},10),[]);
 assert.match(sidecarNotes(total,2*1024*1024).join(' '),/2\.0 MiB/);
});

test('DiagramCloud context block conforms to the pinned datapass.ai-context V1 schema',()=>{
 const context=(diagramCloud:ReturnType<typeof contextBlock>,revision:number|null)=>({
  format:'datapass.ai-context',schemaVersion:1,generatedAt:'2026-09-24T12:00:00Z',
  project:{id:'total-project-controls',title:'TotalEnergies project controls',kind:'portfolio-reconstruction'},
  scope:{id:'total-project-controls',type:'project'},
  base:{projectManifestRevision:'git:0000000',diagramCloudRevision:revision},
  diagramCloud,repositories:[{id:'diagramcloud',label:'DiagramCloud'}],
  platforms:[{id:'oracle',label:'Oracle',status:'unknown',evidence:'declared'}],
  tasks:[{id:'validate-schedule-rows',title:'Validate schedule rows',status:'done'}],redactions:[]
 });
 assert.ok(validateContext(context(contextBlock(total),total.revision)),JSON.stringify(validateContext.errors));
 assert.ok(validateContext(context(contextBlock(null),null)),JSON.stringify(validateContext.errors));
 assert.equal(validateContext({...context(contextBlock(total),total.revision),diagramCloud:{...contextBlock(total),unexpected:true}}),false);
});

test('pinned datapass.ai-plan V1 schema accepts DiagramCloud operations and rejects secret-shaped payload keys',()=>{
 const plan={format:'datapass.ai-plan',schemaVersion:1,base:{projectManifestRevision:'git:0000000',diagramCloudRevision:total.revision},scope:{id:'validate-schedule-rows',type:'task'},summary:'Link the SQL task workspace.',
  operations:[{id:'op-1',target:'diagramcloud-document',action:'link-node-workspace',reviewLabel:'Open quality-screen from SQL quality checks',entityId:'sql-checks',payload:{workspaceId:'quality-screen'}}]};
 assert.ok(validatePlan(plan),JSON.stringify(validatePlan.errors));
 assert.equal(validatePlan({...plan,operations:[{...plan.operations[0],payload:{clientSecret:'x'}}]}),false);
 assert.equal(validatePlan({...plan,operations:[{...plan.operations[0],target:'cloud'}]}),false);
});
