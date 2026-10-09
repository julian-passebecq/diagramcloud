/** Explicit read-only source qualification. Receipts contain revisions/checks,
 * never selected source content; the destination must be new. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {readRepositorySelection} from './lib/readRepo';
import type {Evidence} from '../src/core/scan/scanner';
import {scanRepository,documentFromScan} from '../src/core/scan';
import {analyzeDomainFiles,extendWithDomainFacts} from '../src/intelligence/domainAdapters';
import {projectReadiness} from '../src/intelligence/readiness';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {secretInText} from '../src/core/secrets';
import {portfolioHtml} from '../src/export/html';
import {technicalManualHtml} from '../src/export/manual';
const args=process.argv.slice(2),flag=(key:string)=>{const index=args.indexOf(key);return index>=0?args[index+1]:undefined;};
try{
 const manifestPath=flag('--manifest'),directory=flag('--out');if(!manifestPath||!directory)throw new Error('Usage: npx tsx scripts/qualify-real.ts --manifest <explicit-local-sources.json> --out <new-directory>');
 if(statSync(manifestPath).size>64*1024)throw new Error('Source manifest exceeds 64 KiB');const sources:unknown=JSON.parse(readFileSync(manifestPath,'utf8'));
 if(!Array.isArray(sources)||!sources.length||sources.length>12||!sources.every(s=>s&&typeof s.id==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(s.id)&&typeof s.path==='string'))throw new Error('Select 1–12 explicit {id,path} sources');
 const startedAt=new Date().toISOString(),receipts=[];
 for(const source of sources as {id:string;path:string}[]){const root=resolve(source.path),revision=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();if(!/^[0-9a-f]{40}$/.test(revision))throw new Error('Expected exact Git source revision');
  const selection=readRepositorySelection(root),model=scanRepository(selection.files,{name:source.id,preferDbtManifest:true,boundaryPaths:selection.boundaryPaths,boundaryMarkers:selection.boundaryMarkers}),domain=analyzeDomainFiles(selection.files),candidate=validateDocument(extendWithDomainFacts(documentFromScan(model).document,domain));
  const checks=[] as {id:string;status:'PASS';note:string}[];
  const pass=(id:string,note:string)=>checks.push({id,status:'PASS',note});
  if(candidate.observations.length)throw new Error('Source analysis fabricated runtime observations');pass('no-runtime-fabrication','Static source findings never establish observed or verified runtime.');
  const paths=new Map(selection.files.map(f=>[f.path,f.text.split(/\r?\n/).length]));const citation=(evidence:Evidence)=>{if(evidence.kind==='selection-metadata'){if(evidence.path!=='.'&&(!evidence.path||evidence.path.split('/').some(p=>p==='..'||!p)||!selection.files.some(f=>f.path.startsWith(evidence.path+'/'))))throw new Error('Selection metadata refers outside the admitted source scope');return;}if(!paths.has(evidence.file)||!Number.isInteger(evidence.line)||evidence.line<1||evidence.line>paths.get(evidence.file)!)throw new Error('Scanner source finding lacks selected file:line backing');};for(const item of model.items.values())for(const evidence of item.evidence)citation(evidence);for(const link of model.links)for(const evidence of link.evidence)citation(evidence);for(const fact of [...domain.facts,...domain.links,...domain.contracts])if(!paths.has(fact.path)||fact.line<1||fact.line>paths.get(fact.path)!)throw new Error('Specialist source pointer exceeds selected text');pass('source-backed-findings','Source citations point to admitted files and positive lines. Selection metadata has a separately validated directory pointer, never a source-file line.');
  if(projectReadiness(candidate).views.filter(v=>v.required).length!==4)throw new Error('Missing minimum output');pass('minimum-outputs','Overview, structure, relationships and evidence/gaps have existing or honest partial output plans.');
  if(secretInText(JSON.stringify(candidate)))throw new Error(source.id+' credential-like content in candidate');pass('secret-safe-model','Sensitive source content is excluded before model construction.');
  const sentinel='PRIVATE_REAL_QUALIFICATION_SENTINEL';candidate.privateNotes=sentinel;candidate.nodes.forEach(n=>n.visibility='private');candidate.edges.forEach(e=>e.visibility='private');candidate.blocks.forEach(b=>b.visibility='private');candidate.sources.forEach(s=>s.visibility='private');candidate.views.forEach(v=>{if(v.id!==candidate.rootViewId)v.visibility='private';});
  for(const output of [JSON.stringify(publicDocument(candidate)),portfolioHtml(candidate),technicalManualHtml(candidate)])if(output.includes(sentinel))throw new Error('Private sentinel leaked');pass('public-redaction','JSON, offline HTML and manual reapply publicDocument and exclude private content.');
  receipts.push({id:source.id,sourceRevision:revision,sourceRevisionMeaning:'HEAD reference only; selected worktree cleanliness is unknown',selectedContentDigest:'sha256:'+createHash('sha256').update(selection.files.map(f=>f.path+'\0'+createHash('sha256').update(f.text).digest('hex')).sort().join('\n')).digest('hex'),readFiles:selection.files.length,scope:'bounded selected local source',checks});
 }
 const candidateSourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidateWorktreeDirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
 const receipt={candidateSourceSha,candidateWorktreeDirty,format:'diagramcloud.real-source-qualification/1',startedAt,completedAt:new Date().toISOString(),analyzerVersion:'diagramcloud-domain/3',sources:receipts,contentsIncluded:false,ownerVerified:false};mkdirSync(resolve(directory),{recursive:false});writeFileSync(join(directory,'receipt.private.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({sources:receipts.length,checks:receipts.reduce((n,s)=>n+s.checks.length,0),allPassed:true,contentsIncluded:false}));
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
