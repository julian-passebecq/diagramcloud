import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {planAssets,assetChecklistCsv} from '../src/intelligence/assets';
import {ICON_REGISTRY} from '../src/core/icons';
import {syntheticDeliveryProject} from './helpers/delivery';
import {customIconData} from './helpers/customIcon';
const fixture=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'recipe-assets',title:'Synthetic recipe asset scope',rootViewId:'root',nodes:[
 {id:'api',label:'API',basis:'static-source',icon:'generic-api'},
 {id:'shared',label:'=Private author label',basis:'unknown',icon:'unknown/path.svg',provider:'Named source provider',visibility:'private'},
 {id:'data',label:'Data',basis:'planned',icon:'generic-storage'},
 {id:'unrelated',label:'Outside selected views',basis:'planned'}],edges:[],views:[
 {id:'root',title:'System one',perspective:'system',nodeIds:['api','shared'],edgeIds:[],positions:{}},
 {id:'system-two',title:'System two',perspective:'system',nodeIds:['shared'],edgeIds:[],positions:{}},
 {id:'data-view',title:'Data lineage',perspective:'data',nodeIds:['data','shared'],edgeIds:[],positions:{}}]}));
test('recipe asset plans use unique current memberships, retain private provenance, and never mutate facts',()=>{
 const doc=fixture(),before=JSON.stringify(doc),plan=planAssets(doc,ICON_REGISTRY,{recipeId:'system'});
 assert.deepEqual(plan.scope?.viewIds,['root','system-two']);assert.deepEqual(plan.scope?.nodeIds,['api','shared']);
 assert.deepEqual(plan.requirements.map(r=>r.nodeId),['api','shared']);assert.equal(plan.scope?.availability,'partial');
 const fallback=plan.requirements.find(r=>r.nodeId==='shared')!;assert.equal(fallback.resolvedIcon,'generic');assert.equal(fallback.blocksRendering,false);assert.equal(fallback.recommendation,'official-asset-review');
 assert.ok(plan.limitations.some(l=>l.includes('private node labels')));assert.equal(JSON.stringify(doc),before);
 const csv=assetChecklistCsv(plan);assert.ok(csv.includes('"\'=Private author label"'));assert.ok(csv.includes('"recipe","system","root | system-two","partial"'));assert.ok(csv.includes('Private authoring checklist'));
 const filtered=planAssets(doc,ICON_REGISTRY,{recipeId:'system',analysis:{includeInferred:false,depth:'quick'}});assert.deepEqual(filtered.scope?.nodeIds,['api']);assert.equal(filtered.scope?.options?.depth,'quick');
 assert.deepEqual(planAssets(doc,ICON_REGISTRY,{recipeId:'data'}).scope?.nodeIds,['data','shared']);
});
test('unavailable or inapplicable recipes have an honest empty JSON and CSV receipt',()=>{
 const doc=fixture();for(const options of [{recipeId:'cloud'},{recipeId:'cloud',context:{archetypes:['documents']}},{recipeId:'system',context:{archetypes:[],repositoryId:'missing'}},{recipeId:'system',context:{archetypes:[],environmentId:'missing'}}]){
  const plan=planAssets(doc,ICON_REGISTRY,options);assert.equal(plan.requirements.length,0);assert.deepEqual(plan.scope?.nodeIds,[]);assert.equal(plan.scope?.availability,'unknown');assert.ok(plan.scope?.reason.includes('empty'));
  const csv=assetChecklistCsv(plan);assert.ok(csv.includes('"unknown"'));assert.ok(csv.includes('Private authoring checklist'));assert.ok(!csv.includes('Outside selected views'));
 }
 assert.equal(planAssets(doc,ICON_REGISTRY,{recipeId:'cloud',context:{archetypes:['documents']}}).scope?.state,'not-applicable');
 assert.throws(()=>planAssets(doc,ICON_REGISTRY,{recipeId:'invented'}),/Unknown/);assert.throws(()=>planAssets(doc,ICON_REGISTRY,{recipeId:'system',viewId:'root'}),/one/);
 assert.throws(()=>planAssets(doc,ICON_REGISTRY,{viewId:''}),/Unknown/);
 assert.throws(()=>planAssets(doc,ICON_REGISTRY,{recipeId:'system',analysis:{depth:'deep' as 'quick'}}));
});
test('recipe environment scope contains only supplied logical component and instance identities',()=>{
 const doc=syntheticDeliveryProject(),plan=planAssets(doc,ICON_REGISTRY,{recipeId:'system',context:{archetypes:['application'],environmentId:'dev'}});
 assert.deepEqual(plan.scope?.nodeIds,['api']);assert.equal(plan.scope?.context?.environmentId,'dev');assert.equal(doc.observations.length,0);
});
test('vendor identity and terms survive recipe planning while legacy view/project scopes remain supported',()=>{
 const doc=fixture();doc.nodes[0].icon='recorded-vendor';const source={repository:'synthetic/registered-artwork',commit:'a'.repeat(40),blob:'b'.repeat(40)},terms={name:'Recorded artwork terms',url:'https://example.invalid/terms'};
 const registry=[{id:'generic',origin:'original' as const},{id:'recorded-vendor',origin:'vendor' as const,source,terms}];
 const plan=planAssets(doc,registry,{recipeId:'system'});assert.deepEqual(plan.requirements[0].sourceIdentity,source);assert.deepEqual(plan.requirements[0].terms,terms);
 assert.ok(assetChecklistCsv(plan).includes(source.blob));assert.equal(planAssets(doc,registry,{viewId:'system-two'}).requirements.length,1);assert.equal(planAssets(doc,registry).requirements.length,4);
});
test('recipe custom artwork requirements keep exact author-recorded rights and visibility',()=>{
 const doc=fixture();doc.nodes[0].customIconAssetId='wide';doc.assets.push({id:'wide',name:'Private original test bands',data:customIconData(),rights:'Original synthetic test artwork; recorded MIT rights.',visibility:'private'});validateDocument(doc);
 const plan=planAssets(doc,ICON_REGISTRY,{recipeId:'system'}),row=plan.requirements.find(r=>r.nodeId==='api')!;
 assert.equal(row.customAssetId,'wide');assert.equal(row.origin,'project-asset');assert.equal(row.assetVisibility,'private');assert.equal(row.rights,doc.assets[0].rights);assert.ok(assetChecklistCsv(plan).includes(doc.assets[0].rights));
 assert.equal(JSON.stringify(plan).includes(customIconData()),false,'Checklist never embeds image bytes');
});
