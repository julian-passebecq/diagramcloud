# Bounded manual completion

This implements a bounded part of `r3:completion-kit` / `journey-completion-kit`. It reuses the existing `diagramcloud.selected-context/1` derived context and the unchanged `diagramcloud.patch` version 1 response. It adds no Project fields, architecture store, AI provider, source collector or permission mechanism.

`createCompletionRequest(project, {requestId, question, audience, selection})` captures an explicit existing component and/or view. Audience is `author` or `public`; public projection runs **before** scope selection. Unknown IDs, a component outside the selected view and an empty selection are refused rather than widened. The question and copied source material are inert text. Nothing is transmitted automatically.

The strict derived descriptor contains base identity (`projectId`, `projectRevision`), selection, bounded components, evidence, sources, closed connections and observations. Its `completion` field contains a host-created request ID, question, audience, source references, exact writable paths, blocking needs, response schema, budgets, omissions and prohibitions. It contains no acquisition-wide readiness/asset report or unrelated source inventory. Connections crossing the selected boundary are counted as omitted; they do not widen scope. Current canonical connections have no `sourceIds` field; their endpoints must both remain in the bounded context. Image assets and internal `analysis-` receipts are omitted.

Whole rows are removed deterministically to meet 24 components, 12 evidence blocks, 24 sources, 40 connections, 24 observations and 65,536 UTF-8 bytes. Text is not silently shortened. Omission counts report missing rows from the permitted audience/selection only; omitted reference counts disclose pruning within that context. Included node/block source references point only to supplied sources. Observations whose complete backing does not fit are omitted. Public outputs contain no counts or identifiers of private objects.

The first policy permits only `replace` of selected components' `summary` / `role`. Author requests may also replace `text` on retained, selected author-provenance text blocks, provided the block is neither shared with an unselected component nor backing any external observation. **Public requests permit only nonblank projected captions**, independently of private sharing topology. Both genuinely empty and redacted public fields are read-only, so eligibility cannot disclose the distinction or overwrite hidden author text. Public patch failures use a generic error without underlying current values. Sources, basis, designed status, observations, structure, IDs, references, visibility, review, sharing, assets, delivery, permissions and model settings are not editable. Source-derived, synthetic and reference blocks are read-only. These are wording proposals; they cannot establish a missing fact or external verification.

## Existing patch response

`completionPatchTemplate(request)` returns a valid, test-only patch against the captured revision. It abstains, changes nothing and requires no revision increment. A candidate may use `test` at `/revision` or its exact writable field paths, plus `replace` at those paths. Whole-array writes, numerical-index aliases, `add`, `remove`, `copy` and `move` are refused. Values at writable fields must be strings and still pass canonical `validateDocument` limits. Patches are limited to 100 operations and 65,536 UTF-8 bytes.

The patch summary must use this bounded grammar:

```text
Provenance: author candidate; Sources: source-id-a,source-id-b; Limits: Wording suggestion only; runtime remains unknown.
```

Use `Sources: none` when no supplied source is cited. IDs are exact supplied source IDs, separated by commas without extra spaces. `Limits:` must contain nonblank text. The provenance label records a candidate authoring suggestion, not a verified source extraction or a review decision. This syntax validates the reference boundary and requires an explicit limitation; it cannot establish the truth of prose. The human still judges the candidate against supplied evidence. Credentials and `.env` contents are refused. Extra response fields such as grants or approvals are not part of the existing strict patch schema.

`previewCompletionPatch(project, trustedRequest, rawPatch)` accepts an object or JSON text and returns the existing `PatchResult<Project>` on a copy. It strictly parses the request, checks base project/revision, recreates the bounded context from the live project and compares it to the captured request, validates summary references and exact operation paths, then calls unchanged `applyDocumentPatch` / `validateDocument`. A source or scope change refuses the candidate. Even a valid source elsewhere in the same Project is outside this response's supplied scope.

The **host** captures the trusted request through an explicit selection. A response must never supply or choose that trust binding; a serialized descriptor is context, not a grant. Previewing twice has no effect. The host must call the same preview function again against the live Project at Apply and refuse a changed result. After a committed revision, replay of the old response is stale. Test-only abstention must not create an undo/save revision. No helper commits, saves, writes files, executes tools or marks a candidate reviewed.

## Studio integration

`CompletionKitPanel` takes `project`, `selection`, `publicMode` and optional `onReview(request)`. Prepare creates a transient request; download/copy and review reuse that request ID while its context, question and audience remain unchanged. A project-reference, revision, selection, question or audience change invalidates the prepared binding. Public mode fixes the audience to public. The user inspects the prepared payload and checks “I reviewed the selected context for disclosure” before copy/download or handing the captured request to the existing review workspace. The checkbox confirms disclosure review of the context, **not** acceptance of a returned patch.

The root host integrates this with its existing JSON / AI preview, stable-ID diff, live revision checks, explicit Apply and save/recovery flow. `onReview` only requests candidate review. It supplies no pre-reviewed patch and no execution or publication authority. Ordinary whole-project JSON / AI imports retain their existing behavior outside the completion-specific trust binding.

## Limits and original clauses

Original r3 `features.csv` row `completion-kit` and `ux.csv` key `journey-completion-kit` inherit `v2:agent-api` (F053–F057), `v2:storage` (F063, F111, F115) and `r2:agent-drafts` / `ux-agent-drafts`. R3 `CONTRACTS.md`, “Gap / CompletionRequest”, says the handoff examples are dossier-only, updates reuse the exact existing patch schema, an AI cannot approve its own patch, and a different base or unsupplied source is refused. R3 `SPEC.md`, “Completion IA”, requires explicit selection, confidentiality review and no automatic transmission.

This first caption/author-text policy does not implement structural completion, new source-derived entity/mapping extraction, remote grants, cross-host exactly-once draft storage or live MCP access to browser storage. Existing `ProjectBrief` remains the new-project declaration path; it does not replace an edited Project. Future extraction can reuse `stageEntityProposal` and exact selected citation checks under a separately bounded policy. Shared CLI/MCP/bridge wiring must call the same pure helpers when exposed; it must not claim unsupported host capabilities or treat a request ID as permission. No full V2 completion certification follows from this local slice.
