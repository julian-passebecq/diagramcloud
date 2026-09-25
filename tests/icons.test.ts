import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ICON_REGISTRY,iconAttribution,iconFor,isRegisteredIcon,vendorIconsIn} from '../src/core/icons';
import {gitBlobId,iconProblems} from '../scripts/icons';
import {samples} from '../src/data/samples';

test('git blob IDs match git itself',()=>{
 assert.equal(gitBlobId(new Uint8Array()),'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
 assert.equal(gitBlobId(new TextEncoder().encode('hello\n')),'ce013625030ba8dba906f756967f9e9ca394464a');
});

test('every shipped icon is registered and byte-identical to its recorded upstream file',()=>{
 assert.deepEqual(iconProblems('public'),[]);
 const e=ICON_REGISTRY.find(x=>x.id==='fabric-lakehouse')!;
 assert.equal(gitBlobId(readFileSync(join('public',e.file!))),e.source!.blob);
});

test('a recoloured copy, an unregistered file or a missing file fails the check',()=>{
 const dir=mkdtempSync(join(tmpdir(),'icons-'));
 try{
  cpSync('public/icons',join(dir,'icons'),{recursive:true});
  const file=join(dir,'icons','fabric-lakehouse.svg'),svg=readFileSync(file,'utf8');
  writeFileSync(file,svg.replace(/#[0-9A-Fa-f]{6}/,'#FF0000'));
  writeFileSync(join(dir,'icons','aws-s3.svg'),'<svg/>');
  const problems=iconProblems(dir);
  assert(problems.some(p=>/fabric-lakehouse: .* has git blob [0-9a-f]{40}, but the registry records a06e893b/.test(p)),problems.join('\n'));
  assert(problems.some(p=>p.startsWith('public/icons/aws-s3.svg is not in the icon registry')));
  rmSync(file);
  assert(iconProblems(dir).some(p=>/fabric-lakehouse: .* is missing/.test(p)));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('registry entries are complete, and unknown IDs draw the generic symbol',()=>{
 assert.equal(new Set(ICON_REGISTRY.map(e=>e.id)).size,ICON_REGISTRY.length);
 for(const e of ICON_REGISTRY.filter(x=>x.origin==='vendor')){
  assert.match(e.source!.commit,/^[0-9a-f]{40}$/);assert.match(e.source!.blob,/^[0-9a-f]{40}$/);
  assert.match(e.terms!.url,/^https:\/\//);assert(e.rules!.some(r=>/crop.*rotate.*distort/i.test(r)),'distortion rule recorded');
  assert.match(iconAttribution(e),/not covered by the DiagramCloud MIT licence/);
 }
 assert.equal(iconFor('aws-s3').id,'generic');assert.equal(iconFor(undefined).id,'generic');
 for(const d of samples)for(const n of d.nodes)assert(isRegisteredIcon(n.icon),`${d.id}/${n.id} uses unregistered icon ${n.icon}`);
 const fabric=samples.find(d=>d.nodes.some(n=>n.icon==='fabric-lakehouse'))!;
 assert.deepEqual(vendorIconsIn(fabric).map(e=>e.id),['fabric-pipeline','fabric-lakehouse']);
});
