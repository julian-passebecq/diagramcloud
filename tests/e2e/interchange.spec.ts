import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';

/*
 * 1.1: draw.io and Mermaid imports become new, reviewed projects with a report of what was kept and dropped, and
 * the gallery filters to the cloud architecture references.
 */
mkdirSync('test-results/interchange',{recursive:true});
const openImport=async(page:Page)=>{await page.goto('/');await page.getByRole('button',{name:'Import draw.io / Mermaid',exact:true}).click();await expect(page.getByRole('dialog',{name:'JSON / AI workspace'})).toBeVisible();};

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
 const news=page.getByRole('region',{name:"What's new"});await expect(news).toContainText('Import draw.io and Mermaid');
 await page.getByRole('button',{name:/^Cloud architectures/}).click();
 const cards=page.locator('.project-card');
 for(const title of ['AWS serverless web application','Azure web app with private data','Google Cloud streaming analytics','Microservices on Kubernetes','Event-driven orders with an outbox','Microsoft Fabric','Databricks'])await expect(cards.filter({hasText:title}).first()).toBeVisible();
 await expect(cards.filter({hasText:'TotalEnergies'})).toHaveCount(0);
 await news.getByRole('button',{name:"Dismiss what's new"}).click();await expect(news).toHaveCount(0);
 await page.reload();await expect(page.getByRole('region',{name:"What's new"})).toHaveCount(0);
 await cards.filter({hasText:'AWS serverless web application'}).click();
 await expect(page.getByRole('heading',{name:'AWS serverless web application',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Explore Amazon API Gateway',exact:true}).click();
 await expect(page.getByTestId('view-overview')).toBeVisible();await expect(page.getByTestId('view-request-path')).toBeVisible();
 await page.screenshot({path:'test-results/interchange/gallery-aws.png',fullPage:true});
});
