import {test,expect} from '@playwright/test';

// R972: the sequence diagram, timeline and org chart templates open with their parts in the navigation.
const cases:[string,string,string[]][]=[
  ['Sequence diagram','my-sequence',['Client','Server','Data store','1. Request','2. Query','3. Rows','4. Response']],
  ['Timeline','my-timeline',['Axis','Kick-off','Design','First version','Review','Launch']],
  ['Org chart','my-org',['Links','Head','Team A','Team B','Member A1','Member A2','Member B1','Member B2']],
];
for(const [label,name,parts] of cases)test(`New from template: ${label} lists its parts in the navigation`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/shell.html');
  await page.getByRole('button',{name:'New from template'}).click();
  page.once('dialog',d=>d.accept(name));
  await page.getByRole('menu',{name:'Templates'}).getByRole('menuitem',{name:label}).click();
  await expect(page.getByRole('navigation',{name:'Diagrams'}).getByRole('treeitem',{selected:true})).toHaveText(`${name}.svg`);
  await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button')).toHaveText(parts);
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/r972-${name}.png`});
  expect(errors).toEqual([]);
});
