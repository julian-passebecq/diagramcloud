/**
 * Diagram Design CLI: render every public view of a DiagramCloud document as Diagram Design figures.
 *   npm run design -- <diagramcloud.json> [--delta earlier.json] [--brief design-brief.json] [--out folder] [--type <figure type>] [--theme light|dark|editorial] [--pdf]
 * Works on any document: a scan (`npm run scan`), an atlas (`npm run atlas`) or an authored project. A brief (for
 * example written by an AI agent) is applied in memory first and its report printed; the document file is never
 * modified. Output is static, offline SVG built from publicDocument, plus an index.html that lists them.
 * --pdf also prints book.pdf (A4 landscape, one figure per page) and one figure-sized <project>.<view>.<type>.pdf per view
 * with Playwright's chromium, offline (any non-file request aborts the run); needs `npx playwright install chromium`.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {recommendFigures} from '../src/export/design/recommend';
import {parseDocument,DESIGN_THEMES,DESIGN_TYPES,type DesignTheme,type DesignType} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {applyDesignBrief,parseDesignBrief} from '../src/core/designBrief';
import {designSvg,resolveDesignType} from '../src/export/design';
import {deltaSvg} from '../src/export/design/delta';
import {designBookHtml} from '../src/export/design/book';
import {xml} from '../src/export/diagram';

const args=process.argv.slice(2),flag=(n:string)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:undefined;},sw=(n:string)=>{const i=args.indexOf(n);if(i>=0)args.splice(i,1);return i>=0;};
const pdf=sw('--pdf');
const deltaPath=flag('--delta'),briefPath=flag('--brief'),out=resolve(flag('--out')??'design-figures'),type=flag('--type') as DesignType|undefined,theme=flag('--theme') as DesignTheme|undefined;
if(type&&!DESIGN_TYPES.includes(type))throw new Error(`--type is one of ${DESIGN_TYPES.join(', ')}`);
if(theme&&!DESIGN_THEMES.includes(theme))throw new Error(`--theme is one of ${DESIGN_THEMES.join(', ')}`);
if(!args[0])throw new Error('Usage: npm run design -- <diagramcloud.json> [--brief brief.json] [--out folder] [--type …] [--theme …]');
let doc=parseDocument(readFileSync(resolve(args[0]),'utf8'));
if(briefPath){const r=applyDesignBrief(doc,parseDesignBrief(readFileSync(resolve(briefPath),'utf8')),{fileName:briefPath});doc=r.document;
 process.stderr.write([`Brief ${briefPath}:`,...r.report.kept.map(k=>`  ${k}`),...r.report.lost.map(l=>`  skipped: ${l}`)].join('\n')+'\n');}
mkdirSync(out,{recursive:true});
const earlier=deltaPath?parseDocument(readFileSync(resolve(deltaPath),'utf8')):undefined;
const now=new Date(),rows:string[]=[],svgs:{file:string;svg:string}[]=[];
for(const v of publicDocument(doc).views){
 const t=resolveDesignType(doc,v.id,type),file=`${doc.id}.${v.id}.${t}.svg`;
 const svg=designSvg(doc,v.id,{type,theme,now});writeFileSync(join(out,file),svg);svgs.push({file,svg});rows.push(`<li><a href="${xml(file)}">${xml(v.title)}</a> · ${xml(t)}</li>`);
 if(earlier){try{const df=`${doc.id}.${v.id}.delta.svg`;writeFileSync(join(out,df),deltaSvg(earlier,doc,v.id,{theme,now}));rows.push(`<li><a href="${xml(df)}">${xml(v.title)}</a> · delta</li>`);}catch(e){process.stderr.write(`  no delta for ${v.id}: ${e instanceof Error?e.message:e}
`);}}
 process.stderr.write(`  ${file}\n`);
}
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"><title>${xml(doc.title)} · Diagram Design figures</title><style>body{font:15px system-ui,sans-serif;margin:32px;color:#2d3142;background:#f5f5f5}</style></head><body><h1>${xml(doc.title)}</h1><p>Public views drawn in Diagram Design mode (${now.toISOString().slice(0,10)}).</p><ul>${rows.join('')}</ul></body></html>\n`);
// Suggestions per public view (ranked from public facts, with reasons): input for an agent writing a design brief.
writeFileSync(join(out,'suggestions.json'),JSON.stringify({format:'diagramcloud.design-suggestions/1',projectId:doc.id,views:publicDocument(doc).views.map(v=>({viewId:v.id,title:v.title,suggested:recommendFigures(doc,v.id).slice(0,5)}))},null,2)+'\n');
writeFileSync(join(out,'book.html'),designBookHtml(doc,{type,theme,now}));
process.stderr.write(`${rows.length} figure(s) and book.html in ${out}\n`);
if(pdf)await writePdfs();

/** Prints book.pdf and one figure-sized PDF per view with chromium, offline; every PDF is rendered in memory first, so a failure leaves none. */
async function writePdfs(){
 const {chromium}=await import('@playwright/test');let browser;
 try{browser=await chromium.launch();}catch(e){process.stderr.write(`--pdf needs Playwright's chromium: run "npx playwright install chromium"\n${e instanceof Error?e.message.split('\n')[0]:e}\n`);process.exit(1);}
 const blocked:string[]=[],files:{name:string;data:Buffer}[]=[];
 try{
  const page=await browser.newPage();
  await page.route('**/*',r=>{const u=r.request().url();if(/^(file|data|about):/.test(u))return r.continue();blocked.push(u);return r.abort();});
  await page.goto(pathToFileURL(join(out,'book.html')).href,{waitUntil:'load'});await page.emulateMedia({media:'print'});
  files.push({name:'book.pdf',data:await page.pdf({format:'A4',landscape:true,printBackground:true,margin:{top:'10mm',bottom:'10mm',left:'10mm',right:'10mm'}})});
  for(const {file,svg} of svgs){
   const w=Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(svg)?.[1]??800),h=Number(/<svg[^>]*\sheight="([\d.]+)"/.exec(svg)?.[1]??600);
   await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${svg}</body></html>`,{waitUntil:'load'});
   files.push({name:file.replace(/\.svg$/,'.pdf'),data:await page.pdf({width:`${w}px`,height:`${h}px`,printBackground:true,pageRanges:'1',margin:{top:'0',bottom:'0',left:'0',right:'0'}})});
  }
 }finally{await browser.close();}
 if(blocked.length){process.stderr.write(`--pdf refused: network request(s) attempted while printing offline:\n${blocked.map(u=>`  ${u}`).join('\n')}\n`);process.exit(1);}
 for(const f of files)writeFileSync(join(out,f.name),f.data);
 process.stderr.write(`${files.length} PDF(s) in ${out}\n`);
}
