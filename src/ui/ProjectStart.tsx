import {useState} from 'react';
import {DEFAULT_OPTIONS, PURPOSES, type AnalysisOptions} from '../intelligence/types';
import './project-intelligence.css';
import {validateGraphSnapshot,type GraphSnapshot} from '../intelligence/graphSnapshot';
import {LargeGraphPreview} from './LargeGraphPreview';

export type AnalysisSource = 'repository' | 'guided' | 'hybrid' | 'graph';
export type ProjectStartProps = {
  onRepository: (files: FileList, options: AnalysisOptions) => void | Promise<void>;
  onBrief: (raw: string, options: AnalysisOptions, source: 'guided' | 'hybrid') => void | Promise<void>;
  onGraph: (raw: string, options: AnalysisOptions) => void | Promise<void>;
  onClose?: () => void; busy?: boolean; error?: string;
};
export function ProjectStart({onRepository, onBrief, onGraph, onClose, busy, error}: ProjectStartProps) {
  const [source, setSource] = useState<AnalysisSource>('repository');
  const [options, setOptions] = useState<AnalysisOptions>({...DEFAULT_OPTIONS});
  const [raw, setRaw] = useState(''), [title, setTitle] = useState(''), [summary, setSummary] = useState('');
  const [explicitId, setExplicitId] = useState<string>();
  const [steps, setSteps] = useState(''), [localError, setLocalError] = useState('');
  const [large,setLarge]=useState<GraphSnapshot>();
  const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const projectId = explicitId ?? (slug ? (/^[a-z]/.test(slug) ? slug : `project-${slug}`).slice(0, 40).replace(/-+$/g, '') : '');
  const validId = /^[a-z][a-z0-9-]{0,39}$/.test(projectId);
  const submit = () => {
    const input = raw.trim() || JSON.stringify({format: 'diagramcloud.project-brief', version: 1,
      project: {id: projectId, title: title.trim(), summary},
      scope: steps.split('\n').map(s => s.trim()).filter(Boolean).map((label, i) => ({id: `step-${i + 1}`, title: label, kind: 'workstream'}))});
    if(source === 'graph'){try{const g=validateGraphSnapshot(JSON.parse(input));if(g.nodes.length>470||g.assertions.length>1250||g.source_refs.length>190)setLarge(g);else void onGraph(input,options);}catch(e){setLocalError(e instanceof Error?e.message:String(e));}}
    else void onBrief(input, options, source === 'hybrid' ? 'hybrid' : 'guided');
  };
  return <section className="project-start" aria-label="New analysis" data-testid="project-start">
    <div className="pi-heading"><div><span className="pi-eyebrow">Local project intelligence</span><h2>New analysis</h2></div>{onClose && <button type="button" onClick={onClose}>Close</button>}</div>
    <p>Choose a selected folder or describe your project. Review the candidate before applying it.</p>
    <fieldset disabled={busy}><legend>Source</legend><div className="pi-options">{(['repository', 'guided', 'hybrid', 'graph'] as const).map(value => <label key={value} className={source === value ? 'pi-choice selected' : 'pi-choice'}><input type="radio" name="analysis-source" value={value} checked={source === value} onChange={() => {setSource(value);setLarge(undefined);setLocalError('');}}/><strong>{value[0].toUpperCase() + value.slice(1)}</strong><small>{value === 'repository' ? 'Inspect one selected folder' : value === 'guided' ? 'Describe a project without Git' : value === 'hybrid' ? 'Declare repositories and their bindings' : 'Open a private GraphSnapshot file'}</small></label>)}</div></fieldset>
    <div className="pi-controls"><label>Purpose <select aria-label="Analysis purpose" disabled={busy} value={options.purpose} onChange={e => setOptions({...options, purpose: e.target.value as AnalysisOptions['purpose']})}>{PURPOSES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></label><label>Depth <select aria-label="Analysis depth" disabled={busy} value={options.depth} onChange={e => setOptions({...options, depth: e.target.value as AnalysisOptions['depth']})}><option value="quick">Quick</option><option value="standard">Standard</option></select></label></div>
    <p className="micro">Quick uses a smaller file and text budget; Standard inspects more selected detail. No repository code is executed.</p>
    {source === 'repository' ? <label className="pi-file">Select repository folder<input aria-label="Analysis repository folder" type="file" multiple {...{webkitdirectory: '', directory: ''}} disabled={busy} onChange={e => {if(e.target.files) void onRepository(e.target.files, options); e.target.value = '';}}/></label> : <>
      <label>{source === 'graph' ? 'GraphSnapshot (datapass.graph/1) JSON' : source === 'hybrid' ? 'ProjectBrief or project manifest JSON' : 'ProjectBrief JSON'}<textarea aria-label={source === 'graph' ? 'GraphSnapshot JSON' : 'Project brief JSON'} value={raw} onChange={e => {setRaw(e.target.value);setLarge(undefined);setLocalError('');}} rows={7} placeholder={source === 'graph' ? '{"schema":"datapass.graph/1",…}' : '{"format":"diagramcloud.project-brief","version":1,…}'}/></label>
      <label className="pi-file">Import selected JSON file<input aria-label={source === 'graph' ? 'GraphSnapshot file' : 'Project brief file'} type="file" accept=".json,application/json" disabled={busy} onChange={async e => {const file = e.target.files?.[0]; if(!file) return; if(file.size > (source === 'graph' ? 4 * 1024 * 1024 : 512 * 1024)) {setLocalError('Selected JSON exceeds the supported input budget'); return;} setRaw(await file.text()); setLarge(undefined);setLocalError('');}}/></label>
      {source === 'guided' && <details open={!raw}><summary>Or enter a small project</summary><div className="pi-form"><label>Project title<input aria-label="Guided project title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160}/></label><label>Project ID<input aria-label="Guided project ID" aria-describedby="guided-id-help" aria-invalid={projectId.length > 0 && !validId} value={projectId} onChange={e => setExplicitId(e.target.value)} maxLength={40} pattern="[a-z][a-z0-9-]{0,39}"/></label><p className="micro" id="guided-id-help">Stable identity: a lowercase letter followed by letters, digits or hyphens, at most 40 characters. Keep an existing project's ID when updating its brief.</p><label>Purpose and scope<textarea aria-label="Guided project summary" value={summary} onChange={e => setSummary(e.target.value)} maxLength={3000}/></label><label>Workstreams / steps (one per line)<textarea aria-label="Guided project steps" value={steps} onChange={e => setSteps(e.target.value)} rows={4}/></label></div></details>}
      {source === 'hybrid' && <p className="micro">Membership and cross-repository relations must be explicit. Each repository keeps its own revision; unavailable members remain unscanned.</p>}
      {source === 'graph' && <p className="micro">Selected GraphSnapshot stays private, inert and offline. Validate and review it before applying. No local file path or permission is automatically opened.</p>}
      <button type="button" disabled={busy || (!raw.trim() && (source !== 'guided' || !title.trim() || !validId))} onClick={submit}>{source === 'graph' ? 'Preview GraphSnapshot' : 'Preview project'}</button>
    </>}
    {source==='graph'&&large&&<LargeGraphPreview key={large.generation_id} snapshot={large} onSelect={g=>void onGraph(JSON.stringify(g),options)}/>}
    <details><summary>Advanced · manual assistance</summary><p>Analysis works without a model. After opening a project, Copy context in Evidence and import a reviewed proposal through JSON / AI.</p></details>
    {busy && <p role="status">Preparing bounded analysis…</p>}{(error || localError) && <p role="alert">{error || localError}</p>}
  </section>;
}
