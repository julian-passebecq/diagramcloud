import {useState,type ReactNode} from 'react';
import {Button} from '@fluentui/react-components';
import {blockSchema,errorMessage,newId,type Project,type ProjectNode,type ProjectEdge,type EvidenceBlock,type Asset} from '../core/model';
import {imageAsset} from '../export/browser';
import {ICON_REGISTRY,isRegisteredIcon} from '../core/icons';
import {CLAIM_LABEL,MEANING,STATUS_NOTE,day,isPresented,observationsFor} from '../core/realization';
import {TRANSFORM_LABEL,transformationTemplate} from '../core/transform';
import {MetricsEditor} from './MetricsEditor';
import {ContentEditor,TableEditor} from './BlockEditor';
const kinds=['source','process','storage','model','report','app','control','physics','function','table'];
type Props={doc:Project;node:ProjectNode;edit:boolean;onUpdate:(node:ProjectNode)=>void;onDelete:()=>void;onChild:()=>void;onBlock:(block:EvidenceBlock,previousId?:string)=>void;onBlocks:(blocks:EvidenceBlock[])=>void;onReorder:(blockIds:string[])=>void;onDetach:(id:string)=>void;onImage:(asset:Asset,block:EvidenceBlock)=>void;onError:(error:string)=>void;onWorkspace?:()=>void};

/** One Inspector group. The same six groups, in the same order, describe every selected component. */
function Group({title,children}:{title:string;children:ReactNode}){return <div className="inspector-group" role="group" aria-label={title}><div className="eyebrow">{title.toUpperCase()}</div>{children}</div>;}
const Row=({k,children}:{k:string;children:ReactNode})=><div><dt>{k}</dt><dd>{children}</dd></div>;

/**
 * DataPass grammar for a selected component: Identity (what is it?), Meaning (what is it for?), Realization
 * (designed vs observed vs verified, and review), Evidence (how do we know?), Work (where is the work?) and
 * Publication (can it be shared?). Read-only here; Edit mode uses the same groups for its fields.
 */
export function ComponentSummary({doc,node,onWorkspace}:{doc:Project;node:ProjectNode;onWorkspace?:()=>void}){
 const views=doc.views.filter(v=>v.nodeIds.includes(node.id)),child=doc.views.find(v=>v.id===node.childViewId);
 const label=(id:string)=>doc.nodes.find(n=>n.id===id)?.label??id;
 const edges=doc.edges.filter(e=>views.some(v=>v.edgeIds.includes(e.id))&&(e.source===node.id||e.target===node.id));
 const blocks=doc.blocks.filter(b=>node.blockIds.includes(b.id)),obs=observationsFor(doc,node.id),latest=obs[0];
 const verified=obs.find(o=>o.claim==='verified');
 const provenance=Object.entries(blocks.reduce<Record<string,number>>((m,b)=>({...m,[b.provenance]:(m[b.provenance]??0)+1}),{})).map(([k,v])=>`${v} ${k}`).join(' · ');
 const sources=new Set([...node.sourceIds,...blocks.flatMap(b=>b.sourceIds)]),steps=doc.story.filter(s=>s.nodeId===node.id);
 const transform=blocks.filter(b=>b.transform);
 return <div className="inspector-grammar">
  <Group title="Identity"><dl className="grammar-list">
   <Row k="Type">{node.kind} · {node.provider}</Row>
   <Row k="Stable ID"><span className="stable-id">{node.id}</span></Row>
   <Row k="In view">{views.map(v=>v.title).join(' · ')||'—'}</Row>
   <Row k="Project">{doc.title}</Row>
  </dl></Group>
  <Group title="Meaning">
   {node.summary?<p>{node.summary}</p>:<p className="muted">No summary yet.</p>}
   {node.role&&<><h3>My contribution</h3><p className="prose">{node.role}</p></>}
   {edges.length>0&&<ul className="grammar-relations" aria-label="Relationships">{edges.map(e=><li key={e.id}>{e.source===node.id?<>→ {label(e.target)}</>:<>← {label(e.source)}</>}{e.label&&<span className="muted"> · {e.label}</span>}<span className="muted"> ({e.kind})</span></li>)}</ul>}
  </Group>
  <Group title="Realization"><dl className="grammar-list">
   <Row k="Designed"><span title={STATUS_NOTE}>{node.status} <span className="muted">(illustrative design state)</span></span></Row>
   <Row k="Observed">{latest?<>{CLAIM_LABEL[latest.claim]} · {latest.sourceApp} · {day(latest.observedAt)}</>:<span className="muted">No external observation</span>}</Row>
   <Row k="Verified">{verified?<>By {verified.sourceApp} at <span className="stable-id">{verified.sourceRevision}</span></>:<span className="muted">Not verified by a source app</span>}</Row>
   <Row k="Review">{latest?(obs.some(isPresented)?'Presented (reviewed, public)':obs.some(o=>o.reviewedAt)?'Reviewed · private':'Awaiting author review'):'—'}</Row>
  </dl><p className="micro">{MEANING.designed.label} ≠ {MEANING.observed.label} ≠ {MEANING.presented.label}. Details are under Realization below the diagram.</p></Group>
  <Group title="Evidence"><dl className="grammar-list">
   <Row k="Blocks">{blocks.length?`${blocks.length} · ${provenance}`:'None yet'}</Row>
   {transform.length>0&&<Row k="Transformation">{transform.map(b=>TRANSFORM_LABEL[b.transform!]).join(' → ')}</Row>}
   <Row k="Sources">{sources.size?`${sources.size} cited`:'None cited'}</Row>
  </dl>{blocks.some(b=>b.provenance==='synthetic')&&<p className="micro">Synthetic blocks illustrate shape and method; they are never measured results.</p>}</Group>
  <Group title="Work">
   {child&&<p>Nested architecture: <strong>{child.title}</strong> opens below when you select the card.</p>}
   {onWorkspace?<div className="inspector-actions"><Button appearance="primary" onClick={onWorkspace}>Open task workspace</Button><span className="micro">{node.childViewId?'The card itself explores the nested architecture; this opens the linked task screen.':'Opens the linked task screen with its reusable evidence items.'}</span></div>:!child&&<p className="muted">No linked task workspace or deeper view.</p>}
  </Group>
  <Group title="Publication"><dl className="grammar-list">
   <Row k="Visibility">{node.visibility==='public'?'Public':'Private · left out of public exports'}</Row>
   <Row k="Story">{steps.length?steps.map(s=>s.title).join(' · '):'Not in the guided story'}</Row>
   <Row k="Shareable">{obs.filter(o=>o.shareable).length?`${obs.filter(o=>o.shareable).length} observation card(s) in the portfolio index`:'No shareable observation'}</Row>
  </dl></Group>
 </div>;
}

export function Inspector(p:Props){
 const [type,setType]=useState('text'),[imageProvenance,setImageProvenance]=useState<EvidenceBlock['provenance']>('author'),[transformName,setTransformName]=useState('');
 const n=p.node,attached=n.blockIds.map(id=>p.doc.blocks.find(b=>b.id===id)).filter((b):b is EvidenceBlock=>!!b);
 const move=(i:number,delta:number)=>{const ids=[...n.blockIds],[x]=ids.splice(i,1);ids.splice(i+delta,0,x);p.onReorder(ids);};
 return <div className="inspector"><div className="eyebrow">{p.edit?'COMPONENT EDITOR':'SELECTED COMPONENT'}</div><h2>{n.label}</h2>
 <div className="chip-row"><span className="chip">{n.provider}</span><span className="chip">{n.kind}</span>{n.visibility==='private'&&<span className="chip">Private</span>}</div>
 {!p.edit?<><ComponentSummary doc={p.doc} node={n} onWorkspace={p.onWorkspace}/><div className="note-card">Motion is illustrative. A fast arrow is an authored explanation, not a measured Spark or SQL speed.</div></>:<>
 <form className="property-form" key={`${n.id}-${p.doc.revision}`} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const child=String(f.get('child')||'');const next={...n,label:String(f.get('label')),summary:String(f.get('summary')),provider:String(f.get('provider')),role:String(f.get('role')),kind:String(f.get('kind')) as ProjectNode['kind'],status:String(f.get('status')) as ProjectNode['status'],visibility:String(f.get('visibility')) as ProjectNode['visibility'],icon:String(f.get('icon')),sourceIds:f.getAll('sourceIds').map(String)};if(child)next.childViewId=child;else delete next.childViewId;p.onUpdate(next);}}>
  <fieldset className="form-group"><legend>Identity</legend>
   <label>Label<input name="label" aria-label="Component label" required maxLength={160} defaultValue={n.label}/></label>
   <p className="micro">Stable ID <span className="stable-id">{n.id}</span> never changes when you rename.</p>
   <div className="two-fields"><label>Kind<select name="kind" defaultValue={n.kind}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label><label>Provider<input name="provider" maxLength={80} defaultValue={n.provider} list="providers"/></label></div>
   <datalist id="providers">{['Microsoft Fabric','Databricks','Power BI','Azure','Oracle','SQL','PySpark','Delta Lake','Streamlit','Generic'].map(s=><option key={s} value={s}/>)}</datalist>
   <label>Icon<select name="icon" defaultValue={isRegisteredIcon(n.icon)?n.icon:'generic'}>{ICON_REGISTRY.map(e=><option key={e.id} value={e.id}>{e.label}{e.origin==='vendor'?` · ${e.vendor} artwork`:''}</option>)}</select></label>
   {!isRegisteredIcon(n.icon)&&<p className="micro">Icon “{n.icon}” is not in the icon registry, so the generic symbol is shown.</p>}
  </fieldset>
  <fieldset className="form-group"><legend>Meaning</legend>
   <label>Summary<textarea name="summary" aria-label="Component summary" rows={3} maxLength={500} defaultValue={n.summary}/></label>
   <label>My contribution<textarea name="role" rows={3} maxLength={1000} defaultValue={n.role}/></label>
   <label>Child view<select name="child" defaultValue={n.childViewId??''}><option value="">No child view</option>{p.doc.views.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
  </fieldset>
  <fieldset className="form-group"><legend>Realization</legend>
   <label>Design status (illustrative)<select name="status" defaultValue={n.status}>{['idle','running','complete','warning','failed'].map(k=><option key={k}>{k}</option>)}</select></label>
   <p className="micro">{STATUS_NOTE} Observations from other apps are reviewed under Realization below the diagram.</p>
  </fieldset>
  <fieldset className="form-group"><legend>Evidence</legend>
   {p.doc.sources.length?<div className="metric-sources" role="group" aria-label="Component sources">{p.doc.sources.map(s=><label key={s.id} className="check"><input type="checkbox" name="sourceIds" value={s.id} defaultChecked={n.sourceIds.includes(s.id)}/>{s.title}</label>)}</div>:<p className="micro">No project sources yet. Add them in the project details (deselect the component).</p>}
  </fieldset>
  <fieldset className="form-group"><legend>Publication</legend>
   <label>Visibility<select name="visibility" defaultValue={n.visibility}><option value="public">Public</option><option value="private">Private · excluded from public exports</option></select></label>
  </fieldset>
  <Button appearance="primary" type="submit">Apply component</Button>
 </form>
 <div className="toolbar vertical-space"><Button onClick={p.onChild} disabled={!!n.childViewId}>+ Create subdiagram</Button><Button appearance="subtle" onClick={p.onDelete}>Delete component</Button></div><hr/>
 <h3>Add evidence</h3>
 <label className="property-form">Block type<select aria-label="Block type" value={type} onChange={e=>setType(e.target.value)}><option value="text">Explanation</option><option value="code">Code snippet</option><option value="table">Example table</option><option value="metrics">Metrics (KPI cards)</option><option value="transformation">Transformation explainer (input → logic → output)</option></select></label>
 {type==='metrics'?<MetricsEditor sources={p.doc.sources} newId={()=>newId('metrics')} submitLabel="Attach metrics" onSubmit={b=>p.onBlock(b)} onError={p.onError}/>
 :type==='table'?<TableEditor sources={p.doc.sources} newId={()=>newId('table')} submitLabel="Attach table" onSubmit={b=>p.onBlock(b)} onError={p.onError}/>
 :type==='transformation'?<form className="property-form" aria-label="Transformation explainer" onSubmit={e=>{e.preventDefault();try{p.onBlocks(transformationTemplate(transformName,newId));setTransformName('');}catch(error){p.onError(errorMessage(error));}}}><label>Transformation name<input aria-label="Transformation name" required maxLength={100} value={transformName} onChange={e=>setTransformName(e.target.value)} placeholder="e.g. Deduplicate orders"/></label><p className="micro">Adds five linked blocks you then edit visually: input rows, logic (displayed, never run), output rows, column mapping, and grain/keys/quality rules. Example rows start as synthetic.</p><Button type="submit">Add transformation explainer</Button></form>
 :<form className="property-form" onSubmit={e=>{e.preventDefault();try{const f=new FormData(e.currentTarget),title=String(f.get('title')),body=String(f.get('body')??''),common={id:newId('block'),title,provenance:'author'};const value=type==='code'?{...common,type:'code',language:String(f.get('language')),code:body}:{...common,type:'text',text:body};p.onBlock(blockSchema.parse(value));e.currentTarget.reset();}catch(error){p.onError(errorMessage(error));}}}><label>Title<input name="title" aria-label="Evidence title" required maxLength={160}/></label>{type==='code'&&<label>Language<select name="language">{['sql','python','dax','json','text'].map(v=><option key={v}>{v}</option>)}</select></label>}<label>Content<textarea name="body" aria-label="Evidence content" rows={6} maxLength={50000} required placeholder="Explain what happens, why, and what the output means."/></label><Button type="submit">Attach evidence</Button></form>}
 <label>Image provenance<select value={imageProvenance} onChange={e=>setImageProvenance(e.target.value as EvidenceBlock['provenance'])}><option value="author">Author-created / supplied</option><option value="synthetic">Synthetic / AI-generated</option><option value="source-derived">Source-derived</option><option value="reference">Reference</option></select></label>
 <label className="file-button">+ PNG / JPEG / WebP / SVG image<input aria-label="Attach image" type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const asset=await imageAsset(file);p.onImage(asset,blockSchema.parse({id:newId('image'),title:file.name.slice(0,160),type:'image',assetId:asset.id,caption:imageProvenance==='synthetic'?'AI-generated / synthetic visual':'User-supplied image',provenance:imageProvenance}));}catch(error){p.onError(errorMessage(error));}e.target.value='';}}/></label>
 <p className="micro">Imports up to 8 MiB are sanitized/rasterized and normalized for the project cache. Mark AI-created visuals as synthetic. Original icon artwork must not be distorted.</p>
 {attached.length>0&&<h3>Edit attached blocks</h3>}
 {attached.length>1&&<p className="micro">Order here is the reading order in the evidence panel, exports and decks.</p>}
 {attached.map((b,i)=><details key={`${b.id}-${p.doc.revision}`} className="block-editor"><summary>{b.title}{b.transform&&<span className="muted"> · {TRANSFORM_LABEL[b.transform]}</span>}</summary>
  {b.type==='metrics'?<MetricsEditor block={b} sources={p.doc.sources} newId={()=>b.id} submitLabel="Apply metrics" onSubmit={u=>p.onBlock(u,b.id)} onError={p.onError}/>
  :b.type==='table'?<TableEditor block={b} sources={p.doc.sources} newId={()=>b.id} submitLabel="Apply table" onSubmit={u=>p.onBlock(u,b.id)} onError={p.onError}/>
  :<ContentEditor block={b} sources={p.doc.sources} submitLabel="Apply block" onSubmit={u=>p.onBlock(u,b.id)} onError={p.onError}/>}
  <details className="json-fallback"><summary>Edit as JSON</summary>{blockJson(b)}</details>
  <div className="toolbar"><Button size="small" appearance="subtle" aria-label={`Move ${b.title} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</Button><Button size="small" appearance="subtle" aria-label={`Move ${b.title} down`} disabled={i===attached.length-1} onClick={()=>move(i,1)}>↓</Button><Button size="small" onClick={()=>p.onDetach(b.id)}>Detach</Button></div>
 </details>)}
 </>}</div>;
 function blockJson(b:EvidenceBlock){return <form onSubmit={e=>{e.preventDefault();try{const raw=new FormData(e.currentTarget).get('block');const updated=blockSchema.parse(JSON.parse(String(raw)));if(updated.id!==b.id)throw new Error('Keep the stable block ID unchanged');p.onBlock(updated,b.id);}catch(error){p.onError(errorMessage(error));}}}><textarea name="block" aria-label={`Edit block ${b.title}`} rows={9} defaultValue={JSON.stringify(b,null,2)} maxLength={60000}/><div className="toolbar"><Button size="small" type="submit">Apply JSON</Button></div></form>;}
}
export function EdgeInspector({edge,onUpdate,onDelete}:{edge:ProjectEdge;onUpdate:(edge:ProjectEdge)=>void;onDelete:()=>void}){return <section className="inspector"><div className="eyebrow">CONNECTION EDITOR</div><h2>{edge.label||'Connection'}</h2><p className="micro">{edge.source} → {edge.target}</p><form className="property-form" key={edge.id} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);onUpdate({...edge,label:String(f.get('label')),kind:String(f.get('kind')) as ProjectEdge['kind'],speed:String(f.get('speed')) as ProjectEdge['speed'],visibility:String(f.get('visibility')) as ProjectEdge['visibility']});}}><label>Label<input name="label" defaultValue={edge.label} maxLength={160}/></label><label>Flow type<select name="kind" defaultValue={edge.kind}>{['batch','stream','query','control','dependency'].map(v=><option key={v}>{v}</option>)}</select></label><label>Illustrative speed<select name="speed" defaultValue={edge.speed}>{['slow','medium','fast'].map(v=><option key={v}>{v}</option>)}</select></label><label>Visibility<select name="visibility" defaultValue={edge.visibility}><option>public</option><option>private</option></select></label><Button appearance="primary" type="submit">Apply connection</Button><Button onClick={onDelete}>Delete connection</Button></form><p className="muted">Speed is an authored visual cue. It does not measure, benchmark or compare engines.</p></section>;}
