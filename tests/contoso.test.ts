import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {perspectivesFor,viewSpec} from '../src/core/viewspec';
import {publicDocument} from '../src/core/operations';

const d=samples.find(s=>s.id==='contoso-forecasting')!;

test('Contoso Forecasting: the lab is read from source at one revision, the Fabric target is a design, shared code keeps its ID',()=>{
 assert.ok(d,'the sample is in the gallery');
 const overview=viewSpec(d,'overview');
 assert.deepEqual(overview.path.map(p=>p.viewId),['overview']);
 assert.ok(overview.nodes.filter(n=>n.id!=='fabric-app').every(n=>n.basis==='static-source'&&n.sourceRefs.length>0),'every lab component links to a file');
 assert.equal(overview.snapshot?.repositories[0].revision,'61353848b4e7e129e03ea8aedfc2794a17667de3');
 const target=viewSpec(d,'fabric-target');assert.equal(target.perspective,'cloud');
 assert.ok(target.edges.every(e=>e.basis==='planned'));
 assert.deepEqual(target.nodes.filter(n=>n.basis==='planned').map(n=>n.id),['entra','rayfin-client','dab','fabric-sql','onelake']);
 // The same Forecast UI and Gold model appear in the System (lab) and Cloud (target) perspectives.
 for(const id of ['forecast-ui','gold']){const s=Object.fromEntries(perspectivesFor(d,id).map(p=>[p.perspective,p.state]));assert.equal(s.system,'available');assert.equal(s.cloud,'available');}
 // Data zones and the environment stay separate views.
 assert.equal(viewSpec(d,'data-zones').perspective,'data');assert.ok(!viewSpec(d,'data-zones').nodes.some(n=>n.provider==='Microsoft Fabric'));
 // Reported latency is a source-derived note, never an observation.
 assert.equal(d.observations.length,0);assert.equal(d.blocks.find(b=>b.id==='latency-report')?.provenance,'source-derived');
 assert.equal(publicDocument(d).views.length,d.views.length,'every view is reachable from the root');
 // A repository without a card reaches public output only when its author marked it public.
 const unmarked={...d,atlas:{...d.atlas!,snapshots:d.atlas!.snapshots.map(s=>({...s,repositories:s.repositories.map(r=>({...r,visibility:undefined}))}))}};
 assert.deepEqual(publicDocument(unmarked).atlas,undefined);
});
