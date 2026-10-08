/** Small local CLI. Read a validated Project or compile a new ProjectBrief candidate.
 * No network, execution of analyzed code, remote upload or overwrite by default.
 */
import {readFileSync, mkdirSync, writeFileSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {parseDocument} from '../src/core/model';
import {ICON_REGISTRY} from '../src/core/icons';
import {secretInText} from '../src/core/secrets';
import {projectReadiness} from '../src/intelligence/readiness';
import {planAssets, assetChecklistCsv} from '../src/intelligence/assets';
import {parseProjectBrief, compileProjectBrief} from '../src/intelligence/brief';
import {mapDocuments, DOCUMENT_LIMITS} from '../src/intelligence/documents';
import type {DocumentInput, Purpose} from '../src/intelligence/types';

const args = process.argv.slice(2), mode = args.shift();
const value = (flag: string) => {const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined;};
const fail = (message: string): never => {throw new Error(message);};
try {
  if (!mode || !['inspect', 'brief', 'docs'].includes(mode)) fail('Usage: npm run intelligence -- inspect|brief|docs --input <file.json> --out <new-directory> [--purpose understand|project|portfolio|presentation|audit]');
  const path = value('--input') || fail('--input is required');
  const directory = value('--out') || fail('--out is required (use a new directory)');
  const limit = mode === 'brief' ? 512 * 1024 : mode === 'docs' ? DOCUMENT_LIMITS.totalBytes * 2 : 12 * 1024 * 1024;
  if (statSync(path).size > limit) fail('Input exceeds the supported byte budget');
  const raw = readFileSync(path, 'utf8');
  const output: Record<string, string> = {};
  if (mode === 'docs') {
    const input: unknown = JSON.parse(raw);
    if (!Array.isArray(input) || input.length > DOCUMENT_LIMITS.files || !input.every(row => row && typeof row === 'object' && typeof row.path === 'string' && typeof row.text === 'string')) fail('docs input must be a bounded JSON array of {path,text}; only explicitly selected files');
    output['document-map.json'] = JSON.stringify(mapDocuments(input as DocumentInput[], text => !secretInText(text)), null, 2);
  } else {
    const candidate = mode === 'brief' ? compileProjectBrief(parseProjectBrief(raw)) : null;
    const project = candidate?.document || parseDocument(raw);
    if (candidate) {
      output['project.candidate.json'] = JSON.stringify(project, null, 2);
      if (candidate.manifest) output['project-manifest.private.json'] = JSON.stringify(candidate.manifest, null, 2);
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
  console.log(`Wrote ${Object.keys(output).length} authoring files to ${resolve(directory)}. Nothing published or applied.`);
} catch (error) {console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;}
