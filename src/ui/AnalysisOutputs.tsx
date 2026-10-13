import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {readAcquisitionAnalysis} from '../intelligence/materialize';
import {NodeEvidence} from './Evidence';
import {repositoryOutputFacts} from '../intelligence/recipes';

/** A bounded source sheet, separate from the logical component graph. */
export function AnalysisOutputs({project, publicMode, output, onView, repositoryId}: {
  project: Project; publicMode: boolean; output: 'structure'|'relationships'|'evidence'; onView: (id:string)=>void; repositoryId?:string;
}) {
  const doc = publicMode ? publicDocument(project) : project;
  const analysis = publicMode ? null : readAcquisitionAnalysis(doc,repositoryId);
  const scoped=repositoryOutputFacts(doc,repositoryId),relationships=scoped.views.filter(v=>v.edgeIds.length);
  if (output === 'relationships') return <section className="analysis-sheet" aria-label="Relationships output">
    <h2>Relationships</h2><p>Declared and static source connections describe different meanings. They do not establish runtime traffic or timing.</p>
    {relationships.length ? relationships.slice(0,7).map(v=><button key={v.id} onClick={()=>onView(v.id)}>{v.title} · {v.edgeIds.length} connections</button>) : <p>No relationship was established in this selection. No arrows have been invented.</p>}
  </section>;
  if (output === 'evidence') return <section className="analysis-sheet" aria-label="Evidence output"><h2>Evidence and source gaps</h2>
    <p>{doc.provenance || 'No source provenance supplied.'}</p>
    {analysis && <p>Content digest: <code>{analysis.sourceIdentity.contentDigest}</code><br/>Revision hint: {analysis.sourceIdentity.sourceRevision || 'unknown'} · worktree state unknown · {analysis.sourceIdentity.scopeComplete?'selected scope admitted':'partial scope'}. This is static source, never observed runtime.</p>}
    {scoped.nodes.filter(n=>n.blockIds.length).slice(0,20).map(n=><NodeEvidence key={n.id} doc={doc} node={{...n,blockIds:n.blockIds.filter(id=>!/^analysis-(?:context-|repo-.*-context-)/.test(id))}}/>)}
    {!scoped.nodes.some(n=>n.blockIds.some(id=>!/^analysis-(?:context-|repo-.*-context-)/.test(id))) && <p>No evidence attached. Use the optional Gaps panel for questions appropriate to your purpose.</p>}
  </section>;
  return <section className="analysis-sheet" aria-label="Structure output"><h2>Structure and selected documentation</h2>
    {analysis ? <><p>{analysis.inventory.readFiles} files read from {analysis.inventory.selectedFiles} selected entries. {analysis.inventory.limited} limited, {analysis.inventory.ignored} ignored, {analysis.inventory.unsupported} unsupported. Inventory paths are source locations, not business tasks.</p>
      <div className="table-scroll"><table><thead><tr><th>Selected relative source</th><th>Bytes</th><th>Admission</th></tr></thead><tbody>{analysis.inventory.entries.map(e=><tr key={e.path}><td>{e.path}</td><td>{e.bytes}</td><td>{e.state}</td></tr>)}</tbody></table></div>
      <h3>Documentation</h3>{analysis.documentMap.documents.length ? analysis.documentMap.documents.map(d=><details key={d.path}><summary>{d.path} ({d.kind})</summary><ul>{d.headings.map(h=><li key={`${h.line}-${h.title}`}>{h.title} · line {h.line}</li>)}{d.records.map(r=><li key={`${r.id}-${r.startLine}`}>{r.id} · lines {r.startLine}–{r.endLine}</li>)}</ul></details>) : <p>No supported selected Markdown or CSV document was admitted.</p>}
      {analysis.documentMap.links.length>0 && <><h3>Exact source links</h3><ul>{analysis.documentMap.links.map((l,i)=><li key={i}>{l.fromPath}:{l.fromLine} → {l.toPath}{l.toLine?`:${l.toLine}`:''} · {l.kind}</li>)}</ul></>}
      {analysis.documentMap.diagnostics.length>0 && <><h3>Unresolved or limited sources</h3><ul>{analysis.documentMap.diagnostics.map((d,i)=><li key={i}>{d.path}{d.line?`:${d.line}`:''} · {d.code}: {d.message}</li>)}</ul></>}
    </> : <><p>{publicMode?'Only the public projection is shown. Private source inventories are omitted.':'Logical structure from explicit component and view memberships; no filesystem scan is implied.'}</p><ul>{doc.views.slice(0,7).map(v=><li key={v.id}><button onClick={()=>onView(v.id)}>{v.title}</button><ul>{v.nodeIds.map(id=>doc.nodes.find(n=>n.id===id)).filter(n=>!!n).map(n=><li key={n!.id}>{n!.label} · {n!.basis || 'basis not stated'}</li>)}</ul></li>)}</ul></>}
  </section>;
}
