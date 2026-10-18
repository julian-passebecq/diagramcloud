import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {validateCapabilityGuide,type CapabilityGuideInput} from '../src/intelligence/capabilityGuide';
import {parseDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {ROOT,EXAMPLES,EXAMPLE_NAMES,SYNTHETIC,guideFor,anchorsFor,buildExample,exampleText,type ExampleName} from '../examples/v3-capabilities/build';

const committed=(name:ExampleName):Project=>parseDocument(readFileSync(join(EXAMPLES,`${name}.project.json`),'utf8'));
const guide=(name:ExampleName):CapabilityGuideInput=>validateCapabilityGuide(guideFor(name));
const citedIds=(g:CapabilityGuideInput)=>new Set([...g.technologies.flatMap(t=>t.sourceIds),...g.capabilities.flatMap(c=>[...c.sourceIds,...c.sections.flatMap(s=>s.sourceIds),...c.states.flatMap(s=>s.sourceIds),...c.uses.flatMap(u=>u.sourceIds)])]);

for(const name of EXAMPLE_NAMES){
 test(`${name}: the guide passes the capability guide validator and every citation is used`,()=>{
  const g=guide(name),used=citedIds(g);
  assert.ok(g.capabilities.length>0);
  for(const s of g.sources)assert.ok(used.has(s.id),`${name}: source ${s.id} is never cited`);
 });

 test(`${name}: every citation names an existing file and a line in range that holds its anchor`,()=>{
  const g=guide(name),{sourceCut,anchors}=anchorsFor(name);
  assert.match(sourceCut,/^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(anchors).sort(),g.sources.map(s=>s.id).sort(),'one anchor per source');
  for(const s of g.sources){
   const m=/^([^:]+):(\d+)$/.exec(s.location);assert.ok(m,`${s.id}: location must be path:line, got ${s.location}`);
   const path=m[1]!,line=m[2]!;
   assert.ok(!/^[\\/]|^[A-Za-z]:|\.\./.test(path),`${s.id}: repository-relative path only`);
   assert.ok(existsSync(join(ROOT,path)),`${s.id}: ${path} does not exist`);
   const lines=readFileSync(join(ROOT,path),'utf8').split(/\r?\n/),n=Number(line);
   assert.ok(n>=1&&n<=lines.length,`${s.id}: line ${n} is outside ${path} (${lines.length} lines)`);
   assert.ok(lines[n-1].includes(anchors[s.id]),`${s.id}: ${path}:${n} no longer holds "${anchors[s.id]}"; the file moved, update the citation`);
   if(s.url!==undefined)assert.equal(s.url,`https://github.com/julian-passebecq/diagramcloud/blob/${sourceCut}/${path}#L${n}`);
  }
 });

 test(`${name}: the committed Project is the compiled guide and passes validateDocument`,()=>{
  const built=buildExample(name);
  assert.equal(readFileSync(join(EXAMPLES,`${name}.project.json`),'utf8').replace(/\r\n/g,'\n'),exampleText(built),'regenerate with npx tsx examples/v3-capabilities/write.ts');
  assert.deepEqual(committed(name),built);
 });

 test(`${name}: no observation, review, run, delivery claim or certification`,()=>{
  const d=committed(name);
  assert.equal(d.observations.length,0);
  assert.equal(d.delivery,undefined);
  assert.equal(d.learningMappings,undefined);
  assert.ok(d.nodes.every(n=>n.status==='idle'),'designed status stays idle');
  assert.ok(d.nodes.every(n=>['planned','static-source','unknown'].includes(String(n.basis))));
  assert.doesNotMatch(JSON.stringify(d),/"reviewed"\s*:\s*true|"shareable"\s*:\s*true/);
 });

 test(`${name}: unsupplied detail stays UNKNOWN`,()=>{
  const d=committed(name),g=guide(name);
  for(const c of g.capabilities){
   const table=d.blocks.find(b=>b.id===`states.${c.id}`);assert.equal(table?.type,'table');
   if(table?.type!=='table')continue;
   assert.match(String(table.rows.find(r=>r[0]==='runtime')?.[1]),/^UNKNOWN/,`${c.id}: runtime is never supplied`);
  }
  for(const t of g.technologies.filter(t=>t.version===null))assert.match(d.nodes.find(n=>n.id===`tech.${t.id}`)!.summary,/version UNKNOWN/);
 });

 test(`${name}: the public projection keeps the public guide and drops private context`,()=>{
  const d=committed(name),p=publicDocument(d),text=JSON.stringify(p);
  assert.ok(p.nodes.length>0&&p.nodes.length===d.nodes.filter(n=>n.visibility==='public').length);
  assert.equal(p.blocks.some(b=>b.id==='guide-context'),false);
  assert.ok(p.story.length>0,'public guides keep their two-step story');
  assert.doesNotMatch(text,/privateNotes/);
 });

 test(`${name}: synthetic labelling`,()=>{
  const d=committed(name);
  if(SYNTHETIC[name]){
   assert.match(d.title,/^Synthetic example/);
   assert.ok(d.tags.includes('synthetic'));
   assert.ok(d.blocks.length>0&&d.blocks.every(b=>b.provenance==='synthetic'),'every block is labelled synthetic');
   assert.ok(d.nodes.every(n=>n.basis!=='static-source'),'an invented example is never read from source');
   assert.match(d.provenance,/^SYNTHETIC/);
  }else{
   assert.ok(d.blocks.every(b=>b.provenance!=='synthetic'),'the self-description is cited, not synthetic');
   assert.ok(d.nodes.filter(n=>n.id.startsWith('cap.')).every(n=>n.basis==='static-source'&&n.sourceIds.length>0));
  }
 });
}

test('self-description records its source cut and cites only this repository',()=>{
 const g=guide('diagramcloud-self');
 assert.deepEqual(g.sourceCut,[{repository:'github.com/julian-passebecq/diagramcloud',revision:anchorsFor('diagramcloud-self').sourceCut}]);
 assert.ok(g.sources.every(s=>s.url?.startsWith('https://github.com/julian-passebecq/diagramcloud/blob/')));
});

test('capability examples carry no private product names or local paths',()=>{
 const files=[...readdirSync(join(ROOT,'tests','fixtures','v3-capabilities')).map(f=>join(ROOT,'tests','fixtures','v3-capabilities',f)),
  ...readdirSync(EXAMPLES).filter(f=>/\.(json|md)$/.test(f)).map(f=>join(EXAMPLES,f)),join(EXAMPLES,'synthetic-rag','SPEC.md'),
  ...readdirSync(join(ROOT,'docs','product','capabilities')).map(f=>join(ROOT,'docs','product','capabilities',f))];
 for(const f of files)assert.doesNotMatch(readFileSync(f,'utf8'),/galaxy|datapass|foil|totalenergies|[A-Za-z]:[\\/](?:Users|PROJ)|\/Users\/|\/home\//i,f);
});
