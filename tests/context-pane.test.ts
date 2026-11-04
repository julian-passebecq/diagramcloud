import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {clone,validateDocument} from '../src/core/model';
import {ContextPane,type ContextPaneProps} from '../src/ui/ContextPane';
import {contextPaneFacts} from '../src/ui/contextPaneModel';

function fixture(){return validateDocument({schemaVersion:1,id:'context-detail',title:'Order platform',rootViewId:'root',
 nodes:[{id:'orders',label:'Orders',kind:'source'},{id:'validate',label:'Validate orders',summary:'Reject malformed records before persistence.',role:'Own schema checks and reject routing.',provider:'Python',basis:'static-source',blockIds:['code','secret-block'],sourceIds:['contract','secret-source'],childViewId:'implementation',tags:['validation']},{id:'store',label:'Order store',kind:'storage'},{id:'fn',label:'Schema check',kind:'function'},{id:'secret',label:'SECRET_COMPONENT',visibility:'private'}],
 edges:[{id:'in',source:'orders',target:'validate',label:'Order records',kind:'batch',quantity:{value:120,unit:'rows',provenance:'synthetic',note:'Illustrative batch'}},{id:'out',source:'validate',target:'store',label:'Accepted orders',kind:'stream'},{id:'hidden-edge',source:'secret',target:'validate',label:'SECRET_FLOW',visibility:'private'}],
 views:[{id:'root',title:'Architecture',nodeIds:['orders','validate','store','secret'],edgeIds:['in','out','hidden-edge']},{id:'implementation',title:'Validation implementation',nodeIds:['fn']},{id:'storage',title:'Storage viewpoint',nodeIds:['store','validate'],edgeIds:['out']},{id:'hidden-view',title:'SECRET_VIEW',nodeIds:['secret'],visibility:'private'}],
 blocks:[{id:'code',title:'Schema validation',type:'code',language:'python',code:'assert row["id"] != "<script>"',sourceIds:['contract']},{id:'secret-block',title:'SECRET_BLOCK',type:'text',text:'SECRET_TEXT',visibility:'private'}],
 sources:[{id:'contract',title:'Order contract',location:'contracts/order.py:12',url:'https://example.org/order'},{id:'secret-source',title:'SECRET_SOURCE',visibility:'private'}]});}
const selected={selectedViewId:'root',selectedNodeId:'validate',pinned:false};
function html(project=fixture(),extra:Partial<ContextPaneProps>={}){return renderToStaticMarkup(createElement(ContextPane,{project,publicMode:false,...selected,onOpen:()=>{},...extra}));}

test('detail resolves declared purpose, inputs, outputs, evidence and cross-view navigation without mutation',()=>{
 const p=fixture(),before=JSON.stringify(p),f=contextPaneFacts(p,false,selected);
 assert.equal(f.node?.summary,'Reject malformed records before persistence.');assert.equal(f.inputs.length,2);assert.equal(f.outputs.length,1);
 assert.deepEqual(f.outputs[0].destinations,[{viewId:'root',title:'Architecture',nodeId:'store'},{viewId:'storage',title:'Storage viewpoint',nodeId:'store'}]);
 assert.equal(f.childView?.id,'implementation');assert.equal(f.context?.blocks.length,2);assert.equal(f.context?.sources.length,2);
 const rendered=html(p,{onEdit:()=>{},onExplain:()=>{}});
 for(const text of ['Own schema checks','Python','Order records','Accepted orders','Inspect Orders upstream','Inspect Order store downstream','120','synthetic','Illustrative batch','Schema validation','contracts/order.py:12','Explore Validation implementation','Edit component','Explain source'])assert.ok(rendered.includes(text),text);
 assert.ok(rendered.includes('&lt;script&gt;'));assert.ok(!rendered.includes('<script>'));assert.equal(JSON.stringify(p),before);
});

test('hover is a read-only preview, ignored by a pin and invalid hovered membership',()=>{
 const p=fixture();const hover={...selected,hoveredViewId:'root',hoveredNodeId:'store'};
 assert.equal(contextPaneFacts(p,false,hover).node?.id,'store');assert.equal(contextPaneFacts(p,false,hover).preview,true);
 assert.equal(contextPaneFacts(p,false,{...hover,pinned:true}).node?.id,'validate');assert.equal(contextPaneFacts(p,false,{...hover,pinned:true}).preview,false);
 assert.equal(contextPaneFacts(p,false,{...hover,hoveredViewId:'implementation'}).node?.id,'validate');
 assert.match(html(p,hover),/Preview only/);assert.match(html(p,hover),/Select Order store/);
 assert.doesNotMatch(html(p,{...hover,pinned:true}),/Preview only/);
});

test('public projection precedes relation, view, evidence, source counts and hover resolution',()=>{
 const p=fixture(),f=contextPaneFacts(p,true,{...selected,hoveredNodeId:'secret',hoveredViewId:'root'});
 assert.equal(f.node?.id,'validate');assert.equal(f.inputs.length,1);assert.equal(f.context?.blocks.length,1);assert.equal(f.context?.sources.length,1);
 const rendered=html(p,{publicMode:true,onEdit:()=>{}});assert.doesNotMatch(rendered,/SECRET|hidden-edge|hidden-view|secret-block|secret-source|Edit component/);
 const changed=clone(p);changed.nodes.find(n=>n.id==='secret')!.label='OTHER_PRIVATE_LABEL';changed.blocks.find(b=>b.id==='secret-block')!.title='OTHER_PRIVATE_TITLE';changed.sources.find(s=>s.id==='secret-source')!.title='OTHER_PRIVATE_SOURCE';changed.views.find(v=>v.id==='hidden-view')!.title='OTHER_PRIVATE_VIEW';changed.revision++;
 assert.equal(html(validateDocument(changed),{publicMode:true,onEdit:()=>{}}),rendered,'private-only edits cannot alter rendered public details');
});

test('unavailable pins and exact missing IDs stay generic, even when a same-label component exists',()=>{
 const p=fixture();for(const extra of [{selectedNodeId:'gone'},{selectedNodeId:'secret',publicMode:true},{unavailable:true,hoveredNodeId:'store',hoveredViewId:'root'}]){
 const rendered=html(p,extra);assert.match(rendered,/Context unavailable/);assert.doesNotMatch(rendered,/SECRET|Reject malformed|Order store|Schema validation/);
 }
 const renamed=clone(p);renamed.nodes.find(n=>n.id==='store')!.label='Validate orders';assert.equal(contextPaneFacts(renamed,false,{...selected,selectedNodeId:'gone'}).available,false);
});

test('view and project overviews show actionable permitted components and truthful counts',()=>{
 const rendered=html(fixture(),{selectedNodeId:null,publicMode:true});assert.match(rendered,/Inspect a component/);assert.match(rendered,/Architecture/);assert.doesNotMatch(rendered,/SECRET/);
 const f=contextPaneFacts(fixture(),true,{pinned:false});assert.equal(f.context?.components.length,4);assert.equal(f.context?.relations.length,2);
});


test('view-only hover replaces the selected node, respects pins and ignores private or missing views',()=>{
 const p=fixture(),hover={...selected,hoveredViewId:'implementation'};
 const f=contextPaneFacts(p,false,hover);
 assert.equal(f.preview,true);assert.equal(f.node,undefined);assert.equal(f.context?.view?.id,'implementation');
 assert.deepEqual(f.selection,{viewId:'implementation'});
 assert.deepEqual(f.context?.components.map(n=>n.id),['fn']);
 const rendered=html(p,hover);assert.match(rendered,/Hover preview/);assert.match(rendered,/Validation implementation/);assert.doesNotMatch(rendered,/Reject malformed records/);
 const pinned=contextPaneFacts(p,false,{...hover,pinned:true});assert.equal(pinned.preview,false);assert.equal(pinned.node?.id,'validate');
 for(const hoveredViewId of ['hidden-view','missing']){
  const ignored=contextPaneFacts(p,true,{...selected,hoveredViewId});assert.equal(ignored.preview,false);assert.equal(ignored.node?.id,'validate');
 }
 assert.equal(html(p,{publicMode:true,hoveredViewId:'hidden-view'}),html(p,{publicMode:true,hoveredViewId:'missing'}));
});

test('compact detail starts on Overview with mounted labelled panels and one tab stop',()=>{
 const rendered=html();assert.match(rendered,/aria-label="Component detail sections"/);
 assert.equal((rendered.match(/role="tab"/g)??[]).length,4);assert.equal((rendered.match(/role="tabpanel"/g)??[]).length,4);
 assert.equal((rendered.match(/aria-selected="true"/g)??[]).length,1);assert.equal((rendered.match(/hidden=""/g)??[]).length,3);
 for(const name of ['Overview','Connections','Evidence','Sources']){assert.ok(rendered.includes(`-${name}-panel`));assert.ok(rendered.includes(`-${name}-tab`));}
 assert.match(rendered,/Schema validation/);assert.match(rendered,/Order contract/);
});

test('project overview initially offers eight components and an explicit expansion control',()=>{
 const p=fixture();for(let i=0;i<12;i++){p.nodes.push({...p.nodes[0],id:`extra-${i}`,label:`Extra ${i}`});p.views[0].nodeIds.push(`extra-${i}`);}
 const rendered=html(validateDocument(p),{selectedNodeId:null});assert.match(rendered,/Show 16 components/);assert.ok(!rendered.includes('<strong>Extra 11</strong>'));
 assert.equal((rendered.match(/<strong>Extra /g)??[]).length,4);
});
