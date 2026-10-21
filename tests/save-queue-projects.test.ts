import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLatestSaveQueue,type SaveQueueState} from '../src/core/saveQueue';
type Snapshot={id:string;revision:number};

test('a successful different project does not hide another project save failure',async()=>{
 const states:SaveQueueState[]=[];
 const queue=createLatestSaveQueue<Snapshot>(async s=>{if(s.id==='a')throw Error('quota on A');},s=>states.push(s),s=>s.id);
 await queue.enqueue({id:'a',revision:1});await queue.enqueue({id:'b',revision:1});
 assert.equal(queue.unsaved(),true,'A is still only in memory even though B saved');
 assert.equal(states.at(-1)?.status,'failed');
});
test('failure survives when a different project was already queued',async()=>{
 const states:SaveQueueState[]=[];
 const queue=createLatestSaveQueue<Snapshot>(async s=>{if(s.id==='a')throw Error('quota on A');},s=>states.push(s),s=>s.id);
 await Promise.all([queue.enqueue({id:'a',revision:1}),queue.enqueue({id:'b',revision:1})]);
 assert.equal(queue.unsaved(),true);assert.equal(states.at(-1)?.status,'failed');
});
test('only a successful snapshot of the same project recovers its failure',async()=>{
 const states:SaveQueueState[]=[];let fail=true;
 const queue=createLatestSaveQueue<Snapshot>(async s=>{if(fail&&s.id==='a')throw Error('quota');},s=>states.push(s),s=>s.id);
 await queue.enqueue({id:'a',revision:1});await queue.enqueue({id:'b',revision:1});
 assert.equal(queue.unsaved(),true);fail=false;await queue.enqueue({id:'a',revision:2});
 assert.equal(queue.unsaved(),false);assert.equal(states.at(-1)?.status,'saved');
});
test('recovering one of two failed projects does not erase the other',async()=>{
 let fail=true;const queue=createLatestSaveQueue<Snapshot>(async()=>{if(fail)throw Error('quota');},()=>{},s=>s.id);
 await queue.enqueue({id:'a',revision:1});await queue.enqueue({id:'b',revision:1});fail=false;
 await queue.enqueue({id:'a',revision:2});assert.equal(queue.unsaved(),true);
 await queue.enqueue({id:'b',revision:2});assert.equal(queue.unsaved(),false);
});
test('older failure is superseded by a queued success of the same project',async()=>{
 const states:SaveQueueState[]=[];
 const queue=createLatestSaveQueue<Snapshot>(async s=>{if(s.revision===1)throw Error('old failure');},s=>states.push(s),s=>s.id);
 await Promise.all([queue.enqueue({id:'a',revision:1}),queue.enqueue({id:'b',revision:2}),queue.enqueue({id:'a',revision:2})]);
 assert.equal(queue.unsaved(),false);assert.deepEqual(states.map(s=>s.status),['saving','saving','saving','saved']);
});
test('saves remain serialized across project identities',async()=>{
 const started:string[]=[],release:(()=>void)[]=[];
 const queue=createLatestSaveQueue<Snapshot>(s=>new Promise<void>(resolve=>{started.push(s.id);release.push(resolve);}),()=>{},s=>s.id);
 const a=queue.enqueue({id:'a',revision:1}),b=queue.enqueue({id:'b',revision:1});
 await new Promise(r=>setImmediate(r));assert.deepEqual(started,['a']);release[0]();await a;
 await new Promise(r=>setImmediate(r));assert.deepEqual(started,['a','b']);assert.equal(queue.unsaved(),true);
 release[1]();await b;assert.equal(queue.unsaved(),false);assert.equal(queue.generation(),2);
});
test('unsaved identities point to every affected draft and are returned as copies',async()=>{
 const queue=createLatestSaveQueue<Snapshot>(async s=>{if(s.id==='a')throw Error('quota');},()=>{},s=>s.id);
 await queue.enqueue({id:'a',revision:1});await queue.enqueue({id:'b',revision:1});
 const keys=queue.unsavedKeys();assert.deepEqual(keys,['a']);keys.push('invented');assert.deepEqual(queue.unsavedKeys(),['a']);
});
test('an empty rejection still produces an actionable failure message',async()=>{
 const states:SaveQueueState[]=[];const queue=createLatestSaveQueue<Snapshot>(async()=>{throw '';},s=>states.push(s),s=>s.id);
 await queue.enqueue({id:'a',revision:1});assert.equal(states.at(-1)?.status,'failed');assert.match(states.at(-1)?.error??'',/save failed/);assert.equal(queue.unsaved(),true);
});


test('individual recovery checks acknowledge only the requested project',async()=>{
 const queue=createLatestSaveQueue<Snapshot>(async s=>{if(s.id==='a')throw Error('quota on A');},()=>{},s=>s.id);
 await queue.enqueue({id:'a',revision:1});await queue.enqueue({id:'b',revision:1});
 assert.equal(queue.unsaved('a'),true);assert.equal(queue.unsaved('b'),false);assert.equal(queue.unsaved(),true);
 assert.deepEqual(queue.unsavedKeys(),['a']);
});
test('an older completion cannot mark a newer same-project repair saved',async()=>{
 const release:(()=>void)[]=[];const queue=createLatestSaveQueue<Snapshot>(()=>new Promise<void>(r=>release.push(r)),()=>{},s=>s.id);
 const first=queue.enqueue({id:'repair',revision:1}),second=queue.enqueue({id:'repair',revision:2});
 await new Promise(r=>setImmediate(r));release[0]();await first;
 assert.equal(queue.unsaved('repair'),true);
 await new Promise(r=>setImmediate(r));release[1]();await second;assert.equal(queue.unsaved('repair'),false);
});
