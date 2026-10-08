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

const args = process.argv.slice(2), mode = args.shift();
const value = (flag: string) => {const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined;};
const fail = (message: string): never => {throw new Error(message);};
try {
  if (!mode || !['inspect', 'brief', 'docs', 'graph', 'analyze', 'delivery', 'query', 'evolution'].includes(mode)) fail('Usage: npm run intelligence -- inspect|brief|docs|graph|analyze|delivery|query|evolution --input <file.json> --out <new-directory> [--current <document.json>] [--purpose understand|project|portfolio|presentation|audit]');
  const path = value('--input') || fail('--input is required');
  const directory = value('--out') || fail('--out is required (use a new directory)');
  const limit = mode === 'brief' ? 512 * 1024 : mode === 'graph' ? GRAPH_SNAPSHOT_MAX_BYTES : mode === 'docs' ? DOCUMENT_LIMITS.totalBytes * 2 : 12 * 1024 * 1024;
  if (statSync(path).size > limit) fail('Input exceeds the supported byte budget');
  const raw = readFileSync(path, 'utf8');
  const output: Record<string, string> = {};
  if (mode === 'evolution') {
    const currentPath=value('--current')||fail('evolution requires --current <document.json>');if(statSync(currentPath).size>12*1024*1024)fail('Current document exceeds budget');
    const before=parseDocument(raw),after=parseDocument(readFileSync(currentPath,'utf8'));if(secretInText(JSON.stringify([before,after])))fail('Sensitive evolution input refused');
    output['evolution.private.json']=JSON.stringify(semanticEvolution(before,after),null,2);
  } else if (mode === 'analyze') {
    const selected:unknown=JSON.parse(raw);if(!Array.isArray(selected)||!selected.every(f=>f&&typeof f.path==='string'&&typeof f.text==='string'))fail('analyze input is a selected array of {path,text}');
    const report=analyzeDomainFiles(selected as DocumentInput[]);const seed=documentSchema.parse({schemaVersion:1,id:'selected-static-project',title:'Selected static artifacts',rootViewId:'root',nodes:[{id:'selected-root',label:'Selected artifacts'}],edges:[],views:[{id:'root',title:'Selected artifacts',nodeIds:['selected-root']}]});
    output['project.candidate.json']=JSON.stringify(extendWithDomainFacts(seed,report),null,2);output['analyzers.json']=JSON.stringify(report,null,2);
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
