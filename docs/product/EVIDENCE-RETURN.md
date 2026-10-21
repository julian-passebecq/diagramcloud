> Historical lane-B adoption report for 1.32.0. The mounted App now uses these modules. For the next source contribution's
> corrected estimate/subtotal semantics, product relations, bounded conflict detection and explicit PM task links, read
> [delivery-task-reading](../contracts/delivery-task-reading.md). Original tests and residual statements below record that
> earlier source cut; they are not current package qualification.

# Evidence return (lane B)

Read-only evidence modules and panels for the 1.32 integration. Nothing here dispatches, launches, approves, schedules,
edits or executes anything, and nothing writes into a Project except `joinInspectionPatch`, which builds a patch for the
ordinary import review and never applies it. App.tsx is not changed by this lane; the integrator wires the panels.

All test fixtures are synthetic and labelled synthetic (`tests/fixtures/delivery-evidence/`, `tests/fixtures/history-questions/`).

## Exports

### `src/development/deliveryEvidence.ts` (new)

- `DELIVERY_VIEW_SCHEMA = 'delivery-view/1'`, `DELIVERY_VIEW_LIMITS` (bytes 262144, blocks 200, sources 100, products 20,
  owners 20, dependencies 2000, filesets 2000), `DELIVERY_VIEW_REFUSAL`, plus `REMAINING_NOTICE` and `IDENTITY_NOTICE`.
- Types `DeliveryBasis`, `DeliveryRange`, `DeliveryInterval`, `DeliveryResultRef`, `DeliveryFileset`, `DeliveryBlock`,
  `DeliverySourceIdentity`, `DeliveryView`, `OwnerConflict`, `NamedGapCode`, `NamedGap`, `DeliveryEvidence`, exactly as in
  the shared contract.
- `parseDeliveryView(raw)`: strict on known fields, tolerant of unknown ones (listed in `ignoredFields` as path patterns
  such as `blocks[].priority`, never read). Refuses the whole input with `DELIVERY_VIEW_REFUSAL` on invalid JSON, another
  schema, a duplicate ID, a cyclic `depends_on`, out-of-range minutes (negative, non-finite, min > max), an invalid
  instant, an interval that ends before it starts, an unknown product, owner or source reference, or a field given in
  both a block and `handoff.block_details` with different values. `inputSha256` is `sha256Hex` of the supplied text.
  - Owner, phase, acceptance IDs, filesets, checkpoint, prompt ref, interval and results are read from the block or from
    `handoff.block_details[]` (keyed by `block_id`).
  - Top-level `dependencies[]` entries are `{from, to}` and mean "`from` depends on `to`"; they are merged into `dependsOn`.
  - A dependency on a block that is not in the plan is kept and named (`UNKNOWN_DEPENDENCY`); it is not a refusal.
- `deliveryEvidence(view, audience)`:
  - Owner conflicts: two blocks writing the same repository + path, or one path a directory prefix of the other
    (`src/api` and `src/api/routes.ts`, never `src/apis`). `ordered` is true only when one block transitively depends on
    the other; the panel shows it as "Sequential (dependency order)", never as conflict-free. Reads never conflict, and
    no conflict is inferred from titles or owners.
  - Named gaps, never repaired: `NO_ESTIMATE`, `NO_ACCEPTANCE`, `NO_SOURCE`, `NO_INTERVAL`, `NO_RESULT`, `NO_OWNER`,
    `UNKNOWN_DEPENDENCY` per block; `TOKENS_UNKNOWN` and `CALENDAR_UNKNOWN` always (see residual gaps).
  - Remaining effort over unfinished blocks (state not `done`, `delivered` or `merged`, case-insensitive): `sumMinutes`
    `[Σmin, Σmax]`, `dependencyLowerBoundMinutes` (longest `depends_on` chain, min and max separately; finished and
    unestimated blocks add zero), `unestimated`, `calendar: 'UNKNOWN'` and the notice "Uncalibrated allowance, not a
    measurement, schedule or date; ignores queues, access and shared workers." No date is ever computed.
  - Intervals and result refs are only those supplied, with their own basis and sources; the timezone is kept as text and
    the instants are never shifted. A DECLARED basis is shown as DECLARED.
  - Public audience: a `private` plan gives `withheld: true`, `view: null` and no rows.

### `src/development/historyLens.ts` (additions; existing exports unchanged)

- `HISTORY_QUESTIONS = ['ancestry','associations','attempts','impact','lineage']`, `HistoryQuestion`,
  `HISTORY_QUESTION_LABELS` (plain names for the select), `HISTORY_SLICE_LIMITS` (bytes 2097152, records 5000).
- `parseHistorySlice(raw)`: bounded, strict (unknown keys refuse), then the existing record validation and topology check;
  any failure refuses the whole input with the existing "Invalid history projection input" error.
- `answerHistoryQuestion(slice, question, audience, componentIds?)` returns `HistoryAnswer`. The public filter runs first,
  inside the existing `checkedRecords`, before any question reads a record.
  - ancestry: the existing `projectHistory` rows (native parents only, generic boundaries; first 500 revisions).
  - associations: groups by `feature`, `problem`, `decision`; rows carry ancestry `not-applicable` and lane 0, no edges.
  - attempts: `attempt` records and records with a `run` facet, in `occurredAt` order; keys of records without a time are
    in `unresolved`, never placed.
  - impact: `surface` and `path` values that equal a permitted component ID exactly become `componentMatches`; every other
    value is listed in `unresolved`. No label, case or prefix match.
  - lineage: groups by `release`, `artifact`, `check`, `review`.
  - A question with no supplied facts answers `answerable: false` with the missing facet names in `missing`.

### `src/intelligence/joinInspection.ts` (additions)

- `JoinEvidenceView`, `JOIN_EVIDENCE_SUFFIXES`.
- `readJoinEvidence(doc, nodeId)`: `doc` is the already permitted projection (pass `publicDocument(...)` for Portfolio or
  Present). Null unless all six `${prefix}.left/right/logic/output/mapping/rules` blocks are on the node, resolve, have the
  expected shapes and share one provenance. Counts are read from the rules and mapping tables; `consistent` is false when
  the mapping's output rows do not add up to the rules' "Calculated output rows" (shown, never fixed). The review
  example reads 42 → 70.
- `joinInspectionPatch(project, nodeId, result)`: a revision-guarded `diagramcloud.patch` (test of the node ID, then adds
  the six private `joinInspectionBlocks` and their IDs on the node). Refuses an unknown node or an existing block ID with
  the same prefix. Tests validate it with `applyDocumentPatch` without applying it to the App.

## Panels and the App state each needs

Styles: the panels import no CSS (so node tests can render them). The integrator imports `src/ui/evidencePanels.css` once
in App (`import './ui/evidencePanels.css';`). `HistoryLensPanel` no longer imports `perspectiveBar.css`; `PerspectiveBar`
still imports it, so the App bundle is unchanged.

### `src/ui/DeliveryEvidencePanel.tsx`

```ts
export type DeliveryEvidencePanelProps = {view: DeliveryView | null; audience: 'author' | 'public'; binding: PerspectiveBinding;
  compact?: boolean; fileName?: string;
  onLoad?: (raw: string, fileName: string, issuedAt: PerspectiveBinding) => void;
  onClear?: () => void;
  onSelectBlock?: (blockId: string, issuedAt: PerspectiveBinding) => void};
```

- App state: `perspectiveBinding`; `audience` (Portfolio or Present → `'public'`); `compact = frameSize.width <= 1200`; a
  session-only `deliveryPlan: {view: DeliveryView; fileName: string} | null` kept in App, never written into the Project.
- `onLoad` is called only after the panel has parsed the file (≤ 256 KiB) with `parseDeliveryView`; the App re-parses
  `raw` with `parseDeliveryView` to store the view, and ignores the call when `issuedAt` differs from the current binding.
  A refused file shows `DELIVERY_VIEW_REFUSAL` inside the panel as `role=alert`.
- Sections in order: source identity (title, captured, file, input SHA-256 with "identity of bytes, not authenticity or
  authority", source vector, cited sources, checkpoint and prompt refs as supplied text, fields not read), blocks, owner
  conflicts, named gaps, remaining effort and notice, dated intervals, result and artifact refs. `compact` uses `<details>`.
- No dispatch, launch, approve or edit control. Every callback passes a copy of the binding it was issued at.

### `src/ui/HistoryLensPanel.tsx`

Existing props are unchanged (the current App compiles and renders as before). New optional props:
`question?`, `onQuestion?(q, issuedAt)`, `componentIds?`, `onSelectComponent?(componentId, issuedAt)`,
`onLoadSlice?(raw, issuedAt)`.

- App state: the slice (`atlasHistorySlice(doc)` or a session-loaded slice from `parseHistorySlice(raw)`), the
  `perspectiveBinding`, `doc.nodes.map(n => n.id)` from the permitted doc as `componentIds`, and `navigateNode` for
  `onSelectComponent` (after checking `issuedAt`).
- The "History question" select appears only when `onQuestion` is given; "Load history records" (≤ 2 MiB) only when
  `onLoadSlice` is given. Ancestry is the existing lane chart; the other four questions render a list above it.

### `src/ui/JoinInspectionPanel.tsx`

```ts
export type JoinInspectionPanelProps = {doc: Project; nodeId: string; binding: PerspectiveBinding; compact?: boolean; onOpenBlock?: (blockId: string) => void};
export type JoinRequestPanelProps = {project: Project; nodeId: string | null; binding: PerspectiveBinding; onStage: (patch: Patch, issuedAt: PerspectiveBinding) => void};
```

- `JoinInspectionPanel`: read-only; renders nothing when `readJoinEvidence` returns null. App state: `doc` (permitted
  projection), `selected` as `nodeId`, `perspectiveBinding`. Order: input rows, output rows, measure before → after,
  fanout rows, unmatched left rows, grain violations, per-row provenance, limits, synthetic label.
- `JoinRequestPanel`: Edit mode only (`mode === 'Edit'`), with `project` (author document), `selected`,
  `perspectiveBinding`, and `onStage` wired to the existing `stagePatch` (ordinary import review) after checking
  `issuedAt`. It reads a `joinInspectionSchema` JSON file (≤ 1 MiB), runs `inspectJoin` and shows the result. It never
  applies the patch or executes SQL.

## Tests

- `tests/delivery-evidence.test.ts` (7), `tests/history-lens.test.ts` (37 existing + 5), `tests/join-inspection.test.ts`
  (35 existing + 4); regressions `tests/history.test.ts` and `tests/git-history.test.ts`.
- These are source tests (modules plus server-rendered panels). They are not App verification: no panel is mounted in the
  App by this lane and no browser test covers them yet.

## Residual gaps

- Token use and calendars are not modelled by this reading: a supplied `tokens` value or `handoff.calendar` is listed in
  `ignoredFields` and `TOKENS_UNKNOWN` / `CALENDAR_UNKNOWN` stay present. No date is ever derived.
- `ignoredFields` names unknown key paths only; descriptive known fields (mission, boundary, blocker, resources,
  deliverables, checks, model hints) are type-checked and not shown.
- Finished states are the three supplied words `done`, `delivered`, `merged`; any other state counts as unfinished.
- The dependency lower bound treats unestimated blocks as zero, so it is a lower bound only.
- History `impact` matches exact component IDs only; a path such as `src/api/routes.ts` stays unresolved even when a
  component clearly owns it.
- The ancestry answer covers the first 500 revisions and says so; the lane chart pages as before.
- No App wiring, browser test or e2e spec for these panels in this lane (integrator).
