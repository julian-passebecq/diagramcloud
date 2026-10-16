import {useEffect,useMemo,useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';
import {addTour,addTourStop,recordStop,removeTour,tourStops,TOUR_LABEL,type TourSubject} from '../core/tours';

type Props={doc:Project;edit:boolean;viewId:string;selectedNodeId:string|null;live:()=>Project;onCommit:(next:Project)=>boolean;onShow:(viewId:string,nodeId?:string)=>void};
const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);

/**
 * Tours panel. Plays the tours of the document it is given (the public projection in public modes): each stop shows its
 * view and subjects when its anchors are current, warns when they are stale, and refuses visibly to show a missing or
 * omitted anchor. Playing never edits the project. In Edit mode an author records stops from the current view and selection.
 */
export function ToursPanel({doc,edit,viewId,selectedNodeId,live,onCommit,onShow}:Props){
 const tours=doc.tours??[];
 const [tourId,setTourId]=useState<string|null>(null),[index,setIndex]=useState(-1),[title,setTitle]=useState(''),[narration,setNarration]=useState(''),[visibility,setVisibility]=useState<'public'|'private'>('public'),[notice,setNotice]=useState<{kind:'ok'|'refused';text:string}|null>(null);
 const tour=tours.find(t=>t.id===tourId),stops=useMemo(()=>tour?tourStops(doc,tour):[],[doc,tour]),stop=index>=0?stops[index]:undefined;
 useEffect(()=>{if(stop&&(stop.status==='current'||stop.status==='stale')&&stop.viewId)onShow(stop.viewId,stop.subjects.find(s=>s.kind==='node')?.id);},[tourId,index]);
 const commit=(f:(d:Project)=>Project,ok:string)=>{setNotice(null);try{if(!onCommit(f(live()))){setNotice({kind:'refused',text:'Refused: the project did not accept this revision.'});return false;}setNotice({kind:'ok',text:ok});return true;}catch(e){setNotice({kind:'refused',text:errorMessage(e)});return false;}};
 const subjects=():TourSubject[]=>selectedNodeId?[{kind:'node',id:selectedNodeId}]:[];
 return <section className="inspector tours-panel" aria-label="Tours">
  <div className="eyebrow">TOURS</div><h2>Guided tours</h2>
  <p className="micro">{TOUR_LABEL}. Each stop keeps its view, the stable IDs of its subjects and the content they had when recorded; a changed or missing anchor is shown as such, never repaired silently.</p>
  {tours.length===0?<p className="muted">No tour{edit?' yet':' in this copy'}.</p>:<ul className="variant-list">{tours.map(t=><li key={t.id}><Button size="small" appearance={tourId===t.id?'primary':'secondary'} aria-pressed={tourId===t.id} onClick={()=>{setNotice(null);setTourId(t.id);setIndex(0);}}>{`Play ${t.title}`}</Button><br/><span className="micro">{t.stops.length} stop{t.stops.length===1?'':'s'} · recorded at revision {t.sourceRevision}{edit&&` · ${t.visibility}`}</span></li>)}</ul>}
  {tour&&stop&&<section className="note-card" aria-label="Tour player">
   <p className="eyebrow">{TOUR_LABEL.toUpperCase()}</p>
   <h3>{tour.title} · stop {index+1} of {stops.length}</h3>
   {stop.status!=='current'&&<p className="revision-warning" role="alert" data-testid="tour-anchor">{stop.message}</p>}
   {stop.note&&<p className="micro" data-testid="tour-omission">{stop.note}</p>}
   {stop.status!=='omitted'&&stop.status!=='missing'&&stop.narration&&<p data-testid="tour-narration">{stop.narration}</p>}
   {stop.status==='current'||stop.status==='stale'?<p className="micro">View {stop.viewId}{stop.subjects.length>0&&<> · {stop.subjects.map(s=>`${s.kind==='node'?'component':'connection'} ${s.id}`).join(', ')}</>}</p>:null}
   <div className="toolbar"><Button size="small" disabled={index<=0} onClick={()=>setIndex(i=>i-1)}>Previous stop</Button><Button size="small" disabled={index>=stops.length-1} onClick={()=>setIndex(i=>i+1)}>Next stop</Button><Button size="small" onClick={()=>{setTourId(null);setIndex(-1);}}>Stop tour</Button>
    {edit&&<Button size="small" onClick={()=>{if(commit(d=>removeTour(d,tour.id),`Removed tour ${tour.title}. One Undo restores it.`)){setTourId(null);setIndex(-1);}}}>Remove tour</Button>}</div>
  </section>}
  {notice&&<p className={notice.kind==='ok'?'micro':'validation-error'} role={notice.kind==='ok'?'status':'alert'} data-testid="tour-notice">{notice.text}</p>}
  {edit&&<form className="property-form" aria-label="Record a tour stop" onSubmit={e=>e.preventDefault()}>
   <h3>Record a stop</h3>
   <p className="micro">From view {viewId}{selectedNodeId?<>, subject component {selectedNodeId}</>:', no subject selected'}.</p>
   <label>Narration<textarea value={narration} onChange={e=>setNarration(e.target.value)} rows={3} maxLength={2000}/></label>
   {tour&&<Button onClick={()=>{try{const stop=recordStop(live(),viewId,subjects(),narration);if(commit(d=>addTourStop(d,tour.id,stop),`Added stop ${tour.stops.length+1} to ${tour.title}.`))setNarration('');}catch(e){setNotice({kind:'refused',text:errorMessage(e)});}}}>{`Add stop to ${tour.title}`}</Button>}
   <label>New tour title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}/></label>
   <label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value as 'public'|'private')}><option value="public">Public (hidden subjects are omitted in public copies)</option><option value="private">Private</option></select></label>
   <Button disabled={!title.trim()} onClick={()=>{try{const d=live(),base='tour-'+(slug(title)||'untitled');let id=base;for(let n=2;(d.tours??[]).some(t=>t.id===id);n++)id=`${base}-${n}`;const stop=recordStop(d,viewId,subjects(),narration);
    if(commit(x=>addTour(x,{id,title:title.trim(),visibility,stop}),`Recorded tour ${title.trim()} at revision ${d.revision}.`)){setTitle('');setNarration('');setTourId(id);setIndex(0);}}catch(e){setNotice({kind:'refused',text:errorMessage(e)});}}}>New tour from this stop</Button>
  </form>}
 </section>;
}
