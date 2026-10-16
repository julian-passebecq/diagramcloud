import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileProjectBrief, parseProjectBrief} from '../src/intelligence/brief';
import {publicDocument} from '../src/core/operations';
import {validateDocument} from '../src/core/model';
import {previewBriefReimport} from '../src/intelligence/bridge';
import {portfolioHtml} from '../src/export/html';
import {svgDiagram} from '../src/export/diagram';
import {viewSpec} from '../src/core/viewspec';
const raw = () => readFileSync('examples/project-intelligence/project-brief.json', 'utf8');
const shared = () => parseProjectBrief(readFileSync('examples/project-intelligence/shared-repository-brief.json', 'utf8'));

test('Guided brief compiles deterministically, without Git or runtime claims', () => {
  const brief = parseProjectBrief(raw()), a = compileProjectBrief(brief), b = compileProjectBrief(brief);
  assert.deepEqual(a, b);
  assert.equal(a.manifest, null);
  assert.equal(a.document.observations.length, 0);
  assert.ok(a.document.nodes.every(n => !n.basis || n.basis === 'planned'));
  assert.ok(a.document.nodes.every(n => n.visibility === 'private'));
  assert.equal(publicDocument(a.document).nodes.length, 0);
});

test('scope cycles, dangling ownership, duplicate relation IDs and secrets are rejected', () => {
  const original = parseProjectBrief(raw());
  const cyclic = structuredClone(original); cyclic.scope[0].parentId = 'ingest';
  assert.throws(() => compileProjectBrief(cyclic), /cycle/);
  const owner = structuredClone(original); owner.ownership[0].teamId = 'missing';
  assert.throws(() => compileProjectBrief(owner), /unknown reference/);
  const duplicates = structuredClone(original); duplicates.relationships[1].id = duplicates.relationships[0].id;
  assert.throws(() => compileProjectBrief(duplicates), /Duplicate relationship/);
  const secret = structuredClone(original); secret.project.summary = 'password=unsafe-placeholder';
  assert.throws(() => compileProjectBrief(secret), /credential/);
});

test('repository membership compiles through the existing manifest, not a second Atlas', () => {
  const brief = parseProjectBrief(raw());
  brief.repositories = [{id: 'api', title: 'API', role: 'service', host: 'local', locator: 'api', path: '/private/local/api', capabilities: [], boundaries: []}];
  brief.scope[0].repositoryIds = ['api'];
  const result = compileProjectBrief(brief);
  assert.equal(result.manifest!.repositories[0].id, 'api');
  assert.ok(!JSON.stringify(result.document).includes('/private/local/api'));
  brief.repositoryRelationships = [{from: 'api', to: 'api', kind: 'dependency', label: 'self'}];
  assert.throws(() => compileProjectBrief(brief), /itself/);
});

test('authored relationship identity survives reordered input', () => {
  const brief = parseProjectBrief(raw());
  const before = compileProjectBrief(brief).document.edges;
  brief.relationships.reverse();
  const after = compileProjectBrief(brief).document.edges;
  assert.deepEqual([...before].sort((a, b) => a.id.localeCompare(b.id)), [...after].sort((a, b) => a.id.localeCompare(b.id)));
});

test('two logical scopes share one declared repository source through their private evidence, without name-based joins', () => {
  const brief = shared(), before = structuredClone(brief), {document, manifest} = compileProjectBrief(brief);
  assert.deepEqual(brief, before);
  assert.deepEqual(document.sources.filter(s => s.id.startsWith('brief-repository-')).map(s => s.id), ['brief-repository-other-api', 'brief-repository-shared-api']);
  const orders = document.nodes.find(n => n.id === 'brief-scope-orders')!, reports = document.nodes.find(n => n.id === 'brief-scope-reports')!;
  const evidence = (id: string) => document.blocks.find(b => b.id === id)!;
  assert.ok(orders.blockIds.includes('brief-meta-orders'));assert.ok(reports.blockIds.includes('brief-meta-reports'));
  assert.deepEqual(evidence('brief-meta-orders').sourceIds, ['project-brief-source', 'brief-repository-shared-api']);
  assert.deepEqual(evidence('brief-meta-reports').sourceIds, ['project-brief-source', 'brief-repository-other-api', 'brief-repository-shared-api']);
  for (const node of [orders, reports]) assert.deepEqual(node.sourceIds, ['project-brief-source'], 'Repository membership is not evidence for the authored caption');
  assert.ok(document.sources.every(s => s.visibility === 'private'));assert.ok(document.blocks.every(b => b.provenance === 'author' && b.visibility === 'private'));
  assert.ok(document.nodes.every(n => n.basis === 'planned'));assert.equal(document.observations.length, 0);
  assert.equal(manifest!.repositories.length, 2);assert.doesNotThrow(() => validateDocument(document));
});

test('repository source identities and unique scoped references survive renamed labels and reordered declarations', () => {
  const brief = shared(), original = compileProjectBrief(brief).document;
  brief.repositories.reverse();brief.repositories.forEach(r => r.title = 'Renamed repository');brief.scope.reverse();brief.scope.forEach(s => {s.title = 'Renamed scope';s.repositoryIds.reverse();});
  // Repeated declaration of the same binding is still one source reference, never an extra repository.
  brief.scope[0].repositoryIds.push(brief.scope[0].repositoryIds[0]);
  const next = compileProjectBrief(brief).document;
  assert.deepEqual(next.sources.map(s => s.id), original.sources.map(s => s.id));
  for (const prior of original.blocks.filter(b => b.id.startsWith('brief-meta-'))) assert.deepEqual(next.blocks.find(b => b.id === prior.id)!.sourceIds, prior.sourceIds);
  assert.deepEqual(next.nodes.map(n => n.id).sort(), original.nodes.map(n => n.id).sort());
});

test('declared source citations retain safe remote revision metadata and omit local paths, unsafe locators and path-like refs', () => {
  const brief = shared();
  brief.repositories.push({id:'local-api',title:'Local declaration',role:'service',host:'local',locator:'C:/PRIVATE_LOCATOR',path:'C:/PRIVATE_SELECTION',ref:'C:/PRIVATE_REF',capabilities:[],boundaries:[]});
  brief.repositories.push({id:'file-locator',title:'Inert unsupported locator',role:'service',host:'other',locator:'file:///PRIVATE_FILE_LOCATOR',capabilities:[],boundaries:[]});
  brief.scope[0].repositoryIds.push('local-api', 'file-locator');
  const {document,manifest}=compileProjectBrief(brief), json=JSON.stringify(document);
  assert.doesNotMatch(json,/PRIVATE_(LOCATOR|SELECTION|REF|FILE_LOCATOR)/);
  assert.equal(manifest!.repositories.find(r=>r.id==='local-api')!.path,'C:/PRIVATE_SELECTION','Only the separate acquisition manifest retains its explicit local path');
  const remote=document.sources.find(s=>s.id==='brief-repository-shared-api')!;
  assert.match(remote.location,/https:\/\/github\.com\/example\/shared-api/);assert.match(remote.location,/ref main/);assert.match(remote.location,/revision a{40}/);assert.match(remote.location,/Source not inspected; runtime unknown/);
  const invalid=shared();invalid.repositories[0].locator='https://example.test/repo?access_token=fixture';assert.throws(()=>compileProjectBrief(invalid),/credential|secret/i);
});

test('private binding evidence cannot redact an approved authored caption or publish repository metadata implicitly', () => {
  const brief=shared();brief.repositories[0].title='PRIVATE_REPOSITORY_METADATA';brief.repositories[0].locator='https://example.test/PRIVATE_REPOSITORY_LOCATOR';
  const document=compileProjectBrief(brief).document,node=document.nodes.find(n=>n.id==='brief-scope-orders')!,block=document.blocks.find(b=>b.id==='brief-meta-orders')!;
  node.visibility='public';node.summary='Approved authored caption.';node.role='Approved author role';document.sources.find(s=>s.id==='project-brief-source')!.visibility='public';
  block.visibility='public'; // Publishing an evidence block alone does not publish its still-private repository sources.
  const before=structuredClone(document),safe=publicDocument(document);
  assert.equal(safe.nodes.find(n=>n.id===node.id)!.summary,node.summary);assert.equal(safe.nodes.find(n=>n.id===node.id)!.role,node.role);
  assert.ok(!safe.blocks.some(b=>b.id===block.id));assert.deepEqual(safe.sources.map(s=>s.id),['project-brief-source']);
  for(const output of [JSON.stringify(safe),portfolioHtml(document),svgDiagram(document,document.rootViewId),JSON.stringify(viewSpec(document,document.rootViewId))]){
    assert.match(output,/Approved authored caption/);assert.doesNotMatch(output,/PRIVATE_REPOSITORY|brief-repository-/);
  }
  assert.deepEqual(document,before);
  document.sources.find(s=>s.id==='brief-repository-shared-api')!.visibility='public';
  assert.deepEqual(publicDocument(document).blocks.find(b=>b.id===block.id)!.sourceIds,['project-brief-source','brief-repository-shared-api'],'An explicit source and evidence publication choice retains the binding');
});

test('bound brief reimport preserves authored captions and evidence while adding bindings for new scope IDs', () => {
  const brief=shared(),current=compileProjectBrief(brief).document;current.revision=5;
  const node=current.nodes.find(n=>n.id==='brief-scope-orders')!,block=current.blocks.find(b=>b.id==='brief-meta-orders')!;
  node.summary='Retain this authored explanation';if(block.type==='text')block.text='Retain this authored binding explanation';
  const before=structuredClone(current);brief.scope[0].repositoryIds=['other-api'];brief.scope.push({id:'new-scope',title:'New declared scope',kind:'component',summary:'',repositoryIds:['shared-api']});
  const result=previewBriefReimport(current,brief,5).document;
  assert.deepEqual(current,before);assert.equal(result.nodes.find(n=>n.id===node.id)!.summary,node.summary);assert.deepEqual(result.blocks.find(b=>b.id===block.id),block);
  assert.deepEqual(result.blocks.find(b=>b.id==='brief-meta-new-scope')!.sourceIds,['project-brief-source','brief-repository-shared-api']);
  assert.throws(()=>previewBriefReimport({...current,revision:6},brief,5),/Revision conflict/);
  const invalid=structuredClone(brief);invalid.scope[0].repositoryIds=['not-declared'];assert.throws(()=>compileProjectBrief(invalid),/unknown reference/);assert.deepEqual(current,before);
});
