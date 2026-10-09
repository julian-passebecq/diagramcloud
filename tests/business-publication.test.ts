import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clone,documentSchema} from '../src/core/model';
import {samples} from '../src/data/samples';
import {howItWorksFacts,howItWorksHtml} from '../src/export/howItWorks';
import {validatePublicationBrief,publicationFidelity} from '../src/intelligence/publicationBrief';
import {technicalManualHtml} from '../src/export/manual';
import {createPublication} from '../src/intelligence/library';
const path=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-path',title:'Synthetic business path',rootViewId:'root',nodes:['one','two','three','four'].map(id=>({id,label:id,summary:'Supplied contribution '+id,basis:'planned'})),edges:[{id:'first',source:'one',target:'two'},{id:'second',source:'two',target:'three'}],views:[{id:'root',title:'Synthetic path',nodeIds:['one','two','three','four'],edgeIds:['first','second']}]});
test('How it works follows selected source path, stops branches/cycles and preserves public provenance',()=>{
 const p=path(),before=JSON.stringify(p),options={mode:'path' as const,viewId:'root',startNodeId:'one'};
 const facts=howItWorksFacts(p,options);assert.deepEqual(facts.steps.map(s=>s.nodeId),['one','two','three']);assert.equal(facts.complete,true);assert.equal(JSON.stringify(p),before);
 p.edges.push({...p.edges[0],id:'branch',source:'two',target:'four'});p.views[0].edgeIds.push('branch');assert.equal(howItWorksFacts(p,options).steps.length,2);assert.match(howItWorksFacts(p,options).notes.join(' '),/branch/);
 p.nodes[0].visibility='private';const html=howItWorksHtml(p,{mode:'story'});assert.ok(!html.includes('Supplied contribution one'));assert.match(html,/No supplied steps/);
});
test('publication brief is presentation-only, validates scope and controls real profile/detail/paper exports',async()=>{
 const p=clone(samples[0]),original=JSON.stringify(p),brief=validatePublicationBrief({format:'diagramcloud.publication-brief/1',title:'Curated <title>',audience:'Reviewer',viewIds:[p.rootViewId],detail:'standard',profile:'blueprint',paper:'letter',storyIndices:[]},p);
 assert.throws(()=>validatePublicationBrief({...brief,viewIds:['missing']},p),/unavailable/);assert.throws(()=>validatePublicationBrief({...brief,storyIndices:[999]},p),/unavailable/);
 const html=technicalManualHtml(p,{brief});assert.match(html,/Curated &lt;title&gt;/);assert.match(html,/size:letter/);assert.match(html,/Blueprint|blueprint/);assert.match(html,/detail standard/);assert.ok(!html.includes('<h2 id="h-evidence">'));
 const ledger=publicationFidelity(p,brief);assert.deepEqual(ledger.views[0].nodes.shown,p.views.find(v=>v.id===p.rootViewId)!.nodeIds.filter(id=>p.nodes.find(n=>n.id===id)?.visibility==='public'));assert.equal(ledger.profile,'blueprint');assert.ok(ledger.omittedViews.every(v=>v.reason));
 const snapshot=await createPublication(p,brief);assert.deepEqual(snapshot.brief,brief);assert.equal(JSON.stringify(p),original);
});
