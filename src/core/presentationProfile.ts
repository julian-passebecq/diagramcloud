/** Presentation preferences only. Never part of Project, acquisition or publication state. */
export const PRESENTATION_PROFILES = ['vanilla', 'standard', 'advanced'] as const;
export type PresentationProfileId = typeof PRESENTATION_PROFILES[number];
export const DEFAULT_PRESENTATION_PROFILE: PresentationProfileId = 'standard';
export const PRESENTATION_PROFILE_VERSION = 1;

export const PRESENTATION_PROFILE_DETAILS: Record<PresentationProfileId, {label: string; description: string}> = {
  vanilla: {label: 'Vanilla', description: 'Focus on architecture and evidence. Open More tools for visual renderers.'},
  standard: {label: 'Standard', description: 'Show the usual views, evidence and visual tools.'},
  advanced: {label: 'Advanced', description: 'Add source details and revision shortcuts when available.'},
};

export function isPresentationProfile(value: unknown): value is PresentationProfileId {
  return typeof value === 'string' && PRESENTATION_PROFILES.includes(value as PresentationProfileId);
}

/** Flags select placement, never permission or availability. All tools remain reachable. */
export function presentationExposure(profile: PresentationProfileId) {
  return {
    simplifiedToolbar: profile === 'vanilla',
    workflowTools: profile !== 'vanilla',
    advancedTools: profile === 'advanced',
    moreTools: true,
    exportBackupRecovery: true,
  } as const;
}

export type PresentationPreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type PresentationPreferenceRead = {
  profile: PresentationProfileId;
  status: 'saved' | 'missing' | 'corrupt' | 'unavailable';
};

/** Encode the tuple, so separators in a host or project ID cannot alias another preference. */
export function presentationPreferenceKey(projectId: string, hostId: string): string {
  return `diagramcloud.presentation-profile.v1:${encodeURIComponent(JSON.stringify([hostId, projectId]))}`;
}

export function readPresentationPreference(storage: PresentationPreferenceStorage | null, projectId: string, hostId: string): PresentationPreferenceRead {
  if(!storage) return {profile: DEFAULT_PRESENTATION_PROFILE, status: 'unavailable'};
  let raw: string | null;
  try {
    raw = storage.getItem(presentationPreferenceKey(projectId, hostId));
  } catch {
    return {profile: DEFAULT_PRESENTATION_PROFILE, status: 'unavailable'};
  }
  if(raw === null) return {profile: DEFAULT_PRESENTATION_PROFILE, status: 'missing'};
  if(raw.length > 256) return {profile: DEFAULT_PRESENTATION_PROFILE, status: 'corrupt'};
  try {
    const value: unknown = JSON.parse(raw);
    if(!value || typeof value !== 'object' || Array.isArray(value)) return {profile: DEFAULT_PRESENTATION_PROFILE, status: 'corrupt'};
    const preference = value as Record<string, unknown>;
    if(Object.keys(preference).length !== 2 || preference.version !== PRESENTATION_PROFILE_VERSION || !isPresentationProfile(preference.profile)) {
      return {profile: DEFAULT_PRESENTATION_PROFILE, status: 'corrupt'};
    }
    return {profile: preference.profile, status: 'saved'};
  } catch {
    return {profile: DEFAULT_PRESENTATION_PROFILE, status: 'corrupt'};
  }
}

export function writePresentationPreference(storage: PresentationPreferenceStorage | null, projectId: string, hostId: string, profile: PresentationProfileId): boolean {
  if(!storage || !isPresentationProfile(profile)) return false;
  try {
    storage.setItem(presentationPreferenceKey(projectId, hostId), JSON.stringify({version: PRESENTATION_PROFILE_VERSION, profile}));
    return true;
  } catch {
    return false;
  }
}
