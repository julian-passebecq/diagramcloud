import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {blockSchema,clone,validateDocument,type Observation,type Project} from '../src/core/model';
import {applyDocumentPatch} from '../src/core/patch';
import {describeChanges} from '../src/core/changeDetail';
import {previewDocumentChange} from '../src/core/changePreview';
import {publicDocument,removeNode} from '../src/core/operations';
import {observationPatch,realizationOf,type ObservationInput} from '../src/core/realization';
import {citableObservations,retarget} from '../src/core/story';
import {deepLink,readDeepLink} from '../src/core/links';
import {PORTFOLIO_INDEX_FORMAT,checkPortfolioIndex,portfolioIndex,portfolioIndexJson} from '../src/export/portfolioIndex';
import {portfolioHtml} from '../src/export/html';
import {parseProjection} from './contracts/mongokuProjection';

const total=samples.find(s=>s.id==='total-project-controls')!;
const input:ObservationInput={id:'obs-checks-ci',nodeId:'checks',sourceApp:'datapass-vscode',authority:'GitHub Actions workflow “quality”',observedAt:'2026-09-20T08:30:00Z',sourceRevision:'4ad1f4d',claim:'verified',summary:'Required-field checks ran green on the recorded head.',link:'https://github.com/example/repo/actions/runs/1',caveat:'CI on synthetic rows; says nothing about production data.'};
/** Import through the real path: guarded patch, then apply = commit with a bumped revision. */
function imported(doc:Project=total,obs:ObservationInput=input):Project{return validateDocument({...applyDocumentPatch(doc,observationPatch(doc,obs)).result,revision:doc.revision+1});}
const reviewed=(doc:Project,id:string,over:Partial<Observation>={}):Project=>{const d=clone(doc);const o=d.observations.find(o=>o.id===id)!;Object.assign(o,{reviewedAt:'2026-09-21T09:00:00Z',visibility:'public'},over);return validateDocument(d);};

test('an external observation enters through the guarded patch, private and unreviewed, with source, date and revision in the preview',()=>{
 const before=JSON.stringify(total),patch=observationPatch(total,input);
 const {result}=applyDocumentPatch(total,patch);
 assert.equal(JSON.stringify(total),before,'the open document is not mutated');
 const o=result.observations[0];
 assert.deepEqual({visibility:o.visibility,reviewed:o.reviewedAt,shareable:o.shareable},{visibility:'private',reviewed:undefined,shareable:false});
 const preview=previewDocumentChange(total,result);
 assert.deepEqual(preview.entities.observations,{added:['obs-checks-ci'],removed:[],changed:[]});
 const detail=describeChanges(total,result),added=detail.changes.find(c=>c.group==='observations')!;
 const fields=Object.fromEntries(added.fields.map(f=>[f.field,f.after]));
 assert.equal(fields.sourceApp,'datapass-vscode');assert.equal(fields.observedAt,'2026-09-20T08:30:00Z');assert.equal(fields.sourceRevision,'4ad1f4d');
 assert.equal(fields.authority,'GitHub Actions workflow “quality”');assert.match(fields.caveat,/synthetic rows/);
 assert(detail.cautions.some(c=>/claims “verified” as of 2026-09-20T08:30:00Z \(revision 4ad1f4d\)/.test(c)));
 assert.throws(()=>applyDocumentPatch(imported(),patch),/Stale patch/,'the same patch cannot be replayed on a newer revision');
 assert.throws(()=>applyDocumentPatch(total,observationPatch(total,{...input,nodeId:'nope'})),/no item with id “nope”/);
});

test('credentials, .env text and credential links are refused, and the error never echoes the value',()=>{
 const bad:[Partial<ObservationInput>&Record<string,unknown>,RegExp][]=[
  [{summary:'Deployed with password=hunter2'},/summary: credential-like value/],
  [{caveat:'DATABASE_HOST=db.internal\nDATABASE_PORT=5432'},/caveat: looks like .env contents/],
  [{summary:'Reads mongodb+srv://svc:pw@cluster0.example.net/db'},/credential-like value/],
  [{sourceRevision:'ghp_abcdefghijklmnopqrstuvwxyz0123'},/sourceRevision: credential-like value/],
  [{link:'https://svc:pw@example.com/run'},/without embedded credentials/],
  [{link:'javascript:alert(1)'},/without embedded credentials/],
  [{token:'abc'},/Unrecognized key/]];
 for(const [over,message] of bad){
  const err=(()=>{try{applyDocumentPatch(total,observationPatch(total,{...input,...over} as ObservationInput));}catch(e){return e as Error;}return null;})();
  assert(err,`refused: ${JSON.stringify(over)}`);assert.match(err.message,message);
  for(const secret of ['hunter2','svc:pw','abcdefghijklmnop'])assert(!err.message.includes(secret),'the refused value is not echoed');
 }
});

test('synthetic figures never back an observation, and a shareable card must be reviewed and public',()=>{
 const d=clone(total);
 d.blocks.push(blockSchema.parse({id:'cost-kpis',title:'Scenario KPIs',type:'metrics',provenance:'synthetic',items:[{label:'Variance',value:'-3.4%',note:'Illustrative scenario'}]}));
 d.nodes.find(n=>n.id==='cost')!.blockIds.push('cost-kpis');
 const withMetrics=validateDocument(d);
 assert.throws(()=>applyDocumentPatch(withMetrics,observationPatch(withMetrics,{...input,nodeId:'cost',blockIds:['cost-kpis']})),/synthetic block cost-kpis cannot back an observation/);
 const self={...observationPatch(total,input)};(self.operations[1] as {value:Record<string,unknown>}).value.shareable=true;
 assert.throws(()=>applyDocumentPatch(total,self),/only a reviewed, public observation can be marked shareable/);
 const shared=reviewed(imported(withMetrics),'obs-checks-ci',{shareable:true}),index=portfolioIndex(shared);
 assert.equal(index.counts.synthetic_evidence_blocks,publicDocument(shared).blocks.filter(b=>b.provenance==='synthetic').length);
 assert.equal(shared.blocks.find(b=>b.id==='cost-kpis')!.provenance,'synthetic','the metric stays synthetic');
 assert(!JSON.stringify(index).includes('-3.4%'),'no synthetic figure is promoted into the index');
});

test('only reviewed, public observations are presented; claim and authority are unchanged by presenting',()=>{
 const doc=imported();
 assert.equal(publicDocument(doc).observations.length,0,'unreviewed stays out of public output');
 assert.equal(publicDocument(reviewed(doc,'obs-checks-ci',{visibility:'private'})).observations.length,0,'reviewed but private stays out');
 const shown=reviewed(doc,'obs-checks-ci'),pub=publicDocument(shown).observations[0];
 const {reviewedAt:_r,visibility:_v,...fact}=shown.observations[0],{reviewedAt:_r2,visibility:_v2,...original}=doc.observations[0];
 assert.deepEqual(fact,original,'reviewing changes only review fields');assert.equal(pub.claim,'verified');assert.equal(pub.authority,input.authority);
 const hidden=clone(shown);hidden.nodes.find(n=>n.id==='checks')!.visibility='private';
 assert.equal(publicDocument(validateDocument(hidden)).observations.length,0,'an observation about a private component is never public');
 assert.equal(realizationOf(total,'checks').text,'Designed');
 assert.equal(realizationOf(shown,'checks').text,'Verified · 2026-09-20');assert(realizationOf(shown,'checks').presented);
 assert(!realizationOf(doc,'checks').presented);assert.match(realizationOf(doc,'checks').title,/Not reviewed yet/);
});

test('a story can cite reviewed evidence; unreviewed or private citations never reach the public story',()=>{
 const doc=imported(),step=doc.story.findIndex(s=>s.viewId==='overview'&&s.nodeId==='checks');
 const cite=(d:Project)=>{const c=clone(d);c.story[step].observationIds=['obs-checks-ci'];return c;};
 assert.throws(()=>validateDocument(cite(doc)),/Story cites observation obs-checks-ci before it is reviewed/);
 assert.deepEqual(citableObservations(doc,'overview'),[]);
 const privateReviewed=validateDocument(cite(reviewed(doc,'obs-checks-ci',{visibility:'private'})));
 assert.deepEqual(publicDocument(privateReviewed).story[step].observationIds,[],'the private citation is dropped from the public story');
 const shown=validateDocument(cite(reviewed(doc,'obs-checks-ci')));
 assert.deepEqual(publicDocument(shown).story[step].observationIds,['obs-checks-ci']);
 assert.deepEqual(shown.observations,reviewed(doc,'obs-checks-ci').observations,'citing does not alter the observation');
 assert.equal(retarget(shown,shown.story[step],'reporting').observationIds,undefined,'retargeting drops citations outside the new view');
 const html=portfolioHtml(shown);assert(html.includes('Required-field checks ran green'));assert(html.includes('not a deployment, test or business-validation claim'));
 const gone=removeNode(shown,'checks');assert.equal(gone.observations.length,0);assert(gone.story.every(s=>!s.observationIds?.includes('obs-checks-ci')));
});

test('the portfolio index is Mongoku-contract valid and carries no private content',()=>{
 const d=clone(imported());
 d.blocks.push(blockSchema.parse({id:'private-note',title:'Client rate card',type:'text',text:'Confidential margin 18%',visibility:'private'}));
 d.nodes.find(n=>n.id==='checks')!.blockIds.push('private-note');
 d.observations.push({...d.observations[0],id:'obs-pending',summary:'Pending run on the private branch',sourceRevision:'deadbee'});
 d.portfolio={projectRef:'foil_project',openUri:'https://diagramcloud.example/?project=total-project-controls',indexVisibility:'shareable'};
 const doc=reviewed(validateDocument(d),'obs-checks-ci',{shareable:true});
 const index=portfolioIndex(doc,{generatedAt:new Date('2026-09-25T12:00:00Z')}),json=JSON.stringify(index);
 const parsed=parseProjection(JSON.parse(json));
 assert(parsed.ok,`Mongoku accepts it: ${parsed.ok?'':parsed.issues.join('; ')}`);
 assert.deepEqual(checkPortfolioIndex(index),[]);
 assert.equal(index.format,PORTFOLIO_INDEX_FORMAT);assert.equal(index.projectRef,'foil_project');assert.equal(index.sourceObjectId,doc.id);
 assert.equal(index.sourceRevision,String(doc.revision));assert.equal(index.generatedAt,'2026-09-25T12:00:00.000Z');assert.equal(index.observedAt,'2026-09-20T08:30:00Z');
 assert.equal(index.visibility,'shareable');assert.equal(index.storyPresent,true);assert.equal(index.lastReviewedAt,undefined,'no review time is invented');
 assert.equal(index.rootViewTitle,doc.views.find(v=>v.id===doc.rootViewId)!.title);
 assert.equal(index.counts.public_evidence_blocks,publicDocument(doc).blocks.length);assert.equal(index.counts.story_present,1);
 assert.deepEqual(index.items.map(i=>[i.id,i.status,i.kind]),[['obs-checks-ci','verified','realization']],'only the shareable reviewed card');
 for(const secret of ['Client rate card','Confidential margin','Pending run','deadbee','data:image','"nodes"','"blocks"','privateNotes'])assert(!json.includes(secret),`index leaks ${secret}`);
 assert(new TextEncoder().encode(portfolioIndexJson(doc)).byteLength<64*1024);
});

test('index defaults and refusals follow the consumer: private by default, secret-like wording refused whole',()=>{
 const plain=portfolioIndex(total);
 assert.equal(plain.projectRef,total.id);assert.equal(plain.visibility,'private');assert.equal(plain.openUri,undefined);assert.deepEqual(plain.items,[]);
 assert(parseProjection(plain).ok);
 const worded=clone(total);worded.title='Token: rotate before the demo';
 assert.throws(()=>portfolioIndexJson(worded),/Mongoku would refuse it:\ntitle: credential-like value/);
 assert.equal(parseProjection(portfolioIndex(worded)).ok,false,'the consumer refuses the same payload');
 const many=clone(total);for(let i=0;i<30;i++)many.observations.push({...imported().observations[0],id:`obs-${i}`,observedAt:`2026-09-${String(i%28+1).padStart(2,'0')}T00:00:00Z`,reviewedAt:'2026-09-29T00:00:00Z',visibility:'public',shareable:true});
 const capped=portfolioIndex(validateDocument(many));
 assert.equal(capped.items.length,25);assert.equal(capped.counts.shareable_realization_cards,30);assert(parseProjection(capped).ok);
 assert(Date.parse(capped.items[0].title.match(/, (\d{4}-\d{2}-\d{2})\)/)![1])>=Date.parse(capped.items[24].title.match(/, (\d{4}-\d{2}-\d{2})\)/)![1]),'newest cards first');
});

test('deep links carry stable IDs only',()=>{
 const link=deepLink('https://diagramcloud.example/app/?x=1#h',{project:'total-project-controls',view:'validation',node:'mandatory'});
 assert.equal(link,'https://diagramcloud.example/app/?project=total-project-controls&view=validation&node=mandatory');
 assert.deepEqual(readDeepLink(new URL(link).search),{project:'total-project-controls',view:'validation',node:'mandatory'});
 assert.deepEqual(readDeepLink('?project=total-project-controls&node=<script>'),{project:'total-project-controls'});
 assert.equal(readDeepLink('?view=overview'),null);
});

test('portfolio settings are authoring metadata: public outputs leave them out, the index still uses them',()=>{
 const d=clone(total);d.portfolio={projectRef:'foil_project',indexVisibility:'shareable'};const doc=validateDocument(d);
 assert.equal(publicDocument(doc).portfolio,undefined);assert(!portfolioHtml(doc).includes('foil_project'));
 assert.equal(portfolioIndex(doc).projectRef,'foil_project');assert.equal(portfolioIndex(doc).visibility,'shareable');
});
