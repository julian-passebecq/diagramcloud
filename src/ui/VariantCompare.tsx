import {useMemo,type CSSProperties,type KeyboardEvent} from 'react';
import type {Project} from '../core/model';
import {buildScene} from '../export/scene';
import {AXIS_LABEL,DELTA_AXES,UNKNOWN_OBSERVATION,type DeltaAxis,type ViewDelta} from '../export/design/delta';

type Props={baseline:Project;candidate:Project;delta:ViewDelta;selectedId:string|null;onSelect:(id:string|null)=>void;baselineLabel?:string;candidateLabel?:string};
type Side='before'|'after';
const STATUS_TEXT:Record<string,string>={unchanged:'unchanged',added:'added',removed:'removed',changed:'changed',moved:'moved','changed moved':'changed and moved',rewired:'rewired','changed rewired':'changed and rewired'};
const grid:CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8};
const pane:CSSProperties={border:'1px solid var(--border)',borderRadius:8,background:'var(--soft)',padding:6,minWidth:0};
const activate=(e:KeyboardEvent,f:()=>void)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f();}};

/**
 * Linked baseline / candidate comparison of one view. Both sides are drawn from the export scene of their own document
 * (the same geometry as every export), selection is linked by exact stable ID, and an object that exists on one side
 * only is shown as absent on the other, never matched to a similar name. The object list below is the keyboard and
 * screen-reader alternative to the two pictures. Selecting compares only; it applies nothing.
 */
export function VariantCompare({baseline,candidate,delta,selectedId,onSelect,baselineLabel='Baseline',candidateLabel='Candidate'}:Props){
 const sides=useMemo(()=>{const one=(doc:Project,side:Side)=>{const view=doc.views.find(v=>v.id===delta.viewId);return view?{side,scene:buildScene(doc,view),spec:side==='before'?delta.before:delta.after}:null;};
  return [one(baseline,'before'),one(candidate,'after')];},[baseline,candidate,delta]);
 const objects=useMemo(()=>{const rows:{id:string;kind:'component'|'relationship';label:string;status:string;before:boolean;after:boolean;axes:Set<DeltaAxis>}[]=[];
  const axes=(id:string)=>new Set(delta.entries.filter(e=>e.id===id).map(e=>e.axis));
  const bn=new Map(delta.before.nodes.map(n=>[n.id,n])),an=new Map(delta.after.nodes.map(n=>[n.id,n])),be=new Map(delta.before.edges.map(e=>[e.id,e])),ae=new Map(delta.after.edges.map(e=>[e.id,e]));
  const label=(id:string)=>an.get(id)?.label??bn.get(id)?.label??id;
  for(const [id,status] of delta.components)rows.push({id,kind:'component',label:label(id),status,before:bn.has(id),after:an.has(id),axes:axes(id)});
  for(const [id,status] of delta.relationships){const e=ae.get(id)??be.get(id)!;rows.push({id,kind:'relationship',label:`${label(e.from)} → ${label(e.to)}${e.label?` (${e.label})`:''}`,status,before:be.has(id),after:ae.has(id),axes:axes(id)});}
  return rows;},[delta]);
 const chosen=objects.find(o=>o.id===selectedId);
 const pick=(id:string)=>onSelect(selectedId===id?null:id);
 return <section aria-label="Linked comparison" className="note-card" data-testid="variant-compare">
  <h3>Baseline and candidate, side by side</h3>
  <p className="micro">Select a component in either picture or in the list: the same stable ID is highlighted on both sides. Selecting compares only.</p>
  <div style={grid}>{sides.map((s,i)=>{const title=i===0?baselineLabel:candidateLabel;
   if(!s)return <div key={i} style={pane} role="group" aria-label={title}><p className="micro">{title}: view {delta.viewId} is not present.</p></div>;
   const {scene,side}=s,b=scene.bounds,names=new Map(s.spec.nodes.map(n=>[n.id,n.label])),absent=chosen&&!(side==='before'?chosen.before:chosen.after);
   return <div key={side} style={pane} role="group" aria-label={title} data-side={side}>
    <div className="eyebrow">{title.toUpperCase()} · revision {s.spec.projectRevision}</div>
    <svg viewBox={`${b.x-10} ${b.y-10} ${b.width+20} ${b.height+20}`} width="100%" style={{display:'block',maxHeight:260}} role="img" aria-label={`${title}: ${scene.nodes.length} component(s), ${scene.edges.length} connection(s)`}>
     {scene.edges.map(e=>{const st=delta.relationships.get(e.id)??'unchanged',on=e.id===selectedId;
      return <polyline key={e.id} data-object-id={e.id} data-status={st} points={e.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={on?'#0f6cbd':st==='unchanged'?'var(--muted)':'currentColor'} strokeWidth={on?6:st==='unchanged'?2:3} strokeDasharray={st==='removed'?'10 8':undefined} style={{cursor:'pointer'}} onClick={()=>pick(e.id)}/>;})}
     {scene.nodes.map(n=>{const st=delta.components.get(n.id)??'unchanged',on=n.id===selectedId,label=names.get(n.id)??n.id;
      return <g key={n.id} role="button" tabIndex={0} aria-pressed={on} aria-label={`${title}: ${label}, ${STATUS_TEXT[st]??st}`} data-object-id={n.id} data-status={st} style={{cursor:'pointer'}} onClick={()=>pick(n.id)} onKeyDown={e=>activate(e,()=>pick(n.id))}>
       <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill="var(--panel)" stroke={on?'#0f6cbd':st==='unchanged'?'var(--border)':'currentColor'} strokeWidth={on?6:st==='unchanged'?2:3} strokeDasharray={st==='removed'?'10 8':undefined} opacity={st==='unchanged'&&!on?0.75:1}/>
       <text x={n.x+12} y={n.y+n.h/2+8} fontSize={22} fill="currentColor">{label.length>18?label.slice(0,17)+'…':label}</text>
       {st!=='unchanged'&&<text x={n.x+n.w-12} y={n.y+26} fontSize={20} textAnchor="end" fill="currentColor">{st==='added'?'+':st==='removed'?'−':st.includes('changed')?'Δ':'↗'}</text>}
      </g>;})}
    </svg>
    {absent&&<p className="micro" role="status" data-testid={`absent-${side}`}>{chosen!.label} is absent from the {title.toLowerCase()}.</p>}
   </div>;})}</div>
  <h4>Changes by dimension</h4>
  <div data-testid="variant-axes">{DELTA_AXES.map(axis=>{const list=delta.entries.filter(e=>e.axis===axis);
   return <div key={axis} role="group" aria-label={AXIS_LABEL[axis]} data-axis={axis}><div className="eyebrow">{AXIS_LABEL[axis].toUpperCase()} · {list.length}</div>
    {list.length?<ul>{list.map((e,i)=><li key={i}><button type="button" className="link-button" aria-pressed={e.id===selectedId} onClick={()=>pick(e.id)}>{e.change}</button> {e.text}</li>)}</ul>:<p className="micro">{axis==='evidence'?'No change in supplied evidence. Absent observations stay UNKNOWN.':'No change.'}</p>}</div>;})}</div>
  <details><summary>All objects ({objects.length})</summary>
   <table className="micro" data-testid="variant-objects"><thead><tr><th scope="col">Object</th><th scope="col">{baselineLabel}</th><th scope="col">{candidateLabel}</th><th scope="col">Change</th></tr></thead>
    <tbody>{objects.map(o=><tr key={o.id} aria-selected={o.id===selectedId}><td><button type="button" className="link-button" aria-pressed={o.id===selectedId} onClick={()=>pick(o.id)}>{o.label}</button> <span className="stable-id">{o.id}</span></td><td>{o.before?'present':'absent'}</td><td>{o.after?'present':'absent'}</td><td>{STATUS_TEXT[o.status]??o.status}{o.axes.size?` · ${[...o.axes].join(', ')}`:''}</td></tr>)}</tbody></table>
  </details>
  {chosen&&<div role="region" aria-label="Selected object" data-testid="variant-selected">
   <p className="micro"><strong>{chosen.label}</strong> <span className="stable-id">{chosen.id}</span> · {baselineLabel.toLowerCase()} {chosen.before?'present':'absent'} · {candidateLabel.toLowerCase()} {chosen.after?'present':'absent'} · {STATUS_TEXT[chosen.status]??chosen.status}</p>
   {chosen.kind==='component'&&(()=>{const ev=delta.evidence.get(chosen.id);if(!ev)return null;const say=(s:string,claim?:string)=>s==='observed'?`observed: “${claim}”`:s==='unknown'?'UNKNOWN (no observation)':'absent';
    return <p className="micro" data-testid="variant-evidence">Evidence · {baselineLabel.toLowerCase()} {say(ev.before,ev.beforeClaim)} · {candidateLabel.toLowerCase()} {say(ev.after,ev.afterClaim)}.{ev.after==='unknown'?` ${UNKNOWN_OBSERVATION}`:''}</p>;})()}
   <button type="button" className="link-button" onClick={()=>onSelect(null)}>Clear selection</button>
  </div>}
 </section>;
}
