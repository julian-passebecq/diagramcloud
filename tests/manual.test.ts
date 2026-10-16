import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {technicalManualHtml} from '../src/export/manual';
import {publicDocument} from '../src/core/operations';
import type {Project} from '../src/core/model';

const NOW=new Date('2026-10-07T08:00:00Z');
const contoso=samples.find(s=>s.id==='contoso-forecasting')!;

test('technical manual: cover carries snapshot, revision vector, generated time, audience, provenance and omissions; one section per public view',()=>{
 const html=technicalManualHtml(contoso,{now:NOW});
 for(const text of ['Technical manual','snap-20261007','61353848b4e7','2026-10-07 08:00 UTC','Audience','Public: built from the public document','Provenance','Read from julian-passebecq/contoso-data-studio','Omissions','Basis of components'])assert.ok(html.includes(text),text);
 for(const v of publicDocument(contoso).views)assert.ok(html.includes(`id="view-${v.id}"`),v.id);
 assert.ok(html.includes('15 read from source · 6 planned'),'each component counted once');
 // Figures are editorial SVGs with per-figure marker IDs; the evidence and sources appendices are present.
 const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'no duplicate IDs in the page');
 assert.ok(html.includes('id="evidence"')&&html.includes('id="sources"'));assert.match(html,/Derived from a source/);
 assert.ok(html.includes('Reported latency (not observed here)'));
});

test('technical manual: offline, no script, escaped, private items removed, deterministic',()=>{
 const s=samples.find(x=>x.nodes.some(n=>n.childViewId))!;
 const priv:Project={...s,nodes:[...s.nodes.map((n,i)=>i?n:{...n,label:'A <script>alert(1)</script> & "q"'}),{...s.nodes[0],id:'secret-node',label:'SECRET-XYZ',visibility:'private',childViewId:undefined}],
  views:s.views.map(v=>v.id===s.rootViewId?{...v,nodeIds:[...v.nodeIds,'secret-node']}:v)};
 const html=technicalManualHtml(priv,{now:NOW});
 assert.ok(!html.includes('SECRET-XYZ'));assert.match(html,/1 private or unreachable component\(s\) removed/);
 assert.ok(!/<script/i.test(html),'no script element');assert.ok(html.includes('A &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;'));
 const urls=[...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map(m=>m[1]);assert.deepEqual(urls,[],'nothing loads from the network');
 assert.match(html,/default-src 'none'/);
 assert.equal(technicalManualHtml(priv,{now:NOW}),html);
 // Synthetic evidence stays labelled.
 const total=technicalManualHtml(samples.find(x=>x.id==='total-project-controls')!,{now:NOW});assert.match(total,/Synthetic example/);
});

test('technical manual: a view with a Diagram Design hint is printed as that figure, others stay editorial; ids stay unique',async()=>{
 const {applyDesignBrief,parseDesignBrief}=await import('../src/core/designBrief');const {readFileSync:read}=await import('node:fs');const {contosoForecasting}=await import('../src/data/contosoForecasting');
 const doc=applyDesignBrief(contosoForecasting(),parseDesignBrief(read('docs/design-brief.example.json','utf8'))).document;
 const html=technicalManualHtml(doc,{now:new Date('2026-10-07T09:00:00Z')});
 assert.equal((html.match(/data-style="design"/g)??[]).length,4);assert.ok(html.includes('Exploded stack (3D) figure, as chosen for this view'));
 assert.ok(!html.includes('data-theme="dark"'),'dark figures print light');
 const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 const plain=technicalManualHtml(contosoForecasting(),{now:new Date('2026-10-07T09:00:00Z')});assert.equal((plain.match(/data-style="design"/g)??[]).length,0);
});


// Printable quantity fidelity uses supplied canonical facts; no measurement is derived.
async function suppliedQuantityManualProject(){
 const {documentSchema,validateDocument}=await import('../src/core/model');
 return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-quantity-manual',title:'Synthetic quantity handbook',privateNotes:'PRIVATE_QUANTITY_AUTHORING',rootViewId:'root',nodes:[{id:'a',label:'Input',childViewId:'detail'},{id:'b',label:'Output'},{id:'c',label:'Other input'},{id:'d',label:'Other output'},{id:'private-portal',label:'PRIVATE_QUANTITY_ENDPOINT',visibility:'private',childViewId:'private-detail'},{id:'private-leaf',label:'PRIVATE_QUANTITY_LEAF',visibility:'private'}],edges:[{id:'zero-edge',source:'a',target:'b',label:'Same supplied label',basis:'planned',quantity:{value:0,unit:'jobs/day',provenance:'synthetic',note:'Synthetic <script>not executed</script> & "note"'}},{id:'missing-edge',source:'a',target:'b',label:'Same supplied label',basis:'unknown'},...(['source-derived','reference','author'] as const).map((provenance,i)=>({id:'supplied-'+provenance,source:'a',target:'b',basis:'static-source',quantity:{value:i+1,unit:' units/day ',provenance,note:'Exact '+provenance+' note'}})),{id:'other-edge',source:'c',target:'d',quantity:{value:77,unit:'OTHER_CHAPTER_UNIT',provenance:'author',note:'OTHER_CHAPTER_NOTE'}},{id:'private-edge',source:'a',target:'private-portal',quantity:{value:9,unit:'PRIVATE_QUANTITY_UNIT',provenance:'synthetic',note:'PRIVATE_QUANTITY_NOTE'}}],views:[{id:'root',title:'Compact supplied flow',nodeIds:['a','b','private-portal'],edgeIds:['zero-edge','missing-edge','supplied-source-derived','supplied-reference','supplied-author','private-edge'],positions:{a:{x:0,y:0},b:{x:300,y:0},'private-portal':{x:600,y:0}}},{id:'detail',title:'Other chapter',nodeIds:['c','d'],edgeIds:['other-edge'],positions:{c:{x:0,y:0},d:{x:300,y:0}}},{id:'private-detail',title:'PRIVATE_QUANTITY_VIEW',nodeIds:['private-leaf'],edgeIds:[]}]}));
}
const connectionLedger=(html:string,title:string)=>{const match=html.match(new RegExp('<table[^>]*aria-label="Connections of '+title+'"[^>]*>[\\s\\S]*?</table>'));assert.ok(match,'named connection ledger');return match[0];};

test('compact business manual retains zero, missing, exact provenance and notes without inferring observations or changing the Project',async()=>{
 const {validatePublicationBrief}=await import('../src/intelligence/publicationBrief');const project=await suppliedQuantityManualProject(),before=JSON.stringify(project),brief=validatePublicationBrief({format:'diagramcloud.publication-brief/1',title:'Synthetic compact quantity sheet',audience:'Reviewer',viewIds:['root'],profile:'business'},project),html=technicalManualHtml(project,{brief,now:NOW}),ledger=connectionLedger(html,'Compact supplied flow');
 assert.ok(!html.includes('data-publication-page='),'compact business case does not rely on dense fallback');
 for(const text of ['zero-edge','missing-edge','Amount: 0','Unit: jobs/day','Provenance: synthetic','Not supplied','Synthetic &lt;script&gt;not executed&lt;/script&gt; &amp; &quot;note&quot;'])assert.ok(ledger.includes(text),text);
 for(const provenance of ['source-derived','reference','author']){assert.ok(ledger.includes('supplied-'+provenance));assert.ok(ledger.includes('Provenance: '+provenance));assert.ok(ledger.includes('Exact '+provenance+' note'));}assert.ok(ledger.includes('Unit:  units/day '),'unit whitespace is not normalized');
 const missing=ledger.match(/<tr><td\b[^>]*>missing-edge<\/td>[\s\S]*?<\/tr>/)![0];assert.ok(missing.includes('Not supplied'));assert.ok(!missing.includes('Amount: 0'));
 for(const text of ['PRIVATE_QUANTITY_','private-edge','OTHER_CHAPTER_UNIT','OTHER_CHAPTER_NOTE'])assert.ok(!html.includes(text),text);assert.match(html,/private connection\(s\) removed/);assert.ok(!/<script\b|(?:src|href)="https?:/i.test(html));assert.deepEqual(project.observations,[]);assert.equal(JSON.stringify(project),before);assert.equal(technicalManualHtml(project,{brief,now:NOW}),html);
});

test('compact Editorial default includes stable connection IDs and exact quantity notes; unavailable chapter cannot broaden public publication',async()=>{
 const project=await suppliedQuantityManualProject(),before=JSON.stringify(project),html=technicalManualHtml(project,{viewIds:['root'],now:NOW}),ledger=connectionLedger(html,'Compact supplied flow');assert.ok(!html.includes('data-publication-page='));assert.match(ledger,/zero-edge/);assert.match(ledger,/Amount: 0/);assert.match(ledger,/Provenance: synthetic/);assert.ok(!html.includes('OTHER_CHAPTER_NOTE'));assert.throws(()=>technicalManualHtml(project,{viewIds:['private-detail'],now:NOW}));assert.equal(JSON.stringify(project),before);
});


test('manual regeneration retains frozen public snapshot identity and output-header digests without changing publication inputs',async()=>{
 const {createPublication,validatePublication}=await import('../src/intelligence/library');const project=await suppliedQuantityManualProject(),before=JSON.stringify(project),snapshot=await createPublication(project,{title:'Synthetic frozen quantities',audience:'Reviewer',viewIds:['root'],profile:'business'},NOW.toISOString()),frozen=JSON.stringify(snapshot),html=technicalManualHtml(snapshot.document,{brief:snapshot.brief,viewIds:snapshot.viewIds,now:new Date(snapshot.createdAt)});assert.match(connectionLedger(html,'Compact supplied flow'),/Amount: 0/);assert.ok(!html.includes('OTHER_CHAPTER_NOTE'));assert.equal(JSON.stringify(snapshot),frozen);assert.equal(JSON.stringify(project),before);assert.equal((await validatePublication(snapshot)).outputDigest,snapshot.outputDigest);assert.equal(snapshot.outputBinding,'bound');
});
