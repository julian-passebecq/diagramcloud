import {useState} from 'react';
import type {DeliveryView} from '../development/deliveryEvidence';
import {planNavigation} from '../development/planNavigation';
export function PlanPhaseStrip({view,audience,onSelect}:{view:DeliveryView;audience:'author'|'public';onSelect?:(id:string)=>void}){
 const groups=planNavigation(view,audience),[phase,setPhase]=useState<string|null>(null);
 const selected=groups.find(g=>g.id===phase)??groups[0];
 if(!selected)return null;
 return <details className="dc-wayfinder"><summary>Delivery phases and work blocks</summary><p className="dc-wayfinder-note">Labels and states come from this plan. Reading order is not schedule order; choosing a block does not start or complete it.</p>
  <nav aria-label="Supplied delivery phases">{groups.map(g=><button type="button" key={g.id} aria-pressed={g.id===selected.id} onClick={()=>setPhase(g.id)}>{g.label} · {g.blocks.length} blocks</button>)}</nav>
  <nav aria-label="Blocks in selected phase">{selected.blocks.map(b=>onSelect?<button key={b.id} type="button" onClick={()=>onSelect(b.id)}>{b.title} · {b.state}</button>:<p key={b.id}>{b.title} · {b.state}</p>)}</nav>
 </details>;
}
