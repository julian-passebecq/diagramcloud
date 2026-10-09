/** Generated, point-in-time reports. These are not a replacement for core/Project.
 * Functions consuming Project require the existing validateDocument boundary first.
 * No model call, filesystem access, execution, or publication approval is implicit.
 */
export const PURPOSES = ['understand', 'project', 'portfolio', 'presentation', 'education', 'work-review', 'audit'] as const;
export type Purpose = typeof PURPOSES[number];
export type AnalysisOptions = {purpose: Purpose; depth: 'quick' | 'standard'; includeInferred: boolean};
export const DEFAULT_OPTIONS: Readonly<AnalysisOptions> = {
  purpose: 'understand', depth: 'standard', includeInferred: true,
};
export type Capability = {
  id: 'architecture' | 'code' | 'data' | 'cloud' | 'delivery' | 'documents' | 'ownership';
  state: 'present' | 'not-established';
  reason: string;
  viewIds: string[];
};
export type Gap = {
  id: string;
  state: 'missing-required' | 'missing-optional' | 'unsupported' | 'ambiguous' | 'conflicting' | 'stale';
  subjectId?: string;
  title: string;
  reason: string;
  resolution: string;
  affects: string[];
};
export type ViewRecommendation = {
  id: string;
  title: string;
  required: boolean;
  availability: 'existing' | 'summary' | 'empty-state';
  existingViewIds: string[];
  reason: string;
};
export type ReadinessReport = {
  format: 'diagramcloud.readiness'; version: 1;
  projectId: string; projectRevision: number;
  scope: 'current-project-projection';
  options: AnalysisOptions;
  counts: {nodes: number; connections: number; views: number; sourceDerivedNodes: number; declaredNodes: number; unclassifiedNodes: number};
  capabilities: Capability[];
  views: ViewRecommendation[];
  gaps: Gap[];
  limitations: string[];
};
export type AssetRequirement = {
  id: string; nodeId: string; label: string; requestedIcon: string;
  status: 'resolved' | 'generic-fallback' | 'unknown-icon';
  resolvedIcon: string;
  recommendation: 'keep' | 'semantic-symbol' | 'official-asset-review';
  blocksRendering: false;
  reason: string;
  customAssetId?: string;
  origin?: 'original' | 'vendor' | 'project-asset';
  rights?: string;
  assetVisibility?: 'public' | 'private';
  sourceIdentity?: {repository:string;commit:string;blob:string};
  terms?: {name:string;url:string};
};
export type AssetPlan = {
  format: 'diagramcloud.asset-plan'; version: 1;
  projectId: string; projectRevision: number;
  scope?: {
    kind: 'project' | 'view' | 'recipe'; recipeId?: string;
    viewIds: string[]; nodeIds: string[];
    availability: 'available' | 'partial' | 'unknown';
    state: 'recommended' | 'available' | 'useful' | 'unavailable' | 'not-applicable';
    reason: string; options?: AnalysisOptions;
    context?: {archetypes: string[]; repositoryId?: string; environmentId?: string};
  };
  requirements: AssetRequirement[];
  limitations: string[];
};
export type DocumentInput = {path: string; text: string};
export type DocumentEntry = {
  path: string; kind: 'markdown' | 'csv' | 'json' | 'yaml';
  headings: {title: string; line: number; level: number}[];
  records: {id: string; startLine: number; endLine: number}[];
};
export type DocumentLink = {
  fromPath: string; fromLine: number; toPath: string; toLine?: number;
  kind: 'document-link' | 'source-record' | 'structured-reference';
};
export type DocumentDiagnostic = {
  path: string; line?: number;
  code: 'unresolved' | 'ambiguous' | 'unsupported' | 'limited' | 'unsafe' | 'invalid';
  message: string;
};
export type DocumentMap = {
  format: 'diagramcloud.document-map'; version: 1;
  documents: DocumentEntry[]; links: DocumentLink[];
  diagnostics: DocumentDiagnostic[];
  omitted: {documents: number; links: number; diagnostics: number};
  limitations: string[];
};
