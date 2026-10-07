import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atlasSvg,atlasCards} from '../src/export/design/atlas';
import {parseManifest,documentFromAtlas,rescanRepository,addRepository} from '../src/core/atlas';
import {scanRepository,type ScanFile} from '../src/core/scan/scanner';
import {validateDocument,DESIGN_THEMES,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-06T12:00:00Z'),LATER=new Date('2026-10-20T09:30:00Z'),RENDER=new Date('2026-10-21T08:00:00Z');
const SHA_A='a1b2c3d'+'4'.repeat(33),SHA_B='b2c3d4e'+'5'.repeat(33),SHA_C='c3d4e5f'+'6'.repeat(33),HANDBOOK='1234567890abcdef1234567890abcdef12345678';
const git=(branch:string,sha:string):ScanFile[]=>[{path:'.git/HEAD',text:`ref: refs/heads/${branch}\n`},{path:`.git/refs/heads/${branch}`,text:`${sha}\n`}];
/** Small in-memory repositories (no filesystem scan): a package and two modules each. */
const repo=(name:string,branch:string,sha:string):ScanFile[]=>[{path:'package.json',text:JSON.stringify({name,dependencies:{express:'^4'}})},
 {path:'src/index.ts',text:"import {route} from './route';\nexport const app=route;"},{path:'src/route.ts',text:'export const route=1;'},...git(branch,sha)];
const {manifest}=parseManifest(readFileSync('tests/fixtures/atlas/shop.manifest.json','utf8'));
const base=()=>documentFromAtlas(manifest,{shop:{model:scanRepository(repo('shop','main',SHA_A),{name:'Shop'})},billing:{model:scanRepository(repo('billing','release',SHA_B),{name:'Billing'})}},{now:NOW}).document;
const rescanned=()=>rescanRepository(base(),'billing',scanRepository(repo('billing','release',SHA_C),{name:'Billing'}),LATER).document;

/** Contoso without its atlas, for the empty state. */
const noAtlas=()=>{const d=structuredClone(contosoForecasting());delete d.atlas;return validateDocument(d);};
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text').map(e=>e.text).join(' ');
const card=(svg:string,id:string)=>els(svg).find(e=>e.attrs['data-dd-repo']===id);
const cardText=(svg:string,id:string)=>[...walk(card(svg,id)!)].filter(e=>e.name==='text').map(e=>e.text).join(' ');

test('atlas: well-formed, accessible, offline, script-free, unique ids, deterministic, text inside the viewBox',()=>{
 for(const d of [base(),rescanned(),contosoForecasting(),noAtlas()])for(const theme of DESIGN_THEMES){
  const svg=atlasSvg(d,d.rootViewId,{theme,now:RENDER}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'atlas',label);assert.equal(root.attrs['data-theme'],theme,label);
  const ids=attr(svg,'id');assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  for(const ref of root.attrs['aria-labelledby'].split(' '))assert.ok(ids.includes(ref),label);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(atlasSvg(d,d.rootViewId,{theme,now:RENDER}),svg,`${label}: deterministic`);
  const [,,W,H]=root.attrs.viewBox.split(' ').map(Number);
  for(const e of els(svg).filter(e=>e.name==='text')){
   const x=+e.attrs.x,y=+e.attrs.y,size=+e.attrs['font-size'],w=[...e.text].length*size*(e.attrs['font-family']?.includes('Mono')?0.62+(+(e.attrs['letter-spacing']??'0em').replace('em','')):0.55);
   const left=e.attrs['text-anchor']==='middle'?x-w/2:e.attrs['text-anchor']==='end'?x-w:x;
   assert.ok(left>=0&&left+w<=W&&y-size>=0&&y<=H,`${label}: "${e.text}" inside ${W}×${H}`);
  }
 }
});

test('atlas: one card per repository with its short revision, ref, authority and scan state; the no-single-revision sentence',()=>{
 const d=base(),svg=atlasSvg(d,d.rootViewId,{now:RENDER});
 assert.deepEqual(attr(svg,'data-dd-repo').sort(),['billing','handbook','shop']);
 for(const [id,sha] of [['shop',SHA_A],['billing',SHA_B],['handbook',HANDBOOK]]){assert.ok(cardText(svg,id).includes(sha.slice(0,7)),id);assert.ok(!svg.includes(sha.slice(0,8)),`${id}: shortened`);}
 assert.match(cardText(svg,'shop'),/main/);assert.match(cardText(svg,'shop'),/GIT/);assert.match(cardText(svg,'shop'),/opens scan/);
 assert.match(cardText(svg,'handbook'),/MANIFEST/);assert.match(cardText(svg,'handbook'),/not scanned/);assert.match(cardText(svg,'handbook'),/REF.*unknown/);
 assert.equal(card(svg,'shop')!.attrs['data-opens'],'true');assert.equal(card(svg,'handbook')!.attrs['data-opens'],undefined);
 assert.match(texts(svg),/Each repository keeps its own revision; there is no single project revision/);assert.match(texts(svg),/captured 2026-10-06 12:00 UTC/);
 assert.ok(attr(svg,'data-dd-revision-state').every(s=>s==='baseline'));assert.match(texts(svg),/No earlier snapshot/i);
 // Declared relationships, dashed, between cards.
 const paths=els(svg).filter(e=>e.attrs['data-edge-id']);assert.deepEqual(paths.map(p=>p.attrs['data-edge-id']).sort(),['rel-1','rel-2']);
 assert.ok(paths.every(p=>p.attrs['stroke-dasharray']==='5,4'&&p.attrs['data-dd-basis']==='planned'));
});

test('atlas: a changed revision gets the Δ badge with old → new; added and removed are marked',()=>{
 const d=rescanned(),svg=atlasSvg(d,d.rootViewId,{now:RENDER});
 assert.equal(card(svg,'billing')!.attrs['data-dd-revision-state'],'changed');assert.match(cardText(svg,'billing'),new RegExp(`Δ.*b2c3d4e → c3d4e5f`));
 assert.equal(card(svg,'shop')!.attrs['data-dd-revision-state'],'unchanged');
 assert.match(texts(svg),/1 changed · 0 added · 0 removed · 2 unchanged/i);
 // Added through a reviewed Add repository; removed: a public repository dropped from the latest snapshot.
 const added=addRepository(d,{id:'warehouse',title:'Warehouse',host:'gitlab',locator:'https://gitlab.com/example/warehouse',role:'data'},new Date('2026-10-21T07:00:00Z'));
 const prev=added.atlas!.snapshots.at(-2)!;prev.repositories.push({id:'legacy',title:'Legacy',host:'github',locator:'https://github.com/example/legacy',revision:'deadbee'+'0'.repeat(33),scanStatus:'not-scanned',authority:'manifest',visibility:'public'});
 const svg2=atlasSvg(validateDocument(added),added.rootViewId,{now:RENDER});
 assert.equal(card(svg2,'warehouse')!.attrs['data-dd-revision-state'],'added');assert.match(cardText(svg2,'warehouse'),/\+/);
 assert.equal(card(svg2,'legacy')!.attrs['data-dd-revision-state'],'removed');assert.match(cardText(svg2,'legacy'),/−.*deadbee \(removed\)/);
});

test('atlas: a private repository card and its revision never appear (and it is not reported as removed)',()=>{
 const d=rescanned(),priv:Project=validateDocument({...d,nodes:d.nodes.map(n=>n.id==='repo-billing'?{...n,visibility:'private' as const}:n)});
 assert.ok(!publicDocument(priv).atlas!.snapshots[0].repositories.some(r=>r.id==='billing'));
 const svg=atlasSvg(priv,priv.rootViewId,{now:RENDER});
 assert.deepEqual(attr(svg,'data-dd-repo').sort(),['handbook','shop']);
 for(const sha of [SHA_B,SHA_C])assert.ok(!svg.includes(sha.slice(0,7)),'no private revision anywhere');
 assert.ok(!svg.includes('Billing')&&!/billing/.test(svg));
 assert.ok(!atlasCards(priv,publicDocument(priv)).cards.some(c=>c.state==='removed'));
});

test('atlas: a document without an atlas gets the empty state and lists the view components',()=>{
 const d=noAtlas(),svg=atlasSvg(d,d.rootViewId,{now:RENDER});
 assert.equal(attr(svg,'data-dd-empty')[0],'atlas');assert.match(texts(svg),/npm run atlas/);assert.equal(attr(svg,'data-dd-repo').length,0);
 const root=publicDocument(d).views.find(v=>v.id===d.rootViewId)!;assert.equal(attr(svg,'data-node-id').length,Math.min(24,root.nodeIds.length));
});

test('atlas: more than 16 declared relationships are listed, not drawn; drawn connectors never leave the canvas',()=>{
 const d=structuredClone(base()),root=d.views.find(v=>v.id===d.rootViewId)!,first=d.edges.find(e=>root.edgeIds.includes(e.id))!;
 // Sparse: every connector point stays inside the viewBox (a backward route used to run off the left edge).
 const back={...first,id:'back-route',source:first.target,target:first.source};d.edges.push(back);root.edgeIds.push(back.id);
 const sparse=atlasSvg(validateDocument(d),d.rootViewId,{now:RENDER}),[,,W]=find(parseXml(sparse),'svg')!.attrs.viewBox.split(' ').map(Number);
 for(const p of els(sparse).filter(e=>e.name==='path'&&e.attrs['data-edge-id']))for(const [x] of [...p.attrs.d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]))assert.ok(x>=0&&x<=W,`${p.attrs['data-edge-id']}: x ${x} inside 0..${W}`);
 for(let i=0;i<17;i++){const e={...first,id:`extra-${i}`,label:`contract ${i}`};d.edges.push(e);root.edgeIds.push(e.id);}
 const dense=atlasSvg(validateDocument(d),d.rootViewId,{now:RENDER});
 assert.equal(els(dense).filter(e=>e.name==='path'&&e.attrs['data-edge-id']).length,0,'no connector drawn');
 const total=root.edgeIds.length;assert.ok(total>16);
 assert.equal(els(dense).filter(e=>e.name==='g'&&e.attrs['data-edge-id']).length,total,'every relationship listed');
 assert.match(texts(dense),new RegExp(`DECLARED RELATIONSHIPS · ${total} · LISTED, NOT DRAWN`));assert.match(texts(dense),/listed rather than drawn/);
});
