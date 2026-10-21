import {useMemo,useState} from 'react';
import type {Project} from '../core/model';
import {prepareReadingWayfinder,type WayfinderItem,type WayfinderPick} from '../core/readingWayfinder';
export function ReadingWayfinder({document,audience,path,activeView,onNavigate}:{document:Project;audience:'author'|'public';path:readonly string[];activeView:string;onNavigate:(pick:WayfinderPick)=>void}){
 const model=useMemo(()=>prepareReadingWayfinder(document,audience,path,activeView),[document,audience,path,activeView]);
 const [style,setStyle]=useState<'levels'|'tree'>('levels');
 const button=(x:WayfinderItem)=> <button type="button" key={JSON.stringify(x.pick.path)} aria-current={x.pick.viewId===activeView?'location':undefined} onClick={()=>onNavigate(x.pick)}>{x.label}</button>;
 return <details className="dc-wayfinder"><summary>Where am I? · {model.title} · {model.trail.at(-1)?.label??'Route unavailable'}</summary>
  <p className="dc-wayfinder-note">Reading/navigation only · {audience} · document revision {model.revision}. These levels are not delivery stages, elapsed time or completion.</p>
  {!model.available?<p role="status">This route is no longer available in the permitted source. Use the existing explorer to choose a valid route.</p>:<>
   <nav aria-label="Current reading route" className="dc-wayfinder-trail">{model.trail.map(button)}</nav>
   <label>Navigation presentation<select aria-label="Navigation presentation" value={style} onChange={e=>setStyle(e.target.value as 'levels'|'tree')}><option value="levels">Two levels</option><option value="tree">Route list</option></select></label>
   {style==='levels'?<div className="dc-wayfinder-levels"><nav aria-label="Current navigation level"><strong>Current level</strong><div>{model.level.map(button)}</div></nav><nav aria-label="Inside current level"><strong>Inside this level</strong><div>{model.children.length?model.children.map(button):<p>No child view declared here. Evidence may still contain deeper detail.</p>}</div></nav></div>:<nav aria-label="Explicit view hierarchy"><ol className="dc-wayfinder-tree">{model.tree.map(x=><li key={JSON.stringify(x.pick.path)} style={{paddingInlineStart:Math.min(x.depth,8)*12}}>{button(x)}</li>)}</ol>{model.truncated&&<p>Route list is bounded. Use focused navigation for deeper detail.</p>}</nav>}
  </>}
 </details>;
}
