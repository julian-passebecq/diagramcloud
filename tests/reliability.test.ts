import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLatestSaveQueue} from '../src/core/saveQueue';
import {previewDocumentChange} from '../src/core/changePreview';
import {clone} from '../src/core/model';
import {samples} from '../src/data/samples';
import {NODE_HEIGHT,NODE_WIDTH,orthogonalRoute,routeIsOrthogonal,routeLabel,sceneBounds} from '../src/export/scene';
const total=samples.find(d=>d.id==='total-project-controls')!;

test('save queue never reports saved while a newer edit is queued',async()=>{
 const states:string[]=[];
 const started:number[]=[];
 const resolvers=new Map<number,()=>void>();
 const queue=createLatestSaveQueue<number>(value=>new Promise<void>(resolve=>{started.push(value);resolvers.set(value,resolve);}),state=>states.push(state.status));
 const first=queue.enqueue(1);
 const second=queue.enqueue(2);
 assert.deepEqual(states,['saving','saving']);
 await new Promise<void>(resolve=>setImmediate(resolve));
 assert.deepEqual(started,[1]);
 resolvers.get(1)!();
 await first;
 await new Promise<void>(resolve=>setImmediate(resolve));
 assert.deepEqual(started,[1,2]);
 assert.deepEqual(states,['saving','saving']);
 resolvers.get(2)!();
 await second;
 assert.equal(states.at(-1),'saved');
});

test('only the newest save failure is surfaced',async()=>{
 const states:string[]=[];
 const queue=createLatestSaveQueue<number>(async value=>{if(value===2)throw new Error('latest failed');},state=>states.push(`${state.status}:${state.error??''}`));
 const first=queue.enqueue(1);
 const second=queue.enqueue(2);
 await Promise.all([first,second]);
 assert.deepEqual(states,['saving:','saving:','failed:latest failed']);
});

test('document preview reports stable-id edits and revision compatibility',()=>{
 const current=clone(total);current.revision=7;
 const incoming=clone(current);incoming.title='Reviewed architecture';incoming.nodes.find(node=>node.id==='checks')!.label='Reviewed SQL checks';incoming.nodes.push({...clone(incoming.nodes[0]),id:'new-node',label:'New task'});
 const preview=previewDocumentChange(current,incoming);
 assert.equal(preview.sameProject,true);
 assert.equal(preview.revision.compatible,true);
 assert.deepEqual(preview.metadata,['title']);
 assert.deepEqual(preview.entities.nodes.added,['new-node']);
 assert.deepEqual(preview.entities.nodes.changed,['checks']);
 assert.equal(preview.totalChanges,3);
 incoming.revision=6;
 assert.equal(previewDocumentChange(current,incoming).revision.compatible,false);
});

test('documents with a different project id are treated as new imports',()=>{
 const current=clone(total),incoming=clone(total);incoming.id='new-project';incoming.revision=999;
 const preview=previewDocumentChange(current,incoming);
 assert.equal(preview.sameProject,false);
 assert.equal(preview.revision.compatible,true);
});

test('shared export routes remain orthogonal in every direction',()=>{
 const cases=[
  [{x:0,y:0},{x:420,y:0}],
  [{x:420,y:0},{x:0,y:0}],
  [{x:0,y:0},{x:0,y:280}],
  [{x:0,y:280},{x:0,y:0}],
  [{x:0,y:0},{x:100,y:40}]
 ] as const;
 for(const [source,target] of cases){
  const route=orthogonalRoute(source,target);
  assert.ok(route.length>=2);
  assert.equal(routeIsOrthogonal(route),true);
  const label=routeLabel(route);assert.ok(Number.isFinite(label.x)&&Number.isFinite(label.y));
 }
});

test('scene bounds account for shared node dimensions',()=>{
 const b=sceneBounds([{x:10,y:20},{x:400,y:300}],0);
 assert.equal(b.width,400+NODE_WIDTH);
 assert.equal(b.height,300+NODE_HEIGHT);
});
