import test from 'node:test';
import assert from 'node:assert/strict';
import {treemapSvg,treemapHierarchy,treemapTiles,squarify} from '../src/export/design/treemap';
import {validateDocument,DESIGN_THEMES} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const inside=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w+0.01&&a.y+a.h<=b.y+b.h+0.01;

test('treemap is well-formed, accessible, offline, script-free and deterministic in every theme',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,5)])for(const theme of DESIGN_THEMES){
  const svg=treemapSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'treemap',label);assert.equal(root.attrs['data-theme'],theme,label);
  const [titleId,descId]=root.attrs['aria-labelledby'].split(' '),ids=attr(svg,'id');
  assert.ok(ids.includes(titleId)&&ids.includes(descId),label);assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|@import|@font-face|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(treemapSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
  assert.ok(attr(svg,'data-view-ref').length>=1,`${label}: not empty`);
 }
});

test('treemap never shows private components or the views only they open',()=>{
 const d=contosoForecasting(),opener=d.nodes.find(n=>n.childViewId&&d.views.find(v=>v.id===d.rootViewId)!.nodeIds.includes(n.id))!,hidden=opener.childViewId!;
 opener.visibility='private';opener.label='Secret console <&>';const doc=validateDocument(d),svg=treemapSvg(doc,doc.rootViewId,{now:NOW});
 assert.ok(!svg.includes('Secret console'),'private label');assert.ok(!attr(svg,'data-view-ref').includes(hidden)||publicDocument(doc).nodes.some(n=>n.childViewId===hidden),'unreachable view drawn');
});

test('treemap areas follow component counts; children nest inside their parent under an 18 px band',()=>{
 for(const d of [contosoForecasting(),samples[0],samples[1]]){
  const {root}=treemapHierarchy(publicDocument(d)),tiles=treemapTiles(root,{x:0,y:0,w:880,h:520}),byId=new Map(tiles.map(t=>[t.node.viewId,t]));
  for(const tile of tiles)for(const ch of tile.node.children){const c=byId.get(ch.viewId);if(!c)continue;
   assert.ok(inside(c.box,tile.box)&&c.box.y>=tile.box.y+18,`${d.id}: ${ch.viewId} nests in ${tile.node.viewId}`);
   assert.equal(tile.node.total,tile.node.own+tile.node.children.reduce((s,x)=>s+x.total,0));}
  assert.ok(tiles.every(t=>t.node.depth<=3),d.id);
 }
 const parts=squarify([{key:'a',value:6,item:'a'},{key:'b',value:3,item:'b'},{key:'c',value:1,item:'c'}],{x:0,y:0,w:100,h:100});
 assert.deepEqual(parts.map(p=>Math.round(p.box.w*p.box.h)),[6000,3000,1000]);
});

test('treemap: only the current view carries the accent',()=>{
 const d=contosoForecasting(),child=d.nodes.find(n=>n.childViewId)!.childViewId!,svg=treemapSvg(d,child,{now:NOW});
 const accented=els(svg).filter(e=>e.attrs['data-view-ref']&&e.children.some(r=>r.name==='rect'&&r.attrs.stroke==='#eb6c36'));
 assert.deepEqual(accented.map(e=>e.attrs['data-view-ref']),[child]);assert.deepEqual(attr(svg,'data-current'),['true']);
});
