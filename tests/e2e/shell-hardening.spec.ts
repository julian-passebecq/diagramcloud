import {test,expect,type Page} from '@playwright/test';

// R970: the three probes from the R958 review. The floor plan is bundled into the shell script, so each probe is put
// into that bundled text on its way to the browser (no quotes or backticks, so it fits any JS string literal).
const OUTSIDE='probe.invalid';
const PROBE='<style>body{background:red} svg{background-image:url(https://'+OUTSIDE+'/css.png)}</style>'
 +'<image href=https://'+OUTSIDE+'/img.png width=9 height=9 /><a id=probe-link xlink:href=https://'+OUTSIDE+'/a><text>link</text></a>';

async function withProbe(page:Page){
 const outside:string[]=[];
 await page.context().route(u=>u.hostname===OUTSIDE,r=>{outside.push(r.request().url());return r.abort();});
 await page.route(/\/assets\/shell-[^/]*\.js$/,async r=>{
  const body=(await (await r.fetch()).text()).replace('small flat</title>','small flat</title>'+PROBE);
  await r.fulfill({body,contentType:'text/javascript'});
 });
 await page.goto('/shell.html');
 await page.getByRole('navigation',{name:'Diagrams'}).getByRole('button',{name:'floor-plan.svg'}).click();
 await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'Kitchen'})).toBeVisible();
 return outside;
}

test('a <style> in a diagram styles the diagram only, never the shell', async ({page}) => {
 await withProbe(page);
 await expect(page.locator('.sh-diagram svg')).toBeVisible();
 expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 0, 0)');
 expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.sh-left')!).backgroundColor)).not.toBe('rgb(255, 0, 0)');
});

test('a diagram cannot fetch from outside: image href, link href and CSS url() are dropped', async ({page}) => {
 const outside=await withProbe(page);
 await page.waitForTimeout(500);
 expect(outside).toEqual([]);
 await expect(page.locator('#probe-link')).not.toHaveAttribute('xlink:href',/./);
 await expect(page.locator('.sh-diagram image')).not.toHaveAttribute('href',/./);
});

test('Open raw file shows the source as plain text and runs nothing from it', async ({page}) => {
 // Context-wide, so the raw-file tab (a new page) gets the probe too.
 await page.context().route(/\/assets\/floor-plan[^/]*\.svg$/,r=>r.fulfill({contentType:'image/svg+xml',
  body:'<svg xmlns="http://www.w3.org/2000/svg" onload="localStorage.setItem(\'r970-probe\',\'ran\')"/>'}));
 await page.goto('/shell.html');
 await page.getByRole('navigation',{name:'Diagrams'}).getByRole('button',{name:'floor-plan.svg'}).click();
 const popup=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Open raw file'}).click();
 const raw=await popup;
 await raw.waitForLoadState();
 expect(await page.evaluate(()=>localStorage.getItem('r970-probe'))).toBeNull();
 await expect(raw).toHaveURL(/^blob:/);
 await expect(raw.locator('body')).toContainText('<title>Sample floor plan: small flat</title>');
});

test('Rename group keeps markup as text, in the page, after switching back and in Save as', async ({page}) => {
 const dialogs:string[]=[];
 await page.goto('/shell.html');
 const nav=page.getByRole('complementary',{name:'Navigation'});
 const tree=page.getByRole('navigation',{name:'Diagrams'});
 await tree.getByRole('button',{name:'floor-plan.svg'}).click();
 await nav.getByRole('button',{name:'Kitchen'}).click();
 const evil='"><img src=x onerror=alert(1)>';
 page.on('dialog',d=>{if(d.type()==='prompt')return d.accept(evil);dialogs.push(d.message());return d.dismiss();});
 await page.getByRole('button',{name:'Rename group'}).click();
 await expect(nav.getByRole('button',{name:evil})).toBeVisible();
 await expect(page.locator('#kitchen > title')).toHaveText(evil);
 await tree.getByRole('button',{name:'architecture.svg'}).click();
 await tree.getByRole('button',{name:'floor-plan.svg'}).click();
 await expect(page.locator('#kitchen > title')).toHaveText(evil);
 await expect(page.locator('.sh-diagram img')).toHaveCount(0);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Save as'}).click();
 const text=await (await (await download).createReadStream()).toArray().then(c=>Buffer.concat(c).toString('utf8'));
 expect(text).toContain('<title>"&gt;&lt;img src=x onerror=alert(1)&gt;</title>');
 expect(text).not.toContain('<img');
 expect(dialogs).toEqual([]);
});
