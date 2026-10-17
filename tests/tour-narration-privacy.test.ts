import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {addTour,addTourStop,recordStop,tourStops,type TourSubject} from '../src/core/tours';
import {portfolioHtml} from '../src/export/html';

// Synthetic marker only: never use a real customer's private information in fixtures.
const marker='SYNTHETIC_PRIVATE_CONTRACT_70000';
for(const hidden of [{kind:'node',id:'vault'},{kind:'edge',id:'api-vault'}] as TourSubject[]){
 test(`tours: mixed public/private ${hidden.kind} narration stays out of public JSON and HTML`,()=>{
  const initial=validateDocument({schemaVersion:1,id:'privacy',revision:3,title:'Public overview',rootViewId:'overview',
   nodes:[{id:'api',label:'API'},{id:'vault',label:'Internal vault',visibility:'private'}],
   edges:[{id:'api-vault',source:'api',target:'vault'}],
   views:[{id:'overview',title:'Overview',nodeIds:['api','vault'],edgeIds:['api-vault']}]});
  let doc=addTour(initial,{id:'walk',title:'Walk',visibility:'public',
   stop:recordStop(initial,'overview',[{kind:'node',id:'api'},hidden],marker)});
  doc=addTourStop(doc,'walk',recordStop(doc,'overview',[{kind:'node',id:'api'}],'Public explanation'));
  const original=JSON.stringify(doc),pub=publicDocument(doc);
  const [mixed,publicOnly]=pub.tours![0].stops;
  assert.deepEqual(mixed.subjects,[{kind:'node',id:'api'}]);
  assert.equal(mixed.omitted,'subjects');assert.equal(mixed.narration,'');
  assert.equal(publicOnly.narration,'Public explanation');
  assert.ok(!JSON.stringify(pub).includes(marker));
  assert.ok(!portfolioHtml(doc).includes(marker));
  assert.equal(tourStops(pub,pub.tours![0])[0].status,'current');
  assert.deepEqual(publicDocument(pub),pub,'a second projection cannot restore private narration');
  assert.equal(JSON.stringify(doc),original,'the authoring document and narration are preserved');
 });
}
