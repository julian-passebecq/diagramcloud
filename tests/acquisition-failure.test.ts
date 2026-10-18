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

test('explicit folder permission denial retains actionable private advice through save/reopen; generic failures stay unclassified',async()=>{
 const bad=(name:string,error:Error)=>({name,webkitRelativePath:'synthetic/'+name,size:1,arrayBuffer:async()=>{throw error;}} as unknown as File);
 const denied=bad('denied.py',new DOMException('PRIVATE_DENIAL_DETAIL','NotAllowedError'));
 const missing=bad('missing.py',new DOMException('PRIVATE_MISSING_DETAIL','NotFoundError'));
 const generic=bad('generic.py',new Error('PRIVATE_GENERIC_DETAIL'));
 const result=await analyzePickedFolder([denied,missing,generic],{depth:'quick'});
 const diagnostics=result.analysis.documentMap.diagnostics;
 const advice=diagnostics.find(d=>d.path==='denied.py');assert.equal(advice?.cause,'access-denied');assert.equal(advice?.action?.kind,'request-access');
 for(const path of ['missing.py','generic.py'])assert.equal(diagnostics.find(d=>d.path===path)?.cause,undefined);
 const reopened=readAcquisitionAnalysis(JSON.parse(JSON.stringify(result.document)));
 assert.equal(reopened?.documentMap.diagnostics.find(d=>d.path==='denied.py')?.cause,'access-denied');
 const publicText=JSON.stringify(publicDocument(result.document));for(const text of ['denied.py','missing.py','generic.py','PRIVATE_DENIAL_DETAIL','PRIVATE_MISSING_DETAIL','PRIVATE_GENERIC_DETAIL'])assert(!publicText.includes(text));
 assert(!JSON.stringify(result).includes('PRIVATE_DENIAL_DETAIL'));assert(!JSON.stringify(result).includes('PRIVATE_MISSING_DETAIL'));assert(!JSON.stringify(result).includes('PRIVATE_GENERIC_DETAIL'));assert.equal(result.document.observations.length,0);
});
