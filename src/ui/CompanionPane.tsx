import {useMemo,useRef,useState,type KeyboardEvent} from 'react';
import type {Project} from '../core/model';
import {buildScene} from '../export/scene';
import {COMPANION_TAB_LABEL,DEFAULT_FILTERS,DISPLAY_LIMITS,RELATION_KINDS,companionConcepts,companionContent,companionPaneTabs,companionQuestions,companionRelated,coverageText,detourTarget,permittedDocument,relatedSceneView,resolveQuestion,resolveReturn,startDetour,
 type CompanionAnchor,type CompanionDetour,type CompanionFilters,type CompanionQuestion,type CompanionTab} from '../core/companionPane';
import {MAPPING_STATE_LABELS} from '../intelligence/learning/mappings';
import {QuestionAnswersPanel} from './QuestionAnswersPanel';
import type {Patch} from '../core/patch';
import {Evidence} from './Evidence';

type Props={project:Project;publicMode:boolean;editMode?:boolean;onPropose?:(patch:Patch)=>void;
 /** The ProjectContext selection: the pinned one when pinned, otherwise the followed selection. */
 anchor:{viewId?:string;nodeId?:string};pinned:boolean;
 /** The workspace context dispatcher (parent-preserving view route). */
 onOpen:(viewId:string,nodeId:string)=>void;
 /** Opens a catalogue lesson. Absent: the Concepts tab is a read-only list. */
 onLesson?:(conceptId:string)=>void};

/**
 * Optional companion pane (UX31-UX33): explanation, code/state, authored contract/questions, related context and evidence.
 * Related is drawn from relatedContext through the export scene, with a list as the keyboard alternative, explicit
 * depth / scope / direction / relation filters and a bounded-coverage line. Opening a related item is a detour:
 * the original question stays the anchor and Return brings the reader back to it. Navigation is read-only;
 * private Edit answer proposals use the host revision-guarded review path.
 */
export function CompanionPane({project,publicMode,anchor,pinned,onOpen,editMode=false,onPropose,onLesson}:Props){
 const doc=useMemo(()=>permittedDocument(project,publicMode),[project,publicMode]);
 const [filters,setFilters]=useState<CompanionFilters>(DEFAULT_FILTERS);
 const [detour,setDetour]=useState<CompanionDetour|null>(null);
 const [tab,setTab]=useState<CompanionTab>('related');
 const [question,setQuestion]=useState<CompanionQuestion|null>(null);
 const [picked,setPicked]=useState<string|null>(null);
 const listRef=useRef<HTMLUListElement>(null),paneRef=useRef<HTMLElement>(null);
 const liveDetour=detour?.projectId===doc.id?detour:null;
 // Return is checked against the current permitted document: a changed audience, a revoked view or a removed
 // component refuses it with the generic message, and the recorded labels are no longer shown.
 const returnState=useMemo(()=>liveDetour?resolveReturn(project,publicMode,liveDetour):null,[liveDetour,project,publicMode]);
 const usableDetour=returnState?.state==='available'?liveDetour:null;
 const followed:CompanionAnchor|null=anchor.viewId&&anchor.nodeId?{viewId:anchor.viewId,nodeId:anchor.nodeId}:null;
 // During a detour the original question stays the anchor, whether the context follows or is pinned.
 const current:CompanionAnchor|null=usableDetour?usableDetour.origin:followed;
 const ctx=useMemo(()=>current?companionRelated(project,publicMode,current,filters):null,[project,publicMode,current?.viewId,current?.nodeId,filters]);
 const content=useMemo(()=>current?companionContent(doc,current.nodeId):null,[doc,current?.nodeId]);
 const concepts=useMemo(()=>current&&content?companionConcepts(project,publicMode,current.nodeId):[],[project,publicMode,current?.nodeId,content]);
 const tabs=companionPaneTabs(content,concepts.length,publicMode),shownTab=tabs.includes(tab)?tab:'related';
 const askable=companionQuestions(content),chosen=resolveQuestion(content,question);
 const sameQuestion=(a:CompanionQuestion,b:CompanionQuestion|null)=>!!b&&a.kind===b.kind&&a.index===b.index&&a.text===b.text&&a.nodeId===b.nodeId;
 const scene=useMemo(()=>{if(!ctx||ctx.state!=='available')return null;const view=doc.views.find(v=>v.id===ctx.viewId);return view?buildScene(doc,relatedSceneView(ctx,view)):null;},[ctx,doc]);
 const label=(id:string)=>doc.nodes.find(n=>n.id===id)?.label??id;
 // When the move hides this pane (one pane at a time on a compact screen), keyboard focus follows to the opened
 // component instead of falling to the page body.
 const keepFocus=(a:CompanionAnchor)=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
  // The workspace frame parks focus on its layout control when a pane hides; the opened component is a better place.
  const active=document.activeElement as HTMLElement|null;if(active&&active!==document.body&&active.getClientRects().length&&!active.hasAttribute('data-wb-recovery'))return;
  document.querySelector<HTMLElement>(`[data-testid="view-${CSS.escape(a.viewId)}"] .react-flow__node[data-id="${CSS.escape(a.nodeId)}"] .node-button`)?.focus();}));
 // The detour records the project, revision and audience, and the reading state (tab, filters, chosen question).
 const open=(nodeId:string)=>{if(!ctx||!current)return;const target=detourTarget(ctx,nodeId);if(!target)return;
  setDetour(d=>startDetour(doc,current,target,d?.projectId===doc.id&&resolveReturn(project,publicMode,d).state==='available'?d:null,{audience:publicMode?'public':'author',reading:{tab:shownTab,filters,question:chosen}}));
  setPicked(null);onOpen(target.viewId,target.nodeId);keepFocus(target);};
 // A detour control is removed by the action itself. Park focus on a retained tab before the DOM update,
 // so the workspace can recover it synchronously when the compact pane becomes hidden. The later canvas
 // handoff must not be the only recovery: two animation frames leave an observable body-focus gap.
 const endDetour=(restoreTab?:CompanionTab)=>{const tabs=paneRef.current;(tabs?.querySelector<HTMLButtonElement>(restoreTab?`#companion-tab-${restoreTab}`:'[role="tab"][aria-selected="true"]')??tabs?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]'))?.focus();setDetour(null);};
 // Return restores the anchor and the reading state recorded when the detour started, or is refused (never rebound).
 const giveBack=()=>{if(!liveDetour)return;const r=resolveReturn(project,publicMode,liveDetour);if(r.state!=='available')return;
  endDetour(r.reading.tab);setTab(r.reading.tab);setFilters(r.reading.filters);setQuestion(r.reading.question);onOpen(r.anchor.viewId,r.anchor.nodeId);keepFocus(r.anchor);};
 const focusRow=(id:string)=>{setPicked(id);listRef.current?.querySelector<HTMLButtonElement>(`[data-related-id="${CSS.escape(id)}"]`)?.focus();};
 const moveTab=(e:KeyboardEvent<HTMLButtonElement>)=>{const i=tabs.indexOf(shownTab),n=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;
  if(n<0)return;e.preventDefault();setTab(tabs[n]);e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#companion-tab-${tabs[n]}`)?.focus();};
 const set=<K extends keyof CompanionFilters>(k:K,v:CompanionFilters[K])=>setFilters(f=>({...f,[k]:v}));
 const toggleKind=(k:typeof RELATION_KINDS[number])=>setFilters(f=>({...f,kinds:f.kinds.includes(k)?f.kinds.filter(x=>x!==k):RELATION_KINDS.filter(x=>x===k||f.kinds.includes(x))}));
 const mode=usableDetour?`Detour: the original question stays on ${usableDetour.origin.label}.`:pinned?'Pinned: the companion keeps the pinned component.':'Following the selection.';
 return <section ref={paneRef} className="companion-pane note-card" aria-label="Companion pane" data-testid="companion-pane">
  <h3>Companion</h3>
  <p className="micro" role="status" aria-label="Companion anchor">{current?<>About <strong>{label(current.nodeId)}</strong> · {mode}</>:'Select a component to see its explanation, code, related context and evidence.'} {publicMode?'Public projection.':'Private authoring context.'} {editMode&&!publicMode?'Answer proposals available in Questions.':'Read-only.'}</p>
  {usableDetour&&<div role="region" aria-label="Detour" className="companion-detour" data-testid="companion-detour">
   <p className="micro">You opened <strong>{usableDetour.target.label}</strong> as a detour from <strong>{usableDetour.origin.label}</strong>. The original question is kept; Return restores its {COMPANION_TAB_LABEL[usableDetour.reading.tab]} tab, filters{usableDetour.reading.question?' and selected question':''}.</p>
   <button type="button" onClick={giveBack}>Return to {usableDetour.origin.label}</button> <button type="button" className="link-button" onClick={()=>endDetour()}>End detour here</button>
  </div>}
  {liveDetour&&returnState?.state==='refused'&&<div role="region" aria-label="Detour" className="companion-detour" data-testid="companion-detour">
   <p role="status" data-testid="companion-return-refused">Return unavailable. {returnState.notice}</p>
   <button type="button" className="link-button" onClick={()=>endDetour()}>End detour here</button>
  </div>}
  {current&&<>
   <div className="pi-tabs" role="tablist" aria-label="Companion sections">{tabs.map(t=><button type="button" key={t} id={`companion-tab-${t}`} role="tab" aria-selected={shownTab===t} aria-controls="companion-panel" tabIndex={shownTab===t?0:-1} onKeyDown={moveTab} onClick={()=>setTab(t)} style={{flex:'1 1 80px'}}>{COMPANION_TAB_LABEL[t]}</button>)}</div>
   <div id="companion-panel" role="tabpanel" aria-labelledby={`companion-tab-${shownTab}`}>
    {shownTab==='explanation'&&content&&<>{content.node.summary&&<p>{content.node.summary}</p>}{content.node.role&&<p className="micro">{content.node.role}</p>}{content.explanation.map(b=><Evidence key={b.id} block={b} doc={doc}/>)}</>}
    {shownTab==='code'&&content&&<>{content.codeState.map(b=><Evidence key={b.id} block={b} doc={doc}/>)}<p className="micro">Displayed, never executed. A table is a declared state, not an observed run.</p></>}
    {(shownTab==='contract'||shownTab==='questions')&&content&&<>
     <p className="micro">Authored explanation, not an executed contract or a verified result. Missing facts remain unknown.</p>
     {content.structure?.state==='unavailable'&&<p role="status">{content.structure.notice} The original record remains in Evidence.</p>}
     {content.structure?.state==='available'&&<>
      <p className="micro">Basis: {content.structure.block.provenance} · Frozen source: {content.structure.details.sourceCut}</p>
      {shownTab==='contract'?<>
       <h4>Selected case</h4><p>{content.structure.details.caseLabel||'No case supplied.'}</p>
       <h4>Declared prerequisites</h4>{content.structure.details.prerequisites.length?<ul>{content.structure.details.prerequisites.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>No prerequisites supplied. Presentation order does not establish independence or execution order.</p>}
      </>:<>
       <h4>Question being explained</h4><p>{content.structure.details.focusQuestion}</p>
       <h4>Questions to explore</h4>{content.structure.details.questions.length?<ol>{content.structure.details.questions.map((x,i)=><li key={i}>{x}</li>)}</ol>:<p>No follow-up questions supplied.</p>}
       <fieldset className="companion-questions"><legend>Selected question</legend>
        <p className="micro">Reading state only: kept through a detour and restored by Return. Choosing a question records nothing in the project.</p>
        {askable.map(q=><label key={`${q.kind}:${q.index}`}><input type="radio" name="companion-question" checked={sameQuestion(q,chosen)} onChange={()=>setQuestion(q)}/> {q.kind==='focus'?'Focus':`Follow-up ${q.index+1}`}: {q.text}</label>)}
        <p className="micro" role="status" aria-label="Selected question">{chosen?`Selected: ${chosen.text}`:'No question selected.'}</p>
       </fieldset>

      </>}
     </>}
     {shownTab==='questions'&&!publicMode&&<QuestionAnswersPanel key={`${doc.id}:${content.node.id}`} project={doc} nodeId={content.node.id} editMode={editMode} onPropose={onPropose}/>}
     {shownTab==='contract'&&<><h4>Declared inputs and outputs</h4>{content.contract.length?content.contract.map(b=><Evidence key={b.id} block={b} doc={doc}/>):<p>No input or output evidence attached to this component.</p>}</>}
    </>}
    {shownTab==='concepts'&&content&&<CompanionConcepts concepts={concepts} onLesson={onLesson}/>}
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

/** The Concepts tab: stored mappings only. With onLesson each titled concept opens its lesson; without it the list is read-only. */
export function CompanionConcepts({concepts,onLesson}:{concepts:ReturnType<typeof companionConcepts>;onLesson?:(conceptId:string)=>void}){
 return <section aria-label="Related concepts" className="companion-concepts">
  <p className="micro">Concepts from the learning catalogue that a stored mapping links to this component. A shared name, tag or icon is never a mapping; nothing here is inferred. A mapping explains the component; it does not verify it.</p>
  <ul aria-label="Mapped concepts">{concepts.map(r=><li key={r.id} data-concept-id={r.conceptId}>
   {onLesson&&r.title?<button type="button" aria-label={'Open lesson '+r.title} onClick={()=>onLesson(r.conceptId)}>{r.title}</button>:<strong>{r.title??r.conceptId}</strong>}
   <small className="companion-concept-state">{MAPPING_STATE_LABELS[r.state]} · lesson rev {r.contentRevision}{r.currentRevision&&r.currentRevision!==r.contentRevision?' (now '+r.currentRevision+')':''}{r.reviewedBy?' · reviewed by '+r.reviewedBy:''}</small>
   {r.staleReasons.length>0&&<p className="micro">{r.staleReasons.join(' ')} Not rebound automatically.</p>}
   {r.evidence.length>0&&<p className="micro">Cites: {r.evidence.map(e=>e.title).join(', ')}</p>}
  </li>)}</ul>
  {!onLesson&&<p className="micro">Read-only list: lessons open from the Learning catalogue.</p>}
 </section>;
}
