import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDeliveryView,DELIVERY_VIEW_REFUSAL} from '../src/development/deliveryEvidence';
import {readDeliveryTaskSnapshot,resolveDeliveryTaskLinks,TASK_LINK_NOTICE} from '../src/development/deliveryTaskLinks';
import {PM_TASK_REFUSAL} from '../src/development/pmTasks';
const input=()=>JSON.parse(readFileSync(new URL('./fixtures/delivery-evidence/example-service.json',import.meta.url),'utf8'));
const tasks=()=>({schema:'datapass.owner-tasks/1',scope:{organizationId:'synthetic',privacyDomainId:'private',projectId:'service',repoId:'example.service'},revision:4,
 tasks:[{id:'task.api',title:'Serve request',description:'Supplied task, not an executed release',state:'DONE',desiredDate:null,dependencies:[],reviewStatus:'APPROVED',acceptanceIds:['AC2'],author:'Synthetic owner',createdAt:'2026-09-01T08:00:00Z',updatedAt:'2026-09-30T08:00:00Z'}]});
function fixture(){const snapshot=readDeliveryTaskSnapshot(JSON.stringify(tasks())),p=input();p.handoff.block_details[1].pm_task_refs=[{task_id:'task.api',input_sha256:snapshot.inputSha256,revision:4,scope:tasks().scope}];return {p,snapshot,plan:parseDeliveryView(JSON.stringify(p))};}
test('explicit source-scoped task reference resolves without promoting approval',()=>{const {plan,snapshot}=fixture(),r=resolveDeliveryTaskLinks(plan,snapshot,'author');assert.equal(r.links[0].state,'MATCHED');assert.equal(r.links[0].task?.state,'DONE');assert.match(TASK_LINK_NOTICE,/not DiagramCloud approval/);assert.ok(!('approved' in r));});
test('no mapping is inferred from equal title or task/block identity',()=>{const s=readDeliveryTaskSnapshot(JSON.stringify(tasks())),p=input();p.blocks[1].id='task.api';p.handoff.block_details[1].block_id='task.api';p.blocks[3].depends_on=['task.api'];const r=resolveDeliveryTaskLinks(parseDeliveryView(JSON.stringify(p)),s,'author');assert.deepEqual(r.links,[]);assert.ok(r.unmappedBlocks.includes('task.api'));});
test('missing task snapshot remains explicit',()=>{const {plan}=fixture();assert.equal(resolveDeliveryTaskLinks(plan,null,'author').links[0].state,'NO_SNAPSHOT');});
test('a changed snapshot is not automatically rebound',()=>{const {plan}=fixture(),t=tasks();t.revision++;const r=resolveDeliveryTaskLinks(plan,readDeliveryTaskSnapshot(JSON.stringify(t)),'author');assert.equal(r.links[0].state,'SNAPSHOT_MISMATCH');assert.equal(r.links[0].task,null);});
test('different whitespace is a different byte cut, not a silent alias',()=>{const {plan}=fixture();assert.equal(resolveDeliveryTaskLinks(plan,readDeliveryTaskSnapshot(JSON.stringify(tasks(),null,2)),'author').links[0].state,'SNAPSHOT_MISMATCH');});
for(const key of ['organizationId','privacyDomainId','projectId','repoId'] as const)test('scope mismatch '+key+' is refused without returning task data',()=>{const {p,snapshot}=fixture();p.handoff.block_details[1].pm_task_refs[0].scope[key]='other';const r=resolveDeliveryTaskLinks(parseDeliveryView(JSON.stringify(p)),snapshot,'author');assert.equal(r.links[0].state,'SCOPE_MISMATCH');assert.equal(r.links[0].task,null);});
test('wrong task revision is not accepted even with matching hash',()=>{const {p,snapshot}=fixture();p.handoff.block_details[1].pm_task_refs[0].revision=3;const r=resolveDeliveryTaskLinks(parseDeliveryView(JSON.stringify(p)),snapshot,'author');assert.equal(r.links[0].state,'REVISION_MISMATCH');assert.equal(r.links[0].task,null);});
test('absent task stays absent',()=>{const {p,snapshot}=fixture();p.handoff.block_details[1].pm_task_refs[0].task_id='absent';assert.equal(resolveDeliveryTaskLinks(parseDeliveryView(JSON.stringify(p)),snapshot,'author').links[0].state,'TASK_ABSENT');});
test('result mutations never alter the snapshot or plan',()=>{const {plan,snapshot}=fixture(),before=JSON.stringify({plan,snapshot}),r=resolveDeliveryTaskLinks(plan,snapshot,'author');r.links[0].task!.title='changed';r.links[0].expected.scope.repoId='changed';assert.equal(JSON.stringify({plan,snapshot}),before);});
test('task contents stay private even when the surrounding plan is public',()=>{const {p,snapshot}=fixture();p.visibility='public';assert.deepEqual(resolveDeliveryTaskLinks(parseDeliveryView(JSON.stringify(p)),snapshot,'public'),{withheld:true,links:[],unmappedBlocks:[]});});
for(const [name,edit] of [
 ['missing scope',(r:any)=>delete r.scope],['extra authority',(r:any)=>r.approved=true],['invalid hash',(r:any)=>r.input_sha256='same'],['negative revision',(r:any)=>r.revision=-1],['fractional revision',(r:any)=>r.revision=1.2],['unknown scope field',(r:any)=>r.scope.token='not-a-credential'],['bad task id',(r:any)=>r.task_id='bad\n']
] as const)test('invalid mapping refuses whole '+name,()=>{const {p}=fixture();edit(p.handoff.block_details[1].pm_task_refs[0]);assert.throws(()=>parseDeliveryView(JSON.stringify(p)),{message:DELIVERY_VIEW_REFUSAL});});
test('duplicate references refuse instead of double counting',()=>{const {p}=fixture();p.handoff.block_details[1].pm_task_refs.push(p.handoff.block_details[1].pm_task_refs[0]);assert.throws(()=>parseDeliveryView(JSON.stringify(p)),{message:DELIVERY_VIEW_REFUSAL});});
test('existing PM validator rejects hostile, malformed and oversized data',()=>{for(const raw of ['{bad',' '.repeat(262145),JSON.stringify({...tasks(),execute:'anything'})])assert.throws(()=>readDeliveryTaskSnapshot(raw),{message:PM_TASK_REFUSAL});});
test('task description stays inert text',()=>{const {p}=fixture(),t=tasks();t.tasks[0].description='<script>window.EXECUTED=true</script>';const s=readDeliveryTaskSnapshot(JSON.stringify(t));p.handoff.block_details[1].pm_task_refs[0].input_sha256=s.inputSha256;const r=resolveDeliveryTaskLinks(parseDeliveryView(JSON.stringify(p)),s,'author');assert.equal(r.links[0].task?.description,t.tasks[0].description);assert.equal((globalThis as any).EXECUTED,undefined);});

test('committed synthetic plan pins the exact committed PM task bytes',()=>{
 const p=readFileSync(new URL('./fixtures/delivery-evidence/linked-plan.json',import.meta.url),'utf8');
 const t=readFileSync(new URL('./fixtures/delivery-evidence/linked-tasks.json',import.meta.url),'utf8');
 const r=resolveDeliveryTaskLinks(parseDeliveryView(p),readDeliveryTaskSnapshot(t),'author');
 assert.equal(r.links.length,1);assert.equal(r.links[0].state,'MATCHED');
});
test('one task snapshot may support several explicitly distinct plan blocks, without summing task states',()=>{
 const {p,snapshot}=fixture();p.handoff.block_details[2].pm_task_refs=structuredClone(p.handoff.block_details[1].pm_task_refs);
 const r=resolveDeliveryTaskLinks(parseDeliveryView(JSON.stringify(p)),snapshot,'author');
 assert.equal(r.links.length,2);assert.equal(r.links.filter(l=>l.state==='MATCHED').length,2);
 assert.ok(!('percentComplete' in r));assert.ok(!('delivered' in r));
});
