import {useId, useMemo, useState, type FormEvent} from 'react';
import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {validatePublicationBrief, type PublicationBrief} from '../intelligence/publicationBrief';
import {meetingBriefChoices, meetingSummaryFile, MEETING_SUMMARY_DETAILS, MEETING_SUMMARY_FIDELITY_NOTE, MEETING_SUMMARY_LIMITS, MEETING_SUMMARY_PAPERS} from '../export/meetingSummary';
import {download} from '../export/browser';

export type MeetingSummaryDialogProps = {project: Project; activeViewId: string; onDone: (message: string) => void; onCancel: () => void};

const DETAIL_LABELS: Record<typeof MEETING_SUMMARY_DETAILS[number], string> = {overview: 'Overview: findings and figures', standard: 'Standard: with selected evidence', full: 'Full: all attached public evidence'};
const PROFILE_LABELS: Record<'design' | 'business', string> = {design: 'Design: figures and components', business: 'Business: text and tables, no graph'};
const errorText = (e: unknown) => e instanceof Error ? (e.message.startsWith('[') ? 'The brief is incomplete or too long. Check the title, audience and selected views.' : e.message) : String(e);

/** Meeting-summary brief form ("Export & share > Meeting summary"). It reads the public projection only,
 * validates through validatePublicationBrief and downloads one offline HTML file. It never changes the Project. */
export function MeetingSummaryDialog({project, activeViewId, onDone, onCancel}: MeetingSummaryDialogProps) {
  const ids = useId();
  const choices = useMemo(() => meetingBriefChoices(project), [project]);
  const stories = useMemo(() => publicDocument(project).story.map((step, index) => ({index, title: step.title, viewId: step.viewId})), [project]);
  const [title, setTitle] = useState(() => (project.title + ' - meeting summary').slice(0, MEETING_SUMMARY_LIMITS.titleLength));
  const [audience, setAudience] = useState('');
  // The current view is preselected only when it is a public reachable view; otherwise nothing is preselected.
  const [viewIds, setViewIds] = useState<string[]>(() => choices.views.some(v => v.id === activeViewId) ? [activeViewId] : []);
  const [detail, setDetail] = useState<typeof MEETING_SUMMARY_DETAILS[number]>('standard');
  const [paper, setPaper] = useState<typeof MEETING_SUMMARY_PAPERS[number]>('A4');
  const [profile, setProfile] = useState<'design' | 'business'>('design');
  const [storyIndices, setStoryIndices] = useState<number[]>([]);
  const [error, setError] = useState('');

  const selectableStories = stories.filter(s => viewIds.includes(s.viewId));
  const toggleView = (id: string, on: boolean) => {
    setError('');
    const next = on ? choices.views.map(v => v.id).filter(v => v === id || viewIds.includes(v)) : viewIds.filter(v => v !== id);
    setViewIds(next);
    // A story stop outside the selected views is dropped, never kept silently.
    setStoryIndices(current => current.filter(i => next.includes(stories.find(s => s.index === i)?.viewId ?? '')));
  };
  const toggleStory = (index: number, on: boolean) => {setError(''); setStoryIndices(current => on ? [...current, index].sort((a, b) => a - b) : current.filter(i => i !== index));};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setError('Give the summary a title.');
    if (!audience.trim()) return setError('Name the audience of the meeting.');
    if (viewIds.length < 1) return setError('Select at least one view.');
    if (viewIds.length > MEETING_SUMMARY_LIMITS.views) return setError(`Select at most ${MEETING_SUMMARY_LIMITS.views} views; the full handbook covers more.`);
    try {
      const brief: PublicationBrief = validatePublicationBrief({format: 'diagramcloud.publication-brief/1', title: title.trim(), audience: audience.trim(), viewIds, detail, paper, profile, storyIndices}, project);
      const file = meetingSummaryFile(project, brief);
      download(file.html, file.fileName, 'text/html');
      onDone(`Downloaded ${file.fileName}. Print it from the browser for a PDF snapshot.`);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const tooMany = viewIds.length > MEETING_SUMMARY_LIMITS.views;
  return <form className="meeting-summary-form" aria-label="Meeting summary" noValidate onSubmit={submit} style={{display: 'grid', gap: 12, maxWidth: '100%', minWidth: 0}}>
    <p className="micro" id={ids + 'note'}>{MEETING_SUMMARY_FIDELITY_NOTE} Public content only: private views, components and evidence are left out.</p>
    <label style={{display: 'grid', gap: 4, minWidth: 0}}>Title
      <input value={title} maxLength={MEETING_SUMMARY_LIMITS.titleLength} required onChange={e => {setError(''); setTitle(e.target.value);}} style={{maxWidth: '100%', boxSizing: 'border-box'}}/>
    </label>
    <label style={{display: 'grid', gap: 4, minWidth: 0}}>Audience
      <input value={audience} maxLength={MEETING_SUMMARY_LIMITS.audienceLength} required placeholder="For example: business owner and data engineer" onChange={e => {setError(''); setAudience(e.target.value);}} style={{maxWidth: '100%', boxSizing: 'border-box'}}/>
    </label>
    <fieldset style={{minWidth: 0}} aria-describedby={ids + 'views'}>
      <legend>Views (1 to {MEETING_SUMMARY_LIMITS.views})</legend>
      {choices.views.length ? choices.views.map(v => <label key={v.id} style={{display: 'flex', gap: 6, alignItems: 'baseline', overflowWrap: 'anywhere'}}>
        <input type="checkbox" checked={viewIds.includes(v.id)} onChange={e => toggleView(v.id, e.target.checked)}/>{v.title}
      </label>) : <p className="micro">No public view is reachable from the public root; nothing can be summarised.</p>}
      <p className="micro" id={ids + 'views'} role={tooMany ? 'alert' : undefined}>{viewIds.length} selected.{tooMany ? ` At most ${MEETING_SUMMARY_LIMITS.views}.` : ''}</p>
    </fieldset>
    <fieldset style={{minWidth: 0}}>
      <legend>Detail</legend>
      {MEETING_SUMMARY_DETAILS.map(d => <label key={d} style={{display: 'flex', gap: 6}}><input type="radio" name={ids + 'detail'} checked={detail === d} onChange={() => setDetail(d)}/>{DETAIL_LABELS[d]}</label>)}
    </fieldset>
    <fieldset style={{minWidth: 0}}>
      <legend>Paper</legend>
      {MEETING_SUMMARY_PAPERS.map(p => <label key={p} style={{display: 'flex', gap: 6}}><input type="radio" name={ids + 'paper'} checked={paper === p} onChange={() => setPaper(p)}/>{p}</label>)}
    </fieldset>
    <fieldset style={{minWidth: 0}}>
      <legend>Profile</legend>
      {choices.profiles.map(p => <label key={p} style={{display: 'flex', gap: 6}}><input type="radio" name={ids + 'profile'} checked={profile === p} onChange={() => setProfile(p)}/>{PROFILE_LABELS[p]}</label>)}
    </fieldset>
    <fieldset style={{minWidth: 0}}>
      <legend>Story stops (optional)</legend>
      {selectableStories.length ? selectableStories.map(s => <label key={s.index} style={{display: 'flex', gap: 6, overflowWrap: 'anywhere'}}>
        <input type="checkbox" checked={storyIndices.includes(s.index)} onChange={e => toggleStory(s.index, e.target.checked)}/>{s.index + 1}. {s.title}
      </label>) : <p className="micro">{choices.storyCount ? 'No public story stop belongs to the selected views.' : 'This project has no public story stops.'}</p>}
    </fieldset>
    {error && <p role="alert" className="micro metric-warning">{error}</p>}
    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
      <button type="submit">Download meeting summary</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}
