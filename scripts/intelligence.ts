/** Small local CLI. Read a validated Project or compile a new ProjectBrief candidate.
 * No network, execution of analyzed code, remote upload or overwrite by default.
 */
import {readFileSync, mkdirSync, writeFileSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {documentSchema,parseDocument} from '../src/core/model';
import {ICON_REGISTRY} from '../src/core/icons';
import {secretInText} from '../src/core/secrets';
import {projectReadiness} from '../src/intelligence/readiness';
import {planAssets, assetChecklistCsv} from '../src/intelligence/assets';
import {parseProjectBrief, compileProjectBrief} from '../src/intelligence/brief';
import {compileGraphSnapshot, GRAPH_SNAPSHOT_MAX_BYTES} from '../src/intelligence/graphSnapshot';
import {previewGraphReimport} from '../src/intelligence/graphSnapshot';
import {previewDeliveryBrief} from '../src/intelligence/delivery';
import {analyzeDomainFiles,extendWithDomainFacts} from '../src/intelligence/domainAdapters';
import {queryProject,verificationProposal} from '../src/intelligence/context';
import {intelligenceReportHtml} from '../src/export/intelligenceReport';
import {semanticEvolution} from '../src/intelligence/evolution';
import {mapDocuments, DOCUMENT_LIMITS} from '../src/intelligence/documents';
import type {DocumentInput, Purpose} from '../src/intelligence/types';
import {analysisProfile,validateAnalysisProfile,analysisCacheKey} from '../src/intelligence/profile';
import {buildSourceAnalysisBundle} from '../src/intelligence/sourceBundle';
import {proposeVerificationSpec,stageVerificationReceipt,stageCockpitSnapshot} from '../src/intelligence/verification';
import {stageEntityProposal} from '../src/intelligence/entityProposal';
import {repositoryAnalysis,crossRepositoryCandidates,crossRepositoryPatch} from '../src/intelligence/crossRepository';
import {createPublication} from '../src/intelligence/library';
import {publicDocument} from '../src/core/operations';
import {technicalManualHtml} from '../src/export/manual';
import {deepAnalyze} from '../src/intelligence/deepAnalysis';
import {deepAnalysisPatch} from '../src/intelligence/deepProposal';
import {publicationFidelity} from '../src/intelligence/publicationBrief';
import {nodeDeepRuntime} from './lib/deepRuntime';

const args = process.argv.slice(2), mode = args.shift();
const value = (flag: string) => {const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined;};
const fail = (message: string): never => {throw new Error(message);};
try {
  if (!mode || !['inspect', 'brief', 'docs', 'graph', 'analyze', 'delivery', 'query', 'evolution','profile','bundle','deep','verification-spec','verification-receipt','cockpit','entity-proposal','cross-repository','publication'].includes(mode)) fail('Usage: npm run intelligence -- inspect|brief|docs|graph|analyze|delivery|query|evolution|profile|bundle|deep|verification-spec|verification-receipt|cockpit|entity-proposal|cross-repository|publication --input <file.json> --out <new-directory> [--current <document.json>]');
  const path = value('--input') || fail('--input is required');
  const directory = value('--out') || fail('--out is required (use a new directory)');
  const limit = mode === 'brief' ? 512 * 1024 : mode === 'graph' ? GRAPH_SNAPSHOT_MAX_BYTES : mode === 'docs' ? DOCUMENT_LIMITS.totalBytes * 2 : 12 * 1024 * 1024;
  if (statSync(path).size > limit) fail('Input exceeds the supported byte budget');
  const raw = readFileSync(path, 'utf8');
  const output: Record<string, string> = {};
  const selectedJson=(flag:string)=>{const path=value(flag)||fail(flag+' is required');if(statSync(path).size>12*1024*1024)fail('Selected input exceeds 12 MiB');return JSON.parse(readFileSync(path,'utf8'));};
  const current=()=>parseDocument(JSON.stringify(selectedJson('--current')));
  if(mode==='profile'){
    const input=JSON.parse(raw);const profile=input.format?validateAnalysisProfile(input):analysisProfile(input.depth??'standard',input.overrides??{});output['analysis-profile.json']=JSON.stringify(profile,null,2);
  }else if(mode==='deep'){
    const input=JSON.parse(raw);if(!Array.isArray(input.files)||!input.files.every((f:unknown)=>f&&typeof f==='object'&&typeof (f as DocumentInput).path==='string'&&typeof (f as DocumentInput).text==='string'))fail('deep requires explicitly selected files, profile and repository/revision identity');
    const bundle=await deepAnalyze(input.files,validateAnalysisProfile(input.profile),await nodeDeepRuntime(),{repositoryId:input.repositoryId,revision:input.revision});output['analysis-bundle.private.json']=JSON.stringify(bundle,null,2);output['cache-key.txt']=await analysisCacheKey(bundle);
    if(value('--select'))output['proposal.patch.json']=JSON.stringify(deepAnalysisPatch(current(),bundle,value('--select')!.split(',')),null,2);
  }else if(mode==='bundle'){
    const input=JSON.parse(raw);const profile=validateAnalysisProfile(input.profile),bundle=await buildSourceAnalysisBundle(input.files,{repositoryId:input.repositoryId,revision:input.revision},profile,profile.analyzers.includes('tree-sitter')?{runtime:await nodeDeepRuntime()}:{});output['analysis-bundle.private.json']=JSON.stringify(bundle,null,2);output['cache-key.txt']=await analysisCacheKey(bundle);
  }else if(mode==='verification-spec'){
    output['verification-spec.proposed.json']=JSON.stringify(proposeVerificationSpec(current(),JSON.parse(raw)),null,2);
  }else if(mode==='verification-receipt'){
    const proposal=stageVerificationReceipt(current(),selectedJson('--spec'),JSON.parse(raw),{name:value('--runner')||fail('--runner required'),runId:value('--run-id')||fail('--run-id required')});output['proposal.patch.json']=JSON.stringify(proposal.patch,null,2);output['unmapped-checks.json']=JSON.stringify(proposal.unmappedCheckIds,null,2);
  }else if(mode==='cockpit'){
    output['proposal.patch.json']=JSON.stringify(stageCockpitSnapshot(current(),JSON.parse(raw)).patch,null,2);
  }else if(mode==='entity-proposal'){
    output['proposal.patch.json']=JSON.stringify(stageEntityProposal(current(),JSON.parse(raw),selectedJson('--sources')).patch,null,2);
  }else if(mode==='cross-repository'){
    const project=current(),inputs=JSON.parse(raw);if(!Array.isArray(inputs))fail('Cross-repository input must be explicitly selected repository analysis array');output['contract-candidates.private.json']=JSON.stringify(crossRepositoryCandidates(project,inputs),null,2);if(value('--select'))output['proposal.patch.json']=JSON.stringify(crossRepositoryPatch(project,inputs,value('--select')!.split(',')),null,2);
  }else if(mode==='publication'){
    const project=parseDocument(raw),safe=publicDocument(project),snapshot=await createPublication(project,{title:value('--title')||safe.title,audience:value('--audience')||'',viewIds:value('--views')?.split(',')??safe.views.map(v=>v.id),...(value('--brief')?selectedJson('--brief'):{})});output['publication.public.json']=JSON.stringify(snapshot,null,2);output['handbook.public.html']=technicalManualHtml(project,{viewIds:snapshot.viewIds,brief:snapshot.brief});output['fidelity.public.json']=JSON.stringify(publicationFidelity(project,snapshot.brief),null,2);
  }else if (mode === 'evolution') {
    const currentPath=value('--current')||fail('evolution requires --current <document.json>');if(statSync(currentPath).size>12*1024*1024)fail('Current document exceeds budget');
    const before=parseDocument(raw),after=parseDocument(readFileSync(currentPath,'utf8'));if(secretInText(JSON.stringify([before,after])))fail('Sensitive evolution input refused');
    output['evolution.private.json']=JSON.stringify(semanticEvolution(before,after),null,2);
  } else if (mode === 'analyze') {
    const selected:unknown=JSON.parse(raw);if(!Array.isArray(selected)||!selected.every(f=>f&&typeof f.path==='string'&&typeof f.text==='string'))fail('analyze input is a selected array of {path,text}');
    const report=analyzeDomainFiles(selected as DocumentInput[]);const seed=documentSchema.parse({schemaVersion:1,id:'selected-static-project',title:'Selected static artifacts',rootViewId:'root',nodes:[{id:'selected-root',label:'Selected artifacts'}],edges:[],views:[{id:'root',title:'Selected artifacts',nodeIds:['selected-root']}]});
    output['project.candidate.json']=JSON.stringify(extendWithDomainFacts(seed,report),null,2);output['analyzers.json']=JSON.stringify(report,null,2);
    if(value('--repository-id')&&value('--revision'))output['repository-analysis.private.json']=JSON.stringify(repositoryAnalysis(report,value('--repository-id')!,value('--revision')!),null,2);
  } else if (mode === 'delivery') {
    const currentPath=value('--current')||fail('delivery requires --current <document.json>');if(statSync(currentPath).size>12*1024*1024)fail('Current document exceeds budget');
    const out=previewDeliveryBrief(parseDocument(readFileSync(currentPath,'utf8')),JSON.parse(raw));output['proposal.patch.json']=JSON.stringify(out.patch,null,2);output['project.candidate.json']=JSON.stringify(out.document,null,2);
  } else if (mode === 'query') {
    const project=parseDocument(raw);output['context.public.json']=JSON.stringify(queryProject(project,{kind:value('--kind')||'summary',...(value('--node')?{nodeId:value('--node')}:{})}),null,2);output['verification.proposed.json']=JSON.stringify(verificationProposal(project),null,2);output['report.public.html']=intelligenceReportHtml(project);
  } else if (mode === 'docs') {
    const input: unknown = JSON.parse(raw);
    if (!Array.isArray(input) || input.length > DOCUMENT_LIMITS.files || !input.every(row => row && typeof row === 'object' && typeof row.path === 'string' && typeof row.text === 'string')) fail('docs input must be a bounded JSON array of {path,text}; only explicitly selected files');
    output['document-map.json'] = JSON.stringify(mapDocuments(input as DocumentInput[], text => !secretInText(text)), null, 2);
  } else {
    const candidate = mode === 'brief' ? compileProjectBrief(parseProjectBrief(raw)) : mode === 'graph' ? compileGraphSnapshot(JSON.parse(raw)) : null;
    let project = candidate?.document || parseDocument(raw);
    if(mode==='graph'&&candidate&&value('--current')){const currentPath=value('--current')!;if(statSync(currentPath).size>12*1024*1024)fail('Current document exceeds budget');const current=parseDocument(readFileSync(currentPath,'utf8')),proposal=previewGraphReimport(current,JSON.parse(raw),current.revision);candidate.document=proposal.document;output['proposal.patch.json']=JSON.stringify(proposal.patch,null,2);output['comparison.json']=JSON.stringify(proposal.delta,null,2);}
    if (candidate) {
      project=candidate.document;output['project.candidate.json'] = JSON.stringify(project, null, 2);
      if ('manifest' in candidate && candidate.manifest) output['project-manifest.private.json'] = JSON.stringify(candidate.manifest, null, 2);
      output['warnings.txt'] = candidate.warnings.join('\n');
    }
    const report = projectReadiness(project, {purpose: (value('--purpose') || 'understand') as Purpose});
    const assets = planAssets(project, ICON_REGISTRY);
    output['readiness.json'] = JSON.stringify(report, null, 2);
    output['asset-plan.json'] = JSON.stringify(assets, null, 2);
    output['asset-checklist.csv'] = assetChecklistCsv(assets);
  }
  // Prepare everything before writing; require a new directory, never replace a prior result.
  mkdirSync(resolve(directory), {recursive: false});
  for (const [name, content] of Object.entries(output)) writeFileSync(join(directory, name), content.endsWith('\n') ? content : content + '\n', {flag: 'wx'});
  console.log(`Wrote ${Object.keys(output).length} local result files to ${resolve(directory)}. Nothing published or applied.`);
} catch (error) {console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;}
