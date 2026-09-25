import {useState,type KeyboardEvent} from 'react';
import {Button} from '@fluentui/react-components';
import type {ModelItem} from './semantic';
import {addColumn,addMeasure,addRelationship,addTable,columnRefs,removeColumn,removeMeasure,removeRelationship,removeTable,renameColumn,renameTable,setColumn,setRelationship,setTableKind,type Cardinality,type ColumnKey,type ModelEdit,type TableKind} from './modelEdit';

const KINDS:TableKind[]=['fact','dimension','bridge','other'],CARDS:Cardinality[]=['*:1','1:1','*:*'];

/** Text field that commits on Enter or blur (one undo step), restores on Escape or when the edit is refused. */
function CommitInput(p:{value:string;label:string;onCommit:(v:string)=>boolean;size?:number}){
 const done=(el:HTMLInputElement)=>{if(el.value===p.value)return;if(!p.onCommit(el.value))el.value=p.value;};
 return <input key={p.value} defaultValue={p.value} aria-label={p.label} size={p.size} onBlur={e=>done(e.currentTarget)}
  onKeyDown={(e:KeyboardEvent<HTMLInputElement>)=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.currentTarget.value=p.value;e.currentTarget.blur();}}}/>;
}

/** In-app editor for a semantic-model item: tables, columns, relationships and measures. Each change is one undo step. */
export function ModelEditor(p:{item:ModelItem;onApply:(edit:ModelEdit)=>void;onClose:()=>void}){
 const m=p.item,[selected,setSelected]=useState(m.tables[0]?.name??''),[error,setError]=useState('');
 const [newTable,setNewTable]=useState(''),[newKind,setNewKind]=useState<TableKind>('dimension');
 const [newColumn,setNewColumn]=useState(''),[newType,setNewType]=useState(''),[newKey,setNewKey]=useState<''|'pk'|'fk'>('');
 const refs=columnRefs(m),[from,setFrom]=useState(''),[to,setTo]=useState(''),[card,setCard]=useState<Cardinality>('*:1');
 const [measure,setMeasure]=useState(''),[measureTable,setMeasureTable]=useState('');
 const table=m.tables.find(t=>t.name===selected)??m.tables[0];
 const run=(fn:()=>ModelEdit,after?:(e:ModelEdit)=>void)=>{try{const e=fn();if(e.label){p.onApply(e);after?.(e);}setError('');return true;}catch(x){setError(x instanceof Error?x.message:String(x));return false;}};
 return <section className="xp-model-editor" aria-label={`Edit model ${m.title}`}>
  <header><strong>Edit model: {m.title}</strong><span className="xp-muted">Changes apply immediately and can be undone. Names apply on Enter or when you leave the field.</span><Button size="small" onClick={p.onClose}>Close model editor</Button></header>
  {error&&<p role="alert" className="xp-model-error">{error}</p>}
  <div className="xp-model-cols">
   <div>
    <h4>Tables ({m.tables.length})</h4>
    <ul className="xp-model-list">{m.tables.map(t=><li key={t.name}><button type="button" className={t.name===table?.name?'active':''} aria-pressed={t.name===table?.name} onClick={()=>setSelected(t.name)}>{t.name}</button><small>{t.kind}</small></li>)}</ul>
    <form onSubmit={e=>{e.preventDefault();run(()=>addTable(m,newTable,newKind),ed=>{setSelected(ed.item.tables.at(-1)!.name);setNewTable('');});}}>
     <input aria-label="New table name" placeholder="New table, e.g. DimGeography" value={newTable} onChange={e=>setNewTable(e.target.value)}/>
     <select aria-label="New table kind" value={newKind} onChange={e=>setNewKind(e.target.value as TableKind)}>{KINDS.map(k=><option key={k}>{k}</option>)}</select>
     <Button size="small" type="submit" disabled={!newTable.trim()}>Add table</Button>
    </form>
   </div>
   {table&&<div>
    <h4>Table</h4>
    <div className="xp-model-row"><label>Name <CommitInput label="Table name" value={table.name} onCommit={v=>run(()=>renameTable(m,table.name,v),ed=>setSelected(ed.item.tables.find(t=>!m.tables.some(o=>o.name===t.name))?.name??table.name))}/></label>
     <label>Kind <select aria-label="Table kind" value={table.kind} onChange={e=>run(()=>setTableKind(m,table.name,e.target.value as TableKind))}>{KINDS.map(k=><option key={k}>{k}</option>)}</select></label>
     <Button size="small" onClick={()=>run(()=>removeTable(m,table.name),ed=>setSelected(ed.item.tables[0]?.name??''))}>Delete table</Button></div>
    <table className="xp-model-columns"><thead><tr><th>Column</th><th>Type</th><th>Key</th><th/></tr></thead><tbody>{table.columns.map(c=><tr key={c.name}>
     <td><CommitInput label={`Column name ${c.name}`} value={c.name} size={14} onCommit={v=>run(()=>renameColumn(m,table.name,c.name,v))}/></td>
     <td><CommitInput label={`Column type ${c.name}`} value={c.type} size={8} onCommit={v=>run(()=>setColumn(m,table.name,c.name,{type:v}))}/></td>
     <td><select aria-label={`Column key ${c.name}`} value={c.key??''} onChange={e=>run(()=>setColumn(m,table.name,c.name,{key:(e.target.value||null) as ColumnKey|null}))}><option value="">—</option><option value="pk">PK</option><option value="fk">FK</option></select></td>
     <td><button type="button" className="xp-link" aria-label={`Delete column ${c.name}`} onClick={()=>run(()=>removeColumn(m,table.name,c.name))}>✕</button></td></tr>)}</tbody></table>
    <form className="xp-model-row" onSubmit={e=>{e.preventDefault();run(()=>addColumn(m,table.name,newColumn,newType,newKey||undefined),()=>{setNewColumn('');setNewType('');setNewKey('');});}}>
     <input aria-label="New column name" placeholder="New column" value={newColumn} onChange={e=>setNewColumn(e.target.value)} size={14}/>
     <input aria-label="New column type" placeholder="type" value={newType} onChange={e=>setNewType(e.target.value)} size={8}/>
     <select aria-label="New column key" value={newKey} onChange={e=>setNewKey(e.target.value as ''|'pk'|'fk')}><option value="">—</option><option value="pk">PK</option><option value="fk">FK</option></select>
     <Button size="small" type="submit" disabled={!newColumn.trim()}>Add column</Button>
    </form>
   </div>}
   <div>
    <h4>Relationships ({m.relationships.length})</h4>
    <ul className="xp-model-list">{m.relationships.map((r,k)=><li key={`${r.from}-${r.to}`}><span className={r.active?'':'xp-muted'}>{r.from} → {r.to}</span>
     <select aria-label={`Cardinality ${r.from} to ${r.to}`} value={r.cardinality} onChange={e=>run(()=>setRelationship(m,k,{cardinality:e.target.value as Cardinality}))}>{CARDS.map(c=><option key={c}>{c}</option>)}</select>
     <label className="xp-inline"><input type="checkbox" aria-label={`Active ${r.from} to ${r.to}`} checked={r.active} onChange={e=>run(()=>setRelationship(m,k,{active:e.target.checked}))}/>active</label>
     <button type="button" className="xp-link" aria-label={`Delete relationship ${r.from} to ${r.to}`} onClick={()=>run(()=>removeRelationship(m,k))}>✕</button></li>)}</ul>
    <form className="xp-model-row" onSubmit={e=>{e.preventDefault();run(()=>addRelationship(m,from,to,card),()=>{setFrom('');setTo('');});}}>
     <select aria-label="Relationship from (many side)" value={from} onChange={e=>setFrom(e.target.value)}><option value="">From (many side)…</option>{refs.map(r=><option key={r}>{r}</option>)}</select>
     <select aria-label="Relationship to (one side)" value={to} onChange={e=>setTo(e.target.value)}><option value="">To (one side)…</option>{refs.filter(r=>r.split('.')[0]!==from.split('.')[0]).map(r=><option key={r}>{r}</option>)}</select>
     <select aria-label="New relationship cardinality" value={card} onChange={e=>setCard(e.target.value as Cardinality)}>{CARDS.map(c=><option key={c}>{c}</option>)}</select>
     <Button size="small" type="submit" disabled={!from||!to}>Add relationship</Button>
    </form>
    <h4>Measures ({m.measures.length})</h4>
    <ul className="xp-model-list">{m.measures.map(x=><li key={x.name}><span>Σ {x.name}</span><small>{x.table??''}</small><button type="button" className="xp-link" aria-label={`Delete measure ${x.name}`} onClick={()=>run(()=>removeMeasure(m,x.name))}>✕</button></li>)}</ul>
    <form className="xp-model-row" onSubmit={e=>{e.preventDefault();run(()=>addMeasure(m,measure,measureTable||undefined),()=>setMeasure(''));}}>
     <input aria-label="New measure name" placeholder="New measure" value={measure} onChange={e=>setMeasure(e.target.value)} size={16}/>
     <select aria-label="New measure table" value={measureTable} onChange={e=>setMeasureTable(e.target.value)}><option value="">(no table)</option>{m.tables.map(t=><option key={t.name}>{t.name}</option>)}</select>
     <Button size="small" type="submit" disabled={!measure.trim()}>Add measure</Button>
    </form>
   </div>
  </div>
 </section>;
}
