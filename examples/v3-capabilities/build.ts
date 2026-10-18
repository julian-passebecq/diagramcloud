/** Builds the two V3 capability example Projects from their cited capability guides.
 * The guides live in tests/fixtures/v3-capabilities/; the compiled Projects are committed next to this file and
 * re-derived by tests/v3-capabilities.test.ts, so they cannot drift from their guides.
 * Nothing here observes, reviews or certifies anything: compileCapabilityGuide creates no observation, and the
 * synthetic example is relabelled so every evidence block says `synthetic`.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {compileCapabilityGuide} from '../../src/intelligence/capabilityGuide';
import {validateDocument,type Project} from '../../src/core/model';

export const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..','..');
export const FIXTURES=join(ROOT,'tests','fixtures','v3-capabilities');
export const EXAMPLES=join(ROOT,'examples','v3-capabilities');
export const EXAMPLE_NAMES=['diagramcloud-self','synthetic-rag'] as const;
export type ExampleName=typeof EXAMPLE_NAMES[number];
export const SYNTHETIC:Record<ExampleName,boolean>={'diagramcloud-self':false,'synthetic-rag':true};

export const readJson=(path:string):unknown=>JSON.parse(readFileSync(path,'utf8'));
export const guideFor=(name:ExampleName)=>readJson(join(FIXTURES,`${name}.guide.json`));
export const anchorsFor=(name:ExampleName)=>readJson(join(FIXTURES,`${name}.anchors.json`)) as {sourceCut:string;anchors:Record<string,string>};

/** Label an invented example as synthetic everywhere a reader or an export can see it. Facts are not changed. */
export function labelSynthetic(input:Project):Project{
 const d=structuredClone(input);
 d.tags=[...new Set([...d.tags,'synthetic'])];
 d.provenance=`SYNTHETIC example: invented for teaching, never a measured or observed result. ${d.provenance}`;
 for(const b of d.blocks)b.provenance='synthetic';
 for(const n of d.nodes)n.tags=[...new Set([...n.tags,'synthetic'])];
 return validateDocument(d);
}

export function buildExample(name:ExampleName):Project{
 const compiled=compileCapabilityGuide(guideFor(name));
 return SYNTHETIC[name]?labelSynthetic(compiled):compiled;
}

export const exampleText=(project:Project)=>JSON.stringify(project,null,1)+'\n';
