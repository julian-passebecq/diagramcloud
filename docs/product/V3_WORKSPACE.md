# DiagramCloud V3 workspace: adoption report (W0)

State on 2026-10-18. This page records how the V3 handoff was adopted into this repository. It is a status and boundary page for the existing [roadmap](../ROADMAP.md), not a second backlog. The V3 mission rows UX01-UX25 live in the [V3 handoff entrypoint](https://github.com/julian-passebecq/galaxy-prompt-spec/blob/main/workstreams/diagramcloud-v3-handoff-20261018/START.md); this page adds UX26-UX30 below and never restates or reinterprets UX01-UX25.

## Source cut

- Handoff source cut: `db0a41de3ebef026a6f3e329bbc03dda02558338` in `julian-passebecq/galaxy-prompt-spec` (workstream `diagramcloud-v3-handoff-20261018`).
- Adopted onto DiagramCloud `main` at 1.29.1 (`39c0816`). The patches were written against that commit and applied with `git apply --3way` without conflicts.
- The handoff's private files (the per-owner handoff JSON and the PM package) are not part of this public repository. Only the four product patches and the public plan text were read for this adoption.

## Patches adopted

| Patch | sha256 | What it adds |
| --- | --- | --- |
| A-frame-routes | `51015503aa88f2b7ec9effc1122588db53b9b2bd37911ad03306be427c7cbb16` | `resolveViewRoute` in `src/core/hierarchy.ts` (a view jump keeps the reader's chosen parent, asks for a choice when several parents exist, refuses a revoked path with a generic message); session-only workbench layout presets (`src/core/workbenchLayout.ts`: explain, compare, present); a controlled `WorkbenchFrame` shell with its CSS. Tests: `tests/view-route.test.ts`, `tests/workbench-layout.test.ts`. |
| B-perspectives-history | `81ce2f0791594eff315f85921f03857b69af3dd69c71940d7fdf23bef8630a2b` | Transient reading preferences (`src/core/workbenchPerspective.ts`: destination, task, builder level, dock panel, bound to project, audience and epoch); `PerspectiveBar`; a read-only history projection over supplied records (`src/development/historyLens.ts`) and its `HistoryLensPanel`. Tests: `tests/workbench-perspective.test.ts`, `tests/history-lens.test.ts`. |
| C-capabilities-economics | `5f6697314c0901da1fff4ebc0f3fba30d60a24a03dbf4dd5490ff9ea36cf292a` | An authored capability brief validated whole and compiled through the ordinary import review (`src/intelligence/capabilityGuide.ts`); presentation arithmetic over normalized usage records and a per-protocol Pareto frontier (`src/intelligence/usageEconomics.ts`). Tests: `tests/capability-guide.test.ts`, `tests/usage-economics.test.ts`. |
| D-pm-task-import | `7321d5dbd956254ff09f16eb4b06640ff54a68aab3f2fd546117bc151fbbef37` | A read-only reader of PM's `datapass.owner-tasks/1` (`src/development/pmTasks.ts`) wired into the ordinary JSON import (`src/app/stageImport.ts`), its contract ([pm-task-import](../contracts/pm-task-import.md)) and an AI guide section. Tests: `tests/pm-task-import.test.ts` and the browser journey `tests/e2e/pm-task-import.spec.ts` (import dialog, preview, Apply, state/dependency/detail views, reload, refusal without mutation). |

What dropped as duplicate: nothing. Every file in A, B and C is new, and the only edit to an existing module (A's `resolveViewRoute`) is an addition after `hierarchyRail`: the 1.29.0 hierarchy rail, Choose parent and their tests are unchanged. No existing module already provided layout presets, reading perspectives, a history lane view, capability briefs, usage arithmetic or a PM task reader.

Boundaries kept on adoption:

- A, B and C are source modules with unit tests. They are not yet mounted in `src/App.tsx`; W1 integrates them into the real App. Until then no reader sees them.
- `historyLens` reads records a producer supplies. It collects nothing, reads no repository, computes no churn and is not a reimplementation of Lens; Lens stays the producer of runtime pointers.
- `usageEconomics` does arithmetic on supplied records only: no billing API, price inference or vendor ranking.
- D is reachable from the import dialog today (UX28). It is private and read-only: at most 60 tasks, 1000 dependency links and 256 KiB, refused whole and without mutation beyond that or on an invalid or cyclic document; no write-back to PM, no session, no observation; a task's `DONE` or `APPROVED` is shown as a source-declared state, never as DiagramCloud review or a qualified release. The public projection is a neutral empty shell.

## Codex archive decision

The branch `codextobedeterminedwasnot` is a historical reference only and is never merged wholesale. It carries `package.json` 1.25.0 and a `viewspec.ts` that prints numeric private-omission counts and a distinct private-target error, both removed by 1.29.1 (AC25 and the private-ID refusal). A wholesale merge would undo those privacy corrections. An exact old file is consulted only when a current acceptance gap makes it relevant, and only a non-duplicate needed change is ported. The branch and its notes are kept, not erased.

## Lane assignment used

One Claude lead session coordinates a workflow. W2 (capability and project examples) is done by a native subagent lane inside that workflow. No external Codex writer is used, and publishing the handoff did not transfer ownership of any older worktree. The lead keeps `src/App.tsx`, shared contracts, manifests and release identity.

## Block plan (W0-W6)

Readiness is not task admission, a run, an approval or publication authority. Filesets are write boundaries for each block; any other shared file returns to the lead.

| Block | Outcome | Depends on | Fileset |
| --- | --- | --- | --- |
| W0 | Recover, adopt and partition the actual candidate (this page) | none | `docs/ROADMAP.md`, `RESUME.md`, `docs/product/V3_WORKSPACE.md` |
| W1 | Integrate the real workspace and context navigation: import, explorer, Follow/Pin, parent-preserving navigation, toolbar/destination/context and dock on actual components | W0 | `src/App.tsx`, `src/ui/WorkbenchFrame.tsx`, `src/ui/PerspectiveBar.tsx`, `src/ui/workbenchFrame.css`, `src/ui/perspectiveBar.css`, `src/core/workbenchLayout.ts`, `src/core/workbenchPerspective.ts`, `src/core/hierarchy.ts`, `tests/e2e/v3-workspace.spec.ts` |
| W2 | Source-cited capability and project examples (DiagramCloud itself and one non-Galaxy project); unsupported detail stays unknown | W0 | `docs/product/capabilities/`, `examples/v3-capabilities/`, `tests/fixtures/v3-capabilities/` |
| W3 | Linked comparison without identity guessing: exact IDs or explicit correspondence, visible absent counterparts, no selection-to-Apply coupling | W1 | `src/ui/VariantCompare.tsx`, `src/core/variantDraft.ts`, `tests/e2e/v3-comparison.spec.ts` |
| W4 | Interruptible presentation and meeting return: pause, inspect, drill, return and resume explicitly at a valid stop | W1 | `src/ui/Tours.tsx`, `src/core/tourResume.ts`, `tests/e2e/v3-meeting.spec.ts` |
| W5 | PM plan consumption and truthful work views: the PM task import path, task state declared only, no launch, no write-back | W0 | `src/app/stageImport.ts`, `src/development/pmTasks.ts`, `tests/pm-task-import.test.ts`, `docs/contracts/pm-task-import.md` |
| W6 | Integrate, qualify and privately deliver the successor through the actual App | W2, W3, W4, W5 | `package.json`, `package-lock.json`, `src/App.tsx`, `docs/RELEASE.md`, `docs/ROADMAP.md`, `RESUME.md`, `tests/e2e/v3-release.spec.ts` |

W0 and the source half of W5 land together in the foundation PR (this page, the four patches and the PM import browser journey).

## Acceptance added (UX26-UX30)

UX01-UX25 stay as written in the V3 mission. These rows extend them:

| ID | Acceptance |
| --- | --- |
| UX26 | Handoff source, proposed work, acceptance and original prompt/checkpoint identities are inspectable; preparation never becomes execution. |
| UX27 | Declared ownership, fileset and resource conflicts are visible; one integrator and an optional disjoint lane do not create competing App writers. |
| UX28 | An existing PM task JSON enters the ordinary DiagramCloud preview as a private read-only projection, with stable task identity, state, dependency and detail views, and refusal without mutation. |
| UX29 | Estimates distinguish effort, dependency bounds, tokens and queue/access uncertainty; unknown values and actual usage stay distinct. |
| UX30 | A viewer can follow plan, adopted task or prepared prompt, actual native result, then source, artifact, qualification and release where supplied, and sees explicit gaps otherwise. |

### Expressiveness rows (UX31-UX34, complement E)

From ChatGPT Pro complement PP-20261019-02, source aaba5c3; design and 27-domain coverage in [EXPRESSIVENESS](EXPRESSIVENESS.md). A status moves only when a test proves it; source-module tests are not App acceptance.

| ID | Acceptance | Status |
| --- | --- | --- |
| UX31 | One concept can be explained from its surrounding architecture through repeated authored behaviour to exact code, state, contract and evidence, with an explicit synthetic or frozen basis and no execution claim; invalid, stale or colliding input leaves existing work intact. | partial: compiler, CLI and six examples tested (`tests/explanation-walkthrough.test.ts`, `tests/explanation-cli.test.ts`, `tests/expressiveness-example-files.test.ts`); no App authoring entry yet |
| UX32 | Related context uses exact permitted identities, explicit depth, scope and relation filters and visible bounded coverage; Follow/Pin, a keyboard and list alternative and detour return preserve context. | partial: projection tested (`tests/related-context.test.ts`); companion pane, Follow/Pin and detour return not implemented |
| UX33 | Focused exports keep the current view, context access, code and table details, manual next/previous and explicit return after a detour; no autoplay or network, source privacy and keyboard focus kept; compact and printed forms inspected independently. | partial: opt-in `focusStory` HTML tested as source (`tests/explanation-focus-export.test.ts`) and offline in Chromium at 1440 px (`tests/e2e/explanation-focus-export.spec.ts`: next step, context detour, explicit return, focus toggle, code first, keyboard focus kept, no request); compact and print inspection not done; not reachable from the App export menu |
| UX34 | Changing relevant referenced code, evidence or source cannot leave an apparently current tour stop without qualification; compatibility and public-projection tests cover old and new fingerprints. | not implemented (W4): `stopFingerprint` does not cover referenced contents |

## State chain

Each step is a distinct state with its own evidence; one never implies the next:

prepared → adopted → task admitted → prompt prepared → session associated → implementation returned → integrated → qualified → delivered

A plan hash is not a heartbeat or an installed artifact hash. Superseding a plan keeps old prompts and receipts; an old result is not rebound to a newer plan.

## Estimates

The handoff's figures are uncalibrated planning allowances, not measurements, bills or approvals: 280-730 minutes of active effort for W0-W6, a dependency-only bound of 175-450 minutes that ignores shared integration, GUI, CI and access waits, and 420k-1.5M input / 51k-167k output tokens. Calendar completion is unknown. Reforecast after W0 and the first W1 integration; phase order is never drawn as a calendar Gantt.
