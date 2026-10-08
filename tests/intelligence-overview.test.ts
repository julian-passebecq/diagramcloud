import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {overviewFacts, overviewProjection, projectOverviewHtml} from '../src/export/projectOverview';

function fixture() {
  return validateDocument({schemaVersion:1,id:'overview-test',title:'Synthetic <project>',rootViewId:'root',
    summary:'Declared synthetic purpose',provenance:'Synthetic training example',
    nodes:[{id:'public-node',label:'Public step',visibility:'public',summary:'PRIVATE_CAPTION',role:'PRIVATE_OWNER',sourceIds:['private-source'],blockIds:['mixed-block']},
      {id:'private-node',label:'PRIVATE_NODE',visibility:'private',sourceIds:[],blockIds:[]}],
    edges:[],views:[{id:'root',title:'Root',nodeIds:['public-node','private-node'],edgeIds:[],positions:{},visibility:'public'}],
    sources:[{id:'private-source',title:'PRIVATE_SOURCE',location:'PRIVATE_PATH',visibility:'private'}],
    blocks:[{id:'mixed-block',type:'text',title:'PRIVATE_EVIDENCE',text:'PRIVATE_TEXT',visibility:'public',sourceIds:['private-source'],provenance:'synthetic'}]});
}

test('public overview filters facts before summaries and removes captions backed by private sources', () => {
  const input=fixture(), before=JSON.stringify(input), html=projectOverviewHtml(input), facts=overviewFacts(input,true);
  assert.equal(facts.components.length,1);
  assert.equal(facts.components[0].summary,'');
  assert.equal(facts.components[0].role,'');
  assert.equal(facts.project.sources.length,0);
  assert.equal(facts.project.blocks.length,0);
  assert.ok(!html.includes('PRIVATE_'));
  assert.ok(html.includes('Synthetic &lt;project&gt;'));
  assert.ok(html.includes('Unknown'));
  assert.ok(html.includes('Synthetic evidence remains synthetic'));
  assert.ok(!/<script|<img|https?:\/\//i.test(html));
  assert.equal(JSON.stringify(input),before);
  assert.equal(overviewProjection(input).nodes.length,2);
});

test('overview states public empty scope honestly and escapes hostile authored text', () => {
  const input=fixture(); input.nodes.forEach(n=>n.visibility='private');
  input.summary='</p><script>alert(1)</script>';
  const html=projectOverviewHtml(input);
  assert.ok(html.includes('No public components selected'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
});
