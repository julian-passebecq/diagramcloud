import {useEffect,useMemo,useReducer,useRef,useState,type KeyboardEvent} from 'react';
import type {LearningEntry} from '../intelligence/learning/catalogue';
import {depthFigureDocument,depthHighlight,depthLabel,depthScene,depthSceneViewSpec,explore,lessonDiagrams,DEPTH_NOTE,ZOOM_LIMITS,type DepthNode,type SemanticDepth} from '../intelligence/learning/depth';
import {LessonDiagramFigure} from './LessonDiagramFigure';
import {backTarget,drillTarget,figureInteraction,selectedIn,FIGURE_INITIAL} from '../intelligence/learning/figureInteraction';
import {playbackFrame,procedurePlayback,PLAYBACK_LABEL,type PlaybackSource,type PlaybackStep} from '../intelligence/learning/playback';
/** Previous / next over declared steps. Teaching only: it reads the declaration, highlights one step, runs and records nothing. */
export function StepPlayback({source,onStep}:{source:PlaybackSource;onStep?:(step:PlaybackStep)=>void}){
 const [index,setIndex]=useState(0),frame=playbackFrame(source,index);
 useEffect(()=>{onStep?.(frame.step);},[frame.step.id]);// eslint-disable-line react-hooks/exhaustive-deps
 const go=(to:number)=>setIndex(playbackFrame(source,to).index);
 const keys=(e:KeyboardEvent)=>{const to={ArrowRight:frame.index+1,ArrowDown:frame.index+1,ArrowLeft:frame.index-1,ArrowUp:frame.index-1,Home:0,End:source.steps.length-1}[e.key];if(to!==undefined&&e.target===e.currentTarget){e.preventDefault();go(to);}};
 return <section aria-label={'Step playback: '+source.title} tabIndex={0} onKeyDown={keys} style={{minWidth:0}}>
  <h6>{source.title}</h6>
  <p role="note"><strong>{PLAYBACK_LABEL}</strong>. {source.origin} Playing a step executes nothing and records no observation, attempt or run.</p>
  <ol aria-label="Declared steps">{source.steps.map((step,i)=><li key={step.id} aria-current={i===frame.index?'step':undefined} style={i===frame.index?{fontWeight:600,outline:'2px solid var(--accent, #2563eb)',outlineOffset:2}:undefined}>{step.label}</li>)}</ol>
  <button type="button" disabled={frame.atStart} onClick={()=>go(frame.index-1)}>Previous step</button>{' '}<button type="button" disabled={frame.atEnd} onClick={()=>go(frame.index+1)}>Next step</button>
  <p role="status" aria-label="Playback position">{frame.position}: {frame.step.label}</p>
  <p className="micro">Focus this panel and use the arrow keys, Home or End.</p>
 </section>;
}
/** The lesson's diagram at the lesson's depth. Depth comes from the lesson; zoom and environment are separate controls. */
export function LessonDiagram({entry,depth}:{entry:LearningEntry;depth:SemanticDepth}){
 const diagrams=useMemo(()=>lessonDiagrams(entry),[entry]);
 const [chosen,setChosen]=useState(diagrams[0]?.id),[state,dispatch]=useReducer(explore,{depth,zoom:1,environmentId:null,perspective:null}),[highlight,setHighlight]=useState<string|null>(null);
 const [figureState,figure$]=useReducer(figureInteraction,FIGURE_INITIAL),[focusTo,setFocusTo]=useState<string|null>(null),root=useRef<HTMLElement>(null);
 useEffect(()=>{dispatch({type:'depth',depth});figure$({type:'reset'});},[depth]);
 // Move focus to the control that replaces the one just pressed (Open inside disappears once its view is open).
 useEffect(()=>{if(!focusTo)return;const el=root.current?.querySelector<HTMLElement>(focusTo);if(el){el.focus();setFocusTo(null);}});
 const diagram=diagrams.find(d=>d.id===chosen)??diagrams[0],doc=useMemo(()=>diagram?.load(),[diagram]);
 const scene=useMemo(()=>doc?depthScene(doc,doc.rootViewId,state.depth,{audience:diagram.audience}):null,[doc,diagram,state.depth]);
 const source=useMemo(()=>doc&&diagram?depthFigureDocument(doc,diagram.audience):null,[doc,diagram]);
 const figure=useMemo(()=>scene&&source?depthSceneViewSpec(scene,source):null,[scene,source]);
 const procedures=useMemo(()=>doc&&scene?scene.views.flatMap(v=>{const p=procedurePlayback(doc,v.viewId,{audience:diagram.audience});return p?[p]:[];}):[],[doc,scene,diagram]);
 if(!diagram||!doc||!scene||!source||!figure)return null;
 const environments=source.delivery?.environments??[],environment=environments.find(e=>e.id===state.environmentId);
 const lit=depthHighlight(scene,highlight),litEdges=new Set(lit.edgeIds);
 const instances=new Set((source.delivery?.instances??[]).filter(i=>i.environmentId===state.environmentId).map(i=>i.nodeId));
 const viewTitle=(id:string)=>scene.views.find(v=>v.viewId===id)?.title??id;
 const selected=selectedIn(scene,figureState),selectedNode=scene.nodes.find(n=>n.id===selected),opens=drillTarget(scene,selected),back=backTarget(figureState);
 const select=(id:string)=>figure$({type:'select',nodeId:selected===id?null:id});
 const openInside=()=>{if(!opens||!selected)return;figure$({type:'drill',nodeId:selected,from:state.depth});dispatch({type:'depth',depth:opens.depth});setFocusTo('[data-figure-back]');};
 const goBack=()=>{if(!back)return;figure$({type:'back'});dispatch({type:'depth',depth:back.from});setFocusTo(`[data-figure-hit="${CSS.escape(back.nodeId)}"]`);};
 const facts=(n:DepthNode)=><>
   <span className="micro">{n.kind}</span>{instances.has(n.id)&&environment&&<span className="micro"> · declared instance in {environment.label}</span>}
   {n.summary!==undefined&&<p className="micro">{n.summary}{n.evidence?.length?' Evidence: '+n.evidence.join('; ')+'.':' No public evidence block.'}</p>}</>;
 const card=(n:DepthNode)=>{const inside=scene.nodes.filter(c=>c.container===n.id),collapsed=scene.collapsed.find(c=>c.nodeId===n.id);
  return <li key={n.id} data-node-id={n.id} data-selected={selected===n.id?'true':undefined} aria-current={highlight===n.id?'step':undefined} style={{border:'1px solid var(--line, #cbd5e1)',borderRadius:6,padding:'4px 8px',margin:'4px 0',listStyle:'none',...(selected===n.id?{borderColor:'var(--accent, #2563eb)',borderStyle:'dashed',borderWidth:2}:{}),...(highlight===n.id?{outline:'3px solid var(--accent, #2563eb)'}:{})}}>
   <strong>{n.label}</strong> {facts(n)} <button type="button" aria-pressed={selected===n.id} aria-label={'Select '+n.label+' in the figure'} onClick={()=>select(n.id)} className="micro">{selected===n.id?'Selected':'Select'}</button>
   {inside.length>0&&<ul aria-label={'Inside '+n.label+' ('+viewTitle(inside[0].viewId)+')'} style={{paddingLeft:16}}>{inside.map(card)}</ul>}
   {collapsed&&<p className="micro">Opens {collapsed.title}: shown at a deeper depth.</p>}
  </li>;};
 const label=depthLabel(state.depth);
 return <section ref={root} aria-label="Lesson diagram" style={{minWidth:0}}><h5>Lesson diagram</h5>
  {diagrams.length>1&&<label className="lesson-diagram-source">Diagram <select aria-label="Lesson diagram source" value={diagram.id} onChange={e=>{setChosen(e.target.value);setHighlight(null);figure$({type:'select',nodeId:null});figure$({type:'reset'});dispatch({type:'depth',depth});}}>{diagrams.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>}
  <p className="micro">{diagram.title} · {diagram.kind==='journey'?'adoption journey':'synthetic lesson example'}. {diagram.why} Declarations only: no deployment, observed execution or owner project.</p>
  <div role="toolbar" aria-label="Lesson diagram camera">
   <button type="button" disabled={state.zoom<=ZOOM_LIMITS.min} onClick={()=>dispatch({type:'zoom',zoom:state.zoom-ZOOM_LIMITS.step})}>Zoom out</button>{' '}
   <button type="button" disabled={state.zoom>=ZOOM_LIMITS.max} onClick={()=>dispatch({type:'zoom',zoom:state.zoom+ZOOM_LIMITS.step})}>Zoom in</button>{' '}
   <button type="button" onClick={()=>dispatch({type:'zoom',zoom:1})}>Reset zoom</button>
   {environments.length>0&&<>{' '}<label>Environment <select aria-label="Lesson diagram environment" value={state.environmentId??''} onChange={e=>dispatch({type:'environment',environmentId:e.target.value||null})}><option value="">All (no environment chosen)</option>{environments.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label></>}
  </div>
  <p role="status" aria-label="Lesson diagram state">Depth {label} · containment level {scene.level} · {scene.nodes.length} components · camera zoom {Math.round(state.zoom*100)}% · environment {environment?environment.label+' (declared)':'not chosen'}</p>
  {back&&<p className="lesson-figure-back" role="note">Opened {label} from the figure inside {scene.nodes.find(n=>n.id===back.nodeId)?.label??back.nodeId}; the lesson explanation stays at {depthLabel(depth)}. <button type="button" data-figure-back onClick={goBack}>Back to {depthLabel(back.from)}</button></p>}
  <LessonDiagramFigure doc={source} scene={scene} figure={figure} zoom={state.zoom} highlight={lit} environment={environment} instances={instances} depthLabel={label} selected={selected} onSelect={select}/>
  <section aria-label="Selected component" className="lesson-figure-detail" data-testid="lesson-figure-detail">
   {selectedNode?<><h6>{selectedNode.label}</h6>{facts(selectedNode)}
    {scene.nodes.some(c=>c.container===selectedNode.id)&&<p className="micro">Inside ({viewTitle(scene.nodes.find(c=>c.container===selectedNode.id)!.viewId)}): {scene.nodes.filter(c=>c.container===selectedNode.id).map(c=>c.label).join(', ')}.</p>}
    {opens?<p className="micro">Opens {opens.title}. <button type="button" onClick={openInside}>Open inside {selectedNode.label}</button> <span>Shows depth {depthLabel(opens.depth)}; zoom, environment and the document stay as they are.</span></p>
     :scene.collapsed.some(c=>c.nodeId===selectedNode.id)&&<p className="micro">Opens {scene.collapsed.find(c=>c.nodeId===selectedNode.id)!.title}: beyond the two-level depth bound.</p>}
   </>:<p className="micro">Select a component in the figure (click, or Tab then Enter) or in the list to see its details here.</p>}
  </section>
  <p className="micro">Figure: each frame is a view a component opens (explicit drilldown only, never a connection); camera zoom sizes the figure only. Text alternative:</p>
  <div data-testid="lesson-diagram-list" style={{minWidth:0,overflowWrap:'anywhere'}}>
   <ul aria-label={'Components at depth '+label} style={{paddingLeft:0}}>{scene.nodes.filter(n=>!n.container).map(card)}</ul>
   {scene.edges.length>0&&<ul aria-label={'Connections at depth '+label}>{scene.edges.map(e=><li key={e.id} data-edge-id={e.id} aria-current={litEdges.has(e.id)?'true':undefined} style={litEdges.has(e.id)?{fontWeight:600}:undefined}>{scene.nodes.find(n=>n.id===e.from)?.label} → {scene.nodes.find(n=>n.id===e.to)?.label}{e.label?' ('+e.label+')':''}</li>)}</ul>}
  </div>
  <p className="micro">{DEPTH_NOTE}</p>
  {procedures.map(p=><StepPlayback key={diagram.id+p.id} source={p} onStep={step=>setHighlight(step.nodeId??null)}/>)}
 </section>;
}
