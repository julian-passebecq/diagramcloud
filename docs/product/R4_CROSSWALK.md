# R4 crosswalk: work packages and acceptance to code and tests (1.26.0)

**Scope.** This maps the R4 implementation packet (DiagramCloud_Implementation_R4_2026-10-16: `execution/work-packages.json`, `qualification/new-acceptance.json` and the unchanged inherited rows in `qualification/inherited-acceptance.json`) to what `main` holds at 1.26.0. The packet itself stays outside the repository. 1.26.0 is a **bounded learning milestone, not a complete V2**: the original product acceptance IDs (F001-F115, DG rows in [outcome.json](../../outcome.json)) remain authoritative and unchanged, and R4 IDs are supplemental planning labels.

**Status rule.** `implemented` means at least one named test asserts the clause's core, and every such test is cited as `` `file` "exact test title" `` (`tests/r4-crosswalk.test.ts` checks that each cited file exists and contains that title). `partial` means code or content exists but a clause is not covered by a test, or only part of it is implemented. `not implemented` means no code. `unmapped` means no code or test in this repository could be tied to the row; it is left visible rather than guessed. Nothing here is owner verification.

## Work packages

| ID | Title | Status | Evidence |
|---|---|---|---|
| R4-W0 | Reconcile and preserve | partial | Process step, not code: the five local commits and the old Codex worktrees were preserved in a private recovery bundle and receipt (see [Local branch recovery disposition](#local-branch-recovery-disposition)). No automated test; no commit was cherry-picked, reset, deleted or pushed. |
| R4-W1 | Catalogue contract and kinds | implemented | [PR #63](https://github.com/julian-passebecq/diagramcloud/pull/63), `src/intelligence/learning/catalogue.ts`. `tests/learning-catalogue.test.ts` "entry kinds are never silently coerced into each other"; `tests/learning-catalogue.test.ts` "legacy matcher output is byte-identical to the snapshot recorded before the catalogue extension" |
| R4-W2 | Twelve worked references | implemented | [PR #63](https://github.com/julian-passebecq/diagramcloud/pull/63), `src/intelligence/learning/cards.ts`, `src/ui/LearningCatalogue.tsx`. `tests/learning-catalogue.test.ts` "twelve authored lessons adopt as typed entries; legacy pattern and recipe entries decode unchanged"; `tests/e2e/learning-catalogue.spec.ts` "learning catalogue opens a warehouse lesson and the RAG lesson, changes depth and reveals hints" |
| R4-W3 | Concept to instance navigation | implemented | [PR #65](https://github.com/julian-passebecq/diagramcloud/pull/65), `src/intelligence/learning/mappings.ts`, `src/core/learningMapping.ts`. `tests/learning-mappings.test.ts` "reviewed mapping opens the exact component in a reachable view; Explained by links back"; `tests/e2e/learning-instance.spec.ts` "lesson -> In my project -> exact component -> back to the same lesson, depth and content revision" |
| R4-W4 | Inherited choices and code drawer | implemented | [PR #64](https://github.com/julian-passebecq/diagramcloud/pull/64), `src/core/jsonDraft.ts`, `src/ui/JsonDrawer.tsx`. `tests/json-drawer.test.ts` "draft: apply is one revision and one Undo restores the applied model"; `tests/e2e/json-drawer.spec.ts` "JSON drawer: invalid keeps the last valid preview and applies nothing; valid applies once, Undo restores, reload persists". R3-02 variants are not part of it (see R3-AC-04..06). |
| R4-W5 | Three real adoption journeys | implemented | [PR #66](https://github.com/julian-passebecq/diagramcloud/pull/66), `src/intelligence/learning/journeys.ts`, `src/intelligence/learning/gaps.ts`. `tests/adoption-journeys.test.ts` "adoption journeys: three valid gallery projects, registered with stable IDs, none observed"; `tests/e2e/adoption-journeys.spec.ts` "adoption journeys: catalogue lesson and example, self-description mapping round trip, Galaxy and FOIL samples, drawer edit to public export" |
| R4-W6 | Qualify and deliver | implemented | This release: version 1.26.0, [release notes](../release-1.26/RELEASE_NOTES.md), this crosswalk. `tests/r4-crosswalk.test.ts` "every R4 work package, new and inherited acceptance row is listed once with a known status"; `tests/r4-crosswalk.test.ts` "every implemented row cites at least one existing test by its exact title". Gate results and the candidate artifact hash are in the release PR. |
| R4-W7 | Optional external adapters | not implemented | Optional and not a prerequisite. No T3, remote MCP or local-model adapter was added. The existing local stdio MCP (`scripts/intelligence-mcp.ts`) is unchanged. |

## New acceptance (R4-AC)

| ID | Key | Status | Evidence |
|---|---|---|---|
| R4-AC-01 | catalogue-without-project | partial | The catalogue reads no Project and needs no Git, cloud or AI: `tests/e2e/learning-catalogue.spec.ts` "learning catalogue opens a warehouse lesson and the RAG lesson, changes depth and reveals hints". Gap: it is reached through Business overview, which shows the default sample project; there is no project-less entry route. |
| R4-AC-02 | basic-profile | implemented | `tests/learning-mappings.test.ts` "a basic document stays valid without mappings and publishes none"; `tests/json-drawer.test.ts` "choices: a legacy document without choices stays valid and unchanged" |
| R4-AC-03 | legacy-guidance | implemented | `tests/learning-catalogue.test.ts` "legacy matcher output is byte-identical to the snapshot recorded before the catalogue extension"; `tests/pattern-guidance.test.ts` "legacy schemas remain readable while duplicate registry identities and guidance bindings are refused" |
| R4-AC-04 | entry-kinds | implemented | `tests/learning-catalogue.test.ts` "entry kinds are never silently coerced into each other"; `tests/learning-catalogue.test.ts` "unknown future kinds are visible omissions, not crashes, in decoding and in the catalogue UI" |
| R4-AC-05 | old-topic-provenance | implemented | `tests/learning-catalogue.test.ts` "new topics carry editorial metadata, never the five source-pinned families; native cards are linked, not overwritten" |
| R4-AC-06 | reference-scope | implemented | `tests/learning-catalogue.test.ts` "synthetic learning examples compile through the native brief compiler into labelled, collision-free candidates" (no observations, synthetic blocks, planned basis only) |
| R4-AC-07 | safe-instantiation | implemented | `tests/learning-catalogue.test.ts` "synthetic learning examples compile through the native brief compiler into labelled, collision-free candidates"; the example is a JSON download that goes through the ordinary import review: `tests/e2e/learning-catalogue.spec.ts` "learning catalogue opens a warehouse lesson and the RAG lesson, changes depth and reveals hints" |
| R4-AC-08 | mapping-evidence | implemented | `tests/learning-mappings.test.ts` "a name-only match stays a candidate: no evidence, no review" |
| R4-AC-09 | mapping-roundtrip | implemented | `tests/learning-mappings.test.ts` "a suggestion binds exact revisions and cannot arrive reviewed"; `tests/e2e/learning-instance.spec.ts` "lesson -> In my project -> exact component -> back to the same lesson, depth and content revision" |
| R4-AC-10 | stale-mapping | implemented | `tests/learning-mappings.test.ts` "content revision, target evidence or target removal make a mapping stale, never silently rebound" |
| R4-AC-11 | private-mapping | implemented | `tests/learning-mappings.test.ts` "public projection first: hidden components, views and private evidence never appear in lists, counts, search or exports" |
| R4-AC-12 | semantic-depth | partial | Depth changes the explanation only: `tests/e2e/learning-catalogue.spec.ts` "learning catalogue opens a warehouse lesson and the RAG lesson, changes depth and reveals hints"; the return path keeps the depth: `tests/e2e/learning-instance.spec.ts` "lesson -> In my project -> exact component -> back to the same lesson, depth and content revision". Gap: no test asserts that environment, variant, run and audience stay unchanged (variants do not exist yet). |
| R4-AC-13 | view-availability | partial | Missing inputs are named and the figure they hold back is listed: `tests/adoption-journeys.test.ts` "explanation gaps: timing, quantities and mappings are named as missing instead of drawn". Gap: Diagram Design renderers still draw a Sankey or timeline when explicitly asked; they are not hard-withheld. |
| R4-AC-14 | measurement | partial | Sankey: `tests/design-sankey.test.ts` "sankey: no quantities is an empty state that says how to add one"; `tests/design-sankey.test.ts` "sankey: different units are never summed; the minority unit is listed in a note". Gap: there is no scheduled Gantt figure, so dates or declared estimates are not checked; timing is only reported missing. |
| R4-AC-15 | teaching-vs-run | partial | `tests/adoption-journeys.test.ts` "Galaxy process: procedure, synthetic attempt, lesson and live process stay distinct; nothing pretends to be a run". Gap: no step playback exists, so its labelling is untested. |
| R4-AC-16 | weights-vs-context | partial | Authored lesson `training-inference-rag` (`src/intelligence/learning/cards.ts`) separates training/fine-tuning from retrieval/inference; it opens in `tests/e2e/learning-catalogue.spec.ts`. Gap: no test asserts the two paths stay distinct. |
| R4-AC-17 | graph-vs-brain | partial | Authored lesson `graph-memory` exists. Gap: no test asserts it never claims the local Brain uses GraphRAG; there is no Brain format (`contextRefs` is the slot). |
| R4-AC-18 | grain-fixture | partial | `tests/learning-catalogue.test.ts` "SCD temporal join arithmetic: June maps to North, August to South, sales total 35, overlaps fail visibly" (order-line total 35). Gap: no test shows that a multiplying join is detected or refused. |
| R4-AC-19 | temporal-fixture | implemented | `tests/learning-catalogue.test.ts` "SCD temporal join arithmetic: June maps to North, August to South, sales total 35, overlaps fail visibly" |
| R4-AC-20 | scion-identity | partial | `tests/learning-catalogue.test.ts` "the Scion card stays a dated Anthropic case study, distinct from GoogleCloudPlatform Scion and never a dependency". Gap: SCION networking and the investment search result are not asserted. |
| R4-AC-21 | source-study | implemented | `tests/learning-catalogue.test.ts` "the Scion card stays a dated Anthropic case study, distinct from GoogleCloudPlatform Scion and never a dependency" (provider-reported basis, retrieval date, not a dependency) |
| R4-AC-22 | no-code-execution | partial | Lessons render snippets as text and have no run action (`src/ui/LearningCatalogue.tsx`); browsing leaves the document unchanged in `tests/e2e/learning-catalogue.spec.ts`. Gap: no test asserts that a snippet is inert. |
| R4-AC-23 | interview | implemented | `tests/e2e/learning-catalogue.spec.ts` "learning catalogue opens a warehouse lesson and the RAG lesson, changes depth and reveals hints" (reveal shows hints; the project JSON is byte-identical afterwards; no certification state exists) |
| R4-AC-24 | content-pins | implemented | `tests/learning-mappings.test.ts` "public projection first: hidden components, views and private evidence never appear in lists, counts, search or exports" (saved explanation carries the lesson `contentRevision`); `tests/learning-mappings.test.ts` "content revision, target evidence or target removal make a mapping stale, never silently rebound" |
| R4-AC-25 | retrieval-parity | not implemented | The catalogue is reachable from the UI and the TypeScript module only. No CLI or MCP catalogue lookup exists, and no AI tool calls `suggestMapping` yet. |
| R4-AC-26 | core-journey | implemented | `tests/e2e/adoption-journeys.spec.ts` "adoption journeys: catalogue lesson and example, self-description mapping round trip, Galaxy and FOIL samples, drawer edit to public export" (edit, save, reload, reopen, export); `tests/adoption-journeys.test.ts` "adoption journeys: three valid gallery projects, registered with stable IDs, none observed" |
| R4-AC-27 | local-remainder | partial | Dispositioned before any cleanup, privately (bundle and receipt, see below); nothing cherry-picked or exported. Process evidence only, no automated test. |
| R4-AC-28 | original-scope | implemented | This document lists every R4, inherited R3 and R2 ID; `tests/r4-crosswalk.test.ts` "every R4 work package, new and inherited acceptance row is listed once with a known status". It states that 1.26.0 is not a complete V2. |

## Inherited R3 acceptance

| ID | Feature | Status | Evidence |
|---|---|---|---|
| R3-AC-01 | R3-01 | implemented | `tests/json-drawer.test.ts` "choices: a legacy document without choices stays valid and unchanged" |
| R3-AC-02 | R3-01 | implemented | `tests/json-drawer.test.ts` "choices: validateDocument checks options, status and sources; no numeric score field exists" (a recommendation is a separate field; a candidate cannot carry a chosen option; acceptance needs decidedBy and decidedAt) |
| R3-AC-03 | R3-01 | partial | An imported accepted decision keeps decidedBy/decidedAt: `tests/json-drawer.test.ts` "choices: validateDocument checks options, status and sources; no numeric score field exists". Gap: no test shows that a silent rewrite of it is refused. |
| R3-AC-04 | R3-02 | not implemented | Variants were not part of R4-W4. |
| R3-AC-05 | R3-02 | not implemented | Variants were not part of R4-W4. |
| R3-AC-06 | R3-02 | not implemented | Variants were not part of R4-W4. |
| R3-AC-07 | R3-03 | implemented | `tests/json-drawer.test.ts` "draft: invalid JSON or an invalid document is a result, and the applied project is never mutated"; `tests/e2e/json-drawer.spec.ts` "JSON drawer: invalid keeps the last valid preview and applies nothing; valid applies once, Undo restores, reload persists" |
| R3-AC-08 | R3-03 | implemented | `tests/json-drawer.test.ts` "validation: debounced, cancelable, and a late result for an older draft never wins" |
| R3-AC-09 | R3-03 | implemented | `tests/json-drawer.test.ts` "draft: apply is one revision and one Undo restores the applied model" |
| R3-AC-10 | R3-03 | implemented | `tests/json-drawer.test.ts` "draft: a stale revision or a changed live project is refused without mutation"; `tests/e2e/json-drawer.spec.ts` "JSON drawer: a concurrent visual edit makes Apply refuse visibly; public modes never show the drawer" |
| R3-AC-11 | R3-03 | partial | Implemented in `src/ui/JsonDrawer.tsx` (an edited draft is kept, its Apply refused, with an explicit Discard). Gap: no test switches project while a draft is open. |
| R3-AC-12 | R3-04 | implemented | `tests/json-drawer.test.ts` "draft: a component draft maps by exact stable ID, reports absence, and cannot replace hidden facts" |
| R3-AC-13 | R3-05 | partial | The MCP server reuses the document validators: `tests/mcp-client.test.ts` "selected-file stdio MCP initializes, queries public facts and rejects mutation/paths". Gap: no test compares CLI, manual and MCP validation results. |
| R3-AC-14 | R3-05 | partial | `tests/mcp-client.test.ts` "selected-file stdio MCP initializes, queries public facts and rejects mutation/paths". Gap: "cannot launch a provider" is not asserted separately. |
| R3-AC-15 | R3-05 | partial | For mappings: `tests/learning-mappings.test.ts` "a suggestion binds exact revisions and cannot arrive reviewed"; `tests/learning-mappings.test.ts` "no self-review: an AI suggestion is reviewed only by a person". Gap: not tested for other proposal kinds as one rule. |
| R3-AC-16 | R3-05 | partial | `tests/json-drawer.test.ts` "draft: a stale revision or a changed live project is refused without mutation"; `tests/recipes-verification.test.ts` "external exact revision receipt stages private unreviewed evidence and cannot silently repeat". Gap: no generic replay test for every request path. |
| R3-AC-17 | R3-06 | partial | `tests/adoption-journeys.test.ts` "self-description: only static-source components, each citing a real file:line of this repository" (built-in, static, no T3 or Brain). Gap: the browser test does not block the network. |
| R3-AC-18 | R3-06 | partial | No-Git learning: `tests/e2e/learning-catalogue.spec.ts` "learning catalogue opens a warehouse lesson and the RAG lesson, changes depth and reveals hints". Gap: "complete for selected purpose" is not defined by a test. |
| R3-AC-19 | R3-06 | implemented | `tests/adoption-journeys.test.ts` "FOIL slice: environments are instances, refinement is separate, PROD has no declared realization"; `tests/e2e/adoption-journeys.spec.ts` "adoption journeys: catalogue lesson and example, self-description mapping round trip, Galaxy and FOIL samples, drawer edit to public export" (macro view without Bronze) |
| R3-AC-20 | R3-07 | partial | For mappings: `tests/learning-mappings.test.ts` "content revision, target evidence or target removal make a mapping stale, never silently rebound". Gap: assumptions in general have no review-need state. |
| R3-AC-21 | R3-08 | partial | `tests/pattern-guidance.test.ts` "selected authored cards retain native identities, distinct alternatives and unknown applicability". Gap: no substitution check reports UNKNOWN explicitly. |
| R3-AC-22 | R3-09 | unmapped | No comparison separating layout, design and implementation was found. |
| R3-AC-23 | R3-09 | partial | `tests/concept-host.test.ts` "navigation rejects ambiguous mappings while inspection preserves them". Gap: linked selection between candidates (R3-09) does not exist. |
| R3-AC-24 | R3-10 | unmapped | Concept preview build failure handling is not covered by a test (R4-W7 scope). |
| R3-AC-25 | R3-10 | partial | `tests/concept-host.test.ts` "loopback server limits routes and hosts, binds separate origins, blocks viewer network and never enables CORS". Gap: shell and credential isolation are not asserted (R4-W7 scope). |
| R3-AC-26 | R3-10 | unmapped | No test about `datapass.preview/1` naming (R4-W7 scope). |
| R3-AC-27 | R3-11 | not implemented | No local model (R4-W7). |
| R3-AC-28 | R3-12 | not implemented | No remote transport; only local stdio MCP (R4-W7). |
| R3-AC-29 | R3-13 | implemented | `tests/design-sankey.test.ts` "sankey: different units are never summed; the minority unit is listed in a note"; `tests/navigation-intelligence.test.ts` "empty relation scope stays available with zero totals and unknown quantity never becomes a synthetic amount" |
| R3-AC-30 | R3-13 | unmapped | No measured-saving feature exists. |
| R3-AC-31 | R3-14 | implemented | `tests/json-drawer.test.ts` "draft: a component draft maps by exact stable ID, reports absence, and cannot replace hidden facts" |
| R3-AC-32 | R3-15 | implemented | `tests/json-drawer.test.ts` "choices: publicDocument keeps public choices only and never publishes a private citation" |
| R3-AC-33 | R3-15 | not implemented | Tours are not started. |

## Inherited R2 acceptance

Most R2 rows describe Galaxy/Brain/Git product scope wider than DiagramCloud. A row is `partial` when existing tests cover a nearby clause, never the whole row.

| ID | Title | Status | Evidence |
|---|---|---|---|
| AC01 | Small independent pack | partial | `tests/acquisition.test.ts` "empty, unknown and docs-only folders produce validated useful candidates". Gap: L1 profile level is not modelled. |
| AC02 | Mixed profiles | unmapped | No profile-depth model. |
| AC03 | Artifact entry | unmapped | No artifact-first entry route. |
| AC04 | Shared membership | partial | `tests/core.test.ts` "component reuse adds only exact existing membership and authored position, with one ordinary Undo and no fact clones". Gap: products and unique vs membership counts. |
| AC05 | Hierarchy versus relation | partial | `tests/core.test.ts` "one-view removal refuses newly unreachable child views but permits a still-reachable alternate parent without deleting facts". Gap: explicit parent choice UI. |
| AC06 | Cross-lens context | partial | `tests/e2e/navigation-context.spec.ts` "session return restores exact edge and output sheet while parent truncation Pin source and persisted Project stay independent". Gap: environment/snapshot persistence across lenses. |
| AC07 | History and arrows | partial | `tests/navigation-intelligence.test.ts` "existing session history records two connection selections and visible sheets without substituting authoring Undo". Gap: step rail and sibling arrows. |
| AC08 | Definition versus occurrence | partial | `tests/adoption-journeys.test.ts` "Galaxy process: procedure, synthetic attempt, lesson and live process stay distinct; nothing pretends to be a run". Gap: no workflow animation exists. |
| AC09 | Retries and partial execution | unmapped | Only one synthetic attempt exists; no retry/cancel/timeout run model. |
| AC10 | Rule versus enforcement | partial | `tests/recipes-verification.test.ts` "host-fed cockpit requires explicit scope and fresh permission, never creates verified claim". Gap: instruction files as input. |
| AC11 | Brain evidence | not implemented | No Brain format yet (`contextRefs` is the slot). |
| AC12 | Agent attribution | unmapped | No session-to-file attribution feature. |
| AC13 | Git minimap loss | partial | `tests/atlas.test.ts` "Lens minimap: observed Git and delivery pointers in a new snapshot; components untouched; unknown repositories never added; scans go stale when the head moves". DiagramCloud never draws a commit graph (AGENTS.md). |
| AC14 | Git parent identity | not implemented | No commit-parent edges by design. |
| AC15 | Host return | partial | `tests/context-pin.test.ts` "wrong project, malformed pointers and unknown identities return a generic unavailable result". Gap: unavailable revision with preserved return payload. |
| AC16 | Private intake | unmapped | No intake target with media identifiers. |
| AC17 | Duplicate and integrity | unmapped | No near-duplicate or ETag handling. |
| AC18 | Uncertain writes | partial | `tests/bridge.test.ts` "write refuses when the repository file changed since it was read and leaves it untouched". Gap: unknown acknowledgement state. |
| AC19 | Artifact after failure | implemented | `tests/receipt.test.ts` "a failed check makes the receipt failed and caps the level" |
| AC20 | Environment scope | partial | `tests/adoption-journeys.test.ts` "FOIL slice: environments are instances, refinement is separate, PROD has no declared realization"; `tests/zoo-matrix.test.ts` "Z020 custom Dev/Test/Stage/Prod names and flags remain declarations at separate source revisions". Gap: a reported TEST pass as input. |
| AC21 | Local-cloud mapping | partial | `tests/adoption-journeys.test.ts` "FOIL slice: environments are instances, refinement is separate, PROD has no declared realization". Gap: equivalence evidence. |
| AC22 | Data layers | partial | `tests/adoption-journeys.test.ts` "FOIL slice: environments are instances, refinement is separate, PROD has no declared realization". Gap: dbt/Spark/SQL roles. |
| AC23 | Gantt evidence | partial | Timing is reported missing: `tests/adoption-journeys.test.ts` "explanation gaps: timing, quantities and mappings are named as missing instead of drawn". Gap: no Gantt figure. |
| AC24 | Sankey evidence | partial | `tests/quantity.test.ts` "quantity: optional, strict, finite, non-negative; existing documents unchanged"; `tests/design-sankey.test.ts` "sankey: different units are never summed; the minority unit is listed in a note". Gap: duplicate weights. |
| AC25 | Public noninterference | partial | `tests/pattern-guidance.test.ts` "public advice and recognition do not change when invisible private facts, tags and citations are added"; `tests/completion-kit.test.ts` "public payload has no private sentinels, counts or eligibility side channel". Gap: layouts and route errors. |
| AC26 | Story stability | unmapped | No test for a removed story anchor. |
| AC27 | Persistence | partial | `tests/graph-client.test.ts` "generation reimport retains author text, publication, evidence, positions and revision guard". Gap: duplicate decisions and selected context. |
| AC28 | Scale and cancellation | partial | `tests/acquisition.test.ts` "cancel before/during reading yields AbortError and no candidate"; `tests/core.test.ts` "allow cyclic data flow and terminate tracing". |
| AC29 | Accessible spatial mode | partial | `tests/e2e/concept-host.spec.ts` "unavailable WebGL retains explicit useful SVG modes and accessible controls"; `tests/e2e/react-viewer.spec.ts` "native 2D fallback and explicit read-only requests remain keyboard-usable at 390px without storage or WebGL". |
| AC30 | Schema compatibility | partial | `tests/learning-catalogue.test.ts` "unknown future kinds are visible omissions, not crashes, in decoding and in the catalogue UI". Gap: unknown optional document modules in general. |

## Local branch recovery disposition

Copied from the R4-W0 report. For a public page, absolute host paths are replaced: `.local/` means the main checkout's gitignored `.local/` folder, and `<codex-worktrees>` stands for the local Codex worktree directory. The bundle and receipt are private and are not in this repository.

Branch `feat/development-atlas-core` is 5 commits ahead of and 48 behind `origin/main` (`ee1303a`). Its worktree had no uncommitted or untracked files; only ignored build directories (`dist/`, `node_modules/`, `playwright-report/`, generated `public/` files). Nothing was cherry-picked, reset or deleted, and nothing was pushed.

**Recovery bundle (private, gitignored, never pushed)**
- Path: `.local/recovery/development-atlas-core-2026-10-16.bundle`
- Range: `origin/main..feat/development-atlas-core`
- `git bundle verify`: okay
- sha256: `23a5da677b1050c5f28d958d29d7ff4e0e838d9c8168f2650994654b6fedc22d`
- Receipt (bundle hash, dispositions, per-file hashes): `.local/recovery/RECEIPT.json`

**Comparison with `origin/main`:** main has no `src/development/`, no `packages/` directory, and no `development-atlas` string in any tracked source or doc. The existing atlas code on main (`src/core/atlas/*`, `src/export/design/atlas.ts`, `src/ui/Atlas.tsx`) is a different thing: the project atlas, built from repository manifests and snapshots. It does not cover the runtime `development-atlas/1` contract, so none of the 5 commits is already represented.

| Commit | Subject | Disposition | Evidence |
|---|---|---|---|
| `ced0150` | feat: expose shared Diagram Core for factual development atlas views | Useful donor | Adds `src/development/contracts.ts` (zod `development-atlas/1`, 500 entities / 1,500 relations / 2 MiB limits, dangling-ID and evidence checks). Adds `src/development/index.ts` (`atlasToDiagramDocument`, `buildDevelopmentView`, `renderDevelopmentSvg`, `compareDevelopmentViews`), which reuses main's `validateDocument`, `layeredLayout`, `viewSpec`, `buildScene`, `architectureSvg` and `compareView`. It is a projection, not a second model. Also adds `docs/development-core.md`, `packages/development-core/` and a test. Only the `src/App.tsx` change touches existing code. |
| `29d53f2` | build: package Atlas contract and renderer attribution | Useful donor | Adds `packages/development-core/THIRD_PARTY_NOTICES.md` and changes `build.mjs` and `package.json`. Meaningful only if the package is adopted. |
| `c5097e6` | perf: bound diagrams by selected checkout and source blueprint | Deferred | Small fix to `src/development/index.ts` (5 lines). It depends on `ced0150`, so it moves with it. |
| `b2a5b51` | fix: label runtime node evidence without design claims | Deferred | Touches `src/development/index.ts` and `docs/development-core.md` (4 lines). Keeps the "no design claim" rule, consistent with AGENTS.md. It depends on `ced0150`. |
| `c5ab19c` | Add bounded zoom and accessible navigation to portable Atlas | Deferred | Touches `src/development/page.ts` (5 lines). It is only useful together with the portable page from `ced0150`. |

Reapplying the donor commits needs a rebase over 48 main commits, including V2 (#62).

**Old Codex worktrees (copied, not modified)**
- `<codex-worktrees>/15c4/diagramcloud`
  - It has `.local/` (684 files) and no root `*.md` missing from `origin/main`.
  - Contents: CI and release qualification output, audit scripts, and various `*-qualification-20261009` folders.
  - Copy: `.local/recovery/codex-worktrees/15c4/.local/`.
- `<codex-worktrees>/3924/diagramcloud`
  - It has `.local/` and 56 root V2/overnight `*.md` files missing from `origin/main`: `V2-*`, `CLAUDE-HANDOFF.md`, `OVERNIGHT-*.md`, each with `-RESUME`/`-TESTS` variants.
  - The worktree also has many uncommitted modifications to tracked files (not copied, only noted).
  - Copy: `.local/recovery/codex-worktrees/3924/` (root reports plus `.local/`, 9,794 files in total).
- All 10,478 copied files have their SHA256 recorded in `RECEIPT.json`, under `codex_15c4` and `codex_3924`.
- Disposition: archive only. These are evidence and handoff material, not donor code.
