import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone,edgeSchema,nodeSchema,type Project} from '../src/core/model';
import {flowRanks as coreRanks,layeredLayout,layoutCrossings,LAYOUT_COLUMN,LAYOUT_ROW,LAYOUT_NODE_HEIGHT,LAYOUT_NODE_WIDTH} from '../src/core/layout';
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

const viewEdges=(d:Project,viewId:string)=>{const v=d.views.find(x=>x.id===viewId)!;
 return d.edges.filter(e=>v.edgeIds.includes(e.id)&&v.nodeIds.includes(e.source)&&v.nodeIds.includes(e.target));};
/** Crossings of one view's connections only (the helper above counts every edge of a one-view project). */
const viewCrossings=(d:Project,viewId:string,p:Pos)=>crossings({...d,edges:viewEdges(d,viewId).filter(e=>p[e.source]&&p[e.target])},p);
const contoso=()=>samples.find(s=>s.id==='contoso-forecasting')!;

test('wrap: Contoso Forecasting overview folds into bands of at most 6 columns',()=>{
 const d=contoso(),flat=layeredLayout(d,'overview',{maxColumns:Infinity}),p=layeredLayout(d,'overview');
 const xs=(q:Pos)=>new Set(Object.values(q).map(b=>b.x)).size;
 assert.ok(xs(flat)>6,`unwrapped has ${xs(flat)} columns`);
 assert.ok(xs(p)<=6,`wrapped has ${xs(p)} columns`);
 const width=(q:Pos)=>Math.max(...Object.values(q).map(b=>b.x))+LAYOUT_NODE_WIDTH;
 assert.ok(width(p)<=6*LAYOUT_COLUMN,`width ${width(p)}`);
 assert.ok(!overlaps(p));
 assert.deepEqual(layeredLayout(clone(d),'overview'),p);
 const again=clone(d);again.views.find(v=>v.id==='overview')!.positions=p;assert.deepEqual(layeredLayout(again,'overview'),p,'idempotent');
});

test('wrap: column k sits in band floor(k/6), bands read left to right, order inside a column kept',()=>{
 const ids=Array.from({length:14},(_,i)=>`n${String(i).padStart(2,'0')}`),links=ids.slice(1).map((id,i)=>`${ids[i]}>${id}`);
 links.push('n02>x','x>n04');const all=[...ids,'x'],d=project(all,links);
 const flat=layeredLayout(d,'v',{maxColumns:Infinity}),p=layeredLayout(d,'v'),col=(id:string)=>Math.round(flat[id].x/LAYOUT_COLUMN);
 const bandTop=(k:number)=>Math.min(...all.filter(n=>Math.floor(col(n)/6)===k).map(n=>p[n].y));
 const bandBottom=(k:number)=>Math.max(...all.filter(n=>Math.floor(col(n)/6)===k).map(n=>p[n].y))+LAYOUT_NODE_HEIGHT;
 for(const id of all){
  const k=Math.floor(col(id)/6);
  assert.equal(p[id].x,(col(id)%6)*LAYOUT_COLUMN,`${id}: column ${col(id)} at slot ${col(id)%6} of band ${k}`);
  assert.ok(p[id].y>=bandTop(k)&&p[id].y+LAYOUT_NODE_HEIGHT<=bandBottom(k));
 }
 for(let k=1;k<=Math.floor(col('n13')/6);k++)assert.ok(bandTop(k)-bandBottom(k-1)>=LAYOUT_ROW-LAYOUT_NODE_HEIGHT+100,`lane above band ${k}`);
 assert.equal(Math.floor(col('n13')/6),2);
 // Column 3 holds n03 and x: same vertical order as unwrapped.
 assert.equal(Math.sign(p.x.y-p.n03.y),Math.sign(flat.x.y-flat.n03.y));
 assert.ok(!overlaps(p));
 // At 4 columns the n03/x → n04 connectors would cross n02 → x: the wrap is refused and the row stays unwrapped.
 assert.deepEqual(layeredLayout(d,'v',{maxColumns:4}),flat);
 const chain=project(ids,ids.slice(1).map((id,i)=>`${ids[i]}>${id}`)),four=layeredLayout(chain,'v',{maxColumns:4});
 assert.deepEqual(layeredLayout(clone(chain),'v',{maxColumns:4}),four);
 assert.equal(new Set(Object.values(four).map(b=>b.x)).size,4);assert.equal(new Set(Object.values(four).map(b=>b.y)).size,4);
 assert.throws(()=>layeredLayout(d,'v',{maxColumns:0}));
});

test('wrap: crossings never increase versus unwrapped, and never exceed the authored layout where the view wraps',()=>{
 for(const s of samples)for(const v of s.views){
  const flat=layeredLayout(s,v.id,{maxColumns:Infinity}),p=layeredLayout(s,v.id),depth=new Set(Object.values(flat).map(b=>b.x)).size;
  const w=viewCrossings(s,v.id,p),u=viewCrossings(s,v.id,flat),ref=`${s.id}/${v.id}`;
  assert.ok(w<=u,`${ref}: wrapped ${w} > unwrapped ${u}`);
  assert.ok(!overlaps(p),`${ref} overlaps`);
  const authored=Object.fromEntries(Object.entries(v.positions).filter(([id])=>v.nodeIds.includes(id)));
  if(depth>6&&Object.keys(authored).length===Object.keys(p).length)assert.ok(w<=viewCrossings(s,v.id,authored),`${ref}: wrapped ${w} > authored`);
 }
 assert.equal(layoutCrossings([{from:'a',to:'d'},{from:'b',to:'c'}],{a:{x:0,y:0},b:{x:0,y:200},c:{x:400,y:0},d:{x:400,y:200}}),1);
});

test('every view of every sample: auto crossings never exceed the authored layout; deterministic and idempotent',()=>{
 const all=[...samples,...(samples.includes(contoso())?[]:[contoso()])];
 for(const s of all)for(const v of s.views){
  const p=layeredLayout(s,v.id),ref=`${s.id}/${v.id}`,auto=viewCrossings(s,v.id,p);
  const authored=Object.fromEntries(Object.entries(v.positions).filter(([id])=>v.nodeIds.includes(id)));
  if(Object.keys(authored).length===Object.keys(p).length)assert.ok(auto<=viewCrossings(s,v.id,authored),`${ref}: auto ${auto} > authored ${viewCrossings(s,v.id,authored)}`);
  assert.ok(!overlaps(p),`${ref} overlaps`);
  assert.deepEqual(layeredLayout(clone(s),v.id),p,`${ref} deterministic`);
  const again=clone(s);again.views.find(x=>x.id===v.id)!.positions=p;assert.deepEqual(layeredLayout(again,v.id),p,`${ref} idempotent`);
 }
 const dp=samples.find(s=>s.views.some(v=>v.id==='portfolio-flow'))!;
 assert.equal(viewCrossings(dp,'portfolio-flow',layeredLayout(dp,'portfolio-flow')),0);
});
