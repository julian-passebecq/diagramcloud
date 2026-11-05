import test from 'node:test';import assert from 'node:assert/strict';
import JSZip from 'jszip';import PptxGenJS from 'pptxgenjs';
import {readFileSync} from 'node:fs';
import {buildReviewWorkspace} from '../examples/review-workspace/build';
import {validateDocument,type Project} from '../src/core/model';
import {meetingBriefChoices,meetingSummaryHtml,meetingSummaryModel} from '../src/export/meetingSummary';
import {buildMeetingSummaryDeck,planMeetingSummaryDeck,meetingSummaryPptxName,MEETING_SUMMARY_SYNTHETIC_LABEL,MEETING_SUMMARY_MAX_SLIDES} from '../src/export/meetingSummaryPptx';
import type {PublicationBrief} from '../src/intelligence/publicationBrief';

/** Every text part of the deck: slides, notes, relationships, document properties. */
async function open(project:Project,brief:PublicationBrief){
 const {pptx,slides,plan}=await buildMeetingSummaryDeck(PptxGenJS,project,brief);
 const buf=await pptx.write({outputType:'nodebuffer'}) as Buffer;assert.equal(buf.subarray(0,2).toString(),'PK');
 const zip=await JSZip.loadAsync(buf),names=Object.keys(zip.files);
 const read=(re:RegExp)=>Promise.all(names.filter(n=>re.test(n)).sort((a,b)=>Number(/(\d+)\.xml/.exec(a)?.[1]??0)-Number(/(\d+)\.xml/.exec(b)?.[1]??0)).map(n=>zip.file(n)!.async('string')));
 const slideXml=await read(/^ppt\/slides\/slide\d+\.xml$/),notes=await read(/^ppt\/notesSlides\/notesSlide\d+\.xml$/),rels=await read(/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/);
 const all=(await Promise.all(names.filter(n=>/\.(xml|rels)$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('\n');
 return {slides,plan,slideXml,notes,rels,all,count:slideXml.length};
}
const full=(f:ReturnType<typeof buildReviewWorkspace>):PublicationBrief=>({...f.brief,detail:'full',viewIds:['overview','join-detail','contract']});

test('meeting PPTX: deterministic slide count that follows the plan',async()=>{
 const f=buildReviewWorkspace();
 const overview=await open(f.project,f.brief);
 assert.equal(overview.count,5);assert.deepEqual(overview.plan.map(s=>s.kind),['cover','contents','findings','view','sources']);
 const a=await open(f.project,full(f)),b=await open(f.project,full(f));
 assert.equal(a.count,19);assert.equal(a.count,a.plan.length);assert.equal(a.slides,a.count);assert.equal(b.count,a.count);
 assert.deepEqual(a.plan,planMeetingSummaryDeck(meetingSummaryModel(f.project,full(f))));
 assert.equal(meetingSummaryPptxName(f.project),'review-workspace-reference.meeting-summary.pptx');
 assert.ok(MEETING_SUMMARY_MAX_SLIDES>=a.count);
});

test('meeting PPTX: same views, glossary links, sources and limits as the HTML summary',async()=>{
 const f=buildReviewWorkspace(),brief=full(f),deck=await open(f.project,brief),html=meetingSummaryHtml(f.project,brief);
 for(const v of meetingBriefChoices(f.project).views){assert.ok(html.includes(v.title));assert.ok(deck.all.includes(v.title),v.title);}
 // Contents (slide 2) links each selected view and the sources slide by slide number.
 const contents=deck.rels[1],targets=[...contents.matchAll(/Target="(?:\.\.\/slides\/)?slide(\d+)\.xml"/g)].map(m=>Number(m[1]));
 const expected=[...brief.viewIds.map(id=>deck.plan.findIndex(s=>s.kind==='view'&&s.viewId===id)+1),deck.plan.findIndex(s=>s.kind==='sources')+1];
 for(const n of expected)assert.ok(targets.includes(n),`contents links slide ${n}`);
 assert.match(deck.slideXml[1],/Sources and limits/);
 // Sources: exactly the ones the HTML lists.
 for(const s of meetingSummaryModel(f.project,brief).sources){assert.ok(html.includes(s.title));assert.ok(deck.slideXml.at(-1)!.includes(s.title),s.title);}
 assert.match(deck.slideXml.at(-1)!,/not a backup/);assert.match(deck.slideXml.at(-1)!,/editable native shapes, text and tables/);
 // A design figure is native editable shapes, not a picture.
 const figure=deck.slideXml[deck.plan.findIndex(s=>s.kind==='view')];assert.match(figure,/prst="roundRect"/);assert.doesNotMatch(figure,/<p:pic>/);
 // Business profile: no figure shapes.
 const business=await open(f.project,{...brief,profile:'business'});assert.doesNotMatch(business.slideXml[business.plan.findIndex(s=>s.kind==='view')],/prst="roundRect"/);
 assert.match(business.all,/Business profile: text and tables, no graph\./);
});

test('meeting PPTX: synthetic evidence keeps its label on every slide it spans',async()=>{
 const f=buildReviewWorkspace(),deck=await open(f.project,full(f));
 const synthetic=new Set(f.project.blocks.filter(b=>b.provenance==='synthetic').map(b=>b.id));assert.ok(synthetic.size>=6);
 let seen=0;
 deck.plan.forEach((s,i)=>{if(s.kind==='evidence'&&synthetic.has(s.blockId)){seen++;assert.ok(deck.slideXml[i].includes(MEETING_SUMMARY_SYNTHETIC_LABEL),s.blockId);}});
 assert.ok(seen>=synthetic.size-1,'synthetic blocks of the selected views are drawn');
 assert.match(deck.all,/Measure after/);assert.match(deck.all,/NULL \/ not supplied/);
});

test('meeting PPTX: no private node, view, note, block, story or source text anywhere in the zip',async()=>{
 const f=buildReviewWorkspace(),d=structuredClone(f.project);
 const join=d.nodes.find(n=>n.id==='join')!;
 d.nodes.push({...structuredClone(join),id:'secret.node',label:'PRIVATE_NODE_MARKER',summary:'PRIVATE_NODE_SUMMARY',role:'PRIVATE_ROLE',visibility:'private',blockIds:[],childViewId:undefined});
 d.views[0].nodeIds.push('secret.node');d.views[0].positions['secret.node']={x:990,y:0};
 d.views.push({...structuredClone(d.views[2]),id:'secret.view',title:'PRIVATE_VIEW_MARKER',visibility:'private'});
 d.nodes.push({...structuredClone(join),id:'nav.secret',label:'Opens hidden',summary:'',visibility:'private',childViewId:'secret.view',blockIds:[]});d.views[0].nodeIds.push('nav.secret');d.views[0].positions['nav.secret']={x:990,y:380};
 d.blocks[0]={...d.blocks[0],visibility:'private',title:'PRIVATE_BLOCK_MARKER'};
 d.sources.push({id:'s.secret',title:'PRIVATE_SOURCE_MARKER',location:'PRIVATE_LOCATION',visibility:'private'});
 const orders=d.nodes.find(n=>n.id==='orders')!;orders.sourceIds.push('s.secret');orders.summary='PRIVATE_CAPTION_MARKER';
 d.privateNotes='PRIVATE_NOTES_MARKER';
 d.story.push({title:'PRIVATE_STORY_MARKER',viewId:'secret.view',narration:'PRIVATE_NARRATION',highlightEdgeIds:[]});
 const project=validateDocument(d),brief=full(f);
 for(const profile of ['design','business'] as const){
  const deck=await open(project,{...brief,profile});
  assert.doesNotMatch(deck.all,/PRIVATE_|secret\.node|secret\.view|s\.secret/,profile);
 }
 // The authoring document is not changed by the export.
 const before=JSON.stringify(project);await open(project,brief);assert.equal(JSON.stringify(project),before);
});

test('meeting PPTX: seven views, a private view and an unknown view are refused like the HTML summary',async()=>{
 const f=buildReviewWorkspace();
 for(let i=0;i<7;i++){const id='copy'+i;f.project.views.push({...structuredClone(f.project.views[1]),id,title:'Copy '+i});const nav={...structuredClone(f.project.nodes.find(n=>n.id==='nav.join-detail')!),id:'nav.'+id,childViewId:id};f.project.nodes.push(nav);f.project.views[0].nodeIds.push(nav.id);f.project.views[0].positions[nav.id]={x:i*330,y:760};}
 const project=validateDocument(f.project),seven=meetingBriefChoices(project).views.slice(0,7).map(v=>v.id);
 await assert.rejects(()=>buildMeetingSummaryDeck(PptxGenJS,project,{...f.brief,viewIds:seven}),/at most six selected views/);
 const reason=async(viewIds:string[],doc=project)=>{try{await buildMeetingSummaryDeck(PptxGenJS,doc,{...f.brief,viewIds});return null;}catch(e){return (e as Error).message;}};
 const hidden=structuredClone(project);hidden.views.find(v=>v.id==='contract')!.visibility='private';
 assert.equal(await reason(['contract'],validateDocument(hidden)),await reason(['no-such-view']));
 assert.equal(await reason(['no-such-view']),'Publication references an unavailable public view');
 await assert.rejects(()=>buildMeetingSummaryDeck(PptxGenJS,project,{...f.brief,profile:'editorial'}),/design or business profiles/);
 assert.ok(!readFileSync(new URL('../src/export/meetingSummaryPptx.ts',import.meta.url),'utf8').includes('fetch('));
});

test('meeting PPTX: a deck beyond the slide limit is refused before any slide is drawn',()=>{
 const f=buildReviewWorkspace(),d=structuredClone(f.project),block=d.blocks.find(b=>b.type==='table')!;
 if(block.type!=='table')throw new Error('fixture');
 block.rows=Array.from({length:500},(_,i)=>block.columns.map((_,k)=>`r${i}c${k}`));
 for(let i=0;i<3;i++){d.blocks.push({...structuredClone(block),id:'large'+i});d.nodes.find(n=>n.id==='orders')!.blockIds.push('large'+i);}
 assert.throws(()=>planMeetingSummaryDeck(meetingSummaryModel(validateDocument(d),{...f.brief,detail:'full',viewIds:['overview']})),/limit 120/);
});
