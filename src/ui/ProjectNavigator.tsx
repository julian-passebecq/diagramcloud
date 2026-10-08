import {useState, type KeyboardEvent} from 'react';
import type {Project} from '../core/model';
import {overviewProjection} from '../export/projectOverview';
import './project-intelligence.css';

export function ProjectNavigator({project, publicMode = false, selectedViewId, selectedNodeId, onView, onNode, onOverview, onRepository, onWorkspace}: {
  project: Project; publicMode?: boolean; selectedViewId?: string; selectedNodeId?: string;
  onView: (id: string) => void; onNode: (id: string) => void; onOverview: () => void;
  onRepository?: (id: string) => void; onWorkspace?: (id: string) => void;
}) {
  const [tab, setTab] = useState('project');
  const [filter, setFilter] = useState('');
  const p = overviewProjection(project, publicMode), active = p.atlas?.snapshots.find(s => s.id === p.atlas?.activeSnapshotId);
  const query = filter.trim().toLocaleLowerCase();
  const matches = (...values: string[]) => !query || values.some(value => value.toLocaleLowerCase().includes(query));
  const nodesById = new Map(p.nodes.map(n => [n.id, n]));
  const viewsById = new Map(p.views.map(v => [v.id, v]));
  const branchMatches = (id: string, seen = new Set<string>()): boolean => {
    const n = nodesById.get(id); if(!n || seen.has(id)) return false;
    if(matches(n.id, n.label)) return true;
    const next = new Set([...seen, id]);
    return (viewsById.get(n.childViewId || '')?.nodeIds || []).some(child => branchMatches(child, next));
  };
  const roots = (viewsById.get(p.rootViewId)?.nodeIds || []).filter(id => branchMatches(id));
  const repositories = active?.repositories.filter(r => matches(r.id, r.title)) || [];
  const views = p.views.filter(v => matches(v.id, v.title));
  const tabs = ['project','repositories','views'];
  const moveTab = (e: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.indexOf(tab);
    const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if(next < 0) return;
    e.preventDefault(); setTab(tabs[next]);
    e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#nav-tab-${tabs[next]}`)?.focus();
  };
  const node = (id: string, trail: Set<string> = new Set(), depth = 0): React.ReactNode => {
    const n = nodesById.get(id); if(!n || trail.has(id) || !branchMatches(id)) return null;
    const child = viewsById.get(n.childViewId || ''), next = new Set([...trail, id]);
    const button = <button type="button" aria-current={selectedNodeId === id ? 'true' : undefined} onClick={() => onNode(id)}>{n.label}</button>;
    return <li key={id}>{button}{child && depth < 5 && <details open={!!query || depth < 1}><summary>Children of {n.label}</summary><ul>{child.nodeIds.map(id => node(id, next, depth + 1))}</ul></details>}{n.experienceWorkspaceId && onWorkspace && <button type="button" className="pi-workspace-link" onClick={() => onWorkspace(n.experienceWorkspaceId!)}>Workspace</button>}</li>;
  };
  return <nav className="project-navigator" aria-label="Project navigation" data-testid="project-navigator"><div className="pi-tabs" role="tablist" aria-label="Navigation scope">{tabs.map(t => <button id={`nav-tab-${t}`} type="button" role="tab" tabIndex={t === tab ? 0 : -1} onKeyDown={moveTab} aria-selected={t === tab} aria-controls="project-nav-panel" key={t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div><label className="pi-navigation-filter">Filter <input aria-label="Navigation filter" type="search" value={filter} onChange={e => setFilter(e.target.value)}/></label><div id="project-nav-panel" role="tabpanel" aria-labelledby={`nav-tab-${tab}`}>
    {tab === 'project' && <><button type="button" onClick={onOverview}>Project Overview</button><ul className="pi-nav-list">{roots.map(id => node(id))}</ul>{!roots.length && <p className="micro">{query ? 'No matching components.' : 'No components in this projection.'}</p>}</>}
    {tab === 'repositories' && <>{active?.repositories.length ? <><p className="micro">Each repository has its own revision. No single project SHA.</p><ul className="pi-nav-list">{repositories.map(r => <li key={r.id}><button type="button" onClick={() => {if(onRepository) onRepository(r.id); else {const n = nodesById.get(r.nodeId || ''); if(n?.childViewId) onView(n.childViewId); else if(n) onNode(n.id);}}}>{r.title}</button><small>{r.scanStatus} · {r.revision?.slice(0,12) || 'revision unknown'}</small>{r.note && <small>{r.note}</small>}</li>)}</ul>{!repositories.length && <p className="micro">No matching repositories.</p>}</> : <p className="micro">No repository membership declared. Guided projects do not require Git.</p>}</>}
    {tab === 'views' && <><ul className="pi-nav-list">{views.map(v => <li key={v.id}><button type="button" aria-current={selectedViewId === v.id ? 'page' : undefined} onClick={() => onView(v.id)}>{v.title}</button><small>{v.perspective || 'authored view'}</small></li>)}</ul>{!views.length && <p className="micro">No matching views.</p>}</>}
  </div></nav>;
}
