import {useEffect,useRef,useState} from 'react';
import {blankUsageDraft,blankUsageRecord,calculateUsageDraft,USAGE_RECORD_LIMIT,USAGE_ALLOCATION_LIMIT,type UsageDraft,type UsageRecordDraft,type UsageDraftResult} from './usageEconomicsDraft';
import {readUsageFile,serializeUsageFile,nextUsageDraftKey,USAGE_FILE_REFUSAL} from './usageEconomicsFiles';
import {download} from '../export/browser';
/** Author-only, keyed by host project/revision. No Project, storage, provider or network access. */
export function UsageEconomicsPanel(){
 const [draft,setDraft]=useState(blankUsageDraft),[result,setResult]=useState<UsageDraftResult|null>(null),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const nextKey=useRef(1),calculateButton=useRef<HTMLButtonElement>(null),loadInput=useRef<HTMLInputElement>(null),reviewHeading=useRef<HTMLHeadingElement>(null),generation=useRef(0);
 const [pending,setPending]=useState<UsageDraft|null>(null),[fileError,setFileError]=useState(''),[reading,setReading]=useState(false);
 useEffect(()=>()=>{generation.current++;},[]);
 useEffect(()=>{if(pending)reviewHeading.current?.focus();},[pending]);
 const invalidate=()=>{generation.current++;setPending(null);setReading(false);setFileError('');};
 const load=async(input:HTMLInputElement)=>{const file=input.files?.[0];input.value='';invalidate();const issued=generation.current;if(!file)return;setReading(true);
  try{const loaded=await readUsageFile(file);if(issued!==generation.current)return;setPending(loaded);}catch{if(issued===generation.current)setFileError(USAGE_FILE_REFUSAL);}finally{if(issued===generation.current)setReading(false);}
 };
 const usePending=()=>{if(!pending)return;nextKey.current=nextUsageDraftKey(pending);calculateButton.current?.focus();update(pending);};
 const exportInputs=()=>{try{download(serializeUsageFile(draft),'supplied-usage.private.json','application/json');setFileError('');}catch(e){setFileError(e instanceof Error?e.message:'Usage download could not start. Current inputs and results are unchanged.');}};
 const update=(next:UsageDraft)=>{invalidate();setDraft(next);setResult(null);setError('');};
 const edit=(key:number,next:Partial<UsageRecordDraft>)=>update({...draft,records:draft.records.map(r=>r.key===key?{...r,...next}:r)});
 const inputStyle={display:'block',width:'100%',maxWidth:500,minWidth:0} as const;
 const field=(label:string,value:string,change:(v:string)=>void,max=200,numeric=false)=><label style={{display:'block',margin:'6px 0'}}>{label}<input type="text" aria-label={label} inputMode={numeric?'decimal':'text'} maxLength={max} value={value} onChange={e=>change(e.target.value)} style={inputStyle}/></label>;
 const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(190px,100%),1fr))',gap:10,minWidth:0} as const;
 const calculate=()=>{invalidate();try{setResult(calculateUsageDraft(draft));setError('');}catch(e){setResult(null);setError(e instanceof Error?e.message:'Invalid supplied usage.');}};
 return <details className="usage-economics" style={{marginTop:12}} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Supplied usage and cost</summary>{open&&<section aria-label="Supplied usage and cost">
  <p>Summarize explicit leaf-call records in one declared UTC window. No provider is contacted, no rate is fetched, and no cost, token forecast, completion date or bill is inferred.</p>
  <p>These private drafts and results stay in this session, outside Project saves, Undo and public exports. A private input download is available below. Changing project/revision or entering a public audience clears them.</p>
  <div role="group" aria-label="Usage files"><label>Load usage file<input ref={loadInput} type="file" accept=".json,application/json" aria-label="Load usage file" onChange={e=>void load(e.currentTarget)}/></label><button type="button" onClick={exportInputs}>Download validated usage inputs</button>
   <p>Choose a private usage input file (up to 256 KiB). Review it before replacing this form. A download contains supplied inputs and citations, not verified usage or a bill.</p>
   {reading&&<p role="status">Reading selected usage file…</p>}{fileError&&<p role="alert">{fileError}</p>}
   {pending&&<section aria-label="Review usage file"><h3 ref={reviewHeading} tabIndex={-1}>Review supplied usage inputs</h3><p>{pending.records.length} supplied rows · {pending.windowStart} → {pending.windowEnd}</p><p>Basis: {pending.basis}</p><p>Using these records replaces the current form and clears its calculation. No Project or saved data changes.</p>
    <details><summary>Inspect all supplied fields and citations</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:300,overflow:'auto'}}>{serializeUsageFile(pending)}</pre></details>
    <button type="button" onClick={usePending}>Use these records</button><button type="button" onClick={()=>{loadInput.current?.focus();invalidate();}}>Keep current inputs</button>
   </section>}
  </div>
  <div role="group" aria-label="Usage assumptions">
   <label>Usage assumption basis<textarea aria-label="Usage assumption basis" maxLength={2000} value={draft.basis} onChange={e=>update({...draft,basis:e.target.value})} rows={3} style={inputStyle}/></label>
   <div style={grid}>{field('Usage window start (UTC)',draft.windowStart,v=>update({...draft,windowStart:v}),30)}{field('Usage window end (UTC)',draft.windowEnd,v=>update({...draft,windowEnd:v}),30)}</div>
   <p>Use UTC timestamps such as 2026-01-01T00:00:00Z. You declare that every supplied call belongs to this one window; its membership is not independently verified. Different windows, scopes and evaluation protocols are not compared here.</p>
   <label>Shown feature IDs (one per line; blank shows all)<textarea aria-label="Shown feature IDs" maxLength={2000} rows={2} value={draft.featureFilter} onChange={e=>update({...draft,featureFilter:e.target.value})} style={inputStyle}/></label>
   <p>A feature filter hides rows only; it never redistributes excluded allocations or changes whole-window totals. Allocation token values are proportional token-equivalents, not additional calls.</p>
   <ol className="project-dock-list">{draft.records.map((row,index)=>{const prefix=`Usage record ${index+1}`;return <li key={row.key}><fieldset style={{minWidth:0}}><legend>{prefix}</legend>
    <div style={grid}>{field(prefix+' authority',row.authority,v=>edit(row.key,{authority:v}))}{field(prefix+' call ID',row.id,v=>edit(row.key,{id:v}))}</div>
    <label>{prefix} source / provenance<textarea aria-label={prefix+' source / provenance'} maxLength={2000} rows={2} value={row.source} onChange={e=>edit(row.key,{source:e.target.value})} style={inputStyle}/></label>
    <p>Use the producer authority and its stable call ID. Identical readbacks count once; conflicting duplicates refuse calculation. Parent/run totals are not leaf calls.</p>
    <div style={grid}>{(['inputTokens','outputTokens','cachedInputTokens','reasoningOutputTokens'] as const).map(key=>field(prefix+' '+({inputTokens:'input tokens',outputTokens:'output tokens',cachedInputTokens:'cached input tokens',reasoningOutputTokens:'reasoning output tokens'}[key]),row[key],v=>edit(row.key,{[key]:v}),100,true))}</div>
    <p>Blank token counts mean unknown; enter 0 explicitly for a supplied zero. Cached input and reasoning output are subsets of their totals and are never added twice.</p>
    <div style={grid}>{field(prefix+' cost amount',row.amount,v=>edit(row.key,{amount:v}),100,true)}{field(prefix+' currency',row.currency,v=>edit(row.key,{currency:v}),3)}<label>{prefix} cost basis<select aria-label={prefix+' cost basis'} value={row.costBasis} onChange={e=>edit(row.key,{costBasis:e.target.value})} style={inputStyle}><option value="">Unknown / not supplied</option><option value="metered">Supplied metered cost</option><option value="estimate">Supplied estimate</option><option value="subscription-allocation">Subscription allocation</option></select></label></div>
    <label>{prefix} cost / rate citation<textarea aria-label={prefix+' cost / rate citation'} maxLength={2000} rows={2} value={row.costSource} onChange={e=>edit(row.key,{costSource:e.target.value})} style={inputStyle}/></label>
    <p>Leave all cost fields blank for unknown cost. For a supplied amount (including 0), provide a three-letter currency, basis and citation explaining the amount or cited rate calculation. Rates are not calculated here; citations are declarations, not verification. Currency and cost basis totals stay separate.</p>
    {row.allocations.map((allocation,i)=><div key={allocation.key} style={grid}>{field(`${prefix} allocation ${i+1} feature ID`,allocation.featureId,v=>edit(row.key,{allocations:row.allocations.map(a=>a.key===allocation.key?{...a,featureId:v}:a)}))}{field(`${prefix} allocation ${i+1} basis points`,allocation.basisPoints,v=>edit(row.key,{allocations:row.allocations.map(a=>a.key===allocation.key?{...a,basisPoints:v}:a)}),100,true)}<button type="button" onClick={()=>{calculateButton.current?.focus();edit(row.key,{allocations:row.allocations.filter(a=>a.key!==allocation.key)});}}>Remove allocation {i+1} from record {index+1}</button></div>)}
    <p>10000 basis points = 100%. Missing allocation remains unattributed; no redistribution is inferred.</p>
    <div className="project-dock-actions"><button type="button" disabled={row.allocations.length>=USAGE_ALLOCATION_LIMIT} onClick={()=>edit(row.key,{allocations:[...row.allocations,{key:nextKey.current++,featureId:'',basisPoints:''}]})}>Add allocation to record {index+1}</button><button type="button" onClick={()=>{calculateButton.current?.focus();update({...draft,records:draft.records.filter(r=>r.key!==row.key)});}}>Remove usage record {index+1}</button></div>
   </fieldset></li>;})}</ol>
   <button type="button" disabled={draft.records.length>=USAGE_RECORD_LIMIT} onClick={()=>update({...draft,records:[...draft.records,blankUsageRecord(nextKey.current++)]})}>Add usage record</button><p>At most {USAGE_RECORD_LIMIT} records and {USAGE_ALLOCATION_LIMIT} allocations per record. Empty input is unknown, not free work.</p>
   <div className="project-dock-actions"><button type="button" ref={calculateButton} onClick={calculate}>Calculate supplied usage</button><button type="button" onClick={()=>update(blankUsageDraft())}>Clear supplied usage</button></div>
  </div>
  {error&&<p role="alert">{error}</p>}{!result&&<p role="status">No current usage calculation. Editing any input clears the previous result.</p>}
  {result&&<section aria-label="Supplied usage result" aria-live="polite"><h3>Totals from supplied records</h3><p>Basis: {result.basis}</p><p>Declared UTC window: {result.windowStart} → {result.windowEnd}</p><p>{result.totals.calls} distinct leaf calls from {result.submittedRows} supplied rows. No call is inferred.</p>
   <ul><li>Known input tokens: {String(result.totals.inputTokens)} · Unknown input calls: {result.totals.unknownInputCalls}</li><li>Known output tokens: {String(result.totals.outputTokens)} · Unknown output calls: {result.totals.unknownOutputCalls}</li><li>Known cached input subset: {String(result.totals.cachedInputTokens)} · Unknown cached counts: {result.unknownCachedCalls}</li><li>Known reasoning output subset: {String(result.totals.reasoningOutputTokens)} · Unknown reasoning counts: {result.unknownReasoningCalls}</li><li>Unknown-cost calls: {result.totals.unknownCostCalls} · Partly/wholly unattributed calls: {result.totals.unattributedCalls}</li></ul>
   <h4>Known costs by currency and basis</h4>{!result.totals.costs.length?<p>No known costs supplied. This does not mean zero cost.</p>:<ul>{result.totals.costs.map(c=><li key={c.currency+c.basis}>{c.currency} · {c.basis}: known total {String(c.knownTotal)} · allocated {String(c.allocated)} · unattributed {String(c.unattributed)}</li>)}</ul>}
   <p>Known subtotals exclude unknown values. They are not a complete bill, a rate lookup, a saving, or a comparison across windows.</p>
   <h4>Feature allocations {result.selectedFeatures?'(filtered)':''}</h4>{!result.totals.features.length?<p>No matching allocated features.</p>:<ul>{result.totals.features.map(f=><li key={f.featureId}><strong>{f.featureId}</strong><p>Input token-equivalents {String(f.inputTokens)} · output token-equivalents {String(f.outputTokens)} · unknown input calls {f.unknownInputCalls} · unknown output calls {f.unknownOutputCalls} · unknown-cost calls {f.unknownCostCalls}</p>{f.costs.map(c=><p key={c.currency+c.basis}>{c.currency} · {c.basis}: {String(c.amount)}</p>)}</li>)}</ul>}
   <details><summary>Supplied provenance and cost citations</summary><ul>{result.provenance.map(p=><li key={JSON.stringify([p.authority,p.id])}><strong>{p.authority} / {p.id}</strong><p>{p.source}</p><p>Cost/rate citation: {p.costSource??'Unknown cost; no citation supplied.'}</p></li>)}</ul></details>
  </section>}
 </section>}</details>;
}
