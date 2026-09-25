import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {samples} from '../src/data/samples';
import {clone} from '../src/core/model';
import {buildDeck,compactGroups,projectPlan,scopePlan,type DeckPlan} from '../src/export/deck';
import {workspaceGroups} from '../src/experience/pptx';

const foilo=samples.find(s=>s.id==='foilo-databricks')!,total=samples.find(s=>s.id==='total-project-controls')!;

async function open(plan:DeckPlan){
 const {pptx,sections,slides}=await buildDeck(PptxGenJS,plan),zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
 const slideXml=async(n:number)=>zip.file(`ppt/slides/slide${n}.xml`)!.async('string');
 /** Slide numbers that slide n links to, resolved through its relationships file. */
 const links=async(n:number)=>{const rels=await zip.file(`ppt/slides/_rels/slide${n}.xml.rels`)!.async('string'),xml=await slideXml(n);
  const ids=[...xml.matchAll(/<a:hlinkClick r:id="(rId\d+)"[^>]*action="ppaction:\/\/hlinksldjump"/g)].map(m=>m[1]);
  return ids.map(id=>Number(new RegExp(`Id="${id}"[^>]*Target="slide(\\d+)\\.xml"`).exec(rels)?.[1]));};
 const count=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length;
 return {pptx,sections,slides,count,slideXml,links};
}

test('project plan groups screens by scope and merges one-screen sections',()=>{
 const t=projectPlan(total);
 assert.deepEqual(t.groups.map(g=>[g.label,g.screens.length]),[['Project controls',3],['BI reporting and data model',3]]);
 const f=projectPlan(foilo);
 assert.deepEqual(f.groups.map(g=>[g.label,g.screens.map(s=>s.workspaceId)]),[['FOIL',['foil-system-screen','foil-physics-screen','foil-economics-screen','foil-pipeline-screen','foil-screen']]]);
 assert.equal(f.architecture?.views.length,foilo.views.length);
 assert(f.sources.some(s=>s.page===17)&&f.sources.some(s=>s.title.startsWith('Total_Foilo')));
 const pack=f.pack!,raw=workspaceGroups(pack);assert.equal(raw.length,5,'before merging, one group per FOIL task');
 assert.equal(compactGroups(raw,pack,pack.rootId).length,1);
});

test('the deck has the counted number of slides and every link lands on the right slide',async()=>{
 const deck=await open(projectPlan(foilo));
 assert.equal(deck.count,deck.slides);
 assert.deepEqual(deck.sections.map(s=>s.label),['Architecture','FOIL','Sources and provenance']);
 assert.deepEqual(await deck.links(2),deck.sections.map(s=>s.slide),'contents slide');
 const foil=deck.sections[1];
 assert.deepEqual(await deck.links(foil.slide),[11,12,14,16,18],'section slide links to the first slide of each screen');
 assert.match(await deck.slideXml(11),/FOIL \| oscillating hydrofoil system/);
 assert.match(await deck.slideXml(18),/FOIL \| scenario decision app/);
 // Architecture boxes still link to their child views, now offset after the cover, contents and divider.
 const views=projectPlan(foilo).architecture!.views,first=4,childTargets=await deck.links(first);
 // Boxes with a task screen also link to that screen's first slide (same slides the FOIL section lists).
 const order=['foil-system-screen','foil-physics-screen','foil-economics-screen','foil-pipeline-screen','foil-screen'],screenOf=(id:string)=>[11,12,14,16,18][order.indexOf(id)];
 const nodes=projectPlan(foilo).architecture!.nodes.filter(n=>views[0].nodeIds.includes(n.id));
 const expected=[...nodes.filter(n=>n.childViewId).map(n=>first+views.findIndex(v=>v.id===n.childViewId)),...nodes.filter(n=>n.experienceWorkspaceId).map(n=>screenOf(n.experienceWorkspaceId!))];
 const uniq=(xs:number[])=>[...new Set(xs)].sort((a,b)=>a-b);
 assert.deepEqual(uniq(childTargets),uniq(expected),'pptxgenjs repeats a link per text run; targets must match');
 assert.match(await deck.slideXml(deck.slides),/Where every screen comes from/);
});

test('a scope deck contains only that scope; private screens and hidden scopes never appear',async()=>{
 const scope=await open(scopePlan(foilo.experience!,'foil'));
 assert.equal(scope.count,scope.slides);assert.deepEqual(scope.sections.map(s=>s.label),['FOIL','Sources and provenance']);
 const hidden=clone(foilo);const w=hidden.experience!.workspaces.find(x=>x.id==='foil-economics-screen')!;w.visibility='private';w.title='SECRET-ECONOMICS-TITLE';
 const plan=projectPlan(hidden);assert(!plan.groups.some(g=>g.screens.some(s=>s.workspaceId==='foil-economics-screen')));
 const deck=await open(plan);const all=(await Promise.all(Array.from({length:deck.count},(_,k)=>deck.slideXml(k+1)))).join('\n');
 assert.doesNotMatch(all,/SECRET-ECONOMICS-TITLE|LCOE by discount rate/);
 const privateScope=clone(foilo.experience!);privateScope.entities.find(e=>e.id==='foil-economics')!.visibility='private';
 assert.throws(()=>scopePlan(privateScope,'foil-economics'),/not approved for public export/);
});

test('a project with nothing public refuses to export instead of producing an empty deck',async()=>{
 const empty={title:'x',subtitle:'',author:'',groups:[],sources:[]} as DeckPlan;
 await assert.rejects(buildDeck(PptxGenJS,empty),/Nothing public to export/);
});

test('diagram boxes link to their task screen, and each screen links back to its diagram',async()=>{
 const plan=projectPlan(foilo),deck=await open(plan),{links}=await buildDeck(PptxGenJS,plan),views=plan.architecture!.views;
 assert.deepEqual([...links.screens].map(([id,l])=>[id,l.slide]),[['foil-system-screen',11],['foil-physics-screen',12],['foil-economics-screen',14],['foil-pipeline-screen',16],['foil-screen',18]]);
 // Every box that names a public screen gets a SCREEN link to it, on every view where the box appears.
 for(const [k,v] of views.entries()){
  const boxes=plan.architecture!.nodes.filter(n=>v.nodeIds.includes(n.id)&&n.experienceWorkspaceId);
  const xml=await deck.slideXml(4+k),targets=await deck.links(4+k);
  assert.equal((xml.match(/SCREEN ›/g)??[]).length,boxes.length,v.title);
  for(const n of boxes)assert(targets.includes(links.screens.get(n.experienceWorkspaceId!)!.slide),`${v.title}: ${n.label}`);
 }
 // Back links: the screen's slides (all parts) return to the first view that shows its box.
 const home=views.findIndex(v=>plan.architecture!.nodes.some(n=>n.experienceWorkspaceId==='foil-economics-screen'&&v.nodeIds.includes(n.id)));
 for(const s of [14,15]){assert.deepEqual(await deck.links(s),[4+home]);assert((await deck.slideXml(s)).includes(`← Architecture: ${views[home].title.slice(0,25)}`),"back link names the view (clipped to fit)");}
 const notes=await (await JSZip.loadAsync(await deck.pptx.write({outputType:'nodebuffer'}) as Buffer)).file('ppt/notesSlides/notesSlide4.xml')!.async('string');
 assert.match(notes,/Task screen: FOIL \| oscillating hydrofoil system \(slide 11\)/);
});

test('a screen that is not in the deck gets no link, and the scope deck has no back links',async()=>{
 const hidden=clone(foilo);hidden.experience!.workspaces.find(x=>x.id==='foil-economics-screen')!.visibility='private';
 const plan=projectPlan(hidden),{links}=await buildDeck(PptxGenJS,plan);
 assert(!links.screens.has('foil-economics-screen'));
 const deck=await open(plan),all=(await Promise.all(Array.from({length:deck.count},(_,k)=>deck.slideXml(k+1)))).join('\n');
 assert.equal((all.match(/SCREEN ›/g)??[]).length,plan.architecture!.views.reduce((n,v)=>n+plan.architecture!.nodes.filter(x=>v.nodeIds.includes(x.id)&&x.experienceWorkspaceId).length,0));
 const scope=await buildDeck(PptxGenJS,scopePlan(foilo.experience!,'foil'));
 assert.equal(scope.links.back.size,0);
});
