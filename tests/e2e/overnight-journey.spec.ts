import {test,expect,type Page} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import JSZip from 'jszip';
import {validateDocument,type Project} from '../../src/core/model';
import {checkConceptSpec} from '../contracts/mosaicstudio/schema';
import {startConceptHost,type LocalConceptHost} from '../../scripts/concept-host';

const fixture=resolve('tests/fixtures/overnight-workflow');
const sentinel='SYNTHETIC_PRIVATE_OVERNIGHT';
async function apply(page:Page){await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();}
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue());await page.getByRole('button',{name:'Close dialog',exact:true}).click();return validateDocument(doc);}
async function download(page:Page,button:string,file:string){const waiting=page.waitForEvent('download');await page.getByRole('button',{name:new RegExp('^'+button.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();const item=await waiting;expect(await item.failure()).toBeNull();await item.saveAs(file);return readFileSync(file);}

test('standalone synthetic source, evidence, annotation, reopen, Mosaic mapping and offline exports',async({page,browser},testInfo)=>{
 test.setTimeout(120000);mkdirSync('test-results/overnight-journey',{recursive:true});const output='test-results/overnight-journey/';
 await page.goto('/');await page.locator('.header-actions').getByRole('button',{name:'New analysis',exact:true}).click();
 await page.getByLabel('Analysis repository folder',{exact:true}).setInputFiles(fixture);await apply(page);
 await page.getByRole('button',{name:'Structure',exact:true}).click();
 const structure=page.getByLabel('Structure output',{exact:true});await expect(structure).toContainText('src/input/index.ts');
 // Missing targets remain outside the authorized source set; the UI cites the exact source line, not the unavailable path.
 const missingLine=readFileSync(resolve(fixture,'README.md'),'utf8').split(/\r?\n/).findIndex(line=>line.includes('docs/runtime-receipt.md'))+1;expect(missingLine).toBeGreaterThan(0);
 await expect(structure.getByRole('listitem').filter({hasText:`README.md:${missingLine} · unresolved: Relative link has no authorized target in the selected document set.`})).toBeVisible();
 await page.getByRole('button',{name:'Relationships',exact:true}).click();await expect(page.getByLabel('Relationships output',{exact:true}).getByRole('button').first()).toBeVisible();
 await page.getByRole('button',{name:'Evidence / gaps',exact:true}).click();await expect(page.getByLabel('Evidence output',{exact:true})).toContainText('static source');
 await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Explore Selected repository',exact:true}).first().click();
 const initial=await current(page),rootId=initial.views.find(v=>v.id===initial.rootViewId)!.nodeIds[0];
 await page.getByLabel('Component summary',{exact:true}).fill('Synthetic annotation: explain order admission; runtime and deployment remain unknown.');
 await page.getByRole('button',{name:'Apply component',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.goto('/?project='+encodeURIComponent(initial.id));await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const reopened=await current(page);expect(reopened.nodes.find(n=>n.id===rootId)?.summary).toContain('Synthetic annotation');expect(reopened.observations).toEqual([]);
 let citedLines=0;for(const block of reopened.blocks){if(block.type!=='table')continue;for(const row of block.rows){if(typeof row[0]!=='string'||!/^src\/(input|normalize|report)\/index\.ts$/.test(row[0])||typeof row[1]!=='number')continue;expect(row[1]).toBeGreaterThan(0);expect(row[1]).toBeLessThanOrEqual(readFileSync(resolve(fixture,row[0]),'utf8').split(/\r?\n/).length);citedLines++;}}expect(citedLines).toBeGreaterThan(0);
 // Explicit synthetic publication choice through the ordinary review UI. Keep generated acquisition context private.
 const publish=structuredClone(reopened);publish.title='Synthetic standalone workflow journey';publish.provenance='Synthetic fixture; source-derived import evidence is not runtime verification.';publish.privateNotes=sentinel+'_NOTE';
 for(const n of publish.nodes)n.visibility='public';for(const e of publish.edges)e.visibility='public';for(const v of publish.views)v.visibility='public';
 for(const b of publish.blocks)if(!b.id.startsWith('analysis-context-'))b.visibility='public';
 publish.nodes.push({...publish.nodes[0],id:'synthetic-private-note',label:sentinel+'_NODE',summary:'Private synthetic note',blockIds:[],sourceIds:[],visibility:'private',childViewId:undefined});
 const root=publish.views.find(v=>v.id===publish.rootViewId)!;root.nodeIds.push('synthetic-private-note');root.positions['synthetic-private-note']={x:900,y:0};
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(validateDocument(publish)));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await apply(page);
 const published=await current(page);expect(published.nodes.find(n=>n.id===rootId)?.summary).toContain('Synthetic annotation');
 await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Mosaic preview',exact:true}).click();
 await page.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download preview packet',exact:true})).toBeEnabled();
 const packet=JSON.parse((await download(page,'Download preview packet',output+'public.packet.json')).toString());
 expect(packet.audience).toBe('public');expect(JSON.stringify(packet)).not.toContain(sentinel);expect(checkConceptSpec(packet.projection.spec).ok).toBe(true);
 await page.getByLabel('Preview audience',{exact:true}).selectOption('author');await page.getByRole('button',{name:'Prepare Mosaic preview',exact:true}).click();
 const author=JSON.parse((await download(page,'Download preview packet',output+'author.private.packet.json')).toString());expect(author.audience).toBe('author');expect(JSON.stringify(author)).toContain(sentinel+'_NODE');
 const mapped=author.projection.report.nodes.find((n:{state:string;targetId?:string;sourceId:string})=>n.state!=='omitted'&&n.targetId&&n.sourceId===rootId);expect(mapped).toBeTruthy();
 expect([...new Set(author.projection.report.nodes.filter((n:{state:string;targetId?:string})=>n.state!=='omitted'&&n.targetId===mapped.targetId).map((n:{sourceId:string})=>n.sourceId))]).toEqual([rootId]);
 const viewer=process.env.DIAGRAMCLOUD_MOSAIC_VIEWER,viewerSha256=process.env.DIAGRAMCLOUD_MOSAIC_VIEWER_SHA256;
 if(viewer&&viewerSha256){
  let host:LocalConceptHost|undefined,preview:Page|undefined;
  try{
   host=await startConceptHost({document:published,viewId:author.viewId,audience:'author',viewerHtml:readFileSync(viewer),viewerSha256,packet:author,diagramcloudOrigin:new URL(page.url()).origin});
   const dialog=page.getByRole('dialog',{name:'Mosaic preview',exact:true});await dialog.getByText('Open the local viewer host',{exact:true}).click();await dialog.getByLabel('Local preview host URL',{exact:true}).fill(host.url);
   const opening=page.waitForEvent('popup');await dialog.getByRole('button',{name:'Connect local preview host',exact:true}).click();preview=await opening;
   await page.bringToFront();await expect(dialog.getByRole('status')).toContainText('Local host matched this projection');await preview.bringToFront();await expect(preview.locator('#status')).toHaveAttribute('data-result','accepted');
   const frame=preview.frameLocator('#viewer'),inner=frame.getByTestId('concept-viewer');
   await expect(inner).toHaveAttribute('data-spec',author.projection.spec.id);await expect(inner).toHaveAttribute('data-view','layered');await expect(frame.locator('[data-testid=concept-layered] svg')).toBeVisible();
   await preview.getByRole('button',{name:'Isometric 2D',exact:true}).click();await expect(inner).toHaveAttribute('data-view','isometric');await expect(frame.locator('[data-testid=concept-isometric] svg').first()).toBeVisible();
   await preview.getByRole('button',{name:'3D scene',exact:true}).click();await expect(frame.locator('canvas[data-renderer=concept-webgl2]')).toBeVisible();await expect(frame.locator('.aa-canvas')).toHaveAttribute('data-settled','true');
   await frame.locator('.aa-label[data-node='+JSON.stringify(mapped.targetId)+']').click();await expect(inner).toHaveAttribute('data-selection',new RegExp(mapped.targetId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   await preview.screenshot({path:output+'scanned-edited-owner-webgl-selected.png',fullPage:true});
   await expect(preview.getByText(/separate from selection inside the viewer/)).toBeVisible();
   await preview.locator('#mapping button[data-kind=node][data-target-id='+JSON.stringify(mapped.targetId)+']').click();
   await page.bringToFront();await expect(dialog).toHaveCount(0);
  }finally{
   try{if(preview&&!preview.isClosed())await preview.close();}finally{await host?.close();}
  }
 }else{
  testInfo.annotations.push({type:'nativeownerNOTRUN',description:'Native owner viewer was not explicitly selected with both DIAGRAMCLOUD_MOSAIC_VIEWER and DIAGRAMCLOUD_MOSAIC_VIEWER_SHA256. The ordinary source-to-export journey and UI mapping still run.'});
  await page.getByRole('button',{name:'Return to '+rootId,exact:true}).click();
 }
 await expect(page.getByRole('dialog',{name:'Mosaic preview',exact:true})).toHaveCount(0);await expect(page.getByLabel('Component summary',{exact:true})).toHaveValue(/Synthetic annotation/);
 expect(await current(page)).toEqual(published);
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const html=(await download(page,'Interactive HTML',output+'interactive.html')).toString();const svg=(await download(page,'SVG diagram',output+'diagram.svg')).toString();const pptx=await download(page,'Editable PowerPoint',output+'editable.pptx');
 for(const text of [html,svg]){expect(text).not.toContain(sentinel);expect(text).toContain('Synthetic');}
 const zip=await JSZip.loadAsync(pptx,{checkCRC32:true});let nativeShapes=0;for(const [name,file] of Object.entries(zip.files)){if(!/\.xml$/.test(name))continue;const text=await file.async('string');expect(text).not.toContain(sentinel);if(/^ppt\/slides\/slide\d+\.xml$/.test(name))nativeShapes+=(text.match(/<p:sp>/g)||[]).length;}expect(nativeShapes).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.screenshot({path:output+'edited-and-reopened.png',fullPage:true});
 const offline=await browser.newContext({offline:true}),view=await offline.newPage();let requests=0;await view.route('**/*',r=>{requests++;return r.abort();});await view.setContent(html);await expect(view.getByRole('heading',{name:'Synthetic standalone workflow journey',exact:true})).toBeVisible();expect(requests).toBe(0);await view.screenshot({path:output+'offline-public.png',fullPage:true});await offline.close();
});
