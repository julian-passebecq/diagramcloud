import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';import PptxGenJS from 'pptxgenjs';
import {clone,validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {applyDocumentPatch} from '../src/core/patch';
import {targetFingerprint} from '../src/core/learningMapping';
import {importMermaid} from '../src/core/interchange/mermaid';
import {drawioPages,importDrawio} from '../src/core/interchange/drawio';
import {buildMeetingSummaryDeck} from '../src/export/meetingSummaryPptx';
import {projectOverviewHtml} from '../src/export/projectOverview';
import {buildReviewWorkspace} from '../examples/review-workspace/build';
import {learningCatalogue} from '../src/intelligence/learning/catalogue';
import {mappingStatus,reviewMapping} from '../src/intelligence/learning/mappings';
import {proposeMappingSuggestion} from '../src/intelligence/learning/query';

/** Wall-clock bound far above the linear cost (well under a second here) and far below the quadratic one (minutes). */
const BOUND_MS=8000;
const timed=<T>(run:()=>T):{value:T;ms:number}=>{const t=performance.now();const value=run();return {value,ms:performance.now()-t};};

test('Mermaid: a long `a & b & …` list and a long `;`-separated line import in linear time',()=>{
 const N=150_000,list='flowchart LR\n'+Array.from({length:N},(_,i)=>'n'+i).join(' & ')+' --> z\n';
 const amp=timed(()=>importMermaid(list,'list.mmd'));
 assert.ok(amp.ms<BOUND_MS,`& list of ${N} refs took ${Math.round(amp.ms)} ms`);
 assert.equal(amp.value.document.views[0].nodeIds.length,500,'the node limit still applies');
 assert.ok(amp.value.report.lost.some(l=>/linked pairs beyond the connection limit/.test(l)),'the dropped pairs are still reported');
 // Duplicates in one list are still linked once.
 const dup=importMermaid('flowchart LR\na & b & a & b --> c\n','dup.mmd');assert.equal(dup.document.edges.length,2);
 const S=40_000,semi='flowchart LR\n'+Array.from({length:S},(_,i)=>`n${i}-->z`).join(';')+'\n';
 const split=timed(()=>importMermaid(semi,'semi.mmd'));
 assert.ok(split.ms<BOUND_MS,`${S} statements on one line took ${Math.round(split.ms)} ms`);
 // A `;` inside a quoted label still does not split the statement.
 const quoted=importMermaid('flowchart LR\na["x;y"] --> b; b --> c\n','q.mmd');
 assert.deepEqual(quoted.document.nodes.map(n=>n.label).sort(),['b','c','x;y']);assert.equal(quoted.document.edges.length,2);
});

const chain=(N:number)=>{const cells=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
 for(let i=2;i<N+2;i++)cells.push(`<mxCell id="c${i}" value="Box ${i}" vertex="1" parent="${i===2?'1':'c'+(i-1)}"><mxGeometry x="2" y="3" width="40" height="20" as="geometry"/></mxCell>`);
 return `<mxGraphModel><root>${cells.join('')}</root></mxGraphModel>`;};

test('draw.io: a deep parent chain is read in linear time without overflowing the stack',async()=>{
 const N=40_000,xml=chain(N),t=performance.now();
 const {pages}=await drawioPages(xml);const ms=performance.now()-t;
 assert.ok(ms<BOUND_MS,`a ${N}-deep chain took ${Math.round(ms)} ms`);
 // Every cell but the innermost holds a vertex, so each is a container; the innermost is the one component, in its parent's group, at its absolute position.
 const page=pages[0];assert.equal(page.nodes.length,1);assert.equal(page.groups.length,N-1);
 const leaf=page.nodes[0];assert.equal(leaf.key,`c${N+1}`);assert.equal(leaf.group,`Box ${N}`);assert.deepEqual([leaf.x,leaf.y],[2*N,3*N]);
 await importDrawio(chain(2000),'chain.drawio');
});

test('draw.io: cycles are still detached once, and placeholders still resolve from ancestors',async()=>{
 const xml=`<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="a" value="A" vertex="1" parent="b"><mxGeometry width="300" height="300" as="geometry"/></mxCell>
  <mxCell id="b" value="B" vertex="1" parent="a"><mxGeometry width="300" height="300" as="geometry"/></mxCell>
  <mxCell id="t" value="Tail" vertex="1" parent="a"><mxGeometry x="5" y="5" width="20" height="20" as="geometry"/></mxCell>
  <object id="g" label="Group" team="Data" placeholders="1"><mxCell vertex="1" parent="1" style="swimlane"><mxGeometry width="400" height="400" as="geometry"/></mxCell></object>
  <object id="k" label="%team% box" placeholders="1"><mxCell vertex="1" parent="g"><mxGeometry x="10" y="10" width="40" height="40" as="geometry"/></mxCell></object>
  <mxCell id="e" edge="1" source="k" target="t" parent="1"><mxGeometry as="geometry"/></mxCell>
 </root></mxGraphModel>`;
 const {pages,lost}=await drawioPages(xml);
 assert.equal(lost.get('cell(s) with a cyclic parent detached to the page'),1);
 assert.ok(pages[0].nodes.some(n=>n.label==='Data box'&&n.group==='Group'),JSON.stringify(pages[0].nodes));
});

/** XML 1.0 forbids C0 controls other than tab, LF and CR. */
const FORBIDDEN=/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

test('meeting summary PPTX: control characters never reach a slide or notes part (both profiles)',async()=>{
 const f=buildReviewWorkspace(),d=clone(f.project),root=d.views.find(v=>v.id===d.rootViewId)!;
 d.summary='Q\u0008 summary';d.provenance='Prov\u0002';
 const node=d.nodes.find(n=>root.nodeIds.includes(n.id)&&n.visibility!=='private')!;node.label='Bad\u0001label';node.summary='Sum\u0007mary';
 const project=validateDocument(d);
 for(const profile of ['business','design'] as const){
  const {pptx}=await buildMeetingSummaryDeck(PptxGenJS,project,{...f.brief,profile});
  const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
  for(const name of Object.keys(zip.files).filter(n=>/\.(xml|rels)$/.test(n))){
   const text=await zip.file(name)!.async('string');assert.doesNotMatch(text,FORBIDDEN,`${profile}: ${name}`);
  }
 }
 assert.doesNotMatch(projectOverviewHtml(project),FORBIDDEN,'project overview HTML');
});

const star=learningCatalogue.find(e=>e.id==='star-grain')!;
const mappingDoc=():Project=>validateDocument({schemaVersion:1,id:'mcp-mapping',title:'MCP mapping',rootViewId:'overview',author:'Julian',
 sources:[{id:'src-pub',title:'Warehouse model doc',location:'docs/model.md'},{id:'src-priv',title:'Private sizing notes',location:'notes/secret.md',visibility:'private'}],
 blocks:[{id:'blk-priv',type:'text',title:'Private grain note',text:'Internal only.',visibility:'private'}],
 nodes:[{id:'facts',label:'Sales star schema',kind:'table',sourceIds:['src-pub','src-priv'],blockIds:['blk-priv']},{id:'hidden',label:'Hidden mart',kind:'table',visibility:'private'}],
 edges:[],views:[{id:'overview',title:'Overview',nodeIds:['facts','hidden']}]});
const propose=(doc:Project,kind:'node'|'view',id:string)=>{
 const reply=proposeMappingSuggestion(doc,{conceptId:star.id,target:{kind,id}},{origin:'ai',suggestedBy:'agent'}) as {patch:unknown};
 return applyDocumentPatch(doc,reply.patch).result;
};

test('MCP mapping suggestion on a target with private evidence or members is current when applied, not stale',()=>{
 const doc=mappingDoc();
 for(const [kind,id] of [['node','facts'],['view','overview']] as const){
  const d=propose(doc,kind,id),m=d.learningMappings!.at(-1)!;
  assert.equal(m.target.fingerprintBasis,'public');
  assert.equal(m.target.fingerprint,targetFingerprint(publicDocument(doc),{kind,id}),'the reply hashes the public target only');
  assert.notEqual(m.target.fingerprint,targetFingerprint(doc,{kind,id}),'the fixture has private evidence or members');
  assert.deepEqual(mappingStatus(d,m),{state:'suggested',staleReasons:[]},`${kind} ${id}`);
 }
 // A change to the public evidence still makes the suggestion stale.
 const d=propose(doc,'node','facts'),changed=clone(d);changed.sources.find(s=>s.id==='src-pub')!.title='Rewritten doc';
 assert.equal(mappingStatus(validateDocument(changed),d.learningMappings![0]).state,'stale');
 // A target that leaves the public projection reads stale with its own reason.
 const hiddenNow=clone(d);hiddenNow.nodes.find(n=>n.id==='facts')!.visibility='private';
 assert.match(mappingStatus(validateDocument(hiddenNow),d.learningMappings![0]).staleReasons.join(' '),/no longer in the public projection/);
 // The author's review rebinds it to the authoring fingerprint and drops the basis; publicDocument never carries it.
 const r=reviewMapping(d,d.learningMappings![0].id,{reviewedBy:'Julian',reviewedAt:'2026-11-05T10:00:00Z',evidence:{sourceIds:['src-pub'],blockIds:[]}});
 const rm=r.learningMappings![0];assert.equal(rm.target.fingerprintBasis,undefined);assert.equal(rm.target.fingerprint,targetFingerprint(r,{kind:'node',id:'facts'}));
 assert.equal(mappingStatus(r,rm).state,'reviewed');
 assert.equal(publicDocument(r).learningMappings![0].target.fingerprintBasis,undefined);
 // A reviewed mapping that claims a public basis is still compared with the authoring copy.
 const forged=clone(r);forged.learningMappings![0].target={...rm.target,fingerprint:targetFingerprint(publicDocument(r),{kind:'node',id:'facts'})!,fingerprintBasis:'public'};
 assert.equal(mappingStatus(validateDocument(forged),forged.learningMappings![0]).state,'stale');
});
