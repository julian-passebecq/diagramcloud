import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
import {attachAcquisitionContext,inspectAcquisitionAnalysis,readAcquisitionAnalysis} from '../src/intelligence/materialize';
import {analysisProfile,validateAnalysisBundle,type AnalysisBundle} from '../src/intelligence/profile';
import {buildDocumentAnalysisBundle} from '../src/intelligence/documentBundle';
import {sourceBridgeStatus,SOURCE_BRIDGE_LIMITS} from '../src/intelligence/sourceBridgeStatus';

const seed=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-source-bridge',title:'Synthetic source bridge QA',rootViewId:'root',
 sources:[{id:'public-citation',title:'Public authored citation',url:'https://example.invalid/synthetic',visibility:'public'}],
 nodes:[{id:'app',label:'Synthetic application',sourceIds:['public-citation']},{id:'repo-a',label:'Repository A'},{id:'repo-b',label:'Repository B'}],edges:[],views:[{id:'root',title:'Synthetic scope',nodeIds:['app','repo-a','repo-b']}]}));
function picked(path:string,text:string,fail?:Error):File{
 const bytes=new TextEncoder().encode(text);
 return {name:path.split('/').at(-1)!,webkitRelativePath:'synthetic-private-root/'+path,size:bytes.length,arrayBuffer:async()=>{if(fail)throw fail;return bytes.buffer;}} as File;
}
async function acquired(text='# Synthetic private source\n[Unknown](not-selected.md)\n'){
 return analyzePickedFolder([picked('README.md',text),picked('package.json','{}')],{depth:'quick'});
}
function author(project:Project,options:{repositoryId?:string;bundle?:unknown}={}){
 const result=sourceBridgeStatus(project,{publicMode:false,...options});assert.equal(result.visibility,'author');
 if(result.visibility!=='author')throw new Error('Expected author projection');return result;
}

test('actual acquisition keeps admission, aggregate digest and HEAD hint separate from per-file identity or runtime',async()=>{
 const result=await acquired(),doc=validateDocument(JSON.parse(JSON.stringify(result.document))),before=JSON.stringify(doc),status=author(doc);
 assert.equal(status.origin,'acquisition-receipt');assert.equal(status.consumerVersion,'diagramcloud-acquisition/1');
 assert.equal(status.producerVersion,null);assert.equal(status.sourceContract,null);assert.equal(status.outputContract,'diagramcloud.document-map/1');
 assert.deepEqual(status.admission,{selectedEntries:result.analysis.inventory.selectedFiles,readFiles:result.analysis.inventory.readFiles,readBytes:result.analysis.inventory.readBytes,unsupported:result.analysis.inventory.unsupported,ignored:result.analysis.inventory.ignored,limited:result.analysis.inventory.limited});
 assert.equal(status.requested?.depth,'quick');assert.equal(status.requested?.analyzers,null);
 assert.equal(status.revisions[0].aggregateDigest,result.analysis.sourceIdentity.contentDigest);
 assert.equal(status.revisions[0].revision,result.analysis.sourceIdentity.sourceRevision);
 assert.ok(status.entries.length>0&&status.entries.every(row=>row.fileDigest===null&&row.line===null&&row.revision===null));
 assert.equal(status.outputs?.items,null);assert.equal(status.outputs?.relations,0);assert.match(status.revisionMeaning,/HEAD hint/);
 status.entries[0].path='Caller changes display';status.omitted.producer.documents=999;
 assert.equal(JSON.stringify(doc),before);assert.deepEqual(author(doc).entries.map(row=>row.path),result.analysis.inventory.entries.map(row=>row.path));assert.deepEqual(doc.observations,[]);
});

test('actual configured document output retains file hashes and supplied revision, without relabelling requested analyzers as execution',async()=>{
 const profile=analysisProfile('quick',{analyzers:['documents','dbt']}),bundle=await buildDocumentAnalysisBundle([{path:'README.md',text:'# Synthetic section\n'}],{repositoryId:'selected',revision:'unknown'},profile),doc=seed(),before=JSON.stringify({doc,bundle}),status=author(doc,{bundle});
 assert.equal(status.origin,'configured-bundle');assert.equal(status.consumerVersion,bundle.parserVersion);assert.equal(status.producerVersion,null);assert.equal(status.captureTime,null);assert.equal(status.admission,null);
 assert.deepEqual(status.requested?.analyzers,bundle.profile.analyzers);assert.equal(status.outputs?.items,bundle.items.length);assert.equal(status.outputs?.sourceRanges,bundle.sources.length);
 assert.equal(status.revisions[0].aggregateDigest,bundle.revisions[0].contentDigest);assert.equal(status.entries[0].fileDigest,bundle.sources[0].contentDigest);assert.equal(status.entries[0].revision,'unknown');
 assert.notEqual(status.entries[0].fileDigest,status.revisions[0].aggregateDigest);assert.match(status.entries[0].admission,/not supplied/);
 status.requested!.analyzers!.push('azure');status.revisions[0].revision='Caller edit';status.entries[0].fileDigest='Caller edit';
 assert.equal(JSON.stringify({doc,bundle}),before);assert.deepEqual(doc.observations,[]);
 for(const repositoryId of ['selected','other','../invalid','']){
  const contradictory=author(doc,{repositoryId,bundle});assert.equal(contradictory.origin,'unavailable');assert.deepEqual(contradictory.entries,[]);assert.deepEqual(contradictory.revisions,[]);assert.equal(contradictory.consumerVersion,null);
 }
});

test('public branch is constant before any Project, repository or transient-bundle getter, including corrupt receipt presence',async()=>{
 const poisonProject=new Proxy({} as Project,{get(){throw new Error('PRIVATE_PROJECT_GETTER');}}),options={publicMode:true,get repositoryId():string{throw new Error('PRIVATE_REPOSITORY_GETTER');},get bundle():unknown{throw new Error('PRIVATE_BUNDLE_GETTER');}};
 const constant=sourceBridgeStatus(poisonProject,options),base=seed(),result=await acquired(),valid=attachAcquisitionContext(base,result.analysis),corrupt=structuredClone(valid);
 const receipt=corrupt.blocks.find(block=>block.id.startsWith('analysis-context-'))!;if(receipt.type!=='code')throw new Error('Expected actual private receipt');receipt.code='PRIVATE_MALFORMED_CONTEXT';
 assert.equal(author(corrupt).origin,'unavailable');assert.equal(author(corrupt).admission,null);assert.equal(author(base).origin,'unavailable');
 for(const doc of [base,valid,corrupt]){
  assert.deepEqual(sourceBridgeStatus(doc,{publicMode:true,bundle:{private:'MALFORMED_BUNDLE'},repositoryId:'PRIVATE_SCOPE'}),constant);
  const projected=publicDocument(doc);assert.ok(projected.sources.some(source=>source.id==='public-citation'));
  assert.ok(!JSON.stringify(projected).includes('PRIVATE_MALFORMED_CONTEXT'));
 }
 assert.equal(constant.visibility,'private-metadata-unavailable');assert.ok(!JSON.stringify(constant).includes(result.analysis.sourceIdentity.contentDigest));
});

test('explicit repository receipts never fall back to another repository or global acquisition',async()=>{
 const [a,b,g]=await Promise.all([acquired('# Synthetic source A'),acquired('# Synthetic source B'),acquired('# Synthetic global source')]);
 const global=attachAcquisitionContext(seed(),g.analysis),doc=attachAcquisitionContext(attachAcquisitionContext(global,a.analysis,'a'),b.analysis,'b'),before=JSON.stringify(doc);
 assert.equal(author(doc,{repositoryId:'a'}).revisions[0].aggregateDigest,a.analysis.sourceIdentity.contentDigest);
 assert.equal(author(doc,{repositoryId:'b'}).revisions[0].aggregateDigest,b.analysis.sourceIdentity.contentDigest);
 assert.ok(author(doc,{repositoryId:'a'}).entries.every(row=>row.repositoryId==='a'&&row.sourceId===null));assert.ok(author(doc).entries.every(row=>row.repositoryId===null));
 assert.equal(author(doc).revisions[0].aggregateDigest,g.analysis.sourceIdentity.contentDigest);
 for(const repositoryId of ['missing','../a',''])assert.equal(author(doc,{repositoryId}).origin,'unavailable');
 assert.match(author(doc,{repositoryId:'a'}).scopeNote,/explicitly supplied repository only/);assert.match(author(doc).scopeNote,/not attributed.*pinned selection.*canonical Edit/);
 assert.equal(JSON.stringify(doc),before);
});

test('configured ranges retain repository and source identity even with identical path, revision and bytes in two repositories',async()=>{
 const profile=analysisProfile('quick',{analyzers:['documents']}),parts=await Promise.all(['repository-a','repository-b'].map(repositoryId=>buildDocumentAnalysisBundle([{path:'README.md',text:'# Identical synthetic bytes'}],{repositoryId,revision:'unknown'},profile)));
 const bundle=validateAnalysisBundle({...parts[0],revisions:parts.flatMap(part=>part.revisions),sources:parts.flatMap(part=>part.sources),items:parts.flatMap(part=>part.items),links:parts.flatMap(part=>part.links)}),before=JSON.stringify(bundle),status=author(seed(),{bundle});
 const rows=status.entries.filter(row=>row.path==='README.md'&&row.line===1);
 assert.deepEqual(new Set(rows.map(row=>row.repositoryId)),new Set(['repository-a','repository-b']));assert.equal(new Set(rows.map(row=>row.fileDigest)).size,1);assert.equal(new Set(rows.map(row=>row.revision)).size,1);
 assert.equal(new Set(rows.map(row=>row.sourceId)).size,2);for(const row of rows){const source=bundle.sources.find(source=>source.id===row.sourceId)!;assert.equal(row.repositoryId,source.repositoryId);assert.equal(row.fileDigest,source.contentDigest);}
 assert.equal(JSON.stringify(bundle),before);
});

test('only a native typed read refusal acquires a cause; permission-like generic text does not classify itself',async()=>{
 for(const denied of [true,false]){
  const error=denied?new DOMException('PRIVATE_DENIAL_DETAILS','NotAllowedError'):new Error('access-denied Permission denied PRIVATE_GENERIC_DETAILS');
  const result=await analyzePickedFolder([picked('README.md','# Synthetic'),picked('failed.ts','export const synthetic=1;',error)],{depth:'quick'}),status=author(result.document),row=status.diagnostics.find(d=>d.path==='failed.ts');
  assert.ok(row);assert.equal(row.cause,denied?'access-denied':null);assert.equal(row.advice!==null,denied);
  assert.ok(!JSON.stringify(status).includes('PRIVATE_DENIAL_DETAILS')&&!JSON.stringify(status).includes('PRIVATE_GENERIC_DETAILS'));
 }
 const result=await acquired(),legacy=structuredClone(result.analysis);
 for(const row of legacy.documentMap.diagnostics){delete row.cause;delete row.action;row.message='access-denied consumer-error stale-revision are only words here';}
 const status=author(attachAcquisitionContext(seed(),legacy));assert.ok(status.diagnostics.length>0);assert.ok(status.diagnostics.every(row=>row.cause===null&&row.advice===null));
});

test('summary bounds are exact and independent of producer omissions over real joined document bundles',async()=>{
 const profile=analysisProfile('standard',{analyzers:['documents']}),parts:AnalysisBundle[]=[];
 for(let i=0;i<14;i++)parts.push(await buildDocumentAnalysisBundle(Array.from({length:3},(_,j)=>({path:`docs/source-${j}.md`,text:`# Synthetic ${i}/${j}\n[Missing](missing-${j}.md)`})),{repositoryId:'repo-'+i,revision:'unknown'},profile));
 const joined=validateAnalysisBundle({format:'diagramcloud.analysis-bundle',version:1,parserVersion:parts[0].parserVersion,profile,revisions:parts.flatMap(p=>p.revisions),items:parts.flatMap(p=>p.items),links:parts.flatMap(p=>p.links),sources:parts.flatMap(p=>p.sources),diagnostics:parts.flatMap(p=>p.diagnostics),diagnosticDetails:parts.flatMap(p=>p.diagnosticDetails??[]),omitted:{items:2,links:3,sources:4}}),before=JSON.stringify(joined),status=author(seed(),{bundle:joined});
 assert.equal(status.entries.length,SOURCE_BRIDGE_LIMITS.entries);assert.equal(status.revisions.length,SOURCE_BRIDGE_LIMITS.revisions);assert.equal(status.diagnostics.length,SOURCE_BRIDGE_LIMITS.diagnostics);
 assert.deepEqual(status.omitted,{entries:joined.sources.length-24,revisions:2,diagnostics:joined.diagnosticDetails!.length-8,producer:{items:2,relations:3,sources:4}});
 assert.ok(JSON.stringify(status).length<65536);assert.equal(JSON.stringify(joined),before);
});

test('unavailable historical or invalid transient metadata stays UNKNOWN without altering the document',()=>{
 const doc=seed(),before=JSON.stringify(doc),missing=author(doc),invalid=author(doc,{bundle:{format:'unknown',PRIVATE_SECRET:'SECRET'}});
 assert.equal(missing.origin,'unavailable');assert.equal(missing.admission,null);assert.equal(missing.outputs,null);assert.equal(missing.consumerVersion,null);
 assert.equal(invalid.origin,'unavailable');assert.ok(!JSON.stringify(invalid).includes('SECRET'));assert.equal(JSON.stringify(doc),before);
});


// The outcome is local reader metadata, never an upstream failure cause or repair operation.
test('actual acquired context survives save serialization and keeps the legacy private-reader contract',async()=>{
 const result=await acquired(),doc=validateDocument(JSON.parse(JSON.stringify(attachAcquisitionContext(seed(),result.analysis)))),before=JSON.stringify(doc),inspection=inspectAcquisitionAnalysis(doc);
 assert.equal(inspection.state,'available');if(inspection.state!=='available')throw new Error('Expected actual retained context');assert.deepEqual(inspection.analysis,readAcquisitionAnalysis(doc));assert.deepEqual(inspection.analysis,result.analysis);assert.equal(author(doc).retainedContext,undefined);
 inspection.analysis.sourceIdentity.selectedRoot='Caller edits only a read result';assert.deepEqual(readAcquisitionAnalysis(doc),result.analysis);assert.equal(JSON.stringify(doc),before);assert.deepEqual(doc.observations,[]);
 const empty=seed();assert.deepEqual(inspectAcquisitionAnalysis(empty),{state:'absent'});assert.equal(readAcquisitionAnalysis(empty),undefined);assert.equal(author(empty).retainedContext,'absent');assert.equal(author(empty).admission,null);
});

test('unreadable retained bytes and existing reader budgets yield a fixed outcome without repair or cause inference',async()=>{
 const result=await acquired(),valid=attachAcquisitionContext(seed(),result.analysis),sentinel='PRIVATE_INVALID_SOURCE_PAYLOAD access-denied stale-revision consumer-error',cases:Project[]=[];
 for(const code of [sentinel,JSON.stringify({...result.analysis,sourceIdentity:{...result.analysis.sourceIdentity,analyzerVersion:'PRIVATE_UNKNOWN_READER_VERSION'}})]){const doc=structuredClone(valid),block=doc.blocks.find(block=>block.id==='analysis-context-0')!;if(block.type!=='code')throw new Error('Expected actual receipt');block.code=code;validateDocument(doc);cases.push(doc);}
 for(const [count,length] of [[43,2],[42,48000]]){const doc=seed();doc.blocks=Array.from({length:count},(_,index)=>({id:'analysis-context-'+index,title:'Synthetic unavailable receipt',type:'code' as const,language:'json',code:'x'.repeat(length),sourceIds:[],visibility:'private' as const,provenance:'synthetic' as const}));validateDocument(doc);cases.push(doc);}
 for(const doc of cases){const before=JSON.stringify(doc),inspection=inspectAcquisitionAnalysis(doc),status=author(doc);assert.deepEqual(inspection,{state:'unreadable'});assert.equal(readAcquisitionAnalysis(doc),undefined);assert.equal(status.retainedContext,'unreadable');assert.equal(status.origin,'unavailable');assert.equal(status.admission,null);assert.equal(status.outputs,null);assert.equal(status.consumerVersion,null);assert.deepEqual(status.entries,[]);assert.deepEqual(status.revisions,[]);assert.deepEqual(status.diagnostics,[]);assert.ok(!JSON.stringify(status).includes('PRIVATE_'));assert.equal(JSON.stringify(doc),before);assert.deepEqual(doc.observations,[]);}
});

test('diagnostic scope never falls back to global or a different repository and does not join transient context',async()=>{
 const [a,b,g]=await Promise.all([acquired('# Synthetic A'),acquired('# Synthetic B'),acquired('# Synthetic global')]),valid=attachAcquisitionContext(attachAcquisitionContext(attachAcquisitionContext(seed(),g.analysis),a.analysis,'a'),b.analysis,'b'),doc=structuredClone(valid),block=doc.blocks.find(block=>block.id==='analysis-repo-a-context-0')!;
 if(block.type!=='code')throw new Error('Expected actual repository receipt');block.code='PRIVATE_REPOSITORY_A_UNREADABLE';validateDocument(doc);const before=JSON.stringify(doc);
 assert.equal(author(doc,{repositoryId:'a'}).retainedContext,'unreadable');assert.equal(readAcquisitionAnalysis(doc,'a'),undefined);assert.deepEqual(readAcquisitionAnalysis(doc,'b'),b.analysis);assert.deepEqual(readAcquisitionAnalysis(doc),g.analysis);assert.equal(author(doc,{repositoryId:'b'}).retainedContext,undefined);assert.equal(author(doc,{repositoryId:'missing'}).retainedContext,'absent');
 const poison=new Proxy({} as Project,{get(){throw new Error('PRIVATE_PROJECT_SHOULD_NOT_BE_READ');}});for(const repositoryId of ['','../a']){const unavailable=author(poison,{repositoryId});assert.equal(unavailable.origin,'unavailable');assert.equal(unavailable.retainedContext,undefined);}
 const bundle=await buildDocumentAnalysisBundle([{path:'README.md',text:'# Synthetic transient'}],{repositoryId:'a',revision:'unknown'},analysisProfile('quick',{analyzers:['documents']}));const mixed=author(poison,{repositoryId:'a',bundle});assert.equal(mixed.origin,'unavailable');assert.equal(mixed.retainedContext,undefined);assert.deepEqual(mixed.entries,[]);assert.deepEqual(mixed.revisions,[]);assert.equal(JSON.stringify(doc),before);
});

test('public diagnostic remains identical before every private getter and unreadable repository scope',async()=>{
 const poison=new Proxy({} as Project,{get(){throw new Error('PRIVATE_READER_GETTER');}}),options={publicMode:true,get repositoryId():string{throw new Error('PRIVATE_SELECTOR_GETTER');},get bundle():unknown{throw new Error('PRIVATE_BUNDLE_GETTER');}},constant=sourceBridgeStatus(poison,options),result=await acquired(),base=seed(),valid=attachAcquisitionContext(base,result.analysis),corrupt=structuredClone(valid),block=corrupt.blocks.find(block=>block.id==='analysis-context-0')!;
 if(block.type!=='code')throw new Error('Expected actual receipt');block.code='PRIVATE_RETAINED_CONTEXT_ERROR';validateDocument(corrupt);
 for(const project of [base,valid,corrupt])for(const repositoryId of [undefined,'','a','../private']){const before=JSON.stringify(project);assert.deepEqual(sourceBridgeStatus(project,{publicMode:true,repositoryId,bundle:{PRIVATE_INVALID_BUNDLE:true}}),constant);assert.equal(JSON.stringify(project),before);assert.ok(publicDocument(project).sources.some(source=>source.id==='public-citation'));}
 assert.equal(constant.visibility,'private-metadata-unavailable');assert.ok(!JSON.stringify(constant).includes('retainedContext'));assert.ok(!JSON.stringify(constant).includes('PRIVATE_'));
});

test('valid legacy receipt numbering and historical capture do not acquire a new validity or freshness rule',async()=>{
 const result=await acquired(),doc=attachAcquisitionContext(seed(),result.analysis),block=doc.blocks.find(block=>block.id==='analysis-context-0')!;block.id='analysis-context-7';for(const node of doc.nodes)node.blockIds=node.blockIds.map(id=>id==='analysis-context-0'?'analysis-context-7':id);validateDocument(doc);
 const before=JSON.stringify(doc),inspection=inspectAcquisitionAnalysis(doc);assert.equal(inspection.state,'available');assert.deepEqual(readAcquisitionAnalysis(doc),result.analysis);assert.equal(author(doc).retainedContext,undefined);assert.equal(JSON.stringify(doc),before);
 const historical=structuredClone(result.analysis);historical.sourceIdentity.observedAt='2000-01-01T00:00:00.000Z';historical.sourceIdentity.sourceRevision='a'.repeat(40);const old=attachAcquisitionContext(seed(),historical),status=author(old);assert.equal(status.retainedContext,undefined);assert.equal(status.revisions[0].revision,'a'.repeat(40));assert.match(status.revisionMeaning,/current freshness remain UNKNOWN/);assert.deepEqual(status.diagnostics.filter(row=>row.cause==='stale-revision'),[]);assert.deepEqual(old.observations,[]);
});


// Internal display paging over actual retained producer rows; no reader/parser budget changes.
async function diagnosticPagingFixture(count:number){
 const text='# Synthetic retained diagnostic fixture\n'+Array.from({length:count},(_,index)=>index<8?`[Unresolved ${index}](missing-${index}.md)`:`[Fragment ${index}](README.md#not-resolved-${index})`).join('\n');
 const result=await acquired(text),retained=result.analysis.documentMap.diagnostics.length;assert.ok(retained<=Math.min(count,1000));assert.equal(retained+result.analysis.documentMap.omitted.diagnostics,count);if(count<=17)assert.equal(retained,count);return result;
}
function diagnosticAuthor(project:Project,diagnosticPage:unknown,scope:{repositoryId?:string;bundle?:unknown}={}){
 const value=sourceBridgeStatus(project,{publicMode:false,...scope,diagnosticPage});assert.equal(value.visibility,'author');if(value.visibility!=='author')throw new Error('Expected author status');return value;
}
test('retained diagnostic pages cover exact 0 8 9 and 17 producer rows with stable order and unchanged default first eight',async()=>{
 for(const count of [0,8,9,17]){const result=await diagnosticPagingFixture(count),project=attachAcquisitionContext(seed(),result.analysis),raw=JSON.stringify(project),legacy=author(project),first=diagnosticAuthor(project,0);assert.equal(legacy.diagnosticPage,undefined);assert.deepEqual(first.diagnostics,legacy.diagnostics);assert.deepEqual(first.omitted,legacy.omitted);assert.equal(first.diagnosticPage!.total,count);assert.equal(first.diagnosticPage!.pages,Math.ceil(count/8));assert.equal(first.diagnosticPage!.start,0);assert.equal(first.diagnosticPage!.end,Math.min(8,count));const rows=[];
  for(let page=0;page<Math.max(1,Math.ceil(count/8));page++){const status=diagnosticAuthor(project,page),meta=status.diagnosticPage!;assert.equal(meta.index,page);assert.equal(meta.start,page*8);assert.equal(meta.end,Math.min(count,page*8+8));assert.equal(meta.remaining,count-meta.end);assert.equal(status.omitted.diagnostics,count-status.diagnostics.length);assert.deepEqual(status.omitted.producer,legacy.omitted.producer);rows.push(...status.diagnostics);}
  assert.deepEqual(rows.map(({path,line,code,message,cause})=>({path,line,code,message,cause})),result.analysis.documentMap.diagnostics.map(row=>({path:row.path,line:row.line??null,code:row.code,message:row.message,cause:row.cause??null})));assert.equal(JSON.stringify(project),raw);assert.deepEqual(readAcquisitionAnalysis(project),result.analysis);assert.deepEqual(project.observations,[]);
 }
});
test('page input never coerces imported objects and clamps only valid nonnegative integers to retained bounds',async()=>{
 const result=await diagnosticPagingFixture(17),project=attachAcquisitionContext(seed(),result.analysis),first=diagnosticAuthor(project,0);for(const page of [-1,1.5,NaN,Infinity,'1',null,{},Object.defineProperty({},'valueOf',{get(){throw new Error('No coercion');}})])assert.deepEqual(diagnosticAuthor(project,page),first);const last=diagnosticAuthor(project,Number.MAX_SAFE_INTEGER);assert.equal(last.diagnosticPage!.index,2);assert.equal(last.diagnosticPage!.start,16);assert.equal(last.diagnostics[0].line,result.analysis.documentMap.diagnostics[16].line);assert.equal(last.diagnosticPage!.remaining,0);
 const legacy=diagnosticAuthor(project,undefined);assert.equal(legacy.diagnosticPage,undefined);assert.deepEqual(legacy,author(project));
});
test('public constant precedes all Project bundle repository and page getters without a validity or pagination oracle',()=>{
 const poison=new Proxy({} as Project,{get(){throw new Error('PRIVATE_PROJECT_GETTER');}}),options={publicMode:true,get repositoryId():string{throw new Error('PRIVATE_SCOPE_GETTER');},get bundle():unknown{throw new Error('PRIVATE_BUNDLE_GETTER');},get diagnosticPage():unknown{throw new Error('PRIVATE_PAGE_GETTER');}};const constant=sourceBridgeStatus(seed(),{publicMode:true});assert.deepEqual(sourceBridgeStatus(poison,options),constant);assert.deepEqual(sourceBridgeStatus(seed(),{publicMode:true,diagnosticPage:999,bundle:{invalid:'PRIVATE_INVALID'},repositoryId:'../bad'}),constant);assert.ok(!JSON.stringify(constant).includes('diagnosticPage'));
});
test('paged typed causes use existing advice only and legacy prose stays unclassified with defensive copies',async()=>{
 const result=await diagnosticPagingFixture(17),project=attachAcquisitionContext(seed(),result.analysis),raw=JSON.stringify(project),page=diagnosticAuthor(project,1),ninth=result.analysis.documentMap.diagnostics[8];assert.equal(ninth.cause,'unsupported-analyzer');assert.equal(page.diagnostics[0].cause,ninth.cause);assert.equal(page.diagnostics[0].advice,'Use a compatible source or a specialist that supports this feature.');assert.ok(diagnosticAuthor(project,0).diagnostics.every(row=>row.cause===null&&row.advice===null));page.diagnostics[0].path='Caller-only mutation';page.diagnosticPage!.total=999;page.omitted.producer.diagnostics=999;assert.equal(JSON.stringify(project),raw);assert.equal(diagnosticAuthor(project,1).diagnostics[0].path,ninth.path);assert.equal(diagnosticAuthor(project,1).diagnosticPage!.total,17);
 const legacy=structuredClone(result.analysis);for(const row of legacy.documentMap.diagnostics){delete row.cause;delete row.action;row.message='access-denied unsupported-analyzer are only text';}const doc=attachAcquisitionContext(seed(),legacy);assert.ok(diagnosticAuthor(doc,1).diagnostics.every(row=>row.cause===null&&row.advice===null));assert.deepEqual(readAcquisitionAnalysis(doc),legacy);
});
test('retained paging keeps producer-omitted diagnostics separate and cannot reveal rows never retained',async()=>{
 const result=await diagnosticPagingFixture(1003),project=attachAcquisitionContext(seed(),result.analysis),before=JSON.stringify(project),retained=result.analysis.documentMap.diagnostics,omitted=result.analysis.documentMap.omitted.diagnostics,pages=Math.ceil(retained.length/8),status=diagnosticAuthor(project,999);assert.ok(retained.length>8&&retained.length<1000);assert.ok(omitted>3);assert.equal(retained.length+omitted,1003);assert.equal(status.diagnosticPage!.total,retained.length);assert.equal(status.diagnosticPage!.index,pages-1);assert.equal(status.diagnosticPage!.pages,pages);assert.equal(status.diagnostics.length,retained.length-(pages-1)*8);assert.equal(status.diagnosticPage!.remaining,0);assert.equal(status.omitted.diagnostics,retained.length-status.diagnostics.length);assert.equal(status.omitted.producer.diagnostics,omitted);assert.equal(status.outputs!.diagnosticMessages,retained.length);const shown=[];for(let page=0;page<pages;page++){const current=diagnosticAuthor(project,page);assert.equal(current.omitted.producer.diagnostics,omitted);shown.push(...current.diagnostics);}assert.deepEqual(shown.map(row=>({path:row.path,line:row.line,code:row.code,message:row.message,cause:row.cause})),retained.map(row=>({path:row.path,line:row.line??null,code:row.code,message:row.message,cause:row.cause??null})));assert.equal(JSON.stringify(project),before);
});
test('configured and explicit repository pages retain original identity and never join or fall back to global scope',async()=>{
 const a=await diagnosticPagingFixture(9),b=await diagnosticPagingFixture(17),global=await diagnosticPagingFixture(0),project=attachAcquisitionContext(attachAcquisitionContext(attachAcquisitionContext(seed(),global.analysis),a.analysis,'a'),b.analysis,'b'),raw=JSON.stringify(project);assert.equal(diagnosticAuthor(project,99,{repositoryId:'a'}).diagnosticPage!.total,9);assert.equal(diagnosticAuthor(project,99,{repositoryId:'b'}).diagnosticPage!.total,17);assert.equal(diagnosticAuthor(project,99).diagnosticPage!.total,0);for(const repositoryId of ['missing','','../a']){const unavailable=diagnosticAuthor(project,1,{repositoryId});assert.equal(unavailable.origin,'unavailable');assert.equal(unavailable.diagnosticPage,undefined);assert.deepEqual(unavailable.diagnostics,[]);}
 const text='# Synthetic configured page\n'+Array.from({length:17},(_,index)=>`[Fragment ${index}](README.md#fragment-${index})`).join('\n'),bundle=await buildDocumentAnalysisBundle([{path:'README.md',text}],{repositoryId:'selected',revision:'unknown'},analysisProfile('standard',{analyzers:['documents']})),bundleRaw=JSON.stringify(bundle),status=diagnosticAuthor(project,2,{bundle});assert.equal(status.origin,'configured-bundle');assert.equal(status.diagnosticPage!.total,17);assert.equal(status.diagnostics.length,1);assert.equal(status.diagnostics[0].line,bundle.diagnosticDetails![16].line);assert.deepEqual(status.revisions,author(project,{bundle}).revisions);assert.deepEqual(status.entries,author(project,{bundle}).entries);assert.deepEqual(status.omitted.producer,{items:bundle.omitted.items,relations:bundle.omitted.links,sources:bundle.omitted.sources});const ambiguous=diagnosticAuthor(project,2,{repositoryId:'a',bundle});assert.equal(ambiguous.origin,'unavailable');assert.equal(ambiguous.diagnosticPage,undefined);assert.equal(JSON.stringify(project),raw);assert.equal(JSON.stringify(bundle),bundleRaw);
});
