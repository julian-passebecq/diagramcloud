import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
import {readAcquisitionAnalysis} from '../src/intelligence/materialize';
import {publicDocument} from '../src/core/operations';
test('permission/read failures retain exact private failed paths, partial scope and safe remaining sources',async()=>{
 const failed={name:'unreadable.py',webkitRelativePath:'synthetic/unreadable.py',size:15,arrayBuffer:async()=>{throw Error('PRIVATE_READ_ERROR_MUST_NOT_COPY');}} as unknown as File;
 const good=Object.assign(new File(['{"name":"synthetic-readable","private":true}'],'package.json'),{webkitRelativePath:'synthetic/package.json'}),result=await analyzePickedFolder([failed,good],{depth:'quick'});
 assert.equal(result.read,1);assert.equal(result.analysis.sourceIdentity.scopeComplete,false);assert.deepEqual(result.analysis.inventory.entries.find(e=>e.path==='unreadable.py'),{path:'unreadable.py',bytes:15,state:'failed'});assert(result.analysis.documentMap.diagnostics.some(d=>d.path==='unreadable.py'&&d.message.includes('absence does not establish removal')));assert(result.domain.facts.some(f=>f.path==='package.json'));assert(readAcquisitionAnalysis(result.document)?.inventory.entries.some(e=>e.state==='failed'));assert(!JSON.stringify(result).includes('PRIVATE_READ_ERROR_MUST_NOT_COPY'));assert(!JSON.stringify(publicDocument(result.document)).includes('unreadable.py'));assert.equal(result.document.observations.length,0);
});
test('read rejection during cancellation still rejects the whole request without a partial candidate',async()=>{
 const controller=new AbortController(),failed={name:'a.py',webkitRelativePath:'synthetic/a.py',size:1,arrayBuffer:async()=>{controller.abort();throw Error('Ignored read error');}} as unknown as File;
 await assert.rejects(()=>analyzePickedFolder([failed],{depth:'quick'},controller.signal),{name:'AbortError'});
 const browserAbort={...failed,arrayBuffer:async()=>{throw new DOMException('Read aborted','AbortError');}} as unknown as File;
 await assert.rejects(()=>analyzePickedFolder([browserAbort],{depth:'quick'}),{name:'AbortError'});
});
