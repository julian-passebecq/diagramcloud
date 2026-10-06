import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import {visioFixture} from '../fixtures/interchange/visio';
import {validateCheatsheet} from '../contracts/atlasnote/validation.mjs';

/*
 * 1.1: draw.io and Mermaid imports become new, reviewed projects with a report of what was kept and dropped, and
 * the gallery filters to the cloud architecture references.
 */
mkdirSync('test-results/interchange',{recursive:true});
const openImport=async(page:Page)=>{await page.goto('/');await page.getByRole('button',{name:'Import draw.io / Mermaid / Visio',exact:true}).click();await expect(page.getByRole('dialog',{name:'JSON / AI workspace'})).toBeVisible();};

test('Mermaid pasted text: report, apply as a new project, survives a reload, open project untouched',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await openImport(page);
 await page.getByLabel('Project JSON').fill(`---
title: Checkout flow
---
flowchart LR
  shop([Web shop]) -->|order| api[Orders API]
  api --> db[(Orders DB)]
  subgraph async [Async work]
    api -.->|event| mail[[Mailer]]
  end
  classDef hot fill:#f00`);
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 const report=page.getByTestId('import-report');
 await expect(report).toContainText('Mermaid import');await expect(report).toContainText('4 boxes · 3 connections');
 await expect(report.getByRole('region',{name:'Not imported'})).toContainText('classDef');
 await expect(page.getByText('A new local project will be added.')).toBeVisible();
 await page.screenshot({path:'test-results/interchange/mermaid-report.png'});
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Checkout flow',exact:true,level:1})).toBeVisible();
 for(const label of ['Web shop','Orders API','Orders DB','Mailer'])await expect(page.getByRole('button',{name:`Explore ${label}`,exact:true}).or(page.getByRole('button',{name:label,exact:true})).first()).toBeVisible();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.locator('.project-card').filter({hasText:'Checkout flow'})).toBeVisible();
 await expect(page.locator('.project-card').filter({hasText:'TotalEnergies'})).toBeVisible();
 await page.locator('.project-card').filter({hasText:'Checkout flow'}).click();
 await expect(page.getByRole('heading',{name:'Checkout flow',exact:true,level:1})).toBeVisible();
 expect(errors).toEqual([]);
});

test('draw.io file: two pages become a root view of page cards that drill into each page',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await openImport(page);
 await page.getByLabel('Import document').setInputFiles('tests/fixtures/interchange/aws-serverless.drawio');
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 const report=page.getByTestId('import-report');
 await expect(report).toContainText('draw.io import');await expect(report).toContainText('aws-serverless.drawio');await expect(report).toContainText('2 pages');
 await expect(report.getByRole('region',{name:'Not imported'})).toContainText('without a box at both ends');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:'aws-serverless',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'Explore Serverless web app',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Lambda function',exact:true}).or(page.getByRole('button',{name:'Lambda function',exact:true})).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Explore Serverless web app',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/interchange/drawio-imported.png',fullPage:true});
 expect(errors).toEqual([]);
});

test('a non-architecture Mermaid diagram is refused with a message and nothing is staged',async({page})=>{
 await openImport(page);
 await page.getByLabel('Project JSON').fill('sequenceDiagram\n  A->>B: hello');
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('“sequenceDiagram” diagrams are not imported');
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
});

test('gallery: cloud architecture filter, a reference drilldown with the parent kept, and the what\'s-new card',async({page})=>{
 await page.goto('/');
 const news=page.getByRole('region',{name:"What's new"});await expect(news).toContainText('Import draw.io, Mermaid and Visio');
 await page.getByRole('button',{name:/^Cloud architectures/}).click();
 const cards=page.locator('.project-card');
 for(const title of ['AWS serverless web application','Azure web app with private data','Google Cloud streaming analytics','Microservices on Kubernetes','Event-driven orders with an outbox','Microsoft Fabric','Databricks','Contoso Forecasting'])await expect(cards.filter({hasText:title}).first()).toBeVisible();
 await expect(cards.filter({hasText:'TotalEnergies'})).toHaveCount(0);await expect(cards.filter({hasText:'Data Projects'})).toHaveCount(0);await expect(page.getByRole('button',{name:/^Cloud architectures 8/})).toBeVisible();
 await news.getByRole('button',{name:"Dismiss what's new"}).click();await expect(news).toHaveCount(0);
 await page.reload();await expect(page.getByRole('region',{name:"What's new"})).toHaveCount(0);
 await cards.filter({hasText:'AWS serverless web application'}).click();
 await expect(page.getByRole('heading',{name:'AWS serverless web application',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Explore Amazon API Gateway',exact:true}).click();
 await expect(page.getByTestId('view-overview')).toBeVisible();await expect(page.getByTestId('view-request-path')).toBeVisible();
 await page.screenshot({path:'test-results/interchange/gallery-aws.png',fullPage:true});
});

test('Visio .vsdx: converted on selection with its report, applied as a new project with page drilldowns',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await openImport(page);
 await page.getByLabel('Import document').setInputFiles({name:'network.vsdx',mimeType:'application/vnd.ms-visio.drawing',buffer:Buffer.from(visioFixture())});
 const report=page.getByTestId('import-report');
 await expect(report).toContainText('Visio import');await expect(report).toContainText('network.vsdx');await expect(report).toContainText('2 pages');
 await expect(report.getByRole('region',{name:'Not imported'})).toContainText('background page');
 await page.screenshot({path:'test-results/interchange/visio-report.png'});
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:'network',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'Explore Overview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Web app& API',exact:true}).or(page.getByRole('button',{name:'Explore Web app& API',exact:true})).first()).toBeVisible();
 await openImport(page);
 await page.getByLabel('Import document').setInputFiles({name:'old.vsd',mimeType:'application/vnd.visio',buffer:Buffer.from([0xd0,0xcf,0x11,0xe0,0,0,0,0])});
 await expect(page.getByRole('alert')).toContainText('older binary Visio format');
 expect(errors).toEqual([]);
});

test('draw.io export: every public view as a page, and the file imports back with the same components',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'AWS serverless web application'}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:/draw\.io diagram/}).click();
 const file=await wait;expect(file.suggestedFilename()).toBe('aws-serverless-web.drawio');await file.saveAs('test-results/interchange/aws-serverless.drawio');
 const xml=readFileSync('test-results/interchange/aws-serverless.drawio','utf8');
 expect(xml).toMatch(/^<\?xml/);expect((xml.match(/<diagram /g)??[]).length).toBe(2);expect(xml).toContain('link="data:page/id,');
 await expect(page.getByText(/draw\.io file created/)).toBeVisible();
 await page.keyboard.press('Escape');
 await openImport(page);
 await page.getByLabel('Import document').setInputFiles('test-results/interchange/aws-serverless.drawio');
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByTestId('import-report')).toContainText('draw.io import');
 await expect(page.getByTestId('import-report')).toContainText('page link(s) between them are drilldowns');
});

test('repository scan: a picked folder becomes system → containers → components → files, with evidence; a rescan is reviewed by stable ID',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('region',{name:"What's new"})).toContainText('Diagram from a repository');
 await page.getByLabel('Scan repository folder').setInputFiles('tests/fixtures/repo-shop');
 const report=page.getByTestId('import-report');
 await expect(report).toContainText('Repository scan');await expect(report).toContainText('repo-shop');
 await expect(report.getByRole('region',{name:'Kept'})).toContainText('docker-compose file');
 await expect(page.getByText('A new local project will be added.')).toBeVisible();
 await page.screenshot({path:'test-results/interchange/scan-report.png'});
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:'shop architecture (scanned)',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'Explore shop',exact:true}).click();
 await expect(page.getByTestId('view-containers')).toBeVisible();
 await page.getByRole('button',{name:'Explore api-client',exact:true}).click();
 const components=page.locator('[data-testid^="view-components-"]');await expect(components).toBeVisible();
 await expect(page.getByTestId('view-overview')).toBeVisible();
 await components.getByRole('button',{name:'Explore routes',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Scan evidence'}).first()).toBeVisible();
 await expect(page.getByRole('cell',{name:'apps/api/src/routes/orders.ts',exact:true}).first()).toBeVisible();
 await page.screenshot({path:'test-results/interchange/scan-drilldown.png',fullPage:true});
 // Scanning the same folder again targets the same project and goes through the change review.
 await page.getByRole('button',{name:'Project gallery',exact:true}).click();
 await page.getByLabel('Scan repository folder').setInputFiles('tests/fixtures/repo-shop');
 await expect(page.getByText('Existing project ID detected. Review the stable-ID diff below before applying.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();
 expect(errors).toEqual([]);
});

test('AtlasNote export: a cheatsheet file the AtlasNote validator accepts, one page per public view with diagram and table',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'AWS serverless web application'}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:/AtlasNote cheatsheet/}).click();
 const file=await wait;expect(file.suggestedFilename()).toBe('aws-serverless-web.atlasnote.json');await file.saveAs('test-results/interchange/aws-serverless.atlasnote.json');
 const sheet=validateCheatsheet(JSON.parse(readFileSync('test-results/interchange/aws-serverless.atlasnote.json','utf8')));
 expect(sheet.pages.filter((p:{id:string})=>p.id.startsWith('v.')).length).toBe(2);
 for(const p of sheet.pages.filter((p:{id:string})=>p.id.startsWith('v.')))expect(p.blocks.map((b:{type:string})=>b.type)).toEqual(expect.arrayContaining(['diagram','table']));
 await expect(page.getByText(/AtlasNote cheatsheet created/)).toBeVisible();
});
