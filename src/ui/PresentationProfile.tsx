import {useId, useMemo, useState} from 'react';
import {
  isPresentationProfile, PRESENTATION_PROFILES, PRESENTATION_PROFILE_DETAILS,
  presentationPreferenceKey, readPresentationPreference, writePresentationPreference,
  type PresentationPreferenceStorage, type PresentationProfileId,
} from '../core/presentationProfile';
import './presentation-profile.css';

function browserPreferenceStorage(): PresentationPreferenceStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

/** An explicit selection writes only its small preference; loading never writes or repairs storage. */
export function usePresentationProfile(projectId: string, hostId: string) {
  const key = presentationPreferenceKey(projectId, hostId);
  const initial = useMemo(() => readPresentationPreference(browserPreferenceStorage(), projectId, hostId), [projectId, hostId]);
  const [selection, setSelection] = useState<{key: string; profile: PresentationProfileId; warning?: string} | null>(null);
  const current = selection?.key === key ? selection : null;
  const persistenceWarning = current ? current.warning : initial.status === 'corrupt'
    ? 'The saved presentation preference is unreadable. Standard is shown; your project is unchanged.'
    : initial.status === 'unavailable' ? 'Presentation preferences cannot be read here. Your project remains available.' : undefined;
  const selectProfile = (profile: PresentationProfileId) => {
    if(!isPresentationProfile(profile)) return;
    const saved = writePresentationPreference(browserPreferenceStorage(), projectId, hostId, profile);
    setSelection({key, profile, warning: saved ? undefined : 'Presentation preference could not be saved. It applies for this session; your project is unchanged.'});
  };
  return {profile: current?.profile ?? initial.profile, selectProfile, persistenceWarning};
}

export function PresentationProfile({profile, onChange, persistenceWarning}: {
  profile: PresentationProfileId;
  onChange: (profile: PresentationProfileId) => void;
  persistenceWarning?: string;
}) {
  const id = useId();
  return <div className="presentation-profile" data-profile={profile}>
    <label htmlFor={id}>Presentation profile</label>
    <select id={id} value={profile} aria-describedby={`${id}-description ${id}-scope`} onChange={event => {
      if(isPresentationProfile(event.target.value)) onChange(event.target.value);
    }}>{PRESENTATION_PROFILES.map(value => <option key={value} value={value}>{PRESENTATION_PROFILE_DETAILS[value].label}</option>)}</select>
    <p id={`${id}-description`}>{PRESENTATION_PROFILE_DETAILS[profile].description}</p>
    <p id={`${id}-scope`} className="presentation-profile-scope">Changes tool placement. Analysis, access and publication choices stay as set. Exports and backups remain available.</p>
    {persistenceWarning && <p role="status" className="presentation-profile-warning">{persistenceWarning}</p>}
  </div>;
}
