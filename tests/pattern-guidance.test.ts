import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {matchesCatalogueEntry,guidanceSchema,patternCatalog,patternSchema,recipeRegistry,recipeSchema,validateRecipeRegistry,validatePatternCatalog,classifyPatterns,recommendRecipes,contextualRecipes} from '../src/intelligence/recipes';
import {queryProject} from '../src/intelligence/context';
import {DEFAULT_OPTIONS} from '../src/intelligence/types';

const project=()=>documentSchema.parse({schemaVersion:1,id:'guidance-fixture',title:'Synthetic guidance fixture',rootViewId:'root',nodes:[{id:'raw',label:'Raw',kind:'storage',tags:['fabric'],sourceIds:['source']},{id:'transform',label:'Transform',kind:'process',sourceIds:['source']}],edges:[{id:'flow',source:'raw',target:'transform',basis:'planned'}],views:[{id:'root',title:'Existing data view',perspective:'data',nodeIds:['raw','transform'],edgeIds:['flow'],positions:{raw:{x:0,y:0},transform:{x:300,y:0}}}],sources:[{id:'source',title:'Synthetic authored source',location:'Synthetic fixture, not runtime evidence',visibility:'public'}]});
const medallion=()=>structuredClone(patternCatalog.find(row=>row.id==='medallion')!.guidance!);
const jobs=()=>structuredClone(recipeRegistry.find(row=>row.id==='jobs')!.guidance!);

test('selected authored cards retain native identities, distinct alternatives and unknown applicability',()=>{
 assert.deepEqual(patternCatalog.map(row=>row.id),['c4','modular-monolith','medallion','event','migration']);assert.equal(recipeRegistry.length,7);
 assert.deepEqual(patternCatalog.filter(row=>row.guidance).map(row=>row.id),['c4','modular-monolith','medallion','event','migration']);assert.deepEqual(recipeRegistry.filter(row=>row.guidance).map(row=>row.id),['jobs']);
 assert.deepEqual([medallion().topicKey,jobs().topicKey],['lakehouse-medallion','spark-production']);
 for(const card of [medallion(),jobs()]){assert.equal(card.basis,'authored-illustrative-guidance');assert.equal(card.applicability,'UNKNOWN_NOT_ASSESSED');assert.equal(card.contentRevision,'2026-10-15.1');assert.equal(card.packetReviewedOn,'2026-10-14');assert.ok(card.alternatives.length>=3);assert.ok(card.contraindications.length>=2);assert.ok(card.limits.some(row=>/UNKNOWN|unassessed|not assessed|not a|not an/.test(row.text)));assert.ok(card.sources.every(source=>source.retrievedOn==='2026-10-15'&&source.externalRevision===null));}
 assert.ok(jobs().contraindications.some(row=>row.text.includes('notebooks are inherently bad')));assert.ok(medallion().contraindications.some(row=>row.text.includes('physical copies')));
});

test('guidance rejects malformed, over-budget, unsafe and ambiguous source claims without rewriting inputs',()=>{
 const card=medallion(),before=structuredClone(card);assert.deepEqual(guidanceSchema.parse(card),card);
 for(const invalid of [{...card,grant:'execute'},{...card,applicability:'verified'},{...card,problem:{text:'   ',sourceKeys:[]}},{...card,conditions:[]},{...card,conditions:Array.from({length:7},()=>card.conditions[0])},{...card,problem:{text:'x'.repeat(601),sourceKeys:[]}},{...card,packetReviewedOn:'2026-02-30'},{...card,sources:[...card.sources,card.sources[0]]},{...card,problem:{text:'Unbound claim',sourceKeys:['absent']}},{...card,problem:{text:'Ambiguous ref',sourceKeys:['medallion','medallion']}}])assert.equal(guidanceSchema.safeParse(invalid).success,false);
 for(const url of ['javascript:alert(1)','data:text/html,private','file:///C:/private.txt','https://user:secret@example.invalid/'])assert.equal(guidanceSchema.safeParse({...card,sources:card.sources.map((source,index)=>index===0?{...source,url}:source)}).success,false);
 assert.equal(guidanceSchema.safeParse({...card,sources:card.sources.map((source,index)=>index===0?{...source,externalRevision:' '}:source)}).success,false);
 assert.deepEqual(card,before);
});

test('legacy schemas remain readable while duplicate registry identities and guidance bindings are refused',()=>{
 for(const row of recipeRegistry){const {guidance,...legacy}=row;assert.equal(recipeSchema.safeParse(legacy).success,true);}
 for(const row of patternCatalog){const {guidance,...legacy}=row;assert.equal(patternSchema.safeParse(legacy).success,true);}
 assert.throws(()=>validateRecipeRegistry([...recipeRegistry,recipeRegistry[0]]),/Duplicate recipe ID/);assert.throws(()=>validatePatternCatalog([...patternCatalog,patternCatalog[0]]),/Duplicate pattern ID/);
 assert.throws(()=>validateRecipeRegistry(recipeRegistry.map(row=>['jobs','system'].includes(row.id)?{...row,guidance:jobs()}:row)),/Duplicate guidance topic/);
 assert.throws(()=>validatePatternCatalog(patternCatalog.map(row=>['medallion','c4'].includes(row.id)?{...row,guidance:medallion()}:row)),/Duplicate guidance topic/);
});

test('static advice survives actual recipe/query propagation without turning unavailable facts into an available execution',()=>{
 const p=project(),before=JSON.stringify(p),rows=contextualRecipes(p,DEFAULT_OPTIONS),job=rows.find(row=>row.id==='jobs')!;
 assert.equal(job.availability,'unknown');assert.equal(job.guidance?.topicKey,'spark-production');assert.equal(job.guidance?.applicability,'UNKNOWN_NOT_ASSESSED');
 const out=queryProject(p,{kind:'recipes'}),data=out.data as typeof rows;assert.equal(data.find(row=>row.id==='jobs')?.guidance?.contentRevision,'2026-10-15.1');
 const unavailable=recommendRecipes(p,DEFAULT_OPTIONS,{repositoryId:'not-supplied'});assert.ok(unavailable.every(row=>row.availability==='unknown'&&row.viewIds.length===0));assert.equal(unavailable.find(row=>row.id==='jobs')?.guidance?.applicability,'UNKNOWN_NOT_ASSESSED');
 assert.equal(JSON.stringify(p),before);assert.equal(p.observations.length,0);assert.equal(new TextEncoder().encode(JSON.stringify(out)).byteLength<1024*1024,true);
});

test('public advice and recognition do not change when invisible private facts, tags and citations are added',()=>{
 const p=project();p.nodes.forEach(node=>node.tags=[]);const baseline=publicDocument(p),before=JSON.stringify(p),hidden=structuredClone(p);
 hidden.nodes.push({...hidden.nodes[1],id:'hidden',label:'PRIVATE_GUIDANCE_SENTINEL',kind:'process',tags:['databricks'],sourceIds:['hidden-source'],visibility:'private'});hidden.sources.push({id:'hidden-source',title:'PRIVATE_GUIDANCE_SENTINEL',location:'private://sentinel',visibility:'private'});hidden.views[0].nodeIds.push('hidden');hidden.views[0].positions.hidden={x:600,y:0};hidden.edges.push({...hidden.edges[0],id:'hidden-flow',target:'hidden'});hidden.views[0].edgeIds.push('hidden-flow');validateDocument(hidden);
 assert.equal(classifyPatterns(hidden).find(row=>row.id==='medallion')!.state,'candidate');assert.equal(classifyPatterns(baseline).find(row=>row.id==='medallion')!.state,'not-established');assert.equal(recommendRecipes(hidden,DEFAULT_OPTIONS).find(row=>row.id==='jobs')!.availability,'available');
 assert.deepEqual(queryProject(hidden,{kind:'recipes'}),queryProject(p,{kind:'recipes'}));assert.deepEqual(classifyPatterns(publicDocument(hidden)),classifyPatterns(baseline));assert.ok(!JSON.stringify(queryProject(hidden,{kind:'recipes'})).includes('PRIVATE_GUIDANCE_SENTINEL'));
 const card=medallion();assert.ok(!JSON.stringify(card).includes('hidden-source'));assert.equal(JSON.stringify(p),before);
});

test('candidate recognition remains limited while returned advice cannot mutate registry or canonical Project',()=>{
 const p=project(),before=JSON.stringify(p),match=classifyPatterns(p).find(row=>row.id==='medallion')!;assert.equal(match.state,'candidate');assert.deepEqual(match.sourceIds,['source']);assert.ok(match.gaps.length>0);assert.equal(match.guidance?.applicability,'UNKNOWN_NOT_ASSESSED');
 match.guidance!.problem.text='Mutated caller copy';const response=recommendRecipes(p,DEFAULT_OPTIONS).find(row=>row.id==='jobs')!;response.guidance!.sources[0].title='Mutated caller copy';assert.notEqual(medallion().problem.text,'Mutated caller copy');assert.notEqual(jobs().sources[0].title,'Mutated caller copy');
 p.nodes.forEach(node=>node.tags=[]);p.nodes[0].label='Bronze Silver Gold';assert.equal(classifyPatterns(p).find(row=>row.id==='medallion')!.state,'not-established');assert.equal(p.observations.length,0);
 const original=project();classifyPatterns(original);contextualRecipes(original,DEFAULT_OPTIONS);queryProject(original,{kind:'recipes'});assert.equal(JSON.stringify(original),before);
});

test('returned legacy requirement arrays and objects cannot change later recognition or query callers',()=>{
 const p=project(),before=JSON.stringify(p),patternsBefore=structuredClone(patternCatalog),recipesBefore=structuredClone(recipeRegistry);
 const patterns=classifyPatterns(p),patternSnapshot=structuredClone(patterns),medallionRow=patterns.find(row=>row.id==='medallion')!;
 medallionRow.requiredKinds.splice(0,medallionRow.requiredKinds.length,'control');
 medallionRow.requiredTags.push('caller-only-tag');
 medallionRow.evidenceRequirements.push('caller-only-evidence');
 medallionRow.gaps.splice(0,medallionRow.gaps.length,'caller-only-gap');
 const recipes=contextualRecipes(p,DEFAULT_OPTIONS),recipeSnapshot=structuredClone(recipes),job=recipes.find(row=>row.id==='jobs')!;
 job.requirements.perspectives.splice(0,job.requirements.perspectives.length,'evidence');
 job.requirements.tags.push('caller-only-tag');job.requirements.relationships=false;
 const query=queryProject(p,{kind:'recipes'}),querySnapshot=structuredClone(query),queryRows=query.data as typeof recipes;
 queryRows.find(row=>row.id==='jobs')!.requirements.tags.splice(0,1,'caller-only-query-tag');
 assert.deepEqual(patternCatalog,patternsBefore);assert.deepEqual(recipeRegistry,recipesBefore);
 assert.deepEqual(classifyPatterns(p),patternSnapshot);assert.deepEqual(contextualRecipes(p,DEFAULT_OPTIONS),recipeSnapshot);
 assert.deepEqual(queryProject(p,{kind:'recipes'}),querySnapshot);assert.equal(JSON.stringify(p),before);
});


test('three additive catalogue cards retain original topic bindings, useful alternatives, synthetic input/output and distinct source dates',()=>{
 const expected=[['c4','c4','c4-context',null],['modular-monolith','modular-monolith','dotnet-boundaries','2023-03-07'],['event','event-driven','event-style','2026-03-07']] as const;
 for(const [id,topic,sourceKey,pageUpdatedOn] of expected){
  const row=patternCatalog.find(row=>row.id===id)!,card=row.guidance!;assert.equal(row.version,1);assert.equal(row.illustrative,true);assert.equal(card.topicKey,topic);assert.equal(card.applicability,'UNKNOWN_NOT_ASSESSED');assert.equal(card.basis,'authored-illustrative-guidance');assert.deepEqual(guidanceSchema.parse(card),card);
  assert.equal(card.contentRevision,'2026-10-15.1');assert.equal(card.packetReviewedOn,'2026-10-14');assert.equal(card.sources[0].retrievedOn,'2026-10-15');assert.equal(card.sources[0].pageUpdatedOn,pageUpdatedOn);assert.equal(card.sources[0].externalRevision,null);assert.equal(card.sources[0].key,sourceKey);
  assert.ok(card.conditions.length>=2&&card.contraindications.length>=2&&card.alternatives.length>=2&&card.tradeoffs.length>=2);assert.ok(card.limits.some(statement=>/Synthetic example: input/i.test(statement.text)&&/output/i.test(statement.text)));assert.ok(card.limits.some(statement=>/not|UNKNOWN|unassessed/.test(statement.text)));
  assert.ok(Object.values(card.levels).every(statement=>statement.text.includes('?')||statement.text.includes('UNKNOWN')));assert.equal(patternSchema.safeParse({...row,guidance:{...card,observed:true}}).success,false);
 }
 assert.equal(patternCatalog.find(row=>row.id==='migration')!.guidance?.topicKey,'migration');assert.equal(recipeRegistry.find(row=>row.id==='interfaces')!.guidance,undefined);
});

test('new static guidance cannot establish a pattern, select a view, add an occurrence or substitute for deployment evidence',()=>{
 const p=project(),before=JSON.stringify(p),newIds=['c4','modular-monolith','event'];
 for(const id of newIds){const row=classifyPatterns(p).find(row=>row.id===id)!;assert.equal(row.state,'not-established');assert.ok(row.guidance);assert.deepEqual(row.nodeIds,[]);assert.deepEqual(row.relationshipIds,[]);assert.deepEqual(row.sourceIds,[]);assert.ok(row.gaps.length>0);}
 const named=structuredClone(p);named.nodes.forEach(node=>{node.kind='report';node.label='C4 modular-monolith event-driven';node.tags=['dotnet'];});assert.ok(classifyPatterns(named).filter(row=>newIds.includes(row.id)).every(row=>row.state==='not-established'));
 const supplied=project();supplied.nodes[0].kind='app';supplied.nodes[0].tags=['dotnet'];supplied.nodes[1].kind='function';
 for(const [id,kind] of [['provided-store','storage'],['provided-source','source'],['provided-process','process']] as const){supplied.nodes.push({...supplied.nodes[1],id,kind,label:id});supplied.views[0].nodeIds.push(id);}validateDocument(supplied);
 const candidates=classifyPatterns(supplied).filter(row=>newIds.includes(row.id));assert.ok(candidates.every(row=>row.state==='candidate'&&row.guidance?.applicability==='UNKNOWN_NOT_ASSESSED'));assert.ok(candidates.find(row=>row.id==='modular-monolith')!.gaps.includes('Deployment topology'));assert.ok(candidates.find(row=>row.id==='event')!.gaps.includes('Delivery guarantees'));
 const suppliedBefore=JSON.stringify(supplied);classifyPatterns(supplied);recommendRecipes(supplied,DEFAULT_OPTIONS);contextualRecipes(supplied,DEFAULT_OPTIONS);queryProject(supplied,{kind:'recipes'});assert.equal(JSON.stringify(supplied),suppliedBefore);assert.deepEqual(supplied.observations,[]);assert.equal(JSON.stringify(p),before);
});

test('invisible private kinds, tags and citations cannot change new public guidance or recognition',()=>{
 const p=project(),hidden=structuredClone(p),privateSource='private-new-catalogue-source';hidden.sources.push({id:privateSource,title:'PRIVATE_NEW_CATALOGUE_SOURCE',location:'PRIVATE_NEW_CATALOGUE_LOCATOR',visibility:'private'});
 for(const [id,kind] of [['private-app','app'],['private-function','function'],['private-source-node','source']] as const){hidden.nodes.push({...hidden.nodes[0],id,kind,label:'PRIVATE_NEW_CATALOGUE_NODE',tags:['dotnet'],sourceIds:[privateSource],visibility:'private'});hidden.views[0].nodeIds.push(id);}validateDocument(hidden);
 const before=JSON.stringify(hidden),publicRows=classifyPatterns(publicDocument(hidden));assert.deepEqual(publicRows,classifyPatterns(publicDocument(p)));assert.deepEqual(queryProject(hidden,{kind:'recipes'}),queryProject(p,{kind:'recipes'}));
 for(const id of ['c4','modular-monolith','event']){assert.equal(classifyPatterns(hidden).find(row=>row.id===id)!.state,'candidate');assert.equal(publicRows.find(row=>row.id===id)!.state,'not-established');assert.ok(!JSON.stringify(publicRows.find(row=>row.id===id)!.guidance).includes('PRIVATE_NEW_CATALOGUE'));}
 assert.equal(JSON.stringify(hidden),before);assert.deepEqual(hidden.observations,[]);
});

test('new card response mutation cannot change static sources, later comparisons or canonical Project',()=>{
 const p=project(),before=JSON.stringify(p),registryBefore=structuredClone(patternCatalog),rows=classifyPatterns(p),snapshot=structuredClone(rows);
 for(const id of ['c4','modular-monolith','event']){const row=rows.find(row=>row.id===id)!;row.guidance!.levels.macro.text='Caller edit';row.guidance!.sources[0].title='Caller source';row.guidance!.conditions[0].sourceKeys.push('caller-only-key');row.guidance!.alternatives.splice(0,1);}
 assert.deepEqual(patternCatalog,registryBefore);assert.deepEqual(classifyPatterns(p),snapshot);assert.equal(JSON.stringify(p),before);
});


test('catalogue display search finds native identity, question and topic without turning missing facts into a match',()=>{
 const p=project(),recipes=contextualRecipes(p,DEFAULT_OPTIONS),patterns=classifyPatterns(p);
 assert.deepEqual(patterns.filter(row=>matchesCatalogueEntry(row,'  C4  ')).map(row=>row.id),['c4']);
 const c4=patterns.find(row=>row.id==='c4')!;assert.equal(c4.state,'not-established');assert.equal(matchesCatalogueEntry(c4,'container explanation','supplied'),true);assert.ok(c4.gaps.length>0);
 const job=recipes.find(row=>row.id==='jobs')!;assert.equal(job.availability,'unknown');assert.equal(matchesCatalogueEntry(job,'WHICH DECLARED WORK ITEMS'),true);assert.equal(matchesCatalogueEntry(job,'spark-production','supplied'),true);
 const migration=patterns.find(row=>row.id==='migration')!;assert.equal(matchesCatalogueEntry(migration,'migration','not-supplied'),false);assert.equal(matchesCatalogueEntry(migration,'migration','supplied'),true);const legacy=recipes.find(row=>row.id==='interfaces')!;assert.equal(matchesCatalogueEntry(legacy,'interfaces','not-supplied'),true);assert.equal(matchesCatalogueEntry(legacy,'interfaces','supplied'),false);assert.equal(matchesCatalogueEntry(job,'','not-supplied'),false);
 assert.ok([...recipes,...patterns].every(row=>matchesCatalogueEntry(row,' 	 ')));assert.ok([...recipes,...patterns].every(row=>!matchesCatalogueEntry(row,'.*')));assert.ok([...recipes,...patterns].every(row=>!matchesCatalogueEntry(row,'no-such-static-entry')));
});

test('catalogue filtering preserves produced order, candidate evidence, registry isolation, analysis options and authoring data',()=>{
 const p=project(),before=JSON.stringify(p),options=structuredClone(DEFAULT_OPTIONS),optionsBefore=structuredClone(options),registryBefore=structuredClone([recipeRegistry,patternCatalog]);
 const recipes=contextualRecipes(p,options),patterns=classifyPatterns(p),recipeSnapshot=structuredClone(recipes),patternSnapshot=structuredClone(patterns);
 assert.deepEqual(recipes.filter(row=>matchesCatalogueEntry(row,'')),recipeSnapshot);assert.deepEqual(patterns.filter(row=>matchesCatalogueEntry(row,'')),patternSnapshot);
 for(const query of ['', 'pipeline', 'C4', 'declared work', 'absent-static-question'])for(const guidance of ['all','supplied','not-supplied'] as const){
  const shown=patterns.filter(row=>matchesCatalogueEntry(row,query,guidance));
  for(const row of shown)assert.deepEqual(row,patternSnapshot.find(original=>original.id===row.id));
  for(const row of recipes.filter(row=>matchesCatalogueEntry(row,query,guidance)))assert.deepEqual(row,recipeSnapshot.find(original=>original.id===row.id));
 }
 assert.deepEqual(recipes,recipeSnapshot);assert.deepEqual(patterns,patternSnapshot);assert.deepEqual([recipeRegistry,patternCatalog],registryBefore);assert.deepEqual(options,optionsBefore);assert.deepEqual(contextualRecipes(p,options),recipes);assert.equal(JSON.stringify(p),before);
});

test('static catalogue results cannot be discovered through private labels, citations, match reasons or runtime fields',()=>{
 const p=project(),hidden=structuredClone(p),sentinel='PRIVATE_CATALOGUE_SEARCH_SENTINEL',sourceId='private-catalogue-search-sentinel';hidden.sources.push({id:sourceId,title:sentinel,location:sentinel,visibility:'private'});
 hidden.nodes.push({...hidden.nodes[0],id:'hidden-app',label:sentinel,kind:'app',tags:['dotnet'],sourceIds:[sourceId],visibility:'private'});hidden.views[0].nodeIds.push('hidden-app');validateDocument(hidden);
 const before=JSON.stringify(hidden),rows=classifyPatterns(hidden),authorSnapshot=structuredClone(rows);assert.ok(rows.some(row=>row.sourceIds.includes(sourceId)));
 const contextual={...rows[0],reason:sentinel,sourceIds:[sourceId],matchReasons:[sentinel],label:sentinel};assert.equal(matchesCatalogueEntry(contextual,sentinel),false);assert.equal(matchesCatalogueEntry(contextual,sourceId),false);
 const publicRows=classifyPatterns(publicDocument(p)),publicHidden=classifyPatterns(publicDocument(hidden)),publicRecipes=contextualRecipes(publicDocument(p),DEFAULT_OPTIONS),hiddenPublicRecipes=contextualRecipes(publicDocument(hidden),DEFAULT_OPTIONS);
 for(const query of ['',sentinel,sourceId,'c4','event-driven','migration'])for(const guidance of ['all','supplied','not-supplied'] as const){
  assert.deepEqual(publicHidden.filter(row=>matchesCatalogueEntry(row,query,guidance)),publicRows.filter(row=>matchesCatalogueEntry(row,query,guidance)));
  assert.deepEqual(hiddenPublicRecipes.filter(row=>matchesCatalogueEntry(row,query,guidance)),publicRecipes.filter(row=>matchesCatalogueEntry(row,query,guidance)));
  assert.deepEqual(rows.filter(row=>matchesCatalogueEntry(row,query,guidance)).map(row=>row.id),publicRows.filter(row=>matchesCatalogueEntry(row,query,guidance)).map(row=>row.id));
 }
 assert.deepEqual(rows,authorSnapshot);assert.equal(JSON.stringify(hidden),before);assert.deepEqual(hidden.observations,[]);
});


// Editorial reference families are independent of Project kinds, tags and runtime suitability.
test('five authored reference families retain exact packet row identity without promoting applicability',()=>{
 const bindings=[['pattern','c4','c4','Fondations'],['pattern','modular-monolith','modular-monolith','Applications'],['pattern','event','event-driven','Applications'],['pattern','medallion','lakehouse-medallion','Data'],['recipe','jobs','spark-production','Data']];
 for(const [kind,id,topic,family] of bindings){
  const card=(kind==='pattern'?patternCatalog:recipeRegistry).find(row=>row.id===id)!.guidance!;
  assert.equal(card.topicKey,topic);assert.equal(card.catalogueClassification!.family,family);assert.equal(card.catalogueClassification!.basis,'packet-authored-reference-topic-family');
  assert.deepEqual(card.catalogueClassification!.source,{archiveSha256:'d397fa79d23785dc3c387722a8e52cfef6a19e256fe41fca791c1dd808c2a707',entry:'DiagramCloud_V2_Catalogue_IT_r2_2026-10-14/catalogue.csv',entrySha256:'991cdfcfac2dab0218a56df35808d0c9ebfe65eeb9c60eb5ff3dd00139666c4d',topicKey:topic});
  assert.equal(card.applicability,'UNKNOWN_NOT_ASSESSED');assert.ok(card.sources.every(source=>source.externalRevision===null));
 }
 const original=medallion(),{catalogueClassification,...legacy}=original;assert.deepEqual(guidanceSchema.parse(legacy),legacy);assert.equal(original.contentRevision,legacy.contentRevision);
});

test('reference classification refuses contradictory topics, families, source identities and invented capabilities',()=>{
 const card=medallion(),classification=card.catalogueClassification!,before=JSON.stringify(card);
 for(const invalid of [
  {...classification,family:'Applications'}, {...classification,family:'Data engineering'}, {...classification,family:' '}, {...classification,family:'x'.repeat(601)},
  {...classification,platform:'Fabric'}, {...classification,classificationRevision:' '}, {...classification,basis:'verified'},
  {...classification,source:{...classification.source,topicKey:'spark-production'}}, {...classification,source:{...classification.source,topicKey:'unknown'}},
  {...classification,source:{...classification.source,entrySha256:'0'.repeat(64)}}, {...classification,source:{...classification.source,archiveSha256:'0'.repeat(64)}},
  {...classification,source:{...classification.source,entry:'private/client.csv'}}, {...classification,source:{...classification.source,sourceId:'private'}}
 ])assert.equal(guidanceSchema.safeParse({...card,catalogueClassification:invalid}).success,false);
 assert.equal(guidanceSchema.safeParse({...card,topicKey:'unknown'}).success,false);assert.equal(guidanceSchema.safeParse({...card,catalogueClassification:[classification,classification]}).success,false);assert.equal(JSON.stringify(card),before);
});

test('family discovery is an AND display filter with unknown recovery and no inferred classification',()=>{
 const p=project(),before=JSON.stringify(p),recipes=contextualRecipes(p,DEFAULT_OPTIONS),patterns=classifyPatterns(p),rows=[...recipes,...patterns],snapshot=structuredClone(rows);
 assert.deepEqual(rows.filter(row=>matchesCatalogueEntry(row,'','all','Data')).map(row=>row.id).sort(),['jobs','medallion']);
 assert.deepEqual(rows.filter(row=>matchesCatalogueEntry(row,'','all','Applications')).map(row=>row.id),['modular-monolith','event']);
 assert.deepEqual(rows.filter(row=>matchesCatalogueEntry(row,'','all','Fondations')).map(row=>row.id),['c4']);
 assert.deepEqual(rows.filter(row=>matchesCatalogueEntry(row,'','all','not-supplied')).map(row=>row.id).sort(),['cloud','data','evidence','interfaces','knowledge','migration','system']);
 assert.equal(rows.filter(row=>matchesCatalogueEntry(row,'jobs','not-supplied','Data')).length,0);assert.equal(rows.filter(row=>matchesCatalogueEntry(row,'migration','all','Data')).length,0);assert.equal(rows.filter(row=>matchesCatalogueEntry(row,'jobs','all','Applications')).length,0);
 assert.deepEqual(rows.filter(row=>matchesCatalogueEntry(row,'','all','all')),snapshot);
 const spoof={...patterns.find(row=>row.id==='migration')!,title:'Data Azure Spark',tags:['Data','fabric','azure'],platform:'Data',family:'Data',reason:'Data'};
 assert.equal(matchesCatalogueEntry(spoof,'','all','Data'),false);assert.equal(matchesCatalogueEntry(spoof,'','all','not-supplied'),true);assert.equal(matchesCatalogueEntry(spoof,'','all','not-a-family' as never),false);
 for(const row of rows.filter(row=>matchesCatalogueEntry(row,'','all','Data')))assert.deepEqual(row,snapshot.find(original=>original.id===row.id));assert.deepEqual(rows,snapshot);assert.equal(JSON.stringify(p),before);
});

test('returned classification source records are copied independently for patterns and recipes',()=>{
 const p=project(),before=JSON.stringify(p),registries=structuredClone([recipeRegistry,patternCatalog]),patternBaseline=classifyPatterns(p),recipeBaseline=contextualRecipes(p,DEFAULT_OPTIONS);
 const pattern=classifyPatterns(p).find(row=>row.id==='medallion')!,recipe=contextualRecipes(p,DEFAULT_OPTIONS).find(row=>row.id==='jobs')!;
 pattern.guidance!.catalogueClassification!.family='Applications';pattern.guidance!.catalogueClassification!.source.topicKey='caller-edit';recipe.guidance!.catalogueClassification!.source.topicKey='caller-edit';
 assert.deepEqual(classifyPatterns(p),patternBaseline);assert.deepEqual(contextualRecipes(p,DEFAULT_OPTIONS),recipeBaseline);assert.deepEqual([recipeRegistry,patternCatalog],registries);assert.equal(JSON.stringify(p),before);
});

test('public family discovery cannot depend on private tags, source locators or dynamic match fields',()=>{
 const p=project(),hidden=structuredClone(p),marker='PRIVATE_FAMILY_DATA_SENTINEL';hidden.sources.push({id:'private-family-source',title:marker,location:marker,visibility:'private'});hidden.nodes.push({...hidden.nodes[0],id:'private-family-node',label:marker,tags:['Data','Applications','Fondations','azure'],visibility:'private',sourceIds:['private-family-source']});hidden.views[0].nodeIds.push('private-family-node');validateDocument(hidden);
 const before=JSON.stringify(hidden),left=[...contextualRecipes(publicDocument(p),DEFAULT_OPTIONS),...classifyPatterns(publicDocument(p))],right=[...contextualRecipes(publicDocument(hidden),DEFAULT_OPTIONS),...classifyPatterns(publicDocument(hidden))];
 for(const family of ['all','not-supplied','Data','Applications','Fondations'] as const)for(const query of ['',marker,'private-family-source','jobs','migration'])assert.deepEqual(left.filter(row=>matchesCatalogueEntry(row,query,'all',family)),right.filter(row=>matchesCatalogueEntry(row,query,'all',family)));
 assert.ok(right.every(row=>!matchesCatalogueEntry(row,marker)));assert.equal(JSON.stringify(hidden),before);assert.deepEqual(hidden.observations,[]);
});


// Migration advice fills one native card; it does not supply a transition or change recognition.
test('migration guidance keeps native requirements and unknown family with distinct primary-source dates',()=>{
 const row=patternCatalog.find(row=>row.id==='migration')!,{guidance,...native}=row,card=guidance!;
 assert.deepEqual(native,{id:'migration',version:1,title:'Migration design candidate',illustrative:true,requiredKinds:['source','storage'],requiredTags:[],evidenceRequirements:['Explicit before/after scope','Author-approved transition plan','External migration checks']});
 assert.deepEqual(guidanceSchema.parse(card),card);assert.equal(card.topicKey,'migration');assert.equal(card.contentRevision,'2026-10-15.1');assert.equal(card.packetReviewedOn,'2026-10-14');assert.equal(card.basis,'authored-illustrative-guidance');assert.equal(card.applicability,'UNKNOWN_NOT_ASSESSED');assert.equal(card.catalogueClassification,undefined);
 assert.deepEqual(card.sources.map(source=>[source.key,source.url,source.retrievedOn,source.pageUpdatedOn,source.externalRevision]),[
  ['strangler','https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig','2026-10-15','2026-06-02',null],
  ['translation','https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer','2026-10-15','2026-05-30',null],
  ['migration-planning','https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/migrate/plan-migration','2026-10-15','2025-08-01',null]]);
 assert.ok(card.conditions.length>=3&&card.contraindications.length>=3&&card.alternatives.length>=3&&card.tradeoffs.length>=3);assert.ok(card.limits.some(statement=>statement.text.includes('Synthetic example: input')&&statement.text.includes('output')));assert.ok(card.levels.micro.text.includes('recovery point objective'));assert.ok(Object.values(card.levels).every(statement=>statement.text.includes('?')));
 const classification=medallion().catalogueClassification!;
 for(const family of ['Cloud','Data'])assert.equal(guidanceSchema.safeParse({...card,catalogueClassification:{...classification,family,source:{...classification.source,topicKey:'migration'}}}).success,false);
 assert.equal(matchesCatalogueEntry(row,'migration','supplied','not-supplied'),true);assert.equal(matchesCatalogueEntry(row,'migration','supplied','Data'),false);assert.equal(recipeRegistry.find(row=>row.id==='interfaces')!.guidance,undefined);
});

test('migration candidate still lacks approved transition and external checks and labels cannot supply missing kinds',()=>{
 const p=project();p.nodes[1].kind='source';validateDocument(p);const before=JSON.stringify(p),row=classifyPatterns(p).find(row=>row.id==='migration')!;
 assert.equal(row.state,'candidate');assert.equal(row.guidance!.applicability,'UNKNOWN_NOT_ASSESSED');assert.deepEqual(row.nodeIds,['raw','transform']);assert.deepEqual(row.relationshipIds,['flow']);assert.deepEqual(row.sourceIds,['source']);assert.deepEqual(row.gaps,['Explicit before/after scope','Author-approved transition plan','External migration checks']);
 assert.ok(!JSON.stringify(row.guidance).includes('Synthetic authored source'));assert.equal(row.guidance!.catalogueClassification,undefined);assert.deepEqual(p.observations,[]);assert.equal(JSON.stringify(p),before);
 const named=project();named.nodes.forEach(node=>{node.kind='report';node.label='Migration source transition target approved';node.tags=['azure','migration'];});validateDocument(named);const namedBefore=JSON.stringify(named),unknown=classifyPatterns(named).find(row=>row.id==='migration')!;
 assert.equal(unknown.state,'not-established');assert.deepEqual(unknown.nodeIds,[]);assert.deepEqual(unknown.relationshipIds,[]);assert.deepEqual(unknown.sourceIds,[]);assert.deepEqual(unknown.guidance,row.guidance);assert.deepEqual(unknown.gaps,row.gaps);assert.equal(JSON.stringify(named),namedBefore);
});

test('private migration prerequisites cannot change public recognition or the authored reference card',()=>{
 const p=project(),hidden=structuredClone(p),sentinel='PRIVATE_MIGRATION_PREREQUISITE';hidden.sources.push({id:'private-migration-source',title:sentinel,location:sentinel,visibility:'private'});hidden.nodes.push({...hidden.nodes[1],id:'private-migration-input',kind:'source',label:sentinel,tags:['azure','migration'],sourceIds:['private-migration-source'],visibility:'private'});hidden.views[0].nodeIds.push('private-migration-input');validateDocument(hidden);
 const before=JSON.stringify(hidden),clean=classifyPatterns(publicDocument(p)),safe=classifyPatterns(publicDocument(hidden)),author=classifyPatterns(hidden).find(row=>row.id==='migration')!;
 assert.equal(author.state,'candidate');assert.ok(author.sourceIds.includes('private-migration-source'));assert.deepEqual(safe,clean);assert.equal(safe.find(row=>row.id==='migration')!.state,'not-established');assert.deepEqual(author.guidance,safe.find(row=>row.id==='migration')!.guidance);assert.ok(!JSON.stringify(safe).includes(sentinel));assert.ok(!JSON.stringify(safe).includes('private-migration-source'));assert.equal(JSON.stringify(hidden),before);assert.deepEqual(hidden.observations,[]);
});

test('migration response edits cannot mutate later guidance requirements or the canonical Project',()=>{
 const p=project();p.nodes[1].kind='source';validateDocument(p);const before=JSON.stringify(p),registry=structuredClone(patternCatalog),baseline=classifyPatterns(p),row=classifyPatterns(p).find(row=>row.id==='migration')!;
 row.guidance!.levels.micro.text='Caller edit';row.guidance!.sources[0].url='https://example.invalid/caller';row.guidance!.conditions[0].sourceKeys.push('caller-ref');row.guidance!.alternatives.splice(0,1);row.requiredKinds.splice(0,1,'report');row.gaps.push('Caller approval');
 assert.deepEqual(patternCatalog,registry);assert.deepEqual(classifyPatterns(p),baseline);assert.equal(JSON.stringify(p),before);assert.deepEqual(p.observations,[]);
});


import {patternInputExplanation,PATTERN_INPUT_PAGE_SIZE} from '../src/intelligence/recipes';
function matcherInputFixture(){return validateDocument(documentSchema.parse({schemaVersion:1,id:'matcher-inputs',revision:3,title:'Synthetic matcher inputs',rootViewId:'root',
 nodes:[{id:'a',label:'Same supplied label',kind:'app',basis:'static-source',sourceIds:['a-source','shared-source']},{id:'b',label:'Same supplied label',kind:'function',basis:'unknown'},
  {id:'c',label:'Unrelated tag contributor',kind:'control',basis:'planned',tags:['dotnet'],sourceIds:['tag-source','shared-source']}],
 edges:[{id:'ab',source:'a',target:'b',label:'Supplied canonical dependency',kind:'dependency',basis:'planned'}],
 views:[{id:'root',title:'Supplied view',nodeIds:['a','b','c'],edgeIds:['ab'],positions:{a:{x:0,y:0},b:{x:400,y:0},c:{x:800,y:0}}}],
 sources:[{id:'a-source',title:'Synthetic A citation',location:'Synthetic declaration A:1'},{id:'shared-source',title:'Synthetic shared context',location:'Synthetic declaration, not a proof'},{id:'tag-source',title:'Synthetic C tag citation',location:'Synthetic declaration C:9'}]}));}
function suppliedInputs(p:ReturnType<typeof matcherInputFixture>,id='modular-monolith',options:Parameters<typeof patternInputExplanation>[2]={}){const facts=patternInputExplanation(p,id,options);assert.equal(facts.state,'supplied');if(facts.state!=='supplied')throw new Error('Expected supplied fixture inputs');return facts;}

test('pattern inputs identify an unrelated global tag contributor without changing legacy candidate facts or establishing evidence',()=>{
 const p=matcherInputFixture(),before=JSON.stringify(p),catalogueBefore=JSON.stringify(patternCatalog),legacy=classifyPatterns(p),result=legacy.find(row=>row.id==='modular-monolith')!,facts=suppliedInputs(p);
 assert.equal(result.state,'candidate');assert.deepEqual(result.nodeIds,['a','b']);assert.deepEqual(result.sourceIds,['a-source','shared-source']);assert.deepEqual(result.relationshipIds,['ab']);
 assert.equal(facts.matchState,result.state);assert.deepEqual(facts.components.rows.map(row=>[row.id,row.label,row.matchedKinds,row.matchedTags,row.basis]),[['a','Same supplied label',['app'],[],'static-source'],['b','Same supplied label',['function'],[],'unknown'],['c','Unrelated tag contributor',[],['dotnet'],'planned']]);
 assert.deepEqual(facts.components.rows[1].sourceIds,[]);assert.deepEqual(facts.citations.rows.map(row=>row.id),['a-source','shared-source','tag-source']);assert.equal(facts.citations.rows[2].location,'Synthetic declaration C:9');
 assert.deepEqual(facts.connections.rows.map(row=>[row.id,row.source.id,row.target.id,row.kind,row.basis,row.endpointSourceIds]),[['ab','a','b','dependency','planned',['a-source','shared-source']]]);
 assert.deepEqual(facts.questions,result.evidenceRequirements);assert.equal(Object.hasOwn(facts,'satisfied'),false);assert.equal(Object.hasOwn(facts,'observations'),false);assert.equal(p.observations.length,0);
 facts.components.rows[0].sourceIds.push('caller-only');facts.components.rows[2].matchedTags.push('caller-only');facts.citations.rows[0].title='Caller mutation';facts.connections.rows[0].endpointSourceIds.push('caller-only');facts.questions.splice(0,1,'Caller question');
 assert.deepEqual(classifyPatterns(p),legacy);assert.notEqual(suppliedInputs(p).citations.rows[0].title,'Caller mutation');assert.deepEqual(suppliedInputs(p).questions,result.evidenceRequirements);assert.equal(JSON.stringify(p),before);assert.equal(JSON.stringify(patternCatalog),catalogueBefore);
});

test('pattern explanations retain ALL kinds, global ANY tags and empty-tag behavior, including missing and empty scopes',()=>{
 const p=matcherInputFixture();for(const remove of ['a','b']){const q=structuredClone(p);q.nodes=q.nodes.filter(row=>row.id!==remove);q.edges=[];q.views[0].nodeIds=q.nodes.map(row=>row.id);q.views[0].edgeIds=[];delete q.views[0].positions[remove];const facts=suppliedInputs(validateDocument(q));assert.equal(facts.matchState,'not-established');assert.equal(facts.kinds.find(row=>row.kind===(remove==='a'?'app':'function'))!.present,false);assert.equal(facts.tags.find(row=>row.tag==='dotnet')!.present,true);}
 const missingTag=structuredClone(p);missingTag.nodes[2].tags=[];assert.equal(suppliedInputs(missingTag).matchState,'not-established');assert.equal(suppliedInputs(missingTag).tags[0].present,false);
 const data=project();data.nodes[0].tags=[];data.nodes.push({...data.nodes[1],id:'unrelated',kind:'control',tags:['fabric']});data.views[0].nodeIds.push('unrelated');data.views[0].positions.unrelated={x:700,y:0};assert.equal(suppliedInputs(validateDocument(data),'medallion').matchState,'candidate');assert.deepEqual(suppliedInputs(data,'medallion').tags.filter(row=>row.present).map(row=>row.tag),['fabric']);
 const c4=structuredClone(p);c4.nodes[1].kind='storage';c4.nodes.forEach(row=>row.tags=[]);const noTag=suppliedInputs(c4,'c4');assert.equal(noTag.matchState,'candidate');assert.deepEqual(noTag.tags,[]);
 const empty=documentSchema.parse({schemaVersion:1,id:'empty-inputs',title:'Empty supplied scope',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Empty view',nodeIds:[]}]});const none=suppliedInputs(validateDocument(empty));for(const page of [none.components,none.connections,none.citations])assert.deepEqual([page.total,page.displayed,page.omitted,page.page,page.pages,page.rows.length],[0,0,0,0,1,0]);assert.equal(none.matchState,'not-established');assert.deepEqual(patternInputExplanation(p,'not-an-entry'),{state:'unavailable'});
});

test('all retained contributor, canonical connection and citation rows remain reachable with exact bounded page counts',()=>{
 const p=matcherInputFixture();for(let i=0;i<12;i++){const id='extra-'+i,source='extra-source-'+i;p.nodes.push({...p.nodes[0],id,label:'Synthetic extra '+i,sourceIds:[source]});p.sources.push({...p.sources[0],id:source,title:'Synthetic extra source '+i});p.views[0].nodeIds.push(id);p.views[0].positions[id]={x:i*100,y:400};const edge={...p.edges[0],id:'extra-edge-'+i};p.edges.push(edge);p.views[0].edgeIds.push(edge.id);}validateDocument(p);const before=JSON.stringify(p),first=suppliedInputs(p);
 assert.equal(first.components.total,15);assert.equal(first.connections.total,13);assert.equal(first.citations.total,15);
 for(const [kind,key] of [['components','componentPage'],['connections','connectionPage'],['citations','citationPage']] as const){const ids:string[]=[];for(let page=0;page<first[kind].pages;page++){const current=suppliedInputs(p,'modular-monolith',{[key]:page})[kind];assert.ok(current.displayed<=PATTERN_INPUT_PAGE_SIZE);assert.equal(current.omitted,current.total-current.displayed);assert.equal(current.displayed,current.rows.length);ids.push(...current.rows.map(row=>row.id));}assert.equal(new Set(ids).size,first[kind].total);for(const invalid of [-1,NaN,Infinity,1.5])assert.equal(suppliedInputs(p,'modular-monolith',{[key]:invalid})[kind].page,0);assert.equal(suppliedInputs(p,'modular-monolith',{[key]:Number.MAX_SAFE_INTEGER})[kind].page,first[kind].pages-1);}
 assert.equal(JSON.stringify(p),before);
});

test('public contributor, citation and connection counts are identical when private facts are absent or present',()=>{
 const hidden=matcherInputFixture();hidden.nodes[2].label='SYNTHETIC_PRIVATE_MATCHER_LABEL';hidden.nodes[2].visibility='private';hidden.sources[2].title='SYNTHETIC_PRIVATE_MATCHER_SOURCE';hidden.sources[2].location='SYNTHETIC_PRIVATE_MATCHER_PATH';hidden.sources[2].visibility='private';hidden.edges.push({...hidden.edges[0],id:'private-edge',visibility:'private'});hidden.views[0].edgeIds.push('private-edge');validateDocument(hidden);
 const absent=structuredClone(hidden);absent.nodes=absent.nodes.filter(row=>row.id!=='c');absent.views[0].nodeIds=absent.views[0].nodeIds.filter(id=>id!=='c');delete absent.views[0].positions.c;absent.sources=absent.sources.filter(source=>source.id!=='tag-source');absent.edges=absent.edges.filter(edge=>edge.id!=='private-edge');absent.views[0].edgeIds=['ab'];validateDocument(absent);
 const before=JSON.stringify(hidden),author=suppliedInputs(hidden),safe=suppliedInputs(hidden,'modular-monolith',{publicMode:true}),baseline=suppliedInputs(absent,'modular-monolith',{publicMode:true});assert.equal(author.matchState,'candidate');assert.equal(safe.matchState,'not-established');assert.deepEqual(safe,baseline);assert.equal(safe.components.total,2);assert.equal(safe.connections.total,1);assert.equal(safe.citations.total,2);for(const marker of ['SYNTHETIC_PRIVATE','tag-source','private-edge'])assert.equal(JSON.stringify(safe).includes(marker),false);assert.deepEqual(safe,patternInputExplanation(publicDocument(hidden),'modular-monolith'));assert.equal(JSON.stringify(hidden),before);
});
