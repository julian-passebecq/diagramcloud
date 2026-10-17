import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clone,parseDocument,validateDocument,type Asset,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {SIDECAR_PATH,SidecarConflictError,SidecarUncertainWriteError,contentHash,readSidecar,serializeSidecar,sidecarReceipt,writeSidecar,type SidecarFile,type SidecarFolder,type SidecarLink} from '../src/bridge/sidecar';
import {KNOWN_MODULES,UnknownModulesError,inspectModules,withoutUnknownModules} from '../src/core/moduleCompat';
import {stageImportText} from '../src/app/stageImport';
import {assetDigest,digestErrors,duplicateFlags,matchAsset,withDigest} from '../src/core/assetIdentity';

const total=samples.find(d=>d.id==='total-project-controls')!;
const FILE='.datapass/diagramcloud.json';

/** In-memory folder whose writes can fail after createWritable; `landOnFailure` writes the bytes and then reports failure. */
function flakyFolder(name:string,files:Record<string,string>,mode:{fail?:'close'|'write'|'open';landOnFailure?:boolean}={}){
 let opened=0;
 const handle=(path:string):SidecarFile=>({
  getFile:async()=>({size:new TextEncoder().encode(files[path]??'').byteLength,text:async()=>files[path]??''}),
  createWritable:async()=>{opened++;if(mode.fail==='open')throw Object.assign(new Error('Permission lost'),{name:'NotAllowedError'});let buffer='';
   return{write:async(data:string)=>{if(mode.fail==='write')throw new Error('Disk full');buffer+=data;},close:async()=>{if(mode.fail==='close'){if(mode.landOnFailure)files[path]=buffer;throw new Error('The handle was closed');}files[path]=buffer;}};}
 });
 const dir=(prefix:string,dirName:string):SidecarFolder=>({name:dirName,
  getDirectoryHandle:async child=>dir(`${prefix}${child}/`,child),
  getFileHandle:async(child)=>{const path=`${prefix}${child}`;if(!(path in files))files[path]='';return handle(path);}});
 return Object.assign(dir('',name),{files,mode,opened:()=>opened});
}
async function linked(folder:SidecarFolder):Promise<SidecarLink>{const read=await readSidecar(folder);assert.equal(read.status,'found');return{folder,projectId:total.id,baseRevision:total.revision,baseHash:read.status==='found'?read.hash:null};}
const edited=(revision:number,title:string):Project=>({...clone(total),revision,title});

test('uncertain write: a failure after createWritable reports "outcome unknown, not saved" and keeps the attempt in memory',async()=>{
 const original=serializeSidecar(total),folder=flakyFolder('repo',{[FILE]:original},{fail:'close'}),link=await linked(folder);
 const local=edited(total.revision+1,'Local edit'),text=serializeSidecar(local);
 const error=await writeSidecar(link,local).then(()=>null,e=>e);
 assert.ok(error instanceof SidecarUncertainWriteError);
 assert.match(error.message,/^Outcome unknown, not saved/);
 assert.match(error.message,new RegExp(`revision ${local.revision}`));
 const receipt=sidecarReceipt(folder)!;
 assert.deepEqual({revision:receipt.revision,hash:receipt.hash,bytes:receipt.bytes,projectId:receipt.projectId},{revision:local.revision,hash:await contentHash(text),bytes:new TextEncoder().encode(text).byteLength,projectId:total.id});
 assert.equal(folder.files[FILE],original,'the in-memory folder kept the old text');
});

test('uncertain write: the next save re-reads first and treats a landed attempt as saved without writing it twice',async()=>{
 const folder=flakyFolder('repo',{[FILE]:serializeSidecar(total)},{fail:'close',landOnFailure:true}),link=await linked(folder);
 const local=edited(total.revision+1,'Local edit');
 await assert.rejects(writeSidecar(link,local),SidecarUncertainWriteError);
 folder.mode.fail=undefined;const before=folder.opened();
 const next=await writeSidecar(link,local);
 assert.equal(folder.opened(),before,'the same revision is not written again');
 assert.equal(next.landed?.revision,local.revision);assert.equal(next.baseRevision,local.revision);assert.equal(next.baseHash,await contentHash(serializeSidecar(local)));
 assert.equal(sidecarReceipt(folder),undefined);
 const later=edited(local.revision+1,'Later edit'),after=await writeSidecar(next,later);
 assert.equal(parseDocument(folder.files[FILE]).title,'Later edit');assert.equal(after.landed,undefined);
});

test('uncertain write: a file that does not hold the attempt is a conflict naming it, never a blind retry',async()=>{
 const original=serializeSidecar(total),folder=flakyFolder('repo',{[FILE]:original},{fail:'write'}),link=await linked(folder);
 const local=edited(total.revision+1,'Local edit');
 await assert.rejects(writeSidecar(link,local),SidecarUncertainWriteError);
 folder.mode.fail=undefined;const before=folder.opened();
 const error=await writeSidecar(link,local).then(()=>null,e=>e);
 assert.ok(error instanceof SidecarConflictError);
 assert.match(error.message,new RegExp(`did not confirm: revision ${local.revision} \\(sha256 [0-9a-f]{12}…, \\d+ bytes\\)`));
 assert.equal(folder.opened(),before,'nothing was opened for writing');assert.equal(folder.files[FILE],original);
 assert.ok(sidecarReceipt(folder),'the receipt stays until the author re-reads the file');
 await readSidecar(folder);assert.equal(sidecarReceipt(folder),undefined,'re-reading the file for review resolves it');
});

test('storage failure before the write starts leaves no receipt and nothing written',async()=>{
 const original=serializeSidecar(total),folder=flakyFolder('repo',{[FILE]:original},{fail:'open'}),link=await linked(folder);
 await assert.rejects(writeSidecar(link,edited(total.revision+1,'x')),/Permission lost/);
 assert.equal(sidecarReceipt(folder),undefined);assert.equal(folder.files[FILE],original);assert.equal(SIDECAR_PATH,FILE);
});

const withModules=(extra:Record<string,unknown>)=>JSON.stringify({...clone(total),...extra});
const stage=(raw:string,acceptUnknownModules?:readonly string[])=>{const project=clone(total);return stageImportText({project,library:[project],raw,importName:'',completionRequest:null,applied:[],acceptUnknownModules});};

test('unknown modules: refused until the author confirms that exact list, then imported without them',async()=>{
 const raw=withModules({brainLinks:[{id:'x'}],runs:{grant:'everything'}});
 const refused=await stage(raw).then(()=>null,e=>e);
 assert.ok(refused instanceof UnknownModulesError);assert.deepEqual(refused.modules,['brainLinks','runs']);assert.match(refused.message,/Nothing was imported/);
 await assert.rejects(stage(raw,['runs']),UnknownModulesError,'a partial confirmation is not consent');
 const out=await stage(raw,['runs','brainLinks']);
 assert.deepEqual(out.droppedModules,['brainLinks','runs']);
 assert.ok(!('runs' in out.staged)&&!('brainLinks' in out.staged),'an unknown module grants nothing and is not kept');
 assert.deepEqual(out.staged.nodes.map(n=>n.id),total.nodes.map(n=>n.id));
 assert.equal((await stage(JSON.stringify(total))).droppedModules,undefined);
});

test('unknown modules: known fields stay strict and an unknown schemaVersion is refused',async()=>{
 const doc=clone(total) as Project&{nodes:Record<string,unknown>[]};doc.nodes[0].secretPower=true;
 await assert.rejects(stage(withModules({nodes:doc.nodes,future:1}),['future']),/secretPower|Unrecognized key/);
 await assert.rejects(stage(withModules({schemaVersion:2})),/Unsupported schemaVersion 2.*Nothing was imported/);
 assert.throws(()=>inspectModules({schemaVersion:'1'}),/Unsupported schemaVersion "1"/);
 assert.ok(KNOWN_MODULES.includes('assets')&&KNOWN_MODULES.includes('nodes'));
 assert.deepEqual(withoutUnknownModules({id:'a'}),{document:{id:'a'},dropped:[]});
});

test('rejected import leaves nothing changed',async()=>{
 const project=clone(total),library=[project],snapshot=JSON.stringify(project);
 for(const [raw,accept] of [[withModules({later:1}),undefined],[withModules({schemaVersion:9}),undefined],[withModules({later:1,nodes:[{id:'BAD ID'}]}),['later']]] as const)
  await assert.rejects(stageImportText({project,library,raw,importName:'',completionRequest:null,applied:[],acceptUnknownModules:accept}));
 assert.equal(JSON.stringify(project),snapshot);assert.equal(library.length,1);
});

const PNG_A='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_B='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const asset=(id:string,name:string,data:string,extra:Partial<Asset>={}):Asset=>({id,name,data,rights:'Author-supplied',visibility:'public',...extra});
const withAssets=(assets:Asset[]):Project=>validateDocument({...clone(total),assets:[...total.assets,...assets]});

test('image digest: computed locally from the stored bytes and checked on import',async()=>{
 const a=await withDigest(asset('asset-a','chart.png',PNG_A));
 assert.match(a.digest!,/^sha256:[0-9a-f]{64}$/);assert.equal(a.digest,await assetDigest(PNG_A));assert.notEqual(a.digest,await assetDigest(PNG_B));
 const forged=await withDigest(asset('asset-a','chart.png',PNG_A));forged.digest=await assetDigest(PNG_B);
 assert.deepEqual(await digestErrors(withAssets([a])),[]);
 assert.match((await digestErrors(withAssets([forged])))[0],/does not match its image bytes.*never copied from Drive or an ETag/);
 await assert.rejects(stage(JSON.stringify(withAssets([forged]))),/does not match its image bytes/);
 assert.throws(()=>withAssets([{...a,digest:'md5:abc'}]),/sha256:/);
});

test('image duplicates: identical bytes are exact, the same name with different bytes is only a possible duplicate',async()=>{
 const doc=withAssets([asset('asset-a','chart.png',PNG_A),asset('asset-c','other.png',PNG_A),asset('asset-b','Chart.png',PNG_B)]);
 const match=await matchAsset(doc,{name:'chart.png',digest:await assetDigest(PNG_A)});
 assert.deepEqual(match.exact.map(a=>a.id),['asset-a','asset-c']);assert.deepEqual(match.sameName.map(a=>a.id),['asset-b'],'names compare without case');
 const renamed=await matchAsset(doc,{name:'chart.png',digest:await assetDigest(PNG_B)});
 assert.deepEqual(renamed.exact.map(a=>a.id),['asset-b']);assert.deepEqual(renamed.sameName.map(a=>a.id),['asset-a']);
 const flags=await duplicateFlags(doc);
 assert.deepEqual(flags.map(f=>`${f.assetId}~${f.otherId}:${f.kind}`).sort(),['asset-b~asset-a:possible','asset-c~asset-a:exact']);
 assert.equal(doc.assets.length,total.assets.length+3,'nothing is merged');
});

test('keep both survives save, reopen and a repeat import, and never reaches a public copy',async()=>{
 const kept=asset('asset-a2','chart.png',PNG_A,{keptDistinctFrom:['asset-a']}),doc=withAssets([asset('asset-a','chart.png',PNG_A),kept]);
 const reopened=parseDocument(serializeSidecar(doc));
 assert.deepEqual(reopened.assets.find(a=>a.id==='asset-a2')!.keptDistinctFrom,['asset-a']);
 for(let i=0;i<2;i++){const again=(await stage(JSON.stringify(reopened))).staged;
  assert.deepEqual(again.assets.find(a=>a.id==='asset-a2')!.keptDistinctFrom,['asset-a']);
  assert.deepEqual((await duplicateFlags(again)).map(f=>f.kind),['kept-distinct'],'a kept pair is never flagged as a duplicate again');}
 const shown=clone(doc),node=shown.nodes.find(n=>n.visibility!=='private')!;shown.blocks.push({id:'image-kept',title:'Chart',type:'image',assetId:'asset-a2',caption:'',provenance:'author',sourceIds:[],visibility:'public'} as Project['blocks'][number]);node.blockIds.push('image-kept');
 const pub=publicDocument(validateDocument(shown)).assets.find(a=>a.id==='asset-a2');
 assert.ok(pub,'the kept image itself is public');assert.equal(pub.keptDistinctFrom,undefined,'the authoring decision and the other asset ID stay out of public copies');
 assert.throws(()=>withAssets([asset('asset-x','x.png',PNG_A,{keptDistinctFrom:['asset-missing']})]),/unknown reference asset-missing/);
 assert.throws(()=>withAssets([asset('asset-x','x.png',PNG_A,{keptDistinctFrom:['asset-x']})]),/kept distinct from itself/);
});
