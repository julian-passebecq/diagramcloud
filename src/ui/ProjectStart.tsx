import {validateGraphWorker} from '../intelligence/workerClient';
import {useState,useEffect,useRef} from 'react';
import {DEFAULT_OPTIONS, PURPOSES, type AnalysisOptions} from '../intelligence/types';
import './project-intelligence.css';
import {type GraphSnapshot} from '../intelligence/graphSnapshot';
import {LargeGraphPreview} from './LargeGraphPreview';
import {instantiateWorkflowTemplate,privateWorkflowTemplates} from '../intelligence/workflowTemplates';

export type AnalysisSource = 'repository' | 'guided' | 'hybrid' | 'graph';
export type ProjectStartProps = {
  onRepository: (files: FileList, options: AnalysisOptions) => void | Promise<void>;
  onBrief: (raw: string, options: AnalysisOptions, source: 'guided' | 'hybrid', sourceText?: string) => void | Promise<void>;
  onGraph: (raw: string, options: AnalysisOptions) => void | Promise<void>;
  onClose?: () => void; busy?: boolean; error?: string;initialSource?:AnalysisSource;initialOptions?:AnalysisOptions;onSource?:(source:AnalysisSource)=>void;onOptions?:(options:AnalysisOptions)=>void;
};
export function ProjectStart({onRepository, onBrief, onGraph, onClose, busy, error,initialSource='repository',initialOptions=DEFAULT_OPTIONS,onSource,onOptions}: ProjectStartProps) {
  const [preparing,setPreparing]=useState(false),[reading,setReading]=useState(false);const validation=useRef<AbortController>();
 const mounted=useRef(true),readGeneration=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;readGeneration.current++;validation.current?.abort();};},[]);
 const cancel=()=>{readGeneration.current++;setReading(false);validation.current?.abort();setPreparing(false);setLocalError('Validation cancelled; no import applied.');};
 const [source, setSource] = useState<AnalysisSource>(initialSource);
  const [options, setOptions] = useState<AnalysisOptions>({...initialOptions});
  const [raw, setRaw] = useState(''), [title, setTitle] = useState(''), [summary, setSummary] = useState('');
  const [explicitId, setExplicitId] = useState<string>();
  const [steps, setSteps] = useState(''), [localError, setLocalError] = useState('');
  const [previousDraft,setPreviousDraft]=useState<string>(),[templateNotice,setTemplateNotice]=useState('');
  const readContext=useRef({source,raw});readContext.current={source,raw};
  const [large,setLarge]=useState<GraphSnapshot>();
  const invalidateSelectedRead=()=>{readGeneration.current++;setReading(false);};
  const replaceRaw=(text:string)=>{invalidateSelectedRead();validation.current?.abort();setPreparing(false);setRaw(text);setLarge(undefined);setLocalError('');setTemplateNotice('');};
  const loadTemplate=()=>{try{const brief=instantiateWorkflowTemplate('01-petit-client');setPreviousDraft(raw.length||title||summary||steps||explicitId?raw:undefined);replaceRaw(JSON.stringify(brief,null,2));setTemplateNotice('Private template loaded into the ProjectBrief editor with a new local instance ID. Preview and Apply remain separate choices.');}catch{setLocalError('Private template could not be loaded. Your current draft is unchanged.');}};
  const restoreDraft=()=>{if(previousDraft===undefined)return;replaceRaw(previousDraft);setPreviousDraft(undefined);setTemplateNotice('Previous draft restored. No project was changed.');};
  const readFile=async(file:File|undefined)=>{if(!file)return;const attempt=++readGeneration.current,started={source,raw},active=()=>mounted.current&&attempt===readGeneration.current&&readContext.current.source===started.source&&readContext.current.raw===started.raw;
   const limit=source==='graph'?4*1024*1024:512*1024;setReading(true);setLocalError('');try{if(file.size>limit)throw new Error('budget');const text=await file.text();if(!active())return;if(new TextEncoder().encode(text).byteLength>limit)throw new Error('budget');setRaw(text);setLarge(undefined);setTemplateNotice('');}catch(error){if(active())setLocalError(error instanceof Error&&error.message==='budget'?'Selected JSON exceeds the supported input budget':'Selected JSON file could not be read. Your current draft is unchanged.');}finally{if(mounted.current&&attempt===readGeneration.current)setReading(false);}};
  const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const projectId = explicitId ?? (slug ? (/^[a-z]/.test(slug) ? slug : `project-${slug}`).slice(0, 40).replace(/-+$/g, '') : '');
  const validId = /^[a-z][a-z0-9-]{0,39}$/.test(projectId);
  const submit = async () => {
    if(busy||preparing||reading)return;
    const input = raw.trim() || JSON.stringify({format: 'diagramcloud.project-brief', version: 1,
      project: {id: projectId, title: title.trim(), summary},
      scope: steps.split('\n').map(s => s.trim()).filter(Boolean).map((label, i) => ({id: `step-${i + 1}`, title: label, kind: 'workstream'}))});
    if(source === 'graph'){validation.current?.abort();const controller=new AbortController();validation.current=controller;setPreparing(true);setLocalError('');try{const g=await validateGraphWorker(input,controller.signal);if(controller.signal.aborted)return;if(g.nodes.length>470||g.assertions.length>1250||g.source_refs.length>190)setLarge(g);else await onGraph(input,options);}catch(e){if(!controller.signal.aborted)setLocalError(e instanceof Error?e.message:String(e));}finally{if(validation.current===controller)setPreparing(false);}}
    // Keep the parser's existing normalization separate from the exact decoded source used for provenance.
    else void onBrief(input, options, source === 'hybrid' ? 'hybrid' : 'guided', raw.trim() ? raw : input);
  };
  return <section className="project-start" aria-label="New analysis" data-testid="project-start">
    <div className="pi-heading"><div><span className="pi-eyebrow">Local project intelligence</span><h2>New analysis</h2></div>{onClose && <button type="button" onClick={onClose}>Close</button>}</div>
    <p>Choose a selected folder or describe your project. Review the candidate before applying it.</p>
    <fieldset disabled={busy||preparing}><legend>Source</legend><div className="pi-options">{(['repository', 'guided', 'hybrid', 'graph'] as const).map(value => <label key={value} className={source === value ? 'pi-choice selected' : 'pi-choice'}><input type="radio" name="analysis-source" value={value} checked={source === value} onChange={() => {readGeneration.current++;setReading(false);validation.current?.abort();setPreparing(false);setSource(value);onSource?.(value);setLarge(undefined);setLocalError('');setTemplateNotice('');}}/><strong>{value==='repository'?'Repository · Auto':value[0].toUpperCase() + value.slice(1)}</strong><small>{value === 'repository' ? 'Inspect one selected folder' : value === 'guided' ? 'Describe a project without Git' : value === 'hybrid' ? 'Declare repositories and their bindings' : 'Open a private GraphSnapshot file'}</small></label>)}</div></fieldset>
    <div className="pi-controls"><label>Purpose <select aria-label="Analysis purpose" disabled={busy||preparing} value={options.purpose} onChange={e => (()=>{const next={...options,purpose:e.target.value as AnalysisOptions['purpose']};setOptions(next);onOptions?.(next);})()}>{PURPOSES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></label><label>Depth <select aria-label="Analysis depth" disabled={busy||preparing} value={options.depth} onChange={e => (()=>{const next={...options,depth:e.target.value as AnalysisOptions['depth']};setOptions(next);onOptions?.(next);})()}><option value="quick">Quick</option><option value="standard">Standard</option></select></label></div>
    <p className="micro">Quick uses a smaller file and text budget; Standard inspects more selected detail. No repository code is executed.</p>
    {source === 'repository' ? <label className="pi-file">Select repository folder<input aria-label="Analysis repository folder" type="file" multiple {...{webkitdirectory: '', directory: ''}} disabled={busy||preparing} onChange={e => {if(e.target.files) void onRepository(e.target.files, options); e.target.value = '';}}/></label> : <>
      <label>{source === 'graph' ? 'GraphSnapshot (datapass.graph/1) JSON' : source === 'hybrid' ? 'ProjectBrief or project manifest JSON' : 'ProjectBrief JSON'}<textarea aria-label={source === 'graph' ? 'GraphSnapshot JSON' : 'Project brief JSON'} value={raw} readOnly={busy} onChange={e => replaceRaw(e.target.value)} rows={7} placeholder={source === 'graph' ? '{"schema":"datapass.graph/1",…}' : '{"format":"diagramcloud.project-brief","version":1,…}'}/></label>
      <label className="pi-file">Import selected JSON file<input aria-label={source === 'graph' ? 'GraphSnapshot file' : 'Project brief file'} type="file" accept=".json,application/json" disabled={busy||preparing} onChange={e => {const file=e.target.files?.[0];e.target.value='';void readFile(file);}}/></label>
      {source==='guided'&&<section aria-label="Private workflow templates"><h3>Private workflow template catalogue</h3>{privateWorkflowTemplates.map(template=><article key={template.id}><h4>{template.title}</h4><p>{template.labels.join(' · ')}</p><p>{template.problem}</p><p><b>Declared inputs:</b> {template.inputs.join(' ')}</p><p><b>Declared outputs:</b> {template.outputs.join(' ')}</p><p><b>Constraints:</b> {template.constraints.join(' ')}</p><p>Three supplied unknowns:</p><ul>{template.unknowns.map(question=><li key={question}>{question}</li>)}</ul><p className="micro" style={{overflowWrap:'anywhere'}}>Reference: {template.source.archive}/{template.source.entry} · original project {template.source.sourceProjectId} · SHA-256 {template.source.entrySha256}.</p></article>)}<p>Loading replaces only this editor's ProjectBrief draft. The current project stays unchanged. A previous JSON or small-project draft can be restored during this session.</p><div className="pi-controls"><button type="button" disabled={busy||preparing} onClick={loadTemplate}>Load private workflow template</button>{previousDraft!==undefined&&<button type="button" disabled={busy||preparing} onClick={restoreDraft}>Restore previous draft</button>}</div>{templateNotice&&<p role="status">{templateNotice}</p>}</section>}
      {source === 'guided' && <details open={!raw}><summary>Or enter a small project</summary><div className="pi-form"><label>Project title<input aria-label="Guided project title" value={title} onChange={e => {invalidateSelectedRead();setTitle(e.target.value);}} maxLength={160}/></label><label>Project ID<input aria-label="Guided project ID" aria-describedby="guided-id-help" aria-invalid={projectId.length > 0 && !validId} value={projectId} onChange={e => {invalidateSelectedRead();setExplicitId(e.target.value);}} maxLength={40} pattern="[a-z][a-z0-9-]{0,39}"/></label><p className="micro" id="guided-id-help">Stable identity: a lowercase letter followed by letters, digits or hyphens, at most 40 characters. Keep an existing project's ID when updating its brief.</p><label>Purpose and scope<textarea aria-label="Guided project summary" value={summary} onChange={e => {invalidateSelectedRead();setSummary(e.target.value);}} maxLength={3000}/></label><label>Workstreams / steps (one per line)<textarea aria-label="Guided project steps" value={steps} onChange={e => {invalidateSelectedRead();setSteps(e.target.value);}} rows={4}/></label></div></details>}
      {source === 'hybrid' && <p className="micro">Membership and cross-repository relations must be explicit. Each repository keeps its own revision; unavailable members remain unscanned.</p>}
      {source === 'graph' && <p className="micro">Selected GraphSnapshot stays private, inert and offline. Validate and review it before applying. No local file path or permission is automatically opened.</p>}
      <button type="button" disabled={busy||preparing||reading || (!raw.trim() && (source !== 'guided' || !title.trim() || !validId))} onClick={submit}>{source === 'graph' ? 'Preview GraphSnapshot' : 'Preview project'}</button>
    </>}
    {source==='graph'&&large&&<LargeGraphPreview key={large.generation_id} snapshot={large} onSelect={g=>void onGraph(JSON.stringify(g),options)}/>}
    <details><summary>Advanced · manual assistance</summary><p>Analysis works without a model. After opening a project, Copy context in Evidence and import a reviewed proposal through JSON / AI.</p></details>
    {reading&&<p role="status">Reading selected JSON file…</p>}{(busy||preparing) && <p role="status">Preparing bounded analysis…</p>}{preparing&&<button onClick={cancel}>Cancel graph validation</button>}{(error || localError) && <p role="alert">{error || localError}</p>}
  </section>;
}
