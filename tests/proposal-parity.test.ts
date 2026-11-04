import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {documentSchema,type Project} from '../src/core/model';
import {applyDocumentPatch,type Patch} from '../src/core/patch';
import {commitHistory,undo} from '../src/core/operations';
import {targetFingerprint} from '../src/core/learningMapping';
import {validateProposal,proposalDigests,sha256Hex,isProviderRequest,parseAppliedLedger,PROVIDER_LAUNCH_MESSAGE,type AppliedProposal,type ProposalReason} from '../src/core/proposal';
import {stageImportText,createProposalLedger,recordAppliedProposal,PROPOSAL_LEDGER_KEY} from '../src/app/stageImport';

// Synthetic, public-only fixture: every path (manual, CLI, MCP over the public projection) sees the same facts.
const doc=():Project=>documentSchema.parse({schemaVersion:1,id:'synthetic-proposal',title:'Synthetic proposal parity',revision:4,rootViewId:'root',
 nodes:[{id:'app',label:'Synthetic app',choices:[{id:'store',title:'Store',goal:'Pick a store',options:[{id:'a',label:'A'},{id:'b',label:'B'}],recommendedOptionId:'a',origin:'ai',suggestedBy:'synthetic-agent'}]},{id:'db',label:'Synthetic store'}],
 edges:[{id:'e1',source:'app',target:'db'}],views:[{id:'root',title:'Root',nodeIds:['app','db'],edgeIds:['e1']}]});
const patch=(ops:Patch['operations'],over:Partial<Patch>={}):Patch=>({format:'diagramcloud.patch',version:1,target:'project',targetId:'synthetic-proposal',baseRevision:4,summary:'Synthetic',operations:ops,...over});
const rename=patch([{op:'test',path:'/nodes/@app/label',value:'Synthetic app'},{op:'replace',path:'/nodes/@app/label',value:'Renamed app'}]);
const applied:AppliedProposal[]=[{...proposalDigests(rename),projectId:'synthetic-proposal',baseRevision:4,appliedRevision:5}];
const cases:{name:string;payload:unknown;applied?:AppliedProposal[];codes:string[]}[]=[
 {name:'valid rename',payload:rename,codes:[]},
 {name:'wrong project',payload:{...rename,targetId:'other-project'},codes:['wrong-project']},
 {name:'wrong revision',payload:{...rename,baseRevision:3},codes:['stale-revision']},
 {name:'replay',payload:rename,applied,codes:['replay']},
 {name:'replay relabelled to a later revision',payload:{...rename,baseRevision:9},applied,codes:['stale-revision','replay']},
 {name:'self-review: accept a choice',payload:patch([{op:'replace',path:'/nodes/@app/choices/@store/status',value:'accepted'},{op:'add',path:'/nodes/@app/choices/@store/chosenOptionId',value:'a'},{op:'add',path:'/nodes/@app/choices/@store/decidedBy',value:'Synthetic Person'},{op:'add',path:'/nodes/@app/choices/@store/decidedAt',value:'2026-10-17'}]),codes:['self-review']},
 {name:'origin relabel',payload:patch([{op:'replace',path:'/nodes/@app/choices/@store/origin',value:'author'}]),codes:['origin-relabel']},
 {name:'not applicable',payload:patch([{op:'replace',path:'/nodes/@missing/label',value:'x'}]),codes:['not-applicable']},
 {name:'malformed',payload:{...rename,operations:[]},codes:['malformed']},
 {name:'provider launch',payload:{provider:'synthetic-model',prompt:'Rewrite the project',command:'run'},codes:['provider-launch']},
 {name:'unsupported kind',payload:{format:'diagramcloud.something-else',version:1},codes:['unsupported-kind']}];

/** Manual path: the JSON / AI staging the dialog runs. Success, or the sentence it shows. */
async function manual(payload:unknown,ledger:AppliedProposal[]){
 try{await stageImportText({project:doc(),library:[doc()],raw:JSON.stringify(payload),importName:'',completionRequest:null,applied:ledger});return '';}catch(e){return (e as Error).message;}
}
const sentence=(reasons:ProposalReason[])=>reasons.map(r=>r.message).join(' ');

test('proposal parity: manual import, CLI validate-proposal and MCP diagramcloud_validate_proposal give the same reasons for the same payload',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'diagramcloud-proposal-'));try{
  const current=join(dir,'current.json');writeFileSync(current,JSON.stringify(doc()));
  const mcpRequests=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'synthetic-agent',version:'1'}}},{method:'notifications/initialized'},{id:2,method:'tools/list'},
   ...cases.map((c,i)=>({id:i+3,method:'tools/call',params:{name:'diagramcloud_validate_proposal',arguments:{proposal:c.payload,...(c.applied?{applied:c.applied}:{})}}}))];
  const mcp=spawnSync(process.execPath,['--import','tsx','scripts/intelligence-mcp.ts',current],{input:mcpRequests.map(r=>JSON.stringify({jsonrpc:'2.0',...r})).join('\n')+'\n',encoding:'utf8',timeout:60000});
  assert.equal(mcp.status,0,mcp.stderr);const replies=mcp.stdout.trim().split('\n').map(l=>JSON.parse(l));
  assert.ok(replies.find(r=>r.id===2).result.tools.some((t:{name:string})=>t.name==='diagramcloud_validate_proposal'));
  for(const [i,c] of cases.entries()){
   const inProcess=validateProposal(doc(),c.payload,{origin:'imported',by:'test'},c.applied??[]);
   assert.deepEqual(inProcess.reasons.map(r=>r.code),c.codes,c.name);assert.equal(inProcess.valid,!c.codes.length,c.name);assert.equal(inProcess.applied,false);
   // The dialog is also the whole-document import path: a payload that is neither a patch nor a provider request is read as a document there.
   if(!c.codes.includes('unsupported-kind')){const viaManual=await manual(c.payload,c.applied??[]);assert.equal(viaManual,sentence(inProcess.reasons),`${c.name}: manual import shows the validator's sentence`);}
   const input=join(dir,`p${i}.json`),out=join(dir,`out${i}`),args=['--import','tsx','scripts/intelligence.ts','validate-proposal','--input',input,'--current',current,'--out',out];
   writeFileSync(input,JSON.stringify(c.payload));if(c.applied){writeFileSync(join(dir,`l${i}.json`),JSON.stringify({applied:c.applied}));args.push('--applied',join(dir,`l${i}.json`));}
   const cli=spawnSync(process.execPath,args,{encoding:'utf8',timeout:60000});assert.equal(cli.status,c.codes.length?1:0,`${c.name}: ${cli.stderr}`);
   const viaCli=JSON.parse(readFileSync(join(out,'proposal-validation.json'),'utf8'));assert.equal(viaCli.origin,'imported');
   const viaMcpReply=replies.find(r=>r.id===i+3).result;assert.equal(viaMcpReply.isError,undefined,c.name);const viaMcp=JSON.parse(viaMcpReply.content[0].text);assert.equal(viaMcp.origin,'ai');assert.equal(viaMcp.by,'synthetic-agent');
   assert.deepEqual(viaCli.reasons,inProcess.reasons,`${c.name}: CLI reasons`);assert.deepEqual(viaMcp.reasons,inProcess.reasons,`${c.name}: MCP reasons`);
   assert.equal(viaCli.digest,inProcess.digest);assert.equal(viaMcp.digest,inProcess.digest);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('proposal origin: the calling path sets it; only an explicitly named author may record a decision',()=>{
 const accept=cases.find(c=>c.name.startsWith('self-review'))!.payload;
 for(const origin of ['imported','ai'] as const)assert.deepEqual(validateProposal(doc(),accept,{origin,by:'synthetic-agent'}).reasons.map(r=>r.code),['self-review']);
 const asAuthor=validateProposal(doc(),accept,{origin:'author',by:'Synthetic Person'});assert.equal(asAuthor.valid,true);assert.equal(asAuthor.origin,'author');
 // A payload cannot claim its own origin: an origin field is not part of the envelope.
 assert.deepEqual(validateProposal(doc(),{...rename,origin:'author'},{origin:'ai',by:'x'}).reasons.map(r=>r.code),['malformed']);
});

test('no self-review for every supported proposal kind: observations, concept mappings, choices and suggestion origins',()=>{
 const base=documentSchema.parse({...doc(),sources:[{id:'src',title:'Synthetic source'}],
  observations:[{id:'obs',nodeId:'app',sourceApp:'synthetic-fixture',authority:'Synthetic',observedAt:'2026-10-01T00:00:00Z',sourceRevision:'r1',claim:'observed',summary:'Synthetic observation'}],
  learningMappings:[{id:'map',conceptId:'concept-x',contentRevision:'1',target:{projectId:'synthetic-proposal',kind:'node',id:'app',projectRevision:4,fingerprint:targetFingerprint(doc(),{kind:'node',id:'app'})},evidence:{sourceIds:['src'],blockIds:[]},state:'suggested',origin:'ai',suggestedBy:'synthetic-agent'}]});
 const check=(ops:Patch['operations'])=>validateProposal(base,patch(ops),{origin:'ai',by:'synthetic-agent'}).reasons.map(r=>r.code);
 assert.deepEqual(check([{op:'add',path:'/observations/@obs/reviewedAt',value:'2026-10-02T00:00:00Z'}]),['self-review']);
 assert.deepEqual(check([{op:'replace',path:'/observations/@obs/visibility',value:'public'}]),['self-review']);
 assert.deepEqual(check([{op:'replace',path:'/learningMappings/@map/suggestedBy',value:'Somebody else'}]),['origin-relabel']);
 assert.deepEqual(check([{op:'replace',path:'/learningMappings/@map/state',value:'rejected'},{op:'add',path:'/learningMappings/@map/reviewedBy',value:'Synthetic Person'},{op:'add',path:'/learningMappings/@map/reviewedAt',value:'2026-10-02T00:00:00Z'}]),['self-review']);
 assert.deepEqual(check([{op:'replace',path:'/observations/@obs/summary',value:'Synthetic observation, reworded'}]),[]);
 // A newly proposed observation may arrive only private and unreviewed.
 const fresh={id:'obs2',nodeId:'db',sourceApp:'synthetic-fixture',authority:'Synthetic',observedAt:'2026-10-01T00:00:00Z',sourceRevision:'r1',claim:'observed',summary:'Second'};
 assert.deepEqual(check([{op:'add',path:'/observations/-',value:fresh}]),[]);
 assert.deepEqual(check([{op:'add',path:'/observations/-',value:{...fresh,reviewedAt:'2026-10-02T00:00:00Z'}}]),['self-review']);
});

test('replay: an applied proposal cannot apply twice, after Undo or with a relabelled base revision',()=>{
 const store=new Map<string,string>(),ledger=createProposalLedger(()=>({getItem:k=>store.get(k)??null,setItem:(k,v)=>void store.set(k,v)}));
 let h={past:[] as Project[],present:doc(),future:[] as Project[]};
 assert.equal(validateProposal(h.present,rename,{origin:'imported',by:'t'},ledger.read()).valid,true);
 h=commitHistory(h,applyDocumentPatch(h.present,rename).result);recordAppliedProposal(rename,h.present.revision,ledger);
 const row=parseAppliedLedger(JSON.parse(store.get(PROPOSAL_LEDGER_KEY)!))[0];assert.equal(row.appliedRevision,5);assert.ok(!store.get(PROPOSAL_LEDGER_KEY)!.includes('Renamed app'),'the ledger keeps digests, never content');
 h=undo(h);assert.equal(h.present.revision,4);
 const again=validateProposal(h.present,rename,{origin:'imported',by:'t'},ledger.read());assert.deepEqual(again.reasons.map(r=>r.code),['replay']);
 assert.deepEqual(validateProposal(h.present,{...rename,summary:'Same edit, new words'},{origin:'imported',by:'t'},ledger.read()).reasons.map(r=>r.code),['replay'],'a new summary does not make it new');
 // Blocked storage: the in-session ledger still refuses; corrupt storage is ignored, not trusted.
 const blocked=createProposalLedger(()=>({getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}}));recordAppliedProposal(rename,5,blocked);
 assert.deepEqual(validateProposal(h.present,rename,{origin:'imported',by:'t'},blocked.read()).reasons.map(r=>r.code),['replay']);
 assert.deepEqual(createProposalLedger(()=>({getItem:()=>'{not json',setItem:()=>{}})).read(),[]);
 assert.throws(()=>parseAppliedLedger([{digest:'x'}]),/ledger row 1/);
});

test('cannot launch a provider: validation is pure, contacts nothing and advertises no launch capability',async()=>{
 const realFetch=globalThis.fetch;let calls=0;globalThis.fetch=(()=>{calls++;throw new Error('network is not allowed');}) as typeof fetch;
 try{
  for(const c of cases){validateProposal(doc(),c.payload,{origin:'ai',by:'t'},c.applied??[]);await manual(c.payload,c.applied??[]);}
  assert.equal(calls,0);
 }finally{globalThis.fetch=realFetch;}
 assert.equal(isProviderRequest({provider:'x'}),true);assert.equal(isProviderRequest({format:'diagramcloud.provider-launch',version:1}),true);assert.equal(isProviderRequest(doc()),false);assert.equal(isProviderRequest(rename),false);
 assert.equal(await manual({model:'synthetic',prompt:'go'},[]),PROVIDER_LAUNCH_MESSAGE);
 const dir=mkdtempSync(join(tmpdir(),'diagramcloud-provider-'));try{const current=join(dir,'current.json');writeFileSync(current,JSON.stringify(doc()));
  const requests=[{id:1,method:'initialize'},{method:'notifications/initialized'},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'diagramcloud_launch_provider',arguments:{provider:'x'}}}];
  const run=spawnSync(process.execPath,['--import','tsx','scripts/intelligence-mcp.ts',current],{input:requests.map(r=>JSON.stringify({jsonrpc:'2.0',...r})).join('\n')+'\n',encoding:'utf8',timeout:60000});assert.equal(run.status,0,run.stderr);
  const replies=run.stdout.trim().split('\n').map(l=>JSON.parse(l)),tools=replies.find(r=>r.id===2).result.tools as {name:string;annotations:{readOnlyHint:boolean;openWorldHint:boolean}}[];
  assert.ok(tools.every(t=>!/launch|execute|provider|run|spawn/i.test(t.name)),'no tool launches a provider or runs a command');assert.ok(tools.every(t=>t.annotations.readOnlyHint&&!t.annotations.openWorldHint));
  assert.equal(replies.find(r=>r.id===3).result.isError,true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('sha256Hex matches the reference digest',async()=>{
 for(const text of ['','abc','DiagramCloud é'.repeat(40)]){const ref=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');assert.equal(sha256Hex(text),ref);}
});
