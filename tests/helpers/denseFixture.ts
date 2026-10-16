import {documentSchema,validateDocument,type Project} from '../../src/core/model';

/** Synthetic dense print fixture: nine components n0..n8 laid out on one row (too wide for paper), a zero-quantity
 * connection with an 80-character ID and a connection without a supplied amount. Synthetic only; never a measured result. */
export const DENSE_LONG_ID='zero-'+'z'.repeat(75);
export const DENSE_NOTE='Synthetic supplied zero across a publication page; no measured result.';
export function denseFixture():Project{
 const ids=Array.from({length:9},(_,i)=>'n'+i);
 return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-dense-print',title:'Synthetic dense print',rootViewId:'root',
  nodes:ids.map(id=>({id,label:'Synthetic '+id,basis:'planned'})),
  edges:[{id:DENSE_LONG_ID,source:'n7',target:'n8',label:'Supplied zero boundary',basis:'planned',quantity:{value:0,unit:'rows/day',provenance:'synthetic',note:DENSE_NOTE}},{id:'missing-edge',source:'n0',target:'n1',label:'No supplied amount',basis:'unknown'}],
  views:[{id:'root',title:'Synthetic dense supplied flow',nodeIds:ids,edgeIds:[DENSE_LONG_ID,'missing-edge'],positions:Object.fromEntries(ids.map((id,i)=>[id,{x:i*300,y:0}]))}]}));
}
