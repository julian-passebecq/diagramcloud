import test from 'node:test';
import assert from 'node:assert/strict';
import {clone} from '../src/core/model';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {portfolioHtml} from '../src/export/html';
import {svgDiagram} from '../src/export/diagram';
import {drawioDiagram} from '../src/export/drawio';
test('private source-backed captions and evidence are filtered before every public renderer',()=>{
  const p=clone(samples[0]),n=p.nodes.find(n=>n.visibility==='public'&&p.views.find(v=>v.id===p.rootViewId)!.nodeIds.includes(n.id))!;
  p.sources.push({id:'private-caption-source',title:'PRIVATE_SOURCE_SENTINEL',location:'Private author source',visibility:'private'});
  n.sourceIds=['private-caption-source'];n.summary='PRIVATE_CAPTION_SENTINEL';n.role='PRIVATE_OWNER_SENTINEL';
  p.blocks.push({id:'private-backed-block',title:'PRIVATE_EVIDENCE_SENTINEL',type:'text',text:'Hidden input',visibility:'public',provenance:'author',sourceIds:n.sourceIds});n.blockIds.push('private-backed-block');
  const safe=publicDocument(p);assert.equal(safe.nodes.find(x=>x.id===n.id)!.summary,'');
  for(const output of [JSON.stringify(safe),portfolioHtml(p),svgDiagram(p,p.rootViewId),drawioDiagram(p)])assert.doesNotMatch(output,/PRIVATE_(SOURCE|CAPTION|OWNER|EVIDENCE)_SENTINEL/);
  assert.match(JSON.stringify(p),/PRIVATE_CAPTION_SENTINEL/,'authoring input remains intact');
});
