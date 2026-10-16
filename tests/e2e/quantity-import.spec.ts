import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {validateDocument} from '../../src/core/model';

const drawio=`<mxfile><diagram id="quantities" name="Synthetic declared quantities"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Synthetic input" vertex="1" parent="1"><mxGeometry x="20" y="20" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="b" value="Synthetic output" vertex="1" parent="1"><mxGeometry x="350" y="20" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="zero" value="Explicit synthetic zero" edge="1" source="a" target="b" parent="1" style="dcQuantity=0;dcUnit=ms;dcProvenance=synthetic;dcQuantityNote=Explicit%20synthetic%20zero%3B%20not%20measured.;"><mxGeometry relative="1" as="geometry"/></mxCell>
<mxCell id="empty" value="Unprovided synthetic quantity" edge="1" source="a" target="b" parent="1" style="dcQuantity=   ;dcUnit=ms;dcProvenance=synthetic;"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;
async function current(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const p=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return p;}
async function preview(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(drawio);await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();}

test('draw.io quantity loss is reviewed without mutation; explicit synthetic zero survives public export',async({page},info)=>{
 await page.goto('/');const before=await current(page);await preview(page);
 const report=page.getByRole('dialog');await expect(report).toContainText(/invalid.*quantity|quantity.*invalid/i);await report.screenshot({path:info.outputPath('quantity-import-review.png')});
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await current(page)).toEqual(before);
 await preview(page);await page.getByRole('button',{name:'Apply imported document',exact:true}).click();const after=await current(page);
 expect(after.edges).toHaveLength(2);expect(after.edges.find(e=>e.label==='Unprovided synthetic quantity')?.quantity).toBeUndefined();
 expect(after.edges.find(e=>e.label==='Explicit synthetic zero')?.quantity).toEqual({value:0,unit:'ms',provenance:'synthetic',note:'Explicit synthetic zero; not measured.'});expect(after.observations).toEqual([]);
 await page.getByRole('button',{name:'Export & share',exact:true}).click();const waiting=page.waitForEvent('download');await page.getByRole('button',{name:/^Public JSON/}).click();const file=await waiting,target=info.outputPath('quantity-import.public.json');await file.saveAs(target);const exported=validateDocument(JSON.parse(readFileSync(target,'utf8')));
 expect(exported.edges.find(e=>e.label==='Explicit synthetic zero')?.quantity).toEqual(after.edges.find(e=>e.label==='Explicit synthetic zero')?.quantity);expect(exported.edges.find(e=>e.label==='Unprovided synthetic quantity')?.quantity).toBeUndefined();expect(exported.observations).toEqual([]);
});
