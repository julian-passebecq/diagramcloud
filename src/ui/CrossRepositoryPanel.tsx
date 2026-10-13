import {useMemo,useRef,useState} from 'react';
import type {Project} from '../core/model';
import type {Patch} from '../core/patch';
import {crossRepositoryCandidates,crossRepositoryPatch,repositoryAnalysisSchema,retainedRepositoryAnalyses,type RepositoryAnalysis} from '../intelligence/crossRepository';
import {download} from '../export/browser';
export function CrossRepositoryPanel({project,onPatch}:{project:Project;onPatch?:(patch:Patch)=>void}){
 const retained=useMemo(()=>retainedRepositoryAnalyses(project),[project]),[selected,setSelected]=useState<RepositoryAnalysis[]>([]),[ids,setIds]=useState<string[]>([]),[error,setError]=useState(''),generation=useRef(0);
 const reports=useMemo(()=>[...retained.filter(r=>!selected.some(s=>s.repositoryId===r.repositoryId)),...selected],[retained,selected]);
 const result=useMemo(()=>{try{return crossRepositoryCandidates(project,reports);}catch{return undefined;}},[project,reports]);
 const read=async(files:FileList|null)=>{const token=++generation.current;setIds([]);setError('');if(!files?.length)return;
  try{if(files.length>30)throw new Error('Select at most 30 repository analysis JSON files');const parsed:RepositoryAnalysis[]=[];
   for(const file of [...files]){if(file.size>1024*1024)throw new Error('Repository analysis exceeds 1 MiB');parsed.push(repositoryAnalysisSchema.parse(JSON.parse(await file.text())));}
   crossRepositoryCandidates(project,parsed);if(token===generation.current)setSelected(parsed);
  }catch(e){if(token===generation.current){setSelected([]);setError(e instanceof Error?e.message:String(e));}}
 };
 const emit=()=>{setError('');try{const patch=crossRepositoryPatch(project,reports,ids);if(onPatch)onPatch(patch);else download(JSON.stringify(patch,null,2),project.id+'.cross-repository.patch.json','application/json');}catch(e){setError(e instanceof Error?e.message:String(e));}};
 if(!project.atlas)return null;
 return <details aria-label="Cross-repository contract candidates"><summary>Cross-repository contract candidates</summary><p>Explicit atlas members at their own revisions. Exact producer and consumer identities and versions suggest static relationships for review. Shared names or technologies never produce a join. Package publication, runtime traffic and installation remain unknown.</p><label>Repository analysis JSON<input aria-label="Repository analysis JSON" type="file" accept=".json,application/json" multiple onChange={e=>{void read(e.target.files);e.target.value='';}}/></label><p>{retained.length} retained repository receipts; {selected.length} selected files. A selected file replaces that repository’s transient receipt for this review.</p>{error&&<p role="alert">{error}</p>}{result&&<><ul>{result.candidates.map(c=><li key={c.id}><label><input type="checkbox" checked={ids.includes(c.id)} onChange={e=>setIds(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/>{c.producerRepositoryId} → {c.consumerRepositoryId}: {c.identity}@{c.version}</label><p>{c.reason}</p><ul>{c.evidence.map(ref=><li key={ref.role}>{ref.role}: {ref.repositoryId}@{ref.revision} · {ref.path}:{ref.line}</li>)}</ul></li>)}</ul>{!result.candidates.length&&<p>No unambiguous exact source declarations are joined in this selection.</p>}<button disabled={!ids.length} onClick={emit}>Review selected contract relationships</button><ul aria-label="Unresolved contract joins">{result.unresolved.map((r,i)=><li key={i}>{r.repositoryId} · {r.identity}@{r.version}: {r.reason}</li>)}</ul>{!!(result.omitted.candidates||result.omitted.unresolved)&&<p>Display budget: {result.omitted.candidates} candidates and {result.omitted.unresolved} unresolved records omitted. Select fewer repositories.</p>}</>}</details>;
}
