import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDomainFiles} from '../src/intelligence/domainAdapters';
import {scanRepository} from '../src/core/scan/scanner';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
const manifest={metadata:{dbt_schema_version:'https://schemas.getdbt.com/dbt/manifest/v12.json'},nodes:{'model.synthetic.result':{name:'result',original_file_path:'models/result.sql'}},sources:{'source.synthetic.raw.input':{name:'input'}},parent_map:{'model.synthetic.result':['source.synthetic.raw.input']}};
const selected=[{path:'dbt_project.yml',text:'name: synthetic\nversion: 1.0.0\n'},{path:'models/result.sql',text:"select * from {{ ref('heuristic_only') }}"},{path:'unrelated.sql',text:'create table unrelated as select * from upstream;'},
 {path:'target/manifest.json',text:JSON.stringify(manifest,null,2)}];
test('hybrid prefers supported selected dbt resources and parent_map over model SQL heuristics',async()=>{
 const report=analyzeDomainFiles(selected),edge=report.links.find(l=>l.label==='dbt manifest parent_map');assert(edge);assert.equal(edge.from,'dbt:source.synthetic.raw.input');assert.equal(edge.to,'dbt:model.synthetic.result');
 assert(selected[3].text.split('\n')[edge.line-1].includes('source.synthetic.raw.input'));
 const scan=scanRepository(selected,{preferDbtManifest:true});assert(!scan.items.has('t:heuristic_only'));assert(scan.items.has('t:unrelated'));assert.equal(scan.detectors.get('selected dbt manifest preferred over SQL heuristics'),1);
 assert(scanRepository(selected).items.has('t:heuristic_only'),'scanner-only compatibility remains unchanged');
 const input=selected.map(f=>Object.assign(new File([f.text],f.path),{webkitRelativePath:'synthetic-dbt/'+f.path})),result=await analyzePickedFolder(input,{depth:'quick'});
 assert(!result.model.items.has('t:heuristic_only'));assert(result.domain.links.some(l=>l.label==='dbt manifest parent_map'));assert(result.document.nodes.some(n=>n.label==='result'&&n.visibility==='private'));assert.equal(result.document.observations.length,0);
});
test('unsupported artifacts, unsafe model paths and contradictory structured dependencies do not suppress or guess source',()=>{
 const unsupported=selected.map(f=>f.path.endsWith('manifest.json')?{...f,text:JSON.stringify({...manifest,metadata:{dbt_schema_version:'https://schemas.getdbt.com/dbt/manifest/v999.json'}})}:f);
 assert(scanRepository(unsupported,{preferDbtManifest:true}).items.has('t:heuristic_only'));
 const unsafe=selected.map(f=>f.path.endsWith('manifest.json')?{...f,text:JSON.stringify({...manifest,nodes:{'model.synthetic.result':{name:'result',original_file_path:'../models/result.sql'}}})}:f);assert(scanRepository(unsafe,{preferDbtManifest:true}).items.has('t:heuristic_only'));
 const conflict=analyzeDomainFiles([{path:'target/manifest.json',text:JSON.stringify({...manifest,nodes:{'model.synthetic.result':{name:'result',depends_on:{nodes:[]}}}})}]);assert.equal(conflict.links.length,0);assert(conflict.diagnostics.some(d=>d.includes('contradicts')));
 const invalid=analyzeDomainFiles([{path:'target/manifest.json',text:JSON.stringify({...manifest,parent_map:{'model.synthetic.result':'not a list'}})}]);assert.equal(invalid.links.length,0);assert(invalid.diagnostics.some(d=>d.includes('Invalid dbt')));
});
