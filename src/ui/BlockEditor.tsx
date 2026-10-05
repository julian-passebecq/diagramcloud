import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {blockSchema,errorMessage,type EvidenceBlock,type Project} from '../core/model';
import {MAX_COLUMNS,MAX_ROWS,draftOfTable,emptyTable,parseDelimited,tableBlock,tableOps,tableWarning,type TableBlock,type TableDraft} from '../core/table';
import {TRANSFORM_LABEL,TRANSFORM_STEPS} from '../core/transform';

/*
 * Visual editors for ordinary evidence blocks, so normal authoring never needs raw JSON: tables (columns, rows,
 * reorder, paste), explanations, code and image captions. Every editor states provenance, visibility, sources and
 * the optional transformation step; the stable block ID never changes.
 */
type Common=Pick<EvidenceBlock,'title'|'provenance'|'visibility'|'sourceIds'|'transform'>;
const PROVENANCE:[EvidenceBlock['provenance'],string][]=[['synthetic','Synthetic / illustrative'],['source-derived','Source-derived'],['reference','Reference'],['author','Author-written']];

function CommonFields({value,set,sources,label}:{value:Common;set:(patch:Partial<Common>)=>void;sources:Project['sources'];label:string}){
 const toggle=(id:string,on:boolean)=>set({sourceIds:on?[...value.sourceIds,id]:value.sourceIds.filter(s=>s!==id)});
 return <>
  <label>Title<input aria-label={`${label} title`} required maxLength={160} value={value.title} onChange={e=>set({title:e.target.value})}/></label>
  <div className="two-fields">
   <label>Provenance<select aria-label={`${label} provenance`} value={value.provenance} onChange={e=>set({provenance:e.target.value as Common['provenance']})}>{PROVENANCE.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label>Visibility<select aria-label={`${label} visibility`} value={value.visibility} onChange={e=>set({visibility:e.target.value as Common['visibility']})}><option value="public">Public</option><option value="private">Private · left out of exports</option></select></label>
  </div>
  <label>Transformation step<select aria-label={`${label} transformation step`} value={value.transform??''} onChange={e=>set({transform:(e.target.value||undefined) as Common['transform']})}><option value="">Not part of a transformation</option>{TRANSFORM_STEPS.map(s=><option key={s} value={s}>{TRANSFORM_LABEL[s]}</option>)}</select></label>
  {sources.length>0&&<fieldset className="metric-sources"><legend>Sources</legend>{sources.map(s=><label key={s.id} className="check"><input type="checkbox" checked={value.sourceIds.includes(s.id)} onChange={e=>toggle(s.id,e.target.checked)}/>{s.title}</label>)}</fieldset>}
 </>;
}

type TableProps={sources:Project['sources'];block?:TableBlock;newId:()=>string;submitLabel:string;onSubmit:(block:TableBlock)=>void;onError:(error:string)=>void};
const PAGE=25;
/** Example-rows editor: rename, add, remove and reorder columns and rows, or paste rows from a spreadsheet. */
export function TableEditor(p:TableProps){
 const fresh=():TableDraft=>p.block?draftOfTable(p.block):emptyTable();
 const [draft,setDraft]=useState(fresh),[page,setPage]=useState(0),[paste,setPaste]=useState(''),[header,setHeader]=useState(true);
 const set=(patch:Partial<TableDraft>)=>setDraft(d=>({...d,...patch}));
 const apply=(op:(d:TableDraft)=>TableDraft)=>setDraft(op);
 const pages=Math.max(1,Math.ceil(draft.rows.length/PAGE)),at=Math.min(page,pages-1),first=at*PAGE,shown=draft.rows.slice(first,first+PAGE);
 const warning=tableWarning(draft);
 return <form className="property-form table-editor" aria-label="Table editor" onSubmit={e=>{e.preventDefault();try{p.onSubmit(tableBlock(draft,p.block??{id:p.newId()}));if(!p.block){setDraft(fresh());setPage(0);}}catch(error){p.onError(errorMessage(error));}}}>
  <CommonFields value={draft} set={set} sources={p.sources} label="Table"/>
  {warning&&<p className="micro metric-warning" role="note">{warning}</p>}
  <div className="table-grid-scroll"><table className="table-grid">
   <thead><tr><th aria-hidden="true"/>{draft.columns.map((c,j)=><th key={j}><input aria-label={`Column ${j+1} name`} maxLength={160} value={c} onChange={e=>apply(d=>tableOps.renameColumn(d,j,e.target.value))}/>
    <span className="cell-tools"><button type="button" aria-label={`Move column ${j+1} left`} disabled={j===0} onClick={()=>apply(d=>tableOps.moveColumn(d,j,-1))}>←</button><button type="button" aria-label={`Move column ${j+1} right`} disabled={j===draft.columns.length-1} onClick={()=>apply(d=>tableOps.moveColumn(d,j,1))}>→</button><button type="button" aria-label={`Remove column ${j+1}`} disabled={draft.columns.length===1} onClick={()=>apply(d=>tableOps.removeColumn(d,j))}>×</button></span></th>)}</tr></thead>
   <tbody>{shown.map((row,k)=>{const i=first+k;return <tr key={i}><th scope="row"><span className="row-number">{i+1}</span><span className="cell-tools"><button type="button" aria-label={`Move row ${i+1} up`} disabled={i===0} onClick={()=>apply(d=>tableOps.moveRow(d,i,-1))}>↑</button><button type="button" aria-label={`Move row ${i+1} down`} disabled={i===draft.rows.length-1} onClick={()=>apply(d=>tableOps.moveRow(d,i,1))}>↓</button><button type="button" aria-label={`Remove row ${i+1}`} onClick={()=>apply(d=>tableOps.removeRow(d,i))}>×</button></span></th>
    {row.map((c,j)=><td key={j}><input aria-label={`Row ${i+1}, ${draft.columns[j]||`column ${j+1}`}`} value={c} onChange={e=>apply(d=>tableOps.setCell(d,i,j,e.target.value))}/></td>)}</tr>;})}</tbody>
  </table></div>
  <div className="toolbar">
   <Button size="small" disabled={draft.rows.length>=MAX_ROWS} onClick={()=>{apply(d=>tableOps.addRow(d));setPage(Math.floor(draft.rows.length/PAGE));}}>+ Row</Button>
   <Button size="small" disabled={draft.columns.length>=MAX_COLUMNS} onClick={()=>apply(d=>tableOps.addColumn(d))}>+ Column</Button>
   {pages>1&&<span className="micro"><Button size="small" appearance="subtle" aria-label="Previous rows" disabled={at===0} onClick={()=>setPage(at-1)}>‹</Button> rows {first+1}–{Math.min(first+PAGE,draft.rows.length)} of {draft.rows.length} <Button size="small" appearance="subtle" aria-label="Next rows" disabled={at>=pages-1} onClick={()=>setPage(at+1)}>›</Button></span>}
   <span className="micro">{draft.columns.length}/{MAX_COLUMNS} columns · {draft.rows.length}/{MAX_ROWS} rows · empty cell = none, numbers and true/false are typed</span>
  </div>
  <details className="table-paste"><summary>Paste rows from a spreadsheet</summary>
   <textarea aria-label="Pasted rows" rows={4} value={paste} placeholder={'Copy cells from Excel or paste CSV lines'} onChange={e=>setPaste(e.target.value)}/>
   <label className="check"><input type="checkbox" checked={header} onChange={e=>setHeader(e.target.checked)}/>First line is the header</label>
   <Button size="small" onClick={()=>{try{const g=parseDelimited(paste,header);set({columns:g.columns,rows:g.rows.length?g.rows:[g.columns.map(()=>'')]});setPaste('');setPage(0);}catch(error){p.onError(errorMessage(error));}}}>Replace table with pasted rows</Button>
  </details>
  <Button appearance="primary" type="submit">{p.submitLabel}</Button>
 </form>;
}

type ContentBlock=Extract<EvidenceBlock,{type:'text'|'code'|'image'}>;
type ContentProps={sources:Project['sources'];block:ContentBlock;submitLabel:string;onSubmit:(block:EvidenceBlock)=>void;onError:(error:string)=>void};
/** Explanation, code or image caption, with the common fields. The block type and ID stay as they are. */
export function ContentEditor(p:ContentProps){
 const [draft,setDraft]=useState<ContentBlock>(p.block);
 const set=(patch:Partial<ContentBlock>)=>setDraft(d=>({...d,...patch}) as ContentBlock);
 const label=draft.type==='text'?'Explanation':draft.type==='code'?'Code':'Image';
 return <form className="property-form" aria-label={`${label} editor`} onSubmit={e=>{e.preventDefault();try{p.onSubmit(blockSchema.parse({...draft,title:draft.title.trim()}));}catch(error){p.onError(errorMessage(error));}}}>
  <CommonFields value={draft} set={set} sources={p.sources} label={label}/>
  {draft.type==='text'&&<label>Explanation<textarea aria-label="Explanation text" rows={6} maxLength={50000} value={draft.text} onChange={e=>set({text:e.target.value})}/></label>}
  {draft.type==='code'&&<><label>Language<select aria-label="Code language" value={draft.language} onChange={e=>set({language:e.target.value as typeof draft.language})}>{['sql','python','dax','json','text'].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Code (display only, never executed)<textarea aria-label="Code text" className="code-input" rows={8} maxLength={50000} spellCheck={false} value={draft.code} onChange={e=>set({code:e.target.value})}/></label></>}
  {draft.type==='image'&&<label>Caption<textarea aria-label="Image caption" rows={3} maxLength={50000} value={draft.caption} onChange={e=>set({caption:e.target.value})}/></label>}
  <Button appearance="primary" type="submit">{p.submitLabel}</Button>
 </form>;
}
