import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {designSvg} from '../src/export/design';
import {DESIGN_TYPES,parseDocument,type DesignType,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {collect,collectShapes,defects,defectSummary,overlap,shapeDefects,shapesOverlap} from './helpers/designGeometry';

/** Geometric quality check for every Diagram Design figure (see tests/helpers/designGeometry.ts for the text box budgets). */
const NOW=new Date('2026-10-07T09:00:00Z');

test('design quality: the checker itself sees overlaps, overflow, transforms and empty figures',()=>{
 const {boxes,vb,unresolved,shapes}=collect('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="100%" height="100%"/><g font-size="12"><text x="10" y="30">Overlapping label</text><text x="20" y="32">Second label</text><text x="190" y="60" font-family="ui-monospace">overflows the canvas</text><g transform="rotate(90)"><text x="0" y="0">skipped</text></g></g></svg>');
 assert.equal(shapes,0);assert.equal(unresolved,1);assert.equal(boxes.length,3);assert.ok(overlap(boxes[0],boxes[1]));assert.ok(!overlap(boxes[0],boxes[2]));assert.ok(boxes[2].x+boxes[2].w>vb.w);
});

test('design quality: the shape checker sees overlapping tiles, nested containers, translated groups and shapes outside the canvas',()=>{
 const tile=(id:string,x:number,y:number)=>`<g data-node-id="${id}"><polygon points="${x},${y} ${x+40},${y+20} ${x},${y+40} ${x-40},${y+20}"/></g>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="100%" height="100%"/>`+
  // Two diamonds whose boxes overlap but whose outlines only meet on a diagonal edge, then a third that really overlaps the first.
  tile('a',100,40)+tile('b',140,60)+tile('c',90,40)+
  // A container zone holding two leaves, both inside it; the leaves are apart.
  `<g data-view-ref="zone"><rect x="200" y="10" width="180" height="80"/><g data-view-ref="z1" data-depth="1"><rect x="210" y="20" width="60" height="40"/></g><g data-view-ref="z2" data-depth="1"><rect x="300" y="20" width="60" height="40"/></g></g>`+
  // A translated group whose rect lands on z2, which counts only within the same marker, then one rect pushed out of the canvas.
  `<g transform="translate(100 0)"><rect data-dd-node="t" x="200" y="20" width="60" height="40"/><rect data-dd-node="out" x="260" y="150" width="60" height="40"/></g>`+
  `<g transform="rotate(10)"><rect data-dd-node="r" x="0" y="0" width="5" height="5"/></g><path data-dd-node="p" d="M 10 150 h 20 v 20 l -20 0 Z"/></svg>`;
 const {shapes,unresolved}=collectShapes(svg),by=(id:string)=>shapes.find(s=>s.id===id)!;
 assert.equal(unresolved,1);assert.deepEqual(shapes.map(s=>s.id).sort(),['a','b','c','out','p','t','z1','z2']);
 assert.ok(!shapesOverlap(by('a'),by('b')),'diagonal neighbours are apart');assert.ok(shapesOverlap(by('a'),by('c')));
 assert.deepEqual({x:by('t').x,y:by('t').y},{x:300,y:20});assert.deepEqual({x:by('p').x,y:by('p').y,w:by('p').w,h:by('p').h},{x:10,y:150,w:20,h:20});
 const f=shapeDefects(svg,'self').failures;
 assert.equal(f.length,2,f.join('\n'));assert.ok(f.some(s=>/overlap data-node-id "a" × "c"/.test(s)));assert.ok(f.some(s=>/outside viewBox data-dd-node="out"/.test(s)));
});

test('design quality: no overlapping text, every text inside the viewBox, never an empty figure, component shapes apart and inside',()=>{
 const failures:string[]=[];let figures=0,unresolved=0,texts=0,components=0,unresolvedShapes=0;
 // DIAGRAMCLOUD_QUALITY_DOCS=a.json,b.json adds local documents (for example a private Galaxy atlas) without committing them.
 const extra=(process.env.DIAGRAMCLOUD_QUALITY_DOCS??'').split(',').filter(Boolean).map(p=>parseDocument(readFileSync(p,'utf8')));
 for(const d of [contosoForecasting(),...samples,...extra] as Project[])for(const view of publicDocument(d).views)for(const type of DESIGN_TYPES.filter(t=>t!=='auto') as DesignType[])for(const theme of ['light','dark'] as const){
  const r=defects(designSvg(d,view.id,{type,theme,now:NOW}),`${type}/${d.id}/${view.id}/${theme}`);figures++;unresolved+=r.unresolved;texts+=r.texts;components+=r.components;unresolvedShapes+=r.unresolvedShapes;failures.push(...r.failures);
 }
 if(unresolved)console.log(`design quality: ${unresolved} text(s) under an unresolved transform skipped`);
 assert.ok(figures>0&&texts>figures*3,`${texts} text boxes in ${figures} figures`);
 assert.equal(unresolvedShapes,0,`${unresolvedShapes} component(s) under a transform the shape check cannot resolve`);
 assert.ok(components>figures,`${components} component shapes in ${figures} figures`);
 assert.equal(failures.length,0,`${failures.length} geometric defect(s) in ${figures} figures:\n${defectSummary(failures)}\n${failures.slice(0,400).join('\n')}`);
});
