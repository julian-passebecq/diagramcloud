import {test,expect} from '@playwright/test';

test('connection quantity: set in the connection editor, drawn by the Sankey figure with its provenance, cleared again',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('.project-card').filter({hasText:'Contoso Forecasting'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const set=async(i:number,value:string,provenance:string)=>{
  await page.locator('.react-flow__edge').nth(i).click({force:true});
  const editor=page.locator('.inspector').filter({hasText:'CONNECTION EDITOR'});await expect(editor).toBeVisible();
  await editor.getByLabel('Value',{exact:true}).fill(value);await editor.getByLabel('Unit',{exact:true}).fill('rows/day');await editor.getByLabel('Where it comes from').selectOption(provenance);
  await editor.getByRole('button',{name:'Apply connection'}).click();};
 await set(0,'1200','synthetic');await set(1,'800','synthetic');
 await page.getByRole('button',{name:'Diagram Design',exact:true}).click();
 const figure=page.getByTestId('design-preview').locator('img.design-figure');
 await expect(page.getByLabel('Suggested figures').getByRole('button').first()).toHaveText(/Sankey/);
 await page.getByLabel('Figure type').selectOption('sankey');await expect(figure).toHaveAttribute('data-design-type','sankey');
 const svg=await figure.evaluate(async(i:HTMLImageElement)=>(await fetch(i.src)).text());
 expect(svg).toMatch(/SYNTHETIC/);expect(svg).toContain('1200 rows/day');expect(svg).toContain('data-dd-provenance="synthetic"');expect(svg).not.toMatch(/no connection quantities/i);
 // A value needs a unit: the form refuses to apply without one.
 await page.getByRole('button',{name:'Diagram Design',exact:true}).click();
 await page.locator('.react-flow__edge').nth(0).click({force:true});const editor=page.locator('.inspector').filter({hasText:'CONNECTION EDITOR'});
 await editor.getByLabel('Unit',{exact:true}).fill('');await editor.getByRole('button',{name:'Apply connection'}).click();
 expect(await editor.getByLabel('Unit',{exact:true}).evaluate((i:HTMLInputElement)=>i.validity.valueMissing)).toBe(true);
 await page.screenshot({path:'test-results/quantity/editor.png'});
 expect(errors).toEqual([]);
});
