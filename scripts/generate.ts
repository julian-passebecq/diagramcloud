import {mkdirSync,writeFileSync} from 'node:fs';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {documentSchema,validateDocument} from '../src/core/model';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {portfolioHtml} from '../src/export/html';
import {svgDiagram} from '../src/export/diagram';
import {generateNotices} from './notices';
import {packSchema} from '../src/experience/model';
import {examplePack} from '../src/experience/sample';
import {workspaceHtml} from '../src/experience/render';
mkdirSync('public/examples',{recursive:true});
const schema=zodToJsonSchema(documentSchema,{name:'DiagramCloudDocument',target:'jsonSchema7'});
writeFileSync('public/diagramcloud.schema.json',JSON.stringify({...schema,$id:'https://diagramcloud.local/schema/v1',description:'Structural schema. Imports must ALSO pass validateDocument for relational references, view membership and drilldown-cycle checks.'},null,2)+'\n');
for(const sample of samples){const d=publicDocument(validateDocument(sample));writeFileSync(`public/examples/${d.id}.json`,JSON.stringify(d,null,2)+'\n');writeFileSync(`public/examples/${d.id}.html`,portfolioHtml(d));writeFileSync(`public/examples/${d.id}.svg`,svgDiagram(d));}
generateNotices();
console.log(`Generated JSON Schema and ${samples.length} standalone example sets.`);

mkdirSync('public/experience',{recursive:true});
writeFileSync('public/experience/schema.json',JSON.stringify(zodToJsonSchema(packSchema,{name:'DiagramCloudExperience',target:'jsonSchema7'}),null,2));
const experience=examplePack();
writeFileSync('public/experience/example.json',JSON.stringify(experience,null,2));
for(const workspace of experience.workspaces)writeFileSync(`public/experience/${workspace.id}.html`,workspaceHtml(experience,workspace.id));
