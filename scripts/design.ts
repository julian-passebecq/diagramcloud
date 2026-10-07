/**
 * Diagram Design CLI: render every public view of a DiagramCloud document as Diagram Design figures.
 *   npm run design -- <diagramcloud.json> [--brief design-brief.json] [--out folder] [--type auto|architecture|layers|exploded|tree] [--theme light|dark|editorial]
 * Works on any document: a scan (`npm run scan`), an atlas (`npm run atlas`) or an authored project. A brief (for
 * example written by an AI agent) is applied in memory first and its report printed; the document file is never
 * modified. Output is static, offline SVG built from publicDocument, plus an index.html that lists them.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseDocument,DESIGN_THEMES,DESIGN_TYPES,type DesignTheme,type DesignType} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {applyDesignBrief,parseDesignBrief} from '../src/core/designBrief';
import {designSvg,resolveDesignType} from '../src/export/design';
import {xml} from '../src/export/diagram';

const args=process.argv.slice(2),flag=(n:string)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:undefined;};
const briefPath=flag('--brief'),out=resolve(flag('--out')??'design-figures'),type=flag('--type') as DesignType|undefined,theme=flag('--theme') as DesignTheme|undefined;
if(type&&!DESIGN_TYPES.includes(type))throw new Error(`--type is one of ${DESIGN_TYPES.join(', ')}`);
if(theme&&!DESIGN_THEMES.includes(theme))throw new Error(`--theme is one of ${DESIGN_THEMES.join(', ')}`);
if(!args[0])throw new Error('Usage: npm run design -- <diagramcloud.json> [--brief brief.json] [--out folder] [--type …] [--theme …]');
let doc=parseDocument(readFileSync(resolve(args[0]),'utf8'));
if(briefPath){const r=applyDesignBrief(doc,parseDesignBrief(readFileSync(resolve(briefPath),'utf8')),{fileName:briefPath});doc=r.document;
 process.stderr.write([`Brief ${briefPath}:`,...r.report.kept.map(k=>`  ${k}`),...r.report.lost.map(l=>`  skipped: ${l}`)].join('\n')+'\n');}
mkdirSync(out,{recursive:true});
const now=new Date(),rows:string[]=[];
for(const v of publicDocument(doc).views){
 const t=resolveDesignType(doc,v.id,type),file=`${doc.id}.${v.id}.${t}.svg`;
 writeFileSync(join(out,file),designSvg(doc,v.id,{type,theme,now}));rows.push(`<li><a href="${xml(file)}">${xml(v.title)}</a> · ${xml(t)}</li>`);
 process.stderr.write(`  ${file}\n`);
}
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"><title>${xml(doc.title)} · Diagram Design figures</title><style>body{font:15px system-ui,sans-serif;margin:32px;color:#2d3142;background:#f5f5f5}</style></head><body><h1>${xml(doc.title)}</h1><p>Public views drawn in Diagram Design mode (${now.toISOString().slice(0,10)}).</p><ul>${rows.join('')}</ul></body></html>\n`);
process.stderr.write(`${rows.length} figure(s) in ${out}\n`);
