import test from 'node:test';
import assert from 'node:assert/strict';
import {readSelectedText} from '../src/intelligence/selectedFileRead';
test('selected read failures retain only a preflight-safe path and fixed error, never underlying permission/credential text',async()=>{
 const failure={size:10,arrayBuffer:async()=>{throw new Error('PRIVATE_PERMISSION_TOKEN_SENTINEL');}};await assert.rejects(()=>readSelectedText(failure,'src/denied.ts'),{message:'Selected file read failed: src/denied.ts'});let read=false;await assert.rejects(()=>readSelectedText({size:1,arrayBuffer:async()=>{read=true;return new ArrayBuffer(1);}},'.env'),/path refused before reading/);assert.equal(read,false);await assert.rejects(()=>readSelectedText(failure,'C:/private.ts'),/path refused/);
});
test('selected text reads preserve cancellation, reject byte drift and invalid UTF-8 instead of inventing a source identity',async()=>{
 const bytes=new TextEncoder().encode('Synthetic text'),file={size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer};assert.equal(await readSelectedText(file,'README.md'),'Synthetic text');await assert.rejects(()=>readSelectedText({...file,size:1},'README.md'),{message:'Selected file changed while reading: README.md'});await assert.rejects(()=>readSelectedText({size:1,arrayBuffer:async()=>new Uint8Array([255]).buffer},'binary.ts'),/not valid UTF-8 text/);const controller=new AbortController();controller.abort();await assert.rejects(()=>readSelectedText(file,'README.md',controller.signal),{name:'AbortError'});await assert.rejects(()=>readSelectedText({size:1,arrayBuffer:async()=>{throw new DOMException('PRIVATE_ABORT_DETAIL','AbortError');}},'cancel.ts'),{name:'AbortError',message:'Selected file read cancelled'});
});
