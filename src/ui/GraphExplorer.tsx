import {useMemo,useState} from 'react';
import type {Project} from '../core/model';
import {compareGraphGenerations,graphEvidenceChain,graphRows,readGraphHistory,graphTombstonePatch,graphAssertionTable,type GraphFilter} from '../intelligence/graphSnapshot';
import {download} from '../export/browser';
import {GraphFilters} from './GraphFilters';

/** The offline inspector queries imported, private facts only. Portfolio receives
 * publicDocument, which has no generation receipt, so no hidden names/counts. */
export function GraphExplorer({project,onOpen,filter:sharedFilter,onFilter}:{project:Project;onOpen:(view:string,node?:string)=>void;filter?:GraphFilter;onFilter?:(filter:GraphFilter)=>void}){
 const [localFilter,setFilter]=useState<GraphFilter>({}),[selected,setSelected]=useState<string>(),[page,setPage]=useState(0);
 const filter=sharedFilter??localFilter;
 const updateFilter=(next:GraphFilter)=>{setFilter(next);onFilter?.(next);setPage(0);};
 const history=useMemo(()=>readGraphHistory(project),[project]);
 const rows=useMemo(()=>graphRows(project,filter),[project,filter]);
 const chain=useMemo(()=>selected?graphEvidenceChain(project,selected):null,[project,selected]);
 const latest=history.at(-1);if(!latest)return null;
 const label=(id:string)=>project.nodes.find(n=>n.id===id)?.label??id;
 const open=(id:string)=>{const view=project.views.find(v=>v.id!=='graph-root'&&v.nodeIds.includes(id));if(view)onOpen(view.id,id);};
 const delta=history.length>1?compareGraphGenerations(history.at(-2)!,latest):null;
 return <section className="project-overview graph-explorer" data-testid="graph-explorer"><span className="pi-eyebrow">Private offline snapshot · {latest.synthetic?'Synthetic':'Source-provided'}</span><h2>Graph explorer</h2>
  <p>Generation {latest.generationId} · captured {latest.capturedAt} · {latest.complete?'Complete declared scope':'Partial declared scope'}. No live activity or runtime verification is inferred.</p>
  <GraphFilters project={project} filter={filter} onChange={updateFilter}/>
  <p>These filters also apply to the imported canvas. Authored cards and parent navigation remain available.</p>
  <details><summary>Perspectives and scope limits</summary><div className="pi-controls">{project.views.filter(v=>v.id.startsWith('graph-view-')).map(v=><button key={v.id} onClick={()=>onOpen(v.id)}>{v.title}</button>)}</div><p>Project membership uses explicit groups or parent IDs. A scope selector does not grant access. Imported source paths are inert references.</p><ul>{latest.omitted.map((o,i)=><li key={i}>{o.reason}</li>)}</ul></details>
  <p role="status">{rows.nodes.length} matching components · {rows.assertions.length} matching assertions. Table pages contain at most 50 rows.</p>
  <div className="graph-table-scroll"><table><caption>Imported facts with source-declared states</caption><thead><tr><th>Component</th><th>Kind</th><th>Declared state</th><th>Organization</th><th>Sources</th><th>Actions</th></tr></thead><tbody>{rows.nodes.slice(page*50,(page+1)*50).map(n=><tr key={n.localId}><td><button className="pi-text-button" onClick={()=>setSelected(n.localId)}>{label(n.localId)}</button></td><td>{n.kind}</td><td>{n.state}</td><td>{n.organization}</td><td>{n.sourceIds.filter(id=>project.sources.some(s=>s.id===id)).length}</td><td><button onClick={()=>open(n.localId)}>Open diagram</button></td></tr>)}</tbody></table></div>
  <div className="pi-controls"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous page</button><span>Page {page+1}</span><button disabled={(page+1)*50>=rows.nodes.length} onClick={()=>setPage(p=>p+1)}>Next page</button></div>
  <RetainedAssertions project={project} filter={filter}/>
  {chain&&<section aria-label="Graph evidence chain"><h3>{label(selected!)} · supplied evidence chain</h3><p>Connections are supplied assertions, traversed in both directions; reading order does not claim causal order or timing.</p>{chain.missing.length>0&&<p>Missing linked kinds: {chain.missing.join(', ')}. No missing relationship was invented.</p>}{chain.limited&&<p>Chain limited to 80 components.</p>}
   <ul>{chain.assertions.map(a=><li key={a.localId}>{label(a.from)} → {label(a.to)} · {project.edges.find(e=>e.id===a.localId)?.label} · {a.family} · {a.origin}</li>)}</ul>
   <h4>Exact source references</h4><ul>{project.sources.filter(s=>chain.nodes.some(n=>n.sourceIds.includes(s.id))||chain.assertions.some(a=>a.sourceIds.includes(s.id))).map(s=><li key={s.id}><strong>{s.title}</strong><code>{s.location}</code></li>)}</ul><p>Repository revisions in this generation: {latest.sourceVector.map(s=>s.repo_id+' @ '+s.revision).join('; ')}.</p>
  </section>}
  <details><summary>Evolution and comparison</summary><ol>{history.map(g=><li key={g.generationId}>{g.generationId} · {g.capturedAt} · {g.complete?'complete':'partial'} · {g.sourceVector.map(r=>r.repo_id+'@'+r.revision).join('; ')}</li>)}</ol>
   {delta?<><h3>{delta.before} → {delta.after} · {delta.state}</h3><ul>{delta.reasons.map(r=><li key={r}>{r}</li>)}</ul><ul>{delta.changes.map((c,i)=><li key={i}>{c.kind} {c.id}: {c.change}. <button onClick={()=>open(c.localId)}>Inspect retained component</button></li>)}</ul><p>Tombstones are review information. Reimport never deletes authored work.</p>{graphTombstonePatch(project)&&<button onClick={()=>download(JSON.stringify(graphTombstonePatch(project),null,2),`${project.id}.tombstones.patch.json`,'application/json')}>Download tombstone proposal for review</button>}</>:<p>Import another generation of this graph to compare its source facts.</p>}
  </details>
 </section>;
}


/** Separate transient pager: an immutable Project replacement invalidates it during render. */
function RetainedAssertions({project,filter}:{project:Project;filter:GraphFilter}){
 const first=graphAssertionTable(project,{filter}),key=JSON.stringify([project.id,project.revision,first.graphId,first.generationId,filter]);
 const [stored,setStored]=useState({project,key,page:0}),current=stored.project===project&&stored.key===key,page=current?stored.page:0;
 if(!current)setStored({project,key,page:0});
 const facts=page?graphAssertionTable(project,{filter,page}):first;
 if(facts.state!=='available')return <section aria-label="Retained source assertions"><h3>Retained source assertions</h3><p role="status">Source assertions are unavailable in this selected scope. No broader scope was used.</p></section>;
 return <section aria-label="Retained source assertions" data-testid="graph-assertion-table" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}><h3>Retained source assertions</h3>
  <p>Source-declared assertions from graph <code>{facts.graphId}</code>, generation <code>{facts.generationId}</code>, captured {facts.capturedAt}. {facts.synthetic?'Synthetic':'Source-provided'} · {facts.complete?'Source declares complete selected scope':'Source declares partial selected scope'}. These are not reviewed observations or live verification.</p>
  <p>Full source predicates, observation/validity times and confidence are UNKNOWN in this retained receipt. Origin is the retained source-declared category only. Current endpoint captions are authoring labels. No code block is parsed or evidence inferred.</p>
  <p role="status" aria-label="Retained assertion page">{facts.page.start}–{facts.page.end} of {facts.total} retained assertions · {facts.page.remaining} later rows. Page {facts.page.pages?facts.page.index+1:0} of {facts.page.pages}.</p>
  {facts.rows.length?<div role="region" aria-label="Retained assertion table scroll area" tabIndex={0} style={{maxWidth:'100%',overflowX:'auto'}}><table style={{minWidth:1000}}><caption>Source assertions in the current permitted graph filter</caption><thead><tr>{['Assertion identity','Explicit endpoints','Family / source-declared origin','Direct retained source references'].map(title=><th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{facts.rows.map(row=><tr key={row.id} data-assertion-id={row.externalId}><td><code>{row.externalId}</code><br/><code>{row.id}</code></td><td>{row.from.label}<br/><code>{row.from.id}</code><br/>→ {row.to.label}<br/><code>{row.to.id}</code></td><td>{row.family}<br/>{row.origin}</td><td>{row.sources.length?<ul>{row.sources.map((source,index)=><li key={index}><code>{source.id}</code>{source.state==='available'?<><br/>{source.title}<br/><code>{source.location}</code></>:<p>Exact source reference unavailable.</p>}</li>)}</ul>:<span>UNKNOWN — no direct source reference supplied. Endpoint citations are not substituted.</span>}</td></tr>)}</tbody></table></div>:<p>No retained assertion matches the current permitted filter. This is not proof of absence upstream.</p>}
  <div className="pi-controls" role="group" aria-label="Retained assertion pagination"><button type="button" disabled={facts.page.index===0} onClick={()=>setStored({project,key,page:Math.max(0,facts.page.index-1)})}>Previous assertions</button><button type="button" disabled={!facts.page.pages||facts.page.index+1>=facts.page.pages} onClick={()=>setStored({project,key,page:facts.page.index+1})}>Next assertions</button></div>
  <details><summary>Retained assertion source vector and omissions</summary><p>This generation-wide declared repository vector is not an assertion-to-repository mapping. Every repository keeps its own declared revision. Capture time is not observation time or freshness proof. Missing units, windows, counter/reset/cache semantics and usage remain UNKNOWN.</p><ul>{facts.sourceVector.map(r=><li key={r.repo_id}><code>{r.repo_id}</code> @ <code>{r.revision}</code></li>)}</ul><p>{facts.producerOmissions.length} producer omission entries; not recovered by paging. Retained row totals do not count upstream omissions.</p><ul>{facts.producerOmissions.map((r,i)=><li key={i}>{r.reason}</li>)}</ul></details>
 </section>;
}
