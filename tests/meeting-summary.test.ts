import test from 'node:test';import assert from 'node:assert/strict';
import {buildReviewWorkspace} from '../examples/review-workspace/build';
import {meetingSummaryHtml,meetingBriefChoices,meetingSummaryFile} from '../src/export/meetingSummary';
import {validateDocument} from '../src/core/model';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {MeetingSummaryDialog} from '../src/ui/MeetingSummaryDialog';
const render=()=>{const f=buildReviewWorkspace();return meetingSummaryHtml(f.project,f.brief);};
test('native Project and publication brief produce a static summary',()=>{const html=render();assert.ok(html.includes('Join review:'));assert.ok(html.includes('Business question'));assert.ok(html.includes('<svg'));assert.ok(!html.includes('<script'));});
test('overview omits evidence bodies but keeps glossary and sources',()=>{const html=render();assert.ok(!html.includes('id="block-order-join'));assert.ok(html.includes('href="#view-overview"'));assert.ok(html.includes('Sources and limits'));});
test('full detail includes all attached transformation evidence',()=>{const f=buildReviewWorkspace();f.brief.detail='full';const html=meetingSummaryHtml(f.project,f.brief);assert.ok(html.includes('id="block-order-join.output"'));assert.ok(html.includes('NULL / not supplied'));});
test('source does not mutate',()=>{const f=buildReviewWorkspace(),before=JSON.stringify(f);meetingSummaryHtml(f.project,f.brief);assert.equal(JSON.stringify(f),before);});
test('private block contents are absent',()=>{const f=buildReviewWorkspace();f.brief.detail='full';f.project.blocks[0].visibility='private';f.project.blocks[0].title='PRIVATE_MARKER';assert.ok(!meetingSummaryHtml(f.project,f.brief).includes('PRIVATE_MARKER'));});
test('private node labels are absent',()=>{const f=buildReviewWorkspace();f.project.nodes[0].visibility='private';f.project.nodes[0].label='PRIVATE_MARKER';assert.ok(!meetingSummaryHtml(f.project,f.brief).includes('PRIVATE_MARKER'));});
test('mixed-source node caption is suppressed with existing overview semantics',()=>{const f=buildReviewWorkspace();f.project.sources.push({id:'s.private',title:'Private',location:'PRIVATE_MARKER',visibility:'private'});f.project.nodes[0].sourceIds.push('s.private');f.project.nodes[0].summary='PRIVATE_MARKER';assert.ok(!meetingSummaryHtml(f.project,f.brief).includes('PRIVATE_MARKER'));});
test('unavailable and private view use existing public refusal',()=>{const f=buildReviewWorkspace();f.brief.viewIds=['absent'];assert.throws(()=>meetingSummaryHtml(f.project,f.brief));f.brief.viewIds=['contract'];f.project.views.find(v=>v.id==='contract')!.visibility='private';assert.throws(()=>meetingSummaryHtml(f.project,f.brief));});
test('duplicate selection refuses',()=>{const f=buildReviewWorkspace();f.brief.viewIds=['overview','overview'];assert.throws(()=>meetingSummaryHtml(f.project,f.brief));});
test('titles and authored markup are escaped',()=>{const f=buildReviewWorkspace();f.brief.title='<img onerror="x">';const html=meetingSummaryHtml(f.project,f.brief);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img onerror'));});
test('no external CSS, scripts, images or fonts',()=>{const html=render();assert.ok(!/<(?:script|link|img)\b/.test(html));assert.ok(!/url\(https?:/.test(html));});
test('business profile does not force a graph',()=>{const f=buildReviewWorkspace();f.brief.profile='business';const html=meetingSummaryHtml(f.project,f.brief);assert.ok(!html.includes('<svg'));assert.ok(html.includes('Order lines'));});
test('letter paper is not silently rendered as A4',()=>{const f=buildReviewWorkspace();f.brief.paper='letter';assert.ok(meetingSummaryHtml(f.project,f.brief).includes('@page{size:letter;'));});
test('unsupported profile refuses rather than promising inaccurate fidelity',()=>{const f=buildReviewWorkspace();f.brief.profile='blueprint';assert.throws(()=>meetingSummaryHtml(f.project,f.brief));});
test('too many summary views refuses',()=>{const f=buildReviewWorkspace();for(let i=0;i<7;i++)f.project.views.push({...structuredClone(f.project.views[0]),id:'copy'+i});f.brief.viewIds=f.project.views.slice(0,7).map(v=>v.id);assert.throws(()=>meetingSummaryHtml(validateDocument(f.project),f.brief));});
test('dense view uses complete component list rather than a micro-font poster',()=>{const f=buildReviewWorkspace();for(let i=0;i<65;i++){const n={...structuredClone(f.project.nodes[0]),id:'extra'+i,label:'Component '+i};f.project.nodes.push(n);f.project.views[0].nodeIds.push(n.id);f.project.views[0].positions[n.id]={x:i*300,y:600};}const html=meetingSummaryHtml(validateDocument(f.project),f.brief);assert.ok(html.includes('exceeds the readable summary budget'));assert.ok(html.includes('Component 64'));});

test('meeting summary: choices list public reachable views only',()=>{
 const f=buildReviewWorkspace();
 assert.deepEqual(meetingBriefChoices(f.project),{views:[{id:'overview',title:'Business question and data path'},{id:'join-detail',title:'Input, join and output'},{id:'contract',title:'Choose the intended semantics'}],storyCount:0,profiles:['design','business']});
 // A private view and a public view no parent reaches are not offered; nothing about them is counted.
 f.project.views.find(v=>v.id==='contract')!.visibility='private';f.project.views.find(v=>v.id==='contract')!.title='PRIVATE_MARKER';
 f.project.views.push({...structuredClone(f.project.views[0]),id:'orphan',title:'Unreachable view'});
 const choices=meetingBriefChoices(validateDocument(f.project));
 assert.deepEqual(choices.views.map(v=>v.id),['overview','join-detail']);assert.doesNotMatch(JSON.stringify(choices),/PRIVATE_MARKER|orphan/);
});
test('meeting summary: seven views or a private view are refused with a generic reason',()=>{
 const f=buildReviewWorkspace();for(let i=0;i<7;i++){const id='copy'+i;f.project.views.push({...structuredClone(f.project.views[1]),id,title:'Copy '+i});const nav={...structuredClone(f.project.nodes.find(n=>n.id==='nav.join-detail')!),id:'nav.'+id,childViewId:id};f.project.nodes.push(nav);f.project.views[0].nodeIds.push(nav.id);f.project.views[0].positions[nav.id]={x:i*330,y:760};}
 const project=validateDocument(f.project);assert.ok(meetingBriefChoices(project).views.length>=7,'seven reachable public views exist');
 assert.throws(()=>meetingSummaryFile(project,{...f.brief,viewIds:meetingBriefChoices(project).views.slice(0,7).map(v=>v.id)}),/at most six selected views/);
 assert.doesNotThrow(()=>meetingSummaryFile(project,{...f.brief,viewIds:meetingBriefChoices(project).views.slice(0,6).map(v=>v.id)}));
 // A private view and a nonexistent view get the same reason, so a refusal never confirms that a private view exists.
 const reason=(viewIds:string[],doc=project)=>{try{meetingSummaryFile(doc,{...f.brief,viewIds});return null;}catch(e){return (e as Error).message;}};
 const hidden=structuredClone(project);hidden.views.find(v=>v.id==='contract')!.visibility='private';
 assert.equal(reason(['contract'],validateDocument(hidden)),reason(['no-such-view']));assert.equal(reason(['no-such-view']),'Publication references an unavailable public view');
 assert.throws(()=>meetingSummaryFile(project,{...f.brief,profile:'editorial'}),/design or business profiles/);
});
test('meeting summary: offline, no script, synthetic label kept',()=>{
 const f=buildReviewWorkspace(),file=meetingSummaryFile(f.project,{...f.brief,detail:'full'},new Date('2026-10-19T00:00:00Z'));
 assert.equal(file.fileName,'review-workspace-reference.meeting-summary.html');
 assert.match(file.html,/<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">/);
 assert.ok(!/<(?:script|link|img|iframe|object|embed)\b/i.test(file.html));assert.ok(!/\son[a-z]+=/i.test(file.html));assert.ok(!/(?:src|href)="(?:https?:)?\/\/(?![^"]*postgresql\.org)/.test(file.html));
 // Every synthetic join block keeps its visible label; no synthetic block is presented as measured.
 const synthetic=f.project.blocks.filter(b=>b.provenance==='synthetic');assert.ok(synthetic.length>=6);
 for(const b of synthetic)assert.match(file.html,new RegExp(`id="block-${b.id.replace(/\./g,'\\.')}" tabindex="-1"><h3>[^<]*</h3><small><strong class="synthetic">Synthetic example data, not a measured result\\.</strong>`),b.id);
 assert.equal(meetingSummaryFile(f.project,{...f.brief,detail:'full'},new Date('2026-10-19T00:00:00Z')).html,file.html,'deterministic for one date');
});
test('meeting summary: join rules show 42 and 70',()=>{
 const f=buildReviewWorkspace();
 for(const detail of ['standard','full'] as const){
  const html=meetingSummaryFile(f.project,{...f.brief,detail,viewIds:['join-detail']}).html;
  const rules=html.slice(html.indexOf('id="block-order-join.rules"'));assert.ok(rules.length>0&&html.includes('id="block-order-join.rules"'),detail);
  const section=rules.slice(0,rules.indexOf('</section>'));
  assert.match(section,/<td>Measure before<\/td><td>42<\/td>/);assert.match(section,/<td>Measure after<\/td><td>70<\/td>/);
  assert.match(section,/<td>Unmatched left rows<\/td><td>line\.c, line\.d<\/td>/);
  // The glossary of the component points at the rules block.
  assert.ok(html.includes('href="#block-order-join.rules"'));
 }
 assert.ok(!meetingSummaryFile(f.project,{...f.brief,detail:'overview',viewIds:['join-detail']}).html.includes('id="block-order-join.rules"'));
 assert.ok(!readFileSync(new URL('../src/export/meetingSummary.ts',import.meta.url),'utf8').includes('fetch('));
});
test('meeting summary dialog: labelled fields, public views only, current public view preselected, fidelity note',()=>{
 const f=buildReviewWorkspace(),noop=()=>{};
 const render=(project=f.project,activeViewId='join-detail')=>renderToStaticMarkup(createElement(MeetingSummaryDialog,{project,activeViewId,onDone:noop,onCancel:noop}));
 const html=render();
 for(const label of ['Title','Audience','Views (1 to 6)','Detail','Paper','Profile','Story stops (optional)'])assert.ok(html.includes(label),label);
 assert.match(html,/Browser print gives the PDF\. The PDF is a snapshot, not a backup[^<]*No PPTX is produced here\./);
 assert.equal((html.match(/type="checkbox"/g)??[]).length,3,'three public reachable views');
 assert.match(html,/<input type="checkbox" checked=""\/>Input, join and output/);assert.doesNotMatch(html,/<input type="checkbox" checked=""\/>Business question/);
 assert.match(html,/maxLength="160"/);assert.match(html,/<button type="submit">Download meeting summary<\/button>/);assert.doesNotMatch(html,/role="alert"/);
 // A private current view is neither listed nor preselected.
 const hidden=structuredClone(f.project);hidden.views.find(v=>v.id==='contract')!.visibility='private';hidden.views.find(v=>v.id==='contract')!.title='PRIVATE_MARKER';
 const other=render(validateDocument(hidden),'contract');assert.doesNotMatch(other,/PRIVATE_MARKER/);assert.doesNotMatch(other,/type="checkbox" checked=""/);assert.match(other,/0 selected\./);
});
