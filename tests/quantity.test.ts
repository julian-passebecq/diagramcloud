import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {viewSpec} from '../src/core/viewspec';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {drawioDiagram} from '../src/export/drawio';
import {importDrawio} from '../src/core/interchange/drawio';
import {describeChanges} from '../src/core/changeDetail';

const NOW=new Date('2026-10-07T09:00:00Z');
const Q={value:1200,unit:'rows/day',provenance:'synthetic' as const};

test('quantity: optional, strict, finite, non-negative; existing documents unchanged',()=>{
 const d=contosoForecasting();assert.ok(d.edges.every(e=>e.quantity===undefined));assert.deepEqual(validateDocument(structuredClone(d)),validateDocument(d));
 d.edges[0].quantity={...Q,note:'illustrative'};assert.deepEqual(validateDocument(d).edges[0].quantity,{...Q,note:'illustrative'});
 for(const bad of [{...Q,value:-1},{...Q,value:Number.NaN},{...Q,value:Infinity},{...Q,value:2e15},{...Q,unit:''},{...Q,unit:'x'.repeat(25)},{...Q,provenance:'measured'},{...Q,extra:1},{value:1,unit:'GB'},{...Q,note:'n'.repeat(201)}]){
  const x=contosoForecasting();(x.edges[0] as Record<string,unknown>).quantity=bad;assert.equal(documentSchema.safeParse(x).success,false,JSON.stringify(bad));assert.throws(()=>validateDocument(x));}
});

test('quantity: a private connection keeps its amount out of the public document; viewSpec carries a public one',()=>{
 const d=contosoForecasting(),v=d.views.find(v=>v.id==='overview')!,[a,b]=d.edges.filter(e=>v.edgeIds.includes(e.id));
 a.quantity={...Q,value: 987654};b.quantity={value:42,unit:'GB',provenance:'author'};b.visibility='private';
 const pub=publicDocument(d);assert.deepEqual(pub.edges.find(e=>e.id===a.id)!.quantity,a.quantity);assert.equal(pub.edges.some(e=>e.id===b.id),false);assert.doesNotMatch(JSON.stringify(pub),/"GB"/);
 const spec=viewSpec(d,'overview',{now:NOW});assert.deepEqual(spec.edges.find(e=>e.id===a.id)!.quantity,a.quantity);assert.equal(spec.edges.some(e=>e.id===b.id),false);
 assert.ok(spec.edges.filter(e=>e.id!==a.id).every(e=>e.quantity===undefined),'never invented');
});

test('quantity: draw.io export and import keep it; plain draw.io files never get one',async()=>{
 const d=contosoForecasting(),v=d.views.find(v=>v.id==='overview')!,e=d.edges.find(e=>v.edgeIds.includes(e.id))!;e.quantity={...Q,unit:'rows; per=day',note:'a;b=c'};
 const xml=drawioDiagram(d,NOW),{document}=await importDrawio(xml,'x.drawio');
 const back=document.edges.filter(x=>x.quantity);assert.equal(back.length,1);assert.deepEqual(back[0].quantity,e.quantity);
 const plain=(await importDrawio(xml.replace(/dcQuantity=[^;]*;/g,''),'x.drawio')).document;assert.ok(plain.edges.every(x=>x.quantity===undefined));
 const bad=(await importDrawio(xml.replace(/dcQuantity=[^;]*;/,'dcQuantity=-5;'),'x.drawio')).document;assert.ok(bad.edges.every(x=>x.quantity===undefined),'invalid amount refused');
});

test('quantity: relabelling a synthetic amount is flagged in the change preview',()=>{
 const a=contosoForecasting();a.edges[0].quantity=Q;const b=structuredClone(a);b.edges[0].quantity={...Q,provenance:'source-derived'};
 assert.ok(describeChanges(a,b).cautions.some(c=>/quantity .*from synthetic to source-derived/.test(c)));
});

const QUANTITY_LOSS='invalid connection quantity declaration(s) omitted.';
const xmlAttribute=(value:string)=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/** Raw synthetic importer input, not a rewritten exporter result: blank style values must be inspected as supplied. */
function rawQuantityPages(pages:string[][]):string{
 return '<mxfile>'+pages.map((styles,page)=>`<diagram name="Synthetic quantity page ${page+1}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Source" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell><mxCell id="b" value="Target" vertex="1" parent="1"><mxGeometry x="240" y="0" width="120" height="60" as="geometry"/></mxCell>${styles.map((style,i)=>`<mxCell id="edge-${i}" value="Declared connection ${i+1}" edge="1" source="a" target="b" parent="1" style="${xmlAttribute(style)}"><mxGeometry relative="1" as="geometry"/></mxCell>`).join('')}</root></mxGraphModel></diagram>`).join('')+'</mxfile>';
}
const quantityLosses=(lost:string[])=>lost.filter(line=>line.endsWith(QUANTITY_LOSS));
const quantityStyle=(value:string,unit='ms',provenance='author',note?:string)=>`dcQuantity=${value};dcUnit=${unit};dcProvenance=${provenance};${note===undefined?'':`dcQuantityNote=${note};`}`;

test('draw.io quantities: absent declaration stays absent without a quantity loss or label inference',async()=>{
 const raw=rawQuantityPages([['','dcUnit=ms;dcProvenance=author;','dcUnit=%;dcProvenance=not-a-provenance;']]);
 const {document,report}=await importDrawio(raw,'synthetic-absent.drawio',{idSuffix:'quantity',now:NOW});
 assert.equal(document.edges.length,3);assert(document.edges.every(edge=>edge.quantity===undefined));assert.deepEqual(quantityLosses(report.lost),[]);
 assert.equal(raw,rawQuantityPages([['','dcUnit=ms;dcProvenance=author;','dcUnit=%;dcProvenance=not-a-provenance;']]),'input string unchanged');
});

test('draw.io quantities: raw empty and whitespace declarations are not supplied zero',async()=>{
 const values=['',' ','   ','\t','\r\n\t '];
 for(const value of values){const raw=rawQuantityPages([[quantityStyle(value)]]),{document,report}=await importDrawio(raw,'synthetic-empty.drawio',{idSuffix:'quantity',now:NOW});
  assert.equal(document.edges.length,1);assert.equal(document.edges[0].quantity,undefined,JSON.stringify(value));assert.deepEqual(quantityLosses(report.lost),['1 '+QUANTITY_LOSS]);validateDocument(document);
 }
});

test('draw.io quantities: supplied zero preserves exact valid units, provenance and encoded notes',async()=>{
 const provenances=['author','synthetic','source-derived','reference'] as const;
 const raw=rawQuantityPages([provenances.map((provenance,i)=>quantityStyle(i%2?' 0 ':'0',encodeURIComponent(' ms; per=window '),provenance,encodeURIComponent('Declared zero; no measured result = synthetic QA')))]);
 const {document,report}=await importDrawio(raw,'synthetic-zero.drawio',{idSuffix:'quantity',now:NOW});
 assert.equal(document.edges.length,4);assert.deepEqual(quantityLosses(report.lost),[]);
 assert.deepEqual(document.edges.map(edge=>edge.quantity),provenances.map(provenance=>({value:0,unit:' ms; per=window ',provenance,note:'Declared zero; no measured result = synthetic QA'})));
 const before=JSON.stringify(document),roundTrip=await importDrawio(drawioDiagram(document,NOW),'synthetic-zero-roundtrip.drawio',{idSuffix:'again',now:NOW});
 assert.deepEqual(roundTrip.document.edges.map(edge=>edge.quantity),document.edges.map(edge=>edge.quantity));assert.deepEqual(quantityLosses(roundTrip.report.lost),[]);assert.equal(JSON.stringify(document),before);
});

test('draw.io quantities: malformed values, units, notes and provenance produce one safe loss per edge',async()=>{
 const invalid=[
  ...['%','NaN','Infinity','-Infinity','-1','1000000000000001','password=SYNTHETIC_QUANTITY_SENTINEL'].map(value=>quantityStyle(value)),
  'dcQuantity=1;dcProvenance=author;',
  ...['',' ','%20%09','%E0%A4%A','x'.repeat(25),'PRIVATE_INVALID_UNIT_SENTINEL'].map(unit=>quantityStyle('1',unit)),
  ...['','measured','PRIVATE_INVALID_PROVENANCE_SENTINEL'].map(provenance=>quantityStyle('1','ms',provenance)),
  quantityStyle('1','ms','author','%'),quantityStyle('1','ms','author','x'.repeat(201))
 ];
 for(const style of invalid){const {document,report}=await importDrawio(rawQuantityPages([[style]]),'synthetic-invalid.drawio',{idSuffix:'quantity',now:NOW});
  assert.equal(document.edges.length,1);assert.equal(document.edges[0].quantity,undefined,style);assert.deepEqual(quantityLosses(report.lost),['1 '+QUANTITY_LOSS]);
  assert(!JSON.stringify(report).includes('SENTINEL'),'generic losses never copy discarded declaration text');assert(!JSON.stringify(document).includes('SENTINEL'));
 }
});

test('draw.io quantities: invalid counts aggregate once per declaration across pages beside valid zero',async()=>{
 const raw=rawQuantityPages([[quantityStyle(''),quantityStyle('0'),quantityStyle('1','%')],[quantityStyle('Infinity'),quantityStyle(' \t'),'',quantityStyle('2','GB','reference')]]);
 const {document,report}=await importDrawio(raw,'synthetic-multipage.drawio',{idSuffix:'quantity',now:NOW});
 assert.equal(report.pages,2);assert.equal(document.edges.length,7);assert.deepEqual(quantityLosses(report.lost),['4 '+QUANTITY_LOSS]);
 assert.deepEqual(document.edges.filter(edge=>edge.quantity).map(edge=>edge.quantity),[{value:0,unit:'ms',provenance:'author'},{value:2,unit:'GB',provenance:'reference'}]);
 assert.equal(document.edges.filter(edge=>!edge.quantity).length,5);validateDocument(document);
});

test('draw.io quantities: public export and reimport preserve known zero without private input or source mutation',async()=>{
 const source=contosoForecasting(),view=source.views.find(v=>v.id==='overview')!,[shown,hidden]=source.edges.filter(edge=>view.edgeIds.includes(edge.id));
 shown.quantity={value:0,unit:'ms',provenance:'author',note:'Explicit author-provided zero; no observed claim'};
 hidden.visibility='private';hidden.quantity={value:987654321,unit:'PRIVATE_QTY_SENTINEL',provenance:'synthetic',note:'PRIVATE_NOTE_SENTINEL'};
 validateDocument(source);const before=JSON.stringify(source),raw=drawioDiagram(source,NOW);assert(!raw.includes('PRIVATE_'));assert(!raw.includes('987654321'));
 const {document,report}=await importDrawio(raw,'synthetic-public-quantity.drawio',{idSuffix:'quantity',now:NOW});
 assert.deepEqual(document.edges.filter(edge=>edge.quantity).map(edge=>edge.quantity),[shown.quantity]);assert.deepEqual(quantityLosses(report.lost),[]);
 assert(!JSON.stringify({document,report}).includes('PRIVATE_'));assert.equal(JSON.stringify(source),before);assert.equal(document.observations.length,0);
});

test('draw.io quantities: nonzero underflow is omitted rather than rounded to a false zero',async()=>{
 const values=['1e-9999','-1e-9999',' 0.0001E-9999 ','-0.0001E-9999','0.'+'0'.repeat(400)+'1','-5e-324'];
 const raw=rawQuantityPages([values.map(value=>quantityStyle(value,'ms','source-derived'))]),{document,report}=await importDrawio(raw,'synthetic-underflow.drawio',{idSuffix:'quantity',now:NOW});
 assert.equal(document.edges.length,values.length);assert(document.edges.every(edge=>edge.quantity===undefined));assert.deepEqual(quantityLosses(report.lost),[values.length+' '+QUANTITY_LOSS]);
 for(const value of values)assert(!JSON.stringify(report).includes(value.trim()),'fixed loss does not repeat the discarded numeric input');
 validateDocument(document);
});

test('draw.io quantities: true exponential zeros and representable subnormals retain supplied provenance',async()=>{
 const values=['0e-9999','0.000E+9999',' 0e-9999 ','5e-324','1e-323','0x0','0b0','0o0','0xf'],provenances=['author','synthetic','source-derived','reference'] as const;
 const rows=values.flatMap(value=>provenances.map(provenance=>({value,provenance}))),raw=rawQuantityPages([rows.map(row=>quantityStyle(row.value,'ms',row.provenance))]);
 const {document,report}=await importDrawio(raw,'synthetic-small-values.drawio',{idSuffix:'quantity',now:NOW});
 assert.equal(document.edges.length,rows.length);assert.deepEqual(quantityLosses(report.lost),[]);
 assert.deepEqual(document.edges.map(edge=>edge.quantity),rows.map(row=>({value:Number(row.value),unit:'ms',provenance:row.provenance})));
 assert.equal(document.edges[12].quantity!.value,Number.MIN_VALUE,'smallest representable positive value stays nonzero');
 const before=JSON.stringify(document),roundTrip=await importDrawio(drawioDiagram(document,NOW),'synthetic-small-roundtrip.drawio',{idSuffix:'again',now:NOW});
 assert.deepEqual(roundTrip.document.edges.map(edge=>edge.quantity),document.edges.map(edge=>edge.quantity));assert.deepEqual(quantityLosses(roundTrip.report.lost),[]);assert.equal(JSON.stringify(document),before);
});
