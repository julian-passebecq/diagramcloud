import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {designSvg} from '../src/export/design';
import {DESIGN_TYPES,parseDocument,type DesignType,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {collect,defects,overlap} from './helpers/designGeometry';

/** Geometric quality check for every Diagram Design figure (see tests/helpers/designGeometry.ts for the text box budgets). */
const NOW=new Date('2026-10-07T09:00:00Z');

test('design quality: the checker itself sees overlaps, overflow, transforms and empty figures',()=>{
 const {boxes,vb,unresolved,shapes}=collect('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="100%" height="100%"/><g font-size="12"><text x="10" y="30">Overlapping label</text><text x="20" y="32">Second label</text><text x="190" y="60" font-family="ui-monospace">overflows the canvas</text><g transform="rotate(90)"><text x="0" y="0">skipped</text></g></g></svg>');
 assert.equal(shapes,0);assert.equal(unresolved,1);assert.equal(boxes.length,3);assert.ok(overlap(boxes[0],boxes[1]));assert.ok(!overlap(boxes[0],boxes[2]));assert.ok(boxes[2].x+boxes[2].w>vb.w);
});

test('design quality: no overlapping text, every text inside the viewBox, never an empty figure',()=>{
 const failures:string[]=[];let figures=0,unresolved=0,texts=0;
 // DIAGRAMCLOUD_QUALITY_DOCS=a.json,b.json adds local documents (for example a private Galaxy atlas) without committing them.
 const extra=(process.env.DIAGRAMCLOUD_QUALITY_DOCS??'').split(',').filter(Boolean).map(p=>parseDocument(readFileSync(p,'utf8')));
 for(const d of [contosoForecasting(),...samples,...extra] as Project[])for(const view of publicDocument(d).views)for(const type of DESIGN_TYPES.filter(t=>t!=='auto') as DesignType[])for(const theme of ['light','dark'] as const){
  const r=defects(designSvg(d,view.id,{type,theme,now:NOW}),`${type}/${d.id}/${view.id}/${theme}`);figures++;unresolved+=r.unresolved;texts+=r.texts;failures.push(...r.failures);
 }
 if(unresolved)console.log(`design quality: ${unresolved} text(s) under an unresolved transform skipped`);
 assert.ok(figures>0&&texts>figures*3,`${texts} text boxes in ${figures} figures`);
 assert.equal(failures.length,0,`${failures.length} geometric defect(s) in ${figures} figures:\n${failures.slice(0,400).join('\n')}`);
});
