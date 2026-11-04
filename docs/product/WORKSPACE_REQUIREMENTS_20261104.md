# Recovered workspace requirements — 4 November 2026

This mapping preserves original requirement pointers and identifies the current integration gap. It is not a declaration that all V1–V3 requirements are complete.

## Original sources

- [Product source index](README.md) identifies the recovered immutable [F001–F115 inventory](FEATURES_PREPRO_20261008.csv), [historical dispositions](FEATURE_DISPOSITION_PRE124_20261008.csv), [22 UX components](UX_COMPONENTS_PREPRO_20261008.csv) and other original matrices. Their historical statuses are not current release claims. The index explicitly says the earlier 160 conversation messages were not recovered.
- [NIGHT4 crosswalk](NIGHT4_CROSSWALK.md) preserves the 17 selected DG relationships. [Release 1.24 contract](../release-1.24/RELEASE_CONTRACT.md) and [implementation handoff](../release-1.24/CODEX_WORK.md) carry its release scope.
- [V3 adoption and acceptance](V3_WORKSPACE.md) identifies source cut `db0a41de3ebef026a6f3e329bbc03dda02558338` in `julian-passebecq/galaxy-prompt-spec`, workstream `diagramcloud-v3-handoff-20261018`. UX01–UX25 remain at that owner; later local UX rows carry named source/browser tests. Early W0/W1 limitations on that page are historical and must be read alongside later integration sections.
- [Current roadmap](../ROADMAP.md) owns current selected work. The DataPass overnight MASTER remains the additive Rust/comparison integration scope, not a replacement for the retained editor requirements.

## Existing capabilities and selected integration

| User need | Existing authority | Integration required |
|---|---|---|
| Left project/repository tree | F014/F015; `ProjectNavigator`, `projectNavigation`; Project/Repositories/Views/Mappings, filters and collapsible child branches | Expose the real workspace by default in the composed host; preserve classic escape. No duplicate tree. |
| Right detail on selection, Follow/Pin | `ProjectContext`, `CompanionPane`, context pin and audience guards; V3 W1/UX32 | Add optional transient hover/focus preview without changing click selection, route or the pinned context. |
| Bottom project/workflow/Git context | `WorkbenchFrame`, App route/evidence/work/git slots, `DeliveryEvidencePanel`, `HistoryLensPanel`; UX26/27/30 | Make existing panels discoverable with clear labels. Unknown history stays unknown; loading a supplied slice does not collect Git or launch work. |
| Collapsible route and retained parent context | `WorkbenchFrame`, hierarchy/route model, UX36/UX40 | Preserve collapse/focus behavior and route ancestry; never infer containment from dependency edges. |
| Faster interaction with shared Rust | Rust source-bound comparison; existing TS editor/renderer and immutable Project | Measure interaction and computation separately. Transient preview subscriptions should update only right-pane consumers, not App/canvas. Rust type generation alone is not a speedup. |

The composed host's former `?workspace=studio` launch explicitly selected the classic escape and concealed the already implemented workspace frame. `?workspace=v3` opens the existing workspace. Default-surface changes and their actual browser qualification remain integration-owner work.

## Preview implementation boundary

`WorkspacePreviewProvider` owns an ephemeral external store scoped to the Project object and audience. It projects public content before validating IDs. `ProjectNavigator` publishes hover/focus leases and keeps its existing click callbacks. Only `useWorkspacePreview` leaf consumers subscribe; publishing does not set App/provider state. Pins and final right-pane presentation remain owned by `ProjectContext`/the integration host. There is no new document, persistence format, graph engine, source authority or live provider.

Source microbenchmarks on the M2 (Node24.22.1, warmed calls) found navigation and context helper times below 0.04 ms on the 23-node retail and 111-node constellation samples. These are source-call observations, not frame latency or a product capacity claim; they do not justify another cache/index or a Rust rewrite of these small helpers. Actual browser hover/click-to-paint qualification is separate.

## Connected workspace implementation

The composed host now requests V3 and the workspace opens its dock. The existing project tree publishes transient hover and keyboard-focus previews; clicked selection and route remain canonical. The right pane keeps the existing Follow/Pin owner and provides Overview, Connections, Evidence and Sources tabs. Parent component explanations retain a containing-view anchor when a child diagram opens. The dock provides Project, Workflow, Sources & Git and Reviews, with callbacks into retained comparison, variant, history and delivery readers. Route controls and the route map can collapse independently. Desktop chrome fits the viewport; compact mode retains one-pane navigation and hierarchy controls.

The retail reference retains its original graph identities and adds explicitly synthetic order records, a proposed normalized message, a field dictionary, transformation rules, failure handling, acceptance cases and ownership questions. It does not establish a configured Shopify integration or any observed execution.

Regression contracts: `tests/e2e/connected-workspace.spec.ts`, `tests/e2e/context-pane-tabs.spec.ts`, retained `v3-workspace`, `v3-companion` and `v3-linked` journeys; source tests `context-pane`, `project-dock`, `workspace-preview`, `retail-operations`. Host qualification and exact source pins are recorded separately by the integrator. This closes the selected pane integration gaps, not the entire historic inventory. Git/history remains supplied evidence; drag docking, remote agent execution and missing private release fixtures are not supplied by these panes.
