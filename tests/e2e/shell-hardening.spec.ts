import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

// R970: probes from the R958 and PR #172 reviews. The floor plan is bundled into the shell script, so each probe is put
// into that bundled text on its way to the browser, escaped so it fits any JS string literal.
const OUTSIDE='probe.invalid';
const H='https://'+OUTSIDE;
const PROBE='<style>svg{background-image:url('+H+'/css.png)}</style>'
 +'<image href='+H+'/img.png width=9 height=9 /><a id=probe-link xlink:href='+H+'/a><text>link</text></a>';
const jsLiteral=(text:string)=>text.replace(/[\\"'`]/g,m=>'\\'+m);

/** Shows the floor plan with a probe put in after its <title> (or after its </svg> with at='end'). The shell's own
 *  <meta> CSP is taken out of the page unless keepMeta, so these probes test the sanitiser alone. */
async function withProbe(page:Page,probe=PROBE,{at='start',keepMeta=false}:{at?:'start'|'end';keepMeta?:boolean}={}){
 const outside:string[]=[];
 await page.context().route(u=>u.hostname===OUTSIDE,r=>{outside.push(r.request().url());return r.abort();});
 await page.route(/\/assets\/shell-[^/]*\.js$/,async r=>{
  const text=await (await r.fetch()).text();
  const body=at==='start'?text.replace('small flat</title>','small flat</title>'+jsLiteral(probe))
   :text.replace(/M450 400H520\\?"\/><\/g>[^<]{0,12}<\/svg>/,m=>m+jsLiteral(probe));
  expect(body).not.toBe(text);
  await r.fulfill({body,contentType:'text/javascript'});
 });
 if(!keepMeta)await withoutMetaCsp(page);
 await page.goto('/shell.html');
 await page.getByRole('navigation',{name:'Diagrams'}).getByRole('button',{name:'floor-plan.svg'}).click();
 await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'Kitchen'})).toBeVisible();
 return outside;
}

/** Serves shell.html without its <meta> CSP (and with the given response headers). */
async function withoutMetaCsp(page:Page,headers:Record<string,string>={}){
 await page.route(/\/shell\.html$/,async r=>{const res=await r.fetch();const html=await res.text();
  const body=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'');expect(body).not.toBe(html);
  await r.fulfill({response:res,body,headers:{...res.headers(),...headers}});});
}

test('a <style> in a diagram styles the diagram only, never the shell', async ({page}) => {
 // No url() here, so the style is kept: only the shadow root keeps it off the shell.
 await withProbe(page,'<style>body{background:red} .sh-left{background:red}</style>');
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
 'child element inside <style>':'<style>svg{background-image:u<g>z</g>rl('+H+'/child.png)}</style>',
 'child element hiding @import':'<style>@im<g>z</g>port "'+H+'/child-import.css";</style>',
 'style attribute (comment, image-set)':'<rect x=120 width=50 height=50 style="filter:/* url(# */url('+H+'/attr-filter.svg#f);mask-image:image-set(\''+H+'/attr-mask.png\' 1x);cursor:/* url(# */url('+H+'/attr-cur.png),auto"/>',
};
for(const [family,probe] of Object.entries(BYPASSES))test(`no outside fetch through a ${family}`,async ({page}) => {
 const outside=await withProbe(page,probe);
 const box=await page.locator('main.sh-canvas').boundingBox();
 if(box)await page.mouse.move(box.x+box.width/2,box.y+box.height/2); // cursor rules load on hover
 await page.waitForTimeout(700);
 expect(outside).toEqual([]);
 await expect(page.getByRole('contentinfo',{name:'Output'})).toContainText('Refused in floor-plan.svg');
});

test('a <style> after the </svg> cannot restyle the host through @scope', async ({page}) => {
 await withProbe(page,'<style>@scope{:scope{outline:7px solid rgb(255, 0, 0);background:rgb(255, 0, 0)}}</style>',{at:'end'});
 const host=await page.evaluate(()=>{const s=getComputedStyle(document.querySelector('.sh-diagram')!);return s.outlineStyle+' '+s.outlineColor+' '+s.backgroundColor;});
 expect(host).not.toContain('rgb(255, 0, 0)');
 await expect(page.getByRole('contentinfo',{name:'Output'})).toContainText('Refused in floor-plan.svg');
});

test('ordinary styling and comments are kept and nothing is reported', async ({page}) => {
 await withProbe(page,'<style>/* rooms */ #kitchen rect{fill:rgb(1, 2, 3)}</style>');
 await expect(page.locator('#kitchen rect')).toHaveCSS('fill','rgb(1, 2, 3)');
 await expect(page.getByRole('contentinfo',{name:'Output'})).not.toContainText('Refused');
});

test('a diagram cannot paint over the shell: position:fixed stays inside the canvas', async ({page}) => {
 await withProbe(page,'<style>svg{position:fixed!important;left:0;top:0;width:100vw!important;height:100vh!important;z-index:2147483647}</style>');
 const top=await page.evaluate(()=>{const b=[...document.querySelectorAll('.sh-tools button')].find(x=>x.textContent==='Open raw file')!;
  const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;});
 expect(top).toBe(true);
});

const vercelRule=()=>{const rule=JSON.parse(readFileSync('vercel.json','utf8')).headers.find((h:{source:string})=>new RegExp('^'+h.source+'$').test('/shell.html'));
 return rule.headers.find((h:{key:string})=>h.key==='Content-Security-Policy').value as string;};
/** Adds an outside image, style sheet, font, object, embed, fetch and frame to the diagram's shadow root from the page itself: only a CSP stops them. */
async function outsideLoads(page:Page){
 const outside:string[]=[];
 await page.context().route(u=>u.hostname===OUTSIDE,r=>{outside.push(r.request().url());return r.abort();});
 return async()=>{
  await page.evaluate(h=>{const sr=document.querySelector('.sh-diagram')!.shadowRoot!;
   const i=document.createElement('img');i.src=h+'/csp-img.png';sr.appendChild(i);
   const l=document.createElement('link');l.rel='stylesheet';l.href=h+'/csp-sheet.css';sr.appendChild(l);
   // In the document, not the shadow root: Chromium ignores @font-face inside a shadow root.
   const f=document.createElement('style');f.textContent='@font-face{font-family:csp-probe;src:url('+h+'/csp-font.woff)}';document.head.appendChild(f);
   const t=document.createElement('span');t.style.fontFamily='csp-probe';t.textContent='x';document.body.appendChild(t);
   const o=document.createElement('object');o.data=h+'/csp-object.png';o.type='image/png';document.body.appendChild(o);
   const e=document.createElement('embed');e.src=h+'/csp-embed.svg';e.type='image/svg+xml';document.body.appendChild(e);
   fetch(h+'/csp-fetch.json').catch(()=>{});
   const fr=document.createElement('iframe');fr.src=h+'/csp-frame.html';document.body.appendChild(fr);
   },H);
  await page.waitForTimeout(900);
  return outside;
 };
}

test('the vercel.json CSP for /shell.html alone stops outside images, style sheets, fonts, objects, fetches and frames', async ({page}) => {
 await withoutMetaCsp(page,{'content-security-policy':vercelRule()});
 const load=await outsideLoads(page);
 await page.goto('/shell.html');
 await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'API gateway'})).toBeVisible();
 expect(await load()).toEqual([]);
});

test('the <meta> CSP in shell.html alone stops outside images, style sheets, fonts, objects, fetches and frames, on any host', async ({page}) => {
 const load=await outsideLoads(page);
 await page.goto('/shell.html');
 await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'API gateway'})).toBeVisible();
 expect(await load()).toEqual([]);
});

test('the <meta> CSP keeps the page base: a <base href> to another origin is ignored', async ({page}) => {
 await page.goto('/shell.html');
 await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'API gateway'})).toBeVisible();
 const baseURI=await page.evaluate(h=>{const b=document.createElement('base');b.href=h+'/';document.head.prepend(b);return document.baseURI;},H);
 expect(baseURI).not.toContain(OUTSIDE);
});

test('the control: without any CSP the same loads do leave the page', async ({page}) => {
 await withoutMetaCsp(page);
 const load=await outsideLoads(page);
 await page.goto('/shell.html');
 await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'API gateway'})).toBeVisible();
 const got=(await load()).map(u=>u.replace(/^.*\/csp-([a-z]+)\..*$/,'$1')).sort();
 expect(got).toEqual(['embed','fetch','font','frame','img','object','sheet']);
});

test('the shell works under both CSPs: highlight, Save as and Open raw file', async ({page}) => {
 const violations:string[]=[];page.on('console',m=>{if(/Content Security Policy/i.test(m.text()))violations.push(m.text());});
 await page.route(/\/shell\.html$/,async r=>{const res=await r.fetch();await r.fulfill({response:res,headers:{...res.headers(),'content-security-policy':vercelRule()}});});
 await page.goto('/shell.html');
 await page.getByRole('complementary',{name:'Navigation'}).getByRole('button',{name:'Database'}).click();
 await expect(page.locator('#database')).toHaveClass(/sh-hl/);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Save as'}).click();
 expect((await download).suggestedFilename()).toBe('architecture.svg');
 const popup=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Open raw file'}).click();
 const raw=await popup;await raw.waitForLoadState();
 await expect(raw.locator('body')).toContainText('<svg');
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
