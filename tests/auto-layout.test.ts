import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone,edgeSchema,nodeSchema,type Project} from '../src/core/model';
import {flowRanks as coreRanks,layeredLayout,LAYOUT_NODE_HEIGHT,LAYOUT_NODE_WIDTH} from '../src/core/layout';
import {flowRanks} from '../src/export/design/flow';

type Pos=Record<string,{x:number;y:number}>;
/** A one-view project: nodes in the given order, edges as `a>b`. Optional repository prefixes come from `repos`. */
function project(ids:string[],links:string[],repos:string[]=[]):Project{
 const d=clone(samples[0]) as Project;
 d.nodes=ids.map(id=>nodeSchema.parse({id,label:id}));
 d.edges=links.map((l,i)=>{const [source,target]=l.split('>');return edgeSchema.parse({id:`e${i}`,source,target});});
 d.views=[{...d.views[0],id:'v',nodeIds:ids,edgeIds:d.edges.map(e=>e.id),positions:{}}];d.rootViewId='v';
 d.atlas=repos.length?{activeSnapshotId:'s',snapshots:[{id:'s',repositories:repos.map(id=>({id}))}]} as unknown as Project['atlas']:undefined;
 return d;
}
const grid=(d:Project):Pos=>Object.fromEntries(d.views[0].nodeIds.map((id,i)=>[id,{x:(i%3)*300,y:Math.floor(i/3)*180}]));
const overlaps=(p:Pos)=>{const b=Object.values(p);for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++)
 if(Math.abs(b[i].x-b[j].x)<LAYOUT_NODE_WIDTH&&Math.abs(b[i].y-b[j].y)<LAYOUT_NODE_HEIGHT)return true;return false;};
/** Straight centre-to-centre segments that properly intersect. */
function crossings(d:Project,p:Pos){
 const c=(id:string)=>({x:p[id].x+LAYOUT_NODE_WIDTH/2,y:p[id].y+LAYOUT_NODE_HEIGHT/2}),seg=d.edges.map(e=>[c(e.source),c(e.target),e.source,e.target] as const);
 const o=(a:{x:number;y:number},b:{x:number;y:number},q:{x:number;y:number})=>Math.sign((b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x));
 let n=0;for(let i=0;i<seg.length;i++)for(let j=i+1;j<seg.length;j++){const [a,b,s1,t1]=seg[i],[q,r,s2,t2]=seg[j];if(new Set([s1,t1,s2,t2]).size<4)continue;
  if(o(a,b,q)*o(a,b,r)<0&&o(q,r,a)*o(q,r,b)<0)n++;}
 return n;
}

test('deterministic and idempotent: positions are not an input',()=>{
 const d=project(['a','b','c','d','e'],['a>c','b>c','c>d','a>e']);
 const first=layeredLayout(d,'v');assert.deepEqual(layeredLayout(clone(d),'v'),first);
 d.views[0].positions=first;assert.deepEqual(layeredLayout(d,'v'),first);
});

test('every sample view: all members placed, no overlapping boxes, acyclic edges run left to right',()=>{
 for(const s of samples)for(const v of s.views){
  const p=layeredLayout(s,v.id),members=v.nodeIds.filter(id=>s.nodes.some(n=>n.id===id));
  assert.deepEqual(Object.keys(p).sort(),[...members].sort(),`${s.id}/${v.id}`);
  assert.ok(!overlaps(p),`${s.id}/${v.id} overlaps`);
 }
 const d=project(['src','a','b','sink','lone'],['src>a','src>b','a>sink','b>sink','src>sink']),p=layeredLayout(d,'v');
 for(const e of d.edges)assert.ok(p[e.source].x<p[e.target].x,`${e.source}→${e.target}`);
 assert.ok(p.lone.y>Math.max(p.src.y,p.a.y,p.b.y,p.sink.y),'unconnected component sits in a band under the flow');
});

test('a cycle still gives a valid, non-overlapping layout',()=>{
 const d=project(['a','b','c','d'],['a>b','b>c','c>a','c>d']),p=layeredLayout(d,'v');
 assert.equal(Object.keys(p).length,4);assert.ok(!overlaps(p));assert.ok(p.a.x<p.b.x&&p.b.x<p.c.x&&p.c.x<p.d.x);
});

test('crafted 2-layer example: no more crossings than the grid layout',()=>{
 const d=project(['a1','a2','a3','b1','b2','b3'],['a1>b3','a2>b2','a3>b1','a1>b2']);
 const auto=crossings(d,layeredLayout(d,'v')),g=crossings(d,grid(d));
 assert.ok(auto<=g,`auto ${auto} > grid ${g}`);assert.equal(auto,0);
});

test('members of one repository stay contiguous within a column',()=>{
 const d=project(['root','r1.x','r2.x','r1.y','r2.y'],['root>r1.x','root>r2.x','root>r1.y','root>r2.y'],['r1','r2']),p=layeredLayout(d,'v');
 const col=['r1.x','r2.x','r1.y','r2.y'].sort((a,b)=>p[a].y-p[b].y).map(id=>id.split('.')[0]);
 assert.ok(col.join()==='r1,r1,r2,r2'||col.join()==='r2,r2,r1,r1',col.join());
});

test('flowRanks moved to core keeps the design export working',()=>{assert.equal(flowRanks,coreRanks);});
