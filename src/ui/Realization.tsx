import {Badge,Button} from '@fluentui/react-components';
import type {Observation,Project,ProjectNode} from '../core/model';
import {CLAIM_LABEL,MEANING,day,isPresented,observationsFor} from '../core/realization';

export type ObservationActions={onReview:(id:string)=>void;onUpdate:(o:Observation)=>void;onRemove:(id:string)=>void};
// No green: a verified claim is the source app's statement, not a DiagramCloud validation.
const CLAIM_COLOR={observed:'brand',verified:'brand',partial:'warning','not-observed':'informative'} as const;

/** The three meanings, stated once wherever realization is shown. */
export function MeaningLegend(){return <dl className="meaning-legend" aria-label="What the labels mean">{(['designed','observed','presented'] as const).map(k=><div key={k}><dt>{MEANING[k].label}</dt><dd>{MEANING[k].help}</dd></div>)}</dl>;}

function review(o:Observation){return isPresented(o)?'Presented':o.reviewedAt?'Reviewed · private':'Not reviewed · private';}

/** One observation, with who says it, when, at which revision and its caveat. Plain text only: it came from another app. */
export function ObservationCard({o,doc,actions}:{o:Observation;doc:Project;actions?:ObservationActions}){
 const blocks=doc.blocks.filter(b=>o.blockIds.includes(b.id));
 return <article className="observation-card" data-testid={`observation-${o.id}`}>
  <div className="observation-head"><Badge appearance="tint" color={CLAIM_COLOR[o.claim]} size="small">{CLAIM_LABEL[o.claim]}</Badge><Badge appearance="outline" size="small">{review(o)}</Badge>{o.shareable&&<Badge appearance="outline" size="small">Shareable in index</Badge>}</div>
  <p className="observation-summary">{o.summary}</p>
  <dl className="observation-meta">
   <div><dt>Source</dt><dd>{o.sourceApp}</dd></div><div><dt>Authority</dt><dd>{o.authority}</dd></div>
   <div><dt>Observed</dt><dd><time dateTime={o.observedAt}>{o.observedAt}</time></dd></div><div><dt>Revision</dt><dd><code>{o.sourceRevision}</code></dd></div>
   {o.reviewedAt&&<div><dt>Reviewed</dt><dd><time dateTime={o.reviewedAt}>{day(o.reviewedAt)}</time></dd></div>}
  </dl>
  {o.caveat&&<p className="observation-caveat"><b>Caveat:</b> {o.caveat}</p>}
  {blocks.length>0&&<p className="micro">Backed by {blocks.map(b=>`${b.title} (${b.provenance})`).join(', ')}</p>}
  {o.link&&<a href={o.link} target="_blank" rel="noopener noreferrer">Open source ↗</a>}
  {actions&&<div className="observation-actions">
   {!o.reviewedAt&&<Button size="small" appearance="primary" onClick={()=>actions.onReview(o.id)}>Mark reviewed</Button>}
   <label>Visibility <select aria-label={`Visibility of observation ${o.id}`} value={o.visibility} disabled={!o.reviewedAt} onChange={e=>{const visibility=e.target.value as Observation['visibility'];actions.onUpdate({...o,visibility,shareable:visibility==='public'&&o.shareable});}}><option value="private">Private</option><option value="public">Public · presented</option></select></label>
   <label className="observation-share"><input type="checkbox" aria-label={`Shareable in portfolio index: ${o.id}`} checked={o.shareable} disabled={!isPresented(o)} onChange={e=>actions.onUpdate({...o,shareable:e.target.checked})}/> Shareable in portfolio index</label>
   <Button size="small" appearance="subtle" onClick={()=>actions.onRemove(o.id)}>Remove</Button>
   {!o.reviewedAt&&<span className="micro">Review before it can be public or shared.</span>}
  </div>}
 </article>;
}

export function RealizationSection({doc,node,actions}:{doc:Project;node:ProjectNode;actions?:ObservationActions}){
 const list=observationsFor(doc,node.id);
 return <section className="realization-section" aria-label="Realization">
  <div className="eyebrow">REALIZATION</div>
  <h3>{list.length?`${list.length} observation${list.length===1?'':'s'} from other apps`:'Planned / designed only'}</h3>
  {!list.length&&<p className="muted">No dated external observation yet. The status colour on the card is an illustrative design state. {actions?'Observations arrive from DataPass VS Code or another app as a JSON Patch, reviewed in JSON / AI.':''}</p>}
  {list.map(o=><ObservationCard key={o.id} o={o} doc={doc} actions={actions}/>)}
  <details className="meaning-details"><summary>What designed, observed and presented mean</summary><MeaningLegend/></details>
 </section>;
}

/** Story bar: reviewed evidence a step cites, with its authority. */
export function StoryEvidence({doc,ids}:{doc:Project;ids?:string[]}){
 const cited=(ids??[]).map(id=>doc.observations.find(o=>o.id===id)).filter((o):o is Observation=>!!o);
 if(!cited.length)return null;
 return <ul className="story-evidence" aria-label="Reviewed evidence for this step">{cited.map(o=><li key={o.id}><b>{CLAIM_LABEL[o.claim]}</b> · {o.summary} <small>{o.sourceApp} @ {o.sourceRevision} · {day(o.observedAt)} · authority: {o.authority}{o.caveat?` · caveat: ${o.caveat}`:''}</small></li>)}</ul>;
}
