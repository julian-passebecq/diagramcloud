import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {documentSchema,validateDocument} from '../../src/core/model';
import {checkConceptSpec} from '../contracts/mosaicstudio/schema';

test('concept export refuses an empty public view and preserves the author document',async({page})=>{
 const errors:string[]=[],downloads:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-private-concept',title:'Synthetic private concept',rootViewId:'root',edges:[],
  nodes:[{id:'app',label:'PRIVATE_CONCEPT_SENTINEL',visibility:'private'}],views:[{id:'root',title:'Root',nodeIds:['app']}]}));
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON').fill(JSON.stringify(doc));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const concept=page.getByRole('button',{name:/^MosaicStudio concept \(JSON\)/});await concept.click();
 await expect(page.getByRole('status').filter({hasText:'No components are available'})).toBeVisible();
 await expect(concept).toBeEnabled();expect(downloads).toEqual([]);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const after=JSON.parse(await page.getByLabel('Project JSON').inputValue());
 expect(after.nodes[0].label).toBe('PRIVATE_CONCEPT_SENTINEL');expect(after.nodes[0].visibility).toBe('private');expect(after.revision).toBe(doc.revision);
 expect(errors).toEqual([]);
});

test('concept download keeps public uncertainty and excludes private source data',async({page})=>{
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-public-concept',title:'Synthetic concept fixture',rootViewId:'root',
  nodes:[{id:'app',label:'App',sourceIds:['private-source']},{id:'store',label:'Store',kind:'storage'},{id:'secret',label:'PRIVATE_NODE_SENTINEL',visibility:'private'}],
  sources:[{id:'private-source',title:'PRIVATE_SOURCE_SENTINEL',visibility:'private'}],
  edges:[{id:'needs',source:'app',target:'store',kind:'dependency',label:'needs (possible)'}],
  views:[{id:'root',title:'Root',nodeIds:['app','store','secret'],edgeIds:['needs']}]}));
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON').fill(JSON.stringify(doc));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:/^MosaicStudio concept \(JSON\)/}).click();const file=await waiting;
 expect(await file.failure()).toBeNull();const text=readFileSync(await file.path(),'utf8'),spec=JSON.parse(text),checked=checkConceptSpec(spec);
 expect(checked.ok?[]:checked.issues).toEqual([]);expect(checked.warnings).toEqual([]);
 expect(text).not.toMatch(/PRIVATE_NODE_SENTINEL|PRIVATE_SOURCE_SENTINEL|private-source/);
 expect(spec.flows[0].kind).toBe('control');expect(spec.flows[0].label).toMatch(/^possible: dependency:/);
});
