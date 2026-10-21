import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';

const read=(path:string)=>readFileSync(path,'utf8');
const entries=['README.md','docs/ROADMAP.md','RESUME.md'];
const archives=[
 ['README_HISTORY_20261021.md','f1bd356605999ae8ed951d36501dabfaf749ed83'],
 ['docs/ROADMAP_HISTORY_20261021.md','5a7d5437b1a6007dcd419f930beee5cf9ae3ec2c'],
 ['RESUME_HISTORY_20261021.md','3b81c81934fc13881dffa568157d65fac76395c8'],
] as const;

/** Documentation consistency checks, not network/CI or release qualification. */
test('active entry documents agree with the source version and recorded private package',()=>{
 const {version}=JSON.parse(read('package.json')) as {version:string};
 const {privatePackages}=JSON.parse(read('outcome.json')) as {privatePackages:{version:string;packageReceipt:{sourceSha:string;destination:string}}[]};
 const latest=privatePackages.at(-1);assert.ok(latest,'a recorded package is present');
 const identity=`diagramcloud/${latest.version}-${latest.packageReceipt.sourceSha.slice(0,7)}`;
 assert.ok(latest.packageReceipt.destination.endsWith(`/${identity}/`));
 assert.match(read('README.md'),new RegExp(`\\| Source version \\| \\x60${version.replaceAll('.','\\.')}\\x60 \\|`));
 for(const path of entries){
  const text=read(path);assert.ok(text.includes(`\x60${version}\x60`),`${path} names the current source version`);
  assert.ok(text.includes(`\x60${identity}\x60`),`${path} distinguishes the last recorded package`);
 }
});

test('historical entry documents retain their original Git blob identity',()=>{
 for(const [path,expected] of archives){
  const bytes=readFileSync(path),header=Buffer.from(`blob ${bytes.length}\0`);
  assert.equal(createHash('sha1').update(header).update(bytes).digest('hex'),expected,`${path} preserves the complete historical input`);
 }
});

test('entry documentation local links resolve without breaking historical section anchors',()=>{
 const root=resolve('.'),anchors=(text:string)=>new Set(text.split('\n').filter(line=>/^#{1,6} /.test(line)).map(line=>line.replace(/^#+ /,'').toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu,'').replaceAll(' ','-')));
 for(const path of entries)for(const match of read(path).matchAll(/\]\(([^)\s]+)\)/g)){
  const href=match[1];if(/^[a-z]+:/i.test(href))continue;
  const [target,anchor]=href.split('#'),absolute=target?resolve(dirname(path),decodeURIComponent(target)):resolve(path);
  assert.ok(absolute===root||absolute.startsWith(root+sep),`${href} stays in the checkout`);
  assert.ok(existsSync(absolute),`${path}: ${href} exists`);
  if(anchor&&!/^L\d+(?:-L\d+)?$/.test(anchor))assert.ok(anchors(read(absolute)).has(decodeURIComponent(anchor)),`${path}: ${href} has a heading`);
 }
});

test('documented npm run commands name real package scripts',()=>{
 const {scripts}=JSON.parse(read('package.json')) as {scripts:Record<string,string>};
 for(const path of entries)for(const match of read(path).matchAll(/npm run ([a-z0-9:-]+)/g))assert.ok(match[1] in scripts,`${path} names a real script: ${match[1]}`);
});
