import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDevelopmentAtlas,atlasToDiagramDocument,renderDevelopmentSvg,buildDevelopmentView,compareDevelopmentViews,DEVELOPMENT_VIEWS,withoutLocalPath} from '../src/development';

// Synthetic contract fixture only (adopted from donor ced0150/b2a5b51 tests); no real repository or worktree.
const base=()=>({version:'development-atlas/1',capturedAt:'2026-10-07T12:00:00Z',scope:{project:'Contract test'},repositories:[{id:'repo.a',label:'A <script> unsafe',kind:'repository',basis:'OBSERVED',evidenceIds:['evidence.a'],data:{}}],worktrees:[],branches:[],revisions:[],changes:[],files:[],reviews:[],ci:[],agents:[],components:[],relations:[],evidence:[{id:'evidence.a',authority:'Test input',basis:'OBSERVED',observedAt:'2026-10-07T12:00:00Z',summary:'Synthetic contract fixture'}]});

test('Atlas refuses bad versions, dangling relations, duplicate IDs and absent evidence',()=>{
 assert.throws(()=>validateDevelopmentAtlas({...base(),version:'development-atlas/2'}));
 assert.throws(()=>validateDevelopmentAtlas({...base(),relations:[{id:'relation.a',source:'repo.a',target:'repo.missing',label:'x',basis:'DERIVED',evidenceIds:[]}]}));
 assert.throws(()=>validateDevelopmentAtlas({...base(),repositories:[base().repositories[0],base().repositories[0]]}));
 assert.throws(()=>validateDevelopmentAtlas({...base(),evidence:[]}));
 assert.throws(()=>validateDevelopmentAtlas(undefined));
});

test('Atlas uses shared scenes and SVG for every view; no observation, design basis or status is promoted',()=>{
 const a=validateDevelopmentAtlas(base()),d=atlasToDiagramDocument(a);
 assert.equal(d.observations.length,0);assert.equal(d.nodes[0].id,'repo.a');assert.equal(d.nodes[0].basis,undefined);assert.equal(d.nodes[0].status,'idle');assert.equal(a.repositories[0].basis,'OBSERVED');
 assert.ok(d.nodes[0].summary.startsWith('repository · OBSERVED'));
 for(const view of DEVELOPMENT_VIEWS){assert.ok(buildDevelopmentView(a,view).scene);for(const theme of ['light','dark'] as const){const svg=renderDevelopmentSvg(a,view,theme);assert.ok(svg.includes('data-node-id="repo.a"'));assert.ok(!svg.includes('<script>'));}}
});

test('Atlas delta retains entity IDs and names a changed label',()=>{
 const before=validateDevelopmentAtlas(base()),after=structuredClone(before);after.repositories[0].label='Renamed';
 const delta=compareDevelopmentViews(before,after);assert.equal(delta.components.get('repo.a'),'changed');assert.ok(delta.ledger.some(x=>x.includes('Renamed')));
});

test('Atlas bounds file views to the selected worktree and never carries a local repository or worktree path',()=>{
 const worktree='D:\\PROJ\\private-client\\.claude\\worktrees\\lane-7',repo='/home/someone/private-client';
 const files=Array.from({length:45},(_,i)=>({id:`file.${i}`,label:`${worktree}\\src\\f${i}.ts`,kind:'file',basis:'OBSERVED',evidenceIds:[],data:{worktreePath:worktree,blueprint:i<3}}));
 const atlas={...base(),scope:{project:'Contract test',repo,worktree,revision:'abc123'},worktrees:[{id:'wt.a',label:worktree,kind:'worktree',basis:'OBSERVED',evidenceIds:[],data:{path:worktree,status:repo}}],files,
  changes:[{id:'change.other',label:'Other checkout change',kind:'change',basis:'DERIVED',evidenceIds:[],data:{worktreePath:'C:\\elsewhere'}}]};
 const d=atlasToDiagramDocument(atlas),active=d.views.find(v=>v.id==='active-work')!,blueprint=d.views.find(v=>v.id==='repository-blueprint')!;
 assert.equal(active.nodeIds.filter(id=>id.startsWith('file.')).length,40);assert.ok(!active.nodeIds.includes('change.other'));
 assert.deepEqual(blueprint.nodeIds.filter(id=>id.startsWith('file.')),['file.0','file.1','file.2']);
 assert.equal(d.nodes.find(n=>n.id==='file.0')!.label,'f0.ts');assert.equal(d.nodes.find(n=>n.id==='wt.a')!.label,'lane-7');
 const outputs=[JSON.stringify(d),...DEVELOPMENT_VIEWS.map(view=>renderDevelopmentSvg(atlas,view))];
 for(const text of outputs)for(const secret of ['PROJ','private-client','someone','elsewhere','.claude'])assert.ok(!text.includes(secret),secret);
 assert.equal(withoutLocalPath('src/app.ts'),'src/app.ts');assert.equal(withoutLocalPath('\\\\server\\share\\x.md'),'x.md');assert.equal(withoutLocalPath('~/repo/y'),'y');
});
