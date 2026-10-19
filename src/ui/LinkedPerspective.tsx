import {useMemo,useRef,useState,type CSSProperties} from 'react';
import {ReactFlowProvider} from '@xyflow/react';
import type {Project} from '../core/model';
import {DiagramCanvas} from './Canvas';
import {NodeEvidence} from './Evidence';
import {linkedMappings,linkedStateLine,linkedViewChoices,pickLinked,resolveLinkedSelection,setDetailPlacement,setLinkedAnchor,setLinkedView,swapLinkedSides,type DetailPlacement,type LinkedPerspective as LinkedState,type LinkedResult,type LinkedSide} from '../core/linkedPerspective';
import type {PerspectiveBinding} from '../core/workbenchPerspective';
import {defaultLinkedLayout,readLinkedLayoutPreference,writeLinkedLayoutPreference,LINKED_LAYOUT_SPLIT,type StudioLayoutPreferenceStorage} from '../core/studioLayout';
import './linkedPerspective.css';

type Props={
 /** The permitted projection (publicDocument for a public audience). */
 doc:Project;state:LinkedState;binding:PerspectiveBinding;compact:boolean;motion:boolean;hostId:string;
 storage:()=>StudioLayoutPreferenceStorage|null;
 /** Every change of the linked state; the host decides which ones are route entries (views, anchor). */
 onChange:(next:LinkedState)=>void;onBackToQuestion:()=>void;onMessage:(message:string)=>void;
};
type CompactPane='left'|'right'|'detail';
const noop=()=>{};
const cssId=(id:string)=>id.replace(/["\\]/g,'\\$&');

/**
 * Two permitted views of one project cut, side by side (V3 workspace, linked mode). Two DiagramCanvas instances, each
 * in its own React Flow store, so each camera is independent. Selection is controlled here: exact stable ID, or an
 * authored mapping row that is shown as related and never as the same object. One detail slot, movable below both
 * views or below the right view; nothing here creates a revision.
 */
export function LinkedPerspective({doc,state,binding,compact,motion,hostId,storage,onChange,onBackToQuestion,onMessage}:Props){
 const [chosen,setChosen]=useState<{key:string;id:string}|null>(null);
 const [secondOpen,setSecondOpen]=useState(true);
 const [pane,setPane]=useState<CompactPane>('left');
 const [split,setSplit]=useState(defaultLinkedLayout().splitPercent);
 const [layoutNotice,setLayoutNotice]=useState('');
 const panes={left:useRef<HTMLElement>(null),right:useRef<HTMLElement>(null)};
 const views=useMemo(()=>linkedViewChoices(doc),[doc]);
 const leftView=doc.views.find(v=>v.id===state.leftViewId),rightView=doc.views.find(v=>v.id===state.rightViewId);
 const leftIds=leftView?.nodeIds??[],rightIds=rightView?.nodeIds??[];
 const selection=useMemo(()=>resolveLinkedSelection(state,doc,leftIds,rightIds),[state,doc,leftIds,rightIds]);
 const mappings=useMemo(()=>linkedMappings(state,doc),[state,doc]);
 const label=(id:string)=>doc.nodes.find(n=>n.id===id)?.label??id;
 const pickKey=state.pick?JSON.stringify([state.pick.side,state.pick.id,state.leftViewId,state.rightViewId]):'';
 const chosenTarget=chosen&&chosen.key===pickKey&&selection.targets.includes(chosen.id)?chosen.id:null;
 const counterpart=selection.state==='EXACT'||selection.state==='RELATED'?selection.targets[0]:selection.state==='CHOICE'?chosenTarget:null;
 const selectedOn=(side:LinkedSide)=>!state.pick?null:state.pick.side===side?state.pick.id:counterpart;
 const related=(side:LinkedSide)=>selection.side&&selection.side!==side&&(selection.state==='RELATED'||selection.state==='CHOICE')?selection.targets:[];
 const placement:DetailPlacement=secondOpen?state.detailPlacement:'below-both';
 const apply=(out:LinkedResult)=>{if(out.ok)onChange(out.state);else onMessage(out.reason);};
 const pick=(side:LinkedSide,id:string)=>{setChosen(null);apply(pickLinked(state,doc,binding,side,id));};
 const choose=(side:LinkedSide,id:string)=>{setChosen({key:pickKey,id});
  window.setTimeout(()=>{panes[side].current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${cssId(id)}"] button.node-button`)?.focus();},0);};
 const showPane=(next:CompactPane)=>setPane(next);
 const save=()=>{const ok=writeLinkedLayoutPreference(storage(),doc.id,hostId,{detailPlacement:state.detailPlacement,splitPercent:split});setLayoutNotice(ok?'Linked layout saved for this project in this browser.':'The linked layout could not be saved here; it applies for this session only.');};
 const load=()=>{const read=readLinkedLayoutPreference(storage(),doc.id,hostId);
  if(read.status==='saved'){setSplit(read.layout.splitPercent);onChange(setDetailPlacement(state,read.layout.detailPlacement));setLayoutNotice('Saved linked layout loaded.');}
  else setLayoutNotice(read.status==='missing'?'No saved linked layout for this project.':read.status==='corrupt'?'The saved linked layout is unreadable. It was left untouched; the current layout stays.':'Saved layouts cannot be read here. The current layout stays.');};
 const anchor=state.anchorNodeId?doc.nodes.find(n=>n.id===state.anchorNodeId):undefined;
 const highlight=(['left','right'] as LinkedSide[]).flatMap(side=>related(side).map(id=>`.linked-perspective .linked-pane[data-side="${side}"] .react-flow__node[data-id="${cssId(id)}"] .component-node{outline:2px dashed var(--blue,#2c62c5);outline-offset:4px}`)).join('\n');
 const picked=state.pick?doc.nodes.find(n=>n.id===state.pick!.id):undefined;
 const viewSelect=(side:LinkedSide)=><label>{side==='left'?'Left view':'Right view'}<select aria-label={side==='left'?'Left view':'Right view'} value={side==='left'?state.leftViewId:state.rightViewId} onChange={e=>{setChosen(null);apply(setLinkedView(state,doc,binding,side,e.target.value));}}>{views.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>;
 const paneFor=(side:LinkedSide)=>{const view=side==='left'?leftView:rightView,line=linkedStateLine(selection,side),targets=related(side);
  if(!view)return null;
  return <section ref={panes[side]} key={side} className="linked-pane" data-side={side} aria-label={`${side==='left'?'Left':'Right'} view: ${view.title}`} data-related={targets.length}>
   <div className="linked-state" role="status" aria-label={`${side==='left'?'Left':'Right'} view state`} data-state={line.code}><strong>{line.text}</strong>
    {(line.code==='related'||line.code==='choice')&&<p>Related, not the same object. Dashed outlines mark authored mappings.</p>}
    {line.code==='choice'&&<ul className="linked-targets" aria-label={`Related objects in the ${side} view`}>{targets.map(id=><li key={id}><button type="button" data-mapping-target={id} aria-pressed={chosenTarget===id} onClick={()=>choose(side,id)}>{label(id)}</button></li>)}</ul>}
   </div>
   <ReactFlowProvider key={view.id}><DiagramCanvas doc={doc} view={view} level={0} canvasId={`dc-linked-${side}`} strictControlledSelection genericIcons={false} selected={selectedOn(side)} selectedEdge={null} edit={false} motion={motion} trace="none" highlights={[]} onSelect={id=>pick(side,id)} onEdge={noop} onMove={noop} onConnect={noop} onGrid={noop} onAdd={noop}/></ReactFlowProvider>
  </section>;};
 const detail=<section key="detail" className="linked-detail" aria-label="Linked detail" data-placement={placement}>
  <h3>{picked?picked.label:'Detail'}</h3>
  {!picked&&<p className="micro">Select a component in either view. Exact identity and authored relations stay distinct; nothing is matched by label.</p>}
  {picked&&<div className="toolbar">{state.anchorNodeId!==picked.id&&<button type="button" onClick={()=>apply(setLinkedAnchor(state,doc,binding,picked.id))}>Use as business question</button>}</div>}
  {selection.mappings.length>0&&<div className="linked-mappings"><h4>Authored relationships for this selection</h4>
   <table><thead><tr><th scope="col">From</th><th scope="col">Relation</th><th scope="col">To</th><th scope="col">Basis</th><th scope="col">Scope</th><th scope="col">Grain</th><th scope="col">Unit rule</th><th scope="col">Meaning / limit</th></tr></thead>
    <tbody>{selection.mappings.map(m=><tr key={m.id} data-mapping-id={m.id}><td>{label(m.fromId)}</td><td>{m.relation}</td><td>{m.toId?label(m.toId):'Unknown'}</td><td>{m.state}</td><td>{m.scope}</td><td>{`${m.inputGrain} → ${m.outputGrain}`}</td><td>{m.unitRule}</td><td>{m.meaning}</td></tr>)}</tbody></table></div>}
  {selection.gaps.length>0&&<div className="linked-gaps" role="note" aria-label="Mapping gaps"><h4>Gaps</h4>{selection.gaps.map(g=><p key={g.id} data-gap-id={g.id}><strong>{`Gap: ${g.relation} (unresolved).`}</strong>{` ${g.meaning} No counterpart is inferred.`}</p>)}</div>}
  {state.mode==='mapped'&&mappings.length===0&&<p className="micro">No mapping table is readable in this permitted copy; only exact identity links the views.</p>}
  {picked&&<NodeEvidence doc={doc} node={picked}/>}
 </section>;
 const style={'--linked-split':`${split}%`} as CSSProperties;
 return <div className="linked-perspective" data-testid="linked-perspective" data-placement={placement} data-second={String(secondOpen)} data-compact={String(compact)} style={style}>
  <div className="linked-toolbar" role="group" aria-label="Linked views controls">
   {viewSelect('left')}{viewSelect('right')}
   <button type="button" onClick={()=>apply(swapLinkedSides(state,binding))}>Swap sides</button>
   {!compact&&<button type="button" aria-pressed={secondOpen} onClick={()=>setSecondOpen(open=>!open)}>Second view</button>}
   <label>Detail placement<select aria-label="Detail placement" value={state.detailPlacement} onChange={e=>onChange(setDetailPlacement(state,e.target.value as DetailPlacement))}><option value="below-both">Detail below both views</option><option value="below-right">Detail below right view</option></select></label>
   {!compact&&<label>Left view width<input type="range" aria-label="Left view width (percent)" min={LINKED_LAYOUT_SPLIT.min} max={LINKED_LAYOUT_SPLIT.max} step={5} value={split} onChange={e=>setSplit(Number(e.target.value))}/></label>}
   <button type="button" onClick={save}>Save linked layout</button><button type="button" onClick={load}>Load saved linked layout</button>
  </div>
  {layoutNotice&&<p className="micro" role="status">{layoutNotice}</p>}
  {!secondOpen&&!compact&&<p className="micro">The second view is closed: the detail is shown below the view until it is reopened.</p>}
  {anchor&&<div className="linked-anchor" role="region" aria-label="Business question"><div><strong>{`Business question: ${anchor.label}`}</strong><p>{anchor.summary}</p></div><button type="button" onClick={onBackToQuestion}>Back to business question</button></div>}
  {compact&&<nav className="linked-compact-nav" aria-label="Linked panes">{(['left','right','detail'] as CompactPane[]).map(p=><button key={p} type="button" aria-pressed={pane===p} onClick={()=>showPane(p)}>{p==='left'?'Show left view':p==='right'?'Show right view':'Show detail'}</button>)}</nav>}
  <div className="linked-grid">
   {compact?(pane==='detail'?detail:paneFor(pane)):<>{paneFor('left')}{secondOpen&&paneFor('right')}{detail}</>}
  </div>
  {highlight&&<style>{highlight}</style>}
  <p className="micro linked-caption">Two perspectives of one permitted source cut, not two implementations. Each camera is independent; selection never matches labels. Session only: nothing here is written to the project.</p>
 </div>;
}
