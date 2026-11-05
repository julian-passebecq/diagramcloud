import type {RefreshItem,RefreshSummary} from '../intelligence/refresh';

const SHOWN=12;
const short=(sha?:string)=>sha?sha.slice(0,12):'unknown';
const CATEGORIES:{key:keyof Pick<RefreshSummary,'added'|'changed'|'uncertain'|'unavailable'|'retainedEvidence'|'authoredNotRetained'>;title:string;help:string}[]=[
 {key:'added',title:'New',help:'Stable IDs this refresh adds. New scanner facts arrive private.'},
 {key:'changed',title:'Changed',help:'Same stable ID, different scanner content.'},
 {key:'uncertain',title:'Uncertain (not established by this scan)',help:'Kept with its ID and authored references. Absence from this selected source does not establish removal.'},
 {key:'unavailable',title:'Unavailable sources',help:'Not read or not attested by a Git revision.'},
 {key:'retainedEvidence',title:'Authored evidence retained',help:'Attached author evidence kept unchanged.'},
 {key:'authoredNotRetained',title:'Authored evidence not retained',help:'Attached author evidence this proposal changes or drops. Review it before applying.'},
];

function Items({items}:{items:RefreshItem[]}){
 const shown=items.slice(0,SHOWN);
 return <ul className="micro" style={{overflowWrap:'anywhere'}}>{shown.map(i=><li key={`${i.kind}:${i.id}`}><span>{i.kind}</span> <b>{i.label}</b> <code>{i.id}</code>{i.note?<> · {i.note}</>:null}</li>)}{items.length>SHOWN&&<li>and {items.length-SHOWN} more</li>}</ul>;
}

/**
 * Source refresh summary shown in the import review of an atlas rescan. It reads a pure refreshSummary of the
 * staged proposal against the live project; it applies nothing, never says "removed" for an absent component, and
 * never pairs two different IDs.
 */
export function SourceRefreshSummary({summary}:{summary:RefreshSummary}){
 return <section className="note-card" aria-label="Source refresh summary" data-testid="source-refresh-summary" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <strong>Source refresh{summary.repositoryIds.length?` · ${summary.repositoryIds.join(', ')}`:''}</strong>
  {summary.revision.map(r=><p key={r.repositoryId} className="micro" data-testid={`refresh-revision-${r.repositoryId}`}>{r.repositoryId}: revision {short(r.from)} → {short(r.to)}</p>)}
  {CATEGORIES.map(c=>{const items=summary[c.key];return <details key={c.key} data-category={c.key} data-count={items.length} open={items.length>0&&c.key!=='retainedEvidence'}>
   <summary>{c.title}: {items.length}</summary><p className="micro">{c.help}</p>{items.length>0&&<Items items={items}/>}
  </details>;})}
  <p className="micro">Nothing is removed by a refresh. Applying is one revision and one Undo; the reviewed view is reopened only when it is still permitted.</p>
 </section>;
}
