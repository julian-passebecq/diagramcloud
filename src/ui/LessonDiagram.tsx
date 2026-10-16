import {useEffect,useMemo,useReducer,useState,type KeyboardEvent} from 'react';
import type {LearningEntry} from '../intelligence/learning/catalogue';
import {depthLabel,depthScene,explore,lessonDiagrams,DEPTH_NOTE,ZOOM_LIMITS,type DepthNode,type SemanticDepth} from '../intelligence/learning/depth';
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
 useEffect(()=>{dispatch({type:'depth',depth});},[depth]);
 const diagram=diagrams.find(d=>d.id===chosen)??diagrams[0],doc=useMemo(()=>diagram?.load(),[diagram]);
 const scene=useMemo(()=>doc?depthScene(doc,doc.rootViewId,state.depth,{audience:diagram.audience}):null,[doc,diagram,state.depth]);
 const procedures=useMemo(()=>doc&&scene?scene.views.flatMap(v=>{const p=procedurePlayback(doc,v.viewId,{audience:diagram.audience});return p?[p]:[];}):[],[doc,scene,diagram]);
 if(!diagram||!doc||!scene)return null;
 const environments=doc.delivery?.environments??[],environment=environments.find(e=>e.id===state.environmentId);
 const instances=new Set((doc.delivery?.instances??[]).filter(i=>i.environmentId===state.environmentId).map(i=>i.nodeId));
 const viewTitle=(id:string)=>scene.views.find(v=>v.viewId===id)?.title??id;
 const card=(n:DepthNode)=>{const inside=scene.nodes.filter(c=>c.container===n.id),collapsed=scene.collapsed.find(c=>c.nodeId===n.id);
  return <li key={n.id} data-node-id={n.id} aria-current={highlight===n.id?'step':undefined} style={{border:'1px solid var(--line, #cbd5e1)',borderRadius:6,padding:'4px 8px',margin:'4px 0',listStyle:'none',...(highlight===n.id?{outline:'3px solid var(--accent, #2563eb)'}:{})}}>
   <strong>{n.label}</strong> <span className="micro">{n.kind}</span>{instances.has(n.id)&&environment&&<span className="micro"> · declared instance in {environment.label}</span>}
   {n.summary!==undefined&&<p className="micro">{n.summary}{n.evidence?.length?' Evidence: '+n.evidence.join('; ')+'.':' No public evidence block.'}</p>}
   {inside.length>0&&<ul aria-label={'Inside '+n.label+' ('+viewTitle(inside[0].viewId)+')'} style={{paddingLeft:16}}>{inside.map(card)}</ul>}
   {collapsed&&<p className="micro">Opens {collapsed.title}: shown at a deeper depth.</p>}
  </li>;};
 const label=depthLabel(state.depth);
 return <section aria-label="Lesson diagram" style={{minWidth:0}}><h5>Lesson diagram</h5>
  {diagrams.length>1&&<label>Diagram <select aria-label="Lesson diagram source" value={diagram.id} onChange={e=>{setChosen(e.target.value);setHighlight(null);}}>{diagrams.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>}
  <p className="micro">{diagram.title} · {diagram.kind==='journey'?'adoption journey':'synthetic lesson example'}. {diagram.why} Declarations only: no deployment, observed execution or owner project.</p>
  <div role="toolbar" aria-label="Lesson diagram camera">
   <button type="button" disabled={state.zoom<=ZOOM_LIMITS.min} onClick={()=>dispatch({type:'zoom',zoom:state.zoom-ZOOM_LIMITS.step})}>Zoom out</button>{' '}
   <button type="button" disabled={state.zoom>=ZOOM_LIMITS.max} onClick={()=>dispatch({type:'zoom',zoom:state.zoom+ZOOM_LIMITS.step})}>Zoom in</button>{' '}
   <button type="button" onClick={()=>dispatch({type:'zoom',zoom:1})}>Reset zoom</button>
   {environments.length>0&&<>{' '}<label>Environment <select aria-label="Lesson diagram environment" value={state.environmentId??''} onChange={e=>dispatch({type:'environment',environmentId:e.target.value||null})}><option value="">All (no environment chosen)</option>{environments.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label></>}
  </div>
  <p role="status" aria-label="Lesson diagram state">Depth {label} · containment level {scene.level} · {scene.nodes.length} components · camera zoom {Math.round(state.zoom*100)}% · environment {environment?environment.label+' (declared)':'not chosen'}</p>
  <div style={{overflow:'auto',maxWidth:'100%'}}><div data-testid="lesson-diagram-camera" style={{transform:`scale(${state.zoom})`,transformOrigin:'0 0'}}>
   <ul aria-label={'Components at depth '+label} style={{paddingLeft:0}}>{scene.nodes.filter(n=>!n.container).map(card)}</ul>
   {scene.edges.length>0&&<ul aria-label={'Connections at depth '+label}>{scene.edges.map(e=><li key={e.id}>{scene.nodes.find(n=>n.id===e.from)?.label} → {scene.nodes.find(n=>n.id===e.to)?.label}{e.label?' ('+e.label+')':''}</li>)}</ul>}
  </div></div>
  <p className="micro">{DEPTH_NOTE}</p>
  {procedures.map(p=><StepPlayback key={diagram.id+p.id} source={p} onStep={step=>setHighlight(step.nodeId??null)}/>)}
 </section>;
}
