import {useMemo,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {errorMessage,type Project} from '../core/model';
import {COMPARE_NOTE,PAIRING_TEXT,type ComparisonChoices,type ComparisonSource,type EnvironmentPair,type LinkedComparison} from '../core/variantDraft';
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

const ENV_STATE:Record<EnvironmentPair['left']['state'],string>={'reviewed-claim':'reviewed claim',declared:'declared','not-applicable':'not applicable',absent:'absent'};
/** Two declared environments of one project, paired by componentId. Each side reads only its own declarations and reviewed claims. */
function EnvironmentCompare({pairs,leftLabel,rightLabel,selectedId,onSelect}:{pairs:EnvironmentPair[];leftLabel:string;rightLabel:string;selectedId:string|null;onSelect:(id:string|null)=>void}){
 const chosen=pairs.find(p=>p.componentId===selectedId),pick=(id:string)=>onSelect(selectedId===id?null:id);
 const absent=(s:EnvironmentPair['left'])=>s.state==='absent';
 return <section aria-label="Environment comparison" className="note-card" data-testid="environment-compare">
  <h3>{leftLabel} and {rightLabel}, side by side</h3>
  {pairs.length===0?<p className="micro">No component has a declared instance in either environment.</p>:
  <table className="micro" data-testid="environment-pairs"><thead><tr><th scope="col">Component</th><th scope="col">{leftLabel}</th><th scope="col">{rightLabel}</th><th scope="col">Equivalence</th></tr></thead>
   <tbody>{pairs.map(p=><tr key={p.componentId} aria-selected={p.componentId===selectedId} data-component-id={p.componentId}>
    <td><button type="button" className="link-button" aria-pressed={p.componentId===selectedId} onClick={()=>pick(p.componentId)}>{p.label}</button> <span className="stable-id">{p.componentId}</span></td>
    <td data-side="left" data-state={p.left.state}>{ENV_STATE[p.left.state]}</td><td data-side="right" data-state={p.right.state}>{ENV_STATE[p.right.state]}</td>
    <td>{p.equivalence==='UNKNOWN'?'UNKNOWN without separate cited evidence':p.equivalence==='cited-same-revision'?'same revision per cited evidence':'different revisions per cited evidence'}</td></tr>)}</tbody></table>}
  <h4>Changes by dimension</h4>
  <div data-testid="variant-axes">{DELTA_AXES.map(axis=>{const list=pairs.flatMap(p=>p.axes.filter(a=>a.axis===axis).map(a=>({...a,id:p.componentId})));
   return <div key={axis} role="group" aria-label={AXIS_LABEL[axis]} data-axis={axis}><div className="eyebrow">{AXIS_LABEL[axis].toUpperCase()} · {list.length}</div>
    {axis==='layout'?<p className="micro">Environments share the project's one layout: no layout difference.</p>:list.length?<ul>{list.map((e,i)=><li key={i}><button type="button" className="link-button" aria-pressed={e.id===selectedId} onClick={()=>pick(e.id)}>{e.change}</button> {e.text}</li>)}</ul>:<p className="micro">{axis==='evidence'?'No difference in reviewed claims. A missing claim stays UNKNOWN.':'No change.'}</p>}</div>;})}</div>
  {chosen&&<div role="region" aria-label="Selected object" data-testid="variant-selected">
   <p className="micro"><strong>{chosen.label}</strong> <span className="stable-id">{chosen.componentId}</span></p>
   <p className="micro">{leftLabel}: {chosen.left.text}.</p><p className="micro">{rightLabel}: {chosen.right.text}.</p>
   {absent(chosen.left)&&<p className="micro" role="status" data-testid="absent-before">{chosen.label} is absent from {leftLabel}.</p>}
   {absent(chosen.right)&&<p className="micro" role="status" data-testid="absent-after">{chosen.label} is absent from {rightLabel}.</p>}
   <button type="button" className="link-button" onClick={()=>onSelect(null)}>Clear selection</button>
  </div>}
 </section>;
}

type LinkedProps={comparison:LinkedComparison;stale:string|null;onReturn:()=>void;onRecompare:()=>void};
/**
 * A frozen linked comparison opened from the workspace. It shows the two sides it read when it was opened; a source
 * change marks it stale and the reader compares again explicitly. Selecting a pair reads only: there is no Apply here.
 */
export function LinkedComparisonView({comparison:c,stale,onReturn,onRecompare}:LinkedProps){
 const [selected,setSelected]=useState<string|null>(null);
 return <section aria-label="Linked comparison workspace" className="linked-comparison" data-testid="linked-comparison" data-stale={stale?'true':'false'}>
  <div className="toolbar"><button type="button" className="link-button" onClick={onReturn}>Return to workspace</button></div>
  <div className="eyebrow">LINKED COMPARISON · {c.projectTitle.toUpperCase()} · OPENED ON REVISION {c.revision}</div>
  <h2>{c.title}</h2>
  <p className="micro" data-testid="comparison-pairing">{PAIRING_TEXT[c.pairing]}</p>
  <p className="micro">{COMPARE_NOTE}</p>
  {stale&&<div role="alert" className="revision-warning" data-testid="comparison-stale"><p>{stale}</p><button type="button" className="link-button" onClick={()=>{setSelected(null);onRecompare();}}>Compare again on the current source</button></div>}
  {c.view?<VariantCompare baseline={c.view.left} candidate={c.view.right} delta={c.view.delta} selectedId={selected} onSelect={setSelected} baselineLabel={c.leftLabel} candidateLabel={c.rightLabel}/>
   :<EnvironmentCompare pairs={c.environments??[]} leftLabel={c.leftLabel} rightLabel={c.rightLabel} selectedId={selected} onSelect={setSelected}/>}
 </section>;
}

type LauncherProps={choices:ComparisonChoices;onOpen:(source:ComparisonSource)=>void};
/** Where a comparison starts in the workspace: a variant, an earlier revision of this session, or two declared environments. */
export function ComparisonLauncher({choices,onOpen}:LauncherProps){
 const current=choices.variants.filter(v=>v.status==='current');
 const [variant,setVariant]=useState(''),[revision,setRevision]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[error,setError]=useState('');
 const open=(source:ComparisonSource)=>{setError('');try{onOpen(source);}catch(e){setError(errorMessage(e));}};
 const variantId=current.some(v=>v.id===variant)?variant:current[0]?.id??'',rev=choices.versions.some(v=>String(v.revision)===revision)?revision:String(choices.versions[0]?.revision??'');
 const envOk=(id:string)=>choices.environments.some(e=>e.id===id),a=envOk(from)?from:choices.environments[0]?.id??'',b=envOk(to)?to:choices.environments[1]?.id??'';
 return <section aria-label="Compare" className="v3-route" data-testid="comparison-launcher">
  <p className="micro">Open a linked comparison of existing evidence. It pairs objects by exact stable ID, shows a missing counterpart as absent and applies nothing.</p>
  <h4>Variant</h4>
  {choices.variants.length===0?<p className="micro">No variant in this project.</p>:<>
   {current.length>0&&<div className="toolbar"><label>Variant to compare<select aria-label="Variant to compare" value={variantId} onChange={e=>setVariant(e.target.value)}>{current.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label><button type="button" onClick={()=>open({kind:'variant',variantId})}>Compare variant</button></div>}
   {choices.variants.filter(v=>v.status!=='current').map(v=><p key={v.id} className="micro" data-testid="comparison-variant-refused">{v.title}: {v.message}</p>)}</>}
  <h4>Two revisions</h4>
  {choices.versions.length===0?<p className="micro">No earlier revision is held in this session.</p>:
   <div className="toolbar"><label>Earlier revision<select aria-label="Earlier revision" value={rev} onChange={e=>setRevision(e.target.value)}>{choices.versions.map(v=><option key={v.revision} value={v.revision}>{`Revision ${v.revision}`}</option>)}</select></label><button type="button" onClick={()=>open({kind:'version',revision:Number(rev)})}>Compare with the open revision</button></div>}
  <h4>Two environments</h4>
  {choices.environments.length<2?<p className="micro">Fewer than two declared environments.</p>:
   <div className="toolbar"><label>First environment<select aria-label="First environment" value={a} onChange={e=>setFrom(e.target.value)}>{choices.environments.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
    <label>Second environment<select aria-label="Second environment" value={b} onChange={e=>setTo(e.target.value)}>{choices.environments.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
    <button type="button" onClick={()=>open({kind:'environment',from:a,to:b})}>Compare environments</button></div>}
  {error&&<p className="validation-error" role="alert" data-testid="comparison-error">{error}</p>}
 </section>;
}
