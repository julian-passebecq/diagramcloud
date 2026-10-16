import {publicDocument} from '../src/core/operations';
import {createNavigationHistory,resolveNavigationEntry,recordNavigationEntry,moveNavigationHistory,NAVIGATION_UNAVAILABLE_MESSAGE,type NavigationEntry} from '../src/app/useNavigationHistory';
import {connectionInspectionFacts,CONNECTION_INSPECTION_UNAVAILABLE,relationshipTableFacts} from '../src/intelligence/navigation';
import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {compileHybridBrief} from '../src/intelligence/bridge';
import {projectNavigation,selectionContext} from '../src/intelligence/navigation';
import {evolutionSnapshot,retainEvolutionSnapshotPatch} from '../src/intelligence/evolution';
import {applyDocumentPatch} from '../src/core/patch';

const fixture=()=>{
 const p=compileHybridBrief({format:'diagramcloud.project-brief',version:1,project:{id:'navigation-fixture',title:'Synthetic navigation fixture'},scope:[{id:'work',title:'Declared workstream',kind:'workstream',repositoryIds:['app']},{id:'task',title:'Selected task',kind:'task',parentId:'work'}],repositories:[{id:'app',title:'Implementation',host:'local',locator:'app',revision:'a'.repeat(40)},{id:'other',title:'Implementation copy',host:'local',locator:'other',revision:'b'.repeat(40)}]}, {},{now:new Date('2026-10-09T00:00:00Z')}).document;
 const added=documentSchema.parse({schemaVersion:1,id:'physical-fixture',title:'Physical',rootViewId:'physical',edges:[],nodes:[{id:'app.module',label:'Source module',kind:'app',basis:'static-source',childViewId:'app.files',sourceIds:['project-brief-source']},{id:'app.file',label:'module.ts',kind:'function',basis:'static-source',sourceIds:['project-brief-source']}],views:[{id:'physical',title:'Unused'},{id:'app.structure',title:'Physical structure',perspective:'code',nodeIds:['app.module']},{id:'app.files',title:'Selected source files',description:'Inspect exact physical files',perspective:'code',nodeIds:['app.file']}],sources:[p.sources.find(s=>s.id==='project-brief-source')]});
 p.nodes.push(...added.nodes);p.views.push(...added.views.filter(v=>v.id!=='physical'));p.nodes.find(n=>n.id==='repo-app')!.childViewId='app.structure';return validateDocument(p);
};
test('logical and physical hierarchies retain canonical IDs and only declared crosswalks',()=>{
 const p=fixture(),before=structuredClone(p),n=projectNavigation(p);assert.deepEqual(p,before);assert.equal(n.project[0].id,'brief-scope-work');assert.equal(n.project[0].children[0].id,'brief-scope-task');assert.ok(!n.project.some(n=>n.id==='repo-app'));assert.equal(n.repositories[0].children[0].id,'app.module');assert.equal(n.repositories[0].children[0].children[0].id,'app.file');assert.equal(n.crosswalk.length,1);assert.equal(n.crosswalk[0].physicalId,'repo-app');assert.equal(n.crosswalk[0].origin,'Explicit experience relation');assert.deepEqual(n.crosswalk[0].sourceIds,['project-brief-source']);assert.equal(n.repositories[1].revision,'b'.repeat(40));
});
test('search keeps physical ancestors; view search includes purpose and canonical legacy perspective',()=>{
 const p=fixture(),n=projectNavigation(p,{query:'module.ts'});assert.equal(n.repositories.length,1);assert.equal(n.repositories[0].children[0].id,'app.module');assert.equal(n.repositories[0].children[0].children[0].id,'app.file');assert.equal(projectNavigation(p,{query:'exact physical'}).groupedViews.code[0].id,'app.files');delete p.views[0].perspective;assert.ok(projectNavigation(p).groupedViews.system.some(v=>v.id===p.rootViewId));
});
test('environment and retained evolution filters intersect stable IDs without mutating selection or history',()=>{
 let p=fixture();const old=evolutionSnapshot(p,{id:'old',label:'Prior selected source',capturedAt:'2026-10-09T00:00:00Z'});old.nodes=old.nodes.filter(n=>n.id!=='app.file');p=applyDocumentPatch(p,retainEvolutionSnapshotPatch(p,old)).result;p.delivery={environments:[{id:'env',label:'Declared environment',description:'',sourceIds:[],visibility:'private'}],instances:[{id:'instance',nodeId:'app.file',componentId:'app.module',environmentId:'env',sourceIds:[],visibility:'private'}],artifacts:[],promotions:[]};validateDocument(p);const before=structuredClone(p),n=projectNavigation(p,{environmentId:'env',snapshotId:'old'});assert.equal(n.selectionVisible('app.file'),false);assert.equal(n.selectionVisible('app.module'),true);assert.equal(n.repositories[0].children[0].id,'app.module');assert.equal(n.repositories[0].children[0].children.length,0);assert.deepEqual(p,before);assert.ok(projectNavigation(p,{snapshotId:'unavailable'}).filterProblems.length);assert.equal(projectNavigation(p,{environmentId:'unknown'}).project.length,0);
});
test('public navigation never exposes private repository, snapshot or selected evidence context',()=>{
 const p=fixture(),n=projectNavigation(p,{publicMode:true}),serialized=JSON.stringify(n);assert.equal(n.repositories.length,0);assert.equal(n.crosswalk.length,0);assert.ok(!serialized.includes('a'.repeat(40)));assert.ok(!serialized.includes('Selected task'));assert.equal(n.snapshots.length,0);
});
test('selection context is source-qualified and bounded tree reports omitted descendants',()=>{
 const p=fixture(),context=selectionContext(p,{nodeId:'app.file',viewId:'app.files'});assert.equal(context.components.length,1);assert.equal(context.repository?.id,'app');assert.equal(context.sources.length,1);assert.equal(context.blocks.length,0);assert.equal(context.scope,'selected-component');const bounded=projectNavigation(p,{maxNodes:1,maxDepth:0});assert.ok(bounded.omitted>0);assert.equal(bounded.project[0].children.length,0);assert.equal(bounded.budget.nodesPerHierarchy,1);
});



function relationFixture(){
 const edges=Array.from({length:53},(_,i)=>({id:`connection-${String(i).padStart(2,'0')}`,source:'left',target:'right',label:`Synthetic connection ${i}`,kind:(['query','control','dependency','stream','batch'] as const)[i%5],...(i%4===3?{}:{basis:(['planned','static-source','unknown'] as const)[i%4]}),...(i===0?{quantity:{value:0,unit:'events/day',provenance:'synthetic' as const,note:'Illustrative zero; not measured'}}:{})}));
 return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-relationship-table',title:'Synthetic relationship table',rootViewId:'root',nodes:[{id:'left',label:'Homonym',sourceIds:['context-source']},{id:'right',label:'Homonym',sourceIds:['context-source']}],edges,
  views:[{id:'root',title:'Root',nodeIds:['left','right'],edgeIds:edges.map(e=>e.id)},...Array.from({length:7},(_,i)=>({id:`extra-${i}`,title:`Declared view ${i}`,nodeIds:['left','right'],edgeIds:[edges[0].id]}))],
  sources:[{id:'context-source',title:'Synthetic endpoint citation',location:'Synthetic location only; no relationship receipt'}]}));
}

test('complete relation rows preserve canonical edge identity, exact shared memberships and every supplied value without mutation',()=>{
 const p=relationFixture(),before=structuredClone(p),facts=relationshipTableFacts(p);assert.deepEqual(p,before);assert.equal(facts.total,53);assert.equal(facts.views.length,8);assert.deepEqual(facts.rows.map(r=>r.id),p.edges.map(e=>e.id));assert.equal(facts.rows.filter(r=>r.id==='connection-00').length,1);assert.deepEqual(facts.rows[0].views.map(v=>v.id),p.views.map(v=>v.id));
 assert.equal(facts.rows[0].source.id,'left');assert.equal(facts.rows[0].target.id,'right');assert.equal(facts.rows[0].source.label,facts.rows[0].target.label);assert.deepEqual(facts.rows[0].quantity,{value:0,unit:'events/day',provenance:'synthetic',note:'Illustrative zero; not measured'});
 assert.deepEqual(new Set(facts.rows.map(r=>r.kind)),new Set(['query','control','dependency','stream','batch']));assert.deepEqual(new Set(facts.rows.map(r=>r.basis)),new Set(['planned','static-source','unknown','unspecified']));assert.deepEqual(p.observations,[]);
});

test('unplaced connections remain inspectable in author scope and no unsupported relation evidence is manufactured',()=>{
 const p=relationFixture();p.edges.push({...p.edges[1],id:'unplaced',label:'reads source.ts (inferred)',basis:undefined});validateDocument(p);const result=relationshipTableFacts(p),row=result.rows.at(-1)!;assert.equal(result.total,54);assert.deepEqual(row.views,[]);assert.equal(row.kind,'control');assert.equal(row.basis,'unspecified');assert.deepEqual(row.endpointSources,[{id:'context-source',title:'Synthetic endpoint citation',location:'Synthetic location only; no relationship receipt'}]);assert.ok(!('sourceIds' in row)&&!('confidence' in row)&&!('assertion' in row));assert.equal(row.quantity,undefined);
});

test('explicit repository scope is exact and missing empty or private scope never falls back globally',()=>{
 const p=fixture();p.edges.push({id:'own',source:'app.module',target:'app.file',label:'Own',kind:'dependency',speed:'medium',visibility:'public',basis:'static-source'},
  {id:'outside',source:'app.file',target:'repo-other',label:'Cross repository',kind:'control',speed:'medium',visibility:'public'});p.views.find(v=>v.id==='app.structure')!.nodeIds.push('app.file');p.views.find(v=>v.id==='app.structure')!.edgeIds.push('own');validateDocument(p);
 const before=structuredClone(p),own=relationshipTableFacts(p,{repositoryId:'app'});assert.equal(own.scope,'repository');assert.equal(own.state,'available');assert.deepEqual(own.rows.map(r=>r.id),['own']);assert.equal(relationshipTableFacts(p).total,p.edges.length);
 for(const repositoryId of ['missing','', 'APP']){const out=relationshipTableFacts(p,{repositoryId});assert.equal(out.state,'unavailable');assert.equal(out.total,0);assert.deepEqual(out.rows,[]);assert.deepEqual(out.views,[]);assert.ok(!JSON.stringify(out).includes('Cross repository'));}
 const pub=relationshipTableFacts(p,{publicMode:true,repositoryId:'app'});assert.equal(pub.state,'unavailable');assert.equal(pub.total,0);assert.deepEqual(p,before);
});

test('public rows counts memberships and endpoint context are noninterfering with arbitrary private additions',()=>{
 const p=relationFixture(),hidden=structuredClone(p),baseline=relationshipTableFacts(p,{publicMode:true});hidden.sources.push({id:'private-source',title:'PRIVATE_RELATION_SOURCE',location:'PRIVATE_RELATION_PATH',visibility:'private'});hidden.nodes.push({...hidden.nodes[0],id:'private-node',label:'PRIVATE_RELATION_NODE',sourceIds:['private-source'],visibility:'private'});hidden.views[0].nodeIds.push('private-node');hidden.edges.push({...hidden.edges[1],id:'private-edge',target:'private-node',label:'PRIVATE_RELATION_EDGE',visibility:'private'});hidden.views[0].edgeIds.push('private-edge');hidden.views.push({...hidden.views[0],id:'private-view',title:'PRIVATE_RELATION_VIEW',visibility:'private'});validateDocument(hidden);
 const before=structuredClone(hidden),out=relationshipTableFacts(hidden,{publicMode:true});assert.deepEqual(out,baseline);assert.ok(!JSON.stringify(out).includes('PRIVATE_RELATION'));assert.deepEqual(hidden,before);assert.equal(relationshipTableFacts(hidden).total,54);
 hidden.nodes[1].sourceIds=['private-source'];validateDocument(hidden);const limited=relationshipTableFacts(hidden,{publicMode:true});assert.equal(limited.total,53);assert.ok(!JSON.stringify(limited).includes('PRIVATE_RELATION'));assert.deepEqual(limited.rows[0].endpointSources,baseline.rows[0].endpointSources);
});

test('caller mutation of relation rows cannot alter future projections or canonical quantities sources and memberships',()=>{
 const p=relationFixture(),before=structuredClone(p),rows=relationshipTableFacts(p),snapshot=structuredClone(rows);rows.rows[0].source.label='Caller label';rows.rows[0].endpointSources[0].location='Caller path';rows.rows[0].quantity!.value=7;rows.rows[0].views.splice(0,1);rows.views[0].title='Caller view';rows.rows.pop();assert.deepEqual(p,before);assert.deepEqual(relationshipTableFacts(p),snapshot);
});

test('empty relation scope stays available with zero totals and unknown quantity never becomes a synthetic amount',()=>{
 const p=relationFixture();p.edges=[];p.views.forEach(v=>v.edgeIds=[]);validateDocument(p);const empty=relationshipTableFacts(p);assert.equal(empty.state,'available');assert.equal(empty.total,0);assert.deepEqual(empty.rows,[]);assert.deepEqual(empty.views,[]);
 const original=relationFixture();for(const provenance of ['source-derived','synthetic','reference','author'] as const){original.edges[0].quantity={value:0,unit:'rows',provenance};assert.deepEqual(relationshipTableFacts(original).rows[0].quantity,original.edges[0].quantity);}assert.equal(relationshipTableFacts(original).rows[1].quantity,undefined);
});


const returnFixture=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'semantic-return',revision:4,title:'Synthetic semantic return',rootViewId:'root',nodes:[
 {id:'parent',label:'Synthetic parent',childViewId:'child'},
 {id:'shared',label:'Synthetic shared component',sourceIds:['source']},{id:'other',label:'Synthetic other component'},
 {id:'private-parent',label:'PRIVATE_RETURN_PARENT',visibility:'private',childViewId:'private-child'},
 {id:'private-leaf',label:'PRIVATE_RETURN_LEAF',visibility:'private'}],
 edges:[{id:'first',source:'shared',target:'other',label:'Synthetic first',basis:'planned'},{id:'second',source:'shared',target:'other',label:'Synthetic second',basis:'unknown'},{id:'unplaced',source:'shared',target:'other'}],
 views:[{id:'root',title:'Synthetic parent view',nodeIds:['parent','shared','other','private-parent'],edgeIds:['first','second']},
 {id:'child',title:'Synthetic child',nodeIds:['shared','other'],edgeIds:['first','second']},
 {id:'private-child',title:'PRIVATE_RETURN_VIEW',nodeIds:['private-leaf'],visibility:'private'},
 {id:'orphan',title:'Synthetic unreachable view',nodeIds:['other']}],
 sources:[{id:'source',title:'Synthetic declaration',location:'Synthetic source:12, not an execution receipt'}]}));
const returnEntry=(changes:Partial<NavigationEntry>={}):NavigationEntry=>({path:['root','child'],view:'root',selected:'parent',selectedEdge:null,sheet:'diagram',...changes});

test('semantic return preserves exact retained child and active ancestor without rewriting pointers or current source facts',()=>{
 const p=returnFixture(),before=structuredClone(p),input=returnEntry(),resolved=resolveNavigationEntry(p,input)!;assert.deepEqual(resolved,input);assert.notEqual(resolved.path,input.path);
 const shared=returnEntry({view:'child',selected:'shared'});assert.deepEqual(resolveNavigationEntry(p,shared),shared);assert.deepEqual(resolveNavigationEntry(p,returnEntry({selected:'shared'})),returnEntry({selected:'shared'}));
 resolved.path.pop();assert.deepEqual(input.path,['root','child']);assert.deepEqual(p,before);assert.deepEqual(p.observations,[]);
});

test('semantic return rejects orphan paths private targets and out-of-view selections rather than using a permissive path fallback',()=>{
 const p=returnFixture(),visible=publicDocument(p),before=structuredClone(p);
 for(const input of [
  returnEntry({path:['child'],view:'child',selected:'shared'}),returnEntry({path:['root','orphan'],view:'orphan',selected:'other'}),returnEntry({path:['root','child','root']}),returnEntry({path:['root'],view:'child',selected:'shared'}),
  returnEntry({view:'child',selected:'parent'}),returnEntry({selected:'unknown'}),returnEntry({selected:null,selectedEdge:'unplaced'}),returnEntry({selected:'shared',selectedEdge:'first'}),returnEntry({selected:null,selectedEdge:'unknown'}),
  {...returnEntry(),sheet:'execute'}, {...returnEntry(),mode:'Edit'}, {...returnEntry(),path:['root','missing']}
 ])assert.equal(resolveNavigationEntry(p,input),undefined);
 assert.equal(resolveNavigationEntry(visible,returnEntry({path:['root','private-child'],view:'private-child',selected:'private-leaf'})),undefined);
 assert.equal(resolveNavigationEntry(visible,returnEntry({path:['root'],selected:'private-parent'})),undefined);assert.deepEqual(p,before);
});

test('existing session history records two connection selections and visible sheets without substituting authoring Undo',()=>{
 const p=returnFixture(),before=structuredClone(p),parent=returnEntry(),edge=(id:string,sheet:NavigationEntry['sheet']='diagram')=>returnEntry({selected:null,selectedEdge:id,sheet});
 let h=createNavigationHistory(p.id,false);for(const e of [parent,edge('first'),edge('second'),edge('second','relationships')])h=recordNavigationEntry(h,p,false,e);
 const snapshot=structuredClone(h),back=moveNavigationHistory(h,p,false,-1);assert.equal(back.state,'restored');assert.deepEqual(back.entry,edge('second'));const earlier=moveNavigationHistory(back.history,p,false,-1);assert.deepEqual(earlier.entry,edge('first'));assert.deepEqual(moveNavigationHistory(earlier.history,p,false,1).entry,edge('second'));
 back.entry!.path.pop();assert.deepEqual(h,snapshot);assert.deepEqual(p,before);assert.equal(p.revision,4);
});

test('changed revision revalidates current facts and prunes only an invalid transient return without redirecting current context',()=>{
 const p=returnFixture();let h=createNavigationHistory(p.id,false);for(const e of [returnEntry(),returnEntry({view:'child',selected:null,selectedEdge:'first'}),returnEntry({view:'child',selected:'other'})])h=recordNavigationEntry(h,p,false,e);
 const renamed=structuredClone(p);renamed.revision++;renamed.nodes.find(n=>n.id==='parent')!.label='Current authored label';assert.equal(moveNavigationHistory(h,renamed,false,-1).entry?.selectedEdge,'first');
 const live=structuredClone(renamed);live.edges=live.edges.filter(e=>e.id!=='first');live.views.forEach(v=>{v.edgeIds=v.edgeIds.filter(id=>id!=='first');});validateDocument(live);const before=structuredClone(live),oldHistory=structuredClone(h),out=moveNavigationHistory(h,live,false,-1);
 assert.equal(out.state,'unavailable');assert.equal(out.entry,undefined);assert.equal(out.history.entries.length,h.entries.length-1);assert.deepEqual(moveNavigationHistory(out.history,live,false,-1).entry,returnEntry());assert.deepEqual(h,oldHistory);assert.deepEqual(live,before);assert.ok(!NAVIGATION_UNAVAILABLE_MESSAGE.includes('first'));
 const moved=structuredClone(p);moved.nodes.find(n=>n.id==='parent')!.childViewId='middle';moved.nodes.push({...moved.nodes[0],id:'middle-parent',childViewId:'child'});moved.views.push({...moved.views[1],id:'middle',nodeIds:['middle-parent'],edgeIds:[]});validateDocument(moved);assert.equal(resolveNavigationEntry(moved,returnEntry()),undefined,'do not silently rebuild the path through a different parent chain');
});

test('project and disclosure boundaries synchronously erase prior session pointers and cannot revive private return entries',()=>{
 const p=returnFixture();let h=createNavigationHistory(p.id,false);for(const e of [returnEntry({path:['root','private-child'],view:'private-child',selected:'private-leaf'}),returnEntry({selected:'shared'})])h=recordNavigationEntry(h,p,false,e);
 const snapshot=structuredClone(h),visible=publicDocument(p),publicMove=moveNavigationHistory(h,visible,true,-1);assert.equal(publicMove.state,'unchanged');assert.deepEqual(publicMove.history.entries,[]);assert.equal(publicMove.entry,undefined);
 const publicState=recordNavigationEntry(publicMove.history,visible,true,returnEntry({selected:'shared'}));assert.equal(publicState.entries.length,1);const authorAgain=moveNavigationHistory(publicState,p,false,-1);assert.deepEqual(authorAgain.history.entries,[]);assert.equal(authorAgain.entry,undefined);
 const other={...structuredClone(p),id:'another-return-project'};assert.deepEqual(moveNavigationHistory(h,other,false,-1).history.entries,[]);assert.deepEqual(h,snapshot);assert.ok(!JSON.stringify(publicState).includes('private-leaf'));
});

test('navigation retains the existing50 cap deduplication and forward-branch rules without persistence or caller aliasing',()=>{
 const p=returnFixture(),before=JSON.stringify(p);let h=createNavigationHistory(p.id,false);
 for(let i=0;i<60;i++)h=recordNavigationEntry(h,p,false,returnEntry({selected:i%2?'shared':'other'}));assert.equal(h.entries.length,50);assert.equal(h.index,49);const same=recordNavigationEntry(h,p,false,returnEntry({selected:'shared'}));assert.equal(same,h);
 const moved=moveNavigationHistory(h,p,false,-1),branched=recordNavigationEntry(moved.history,p,false,returnEntry({sheet:'evidence',selected:'shared'}));assert.equal(branched.index,branched.entries.length-1);assert.equal(moveNavigationHistory(branched,p,false,1).state,'unchanged');assert.equal(h.entries.length,50);assert.equal(JSON.stringify(p),before);
});

const inspectionTarget=(p:ReturnType<typeof relationFixture>,viewId='root',edgeId='connection-00')=>({projectId:p.id,revision:p.revision,viewId,edgeId});
function availableConnection(p:ReturnType<typeof relationFixture>,viewId='root',edgeId='connection-00',publicMode=false){
 const facts=connectionInspectionFacts(p,inspectionTarget(p,viewId,edgeId),{publicMode});assert.equal(facts.state,'available');
 if(facts.state!=='available')throw new Error('Expected current permitted fixture connection');return facts;
}

test('read-only selected connection preserves exact parallel identities native bases zero provenance and isolated current facts',()=>{
 const p=relationFixture(),before=structuredClone(p),first=availableConnection(p),second=availableConnection(p,'root','connection-01');
 assert.equal(first.row.id,'connection-00');assert.equal(second.row.id,'connection-01');assert.equal(first.row.source.id,'left');assert.equal(first.row.target.id,'right');assert.equal(first.row.source.label,first.row.target.label);assert.equal(first.row.basis,'planned');assert.equal(second.row.basis,'static-source');assert.equal(availableConnection(p,'root','connection-02').row.basis,'unknown');assert.equal(availableConnection(p,'root','connection-03').row.basis,'unspecified');assert.equal(second.row.quantity,undefined);
 assert.deepEqual(first.row.quantity,{value:0,unit:'events/day',provenance:'synthetic',note:'Illustrative zero; not measured'});assert.deepEqual(new Set(p.edges.map(e=>availableConnection(p,'root',e.id).row.kind)),new Set(['query','control','dependency','stream','batch']));
 first.row.quantity!.value=19;first.row.source.label='Caller text';first.row.views.pop();first.row.endpointSources[0].location='Caller source';first.view.title='Caller title';assert.deepEqual(p,before);assert.deepEqual(availableConnection(p).row.quantity,before.edges[0].quantity);assert.deepEqual(p.observations,[]);
 for(const provenance of ['author','reference','source-derived','synthetic'] as const){const input=structuredClone(p);input.edges[0].quantity={value:0,unit:'rows/day',provenance};assert.deepEqual(availableConnection(input).row.quantity,input.edges[0].quantity);}
});

test('connection inspection refuses nonmember orphan unplaced and missing targets before producing a row',()=>{
 const p=relationFixture();p.edges.push({...p.edges[0],id:'unplaced'});validateDocument(p);const before=structuredClone(p);
 for(const [viewId,edgeId] of [['missing','connection-00'],['extra-0','connection-00'],['root','missing'],['root','unplaced']])assert.deepEqual(connectionInspectionFacts(p,inspectionTarget(p,viewId,edgeId)),{state:'unavailable'});
 const removed=structuredClone(p);removed.views[0].edgeIds=removed.views[0].edgeIds.filter(id=>id!=='connection-01');validateDocument(removed);assert.deepEqual(connectionInspectionFacts(removed,inspectionTarget(removed,'root','connection-01')),{state:'unavailable'});
 // A current edge row is not consulted when the selected membership is absent.
 Object.defineProperty(removed.edges[1],'quantity',{get(){throw new Error('Row must not be produced for absent membership');}});assert.deepEqual(connectionInspectionFacts(removed,inspectionTarget(removed,'root','connection-01')),{state:'unavailable'});assert.deepEqual(p,before);
 assert(!CONNECTION_INSPECTION_UNAVAILABLE.includes('unplaced'));assert(!CONNECTION_INSPECTION_UNAVAILABLE.includes('extra-0'));
});

test('public connection inspection removes private context before lookup and never manufactures independent edge evidence',()=>{
 const p=relationFixture(),baseline=availableConnection(p,'root','connection-00',true),hidden=structuredClone(p),sentinel='SYNTHETIC_PRIVATE_INSPECTION';
 hidden.sources.push({id:'private-source',title:sentinel,location:sentinel,visibility:'private'});hidden.nodes.push({...hidden.nodes[0],id:'private-node',label:sentinel,sourceIds:['private-source'],visibility:'private'});hidden.views[0].nodeIds.push('private-node');hidden.edges.push({...hidden.edges[0],id:'private-edge',target:'private-node',label:sentinel,visibility:'private',quantity:{value:41,unit:'private-unit',provenance:'author',note:sentinel}});hidden.views[0].edgeIds.push('private-edge');hidden.nodes[1].sourceIds=['private-source'];hidden.nodes[1].summary=sentinel;validateDocument(hidden);
 const before=structuredClone(hidden),visible=availableConnection(hidden,'root','connection-00',true);assert.deepEqual(visible,baseline);assert(!JSON.stringify(visible).includes(sentinel));assert.deepEqual(connectionInspectionFacts(hidden,inspectionTarget(hidden,'root','private-edge'),{publicMode:true}),connectionInspectionFacts(hidden,inspectionTarget(hidden,'root','unknown-edge'),{publicMode:true}));
 assert(!('sourceIds' in visible.row)&&!('confidence' in visible.row)&&!('observations' in visible.row)&&!('claim' in visible.row));assert.deepEqual(hidden,before);assert.deepEqual(hidden.observations,[]);
});

test('connection inspection uses live replacement facts and refuses old project revision or deleted edge pointers',()=>{
 const p=relationFixture(),captured=inspectionTarget(p),replacement=structuredClone(p);replacement.edges[0].label='Current replacement caption';replacement.edges[0].quantity={value:3,unit:'rows',provenance:'author'};validateDocument(replacement);
 const current=connectionInspectionFacts(replacement,captured);assert.equal(current.state,'available');if(current.state==='available'){assert.equal(current.row.label,'Current replacement caption');assert.equal(current.row.quantity?.value,3);}
 replacement.revision++;assert.deepEqual(connectionInspectionFacts(replacement,captured),{state:'unavailable'});assert.deepEqual(connectionInspectionFacts({...replacement,id:'another-project'},inspectionTarget(replacement)),{state:'unavailable'});
 replacement.edges=replacement.edges.filter(edge=>edge.id!==captured.edgeId);replacement.views.forEach(view=>{view.edgeIds=view.edgeIds.filter(id=>id!==captured.edgeId);});validateDocument(replacement);const before=structuredClone(replacement);assert.deepEqual(connectionInspectionFacts(replacement,inspectionTarget(replacement)),{state:'unavailable'});assert.deepEqual(replacement,before);
});
