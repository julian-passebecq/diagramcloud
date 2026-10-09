import type {Purpose} from '../intelligence/types';
import type {LibraryTarget} from '../core/links';
import {CrossRepositoryPanel} from './CrossRepositoryPanel';
import {DeepAnalysisPanel} from './DeepAnalysisPanel';
import {HowItWorksPanel} from './HowItWorksPanel';
import {LibraryPanel} from './LibraryPanel';
import type {GraphFilter} from '../intelligence/graphSnapshot';
import type {Project} from '../core/model';
import {overviewFacts, projectOverviewHtml} from '../export/projectOverview';
import {download} from '../export/browser';
import './project-intelligence.css';
import {GraphExplorer} from './GraphExplorer';
import {IntelligenceInsights} from './IntelligenceInsights';
import {intelligenceReportHtml} from '../export/intelligenceReport';
import {EvolutionPanel} from './EvolutionPanel';

export function ProjectOverview({project, publicMode = false, onNode, onWorkspace, onView, onDelivery, onPatch, library, onProject, graphFilter, onGraphFilter, purpose, libraryTarget}: {project: Project;purpose?:Purpose;libraryTarget?:LibraryTarget; publicMode?: boolean; onNode?: (id: string) => void; onWorkspace?: (id: string) => void;onView?:(view:string,node?:string)=>void;onDelivery?:(input:unknown)=>void;onPatch?:(input:unknown)=>void;library?:Project[];onProject?:(project:Project)=>void;graphFilter?:GraphFilter;onGraphFilter?:(filter:GraphFilter)=>void}) {
  const {project: p, components, omitted, report} = overviewFacts(project, publicMode);
  return <section className="project-overview" data-testid="project-overview"><div className="pi-heading"><div><span className="pi-eyebrow">{publicMode ? 'Public projection' : 'Private preview'} · Project Overview</span><h1>{p.title}</h1></div><button type="button" onClick={() => download(projectOverviewHtml(project), `${p.id}.overview.html`, 'text/html;charset=utf-8')}>Export public overview HTML</button></div>
    <h2>Purpose and scope</h2><p>{p.summary || 'Purpose has not been supplied.'}</p><h2>Steps and components</h2><div className="pi-overview-grid">{components.map((n,i) => <article className="pi-component" key={n.id}><span className="pi-eyebrow">{i + 1} · {n.basis || 'unknown basis'}</span><h3>{onNode ? <button type="button" className="pi-text-button" onClick={() => onNode(n.id)}>{n.label}</button> : n.label}</h3><p>{n.summary || 'Contribution and scope not supplied.'}</p><p className="micro">Stated role / owner: {n.role || 'Unknown'}</p><p className="micro">Designed status: {n.status}. Runtime outcome not inferred.</p>{n.experienceWorkspaceId && onWorkspace && <button type="button" onClick={() => onWorkspace(n.experienceWorkspaceId!)}>Open task workspace</button>}</article>)}</div>{!components.length && <p>No components in this projection. Review visibility in Edit mode for a public deliverable.</p>}{omitted > 0 && <p className="micro">{omitted} additional components remain in the diagram.</p>}
    <h2>People and contributions</h2><p>Named author: {p.author||'Not supplied'}. Team membership remains unknown unless stated by the author or source.</p><h2>External evidence of outcomes</h2>{p.observations.some(o=>o.reviewedAt)?<ul>{p.observations.filter(o=>o.reviewedAt).slice(0,12).map(o=><li key={o.id}>{o.claim} · {o.observedAt} · {o.authority}: {o.summary} <span className="micro">{o.caveat} Source revision {o.sourceRevision}</span></li>)}</ul>:<p>No reviewed external outcome claim in this projection. Designed status is not a result.</p>}
    <h2>Evidence and provenance</h2><p>{p.provenance || 'Provenance not supplied.'}</p>{p.blocks.length ? <ul>{p.blocks.slice(0, 12).map(b => <li key={b.id}>{b.title} · {b.provenance}</li>)}</ul> : <p>No evidence attached in this projection.</p>}<ul>{p.sources.map(s => <li key={s.id}>{s.title}<span className="micro"> · {s.location}</span></li>)}</ul><h2>Caveats</h2><ul>{report.gaps.map(g => <li key={g.id}><strong>{g.title}</strong> · {g.resolution}</li>)}</ul><p className="micro">Declarations and static findings are not observed runtime results. Synthetic evidence stays synthetic. Public export filters visibility before building this sheet.</p>
    {!publicMode&&onView&&<GraphExplorer key={'graph-'+project.id} project={project} onOpen={onView} filter={graphFilter} onFilter={onGraphFilter}/>}
    {onView&&<IntelligenceInsights key={'insights-'+project.id} project={p} initialPurpose={purpose} onOpen={onView} onPatch={publicMode?undefined:onPatch} onDelivery={publicMode?undefined:onDelivery}/>}
    {!publicMode&&onDelivery&&onView&&<EvolutionPanel key={'evolution-'+project.id} project={project} onOpen={onView} onPatch={publicMode?undefined:onPatch}/>}
    <HowItWorksPanel key={'how-'+project.id+'-'+publicMode} project={project} publicMode={publicMode} onOpen={onView}/>
    {!publicMode&&onPatch&&<CrossRepositoryPanel project={project} onPatch={onPatch}/>}
    {!publicMode&&onPatch&&<DeepAnalysisPanel key={'deep-'+project.id} project={project} onPatch={onPatch}/>}
    {!publicMode&&library&&onProject&&<LibraryPanel key={project.id} projects={library} current={project} onOpen={onProject} target={libraryTarget}/>}
    <button onClick={()=>download(intelligenceReportHtml(project),`${project.id}.intelligence.html`,'text/html;charset=utf-8')}>Export public intelligence report</button>
  </section>;
}
