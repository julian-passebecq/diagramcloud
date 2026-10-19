# DiagramCloud V3 workspace: adoption report (W0)

State on 2026-10-19 (1.30.0 integrated W0-W5 and the release journey; see "Integration (W6, 1.30.0)" below). This page records how the V3 handoff was adopted into this repository. It is a status and boundary page for the existing [roadmap](../ROADMAP.md), not a second backlog. The V3 mission rows UX01-UX25 live in the [V3 handoff entrypoint](https://github.com/julian-passebecq/galaxy-prompt-spec/blob/main/workstreams/diagramcloud-v3-handoff-20261018/START.md); this page adds UX26-UX30 below and never restates or reinterprets UX01-UX25.

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

UX01-UX25 stay as written in the V3 mission. These rows extend them. Status as of 1.30.0: a row is implemented only when a named test proves it in the App; a source-module test alone makes it partial.

| ID | Acceptance | Status (1.30.0) |
| --- | --- | --- |
| UX26 | Handoff source, proposed work, acceptance and original prompt/checkpoint identities are inspectable; preparation never becomes execution. | partial: the source cut and patch sha256 are recorded on this page (documentation, no test); a PM task or capability brief stays inert text and is never launched (`tests/pm-task-import.test.ts` "an unselected or unsupported instruction string remains inert", "provider request is still refused"; `tests/capability-guide.test.ts` "code-looking instructions stay text, never run"); the App has no view of handoff, prompt or checkpoint identities |
| UX27 | Declared ownership, fileset and resource conflicts are visible; one integrator and an optional disjoint lane do not create competing App writers. | not implemented in the App: the block plan and filesets are recorded on this page only, with no test |
| UX28 | An existing PM task JSON enters the ordinary DiagramCloud preview as a private read-only projection, with stable task identity, state, dependency and detail views, and refusal without mutation. | implemented (#102): `tests/pm-task-import.test.ts`; `tests/e2e/pm-task-import.spec.ts` "PM task snapshot: import dialog preview, Apply, state/dependency/detail views, reload keeps it" and "PM task snapshot: an invalid or cyclic file is refused without mutation"; `tests/e2e/v3-release.spec.ts` (in the V3 workspace) |
| UX29 | Estimates distinguish effort, dependency bounds, tokens and queue/access uncertainty; unknown values and actual usage stay distinct. | partial: `src/intelligence/usageEconomics.ts` keeps unknown and zero cost apart and never merges metered, estimated and allocated cost (`tests/usage-economics.test.ts` "unknown input/output/cost stays counted globally and by attributed feature", "zero cost is valid and distinct from missing cost", "metered, estimate, subscription allocation and currencies never merge"); it is not shown in the App, and effort, dependency-bound and queue estimates have no model |
| UX30 | A viewer can follow plan, adopted task or prepared prompt, actual native result, then source, artifact, qualification and release where supplied, and sees explicit gaps otherwise. | partial: the plan's tasks, states and dependencies are views (`tests/e2e/pm-task-import.spec.ts`), and the workspace dock shows a read-only history lane over recorded repository revisions (`tests/history-lens.test.ts`); prompt, native result, qualification and release links are not modelled, so the chain is not followable end to end |

### Expressiveness rows (UX31-UX34, complement E)

From ChatGPT Pro complement PP-20261019-02, source aaba5c3; design and 27-domain coverage in [EXPRESSIVENESS](EXPRESSIVENESS.md). A status moves only when a test proves it; source-module tests are not App acceptance.

| ID | Acceptance | Status |
| --- | --- | --- |
| UX31 | One concept can be explained from its surrounding architecture through repeated authored behaviour to exact code, state, contract and evidence, with an explicit synthetic or frozen basis and no execution claim; invalid, stale or colliding input leaves existing work intact. | implemented for import: compiler, CLI and six examples tested (`tests/explanation-walkthrough.test.ts`, `tests/explanation-cli.test.ts`, `tests/expressiveness-example-files.test.ts`); the `npm run explain` patch enters the App through the ordinary JSON review (preview applies nothing, Apply is one revision, Undo restores the document exactly, Redo) and its steps open under their walkthrough parents (`tests/e2e/v3-companion.spec.ts`, "retry example: walkthrough patch review, steps, companion tabs, related detour and explicit return"). Requests are still written as JSON and compiled by the CLI; there is no in-App request editor. |
| UX32 | Related context uses exact permitted identities, explicit depth, scope and relation filters and visible bounded coverage; Follow/Pin, a keyboard and list alternative and detour return preserve context. | implemented in the V3 workspace: the optional companion pane (`src/ui/CompanionPane.tsx`, state in `src/core/companionPane.ts`) sits in the workspace companion under Follow/Pin and renders `relatedContext` through the export scene with a list as the keyboard alternative; tabs only where there is content (Explanation, Code/State, Related, Evidence); depth, scope, direction, relation-kind and display-limit filters with a coverage line that names its bounds and says when the limit is reached; opening a related item is a detour through the workspace route (parent kept) that keeps the original question as the anchor, survives a second hop and returns explicitly; public and Present audiences resolve through publicDocument. Tests: `tests/related-context.test.ts`, `tests/companion-pane.test.ts`, and `tests/e2e/v3-companion.spec.ts` ("retry example: ...", "390 x 844 › companion by keyboard: list alternative opens a detour and Return comes back, no horizontal scroll"). |
| UX33 | Focused exports keep the current view, context access, code and table details, manual next/previous and explicit return after a detour; no autoplay or network, source privacy and keyboard focus kept; compact and printed forms inspected independently. | partial: opt-in `focusStory` HTML tested as source (`tests/explanation-focus-export.test.ts`) and offline in Chromium at 1440 px (`tests/e2e/explanation-focus-export.spec.ts`: next step, context detour, explicit return, focus toggle, code first, keyboard focus kept, no request); the App export menu offers it as its own option, "Focused explanation HTML" (`<project>.focused.html`, same public document as Interactive HTML), downloaded and opened with every request blocked, keyboard focus kept on the activated component and code first, then at 390 x 844 with no horizontal scroll (`tests/e2e/v3-companion.spec.ts`, "focused explanation HTML is an explicit export option, offline, with keyboard focus kept"); printed form not inspected |
| UX34 | Changing relevant referenced code, evidence or source cannot leave an apparently current tour stop without qualification; compatibility and public-projection tests cover old and new fingerprints. | implemented (#105): `referencedFingerprint`; `tests/tour-referenced-content.test.ts` |

## State chain

Each step is a distinct state with its own evidence; one never implies the next:

prepared → adopted → task admitted → prompt prepared → session associated → implementation returned → integrated → qualified → delivered

A plan hash is not a heartbeat or an installed artifact hash. Superseding a plan keeps old prompts and receipts; an old result is not rebound to a newer plan.

## Estimates

The handoff's figures are uncalibrated planning allowances, not measurements, bills or approvals: 280-730 minutes of active effort for W0-W6, a dependency-only bound of 175-450 minutes that ignores shared integration, GUI, CI and access waits, and 420k-1.5M input / 51k-167k output tokens. Calendar completion is unknown. Reforecast after W0 and the first W1 integration; phase order is never drawn as a calendar Gantt.

## V3 workspace

W1 mounts the foundation modules in the real App (`src/App.tsx`). The workspace is opt-in for the session: the header button **V3 workspace** (or `?workspace=v3`) shows the same project, selection and mode in `WorkbenchFrame`; switching back restores the studio unchanged. Every existing e2e journey still runs on the studio.

- **Panes on actual components.** Explorer: the studio sidebar (Navigate with saved contexts and `ProjectNavigator`, gallery, Inspector, Story, Tours, Variants) plus **Load capability brief**, which compiles a `capabilityGuide` brief and opens it in the ordinary import review (nothing is applied, executed or reviewed on the author's behalf). View: the hero, canvas toolbar, breadcrumb, hierarchy rail, canvases and evidence. Companion: `ProjectContext` with Follow / Pin. Dock: a route panel (open path and every permitted parent path), the selected component's evidence and, when the project has an atlas, a read-only `HistoryLensPanel` over the repository revisions its snapshots already record (ancestry UNKNOWN, coverage partial; nothing is collected).
- **Toolbar, destination and context.** `PerspectiveBar` sits above the frame. Destinations open existing places (Projects: navigator or gallery; Catalogue: the business overview; Meetings: Tours; Activity: the dock). Task sets the layout preset (explain, compare, present) and the suggested dock; Viewpoint opens the first reachable view of a perspective through the parent-preserving route; Detail is the open sheet; build contributors stay Off (no builder identities are supplied). The custom dock (main and second panel, reset) is session-only.
- **Parent-preserving navigation.** In the workspace every view jump (navigator, overview, context, lessons, tours) goes through `resolveViewRoute`: the reader's current parent chain is kept, several permitted parents ask for an explicit choice, and a revoked path is refused with the generic message. The hierarchy rail and Choose parent work as before.
- **Routes.** Each navigation is one browser history entry and a deep link (`?workspace=v3&project=&view=&node=`, stable IDs of the permitted document only). Back / Forward restore the exact parent chain; an entry recorded in another audience is refused, never used to re-enter the author context.
- **Unsaved edits.** A typed but unapplied form edit in the workspace holds every route change (canvas selection, navigator, rail, breadcrumb, Back / Forward, browser history, mode, sheet, project and surface switch) behind **Keep editing** / **Discard edit and continue**, and the page asks before unloading. The JSON drawer keeps its 1.28 rule when the project changes.
- **Privacy.** Every pane, visible or hidden, gets the permitted projection (`publicDocument` in Portfolio and Present). The companion is remounted on a project or audience change, so a pin never crosses into the public copy. Present and Portfolio keep their restrictions.
- **Responsive.** Below the desktop width the frame shows one pane at a time with a pane switcher, the reading controls fold into one disclosure, and focus moves to a visible control when its pane hides. `tests/e2e/v3-workspace.spec.ts` checks the explorer, Follow / Pin, parent-preserving drill and choice, Back / Forward and a deep link, the unsaved-edit guard, audience change and source replacement without private text in the page, and a 390 x 844 keyboard walk.

Not in W1: free drag docking, saved workspace layouts, builder identity facets, Git / work / question / decision dock panels (no supplied source yet) and a capability guide view beyond the compiled project. W3 (linked comparison) and W4 (meeting return) build on this workspace.

## Integration (W6, 1.30.0)

Merged lanes: foundation W0 + W5 (#102), W1 workspace (#106), W2 capability examples (#103), W3 linked comparison (#107), W4 meeting return (#108), and complement E (#104, #105). No lane is left unmerged.

- **W3 linked comparison.** The workspace's Compare task opens a variant, two revisions of the session or two declared environments (`src/core/variantDraft.ts`, `src/ui/VariantCompare.tsx`). Pairs are exact stable IDs, or a recorded correspondence across projects; an absent counterpart is shown as absent, selecting applies nothing (Apply stays the Variants panel's one-revision patch), a source change marks the comparison stale without re-pairing, and Return restores the view and selection. Tests: `tests/linked-comparison.test.ts`, `tests/e2e/v3-comparison.spec.ts`.
- **W4 meeting return.** Pause for a question keeps the presentation on its stop through any detour; Return and resume finds the stop again by its identity in the audience's permitted copy, and a source or audience change during the pause is offered as a choice, never followed. Tests: `tests/tour-presentation.test.ts`, `tests/e2e/v3-meeting.spec.ts`.
- **Release journey.** `tests/e2e/v3-release.spec.ts` runs one pass through the real App with every non-loopback request aborted: open the workspace, import a PM task snapshot, Follow then Pin in the companion, load the synthetic capability brief through the import review, compare the session's open revision, record a public tour, present it with a pause, a drill detour and Return and resume, and export the public HTML, opened with no network.
- **Fix found by the journey.** Recording a tour left the workspace's unsaved-edit guard armed (the record buttons did not submit their form), so the next mode change asked about an edit already used. The record buttons now submit the form; Enter in the title field does not.

Still open after 1.30.0: UX26 and UX27 have no App view; UX29 and UX30 are partial (above); UX31-UX33 stay partial; free drag docking, saved layouts, builder identities and the Git / work / question / decision dock panels are not built.
