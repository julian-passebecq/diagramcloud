import type {Project} from '../core/model';
import {CLAIM_LABEL,stateFacetsFor} from '../core/realization';

/** Six independent axes from the same canonical observations. Source history is never collapsed into a
 * current verdict; scope labels are inert producer text, not project membership or access grants. */
export function StateFacets({doc,nodeId}:{doc:Project;nodeId:string}){
 const rows=stateFacetsFor(doc,nodeId);
 return <details className="state-facets" open={rows.some(row=>row.observations.length>0)}>
  <summary>Independent source states</summary>
  <p className="micro">Dated source claims and history, without a current-state verdict. Missing axes are unknown. Frozen may coexist with deployed; cancelled does not mean code was removed.</p>
  <dl className="grammar-list" aria-label="Independent source states">{rows.map(row=><div key={row.facet} data-state-facet={row.facet}>
   <dt>{row.label}</dt><dd>{row.observations.length?<ul>{row.observations.map(o=><li key={o.id}>
    <strong>{o.stateFacet!.value}</strong> · {CLAIM_LABEL[o.claim]}<br/>
    <small>Scope: {o.stateFacet!.scope} · {o.sourceApp} · authority: {o.authority}<br/>
    <time dateTime={o.observedAt}>{o.observedAt}</time> · source revision <code>{o.sourceRevision}</code> · {o.reviewedAt?'author reviewed':'awaiting author review'}</small>
    {o.link&&<><br/><a href={o.link} target="_blank" rel="noopener noreferrer">Open claim source ↗</a></>}
    {o.caveat&&<p className="micro">{o.caveat}</p>}
   </li>)}</ul>:<span className="muted">Unknown · no typed source claim</span>}</dd>
  </div>)}</dl>
 </details>;
}
