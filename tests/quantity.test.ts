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
