import {mkdirSync,writeFileSync} from 'node:fs';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {documentSchema,validateDocument} from '../src/core/model';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {portfolioHtml} from '../src/export/html';
import {svgDiagram} from '../src/export/diagram';
mkdirSync('public/examples',{recursive:true});
const schema=zodToJsonSchema(documentSchema,{name:'DiagramCloudDocument',target:'jsonSchema7'});
writeFileSync('public/diagramcloud.schema.json',JSON.stringify({...schema,$id:'https://diagramcloud.local/schema/v1',description:'Structural schema. Imports must ALSO pass validateDocument for relational references, view membership and drilldown-cycle checks.'},null,2)+'\n');
for(const sample of samples){const d=publicDocument(validateDocument(sample));writeFileSync(`public/examples/${d.id}.json`,JSON.stringify(d,null,2)+'\n');writeFileSync(`public/examples/${d.id}.html`,portfolioHtml(d));writeFileSync(`public/examples/${d.id}.svg`,svgDiagram(d));}
console.log(`Generated JSON Schema and ${samples.length} standalone example sets.`);
