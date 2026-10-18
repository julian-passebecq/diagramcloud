import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,DESIGN_THEMES} from '../src/core/model';
import {lineageSvg} from '../src/export/design/lineage';
import {parseXml,walk} from '../src/core/interchange/xml';
import {collect,defects} from './helpers/designGeometry';

const NOW=new Date('2026-10-07T09:00:00Z');
// Synthetic cyclic/skip dependencies, minimized from a deterministic synthetic graph search.
// Dense top-corridor lanes put a complete edge label horizontally beside a STEP heading.
function fixture(longHeader=false){
 const ids=[0,2,3,4,5,6,7,8,10,11,14,15,19,20,22];
 const links=[[0,6],[3,2],[3,10],[4,10],[4,14],[6,7],[6,10],[7,20],[7,22],[8,15],[11,6],[15,3],[15,6],[15,7],[19,5],[19,15],[20,5],[20,19],[22,6]];
 return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-lineage-heading',title:'Synthetic dependency example',rootViewId:'root',
  nodes:ids.map(i=>({id:`step-${i}`,label:`Synthetic component ${i}`,basis:'planned'})),
  edges:links.map(([a,b])=>({id:`link-${a}-${b}`,source:`step-${a}`,target:`step-${b}`,label:'Imports data',kind:'dependency',basis:'planned'})),
  views:[{id:'root',title:longHeader?'Synthetic dependency reading order with a longer explanatory title that wraps while retaining its whole text':'Synthetic dependency reading order',
   description:longHeader?'Synthetic author-declared dependencies retain their complete labels. The columns explain connection-derived reading order and never measured timing. '.repeat(2):'',
   nodeIds:ids.map(i=>`step-${i}`),edgeIds:links.map(([a,b])=>`link-${a}-${b}`),positions:Object.fromEntries(ids.map(i=>[`step-${i}`,{x:i*240,y:0}])),design:{type:'lineage',focal:['step-0']}}]}));
}

test('lineage headings occupy a separate lane from complete cycle/skip labels, including wrapped headers in every theme',()=>{
 for(const long of [false,true])for(const theme of DESIGN_THEMES){
  const doc=fixture(long),before=structuredClone(doc),svg=lineageSvg(doc,'root',{theme,now:NOW}),result=defects(svg,`lineage-synthetic/${theme}/${long}`);
  assert.deepEqual(result.failures,[],result.failures.join('\n'));assert.equal(result.unresolved,0);assert.equal(result.unresolvedShapes,0);
  const elements=[...walk(parseXml(svg))],ids=(attr:string)=>elements.filter(e=>e.attrs[attr]!==undefined).map(e=>e.attrs[attr]);
  assert.deepEqual(ids('data-node-id').sort(),doc.nodes.map(n=>n.id).sort());assert.deepEqual(ids('data-edge-id').sort(),doc.edges.map(e=>e.id).sort());
  for(const edge of elements.filter(e=>e.attrs['data-edge-id']))assert.ok(edge.children.some(e=>e.name==='title'&&e.text.includes(': Imports data (dependency')),'Every connection retains its complete label in accessible text');
  const boxes=collect(svg).boxes,headings=boxes.filter(b=>/^STEP \d+$/.test(b.s)),labels=boxes.filter(b=>b.s==='IMPORTS DATA');
  assert.ok(headings.length>1&&labels.length>0);
  assert.ok(headings.some(h=>labels.some(l=>Math.min(h.x+h.w,l.x+l.w)-Math.max(h.x,l.x)>2)),'The fixture still challenges the heading columns horizontally');
  assert.ok(labels.every(l=>headings.every(h=>l.y>=h.y+h.h+2||Math.min(h.x+h.w,l.x+l.w)-Math.max(h.x,l.x)<=2)),'A dedicated heading lane clears label text without clipping or omission');
  assert.deepEqual(doc,before,'Rendering never changes source facts or author positions');
 }
});
