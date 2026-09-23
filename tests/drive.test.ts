import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assetSchema,blockSchema,clone} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {createDriveAssetFolder,dataUrlToBlob,driveRemote,uploadDriveFile,uploadDriveImage} from '../src/connectors/googleDrive';

test('Drive provenance accepts supported images and rejects other file types',()=>{
 const remote=driveRemote({id:'abc_DEF-123',name:'architecture.png',mimeType:'image/png',webViewLink:'https://drive.google.com/file/d/abc/view',modifiedTime:'2026-09-21T12:00:00.000Z',size:'1200'});
 assert.equal(remote.provider,'google-drive');
 assert.equal(remote.fileId,'abc_DEF-123');
 assert.throws(()=>driveRemote({id:'pdf1',name:'notes.pdf',mimeType:'application/pdf'}),/supported image/);
});

test('public documents remove Google Drive file identifiers while retaining cached image evidence',()=>{
 const d=clone(samples[0]);
 const asset=assetSchema.parse({
  id:'drive-image',name:'ai-architecture.png',data:'data:image/png;base64,AAAA',rights:'synthetic',
  remote:{provider:'google-drive',fileId:'secretDriveId_123',fileName:'ai-architecture.png',mimeType:'image/png',webViewLink:'https://drive.google.com/file/d/secretDriveId_123/view',savedAt:'2026-09-21T12:00:00.000Z'}
 });
 const block=blockSchema.parse({id:'drive-block',title:'AI architecture visual',type:'image',assetId:asset.id,caption:'Synthetic visual',provenance:'synthetic'});
 d.assets.push(asset);d.blocks.push(block);d.nodes[0].blockIds.push(block.id);
 const out=publicDocument(d),json=JSON.stringify(out);
 assert.ok(out.assets.some(a=>a.id===asset.id));
 assert.equal(out.assets.find(a=>a.id===asset.id)?.remote,undefined);
 assert.ok(!json.includes('secretDriveId_123'));
 assert.ok(json.includes('data:image/png;base64,AAAA'));
});

test('embedded asset data converts back to the original image blob',async()=>{
 const blob=dataUrlToBlob('data:image/png;base64,AAEC');
 assert.equal(blob.type,'image/png');
 assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[0,1,2]);
 assert.throws(()=>dataUrlToBlob('data:text/plain;base64,QQ=='),/not an embedded/);
});

test('Drive image upload uses bearer auth, multipart metadata and optional parent folder',async t=>{
 const original=globalThis.fetch;let captured:{url:string;init?:RequestInit}|undefined;
 t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async(input,init)=>{captured={url:String(input),init};return new Response(JSON.stringify({id:'file123',name:'visual.png',mimeType:'image/png',webViewLink:'https://drive.google.com/file/d/file123/view'}),{status:200,headers:{'Content-Type':'application/json'}});};
 const result=await uploadDriveImage(new Blob([new Uint8Array([1,2,3])],{type:'image/png'}),'visual.png','token123','folder456');
 assert.equal(result.id,'file123');
 assert.match(captured!.url,/uploadType=multipart/);
 const headers=new Headers(captured!.init?.headers);
 assert.equal(headers.get('Authorization'),'Bearer token123');
 assert.match(headers.get('Content-Type')??'',/^multipart\/related; boundary=diagramcloud_/);
 const body=await (captured!.init?.body as Blob).text();
 assert.match(body,/"name":"visual.png"/);
 assert.match(body,/"parents":\["folder456"\]/);
 assert.match(body,/Content-Type: image\/png/);
});

test('Drive asset folder creation is app-scoped metadata, not broad listing',async t=>{
 const original=globalThis.fetch;let body='';
 t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async(_input,init)=>{body=String(init?.body??'');return new Response(JSON.stringify({id:'folder123',name:'DiagramCloud Assets',mimeType:'application/vnd.google-apps.folder'}),{status:200,headers:{'Content-Type':'application/json'}});};
 const folder=await createDriveAssetFolder('token123');
 assert.equal(folder.id,'folder123');
 assert.match(body,/"mimeType":"application\/vnd.google-apps.folder"/);
 assert.match(body,/"diagramcloud":"assets-v1"/);
});


test('Drive project archive accepts PDF and PPTX without treating them as image evidence',async t=>{
 const original=globalThis.fetch;const seen:string[]=[];
 t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async(_input,init)=>{
  const body=init?.body as Blob;seen.push(body.type);
  return new Response(JSON.stringify({id:'archive1',name:'architecture.pdf',mimeType:'application/pdf',webViewLink:'https://drive.google.com/file/d/archive1/view'}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 await uploadDriveFile(new Blob(['pdf'],{type:'application/pdf'}),'architecture.pdf','token123','folder456');
 await uploadDriveFile(new Blob(['pptx'],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),'architecture.pptx','token123','folder456');
 assert.equal(seen.length,2);
 assert.throws(()=>uploadDriveFile(new Blob(['x'],{type:'text/plain'}),'notes.txt','token123'));
});
