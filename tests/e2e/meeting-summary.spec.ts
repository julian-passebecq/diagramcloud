import {test,expect,type Page} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildReviewWorkspace} from '../../examples/review-workspace/build';
import {meetingSummaryFile,meetingSummaryModel} from '../../src/export/meetingSummary';
import {planMeetingSummaryDeck} from '../../src/export/meetingSummaryPptx';
import {validateDocument,type Project} from '../../src/core/model';
import type {PublicationBrief} from '../../src/intelligence/publicationBrief';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import JSZip from 'jszip';

// Playwright compiles JSX for component testing, so the form's static markup is rendered by tsx in a child process.
function dialogMarkup(){
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const code="import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MeetingSummaryDialog} from './src/ui/MeetingSummaryDialog';import {buildReviewWorkspace} from './examples/review-workspace/build';process.stdout.write(renderToStaticMarkup(createElement(MeetingSummaryDialog,{project:buildReviewWorkspace().project,activeViewId:'overview',onDone(){},onCancel(){}})));";
 const out=spawnSync(process.execPath,[root+'node_modules/tsx/dist/cli.mjs','-e',code],{cwd:root,encoding:'utf8',timeout:30000});
 if(out.status!==0)throw new Error(out.stderr);return out.stdout;
}

// Offline: the meeting summary file is loaded with page.setContent and every request is aborted and recorded.
const f=buildReviewWorkspace();
const file=meetingSummaryFile(f.project,{...f.brief,viewIds:['overview','join-detail','contract'],detail:'standard'},new Date('2026-10-19T00:00:00Z'));
async function offline(page:Page){
 const errors:string[]=[],requests:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('data:'))requests.push(r.url());});
 await page.route('**/*',r=>r.abort());
 return {errors,requests};
}
for(const width of [1440,390])test.describe(`meeting summary at ${width}`,()=>{
 test.use({viewport:{width,height:900},reducedMotion:'reduce'});
 test('glossary links move focus, print shows no clipped figure, no request, no page error',async({page})=>{
  const {errors,requests}=await offline(page);
  await page.setContent(file.html);
  await expect(page.locator('script')).toHaveCount(0);
  const glossary=page.getByRole('navigation',{name:'Summary glossary'});
  const links=glossary.getByRole('link');const count=await links.count();expect(count).toBe(4);
  for(let i=0;i<count;i++){
   const link=links.nth(i),hash=(await link.getAttribute('href'))!;
   await link.focus();await page.keyboard.press('Enter');
   // Activating a glossary entry moves keyboard focus to its section, not only the scroll position.
   await expect.poll(()=>page.evaluate(()=>document.activeElement?.id??'')).toBe(hash.slice(1));
  }
  // Component links reach their evidence block the same way.
  const evidence=page.locator('a[href="#block-order-join.rules"]').first();await evidence.focus();await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.id??'')).toBe('block-order-join.rules');
  await expect(page.locator('#block-order-join\\.rules')).toContainText('Measure after');
  await expect(page.locator('.synthetic').first()).toHaveText('Synthetic example data, not a measured result.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);

  await page.emulateMedia({media:'print'});
  const clipped=await page.evaluate(()=>{
   const problems:string[]=[];const main=document.querySelector('main')!.getBoundingClientRect();
   for(const figure of document.querySelectorAll<HTMLElement>('.figure')){
    const style=getComputedStyle(figure),svg=figure.querySelector('svg');
    if(style.overflow==='hidden'||style.overflow==='clip')problems.push('figure overflow '+style.overflow);
    if(!svg){problems.push('figure without svg');continue;}
    const box=svg.getBoundingClientRect();
    if(box.width<1||box.height<1)problems.push('empty figure');
    if(box.left<main.left-1||box.right>main.right+1)problems.push('figure wider than the page');
    if(figure.scrollWidth>figure.clientWidth+1||figure.scrollHeight>figure.clientHeight+1)problems.push('figure content exceeds its box');
   }
   for(const wrap of document.querySelectorAll<HTMLElement>('.table-wrap'))if(getComputedStyle(wrap).overflow!=='visible')problems.push('table clipped in print');
   return {problems,figures:document.querySelectorAll('.figure').length};
  });
  expect(clipped.figures).toBe(3);expect(clipped.problems).toEqual([]);
  expect(requests).toEqual([]);expect(errors).toEqual([]);
 });
});
test.describe('meeting summary form at 390',()=>{
 test.use({viewport:{width:390,height:844},reducedMotion:'reduce'});
 test('every field is reached by Tab alone, labelled, without horizontal scroll',async({page})=>{
  const {errors,requests}=await offline(page);
  const markup=dialogMarkup();
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;font:15px system-ui">${markup}</body></html>`);
  const form=page.getByRole('form',{name:'Meeting summary'});await expect(form).toBeVisible();
  for(const name of ['Title','Audience'])await expect(form.getByRole('textbox',{name})).toBeVisible();
  await expect(form.getByRole('checkbox',{name:'Business question and data path'})).toBeChecked();
  await expect(form.getByText('Browser print gives the PDF, on A4 or Letter',{exact:false})).toBeVisible();
  await expect(form.getByRole('radio',{name:'Web page (HTML), offline'})).toBeChecked();
  // Static markup: Tab order is the document order; radio groups take one stop each.
  const reached:string[]=[];
  for(let i=0;i<14;i++){
   await page.keyboard.press('Tab');
   const name=await page.evaluate(()=>{const e=document.activeElement as HTMLElement|null;if(!e||e===document.body)return 'BODY';const label=e.closest('label')?.textContent?.trim()??e.textContent?.trim()??'';return e.tagName.toLowerCase()+':'+label.slice(0,40);});
   reached.push(name);if(name.startsWith('button:Cancel'))break;
  }
  expect(reached).not.toContain('BODY');
  expect(reached[0]).toMatch(/^input:Title/);expect(reached[1]).toMatch(/^input:Audience/);
  expect(reached).toContain('button:Download meeting summary');expect(reached.at(-1)).toBe('button:Cancel');
  expect(reached).toContain('input:Web page (HTML), offline');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(requests).toEqual([]);expect(errors).toEqual([]);
 });
});

/** Minimal text extraction for Chromium (Skia) PDFs: plain objects, Type0 fonts named /F<object number> with a
 * ToUnicode CMap, glyph codes as 4-digit hex strings in Tj/TJ. Enough to read what a printed page says. */
function pdfText(buf:Buffer){
 const s=buf.toString('latin1'),objects=new Map<number,{dict:string;stream?:Buffer}>();
 for(const m of s.matchAll(/(\d+) 0 obj\b/g)){
  const start=m.index!+m[0].length,end=s.indexOf('endobj',start),body=s.slice(start,end),at=body.search(/stream\r?\n/);
  if(at<0){objects.set(Number(m[1]),{dict:body});continue;}
  const from=start+at+body.slice(at).match(/stream\r?\n/)![0].length,to=s.lastIndexOf('endstream',end),raw=buf.subarray(from,to);
  let stream=raw;if(/\/FlateDecode/.test(body.slice(0,at)))try{stream=inflateSync(raw);}catch{stream=Buffer.alloc(0);}
  objects.set(Number(m[1]),{dict:body.slice(0,at),stream});
 }
 const utf16=(hex:string)=>{let out='';for(let i=0;i+4<=hex.length;i+=4)out+=String.fromCharCode(parseInt(hex.slice(i,i+4),16));return out;};
 const maps=new Map<number,Map<string,string>>();
 for(const [id,o] of objects){const ref=/\/ToUnicode (\d+) 0 R/.exec(o.dict);if(!ref)continue;const cmap=objects.get(Number(ref[1]))?.stream?.toString('latin1')??'',map=new Map<string,string>();
  for(const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))for(const p of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g))map.set(p[1].toUpperCase(),utf16(p[2]));
  for(const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))for(const r of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g)){
   const lo=parseInt(r[1],16),hi=parseInt(r[2],16),list=r[4]?[...r[4].matchAll(/<([0-9A-Fa-f]+)>/g)].map(x=>x[1]):null;
   for(let c=lo;c<=hi;c++){const key=c.toString(16).toUpperCase().padStart(r[1].length,'0');map.set(key,list?utf16(list[c-lo]??''):String.fromCharCode(parseInt(r[3]!.slice(-4),16)+c-lo));}}
  maps.set(id,map);}
 let text='';
 for(const o of objects.values()){
  if(!o.stream||/\/Subtype|\/Type|\/Length1/.test(o.dict))continue;const content=o.stream.toString('latin1');if(!/\bBT\b/.test(content))continue;
  let font=new Map<string,string>();
  for(const t of content.matchAll(/\/F(\d+) [\d.]+ Tf|\[([^\]]*)\]\s*TJ|<([0-9A-Fa-f]*)>\s*Tj|\bET\b/g)){
   if(t[1])font=maps.get(Number(t[1]))??new Map();
   else if(t[0]==='ET')text+='\n';
   else{const hexes=t[2]!==undefined?[...t[2].matchAll(/<([0-9A-Fa-f]*)>/g)].map(x=>x[1]):[t[3]];for(const h of hexes)for(let i=0;i+4<=h.length;i+=4)text+=font.get(h.slice(i,i+4).toUpperCase())??'';}
  }
 }
 return text;
}
const pdfFacts=(buf:Buffer)=>{const s=buf.toString('latin1');return {pages:(s.match(/\/Type\s*\/Page[^s]/g)??[]).length,boxes:[...new Set([...s.matchAll(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m=>`${Math.round(Number(m[1]))}x${Math.round(Number(m[2]))}`))],title:/\/Title \(([^)]*)\)/.exec(s)?.[1]};};
const squash=(t:string)=>t.replace(/\s+/g,'');
const PAGE_SIZE={A4:'595x842',letter:'612x792'} as const;

// The private component is imported with the project; it must never reach the HTML, the PDF or the PPTX.
const PRIVATE_LABEL='SYNTHETIC_MEETING_PRIVATE_COMPONENT';
function privateFixture(){
 const r=buildReviewWorkspace(),d=structuredClone(r.project),join=d.nodes.find(n=>n.id==='join')!;
 d.nodes.push({...structuredClone(join),id:'private.meeting',label:PRIVATE_LABEL,summary:PRIVATE_LABEL+' summary',visibility:'private',blockIds:[]});
 d.views[0].nodeIds.push('private.meeting');d.views[0].positions['private.meeting']={x:990,y:0};
 return {project:validateDocument(d),brief:r.brief};
}

for(const paper of ['A4','letter'] as const)test.describe(`meeting summary PDF on ${paper}`,()=>{
 test.use({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 test('browser print from the summary print stylesheet: page size, page count and printed text',async({page},info)=>{
  const {errors,requests}=await offline(page),fx=privateFixture();
  const brief={...fx.brief,paper,detail:'standard' as const,viewIds:['overview','join-detail','contract']};
  const html=meetingSummaryFile(fx.project,brief,new Date('2026-10-19T00:00:00Z')).html;
  expect(html).toContain(`@page{size:${paper};`);expect(html).not.toContain(PRIVATE_LABEL);
  await page.setContent(html);
  const pdf=await page.pdf({path:info.outputPath(`meeting-summary-${paper}.pdf`),preferCSSPageSize:true,printBackground:true});
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  const facts=pdfFacts(pdf);
  expect(facts.boxes).toEqual([PAGE_SIZE[paper]]);expect(facts.title).toBe(brief.title);
  // Header page, one page per selected view (break-before), the evidence section: at least five pages.
  expect(facts.pages).toBeGreaterThanOrEqual(5);
  expect(pdfFacts(await page.pdf({preferCSSPageSize:true,printBackground:true})).pages,'same page count on a second print').toBe(facts.pages);
  const text=squash(pdfText(pdf));
  for(const phrase of [brief.title,'Question and scope','Business question and data path','Input, join and output','Choose the intended semantics','Selected supporting evidence','Synthetic example data, not a measured result.','Measure after','Sources and limits','Public content only.'])expect(text,phrase).toContain(squash(phrase));
  expect(text).not.toContain(squash(PRIVATE_LABEL));
  expect(requests).toEqual([]);expect(errors).toEqual([]);
 });
});

const LOOPBACK=/^(?:https?|wss?):\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//i;
async function importProject(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function openForm(page:Page){
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 await page.getByRole('button',{name:/^Meeting summary/}).click();
 const form=page.getByRole('form',{name:'Meeting summary'});await expect(form).toBeVisible();return form;
}
for(const width of [1440,390])test.describe(`meeting summary formats from the App at ${width}`,()=>{
 test.use({reducedMotion:'reduce'});
 test('PowerPoint downloads from the dialog; PDF prints the same public summary on the chosen paper',async({page},info)=>{
  test.setTimeout(120000);
  const attempted:string[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.context().route('**/*',route=>{const url=route.request().url();if(LOOPBACK.test(url)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();attempted.push(url);return route.abort('internetdisconnected');});
  await page.setViewportSize({width:1440,height:1000});
  const fx=privateFixture();
  await page.goto('/?workspace=v3');await importProject(page,fx.project);
  const before=await page.evaluate(()=>document.title);
  await page.setViewportSize(width===390?{width:390,height:844}:{width:1440,height:1000});

  // PowerPoint: all three public views, full detail.
  let form=await openForm(page);
  await form.getByLabel('Audience',{exact:true}).fill('Synthetic business owner and data engineer');
  for(const name of ['Business question and data path','Input, join and output','Choose the intended semantics'])await form.getByRole('checkbox',{name,exact:true}).check();
  await form.getByRole('radio',{name:'Full: all attached public evidence'}).check();
  await form.getByRole('radio',{name:'PowerPoint: editable shapes, text and tables'}).check();
  if(width===390)expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const pending=page.waitForEvent('download');await form.getByRole('button',{name:'Download meeting summary (PowerPoint)',exact:true}).click();const download=await pending;
  expect(download.suggestedFilename()).toBe('review-workspace-reference.meeting-summary.pptx');
  const buf=readFileSync((await download.path())!),zip=await JSZip.loadAsync(buf),names=Object.keys(zip.files);
  const slides=names.filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length;
  const brief:PublicationBrief={format:'diagramcloud.publication-brief/1',title:'Why the joined total changed - meeting summary',audience:'Synthetic business owner and data engineer',viewIds:['overview','join-detail','contract'],detail:'full',paper:'A4',profile:'design',storyIndices:[]};
  expect(slides).toBe(planMeetingSummaryDeck(meetingSummaryModel(fx.project,brief)).length);
  const xml=(await Promise.all(names.filter(n=>/\.(xml|rels)$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('\n');
  expect(xml).not.toContain(PRIVATE_LABEL);expect(xml).toContain('Synthetic example data, not a measured result.');expect(xml).toContain('Why the joined total changed - meeting summary');
  await expect(page.getByText(`Downloaded review-workspace-reference.meeting-summary.pptx (${slides} slides)`,{exact:false})).toBeVisible();

  // PDF: the same brief on Letter, printed by the browser from a script-free frame.
  form=await openForm(page);
  await form.getByLabel('Audience',{exact:true}).fill('Synthetic business owner and data engineer');
  await form.getByRole('radio',{name:'letter',exact:true}).check();
  await form.getByRole('radio',{name:'PDF: browser print on the chosen paper'}).check();
  // Record the print copy as it is attached: the frame is removed again once the browser reports afterprint.
  await page.evaluate(()=>{const w=window as unknown as {printCopies:{sandbox:string|null;srcdoc:string;removed:boolean}[]};w.printCopies=[];
   new MutationObserver(records=>{for(const r of records){for(const n of r.addedNodes)if(n instanceof HTMLIFrameElement&&n.id==='diagramcloud-meeting-print')w.printCopies.push({sandbox:n.getAttribute('sandbox'),srcdoc:n.srcdoc,removed:false});
    for(const n of r.removedNodes)if(n instanceof HTMLIFrameElement&&n.id==='diagramcloud-meeting-print')w.printCopies.at(-1)!.removed=true;}}).observe(document.body,{childList:true});});
  await form.getByRole('button',{name:'Print meeting summary to PDF',exact:true}).click();
  await expect(page.getByText('Opened the print dialog for',{exact:false})).toBeVisible();
  const copies=await page.evaluate(()=>(window as unknown as {printCopies:{sandbox:string|null;srcdoc:string;removed:boolean}[]}).printCopies);
  expect(copies).toHaveLength(1);expect(copies[0].sandbox).toBe('allow-same-origin allow-modals');
  // Headless Chromium completes print() at once and fires afterprint, so the copy is already removed; it never lingers.
  await expect(page.locator('iframe#diagramcloud-meeting-print')).toHaveCount(0);
  const printed=copies[0].srcdoc;
  expect(printed).toContain('@page{size:letter;');expect(printed).not.toContain(PRIVATE_LABEL);expect(printed).not.toMatch(/<script/i);
  const reader=await page.context().newPage();await reader.setContent(printed);
  const pdf=await reader.pdf({path:info.outputPath(`app-meeting-summary-${width}.pdf`),preferCSSPageSize:true,printBackground:true});await reader.close();
  expect(pdfFacts(pdf).boxes).toEqual([PAGE_SIZE.letter]);expect(squash(pdfText(pdf))).toContain(squash('Why the joined total changed - meeting summary'));expect(squash(pdfText(pdf))).not.toContain(squash(PRIVATE_LABEL));
  expect(await page.evaluate(()=>document.title)).toBe(before);
  expect(attempted).toEqual([]);expect(errors).toEqual([]);
 });
});
