import {useMemo,useRef,useState,type KeyboardEvent} from 'react';
import type {Project} from '../core/model';
import {buildScene} from '../export/scene';
import {COMPANION_TAB_LABEL,DEFAULT_FILTERS,DISPLAY_LIMITS,RELATION_KINDS,companionContent,companionRelated,companionTabs,coverageText,detourTarget,permittedDocument,relatedSceneView,startDetour,
 type CompanionAnchor,type CompanionDetour,type CompanionFilters,type CompanionTab} from '../core/companionPane';
import {Evidence} from './Evidence';

type Props={project:Project;publicMode:boolean;
 /** The ProjectContext selection: the pinned one when pinned, otherwise the followed selection. */
 anchor:{viewId?:string;nodeId?:string};pinned:boolean;
 /** The workspace context dispatcher (parent-preserving view route). */
 onOpen:(viewId:string,nodeId:string)=>void};

/**
 * Optional companion pane (UX31-UX33): Explanation, Code/State, Related and Evidence for one anchor component.
 * Related is drawn from relatedContext through the export scene, with a list as the keyboard alternative, explicit
 * depth / scope / direction / relation filters and a bounded-coverage line. Opening a related item is a detour:
 * the original question stays the anchor and Return brings the reader back to it. Read-only; never a revision.
 */
export function CompanionPane({project,publicMode,anchor,pinned,onOpen}:Props){
 const doc=useMemo(()=>permittedDocument(project,publicMode),[project,publicMode]);
 const [filters,setFilters]=useState<CompanionFilters>(DEFAULT_FILTERS);
 const [detour,setDetour]=useState<CompanionDetour|null>(null);
 const [tab,setTab]=useState<CompanionTab>('related');
 const [picked,setPicked]=useState<string|null>(null);
 const listRef=useRef<HTMLUListElement>(null);
 const liveDetour=detour?.projectId===doc.id?detour:null;
 const followed:CompanionAnchor|null=anchor.viewId&&anchor.nodeId?{viewId:anchor.viewId,nodeId:anchor.nodeId}:null;
 // During a detour the original question stays the anchor, whether the context follows or is pinned.
 const current:CompanionAnchor|null=liveDetour?liveDetour.origin:followed;
 const ctx=useMemo(()=>current?companionRelated(project,publicMode,current,filters):null,[project,publicMode,current?.viewId,current?.nodeId,filters]);
 const content=useMemo(()=>current?companionContent(doc,current.nodeId):null,[doc,current?.nodeId]);
 const tabs=companionTabs(content),shownTab=tabs.includes(tab)?tab:'related';
 const scene=useMemo(()=>{if(!ctx||ctx.state!=='available')return null;const view=doc.views.find(v=>v.id===ctx.viewId);return view?buildScene(doc,relatedSceneView(ctx,view)):null;},[ctx,doc]);
 const label=(id:string)=>doc.nodes.find(n=>n.id===id)?.label??id;
 // When the move hides this pane (one pane at a time on a compact screen), keyboard focus follows to the opened
 // component instead of falling to the page body.
 const keepFocus=(a:CompanionAnchor)=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
  // The workspace frame parks focus on its layout control when a pane hides; the opened component is a better place.
  const active=document.activeElement as HTMLElement|null;if(active&&active!==document.body&&active.getClientRects().length&&!active.hasAttribute('data-wb-recovery'))return;
  document.querySelector<HTMLElement>(`[data-testid="view-${CSS.escape(a.viewId)}"] .react-flow__node[data-id="${CSS.escape(a.nodeId)}"] .node-button`)?.focus();}));
 const open=(nodeId:string)=>{if(!ctx||!current)return;const target=detourTarget(ctx,nodeId);if(!target)return;setDetour(d=>startDetour(doc,current,target,d));setPicked(null);onOpen(target.viewId,target.nodeId);keepFocus(target);};
 const giveBack=()=>{if(!liveDetour)return;const o=liveDetour.origin;setDetour(null);onOpen(o.viewId,o.nodeId);keepFocus(o);};
 const focusRow=(id:string)=>{setPicked(id);listRef.current?.querySelector<HTMLButtonElement>(`[data-related-id="${CSS.escape(id)}"]`)?.focus();};
 const moveTab=(e:KeyboardEvent<HTMLButtonElement>)=>{const i=tabs.indexOf(shownTab),n=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;
  if(n<0)return;e.preventDefault();setTab(tabs[n]);e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#companion-tab-${tabs[n]}`)?.focus();};
 const set=<K extends keyof CompanionFilters>(k:K,v:CompanionFilters[K])=>setFilters(f=>({...f,[k]:v}));
 const toggleKind=(k:typeof RELATION_KINDS[number])=>setFilters(f=>({...f,kinds:f.kinds.includes(k)?f.kinds.filter(x=>x!==k):RELATION_KINDS.filter(x=>x===k||f.kinds.includes(x))}));
 const mode=liveDetour?`Detour: the original question stays on ${liveDetour.origin.label}.`:pinned?'Pinned: the companion keeps the pinned component.':'Following the selection.';
 return <section className="companion-pane note-card" aria-label="Companion pane" data-testid="companion-pane">
  <h3>Companion</h3>
  <p className="micro" role="status" aria-label="Companion anchor">{current?<>About <strong>{label(current.nodeId)}</strong> · {mode}</>:'Select a component to see its explanation, code, related context and evidence.'} {publicMode?'Public projection.':'Private authoring context.'} Read-only.</p>
  {liveDetour&&<div role="region" aria-label="Detour" className="companion-detour" data-testid="companion-detour">
   <p className="micro">You opened <strong>{liveDetour.target.label}</strong> as a detour from <strong>{liveDetour.origin.label}</strong>. The original question is kept.</p>
   <button type="button" onClick={giveBack}>Return to {liveDetour.origin.label}</button> <button type="button" className="link-button" onClick={()=>setDetour(null)}>End detour here</button>
  </div>}
  {current&&<>
   <div className="pi-tabs" role="tablist" aria-label="Companion sections">{tabs.map(t=><button type="button" key={t} id={`companion-tab-${t}`} role="tab" aria-selected={shownTab===t} aria-controls="companion-panel" tabIndex={shownTab===t?0:-1} onKeyDown={moveTab} onClick={()=>setTab(t)} style={{flex:'1 1 80px'}}>{COMPANION_TAB_LABEL[t]}</button>)}</div>
   <div id="companion-panel" role="tabpanel" aria-labelledby={`companion-tab-${shownTab}`}>
    {shownTab==='explanation'&&content&&<>{content.node.summary&&<p>{content.node.summary}</p>}{content.node.role&&<p className="micro">{content.node.role}</p>}{content.explanation.map(b=><Evidence key={b.id} block={b} doc={doc}/>)}</>}
    {shownTab==='code'&&content&&<>{content.codeState.map(b=><Evidence key={b.id} block={b} doc={doc}/>)}<p className="micro">Displayed, never executed. A table is a declared state, not an observed run.</p></>}
    {shownTab==='evidence'&&content&&<>{content.evidence.map(b=><Evidence key={b.id} block={b} doc={doc}/>)}{content.sources.length>0&&<><h4>Cited sources</h4><ul>{content.sources.map(s=><li key={s.id}>{s.title} <span className="stable-id">{s.id}</span></li>)}</ul></>}</>}
    {shownTab==='related'&&<>
     <fieldset className="companion-filters"><legend>Related-context filters</legend>
      <label>Depth <select aria-label="Depth" value={filters.depth} onChange={e=>set('depth',Number(e.target.value))}>{[0,1,2,3].map(d=><option key={d} value={d}>{d}</option>)}</select></label>
      <label>Scope <select aria-label="Scope" value={filters.scope} onChange={e=>set('scope',e.target.value as CompanionFilters['scope'])}><option value="view">This view</option><option value="project">Permitted project</option></select></label>
      <label>Direction <select aria-label="Direction" value={filters.direction} onChange={e=>set('direction',e.target.value as CompanionFilters['direction'])}><option value="both">Both</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label>
      <label>Display limit <select aria-label="Display limit" value={filters.maxNodes} onChange={e=>set('maxNodes',Number(e.target.value))}>{DISPLAY_LIMITS.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
      <div role="group" aria-label="Relation kinds">{RELATION_KINDS.map(k=><label key={k}><input type="checkbox" checked={filters.kinds.includes(k)} onChange={()=>toggleKind(k)}/> {k}</label>)}</div>
     </fieldset>
     {ctx?.state!=='available'?<p role="status" data-testid="companion-unavailable">{ctx?.notice}</p>:<>
      <p className="micro" data-testid="companion-coverage">{coverageText(ctx,filters)}</p>
      {scene&&<svg viewBox={`${scene.bounds.x-10} ${scene.bounds.y-10} ${scene.bounds.width+20} ${scene.bounds.height+20}`} width="100%" style={{display:'block',maxHeight:240}} role="img" aria-label={`Related context of ${label(ctx.nodeId)}: ${scene.nodes.length} component(s), ${scene.edges.length} connection(s). The list below is the keyboard alternative.`}>
       {scene.edges.map(e=><polyline key={e.id} points={e.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray={e.dashed?'8 6':undefined}/>)}
       {scene.nodes.map(n=><g key={n.id} data-related-node={n.id} style={{cursor:n.id===ctx.nodeId?'default':'pointer'}} onClick={()=>n.id!==ctx.nodeId&&focusRow(n.id)}>
        <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill="var(--panel)" stroke={n.id===ctx.nodeId?'#0f6cbd':n.id===picked?'currentColor':'var(--border)'} strokeWidth={n.id===ctx.nodeId||n.id===picked?5:2}/>
        <text x={n.x+12} y={n.y+n.h/2+8} fontSize={22} fill="currentColor">{label(n.id).length>18?label(n.id).slice(0,17)+'…':label(n.id)}</text>
       </g>)}
      </svg>}
      <h4>Related components</h4>
      {ctx.spec.nodes.length<=1?<p className="micro">No explicit relationship within these filters.</p>:
      <ul ref={listRef} className="companion-related" aria-label="Related components">{ctx.spec.nodes.filter(n=>n.id!==ctx.nodeId).map(n=>{const views=ctx.memberships.find(m=>m.nodeId===n.id)?.views??[];
       return <li key={n.id} aria-current={picked===n.id?'true':undefined}><button type="button" data-related-id={n.id} onFocus={()=>setPicked(n.id)} onClick={()=>open(n.id)} aria-label={`Open ${n.label} as a detour`}>{n.label}</button> <small>{n.kind} · distance {ctx.distance[n.id]} · in {views.map(v=>v.title).join(', ')||'no permitted view'}</small></li>;})}</ul>}
      <details><summary>Connections ({ctx.spec.edges.length})</summary><ul>{ctx.spec.edges.map(e=><li key={e.id}>{label(e.from)} → {label(e.to)}{e.label?` (${e.label})`:''} <small>{e.kind}</small></li>)}</ul></details>
      <p className="micro">{ctx.notice}</p>
     </>}
    </>}
   </div>
  </>}
 </section>;
}
