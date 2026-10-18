/** Read-only, provider-neutral transient projection. Not a VCS, collector, persistence or authority. */
export const HISTORY_FACETS = ['project', 'feature', 'problem', 'actor', 'role', 'surface', 'session', 'run',
  'review', 'release', 'environment', 'path', 'status', 'ref', 'author', 'committer', 'system', 'model', 'operation', 'artifact', 'check', 'decision'] as const;
export type HistoryFacet = typeof HISTORY_FACETS[number];
export type RevisionRef = {repository: string; id: string};
export type HistoryRecord = {
  ref: RevisionRef;
  kind: 'revision' | 'change' | 'attempt' | 'review' | 'release';
  vcs: string;
  title: string;
  visibility: 'public' | 'private';
  occurredAt: string | null;
  basis: 'source' | 'declared' | 'inferred';
  sourceRef: string;
  /** Null is UNKNOWN; [] with complete/native explicitly establishes a root within source semantics. */
  ancestry: null | {parents: RevisionRef[]; completeness: 'complete' | 'partial'; semantics: 'native' | 'simplified'};
  /** Exact source mappings only. Missing and [] are different. Labels are not parsed for assignments. */
  facets: Partial<Record<HistoryFacet, string[]>>;
};
export type HistorySlice = {capturedAt: string; coverage: 'complete-in-scope' | 'partial' | 'unknown'; records: HistoryRecord[]};
export type FacetFilter = {values: string[]; includeUnknown?: boolean};
export type HistoryQuery = {
  text?: string; repositories?: string[]; kinds?: HistoryRecord['kind'][];
  facets?: Partial<Record<HistoryFacet, FacetFilter>>;
  from?: string; to?: string;
  /** Unknown dates are excluded by an active time range unless explicitly included. */
  includeUnknownTime?: boolean;
  offset?: number; limit?: number;
};
export type ParentEdge = {child: string; parent: string; ordinal: number | null};
export type HistoryRow = {
  key: string; ref: RevisionRef; kind: HistoryRecord['kind']; vcs: string; title: string;
  occurredAt: string | null; basis: HistoryRecord['basis']; sourceRef: string;
  facets: HistoryRecord['facets']; lane: number;
  ancestry: 'root' | 'shown' | 'boundary' | 'unknown' | 'simplified' | 'not-applicable';
};
const MAX_RECORDS = 5000;
const ERROR = 'Invalid history projection input';
const fail = (): never => {throw new Error(ERROR);};
const text = (x: unknown, max = 2000): x is string => typeof x === 'string' && !!x.trim() && x.length <= max && !/[\u0000-\u001f]/.test(x);
export const revisionKey = (ref: RevisionRef): string => JSON.stringify([ref.repository, ref.id]);
const validRef = (r: RevisionRef): boolean => !!r && text(r.repository, 300) && text(r.id, 300);
function instant(x: unknown): number {
  if (typeof x !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(x)) return fail();
  const value = Date.parse(x); if (!Number.isFinite(value)) return fail();
  const day = x.slice(0, 10); if (new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) return fail();
  return value;
}
function checkedRecords(input: HistorySlice, audience: 'author' | 'public'): HistoryRecord[] {
  if (!input || !Array.isArray(input.records) || !['author', 'public'].includes(audience)) return fail();
  // Public projection precedes validation, search, facets, counts, sort and ancestry inspection.
  const rows = audience === 'public' ? input.records.filter(r => r && r.visibility === 'public') : input.records;
  if (rows.length > MAX_RECORDS) return fail();
  const keys = new Set<string>();
  for (const r of rows) {
    if (!validRef(r.ref) || !text(r.title) || !text(r.vcs, 80) || !text(r.sourceRef) ||
      !['revision', 'change', 'attempt', 'review', 'release'].includes(r.kind) ||
      !['public', 'private'].includes(r.visibility) || !['source', 'declared', 'inferred'].includes(r.basis)) return fail();
    if (r.occurredAt !== null) instant(r.occurredAt);
    const key = revisionKey(r.ref); if (keys.has(key)) return fail(); keys.add(key);
    if (!r.facets || typeof r.facets !== 'object' || Array.isArray(r.facets)) return fail();
    for (const [name, values] of Object.entries(r.facets)) {
      if (!HISTORY_FACETS.includes(name as HistoryFacet) || !Array.isArray(values) || values.length > 100 ||
          values.some(x => !text(x, 300)) || new Set(values).size !== values.length) return fail();
    }
    if (r.ancestry !== null) {
      if (r.kind !== 'revision' || !['complete', 'partial'].includes(r.ancestry.completeness) ||
        !['native', 'simplified'].includes(r.ancestry.semantics) || !Array.isArray(r.ancestry.parents) || r.ancestry.parents.length > 50) return fail();
      const parents = new Set<string>();
      for (const p of r.ancestry.parents) {
        if (!validRef(p) || p.repository !== r.ref.repository) return fail();
        const k = revisionKey(p); if (k === key || parents.has(k)) return fail(); parents.add(k);
      }
    }
  }
  return rows;
}
/** Topological order, with timestamp only as a tie-breaker. Clock skew must never reverse ancestry. */
function orderedRecords(rows: HistoryRecord[]): HistoryRecord[] {
  const map = new Map(rows.map(r => [revisionKey(r.ref), r]));
  const children = new Map(rows.map(r => [revisionKey(r.ref), 0]));
  const parents = (r: HistoryRecord) => r.ancestry?.semantics === 'native' ? r.ancestry.parents : [];
  for (const r of rows) for (const p of parents(r)) {
    const k = revisionKey(p), parent = map.get(k);
    if (parent && parent.kind !== 'revision') return fail();
    if (parent) children.set(k, children.get(k)! + 1);
  }
  const compare = (a: HistoryRecord, b: HistoryRecord) => {
    const ta = a.occurredAt === null ? -Infinity : Date.parse(a.occurredAt), tb = b.occurredAt === null ? -Infinity : Date.parse(b.occurredAt);
    if (ta !== tb) return ta > tb ? -1 : 1;
    const ka = revisionKey(a.ref), kb = revisionKey(b.ref); return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
  const ready = rows.filter(r => children.get(revisionKey(r.ref)) === 0).sort(compare), result: HistoryRecord[] = [];
  while (ready.length) {
    const r = ready.shift()!; result.push(r);
    for (const p of parents(r)) {
      const k = revisionKey(p), left = children.get(k); if (left === undefined) continue;
      children.set(k, left - 1); if (left === 1) {ready.push(map.get(k)!); ready.sort(compare);}
    }
  }
  if (result.length !== rows.length) return fail();
  return result;
}
function validateQuery(q: HistoryQuery): void {
  const allowed = ['text', 'repositories', 'kinds', 'facets', 'from', 'to', 'includeUnknownTime', 'offset', 'limit'];
  if (!q || Object.keys(q).some(k => !allowed.includes(k))) return fail();
  if (q.text !== undefined && (typeof q.text !== 'string' || q.text.length > 500)) return fail();
  for (const a of [q.repositories, q.kinds]) if (a !== undefined && (!Array.isArray(a) || a.length > 100 || a.some(x => !text(x, 300)))) return fail();
  if (q.kinds?.some(k => !['revision', 'change', 'attempt', 'review', 'release'].includes(k))) return fail();
  if (q.offset !== undefined && (!Number.isSafeInteger(q.offset) || q.offset < 0)) return fail();
  if (q.limit !== undefined && (!Number.isSafeInteger(q.limit) || q.limit < 1 || q.limit > 500)) return fail();
  if (q.includeUnknownTime !== undefined && typeof q.includeUnknownTime !== 'boolean') return fail();
  if (q.from !== undefined) instant(q.from); if (q.to !== undefined) instant(q.to);
  if (q.from !== undefined && q.to !== undefined && instant(q.from) > instant(q.to)) return fail();
  if (q.facets !== undefined) {
    if (!q.facets || typeof q.facets !== 'object' || Array.isArray(q.facets)) return fail();
    for (const [key, f] of Object.entries(q.facets)) {
      if (!HISTORY_FACETS.includes(key as HistoryFacet) || !f || typeof f !== 'object' ||
        Object.keys(f).some(k => !['values', 'includeUnknown'].includes(k)) || !Array.isArray(f.values) || f.values.length > 100 ||
        f.values.some(x => !text(x, 300)) || (f.includeUnknown !== undefined && typeof f.includeUnknown !== 'boolean')) return fail();
    }
  }
}
function matches(r: HistoryRecord, q: HistoryQuery): boolean {
  if (q.repositories !== undefined && !q.repositories.includes(r.ref.repository)) return false;
  if (q.kinds !== undefined && !q.kinds.includes(r.kind)) return false;
  const term = q.text?.trim().toLowerCase();
  if (term && ![r.title, r.ref.id, ...(r.facets.actor ?? []), ...(r.facets.author ?? []), ...(r.facets.committer ?? [])].some(s => s.toLowerCase().includes(term))) return false;
  for (const [name, f] of Object.entries(q.facets ?? {})) {
    const values = r.facets[name as HistoryFacet];
    if (values === undefined) {if (!f.includeUnknown) return false;}
    else if (!values.some(v => f.values.includes(v))) return false;
  }
  if (q.from !== undefined || q.to !== undefined) {
    if (r.occurredAt === null) return q.includeUnknownTime === true;
    const when = Date.parse(r.occurredAt);
    if (q.from !== undefined && when < Date.parse(q.from)) return false;
    if (q.to !== undefined && when > Date.parse(q.to)) return false;
  }
  return true;
}
/** Filters do NOT rewrite ancestry. Omitted parents become generic boundaries, never synthetic direct edges. */
export function projectHistory(input: HistorySlice, query: HistoryQuery = {}, audience: 'author' | 'public' = 'author') {
  validateQuery(query); instant(input.capturedAt);
  if (!['complete-in-scope', 'partial', 'unknown'].includes(input.coverage)) return fail();
  const permitted = checkedRecords(input, audience), ordered = orderedRecords(permitted);
  const matched = ordered.filter(r => matches(r, query));
  const offset = Math.min(query.offset ?? 0, matched.length), limit = query.limit ?? 100;
  const page = matched.slice(offset, offset + limit), pageKeys = new Set(page.map(r => revisionKey(r.ref)));
  const edges: ParentEdge[] = [];
  const rows: HistoryRow[] = [];
  // Per-repository lane reservations. No shared "main" lane across independent repositories.
  const lanes = new Map<string, number>(), used = new Set<number>();
  let maxLane = -1;
  function newLane(): number {let n = 0; while (used.has(n)) n++; used.add(n); maxLane = Math.max(maxLane, n); return n;}
  for (const r of page) {
    const key = revisionKey(r.ref), lane = lanes.get(key) ?? newLane(); lanes.delete(key);
    let ancestry: HistoryRow['ancestry'] = r.kind === 'revision' ? 'unknown' : 'not-applicable';
    const native = r.ancestry?.semantics === 'native';
    if (r.ancestry?.semantics === 'simplified') ancestry = 'simplified';
    else if (native) {
      const a = r.ancestry!;
      ancestry = !a.parents.length && a.completeness === 'complete' ? 'root' :
        a.completeness === 'partial' || a.parents.some(p => !pageKeys.has(revisionKey(p))) ? 'boundary' : 'shown';
      let retained = false, visibleOrdinal = 0;
      a.parents.forEach((p, ordinal) => {
        const pk = revisionKey(p); if (!pageKeys.has(pk)) return;
        edges.push({child: key, parent: pk, ordinal: audience === 'public' ? null : ordinal});
        // Layout uses only displayed parents; private/filtered parent positions cannot shift public lanes.
        if (!lanes.has(pk)) {const n = !retained && visibleOrdinal === 0 ? lane : newLane(); lanes.set(pk, n); if (n === lane) retained = true;}
        visibleOrdinal++;
      });
      if (!retained) used.delete(lane);
    } else used.delete(lane);
    rows.push({key, ref: {...r.ref}, kind: r.kind, vcs: r.vcs, title: r.title, occurredAt: r.occurredAt,
      basis: r.basis, sourceRef: r.sourceRef, facets: structuredClone(r.facets), lane, ancestry});
  }
  const availableFacets = Object.fromEntries(HISTORY_FACETS.map(name => [name, {
    values: [...new Set(permitted.flatMap(r => r.facets[name] ?? []))].sort(),
    unknown: permitted.filter(r => r.facets[name] === undefined).length
  }])) as Record<HistoryFacet, {values: string[]; unknown: number}>;
  return {rows, edges, availableFacets, matched: matched.length, permitted: permitted.length, offset,
    hasMore: offset + page.length < matched.length, coverage: input.coverage, capturedAt: input.capturedAt,
    lanes: maxLane + 1, notice: 'Source history, not live activity. Filters do not establish ancestry, attribution or release completion.'};
}
