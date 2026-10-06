import type {Project} from '../core/model';
import {perspectivesFor,PERSPECTIVE_LABEL,type PerspectiveState} from '../core/viewspec';

const STATE_LABEL:Record<PerspectiveState,string>={available:'available',partial:'partial: a related view',unknown:'unknown for this component',unsupported:'not in this project'};

/**
 * The same component (same stable ID) through other perspectives. Only what the document contains: a perspective is
 * available, partial (a drilldown or parent view), unknown (the project has it, not for this component) or unsupported.
 */
export function PerspectiveStrip({doc,nodeId,onOpen}:{doc:Project;nodeId:string;onOpen:(viewId:string)=>void}){
 const list=perspectivesFor(doc,nodeId);
 return <section className="perspective-strip" aria-label="Perspectives">
  <div className="eyebrow">PERSPECTIVES</div>
  <div className="perspective-chips">{list.map(p=>{const target=p.views[0];const label=`${PERSPECTIVE_LABEL[p.perspective]}: ${STATE_LABEL[p.state]}${p.views.length>1?` (${p.views.length} views)`:''}`;
   return target?<button key={p.perspective} type="button" className={`perspective-chip state-${p.state}`} title={`${label}. Open “${target.title}”.`} aria-label={label} onClick={()=>onOpen(target.viewId)}>{PERSPECTIVE_LABEL[p.perspective]}</button>
    :<span key={p.perspective} className={`perspective-chip state-${p.state}`} title={label} aria-label={label}>{PERSPECTIVE_LABEL[p.perspective]}</span>;})}</div>
 </section>;
}
