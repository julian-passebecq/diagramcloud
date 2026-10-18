import {useState} from 'react';
import {relationshipTableFacts,type RelationshipTableFacts} from '../intelligence/navigation';
import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {readAcquisitionAnalysis} from '../intelligence/materialize';
import {NodeEvidence} from './Evidence';
import {repositoryOutputFacts} from '../intelligence/recipes';
import {SourceBridgeSummary} from './SourceBridgeSummary';

/** A bounded source sheet, separate from the logical component graph. */
export function AnalysisOutputs({project, publicMode, output, onView, repositoryId}: {
  project: Project; publicMode: boolean; output: 'structure'|'relationships'|'evidence'; onView: (id:string)=>void; repositoryId?:string;
}) {
  if(output==='relationships'){
    const facts=relationshipTableFacts(project,{publicMode,repositoryId});
    return <section className="analysis-sheet" aria-label="Relationships output"><h2>Relationships</h2><p>Declared and static source connections describe different meanings. They do not establish runtime traffic or timing.</p>
      <RelationshipTable key={JSON.stringify([facts.projectId,facts.revision,publicMode,repositoryId??null])} facts={facts} onView={onView}/></section>;
  }
  const doc = publicMode ? publicDocument(project) : project;
  const analysis = publicMode ? null : readAcquisitionAnalysis(doc,repositoryId);
  const scoped=repositoryOutputFacts(doc,repositoryId);
  if (output === 'evidence') return <section className="analysis-sheet" aria-label="Evidence output"><h2>Evidence and source gaps</h2>
    <SourceBridgeSummary project={project} publicMode={publicMode} repositoryId={repositoryId}/>
    <p>{doc.provenance || 'No source provenance supplied.'}</p>
    {analysis && <p>Content digest: <code>{analysis.sourceIdentity.contentDigest}</code><br/>Revision hint: {analysis.sourceIdentity.sourceRevision || 'unknown'} · worktree state unknown · {analysis.sourceIdentity.scopeComplete?'selected scope admitted':'partial scope'}. This is static source, never observed runtime.</p>}
    {scoped.nodes.filter(n=>n.blockIds.length).slice(0,20).map(n=><NodeEvidence key={n.id} doc={doc} node={{...n,blockIds:n.blockIds.filter(id=>!/^analysis-(?:context-|repo-.*-context-)/.test(id))}}/>)}
    {!scoped.nodes.some(n=>n.blockIds.some(id=>!/^analysis-(?:context-|repo-.*-context-)/.test(id))) && <p>No evidence attached. Use the optional Gaps panel for questions appropriate to your purpose.</p>}
  </section>;
  return <section className="analysis-sheet" aria-label="Structure output"><h2>Structure and selected documentation</h2>
    <SourceBridgeSummary project={project} publicMode={publicMode} repositoryId={repositoryId}/>
    {analysis ? <><p>{analysis.inventory.readFiles} files read from {analysis.inventory.selectedFiles} selected entries. {analysis.inventory.limited} limited, {analysis.inventory.ignored} ignored, {analysis.inventory.unsupported} unsupported. Inventory paths are source locations, not business tasks.</p>
      <div className="table-scroll"><table><thead><tr><th>Selected relative source</th><th>Bytes</th><th>Admission</th></tr></thead><tbody>{analysis.inventory.entries.map(e=><tr key={e.path}><td>{e.path}</td><td>{e.bytes}</td><td>{e.state}</td></tr>)}</tbody></table></div>
      <h3>Documentation</h3>{analysis.documentMap.documents.length ? analysis.documentMap.documents.map(d=><details key={d.path}><summary>{d.path} ({d.kind})</summary><ul>{d.headings.map(h=><li key={`${h.line}-${h.title}`}>{h.title} · line {h.line}</li>)}{d.records.map(r=><li key={`${r.id}-${r.startLine}`}>{r.id} · lines {r.startLine}–{r.endLine}</li>)}</ul></details>) : <p>No supported selected Markdown or CSV document was admitted.</p>}
      {analysis.documentMap.links.length>0 && <><h3>Exact source links</h3><ul>{analysis.documentMap.links.map((l,i)=><li key={i}>{l.fromPath}:{l.fromLine} → {l.toPath}{l.toLine?`:${l.toLine}`:''} · {l.kind}</li>)}</ul></>}
      {analysis.documentMap.diagnostics.length>0 && <><h3>Unresolved or limited sources</h3><ul>{analysis.documentMap.diagnostics.map((d,i)=><li key={i}>{d.path}{d.line?`:${d.line}`:''} · {d.code}: {d.message}<p className="micro">Cause: <code>{d.cause??'unclassified'}</code>{d.action&&<> · Suggested next step: {d.action.label}</>}</p></li>)}</ul></>}
    </> : <><p>{publicMode?'Only the public projection is shown. Private source inventories are omitted.':'Logical structure from explicit component and view memberships; no filesystem scan is implied.'}</p><ul>{doc.views.slice(0,7).map(v=><li key={v.id}><button onClick={()=>onView(v.id)}>{v.title}</button><ul>{v.nodeIds.map(id=>doc.nodes.find(n=>n.id===id)).filter(n=>!!n).map(n=><li key={n!.id}>{n!.label} · {n!.basis || 'basis not stated'}</li>)}</ul></li>)}</ul></>}
  </section>;
}

/** Paging is temporary presentation state only. The scoped key resets it before a changed scope renders. */
function RelationshipTable({facts,onView}:{facts:RelationshipTableFacts;onView:(id:string)=>void}){
 const [page,setPage]=useState(0),pageSize=50,pages=Math.max(1,Math.ceil(facts.total/pageSize)),current=Math.min(page,pages-1),start=current*pageSize,rows=facts.rows.slice(start,start+pageSize);
 if(facts.state==='unavailable')return <p role="status">Selected repository scope is unavailable in this permitted projection. No project-wide fallback was used.</p>;
 return <><p>{facts.scope==='repository'?'Explicit repository scope':'Current project scope'} · document revision {facts.revision}. Totals describe only this permitted document scope, not complete upstream discovery.</p>
  <p>{facts.views.length} existing views contain these connections. A connection shared by views appears once in the table.</p>
  <div className="toolbar" aria-label="Existing relationship views">{facts.views.map(v=><button type="button" key={v.id} onClick={()=>onView(v.id)}>{v.title} · {v.connectionCount} connections</button>)}</div>
  <p>Rows are read-only. View buttons open existing views. Connection-level sources and confidence are not supplied. Endpoint citations are context, not independent proof of a connection.</p>
  <p role="status" aria-label="Connection table count">{facts.total} permitted connections · {rows.length?`rows ${start+1}–${start+rows.length}`:'0 rows'} shown · {Math.max(0,facts.total-start-rows.length)} after this page. Page {current+1} of {pages}.</p>
  {rows.length?<div role="region" aria-label="Connection table scroll area" tabIndex={0} style={{maxWidth:'100%',minWidth:0,overflowX:'auto'}}><table style={{minWidth:960}}><caption>Canonical connections in permitted scope</caption><thead><tr>{['Connection ID / label','From → to','Type / basis','Quantity / provenance','Exact view memberships','Endpoint source context'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} data-connection-id={row.id}>
   <td><code>{row.id}</code><p>{row.label||'Label not supplied'}</p></td><td>{row.source.label}<br/><code>{row.source.id}</code><br/>→ {row.target.label}<br/><code>{row.target.id}</code></td>
   <td>{row.kind}<br/>Basis: {row.basis==='unspecified'?'not supplied (UNKNOWN)':row.basis}</td>
   <td>{row.quantity?<>{row.quantity.value} {row.quantity.unit}<br/>{row.quantity.provenance}{row.quantity.note&&<p>{row.quantity.note}</p>}</>:'Quantity not supplied (UNKNOWN)'}</td>
   <td>{row.views.length?<ul>{row.views.map(v=><li key={v.id}>{v.title}<br/><code>{v.id}</code></li>)}</ul>:'Not placed in any permitted view'}</td>
   <td>{row.endpointSources.length?<details><summary>{row.endpointSources.length} endpoint citations · context only</summary><ul>{row.endpointSources.map(s=><li key={s.id}>{s.title}<br/><code>{s.id}</code><br/><code>{s.location||'Location not supplied'}</code></li>)}</ul></details>:'No endpoint source context attached'}</td>
  </tr>)}</tbody></table></div>:<p>No relationship was established in this permitted scope. No arrows have been invented.</p>}
  <div className="toolbar" aria-label="Connection table pages"><button type="button" disabled={current===0} onClick={()=>setPage(Math.max(0,current-1))}>Previous connections</button><button type="button" disabled={current+1>=pages} onClick={()=>setPage(Math.min(pages-1,current+1))}>Next connections</button></div>
 </>;
}
