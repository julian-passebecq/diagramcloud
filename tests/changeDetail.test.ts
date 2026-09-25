import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone,validateDocument} from '../src/core/model';
import {describeChanges,describePackChanges,fieldChanges} from '../src/core/changeDetail';

const total=samples.find(s=>s.id==='total-project-controls')!;
const line=(c:{kind:string;group:string;id:string;fields:{field:string;before:string;after:string}[]})=>`${c.kind} ${c.group}/${c.id}: ${c.fields.map(f=>`${f.field} ${f.before}→${f.after}`).join('; ')}`;

test('no change, no entries',()=>{
 assert.deepEqual(describeChanges(total,clone(total)),{changes:[],cautions:[]});
});

test('a label edit is a change on the same ID, with before and after, not a delete and add',()=>{
 const d=clone(total),n=d.nodes.find(x=>x.id==='checks')!;n.label='Reviewed SQL checks';n.tags=[...n.tags,'ai'];
 d.views[0].positions[d.views[0].nodeIds[0]]={x:5,y:5};d.title='Project controls (reviewed)';
 const r=describeChanges(total,validateDocument(d));
 assert.deepEqual(r.changes.map(line),[
  'changed project/total-project-controls: title “TotalEnergies”→“Project controls (reviewed)”',
  'changed nodes/checks: label “SQL quality checks”→“Reviewed SQL checks”; tags →+ ai',
  `changed views/${d.views[0].id}: positions →1 moved`]);
 assert.equal(r.changes[1].name,'SQL quality checks → Reviewed SQL checks');
 assert.deepEqual(r.cautions,[]);
});

test('risky edits are called out: publishing, relabelling synthetic data, replaced IDs, dropped sources',()=>{
 const d=clone(total);
 const block=d.blocks.find(b=>b.provenance==='synthetic')!;block.provenance='source-derived';
 const hidden=d.views.find(v=>v.id!==d.rootViewId)!;
 const base=clone(total);base.views.find(v=>v.id===hidden.id)!.visibility='private';
 const business=d.nodes.find(n=>n.id==='business')!;d.nodes.push({...business,id:'business-v2'});d.nodes=d.nodes.filter(n=>n.id!=='business');
 const dropped=d.sources[0];d.sources=d.sources.slice(1);
 const r=describeChanges(base,d);
 assert(r.cautions.includes(`Makes view “${hidden.title}” public.`));
 assert(r.cautions.includes(`Relabels evidence block “${block.title}” from synthetic to source-derived. Only do this when a real source backs it.`));
 assert(r.cautions.includes('Component “Business inputs” is removed as business and re-added as business-v2. Keep the stable ID and edit the label instead.'));
 assert(r.cautions.includes(`Removes source “${dropped.title}”.`));
});

test('evidence workspace packs: approvals, provenance, placements and unsourced claims',()=>{
 const pack=clone(total.experience!),next=clone(pack);
 const draft=pack.items.find(i=>i.approval==='approved')!;draft.approval='draft';
 const kpi=next.items.find(i=>i.id===draft.id)!;kpi.approval='approved';
 const synthetic=next.items.find(i=>i.provenance==='synthetic')!;synthetic.provenance='source-derived';
 const w=next.workspaces[0];w.placements=w.placements.slice(1);
 next.items.push({...next.items.find(i=>i.type==='note')!,id:'ai-note',title:'AI summary',provenance:'source-derived',sourceIds:[]});
 const r=describePackChanges(pack,next);
 assert(r.cautions.includes(`Approves panel “${kpi.title}” for public export.`));
 assert(r.cautions.includes(`Relabels panel “${synthetic.title}” from synthetic to source-derived. Only do this when a real source backs it.`));
 assert(r.cautions.includes('New panel “AI summary” is labelled source-derived but cites no source.'));
 assert.equal(r.changes.find(c=>c.group==='workspaces')!.fields.find(f=>f.field==='placements')!.after,'−1');
 assert(r.changes.some(c=>c.kind==='added'&&c.id==='ai-note'));
 const tile=clone(pack),k=tile.items.find(i=>i.type==='kpi')!;if(k.type==='kpi')k.value='9,999';
 assert(describePackChanges(pack,tile).cautions.some(c=>c.startsWith(`Changes the figure on panel “${k.title}” from `)&&c.endsWith(' to 9,999. Check it against the source; a portfolio figure is not a verified result.')));
});

test('mass removal is flagged, and field rendering stays short and plain',()=>{
 const d=clone(total);d.nodes=d.nodes.slice(0,2);
 assert(describeChanges(total,d).cautions.some(c=>/^Removes \d+ of \d+ components\.$/.test(c)));
 const f=fieldChanges({text:'a'.repeat(300),rows:[[1]],data:'data:image/png;base64,AAAA'},{text:'b'.repeat(300),rows:[[1],[2]],data:'data:image/png;base64,BBBB'});
 assert.equal(f.find(x=>x.field==='text')!.after.length,92,'clipped to 90 characters plus quotes');
 assert.deepEqual(f.find(x=>x.field==='rows'),{field:'rows',before:'1 entry',after:'2 entries'});
 assert.deepEqual(f.find(x=>x.field==='data'),{field:'data',before:'previous image',after:'replaced image'});
});
