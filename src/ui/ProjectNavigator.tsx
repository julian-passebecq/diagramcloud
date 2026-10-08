import {useState} from 'react';
import type {Project} from '../core/model';
import {overviewProjection} from '../export/projectOverview';
import './project-intelligence.css';

export function ProjectNavigator({project, publicMode = false, selectedViewId, selectedNodeId, onView, onNode, onOverview, onRepository, onWorkspace}: {
  project: Project; publicMode?: boolean; selectedViewId?: string; selectedNodeId?: string;
  onView: (id: string) => void; onNode: (id: string) => void; onOverview: () => void;
  onRepository?: (id: string) => void; onWorkspace?: (id: string) => void;
}) {
  const [tab, setTab] = useState('project');
  const p = overviewProjection(project, publicMode), active = p.atlas?.snapshots.find(s => s.id === p.atlas?.activeSnapshotId);
  const node = (id: string, trail: Set<string> = new Set(), depth = 0): React.ReactNode => {
    const n = p.nodes.find(n => n.id === id); if(!n || trail.has(id)) return null;
    const child = p.views.find(v => v.id === n.childViewId), next = new Set([...trail, id]);
    const button = <button type="button" aria-current={selectedNodeId === id ? 'true' : undefined} onClick={() => onNode(id)}>{n.label}</button>;
    return <li key={id}>{child && depth < 5 ? <details open={depth < 1}><summary>{button}</summary><ul>{child.nodeIds.map(id => node(id, next, depth + 1))}</ul></details> : button}{n.experienceWorkspaceId && onWorkspace && <button type="button" className="pi-workspace-link" onClick={() => onWorkspace(n.experienceWorkspaceId!)}>Workspace</button>}</li>;
  };
  return <nav className="project-navigator" aria-label="Project navigation" data-testid="project-navigator"><div className="pi-tabs" role="tablist" aria-label="Navigation scope">{['project','repositories','views'].map(t => <button id={`nav-tab-${t}`} type="button" role="tab" aria-selected={t === tab} aria-controls="project-nav-panel" key={t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div><div id="project-nav-panel" role="tabpanel" aria-labelledby={`nav-tab-${tab}`}>
    {tab === 'project' && <><button type="button" onClick={onOverview}>Project Overview</button><ul className="pi-nav-list">{p.views.find(v => v.id === p.rootViewId)?.nodeIds.map(id => node(id))}</ul>{!p.nodes.length && <p className="micro">No components in this projection.</p>}</>}
    {tab === 'repositories' && <>{active?.repositories.length ? <><p className="micro">Each repository has its own revision. No single project SHA.</p><ul className="pi-nav-list">{active.repositories.map(r => <li key={r.id}><button type="button" onClick={() => {if(onRepository) onRepository(r.id); else {const n = p.nodes.find(n => n.id === r.nodeId); if(n?.childViewId) onView(n.childViewId); else if(n) onNode(n.id);}}}>{r.title}</button><small>{r.scanStatus} · {r.revision?.slice(0,12) || 'revision unknown'}</small>{r.note && <small>{r.note}</small>}</li>)}</ul></> : <p className="micro">No repository membership declared. Guided projects do not require Git.</p>}</>}
    {tab === 'views' && <ul className="pi-nav-list">{p.views.map(v => <li key={v.id}><button type="button" aria-current={selectedViewId === v.id ? 'page' : undefined} onClick={() => onView(v.id)}>{v.title}</button><small>{v.perspective || 'authored view'}</small></li>)}</ul>}
  </div></nav>;
}
