import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {publicDocument} from '../src/core/operations';
import {resolveDesignType} from '../src/export/design';

const pages=(pdf:string)=>(pdf.match(/\/Type\s*\/Page(?!s)\b/g)??[]).length;
const urls=(pdf:string)=>[...new Set(pdf.match(/https?:\/\/[^\s)>"'\\]+/g)??[])].filter(u=>!u.startsWith('http://www.w3.org/2000/svg'));

test('--pdf prints book.pdf (cover + one page per public view) and one figure PDF per view, offline',{timeout:60_000},async t=>{
 // Probe the same headless build the CLI launches, rather than guessing from one executable path.
 try{await (await chromium.launch()).close();}catch{t.skip('chromium not installed (npx playwright install chromium)');return;}
 const dir=mkdtempSync(join(tmpdir(),'dd-pdf-')),doc=contosoForecasting(),views=publicDocument(doc).views;
 try{
  writeFileSync(join(dir,'doc.json'),JSON.stringify(doc));
  execFileSync(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),resolve('scripts/design.ts'),join(dir,'doc.json'),'--out',join(dir,'out'),'--pdf'],{stdio:'pipe',timeout:55_000});
  const book=readFileSync(join(dir,'out','book.pdf'),'latin1');
  assert.ok(book.startsWith('%PDF-'));assert.equal(pages(book),1+views.length);assert.deepEqual(urls(book),[]);
  for(const v of views){const f=join(dir,'out',`${doc.id}.${v.id}.${resolveDesignType(doc,v.id)}.pdf`),pdf=readFileSync(f,'latin1');
   assert.ok(pdf.startsWith('%PDF-'),f);assert.equal(pages(pdf),1,f);assert.deepEqual(urls(pdf),[],f);}
  assert.equal(readdirSync(join(dir,'out')).filter(f=>f.endsWith('.pdf')).length,1+views.length);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
