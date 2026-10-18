import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsage,summarizeUsage,paretoByProtocol,type UsageEvent} from '../src/intelligence/usageEconomics';
const call=():UsageEvent=>({authority:'provider',id:'call-1',kind:'leaf-call',inputTokens:1000,outputTokens:500,cachedInputTokens:800,reasoningOutputTokens:300,cost:{amount:10,currency:'USD',basis:'metered'},allocations:[{featureId:'a',basisPoints:4000},{featureId:'b',basisPoints:3000}]});
test('cached and reasoning subsets never double-count token totals',()=>{const s=summarizeUsage([call()]);assert.equal(s.inputTokens+s.outputTokens,1500);assert.equal(s.cachedInputTokens,800);assert.equal(s.reasoningOutputTokens,300);});
test('conserved allocation and explicit unattributed residual',()=>{const s=summarizeUsage([call()]);assert.equal(s.costs[0].knownTotal,10);assert.equal(s.costs[0].allocated,7);assert.ok(Math.abs(s.costs[0].unattributed-3)<1e-12);assert.equal(s.features[0].inputTokens,400);});
test('filtering features never redistributes the excluded feature cost',()=>{assert.equal(summarizeUsage([call()],['a']).features[0].costs[0].amount,4);assert.equal(summarizeUsage([call()],[]).features.length,0);});
test('duplicate leaf-call readback counts once even with reordered allocations',()=>{const a=call(),b=call();b.allocations.reverse();assert.equal(normalizeUsage([a,b]).length,1);});
test('same native ID at different authorities is not merged',()=>{const b=call();b.authority='another-provider';assert.equal(summarizeUsage([call(),b]).calls,2);});
test('unknown input/output/cost stays counted globally and by attributed feature',()=>{const b=call();b.inputTokens=null;b.outputTokens=null;b.cachedInputTokens=null;b.reasoningOutputTokens=null;b.cost=null;const s=summarizeUsage([b]);assert.equal(s.unknownInputCalls,1);assert.equal(s.unknownCostCalls,1);assert.equal(s.features[0].unknownCostCalls,1);assert.deepEqual(s.costs,[]);});
test('zero cost is valid and distinct from missing cost',()=>{const b=call();b.cost!.amount=0;const s=summarizeUsage([b]);assert.equal(s.unknownCostCalls,0);assert.equal(s.costs[0].knownTotal,0);});
test('metered, estimate, subscription allocation and currencies never merge',()=>{const a=call(),b=call(),c=call(),d=call();b.id='b';c.id='c';d.id='d';b.cost!.basis='estimate';c.cost!.basis='subscription-allocation';d.cost!.currency='EUR';assert.equal(summarizeUsage([a,b,c,d]).costs.length,4);});
test('scope and allocations are copied, no caller mutation',()=>{const a=call(),raw=JSON.stringify(a),s=normalizeUsage([a]);s[0].cost!.amount=50;assert.equal(JSON.stringify(a),raw);});
for(const [name,mutate] of [
 ['parent spans',(x:any)=>{x.kind='run-total';}],['negative tokens',(x:any)=>{x.inputTokens=-1;}],['fractional tokens',(x:any)=>{x.inputTokens=0.5;}],
 ['cached greater than input',(x:any)=>{x.cachedInputTokens=1001;}],['reasoning greater than output',(x:any)=>{x.reasoningOutputTokens=501;}],
 ['subset with missing total',(x:any)=>{x.inputTokens=null;}],['excess allocation',(x:any)=>{x.allocations[0].basisPoints=8000;}],
 ['duplicate feature',(x:any)=>{x.allocations.push(x.allocations[0]);}],['NaN cost',(x:any)=>{x.cost.amount=NaN;}],
 ['unknown billing fields',(x:any)=>{x.cost.rate='some-price';}],['noninteger allocation',(x:any)=>{x.allocations[0].basisPoints=0.1;}]
] as const)test('usage refuses '+name,()=>{const a=call();mutate(a);assert.throws(()=>summarizeUsage([a]),/Invalid or conflicting/);});
test('conflicting duplicate identity refuses rather than picks latest',()=>{const b=call();b.outputTokens=b.outputTokens!+1;assert.throws(()=>normalizeUsage([call(),b]),/conflicting/);});
test('empty usage is an empty source result, no assumed cost-free work',()=>assert.deepEqual(summarizeUsage([]).costs,[]));
const point=(id:string,score:number,cost:number|null,protocol='test-harness-1')=>({id,score,cost,protocol,source:'synthetic fixture'});
test('frontier is per declared protocol and exact ties survive',()=>{const r=paretoByProtocol([point('a',.8,1),point('b',.8,1),point('c',.7,2),point('d',.9,.5,'other')]);assert.deepEqual(r.find(r=>r.protocol==='test-harness-1')?.frontier.map(p=>p.id),['a','b']);});
test('missing costs are excluded, not zero',()=>{const r=paretoByProtocol([point('a',.9,null),point('b',.8,1)])[0];assert.equal(r.missingCost.length,1);assert.equal(r.frontier[0].id,'b');});
test('zero price can be Pareto-optimal',()=>assert.equal(paretoByProtocol([point('a',.8,0),point('b',.7,2)])[0].frontier[0].id,'a'));
test('lower cost or higher score alone is not enough to dominate',()=>assert.equal(paretoByProtocol([point('a',.8,1),point('b',.9,2)])[0].frontier.length,2));
test('duplicate benchmark observation refuses',()=>assert.throws(()=>paretoByProtocol([point('a',.8,1),point('a',.9,2)])));
test('invalid benchmark values refuse',()=>assert.throws(()=>paretoByProtocol([point('a',1.2,1)])));
