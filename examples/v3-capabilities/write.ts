/** Regenerate the committed example Projects from their guides: npx tsx examples/v3-capabilities/write.ts */
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {EXAMPLES,EXAMPLE_NAMES,buildExample,exampleText} from './build';

for(const name of EXAMPLE_NAMES){
 const path=join(EXAMPLES,`${name}.project.json`);
 writeFileSync(path,exampleText(buildExample(name)));
 console.log(`Wrote ${path}`);
}
