import {test,expect,type Page} from '@playwright/test';
import {writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createServer} from 'vite';

// R1006: while `npm run dev` runs, a file written, changed or deleted in diagrams/ shows in the shell without a reload.
const NAME=`e2e-live-${process.pid}.svg`;
const FILE=join(process.cwd(),'diagrams',NAME);
const svg=(title:string,group:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><title>${title}</title><g id="${group.toLowerCase()}"><title>${group}</title><rect x="10" y="10" width="80" height="40" fill="#cde"/><text x="20" y="35">${group}</text></g><script>document.title="ran"</script></svg>`;
const centre=(page:Page)=>page.evaluate(()=>document.querySelector('.sh-canvas .sh-diagram')?.shadowRoot?.querySelector('svg>title')?.textContent??null);

test('a diagram written into diagrams/ appears live, a change redraws the open centre, a delete is named removed',async({page})=>{
 test.setTimeout(120000);
 const dev=await createServer({logLevel:'silent',server:{host:'127.0.0.1',port:0,strictPort:false}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await dev.listen();
  const port=(dev.httpServer!.address() as {port:number}).port;
  await page.goto(`http://127.0.0.1:${port}/shell.html`);
  const tree=page.getByRole('navigation',{name:'Diagrams'});
  const nav=page.getByRole('complementary',{name:'Navigation'});
  const output=page.getByRole('contentinfo',{name:'Output'});
  await expect(nav.getByRole('button',{name:'API gateway'})).toBeVisible({timeout:60000});
  await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('/@vite/client')));
  await page.waitForTimeout(500); // the HMR socket is open
  await page.evaluate(()=>{(window as unknown as {marker:number}).marker=1;}); // gone if the page reloads

  writeFileSync(FILE,svg('Agent demo one','Inbox'));
  await expect(tree.getByRole('button',{name:NAME})).toBeVisible({timeout:2000});
  await expect(output).toContainText(new RegExp(`\\d\\d:\\d\\d:\\d\\d added diagrams/${NAME}`));
  await tree.getByRole('button',{name:NAME}).click();
  await expect.poll(()=>centre(page)).toBe('Agent demo one');
  await expect(nav.getByRole('button',{name:'Inbox'})).toBeVisible();

  writeFileSync(FILE,svg('Agent demo two','Outbox'));
  await expect.poll(()=>centre(page),{timeout:2000}).toBe('Agent demo two');
  await expect(nav.getByRole('button',{name:'Outbox'})).toBeVisible();
  await expect(output).toContainText(`updated diagrams/${NAME} (the open diagram: redrawn)`);
  await expect(tree.getByRole('treeitem',{selected:true})).toHaveText(NAME); // the selection survived
  // Still sanitised into its own shadow root: the file's script was removed and never ran.
  expect(await page.evaluate(()=>!!document.querySelector('.sh-canvas .sh-diagram')?.shadowRoot?.querySelector('script'))).toBe(false);
  expect(await page.title()).not.toBe('ran');

  unlinkSync(FILE);
  await expect(tree.getByRole('button',{name:NAME})).toHaveCount(0,{timeout:2000});
  await expect(output).toContainText(`removed diagrams/${NAME} (the open diagram: removed from the folder)`);
  await expect(page.getByRole('main',{name:'Diagram'})).toContainText(`diagrams/${NAME} was removed from the folder.`);
  // Written again under the same name: back in the tree and, still selected, redrawn (its old module must not reload the page).
  writeFileSync(FILE,svg('Agent demo three','Archive'));
  await expect.poll(()=>centre(page),{timeout:2000}).toBe('Agent demo three');
  await expect(output).toContainText(new RegExp(`added diagrams/${NAME}[\\s\\S]*removed diagrams/${NAME}[\\s\\S]*\\d\\d:\\d\\d:\\d\\d added diagrams/${NAME}`));
  expect(await page.evaluate(()=>(window as unknown as {marker?:number}).marker)).toBe(1); // no reload at any step
  expect(errors).toEqual([]);
 }finally{
  if(existsSync(FILE))unlinkSync(FILE);
  await dev.close();
 }
});
