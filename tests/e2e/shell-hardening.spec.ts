import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

// R970: probes from the R958 and PR #172 reviews. The floor plan is bundled into the shell script, so each probe is put
// into that bundled text on its way to the browser, escaped so it fits any JS string literal.
const OUTSIDE='probe.invalid';
const H='https://'+OUTSIDE;
const PROBE='<style>body{background:red} svg{background-image:url('+H+'/css.png)}</style>'
 +'<image href='+H+'/img.png width=9 height=9 /><a id=probe-link xlink:href='+H+'/a><text>link</text></a>';
const jsLiteral=(text:string)=>text.replace(/[\\"'`]/g,m=>'\\'+m);

async function withProbe(page:Page,probe=PROBE){
 const outside:string[]=[];
 await page.context().route(u=>u.hostname===OUTSIDE,r=>{outside.push(r.request().url());return r.abort();});
 await page.route(/\/assets\/shell-[^/]*\.js$/,async r=>{
  const body=(await (await r.fetch()).text()).replace('small flat</title>','small flat</title>'+jsLiteral(probe));
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

// One probe per way around a rewriting filter (PR #172 review): each must reach no outside address.
const BYPASSES:Record<string,string>={
 'CSS comment':'<style>/* url(# */svg{background-image:url('+H+'/comment.png)}</style>',
 'CSS string':'<style>svg{--x:"url(#";background-image:url('+H+'/string.png)}</style>',
 'unclosed url( at end of input':'<style>svg{background-image:url('+H+'/unclosed.png</style>',
 'backslash escape':'<style>svg{background-image:ur\\l('+H+'/escape.png)}</style>',
 '@import reassembled after a removal':'<style>@im@import x;port "'+H+'/import.css";</style>',
 'image-set reassembled after a removal':'<style>svg{background-image:image-seimage(t("'+H+'/imageset.png" 1x)}</style>',
 'style attribute (comment, image-set)':'<rect x=120 width=50 height=50 style="filter:/* url(# */url('+H+'/attr-filter.svg#f);mask-image:image-set(\''+H+'/attr-mask.png\' 1x);cursor:/* url(# */url('+H+'/attr-cur.png),auto"/>',
};
for(const [family,probe] of Object.entries(BYPASSES))test(`no outside fetch through a ${family}`,async ({page}) => {
 const outside=await withProbe(page,probe);
 const box=await page.locator('main.sh-canvas').boundingBox();
 if(box)await page.mouse.move(box.x+box.width/2,box.y+box.height/2); // cursor rules load on hover
 await page.waitForTimeout(700);
 expect(outside).toEqual([]);
});

test('a diagram cannot paint over the shell: position:fixed stays inside the canvas', async ({page}) => {
 await withProbe(page,'<style>svg{position:fixed!important;left:0;top:0;width:100vw!important;height:100vh!important;z-index:2147483647}</style>');
 const top=await page.evaluate(()=>{const b=[...document.querySelectorAll('.sh-tools button')].find(x=>x.textContent==='Open raw file')!;
  const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;});
 expect(top).toBe(true);
});

test('the shell works under the Content-Security-Policy that vercel.json sends for shell.html', async ({page}) => {
 const rule=JSON.parse(readFileSync('vercel.json','utf8')).headers.find((h:{source:string})=>h.source.startsWith('/shell'));
 const csp=rule.headers.find((h:{key:string})=>h.key==='Content-Security-Policy').value;
 const violations:string[]=[];page.on('console',m=>{if(/Content Security Policy/i.test(m.text()))violations.push(m.text());});
 await page.route(/\/shell\.html$/,async r=>{const res=await r.fetch();await r.fulfill({response:res,headers:{...res.headers(),'content-security-policy':csp}});});
 await page.goto('/shell.html');
 await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'API gateway'})).toBeVisible();
 await page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'Database'}).click();
 await expect(page.locator('#database')).toHaveClass(/sh-hl/);
 expect(violations).toEqual([]);
});

/** Records every blob URL the page revokes, under a fake clock. */
async function watchRevokes(page:Page){
 await page.clock.install();
 await page.addInitScript(()=>{const w=window as any;w.__revoked=[];const o=URL.revokeObjectURL;URL.revokeObjectURL=(u:string)=>{w.__revoked.push(u);o.call(URL,u);};
  const c=URL.createObjectURL;w.__created=[];URL.createObjectURL=(b:Blob)=>{const u=c.call(URL,b);w.__created.push(u);return u;};});
 const lists=()=>page.evaluate(()=>({created:(window as any).__created as string[],revoked:(window as any).__revoked as string[]}));
 return lists;
}

test('Open raw file and Save as free their blob URL after 60 s', async ({page}) => {
 const lists=await watchRevokes(page);
 await page.goto('/shell.html');
 const popup=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Open raw file'}).click();
 await popup;
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Save as'}).click();
 await download;
 const {created}=await lists();
 expect(created).toHaveLength(2);
 await page.clock.runFor(59000);
 expect((await lists()).revoked).toEqual([]);
 await page.clock.runFor(2000);
 expect((await lists()).revoked.sort()).toEqual([...created].sort());
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
