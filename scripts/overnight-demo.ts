/** Reusable offline, synthetic source -> canonical document -> existing exporters.
 * npx tsx scripts/overnight-demo.ts [--out .local/overnight/demo/new-name] [--print]
 * --print uses installed Chromium for PDF and the existing editorial picture deck.
 * No source code in the fixture is imported or executed; no application data is read.
 */
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import {scanRepository,documentFromScan} from '../src/core/scan';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {readRepository} from './lib/readRepo';
import {portfolioHtml} from '../src/export/html';
import {svgDiagram} from '../src/export/diagram';
import {technicalManualHtml} from '../src/export/manual';
import {editorialSvg} from '../src/export/styled';
import {addArchitectureSlides} from '../src/export/pptx';
import {buildDesignDeck} from '../src/export/design/slides';
import {prepareConceptPreview} from '../src/interop/conceptPreview';

const args=process.argv.slice(2),print=args.includes('--print');
const outIndex=args.indexOf('--out');
const output=resolve(outIndex<0?'.local/overnight/demo/run-'+new Date().toISOString().replace(/[:.]/g,'-'):args[outIndex+1]??'');
const root=resolve('.local/overnight/demo');
const child=relative(root,output);
if(!child||child.startsWith('..')||isAbsolute(child))throw new Error('Output must be a new child of .local/overnight/demo');
mkdirSync(root,{recursive:true});mkdirSync(output); // exclusive: never overwrite a demo
const fixture=resolve('tests/fixtures/overnight-workflow'),files=readRepository(fixture),now=new Date('2026-10-14T12:00:00Z');
const model=scanRepository(files,{name:'Synthetic standalone order workflow'});
const fileMap=new Map(files.map(f=>[f.path,f]));
for(const row of [...model.items.values(),...model.links])for(const e of row.evidence){
 if(e.kind==='selection-metadata')continue;
 const source=fileMap.get(e.file);
 if(!source||e.line<1||e.line>source.text.split(/\r?\n/).length)throw new Error('Source evidence lies outside the inspected fixture');
}
const scan=documentFromScan(model,{now,fileName:'synthetic-overnight-workflow'});
const input=scan.document;
input.title='Synthetic standalone order workflow';
input.summary='Synthetic teaching architecture from inspected source imports. Input: order records; output: a report shape. Runtime, timing, deployment and business results are unknown.';
input.provenance='SYNTHETIC FIXTURE. Source-derived blocks cite illustrative source files, never a real client or measured runtime. '+input.provenance;
input.privateNotes='SYNTHETIC_PRIVATE_OVERNIGHT_NOTE';
input.blocks.push({id:'private-demo-note',type:'text',title:'Private synthetic working note',text:'SYNTHETIC_PRIVATE_OVERNIGHT_BLOCK',provenance:'synthetic',sourceIds:[],visibility:'private'});
input.nodes[0].blockIds.push('private-demo-note');
const document=validateDocument(input),publicDoc=publicDocument(document);
if(document.observations.length)throw new Error('Synthetic demo must not have observations');
const write=(name:string,value:string|Uint8Array)=>writeFileSync(join(output,name),value);
const json=(name:string,value:unknown)=>write(name,JSON.stringify(value,null,2)+'\n');
json('authoring.private.json',document);json('public.json',publicDoc);json('scan-report.json',scan.report);
write('interactive.html',portfolioHtml(document));write('manual.html',technicalManualHtml(document,{now}));
for(const view of publicDoc.views){write(view.id+'.svg',svgDiagram(document,view.id));write(view.id+'.editorial.svg',editorialSvg(document,view.id,now));}
const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.title=document.title;
await addArchitectureSlides(pptx,publicDoc,{cover:true,evidence:true,sources:true,realization:true,firstViewSlide:2});
write('editable.pptx',await pptx.write({outputType:'nodebuffer'}) as Uint8Array);
const selection={projectId:document.id,baseRevision:document.revision,viewId:document.rootViewId};
json('preview.public.packet.json',await prepareConceptPreview(document,selection,{audience:'public',now}));
json('preview.author.private.packet.json',await prepareConceptPreview(document,selection,{audience:'author',now}));
const optional:{state:string;reason?:string;editorialSlides?:number}={state:print?'REQUESTED':'NOT_RUN',reason:print?undefined:'Pass --print to use installed Chromium for PDF and editorial deck rasterization.'};
if(print){
 const {chromium}=await import('@playwright/test');
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 try{
  const context=await browser.newContext({offline:true}),page=await context.newPage();const blocked:string[]=[];
  await page.route('**/*',r=>{if(/^(data|about):/.test(r.request().url()))return r.continue();blocked.push(r.request().url());return r.abort();});
  await page.setContent(technicalManualHtml(document,{now}),{waitUntil:'load'});await page.emulateMedia({media:'print'});
  write('manual.pdf',await page.pdf({format:'A4',printBackground:true}));
  const deck=await buildDesignDeck(PptxGenJS,document,{theme:'editorial',type:'architecture',now,raster:async svg=>{
   await page.emulateMedia({media:'screen'});await page.setContent('<!doctype html><style>html,body{margin:0;background:white}svg{display:block}</style>'+svg);
   return 'data:image/png;base64,'+(await page.locator('svg').screenshot()).toString('base64');
  }});
  write('editorial.pptx',await deck.pptx.write({outputType:'nodebuffer'}) as Uint8Array);
  if(blocked.length)throw new Error('Offline export attempted network access');
  optional.state='PASS';optional.editorialSlides=deck.slides;
 }finally{await browser.close();}
}
const hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const powerpoints:{file:string;slides:number;nativeShapes:number;crcChecked:boolean}[]=[];
for(const file of readdirSync(output).filter(f=>f.endsWith('.pptx'))){
 const zip=await JSZip.loadAsync(readFileSync(join(output,file)),{checkCRC32:true});let slides=0,nativeShapes=0;
 for(const [name,part] of Object.entries(zip.files)){
  if(!/\.xml$/.test(name))continue;const text=await part.async('string');
  if(text.includes('SYNTHETIC_PRIVATE_OVERNIGHT'))throw new Error('Private sentinel leaked into '+file+':'+name);
  if(/^ppt\/slides\/slide\d+\.xml$/.test(name)){slides++;nativeShapes+=(text.match(/<p:sp>/g)||[]).length;}
 }
 if(!slides||(file==='editable.pptx'&&!nativeShapes))throw new Error('PowerPoint is missing its intended content');
 powerpoints.push({file,slides,nativeShapes,crcChecked:true});
}
for(const file of readdirSync(output).filter(f=>!f.includes('private')&&!f.endsWith('.pptx'))){
 if(readFileSync(join(output,file),'utf8').includes('SYNTHETIC_PRIVATE_OVERNIGHT'))throw new Error('Public export leaked the private sentinel: '+file);
}
const artifacts=readdirSync(output).map(file=>({file,bytes:readFileSync(join(output,file)).length,sha256:hash(readFileSync(join(output,file))),audience:file.includes('private')?'private':'public'}));
json('READY.json',{diagnostic:'Local synthetic demo artifact manifest; not a registered interchange format or verification receipt',state:'LOCAL_CANDIDATE',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:'modified; not an exact-commit qualification',generatedAt:new Date().toISOString(),presentationDate:now.toISOString(),generatorSHA256:hash(readFileSync(resolve('scripts/overnight-demo.ts'))),fixture:relative(resolve('.'),fixture).replaceAll('\\','/'),synthetic:true,observations:0,sourceFiles:files.map(f=>({path:f.path,sha256:hash(f.text),lines:f.text.split(/\r?\n/).length})),sources:'Every non-metadata scanner evidence reference was checked against selected source lines.',exports:optional,powerpoints,artifacts,limits:['No real-client qualification','Direct Mosaic viewer picking is not claimed','Editable and editorial PowerPoint require visual inspection separately','PDF is a Chromium print of the public technical manual']});
process.stdout.write(JSON.stringify({output,views:publicDoc.views.length,nodes:publicDoc.nodes.length,artifacts:artifacts.length,exports:optional})+'\n');
