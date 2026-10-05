import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';

type Source=Project['sources'][number];
const slug=(title:string,taken:Set<string>)=>{const base=('src-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')).slice(0,60).replace(/-+$/,'')||'src';let id=base,k=2;while(taken.has(id))id=`${base}-${k++}`;return id;};

/**
 * Project sources without JSON: title, locator (document, page, repository path), optional HTTP(S) link and
 * visibility. Components and evidence blocks cite them by stable ID; a cited source cannot be removed until the
 * citations are gone, so no reference dangles.
 */
export function SourcesEditor({doc,onCommit,onError}:{doc:Project;onCommit:(sources:Source[])=>void;onError:(e:string)=>void}){
 const [draft,setDraft]=useState<Source[]>(()=>doc.sources.map(s=>({...s})));
 const cited=new Set([...doc.nodes.flatMap(n=>n.sourceIds),...doc.blocks.flatMap(b=>b.sourceIds)]);
 const set=(i:number,patch:Partial<Source>)=>setDraft(d=>d.map((s,k)=>k===i?{...s,...patch}:s));
 return <form className="property-form sources-editor" aria-label="Project sources" onSubmit={e=>{e.preventDefault();try{onCommit(draft.map(s=>{const url=s.url?.trim();const out:Source={...s,title:s.title.trim(),location:s.location.trim()};if(url)out.url=url;else delete out.url;return out;}));}catch(error){onError(errorMessage(error));}}}>
  <h3>Sources</h3>
  <p className="micro">Where facts come from. Cite them from a component or an evidence block; private sources stay out of public exports.</p>
  {draft.map((s,i)=><fieldset key={s.id} className="metric-row"><legend>{s.title||'New source'} <span className="stable-id muted">{s.id}</span></legend>
   <label>Title<input aria-label={`Source ${i+1} title`} required maxLength={160} value={s.title} onChange={e=>set(i,{title:e.target.value})}/></label>
   <label>Locator<input aria-label={`Source ${i+1} locator`} maxLength={2000} value={s.location} placeholder="Document, page, section or repository path" onChange={e=>set(i,{location:e.target.value})}/></label>
   <div className="two-fields"><label>Link (optional)<input aria-label={`Source ${i+1} link`} type="url" maxLength={2000} value={s.url??''} placeholder="https://…" onChange={e=>set(i,{url:e.target.value})}/></label>
   <label>Visibility<select aria-label={`Source ${i+1} visibility`} value={s.visibility} onChange={e=>set(i,{visibility:e.target.value as Source['visibility']})}><option value="public">Public</option><option value="private">Private</option></select></label></div>
   <Button size="small" appearance="subtle" disabled={cited.has(s.id)} title={cited.has(s.id)?'Cited by a component or block':undefined} onClick={()=>setDraft(d=>d.filter((_,k)=>k!==i))}>{cited.has(s.id)?'Cited · cannot remove':'Remove source'}</Button>
  </fieldset>)}
  <div className="toolbar"><Button size="small" disabled={draft.length>=200} onClick={()=>setDraft(d=>[...d,{id:slug('source',new Set(d.map(s=>s.id))),title:'',location:'',visibility:'public'}])}>+ Add source</Button><Button type="submit">Apply sources</Button></div>
 </form>;
}
