import {useEffect,useMemo,useRef,useState} from 'react';
import './tours.css';import {ExplanationAuthoring} from './ExplanationAuthoring';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';
import {addTour,addTourStop,moveTourStop,recordStop,removeTour,removeTourStop,tourStops,updateTourStop,TOUR_LABEL,type TourSubject} from '../core/tours';
import {clearTourResume,presentAt,presentationDrift,readTourResume,resolveTourResume,returnToPresentation,stopRef,writeTourResume,type Presentation,type PresentationCut,type TourResumeAudience,type TourResumeResolution,type TourResumeStorage} from '../core/tourResume';

/**
 * The tour being presented. `cut` is the source cut (project, revision, audience) the presentation is bound to and
 * `stopRef` the stable identity of its stop; `paused` is set by Pause for a question (and by the host when the audience
 * changes). A play without a cut (restored by the host) is bound to the document it is first shown on.
 */
export type TourPlay={tourId:string;index:number;cut?:PresentationCut;stopRef?:string;paused?:boolean};
const presentationOf=(p:TourPlay|null):Presentation|undefined=>p?.cut?{tourId:p.tourId,index:p.index,...(p.stopRef?{stopRef:p.stopRef}:{}),cut:p.cut,paused:!!p.paused}:undefined;
type Props={doc:Project;edit:boolean;viewId:string;selectedNodeId:string|null;selectedEdgeId:string|null;live:()=>Project;onCommit:(next:Project)=>boolean;
 onShow:(viewId:string,subject?:TourSubject)=>void;play:TourPlay|null;onPlay:(play:TourPlay|null)=>void;
 audience:TourResumeAudience;host:string;storage:()=>TourResumeStorage|null;
 /** A choice the host could not settle (a saved context whose stop moved, is ambiguous or was removed). */
 pending?:Extract<TourResumeResolution,{state:'choose'}>|null;onPending?:(pending:null)=>void};
const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
const subjectText=(s:TourSubject)=>`${s.kind==='node'?'component':'connection'} ${s.id}`;

/**
 * Tours panel. Plays the tours of the document it is given (the public projection in public modes): each stop shows its
 * view and subjects when its anchors are current, warns when they are stale, and refuses visibly to show a missing or
 * omitted anchor. Playing and resuming never edit the project; the last position is kept in this browser only, by
 * stable stop identity. In Edit mode an author records stops from the current view and selection, and edits, moves
 * or removes a stop as one revision each (one Undo).
 *
 * Interruptible presentation: Pause for a question keeps the presentation on its stop while the presenter inspects,
 * zooms out or drills anywhere; Return and resume resolves the stop again by identity in the document the current
 * audience may read. A source or audience change since the presentation's cut never moves it: the player pauses, says
 * what changed, and the presenter chooses where to continue. Narration is not shown while paused.
 */
export function ToursPanel({doc,edit,viewId,selectedNodeId,selectedEdgeId,live,onCommit,onShow,play,onPlay,audience,host,storage,pending,onPending}:Props){
 const tours=doc.tours??[];
 const [title,setTitle]=useState(''),[narration,setNarration]=useState(''),[visibility,setVisibility]=useState<'public'|'private'>('public'),[notice,setNotice]=useState<{kind:'ok'|'refused';text:string}|null>(null);
 const [ownChoice,setOwnChoice]=useState<Extract<TourResumeResolution,{state:'choose'}>|null>(null),[draft,setDraft]=useState<{key:string;text:string}|null>(null),[resumeVersion,setResumeVersion]=useState(0);
 // Keyboard focus: a control that disappears or becomes unavailable hands focus to the next sensible place.
 const root=useRef<HTMLElement>(null),focusNext=useRef<string|null>(null),focusTo=(selector:string)=>{focusNext.current=selector;};
 // Opened by the host with a tour already playing (a restored saved context): pick up focus the host's control lost.
 useEffect(()=>{if(document.activeElement===document.body||document.activeElement===null)root.current?.querySelector<HTMLElement>('[data-focus="resume-choice"] button,[data-focus="tour-player"]')?.focus();},[]);// eslint-disable-line react-hooks/exhaustive-deps
 // When showing a stop hid this panel (a one-pane workspace switched to the view), focus goes to the workspace's visible recovery control instead of the body.
 const shown=(el:HTMLElement|null|undefined):el is HTMLElement=>!!el&&el.getClientRects().length>0;
 useEffect(()=>{const sel=focusNext.current;if(!sel)return;focusNext.current=null;for(const one of sel.split('||')){const el=root.current?.querySelector<HTMLElement>(one);if(shown(el)){el.focus();return;}}
  const active=document.activeElement as HTMLElement|null;if(!shown(root.current)&&(!active||active===document.body||!shown(active))){const recovery=document.querySelector<HTMLElement>('[data-wb-recovery]');if(shown(recovery))recovery.focus();}});
 const choice=pending??ownChoice,clearChoice=()=>{setOwnChoice(null);onPending?.(null);};
 const tour=play?tours.find(t=>t.id===play.tourId):undefined,stops=useMemo(()=>tour?tourStops(doc,tour):[],[doc,tour]),index=play&&tour?play.index:-1,stop=index>=0?stops[index]:undefined;
 const resume=useMemo(()=>readTourResume(storage(),doc.id,audience,host),[doc.id,audience,host,resumeVersion]);
 // While playing, a source change that leaves the stop in place (same identity at the same position) keeps playing and is
 // said in the player; one that moved, removed or replaced the stop, or an audience change, pauses: nothing moves silently.
 const session=presentationOf(play),drift=session&&tour?presentationDrift(doc,session,audience):undefined;
 const displaced=!!session&&!!tour&&(!tour.stops[session.index]||stopRef(tour.stops[session.index])!==session.stopRef);
 const paused=!!session&&(session.paused||(!!drift&&(drift.audienceChanged||displaced)));
 /** A play bound to `d` at its current revision (the presentation's source cut). */
 const playOf=(d:Project,tourId:string,at:number):TourPlay=>{const p=presentAt(d,tourId,at,audience);return {tourId,index:at,...(p?{cut:p.cut,...(p.stopRef?{stopRef:p.stopRef}:{})}:{})};};
 // A play restored by the host without a cut is bound to the document it is shown on now.
 useEffect(()=>{if(play&&!play.cut&&tours.some(t=>t.id===play.tourId))onPlay({...playOf(doc,play.tourId,play.index),...(play.paused?{paused:true}:{})});},[play]);// eslint-disable-line react-hooks/exhaustive-deps
 const go=(tourId:string,at:number,show=true)=>{const t=tours.find(x=>x.id===tourId);if(!t)return;const s=tourStops(doc,t)[at];if(!s)return;
  if(show&&(s.status==='current'||s.status==='stale')&&s.viewId)onShow(s.viewId,s.subjects.find(x=>x.kind==='node')??s.subjects[0]);
  const ref=stopRef(t.stops[at]);if(ref&&writeTourResume(storage(),doc.id,audience,host,tourId,{stopRef:ref,index:at,savedAt:new Date().toISOString()}))setResumeVersion(v=>v+1);
  setDraft(null);onPlay(playOf(doc,tourId,at));};
 // An edit made from this panel is the presenter's own explicit change: the presentation is rebound to it (when it had not already drifted).
 const commit=(f:(d:Project)=>Project,ok:string)=>{setNotice(null);try{if(!onCommit(f(live()))){setNotice({kind:'refused',text:'Refused: the project did not accept this revision.'});return false;}
  if(play&&!drift&&live().tours?.some(t=>t.id===play.tourId))onPlay({...playOf(live(),play.tourId,play.index),...(play.paused?{paused:true}:{})});setNotice({kind:'ok',text:ok});return true;}catch(e){setNotice({kind:'refused',text:errorMessage(e)});return false;}};
 const endPresentation=()=>{const id=play?.tourId;setDraft(null);onPlay(null);if(id)focusTo(`[data-tour-resume="${CSS.escape(id)}"]||[data-tour-play="${CSS.escape(id)}"]||[data-focus="tours-heading"]`);};
 const pause=()=>{if(!play||!session)return;setNotice(null);setDraft(null);onPlay({...play,paused:true});focusTo('[data-focus="presentation-return"]');};
 const returnTo=()=>{if(!session)return;setNotice(null);const out=returnToPresentation(doc,session,audience);
  if(out.state==='resumed'){clearChoice();go(out.tourId,out.index);setNotice({kind:'ok',text:`Returned to the presentation. ${out.message}`});focusTo('[data-focus="tour-player"]');}
  else if(out.state==='choose'){setOwnChoice(out);focusTo('[data-focus="resume-choice"] button');}
  else{setNotice({kind:'refused',text:out.message});focusTo('[data-focus="presentation-end"]');}};
 const subjects=():TourSubject[]=>selectedNodeId?[{kind:'node',id:selectedNodeId}]:selectedEdgeId?[{kind:'edge',id:selectedEdgeId}]:[];
 const resumeTour=(tourId:string)=>{const p=resume.positions[tourId];if(!p)return;setNotice(null);const out=resolveTourResume(doc,{tourId,stopRef:p.stopRef,index:p.index});
  if(out.state==='resumed'){clearChoice();go(tourId,out.index);setNotice({kind:'ok',text:out.message});}else if(out.state==='choose'){setOwnChoice(out);focusTo('[data-focus="resume-choice"] button');}else setNotice({kind:'refused',text:out.message});};
 const recorded=tour&&index>=0?tour.stops[index]:undefined,draftKey=play?`${play.tourId}\0${index}\0${recorded?.id??''}\0${recorded?.narration??''}`:'',draftText=draft?.key===draftKey?draft.text:null;
 // Recording submits its form, so the workspace guard knows the typed narration and title were used.
 const addStop=()=>{if(!tour)return;try{const stop=recordStop(live(),viewId,subjects(),narration);if(commit(d=>addTourStop(d,tour.id,stop),`Added stop ${tour.stops.length+1} to ${tour.title}.`))setNarration('');}catch(e){setNotice({kind:'refused',text:errorMessage(e)});}};
 const newTour=()=>{try{const d=live(),base='tour-'+(slug(title)||'untitled');let id=base;for(let n=2;(d.tours??[]).some(t=>t.id===id);n++)id=`${base}-${n}`;const stop=recordStop(d,viewId,subjects(),narration);
    if(commit(x=>addTour(x,{id,title:title.trim(),visibility,stop}),`Recorded tour ${title.trim()} at revision ${d.revision}.`)){setTitle('');setNarration('');onPlay(playOf(live(),id,0));focusTo('[data-focus="tour-player"]');}}catch(e){setNotice({kind:'refused',text:errorMessage(e)});}};
 const selectionText=selectedNodeId?<>, subject component {selectedNodeId}</>:selectedEdgeId?<>, subject connection {selectedEdgeId}</>:', no subject selected';
 return <section ref={root} className="inspector tours-panel" aria-label="Tours"><ExplanationAuthoring doc={doc} edit={edit} viewId={viewId} selectedNodeId={selectedNodeId} live={live} onCommit={onCommit}/>
  <div className="eyebrow">TOURS</div><h2 tabIndex={-1} data-focus="tours-heading">Guided tours</h2>
  <p className="micro">{TOUR_LABEL}. Each stop keeps its view, the stable IDs of its subjects and the content they had when recorded; a changed or missing anchor is shown as such, never repaired silently.</p>
  {tours.length===0?<p className="muted">No tour{edit?' yet':' in this copy'}.</p>:<ul className="variant-list">{tours.map(t=>{const p=resume.positions[t.id];return <li key={t.id}>
   <Button size="small" data-tour-play={t.id} appearance={play?.tourId===t.id?'primary':'secondary'} aria-pressed={play?.tourId===t.id} onClick={()=>{setNotice(null);clearChoice();go(t.id,0);}}>{`Play ${t.title}`}</Button>
   {p&&<> <Button size="small" data-tour-resume={t.id} onClick={()=>resumeTour(t.id)}>{`Resume ${t.title}`}</Button></>}<br/>
   <span className="micro">{t.stops.length} stop{t.stops.length===1?'':'s'} · recorded at revision {t.sourceRevision}{edit&&` · ${t.visibility}`}{p&&` · last seen at stop ${p.index+1} in this browser`}</span></li>;})}</ul>}
  {resume.status==='corrupt'&&<p className="revision-warning" role="alert">Saved tour positions in this browser cannot be read. They were left untouched. <Button size="small" onClick={()=>{clearTourResume(storage(),doc.id,audience,host);setResumeVersion(v=>v+1);}}>Clear tour positions</Button></p>}
  {resume.status==='unavailable'&&tours.length>0&&<p className="micro">Browser storage is unavailable here: tours play, but the last position is not kept.</p>}
  {choice&&<section className="note-card" aria-label="Resume choice" role="group" data-focus="resume-choice">
   <p className="revision-warning" role="alert" data-testid="tour-resume-choice">{choice.message}</p>
   <div className="toolbar">{choice.candidates.map(at=><Button key={at} size="small" appearance="primary" onClick={()=>{clearChoice();go(choice.tourId,at);focusTo('[data-focus="tour-player"]');}}>{`Continue at stop ${at+1}`}</Button>)}
    <Button size="small" onClick={()=>{clearChoice();go(choice.tourId,0);focusTo('[data-focus="tour-player"]');}}>Start from stop 1</Button>
    <Button size="small" appearance="subtle" onClick={()=>{const id=choice.tourId;clearChoice();focusTo(`[data-focus="presentation-return"]||[data-tour-resume="${CSS.escape(id)}"]||[data-tour-play="${CSS.escape(id)}"]`);}}>Stay here</Button></div>
  </section>}
  {play&&!tour&&<section className="note-card" aria-label="Tour player" data-testid="presentation-unavailable">
   <p className="eyebrow">{TOUR_LABEL.toUpperCase()}</p>
   <p className="revision-warning" role="alert" tabIndex={-1} data-focus="tour-player">The paused presentation is not available for this audience. Nothing from it is shown here.</p>
   <div className="toolbar"><Button size="small" data-focus="presentation-end" onClick={endPresentation}>End presentation</Button></div>
  </section>}
  {tour&&session&&paused&&<section className="note-card" aria-label="Tour player" data-testid="presentation-paused">
   <p className="eyebrow">{TOUR_LABEL.toUpperCase()}</p>
   <h3 tabIndex={-1} data-focus="tour-player">{tour.title} · paused at stop {index+1}{!drift&&` of ${stops.length}`}</h3>
   {drift?<p className="revision-warning" role="alert" data-testid="presentation-drift">{drift.message} The presentation did not move: Return and resume checks its stop again for this audience, and you choose where to continue.</p>
    :<p role="status" data-testid="presentation-pause-note">Paused for a question. Inspect, zoom out or drill freely: the presentation stays on stop {index+1} and moves only when you return.</p>}
   <p className="micro" data-testid="presentation-cut">Source cut: revision {session.cut.revision}, {session.cut.audience==='public'?'public copy':'author view'}. Narration shows again after you return.</p>
   <div className="toolbar"><Button size="small" appearance="primary" data-focus="presentation-return" onClick={returnTo}>Return and resume</Button><Button size="small" data-focus="presentation-end" onClick={endPresentation}>End presentation</Button></div>
  </section>}
  {tour&&stop&&!paused&&<section className="note-card" aria-label="Tour player">
   <p className="eyebrow">{TOUR_LABEL.toUpperCase()}</p>
   <h3 tabIndex={-1} data-focus="tour-player">{tour.title} · stop {index+1} of {stops.length}</h3>
   {stop.status!=='current'&&<p className="revision-warning" role="alert" data-testid="tour-anchor">{stop.message}</p>}
   {stop.note&&<p className="micro" data-testid="tour-omission">{stop.note}</p>}
   {stop.status==='current'&&stop.coverageNote&&<p className="revision-warning" data-testid="tour-coverage">{stop.coverageNote}</p>}
   {stop.status!=='omitted'&&stop.status!=='missing'&&stop.narration&&<p data-testid="tour-narration">{stop.narration}</p>}
   {stop.status==='current'||stop.status==='stale'?<p className="micro">View {stop.viewId}{stop.subjects.length>0&&<> · {stop.subjects.map(subjectText).join(', ')}</>}</p>:null}
   {session&&<p className="micro" data-testid="presentation-cut">Source cut: revision {session.cut.revision}.</p>}
   {drift&&<p className="micro" role="status" data-testid="presentation-drift-note">{drift.message} This stop is still in place; its anchor state says whether its own content changed.</p>}
   <div className="toolbar"><Button size="small" disabledFocusable={index<=0} onClick={()=>go(tour.id,index-1)}>Previous stop</Button><Button size="small" disabledFocusable={index>=stops.length-1} onClick={()=>go(tour.id,index+1)}>Next stop</Button><Button size="small" disabledFocusable={!session} onClick={pause}>Pause for a question</Button><Button size="small" onClick={endPresentation}>Stop tour</Button>
    {edit&&<Button size="small" onClick={()=>{if(commit(d=>removeTour(d,tour.id),`Removed tour ${tour.title}. One Undo restores it.`)){onPlay(null);focusTo('[data-focus="tours-heading"]');}}}>Remove tour</Button>}</div>
   {edit&&recorded&&!recorded.omitted&&<form className="property-form" aria-label="Edit this stop" onSubmit={e=>e.preventDefault()}>
    <h3>Edit this stop</h3>
    {draftText===null?<Button size="small" onClick={()=>setDraft({key:draftKey,text:recorded.narration})}>Edit narration</Button>:<>
     <label>Stop narration<textarea value={draftText} onChange={e=>setDraft({key:draftKey,text:e.target.value})} rows={3} maxLength={2000}/></label>
     <div className="toolbar"><Button size="small" appearance="primary" onClick={()=>{if(commit(d=>updateTourStop(d,tour.id,index,recorded,{narration:draftText}),`Saved the narration of stop ${index+1}. One Undo restores it.`))setDraft(null);}}>Save narration</Button>
      <Button size="small" onClick={()=>setDraft(null)}>Cancel</Button></div></>}
    <p className="micro">Re-record from view {viewId}{selectionText}.</p>
    <div className="toolbar"><Button size="small" onClick={()=>commit(d=>updateTourStop(d,tour.id,index,recorded,{rerecord:{viewId,subjects:subjects()}}),`Re-recorded stop ${index+1} on the current content. One Undo restores it.`)}>Re-record stop</Button>
     <Button size="small" disabledFocusable={index<=0} onClick={()=>{if(commit(d=>moveTourStop(d,tour.id,index,recorded,-1),`Moved the stop to position ${index}. One Undo restores the order.`))onPlay(playOf(live(),tour.id,index-1));}}>Move earlier</Button>
     <Button size="small" disabledFocusable={index>=stops.length-1} onClick={()=>{if(commit(d=>moveTourStop(d,tour.id,index,recorded,1),`Moved the stop to position ${index+2}. One Undo restores the order.`))onPlay(playOf(live(),tour.id,index+1));}}>Move later</Button>
     <Button size="small" disabledFocusable={stops.length<=1} onClick={()=>{if(commit(d=>removeTourStop(d,tour.id,index,recorded),`Removed stop ${index+1}. One Undo restores it.`))onPlay(playOf(live(),tour.id,Math.max(0,Math.min(index,stops.length-2))));}}>Remove stop</Button></div>
   </form>}
  </section>}
  {notice&&<p className={notice.kind==='ok'?'micro':'validation-error'} role={notice.kind==='ok'?'status':'alert'} data-testid="tour-notice">{notice.text}</p>}
  {edit&&<form className="property-form" aria-label="Record a tour stop" onSubmit={e=>{e.preventDefault();const by=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-record');if(by==='stop')addStop();else if(by==='tour')newTour();}}>
   <h3>Record a stop</h3>
   <p className="micro">From view {viewId}{selectionText}.</p>
   <label>Narration<textarea value={narration} onChange={e=>setNarration(e.target.value)} rows={3} maxLength={2000}/></label>
   {tour&&<Button type="submit" data-record="stop">{`Add stop to ${tour.title}`}</Button>}
   <label>New tour title<input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}} maxLength={160}/></label>
   <label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value as 'public'|'private')}><option value="public">Public (hidden subjects are omitted in public copies)</option><option value="private">Private</option></select></label>
   <Button disabled={!title.trim()} type="submit" data-record="tour">New tour from this stop</Button>
  </form>}
 </section>;
}
