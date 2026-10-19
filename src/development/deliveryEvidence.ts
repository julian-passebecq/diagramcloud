import {sha256Hex} from '../core/proposal';

/**
 * Read-only reading of a supplied `delivery-view/1` plan (the external Galaxy/Pro plan schema). It never dispatches,
 * launches, approves, schedules or edits anything, and it never writes into a Project. Everything shown comes from the
 * supplied bytes: states are source-declared, estimates are uncalibrated allowances, intervals and result refs are
 * only those supplied with their basis. Unknown fields are listed, never interpreted.
 */
export const DELIVERY_VIEW_SCHEMA = 'delivery-view/1';
export const DELIVERY_VIEW_LIMITS = {bytes: 262144, blocks: 200, sources: 100, products: 20, owners: 20, dependencies: 2000, filesets: 2000} as const;
export const DELIVERY_VIEW_REFUSAL = 'This delivery plan is invalid or exceeds the supported reading scope. Nothing was changed.';
export const REMAINING_NOTICE = 'Uncalibrated allowance, not a measurement, schedule or date; ignores queues, access and shared workers.';
export const IDENTITY_NOTICE = 'identity of bytes, not authenticity or authority';

export type DeliveryBasis = 'OBSERVED' | 'DECLARED' | 'INFERRED' | 'UNKNOWN';
export type DeliveryRange = {minMinutes: number; maxMinutes: number; basis: string; estimatedAt: string | null};
export type DeliveryInterval = {start: string; end: string; timezone: string | null; basis: DeliveryBasis; sourceIds: string[]};
export type DeliveryResultRef = {kind: 'commit' | 'pull-request' | 'artifact' | 'check' | 'release' | 'document'; ref: string; url: string | null; basis: DeliveryBasis; sourceIds: string[]};
export type DeliveryFileset = {repository: string; path: string; access: 'read' | 'write'};
export type DeliveryBlock = {
  id: string; title: string; productId: string; state: string; dependsOn: string[]; ownerId: string | null;
  acceptance: string; acceptanceIds: string[]; filesets: DeliveryFileset[]; estimate: DeliveryRange | null;
  interval: DeliveryInterval | null; results: DeliveryResultRef[]; sourceIds: string[];
  checkpoint: string | null; promptRef: string | null; phase: number | null;
};
export type DeliverySourceIdentity = {repository: string; ref: string; commit: string; purpose: string};
export type DeliveryView = {
  schema: typeof DELIVERY_VIEW_SCHEMA; title: string; capturedAt: string; visibility: 'public' | 'private';
  sources: {id: string; title: string; url: string | null; basis: DeliveryBasis; checkedAt: string | null}[];
  products: {id: string; title: string; sourceRevision: string | null; candidateVersion: string | null}[];
  owners: {id: string; title: string; role: string}[];
  blocks: DeliveryBlock[];
  sourceVector: DeliverySourceIdentity[];
  ignoredFields: string[];
  inputSha256: string;
};
export type OwnerConflict = {repository: string; path: string; blockIds: [string, string]; owners: [string | null, string | null]; ordered: boolean};
export type NamedGapCode = 'NO_ESTIMATE' | 'NO_ACCEPTANCE' | 'NO_SOURCE' | 'NO_INTERVAL' | 'NO_RESULT' | 'NO_OWNER' | 'UNKNOWN_DEPENDENCY' | 'TOKENS_UNKNOWN' | 'CALENDAR_UNKNOWN';
export type NamedGap = {code: NamedGapCode; blockId: string | null; message: string};
export type DeliveryEvidence = {
  audience: 'author' | 'public'; withheld: boolean; view: DeliveryView | null;
  conflicts: OwnerConflict[]; gaps: NamedGap[];
  remaining: {sumMinutes: [number, number] | null; dependencyLowerBoundMinutes: [number, number] | null; unestimated: string[]; calendar: 'UNKNOWN'; notice: string};
  intervals: {blockId: string; interval: DeliveryInterval}[];
  results: {blockId: string; ref: DeliveryResultRef}[];
};

const BASES: readonly DeliveryBasis[] = ['OBSERVED', 'DECLARED', 'INFERRED', 'UNKNOWN'];
const RESULT_KINDS: readonly DeliveryResultRef['kind'][] = ['commit', 'pull-request', 'artifact', 'check', 'release', 'document'];
/** States the source declares finished. Compared case-insensitively; any other state is unfinished. */
const FINISHED_STATES = new Set(['done', 'delivered', 'merged']);

type Obj = Record<string, unknown>;
const refuse = (): never => {throw new Error(DELIVERY_VIEW_REFUSAL);};
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 4000): string => typeof v === 'string' && v.trim() && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v) ? v : refuse();
const optText = (v: unknown, max = 4000): string | null => v === undefined || v === null ? null : text(v, max);
const textOrEmpty = (v: unknown, max = 8000): string => v === undefined || v === null ? '' : typeof v === 'string' && v.length <= max ? v : refuse();
const idList = (v: unknown, max = 200): string[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max) return refuse();
  const out = v.map(x => text(x, 300));
  return new Set(out).size === out.length ? out : refuse();
};
const basis = (v: unknown): DeliveryBasis => BASES.includes(v as DeliveryBasis) ? v as DeliveryBasis : refuse();
function instant(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,9})?)?(?:Z|[+-]\d\d:\d\d)$/.test(v)) return refuse();
  const day = v.slice(0, 10);
  if (!Number.isFinite(Date.parse(v.replace(/(\.\d{3})\d+/, '$1'))) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) return refuse();
  return v;
}
const optInstant = (v: unknown): string | null => v === undefined || v === null ? null : instant(v);
const epoch = (v: string) => Date.parse(v.replace(/(\.\d{3})\d+/, '$1'));
/** Descriptive fields the schema defines but this reading does not interpret: type-checked, then left alone. */
function descriptive(v: unknown): void {
  if (v === undefined || v === null || typeof v === 'boolean') return;
  if (typeof v === 'string') {if (v.length > 8000) refuse(); return;}
  if (typeof v === 'number') {if (!Number.isFinite(v)) refuse(); return;}
  if (Array.isArray(v) && v.length <= 200 && v.every(x => typeof x === 'string' && x.length <= 4000)) return;
  refuse();
}

/** Collects unknown keys as path patterns (`blocks[].extra`). Values are never read. */
function known(o: Obj, path: string, keys: readonly string[], ignored: Set<string>): void {
  for (const k of Object.keys(o)) if (!keys.includes(k)) ignored.add(path ? `${path}.${k}` : k);
}
const TOP = ['schema', 'title', 'captured_at', 'visibility', 'scope_note', 'sources', 'products', 'blocks', 'dependencies', 'handoff'];
const SOURCE = ['id', 'title', 'url', 'basis', 'checked_at', 'summary'];
const PRODUCT = ['id', 'title', 'repository', 'mission', 'owner', 'target', 'delivered', 'next', 'launch', 'caveat', 'wave', 'state', 'source_ids', 'source_revision', 'candidate_version'];
const DETAIL = ['owner_id', 'phase', 'acceptance_ids', 'filesets', 'checkpoint', 'prompt_ref', 'interval', 'results'];
const BLOCK = ['id', 'title', 'product_id', 'state', 'depends_on', 'boundary', 'acceptance', 'blocker', 'source_ids', 'estimate', ...DETAIL];
const BLOCK_DETAIL = ['block_id', ...DETAIL, 'resources', 'deliverables', 'checks', 'model_class', 'model_reason', 'tokens'];
const HANDOFF = ['revision', 'outcome', 'non_goals', 'owners', 'source_vector', 'block_details', 'calendar'];
const OWNER = ['id', 'title', 'role', 'provider_preference', 'activation', 'subagents_hint', 'reason'];

type Detail = {ownerId?: string | null; phase?: number | null; acceptanceIds?: string[]; filesets?: DeliveryFileset[];
  checkpoint?: string | null; promptRef?: string | null; interval?: DeliveryInterval | null; results?: DeliveryResultRef[]};

/** Parses one supplied plan, or refuses it whole with DELIVERY_VIEW_REFUSAL (no partial data). */
export function parseDeliveryView(raw: string): DeliveryView {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > DELIVERY_VIEW_LIMITS.bytes) return refuse();
  let input: unknown;
  try {input = JSON.parse(raw);} catch {return refuse();}
  if (!isObj(input) || input.schema !== DELIVERY_VIEW_SCHEMA) return refuse();
  const ignored = new Set<string>();
  known(input, '', TOP, ignored);
  const title = text(input.title, 300), capturedAt = instant(input.captured_at);
  const visibility = input.visibility === 'public' || input.visibility === 'private' ? input.visibility : refuse();
  descriptive(input.scope_note);
  const array = (v: unknown, max: number): unknown[] => v === undefined || v === null ? [] : Array.isArray(v) && v.length <= max ? v : refuse();
  const unique = (ids: string[]) => {if (new Set(ids).size !== ids.length) refuse();};

  const sources = array(input.sources, DELIVERY_VIEW_LIMITS.sources).map(s => {
    if (!isObj(s)) return refuse();
    known(s, 'sources[]', SOURCE, ignored); descriptive(s.summary);
    return {id: text(s.id, 300), title: text(s.title, 300), url: optText(s.url, 2000), basis: basis(s.basis), checkedAt: optInstant(s.checked_at)};
  });
  unique(sources.map(s => s.id));
  const sourceIds = new Set(sources.map(s => s.id));
  const cited = (v: unknown) => {const ids = idList(v); if (ids.some(id => !sourceIds.has(id))) refuse(); return ids;};

  const products = array(input.products, DELIVERY_VIEW_LIMITS.products).map(p => {
    if (!isObj(p)) return refuse();
    known(p, 'products[]', PRODUCT, ignored);
    for (const k of ['repository', 'mission', 'owner', 'target', 'delivered', 'next', 'launch', 'caveat', 'wave', 'state']) descriptive(p[k]);
    cited(p.source_ids);
    return {id: text(p.id, 300), title: text(p.title, 300), sourceRevision: optText(p.source_revision, 300), candidateVersion: optText(p.candidate_version, 300)};
  });
  unique(products.map(p => p.id));

  const handoff = input.handoff === undefined || input.handoff === null ? {} : isObj(input.handoff) ? input.handoff : refuse();
  known(handoff, 'handoff', HANDOFF, ignored);
  descriptive(handoff.revision); descriptive(handoff.outcome); descriptive(handoff.non_goals);
  // Calendar is not modelled: a supplied one is listed and never read, so no date is ever computed from it.
  if (handoff.calendar !== undefined && handoff.calendar !== null) ignored.add('handoff.calendar');
  const owners = array(handoff.owners, DELIVERY_VIEW_LIMITS.owners).map(o => {
    if (!isObj(o)) return refuse();
    known(o, 'handoff.owners[]', OWNER, ignored);
    for (const k of ['provider_preference', 'activation', 'subagents_hint', 'reason']) descriptive(o[k]);
    return {id: text(o.id, 300), title: text(o.title, 300), role: textOrEmpty(o.role, 300)};
  });
  unique(owners.map(o => o.id));
  const ownerIds = new Set(owners.map(o => o.id));
  const sourceVector = array(handoff.source_vector, 50).map(v => {
    if (!isObj(v)) return refuse();
    known(v, 'handoff.source_vector[]', ['repository', 'ref', 'commit', 'purpose'], ignored);
    return {repository: text(v.repository, 300), ref: text(v.ref, 300), commit: text(v.commit, 300), purpose: textOrEmpty(v.purpose, 1000)};
  });

  let filesetCount = 0;
  const detail = (o: Obj, path: string): Detail => {
    const d: Detail = {};
    if ('owner_id' in o) {const id = optText(o.owner_id, 300); if (id !== null && !ownerIds.has(id)) refuse(); d.ownerId = id;}
    if ('phase' in o) d.phase = o.phase === null ? null : Number.isSafeInteger(o.phase) && (o.phase as number) >= 0 ? o.phase as number : refuse();
    if ('acceptance_ids' in o) d.acceptanceIds = idList(o.acceptance_ids);
    if ('checkpoint' in o) d.checkpoint = optText(o.checkpoint, 2000);
    if ('prompt_ref' in o) d.promptRef = optText(o.prompt_ref, 2000);
    if ('filesets' in o) d.filesets = array(o.filesets, DELIVERY_VIEW_LIMITS.filesets).map(f => {
      if (!isObj(f)) return refuse();
      known(f, path + '.filesets[]', ['repository', 'path', 'access'], ignored);
      if (++filesetCount > DELIVERY_VIEW_LIMITS.filesets) refuse();
      const access = f.access === 'read' || f.access === 'write' ? f.access : refuse();
      return {repository: text(f.repository, 300), path: text(f.path, 1000), access};
    });
    if ('interval' in o) {
      const i = o.interval;
      if (i === null) d.interval = null;
      else {
        if (!isObj(i)) return refuse();
        known(i, path + '.interval', ['start', 'end', 'timezone', 'basis', 'source_ids'], ignored);
        const start = instant(i.start), end = instant(i.end);
        if (epoch(end) < epoch(start)) refuse();
        // The timezone is kept as supplied text and never used to shift the instants.
        d.interval = {start, end, timezone: optText(i.timezone, 100), basis: basis(i.basis), sourceIds: cited(i.source_ids)};
      }
    }
    if ('results' in o) d.results = array(o.results, 100).map(r => {
      if (!isObj(r)) return refuse();
      known(r, path + '.results[]', ['kind', 'ref', 'url', 'basis', 'source_ids'], ignored);
      const kind = RESULT_KINDS.includes(r.kind as DeliveryResultRef['kind']) ? r.kind as DeliveryResultRef['kind'] : refuse();
      return {kind, ref: text(r.ref, 500), url: optText(r.url, 2000), basis: basis(r.basis), sourceIds: cited(r.source_ids)};
    });
    return d;
  };

  const productIds = new Set(products.map(p => p.id));
  const rawBlocks = array(input.blocks, DELIVERY_VIEW_LIMITS.blocks);
  let dependencyCount = 0;
  const blocks: DeliveryBlock[] = [], local = new Map<string, Detail>();
  for (const b of rawBlocks) {
    if (!isObj(b)) return refuse();
    known(b, 'blocks[]', BLOCK, ignored);
    descriptive(b.boundary); descriptive(b.blocker);
    const id = text(b.id, 300), productId = text(b.product_id, 300);
    if (!productIds.has(productId)) refuse();
    const dependsOn = idList(b.depends_on);
    dependencyCount += dependsOn.length;
    let estimate: DeliveryRange | null = null;
    if (b.estimate !== undefined && b.estimate !== null) {
      const e = isObj(b.estimate) ? b.estimate : refuse();
      known(e, 'blocks[].estimate', ['min_minutes', 'max_minutes', 'basis', 'estimated_at'], ignored);
      const min = e.min_minutes, max = e.max_minutes;
      if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0 || min > max || max > 1e7) refuse();
      estimate = {minMinutes: min as number, maxMinutes: max as number, basis: text(e.basis, 2000), estimatedAt: optInstant(e.estimated_at)};
    }
    local.set(id, detail(b, 'blocks[]'));
    blocks.push({id, title: text(b.title, 500), productId, state: text(b.state, 80), dependsOn, ownerId: null,
      acceptance: textOrEmpty(b.acceptance), acceptanceIds: [], filesets: [], estimate, interval: null, results: [],
      sourceIds: cited(b.source_ids), checkpoint: null, promptRef: null, phase: null});
  }
  unique(blocks.map(b => b.id));
  const byId = new Map(blocks.map(b => [b.id, b]));

  // handoff.block_details carries owner, phase, filesets and checkpoint per block. A field given in both places must agree.
  const details = new Map<string, Detail>();
  for (const d of array(handoff.block_details, DELIVERY_VIEW_LIMITS.blocks)) {
    if (!isObj(d)) return refuse();
    known(d, 'handoff.block_details[]', BLOCK_DETAIL, ignored);
    for (const k of ['resources', 'deliverables', 'checks', 'model_class', 'model_reason']) descriptive(d[k]);
    // Tokens are not modelled: a supplied tokens value is listed and never read (TOKENS_UNKNOWN stays).
    if (d.tokens !== undefined && d.tokens !== null && !(isObj(d.tokens) && !Object.keys(d.tokens).length)) ignored.add('handoff.block_details[].tokens');
    const id = text(d.block_id, 300);
    if (!byId.has(id) || details.has(id)) refuse();
    details.set(id, detail(d, 'handoff.block_details[]'));
  }
  for (const b of blocks) {
    const a = local.get(b.id) ?? {}, c = details.get(b.id) ?? {};
    const merged: Detail = {...a};
    for (const [k, v] of Object.entries(c) as [keyof Detail, unknown][]) {
      if (k in a && JSON.stringify(a[k]) !== JSON.stringify(v)) refuse();
      (merged as Record<string, unknown>)[k] = v;
    }
    b.ownerId = merged.ownerId ?? null; b.phase = merged.phase ?? null; b.acceptanceIds = merged.acceptanceIds ?? [];
    b.filesets = merged.filesets ?? []; b.checkpoint = merged.checkpoint ?? null; b.promptRef = merged.promptRef ?? null;
    b.interval = merged.interval ?? null; b.results = merged.results ?? [];
  }

  // Top-level dependencies: {from, to} means `from` depends on `to`; merged into the block's dependsOn.
  for (const dep of array(input.dependencies, DELIVERY_VIEW_LIMITS.dependencies)) {
    if (!isObj(dep)) return refuse();
    known(dep, 'dependencies[]', ['from', 'to'], ignored);
    const from = byId.get(text(dep.from, 300)) ?? refuse(), to = text(dep.to, 300);
    if (!from.dependsOn.includes(to)) {from.dependsOn.push(to); dependencyCount++;}
  }
  if (dependencyCount > DELIVERY_VIEW_LIMITS.dependencies) refuse();
  for (const b of blocks) if (b.dependsOn.includes(b.id)) refuse();
  // Cycles over known blocks refuse the whole plan; a dependency on an unknown block is a named gap, not a cycle.
  const state = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    const s = state.get(id); if (s === 2) return; if (s === 1) refuse();
    state.set(id, 1);
    for (const d of byId.get(id)!.dependsOn) if (byId.has(d)) visit(d);
    state.set(id, 2);
  };
  for (const b of blocks) visit(b.id);

  return {schema: DELIVERY_VIEW_SCHEMA, title, capturedAt, visibility, sources, products, owners, blocks, sourceVector,
    ignoredFields: [...ignored].sort(), inputSha256: sha256Hex(raw)};
}

const normalisePath = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
/** The overlapping path when one equals the other or is a directory prefix of it; otherwise null. */
function overlap(a: string, b: string): string | null {
  const x = normalisePath(a), y = normalisePath(b);
  if (x === y) return x;
  if (!x || y.startsWith(x + '/')) return x;
  if (!y || x.startsWith(y + '/')) return y;
  return null;
}

/** Derived reading of a parsed plan for one audience. Gaps are named and never repaired; no date is computed. */
export function deliveryEvidence(view: DeliveryView, audience: 'author' | 'public'): DeliveryEvidence {
  const notice = REMAINING_NOTICE;
  if (audience === 'public' && view.visibility !== 'public') {
    return {audience, withheld: true, view: null, conflicts: [], gaps: [],
      remaining: {sumMinutes: null, dependencyLowerBoundMinutes: null, unestimated: [], calendar: 'UNKNOWN', notice}, intervals: [], results: []};
  }
  const blocks = view.blocks, byId = new Map(blocks.map(b => [b.id, b]));
  const ancestors = new Map<string, Set<string>>();
  const reach = (id: string): Set<string> => {
    const known = ancestors.get(id); if (known) return known;
    const out = new Set<string>(); ancestors.set(id, out);
    for (const d of byId.get(id)?.dependsOn ?? []) if (byId.has(d)) {out.add(d); for (const x of reach(d)) out.add(x);}
    return out;
  };

  const conflicts: OwnerConflict[] = [], seen = new Set<string>();
  const writes = blocks.flatMap((b, i) => b.filesets.filter(f => f.access === 'write').map(f => ({b, i, f})));
  const byRepository = new Map<string, typeof writes>();
  for (const w of writes) byRepository.set(w.f.repository, [...(byRepository.get(w.f.repository) ?? []), w]);
  for (const [repository, list] of byRepository) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const [p, q] = list[x].i <= list[y].i ? [list[x], list[y]] : [list[y], list[x]];
    if (p.b.id === q.b.id) continue;
    const path = overlap(p.f.path, q.f.path); if (path === null) continue;
    const key = JSON.stringify([repository, path, p.b.id, q.b.id]); if (seen.has(key)) continue; seen.add(key);
    conflicts.push({repository, path, blockIds: [p.b.id, q.b.id], owners: [p.b.ownerId, q.b.ownerId],
      ordered: reach(p.b.id).has(q.b.id) || reach(q.b.id).has(p.b.id)});
  }

  const gaps: NamedGap[] = [];
  const gap = (code: NamedGapCode, blockId: string | null, message: string) => gaps.push({code, blockId, message});
  for (const b of blocks) {
    if (!b.estimate) gap('NO_ESTIMATE', b.id, 'No estimate supplied for this block.');
    if (!b.acceptance.trim() && !b.acceptanceIds.length) gap('NO_ACCEPTANCE', b.id, 'No acceptance supplied for this block.');
    if (!b.sourceIds.length) gap('NO_SOURCE', b.id, 'No source cited for this block.');
    if (!b.interval) gap('NO_INTERVAL', b.id, 'No dated interval supplied; when this work happened is unknown.');
    if (!b.results.length) gap('NO_RESULT', b.id, 'No result or artifact reference supplied.');
    if (!b.ownerId) gap('NO_OWNER', b.id, 'No owner supplied for this block.');
    for (const d of b.dependsOn) if (!byId.has(d)) gap('UNKNOWN_DEPENDENCY', b.id, `Depends on “${d}”, which is not in this plan.`);
  }
  gap('TOKENS_UNKNOWN', null, 'Token use is not supplied or not modelled; it stays UNKNOWN.');
  gap('CALENDAR_UNKNOWN', null, 'No calendar is modelled; no start or finish date is computed.');

  const unfinished = blocks.filter(b => !FINISHED_STATES.has(b.state.trim().toLowerCase()));
  const open = new Set(unfinished.map(b => b.id));
  const estimated = unfinished.filter(b => b.estimate);
  const sumMinutes: [number, number] | null = estimated.length
    ? [estimated.reduce((s, b) => s + b.estimate!.minMinutes, 0), estimated.reduce((s, b) => s + b.estimate!.maxMinutes, 0)] : null;
  // Longest dependency chain over unfinished blocks; finished and unestimated blocks add zero, so this is a lower bound.
  const longest = new Map<string, [number, number]>();
  const chain = (id: string): [number, number] => {
    const memo = longest.get(id); if (memo) return memo;
    const b = byId.get(id)!, own: [number, number] = open.has(id) && b.estimate ? [b.estimate.minMinutes, b.estimate.maxMinutes] : [0, 0];
    let lo = 0, hi = 0;
    for (const d of b.dependsOn) if (byId.has(d)) {const [a, c] = chain(d); lo = Math.max(lo, a); hi = Math.max(hi, c);}
    const out: [number, number] = [own[0] + lo, own[1] + hi]; longest.set(id, out); return out;
  };
  let bound: [number, number] | null = null;
  if (sumMinutes) {bound = [0, 0]; for (const b of blocks) {const [a, c] = chain(b.id); bound = [Math.max(bound[0], a), Math.max(bound[1], c)];}}

  return {audience, withheld: false, view, conflicts, gaps,
    remaining: {sumMinutes, dependencyLowerBoundMinutes: bound, unestimated: unfinished.filter(b => !b.estimate).map(b => b.id), calendar: 'UNKNOWN', notice},
    intervals: blocks.filter(b => b.interval).map(b => ({blockId: b.id, interval: b.interval!})),
    results: blocks.flatMap(b => b.results.map(ref => ({blockId: b.id, ref})))};
}
