import test from 'node:test';
import assert from 'node:assert/strict';
import {blockSchema,documentSchema,validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {captureSemanticContext,resolveSemanticContext} from '../src/core/savedContext';
import {compareEnvironments,deliveryGates,environmentCardNotes,isDataLayerName,previewDeliveryBrief} from '../src/intelligence/delivery';
import {projectNavigation} from '../src/intelligence/navigation';

// Synthetic fixture only: no real deployment, test run or promotion is described.
const base=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-environments',title:'Synthetic environments',rootViewId:'root',
 nodes:[{id:'api',label:'Synthetic API',visibility:'public'},{id:'worker',label:'Synthetic API',visibility:'public'},{id:'data',label:'Synthetic data',visibility:'public'}],edges:[],
 views:[{id:'root',title:'Synthetic system',nodeIds:['api','worker','data'],perspective:'system',visibility:'public'}]});
const brief=(p:Project)=>({format:'diagramcloud.delivery-brief',version:1,projectId:p.id,baseRevision:p.revision,delivery:{
 environments:[{id:'dev',label:'DEV'},{id:'test',label:'TEST'},{id:'prod',label:'PROD'}],artifacts:[{id:'build',label:'Synthetic build',version:'1',sourceRevision:'aaaaaaa'}],
 instances:[{id:'api-dev',nodeId:'api-dev-instance',componentId:'api',environmentId:'dev',artifactId:'build',declaredRevision:'aaaaaaa'},
  {id:'api-test',nodeId:'api-test-instance',componentId:'api',environmentId:'test',artifactId:'build',declaredRevision:'aaaaaaa'},
  {id:'worker-prod',nodeId:'worker-prod-instance',componentId:'worker',environmentId:'prod',declaredRevision:'aaaaaaa'}],
 promotions:[{id:'test-to-prod',fromEnvironmentId:'test',toEnvironmentId:'prod',artifactId:'build',gates:[{id:'suite',label:'Synthetic suite'}]}]}});
const at='2026-10-17T12:00:00Z';
const pass={id:'test-pass',nodeId:'api-test-instance',sourceApp:'external',authority:'Synthetic CI fixture',observedAt:'2026-10-17T10:00:00Z',sourceRevision:'aaaaaaa',claim:'verified' as const,
 summary:'Synthetic reported pass',blockIds:[] as string[],caveat:'Synthetic fixture; nothing was executed',visibility:'private' as const,shareable:false,reviewedAt:'2026-10-17T10:30:00Z'};
function seeded(){const p=base(),doc=previewDeliveryBrief(p,brief(p)).document;doc.observations=[{...pass}];doc.delivery!.promotions[0].gates[0].observationId='test-pass';return validateDocument(doc);}

test('a reported TEST pass shows only in the TEST card; DEV has no seeded claim and PROD stays UNKNOWN',()=>{
 const doc=seeded(),test=environmentCardNotes(doc,'test',{at}),dev=environmentCardNotes(doc,'dev',{at}),prod=environmentCardNotes(doc,'prod',{at});
 assert.equal(test.get('api')?.state,'reviewed-claim');assert.match(test.get('api')!.text,/^Declared instance in TEST · reviewed external claim verified by Synthetic CI fixture/);
 assert.equal(test.get('api-test-instance')?.state,'reviewed-claim');assert.equal(test.get('api-dev-instance')?.state,'instance-elsewhere');
 assert.equal(dev.get('api')?.state,'declared');assert.match(dev.get('api')!.text,/no reviewed claim/);assert.doesNotMatch(dev.get('api')!.text,/verified/);
 assert.equal(prod.get('api')?.state,'UNKNOWN');assert.equal(prod.get('api')!.text,'No declaration in PROD · UNKNOWN');
 assert.equal(prod.get('data')?.state,'UNKNOWN');assert.equal(prod.get('delivery-navigation'),undefined);
 assert.equal(environmentCardNotes(doc,'missing').size,0);assert.equal(environmentCardNotes(doc,null).size,0);
});

test('a promotion gate linked to the TEST claim is not an executed gate and PROD is not approved',()=>{
 const doc=seeded(),[promotion]=deliveryGates(doc,{at});
 assert.equal(promotion.targetApproval,'not-approved');assert.equal(promotion.gates[0].execution,'not-an-executed-gate');assert.equal(promotion.gates[0].result?.id,'test-pass');
 assert.equal(environmentCardNotes(doc,'prod',{at}).get('api')?.state,'UNKNOWN');
});

test('compareEnvironments pairs instances by componentId, never by label, and keeps equivalence UNKNOWN without separate cited evidence',()=>{
 const doc=seeded();
 // "worker" shares the label "Synthetic API" with "api" but is never paired with it.
 const rows=compareEnvironments(doc,'test','prod',{at}),api=rows.find(r=>r.componentId==='api')!,worker=rows.find(r=>r.componentId==='worker')!;
 assert.equal(api.to.length,0);assert.equal(worker.from.length,0);assert.equal(api.equivalence,'UNKNOWN');assert.equal(worker.equivalence,'UNKNOWN');
 // Two fresh reviewed claims without cited evidence: still UNKNOWN.
 doc.observations.push({...pass,id:'dev-pass',nodeId:'api-dev-instance'});
 assert.equal(compareEnvironments(doc,'dev','test',{at}).find(r=>r.componentId==='api')!.equivalence,'UNKNOWN');
 // Shared evidence is not separate evidence.
 doc.blocks.push(blockSchema.parse({id:'dev-log',type:'text',title:'Synthetic DEV record',text:'Synthetic record'}),blockSchema.parse({id:'test-log',type:'text',title:'Synthetic TEST record',text:'Synthetic record'}));
 doc.observations[0].blockIds=['test-log'];doc.observations[1].blockIds=['test-log'];
 assert.equal(compareEnvironments(doc,'dev','test',{at}).find(r=>r.componentId==='api')!.equivalence,'UNKNOWN');
 doc.observations[1].blockIds=['dev-log'];
 assert.equal(compareEnvironments(doc,'dev','test',{at}).find(r=>r.componentId==='api')!.equivalence,'cited-same-revision');
 doc.observations[1].sourceRevision='bbbbbbb';
 assert.equal(compareEnvironments(doc,'dev','test',{at}).find(r=>r.componentId==='api')!.equivalence,'cited-different-revisions');
 // Stale evidence falls back to UNKNOWN.
 assert.equal(compareEnvironments(doc,'dev','test',{at:'2026-10-20T12:00:00Z'}).find(r=>r.componentId==='api')!.equivalence,'UNKNOWN');
});

test('Bronze, Silver and Gold are refused as environments',()=>{
 for(const name of ['Gold','silver','BRONZE','gold layer','Silver-zone'])assert.equal(isDataLayerName(name),true,name);
 for(const name of ['PROD','Golden path','Gold release train'])assert.equal(isDataLayerName(name),false,name);
 const p=base(),input=brief(p);input.delivery.environments[2].label='Gold';
 assert.throws(()=>previewDeliveryBrief(p,input),/data layers, not environments/);
 const byId=brief(p);byId.delivery.environments[1].id='silver';byId.delivery.instances[1].environmentId='silver';
 assert.throws(()=>previewDeliveryBrief(p,byId),/data layers, not environments/);
});

test('a saved context captures the environment, restores it by exact ID and falls back visibly when lost, without changing path or perspective',()=>{
 const doc=seeded(),nav={path:['root'],view:'root',selected:'api',selectedEdge:null,sheet:'diagram' as const};
 const without=captureSemanticContext(doc,nav)!,withEnv=captureSemanticContext(doc,{...nav,environmentId:'test'})!;
 assert.equal(without.environmentId,null);assert.equal(withEnv.environmentId,'test');
 assert.deepEqual({...withEnv,environmentId:null},without,'the environment changes no other dimension');
 const kept=resolveSemanticContext(doc,withEnv,()=>false);assert.equal(kept.state,'restored');assert.deepEqual(kept.dimensions.find(d=>d.dimension==='environment'),{dimension:'environment',state:'kept'});
 assert.deepEqual(kept.navigation.path,['root']);assert.equal(kept.dimensions.find(d=>d.dimension==='perspective')?.state,'kept');
 const gone=structuredClone(doc);gone.delivery!.environments=gone.delivery!.environments.filter(e=>e.id!=='prod');
 const lost=resolveSemanticContext(gone,{...withEnv,environmentId:'prod'},()=>false);
 assert.equal(lost.state,'partial');assert.equal(lost.dimensions.find(d=>d.dimension==='environment')?.state,'fallback');assert.equal(lost.navigation.view,'root');assert.equal(lost.navigation.selected,'api');
 // A similarly labelled environment is never substituted.
 gone.delivery!.environments.push({id:'production',label:'PROD',description:'',sourceIds:[],visibility:'private'});
 assert.equal(resolveSemanticContext(gone,{...withEnv,environmentId:'prod'},()=>false).dimensions.find(d=>d.dimension==='environment')?.state,'fallback');
});

test('the public projection never lists a private environment for the studio selection',()=>{
 const doc=seeded(),safe=publicDocument(doc);
 assert.equal(safe.delivery?.environments.some(e=>e.id==='test')??false,false);assert.equal(environmentCardNotes(safe,'test').size,0);
 assert.deepEqual(projectNavigation(doc,{publicMode:true}).environments,[]);
 const filtered=projectNavigation(doc,{environmentId:'test'});assert.equal(filtered.selectionVisible('api'),true);assert.equal(filtered.selectionVisible('worker'),false);
});
