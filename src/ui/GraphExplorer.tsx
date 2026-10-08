import {useMemo,useState} from 'react';
import type {Project} from '../core/model';
import {compareGraphGenerations,graphEvidenceChain,graphRows,readGraphHistory,graphTombstonePatch,type GraphFilter} from '../intelligence/graphSnapshot';
import {download} from '../export/browser';

/** The offline inspector queries imported, private facts only. Portfolio receives
 * publicDocument, which has no generation receipt, so no hidden names/counts. */
export function GraphExplorer({project,onOpen}:{project:Project;onOpen:(view:string,node?:string)=>void}){
 const [filter,setFilter]=useState<GraphFilter>({}),[selected,setSelected]=useState<string>(),[page,setPage]=useState(0);
 const history=useMemo(()=>readGraphHistory(project),[project]);
 const rows=useMemo(()=>graphRows(project,filter),[project,filter]);
 const chain=useMemo(()=>selected?graphEvidenceChain(project,selected):null,[project,selected]);
 const latest=history.at(-1);if(!latest)return null;
 const set=(key:keyof GraphFilter,value:string)=>{setFilter(f=>({...f,[key]:value||undefined}));setPage(0);};
 const choices={organization:[...new Set(latest.nodes.map(n=>n.organization))],
  project:latest.nodes.filter(n=>n.kind==='project').map(n=>n.externalId),
  family:[...new Set(latest.assertions.map(a=>a.family))],state:[...new Set(latest.nodes.map(n=>n.state))],
  origin:[...new Set(latest.assertions.map(a=>a.origin))]};
 const label=(id:string)=>project.nodes.find(n=>n.id===id)?.label??id;
 const open=(id:string)=>{const view=project.views.find(v=>v.id!=='graph-root'&&v.nodeIds.includes(id));if(view)onOpen(view.id,id);};
 const delta=history.length>1?compareGraphGenerations(history.at(-2)!,latest):null;
 return <section className="project-overview graph-explorer" data-testid="graph-explorer"><span className="pi-eyebrow">Private offline snapshot · {latest.synthetic?'Synthetic':'Source-provided'}</span><h2>Graph explorer</h2>
  <p>Generation {latest.generationId} · captured {latest.capturedAt} · {latest.complete?'Complete declared scope':'Partial declared scope'}. No live activity or runtime verification is inferred.</p>
  <div className="pi-controls"><label>Search imported facts <input aria-label="Graph search" value={filter.search??''} onChange={e=>set('search',e.target.value)}/></label>
   {(Object.keys(choices) as (keyof typeof choices)[]).map(key=><label key={key}>{key}<select aria-label={'Graph '+key} value={filter[key]??''} onChange={e=>set(key,e.target.value)}><option value="">All imported {key}</option>{choices[key].map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}</div>
  <details><summary>Perspectives and scope limits</summary><div className="pi-controls">{project.views.filter(v=>v.id.startsWith('graph-view-')).map(v=><button key={v.id} onClick={()=>onOpen(v.id)}>{v.title}</button>)}</div><p>Project membership uses explicit groups or parent IDs. A scope selector does not grant access. Imported source paths are inert references.</p><ul>{latest.omitted.map((o,i)=><li key={i}>{o.reason}</li>)}</ul></details>
  <p role="status">{rows.nodes.length} matching components · {rows.assertions.length} matching assertions. Table pages contain at most 50 rows.</p>
  <div className="graph-table-scroll"><table><caption>Imported facts with source-declared states</caption><thead><tr><th>Component</th><th>Kind</th><th>Declared state</th><th>Organization</th><th>Sources</th><th>Actions</th></tr></thead><tbody>{rows.nodes.slice(page*50,(page+1)*50).map(n=><tr key={n.localId}><td><button className="pi-text-button" onClick={()=>setSelected(n.localId)}>{label(n.localId)}</button></td><td>{n.kind}</td><td>{n.state}</td><td>{n.organization}</td><td>{n.sourceIds.filter(id=>project.sources.some(s=>s.id===id)).length}</td><td><button onClick={()=>open(n.localId)}>Open diagram</button></td></tr>)}</tbody></table></div>
  <div className="pi-controls"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous page</button><span>Page {page+1}</span><button disabled={(page+1)*50>=rows.nodes.length} onClick={()=>setPage(p=>p+1)}>Next page</button></div>
  {chain&&<section aria-label="Graph evidence chain"><h3>{label(selected!)} · supplied evidence chain</h3><p>Connections are supplied assertions, traversed in both directions; reading order does not claim causal order or timing.</p>{chain.missing.length>0&&<p>Missing linked kinds: {chain.missing.join(', ')}. No missing relationship was invented.</p>}{chain.limited&&<p>Chain limited to 80 components.</p>}
   <ul>{chain.assertions.map(a=><li key={a.localId}>{label(a.from)} → {label(a.to)} · {project.edges.find(e=>e.id===a.localId)?.label} · {a.family} · {a.origin}</li>)}</ul>
   <h4>Exact source references</h4><ul>{project.sources.filter(s=>chain.nodes.some(n=>n.sourceIds.includes(s.id))||chain.assertions.some(a=>a.sourceIds.includes(s.id))).map(s=><li key={s.id}><strong>{s.title}</strong><code>{s.location}</code></li>)}</ul><p>Repository revisions in this generation: {latest.sourceVector.map(s=>s.repo_id+' @ '+s.revision).join('; ')}.</p>
  </section>}
  <details><summary>Evolution and comparison</summary><ol>{history.map(g=><li key={g.generationId}>{g.generationId} · {g.capturedAt} · {g.complete?'complete':'partial'} · {g.sourceVector.map(r=>r.repo_id+'@'+r.revision).join('; ')}</li>)}</ol>
   {delta?<><h3>{delta.before} → {delta.after} · {delta.state}</h3><ul>{delta.reasons.map(r=><li key={r}>{r}</li>)}</ul><ul>{delta.changes.map((c,i)=><li key={i}>{c.kind} {c.id}: {c.change}. <button onClick={()=>open(c.localId)}>Inspect retained component</button></li>)}</ul><p>Tombstones are review information. Reimport never deletes authored work.</p>{graphTombstonePatch(project)&&<button onClick={()=>download(JSON.stringify(graphTombstonePatch(project),null,2),`${project.id}.tombstones.patch.json`,'application/json')}>Download tombstone proposal for review</button>}</>:<p>Import another generation of this graph to compare its source facts.</p>}
  </details>
 </section>;
}
