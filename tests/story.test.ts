import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {draftStep,draftStory,edgesAround,insertStep,moveStep,removeStep,replaceStep,retarget,stepNotes} from '../src/core/story';

const total=samples.find(s=>s.id==='total-project-controls')!;
const withStory=(story:typeof total.story)=>validateDocument({...clone(total),story});

test('a step drafted from a component uses its own words and highlights its connections',()=>{
 const s=draftStep(total,'overview','checks'),n=total.nodes.find(x=>x.id==='checks')!;
 assert.equal(s.title,n.label);assert.equal(s.nodeId,'checks');assert.equal(s.narration,n.role||n.summary);
 assert.deepEqual(s.highlightEdgeIds,edgesAround(total,'overview','checks'));
 assert(s.highlightEdgeIds.length>0);
 const whole=draftStep(total,'overview',null);
 assert.equal('nodeId' in whole,false,'no focus key when drafting a whole view');assert.deepEqual(whole.highlightEdgeIds,[]);
 assert.equal('nodeId' in draftStep(total,'overview','check-function'),false,'a component outside the view is not used as focus');
 withStory([s,whole]);
});

test('draft story visits every reachable view once, root first, in drilldown order',()=>{
 const story=draftStory(total);
 assert.equal(story[0].viewId,total.rootViewId);
 assert.equal(new Set(story.map(s=>s.viewId)).size,story.length);
 // Children follow their parent: each non-root view appears after a view that drills into it.
 for(const [k,st] of story.entries())if(k>0)assert(story.slice(0,k).some(prev=>total.nodes.some(n=>n.childViewId===st.viewId&&total.views.find(v=>v.id===prev.viewId)!.nodeIds.includes(n.id))),st.viewId);
 const reachable=new Set(publicDocument(total).views.map(v=>v.id));
 for(const id of reachable)assert(story.some(s=>s.viewId===id),`view ${id} has a step`);
 withStory(story);
});

test('moving, inserting, removing and replacing return new arrays and keep the document valid',()=>{
 const st=total.story,moved=moveStep(st,0,2);
 assert.deepEqual(moved.map(s=>s.title),[st[1],st[2],st[0],...st.slice(3)].map(s=>s.title));
 assert.equal(moveStep(st,0,-1),st,'out-of-range moves are ignored');assert.equal(st[0].title,total.story[0].title,'no mutation');
 const added=insertStep(st,1,draftStep(total,'overview','excel'));assert.equal(added[1].nodeId,'excel');assert.equal(added.length,st.length+1);
 assert.equal(removeStep(st,0).length,st.length-1);
 assert.equal(replaceStep(st,0,{...st[0],title:'New title'})[0].title,'New title');
 for(const s of [moved,added,removeStep(st,0)])withStory(s);
});

test('retargeting a step to another view drops the focus and highlights that do not belong to it',()=>{
 const s=draftStep(total,'overview','checks'),other=total.views.find(v=>v.id!=='overview'&&!v.nodeIds.includes('checks'))!;
 const r=retarget(total,s,other.id);
 assert.equal(r.viewId,other.id);assert.equal('nodeId' in r,false);assert.deepEqual(r.highlightEdgeIds,[]);
 withStory([r]);
});

test('step notes say when text is missing or the public portfolio will skip the step',()=>{
 const d=clone(total),s={...draftStep(d,'overview','checks'),narration:''};
 assert.deepEqual(stepNotes(d,s),['No narration yet: Present mode will show only the title.']);
 d.nodes.find(n=>n.id==='checks')!.visibility='private';
 assert(stepNotes(d,s).includes('The focus component is private, so the public portfolio skips this step.'));
 assert.equal(publicDocument({...d,story:[{...s,narration:'x'}]}).story.length,0,'and it really is skipped');
});
