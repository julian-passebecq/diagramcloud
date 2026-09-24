import test from 'node:test';
import assert from 'node:assert/strict';
import {examplePack} from '../src/experience/sample';
import {reviewReplacement,type ExperiencePack} from '../src/experience/model';
import {HISTORY_LIMIT,commitPack,describeChange,historyKey,redoLabel,redoPack,startHistory,undoLabel,undoPack} from '../src/experience/history';

const edit=(p:ExperiencePack,fn:(q:ExperiencePack)=>void)=>{const q=structuredClone(p);fn(q);return q;};
const remix=(p:ExperiencePack)=>p.workspaces.find(w=>w.id==='remix-screen')!;

test('undo and redo restore content while the revision only goes up',()=>{
 let h=startHistory(examplePack());const r0=h.present.revision;
 const moved=edit(h.present,q=>{remix(q).placements[0].x=3;remix(q).placements[0].w=3;});
 h=commitPack(h,moved,describeChange(h.present,moved));
 assert.equal(h.present.revision,r0+1);assert.equal(undoLabel(h),'Resized “SQL validation rule”');
 h=undoPack(h);
 assert.equal(remix(h.present).placements[0].x,0,'content restored');assert.equal(h.present.revision,r0+2,'revision still increases');
 assert.equal(redoLabel(h),'Resized “SQL validation rule”');
 h=redoPack(h);
 assert.equal(remix(h.present).placements[0].x,3);assert.equal(h.present.revision,r0+3);
 assert.equal(undoPack(startHistory(examplePack())).present.revision,r0,'nothing to undo is a no-op');
});

test('an AI import prepared before an undo is still refused as stale',()=>{
 let h=startHistory(examplePack());const exported=structuredClone(h.present);
 const next=edit(h.present,q=>{remix(q).title='Edited';});h=commitPack(h,next,describeChange(h.present,next));h=undoPack(h);
 assert.deepEqual(remix(h.present).title,remix(exported).title,'content is back to the exported state');
 assert.throws(()=>reviewReplacement(h.present,exported),/Revision conflict/);
});

test('a new edit clears redo, and history is capped',()=>{
 let h=startHistory(examplePack());
 for(let k=0;k<HISTORY_LIMIT+10;k++){const n=edit(h.present,q=>{remix(q).placements[1].y=k%2?0:20;});h=commitPack(h,n,'Moved');}
 assert.equal(h.past.length,HISTORY_LIMIT);
 h=undoPack(h);assert.equal(h.future.length,1);
 const n=edit(h.present,q=>{remix(q).description='x';});h=commitPack(h,n,'Board settings');
 assert.equal(h.future.length,0);
});

test('imports keep their own revision when recorded',()=>{
 const h=startHistory(examplePack()),incoming={...structuredClone(h.present),revision:h.present.revision+1,title:'Imported'};
 const next=commitPack(h,incoming,'Applied workspace import',true);
 assert.equal(next.present.revision,incoming.revision);assert.equal(undoLabel(next),'Applied workspace import');
});

test('change descriptions name what happened',()=>{
 const base=examplePack();
 assert.equal(describeChange(base,edit(base,q=>{remix(q).placements[0].x=6;remix(q).placements[0].y=8;})),'Moved “SQL validation rule”');
 assert.equal(describeChange(base,edit(base,q=>{remix(q).placements=remix(q).placements.slice(1);})),'Removed “SQL validation rule”');
 assert.equal(describeChange(base,edit(base,q=>{remix(q).placements.push({id:'new-p',itemId:'manifest-code',x:0,y:20,w:12,h:4});})),'Added “Portable project context”');
 assert.equal(describeChange(base,edit(base,q=>{q.workspaces.push({...structuredClone(remix(q)),id:'board-x',title:'My board'});})),'New board “My board”');
 assert.equal(describeChange(base,edit(base,q=>{remix(q).visibility='private';})),'Board settings');
 assert.equal(describeChange(base,edit(base,q=>{remix(q).placements.forEach((p,k)=>{p.y=k*4;p.x=0;p.w=12;});})),'Rearranged board');
});

test('keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, ignored while typing',()=>{
 const k=(key:string,o:{shift?:boolean;meta?:boolean;ctrl?:boolean;inField?:boolean}={})=>historyKey({key,ctrlKey:o.ctrl??!o.meta,metaKey:!!o.meta,shiftKey:!!o.shift,target:{closest:(s:string)=>o.inField&&s.includes('input')?{}:null} as unknown as EventTarget});
 assert.equal(k('z'),'undo');assert.equal(k('Z',{shift:true}),'redo');assert.equal(k('y'),'redo');assert.equal(k('z',{meta:true}),'undo');
 assert.equal(k('z',{inField:true}),null);assert.equal(k('z',{ctrl:false}),null);assert.equal(k('x'),null);
});
