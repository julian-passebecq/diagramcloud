import {GROUP_LABEL,type ChangeDetail,type ItemChange} from '../core/changeDetail';

const KIND_LABEL={added:'Added',removed:'Removed',changed:'Changed'} as const;
const PER_GROUP=40;

/** Item-by-item review of a proposed change. Plain text only: names and values come from imported JSON and are never rendered as HTML. */
export function ChangeDetailView({detail}:{detail:ChangeDetail}){
 const groups=new Map<string,ItemChange[]>();
 for(const c of detail.changes)groups.set(c.group,[...(groups.get(c.group)??[]),c]);
 const open=detail.changes.length<=30;
 return <section className="change-detail" aria-label="Proposed changes">
  {detail.cautions.length>0&&<div className="change-cautions" role="note" aria-label="Check before applying"><strong>Check before applying ({detail.cautions.length})</strong><ul>{detail.cautions.map(c=><li key={c}>{c}</li>)}</ul></div>}
  {detail.changes.length===0&&<p className="change-none">No differences from the open version.</p>}
  {[...groups].map(([group,items])=>{const count=(k:ItemChange['kind'])=>items.filter(i=>i.kind===k).length;
   return <details key={group} open={open} className="change-group"><summary><b>{GROUP_LABEL[group]??group}</b> <span className="change-counts">{count('added')?<span className="change-added">+{count('added')}</span>:null}{count('changed')?<span className="change-changed">~{count('changed')}</span>:null}{count('removed')?<span className="change-removed">−{count('removed')}</span>:null}</span></summary>
    <ul>{items.slice(0,PER_GROUP).map(c=><li key={c.kind+c.id} className={`change-item change-${c.kind}`}>
     <span className="change-kind">{KIND_LABEL[c.kind]}</span> <b>{c.name}</b> <code>{c.id}</code>
     {c.fields.length>0&&<ul className="change-fields">{c.fields.map(f=><li key={f.field}><span className="change-field">{f.field}</span>{f.before&&<del>{f.before}</del>}{f.before&&f.after&&<span aria-hidden="true"> → </span>}{f.after&&<ins>{f.after}</ins>}</li>)}</ul>}
    </li>)}{items.length>PER_GROUP&&<li className="change-more">… and {items.length-PER_GROUP} more</li>}</ul>
   </details>;})}
 </section>;
}
