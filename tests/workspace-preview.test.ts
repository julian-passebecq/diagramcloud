import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {createWorkspacePreviewStore} from '../src/ui/workspacePreview';
const fixture=()=>structuredClone(samples.find(p=>p.id==='retail-operations')!);
test('preview leases are transient, restore preceding focus and never mutate authored selection or Project',()=>{
 const project=fixture(),before=JSON.stringify(project),store=createWorkspacePreviewStore(project);const [a,b]=project.nodes;
 const focus=store.actions.preview({nodeId:a.id});const hover=store.actions.preview({nodeId:b.id});
 assert.equal(store.getSnapshot()?.nodeId,b.id);hover();assert.equal(store.getSnapshot()?.nodeId,a.id);focus();assert.equal(store.getSnapshot(),null);assert.equal(JSON.stringify(project),before);
});
test('only subscribed consumers are notified and unchanged preview identity does not invalidate them',()=>{
 const project=fixture(),store=createWorkspacePreviewStore(project);let notifications=0;const unlisten=store.subscribe(()=>notifications++);
 const first=store.actions.preview({nodeId:project.nodes[0].id});const snapshot=store.getSnapshot();const second=store.actions.preview({nodeId:project.nodes[0].id});
 assert.equal(notifications,1);assert.equal(store.getSnapshot(),snapshot);first();assert.equal(notifications,1);second();assert.equal(notifications,2);
 unlisten();store.actions.preview({nodeId:project.nodes[1].id});assert.equal(notifications,2);
});
test('commit clears all transient leases; delayed leave cannot erase a newer preview',()=>{
 const project=fixture(),store=createWorkspacePreviewStore(project),[a,b]=project.nodes;
 const old=store.actions.preview({nodeId:a.id});store.actions.clear();const next=store.actions.preview({nodeId:b.id});old();assert.equal(store.getSnapshot()?.nodeId,b.id);next();assert.equal(store.getSnapshot(),null);
});
test('public projection precedes identity checks: hidden and nonexistent targets behave alike',()=>{
 const project=fixture();project.nodes.push({...structuredClone(project.nodes[0]),id:'private-preview-canary',label:'PRIVATE_PREVIEW_CANARY',visibility:'private'});project.views[0].nodeIds.push('private-preview-canary');
 project.views.push({id:'private-view',title:'PRIVATE_VIEW',description:'private',visibility:'private',nodeIds:['private-preview-canary'],edgeIds:[],positions:{'private-preview-canary':{x:0,y:0}}});
 const store=createWorkspacePreviewStore(project,true);let changed=0;store.subscribe(()=>changed++);
 for(const target of [{nodeId:'private-preview-canary'},{viewId:'private-view'},{nodeId:'missing'},{viewId:'missing'}]){store.actions.preview(target)();assert.equal(store.getSnapshot(),null);}assert.equal(changed,0);
});
test('view-node target must be an actual permitted membership; invalid previews preserve existing preview',()=>{
 const project=fixture(),store=createWorkspacePreviewStore(project),view=project.views[0],node=project.nodes.find(n=>!view.nodeIds.includes(n.id))!;
 const end=store.actions.preview({viewId:view.id});store.actions.preview({viewId:view.id,nodeId:node.id});assert.deepEqual(store.getSnapshot(),{viewId:view.id});end();assert.equal(store.getSnapshot(),null);
});
test('new project cut at the same revision has independent state and old callbacks cannot populate it',()=>{
 const project=fixture(),old=createWorkspacePreviewStore(project),end=old.actions.preview({nodeId:project.nodes[0].id});const replacement=structuredClone(project);replacement.nodes[0].label+=' changed';const current=createWorkspacePreviewStore(replacement);
 end();old.actions.preview({nodeId:project.nodes[0].id});assert.equal(current.getSnapshot(),null);assert.equal(current.getServerSnapshot(),null);
});
