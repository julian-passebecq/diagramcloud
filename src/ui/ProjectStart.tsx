import {useState} from 'react';
import {DEFAULT_OPTIONS, PURPOSES, type AnalysisOptions} from '../intelligence/types';
import './project-intelligence.css';

export type AnalysisSource = 'repository' | 'guided' | 'hybrid';
export type ProjectStartProps = {
  onRepository: (files: FileList, options: AnalysisOptions) => void | Promise<void>;
  onBrief: (raw: string, options: AnalysisOptions, source: 'guided' | 'hybrid') => void | Promise<void>;
  onClose?: () => void; busy?: boolean; error?: string;
};
export function ProjectStart({onRepository, onBrief, onClose, busy, error}: ProjectStartProps) {
  const [source, setSource] = useState<AnalysisSource>('repository');
  const [options, setOptions] = useState<AnalysisOptions>({...DEFAULT_OPTIONS});
  const [raw, setRaw] = useState(''), [title, setTitle] = useState(''), [summary, setSummary] = useState('');
  const [steps, setSteps] = useState(''), [localError, setLocalError] = useState('');
  const submit = () => {
    const input = raw.trim() || JSON.stringify({format: 'diagramcloud.project-brief', version: 1,
      project: {id: 'guided-project', title: title.trim(), summary},
      scope: steps.split('\n').map(s => s.trim()).filter(Boolean).map((label, i) => ({id: `step-${i + 1}`, title: label, kind: 'workstream'}))});
    void onBrief(input, options, source === 'hybrid' ? 'hybrid' : 'guided');
  };
  return <section className="project-start" aria-label="New analysis" data-testid="project-start">
    <div className="pi-heading"><div><span className="pi-eyebrow">Local project intelligence</span><h2>New analysis</h2></div>{onClose && <button type="button" onClick={onClose}>Close</button>}</div>
    <p>Choose a selected folder or describe your project. Review the candidate before applying it.</p>
    <fieldset disabled={busy}><legend>Source</legend><div className="pi-options">{(['repository', 'guided', 'hybrid'] as const).map(value => <label key={value} className={source === value ? 'pi-choice selected' : 'pi-choice'}><input type="radio" name="analysis-source" value={value} checked={source === value} onChange={() => setSource(value)}/><strong>{value[0].toUpperCase() + value.slice(1)}</strong><small>{value === 'repository' ? 'Inspect one selected folder' : value === 'guided' ? 'Describe a project without Git' : 'Declare repositories and their bindings'}</small></label>)}</div></fieldset>
    <div className="pi-controls"><label>Purpose <select aria-label="Analysis purpose" disabled={busy} value={options.purpose} onChange={e => setOptions({...options, purpose: e.target.value as AnalysisOptions['purpose']})}>{PURPOSES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></label><label>Depth <select aria-label="Analysis depth" disabled={busy} value={options.depth} onChange={e => setOptions({...options, depth: e.target.value as AnalysisOptions['depth']})}><option value="quick">Quick</option><option value="standard">Standard</option></select></label></div>
    <p className="micro">Quick uses a smaller file and text budget; Standard inspects more selected detail. No repository code is executed.</p>
    {source === 'repository' ? <label className="pi-file">Select repository folder<input aria-label="Analysis repository folder" type="file" multiple {...{webkitdirectory: '', directory: ''}} disabled={busy} onChange={e => {if(e.target.files) void onRepository(e.target.files, options); e.target.value = '';}}/></label> : <>
      <label>{source === 'hybrid' ? 'ProjectBrief or project manifest JSON' : 'ProjectBrief JSON'}<textarea aria-label="Project brief JSON" value={raw} onChange={e => setRaw(e.target.value)} rows={7} placeholder='{"format":"diagramcloud.project-brief","version":1,…}'/></label>
      <label className="pi-file">Import brief file<input aria-label="Project brief file" type="file" accept=".json,application/json" disabled={busy} onChange={async e => {const file = e.target.files?.[0]; if(!file) return; if(file.size > 512 * 1024) {setLocalError('Brief exceeds 512 KiB'); return;} setRaw(await file.text()); setLocalError('');}}/></label>
      {source === 'guided' && <details open={!raw}><summary>Or enter a small project</summary><div className="pi-form"><label>Project title<input aria-label="Guided project title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160}/></label><label>Purpose and scope<textarea aria-label="Guided project summary" value={summary} onChange={e => setSummary(e.target.value)} maxLength={3000}/></label><label>Workstreams / steps (one per line)<textarea aria-label="Guided project steps" value={steps} onChange={e => setSteps(e.target.value)} rows={4}/></label></div></details>}
      {source === 'hybrid' && <p className="micro">Membership and cross-repository relations must be explicit. Each repository keeps its own revision; unavailable members remain unscanned.</p>}
      <button type="button" disabled={busy || (!raw.trim() && (source === 'hybrid' || !title.trim()))} onClick={submit}>Preview project</button>
    </>}
    <details><summary>Advanced · manual assistance</summary><p>Analysis works without a model. After opening a project, Copy context in Evidence and import a reviewed proposal through JSON / AI.</p><label><input type="checkbox" checked={options.includeInferred} onChange={e => setOptions({...options, includeInferred: e.target.checked})}/> Include labelled inferred relationships</label></details>
    {busy && <p role="status">Preparing bounded analysis…</p>}{(error || localError) && <p role="alert">{error || localError}</p>}
  </section>;
}
