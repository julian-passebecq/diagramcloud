# Roadmap and honest completion boundaries

## Implemented V1 foundation

React + Fluent UI shell; light/dark themes; read-only Explore, Edit, public Portfolio and guided Present modes; gallery; parent-retaining multi-level drilldown; node/edge properties; drag/connect and grid layout; text/code/table/metrics/image evidence rendering; image attachment; whole-document JSON validation/review/import/export; bounded undo/redo; IndexedDB save and other-tab conflict detection; public-content projection; illustrative flow motion; current-view SVG/PNG/Mermaid export; standalone public HTML; native editable PowerPoint export; browser print. Metrics and story steps currently require JSON editing rather than dedicated visual composers.

The test suite and CI result, not this list, determine whether a particular revision is ready to use. Read the workflow and artifact from the exact delivered commit.

## Next pass: improve the same root

| Priority | Work | Acceptance condition |
|---|---|---|
| P0 | Shared measured export scene and orthogonal routing | Canvas, SVG and PPTX use consistent node bounds; long labels and upward/backward links do not cross unrelated cards |
| P0 | Autosave queue, quota and recovery fault injection | No premature 'saved' status; interrupted writes preserve the prior document; same-origin multi-tab conflicts are tested in real IndexedDB |
| P0 | AI change preview and revision-guarded JSON Patch | Show added/changed/deleted entities before apply; reject a stale base revision; keep stable IDs |
| P1 | Curated official icon registry | Versioned provider/product/source/rights/checksum manifest; larger Fabric/Azure/Databricks collections with verified terms; no logo distortion |
| P1 | Visual story composer | Reorder steps, select target view/node/edges, write narration and preview an interview sequence without editing raw JSON |
| P1 | Better evidence authoring | Visual table editor, code language selector improvements, metrics form, image captions/rights controls and block ordering |
| P1 | Explain a transformation | Side-by-side input/output rows, column mappings, quality rules, join/grain explanations; remain display-only unless a separate sandbox is deliberately added |
| P1 | Portfolio composition | Executive/technical/interview layouts, contribution/outcome/constraint blocks, focused share links, selected-view PDF deck planning |
| P1 | All CV projects after source verification | Retrieve or receive current CV; source-confirm Eukleia, Danone, Savencia and remaining projects; no invented outcomes or date claims |
| P2 | Interchange adapters | Narrow documented draw.io/Mermaid/D2/LikeC4 import scopes with explicit loss reports and round-trip fixtures |
| P2 | Read-only metadata adapters | dbt manifest, SQL DDL, Databricks Jobs, Fabric metadata, semantic-model tables; mark observed versus authored relationships |
| P2 | Layout options | Evaluate ELK/D2/TALA licensing and deployment boundaries; preserve user overrides and avoid moving the canvas unexpectedly |
| Later | Collaboration, cloud sync and execution | Only after local artifact/recovery contracts are stable. Keep optional services separate from the viewer |

## Not implemented or not proven as a general guarantee

No full draw.io/Visio import; no arbitrary SVG-to-graph conversion; no full Mermaid round trip; no live cloud discovery; no Python/SQL/DAX execution; no actual streaming telemetry; no scientific Foil'O solver; no measured engine pricing/performance; no full official cloud icon pack; no collaborative merge; no complete arbitrary-layout PPTX fidelity guarantee; no automatic confidentiality approval; no all-project PDF pagination engine; no deployed public site in this pass.

## Sample scope

The two supplied PDFs are a starting portfolio source, not immutable production documentation. Source-derived narratives are distinguished from synthetic rows, snippets and illustrative financial scenarios. Do not replace this distinction with a generic 'demo' footer while presenting numerical results as real achievements. A read-only exported portfolio should carry provenance next to the evidence that needs it.

## Suggested implementation sequence

Finish browser/export visual QA and storage failure tests first. Then build the shared scene/icon registry. Add the visual narrative composer and richer evidence editing. Only then add import/metadata adapters. This keeps the product small enough to understand while making it genuinely more useful than a static cloud drawing.


## V1.1 reliability pass (2026-09-21)

Implemented in `feat/diagramcloud-v1.1-reliability`:

- **Latest-snapshot save queue.** IndexedDB writes remain serialized, but an older write can no longer flash `Saved locally` while a newer edit is still queued. Terminal save/error state belongs only to the newest queued generation.
- **Rapid-edit history hardening.** Edit/undo/redo operations read and update a synchronous history ref before React rerenders, preventing back-to-back edits from being derived from a stale render snapshot.
- **Recoverable workspace loading.** A malformed IndexedDB row is reported and left untouched while healthy projects still load. A stored key/document-ID mismatch is also isolated rather than silently accepted.
- **Blocked-database recovery.** A blocked IndexedDB open no longer leaves a stale connection promise or later leaked handle.
- **Whole-document AI/JSON review guard.** Same-project imports show stable-ID additions/changes/removals and project-field changes. They may only apply when the imported base revision equals the currently open revision. This is a review guard for whole-document edits, **not yet JSON Patch**.
- **Shared export geometry.** SVG and editable PowerPoint now share node dimensions and deterministic orthogonal Manhattan connector routing. React Flow canvas geometry is still an independent interactive renderer and remains future convergence work.
- **Mermaid hardening.** Pipe characters in labels are escaped so authored labels cannot accidentally change Mermaid edge-label syntax.
- **Regression coverage.** Added save-queue, change-preview, shared-routing, corrupt-row and stale-revision tests. CI validates from a clean runner with `npm install`; the CI artifact includes the resolved `package-lock.json`. Checking that lockfile into the repository is still required before switching branch CI to `npm ci` and dependency caching.

Still open from P0: storage quota/fault injection beyond corrupt-row recovery; revision-guarded JSON Patch operations rather than full-document replacement; shared measured text/layout across canvas, SVG and PPTX; visual recovery UI for exporting/deleting quarantined corrupt rows.


## V1.2 Drive asset pass (2026-09-21)

Implemented:

- optional Google Drive image asset vault using the non-sensitive `drive.file` scope;
- Google Identity Services token flow with memory-only access tokens;
- optional Google Picker import for PNG/JPEG/WebP;
- app-created `DiagramCloud Assets` folder for backups;
- refresh of cached Drive-backed images while preserving stable DiagramCloud asset IDs;
- private remote metadata stripped from public documents;
- explicit image provenance choice including synthetic / AI-generated;
- image source limit raised to 8 MiB with resize/compression into the bounded embedded cache;
- CSP/COOP updates limited to the Google origins needed by GIS, Picker and Drive REST;
- connector unit tests and an unconfigured/optional browser UI test.

Still deliberately out of scope:

- storing the DiagramCloud project itself in Drive;
- background refresh tokens or server-side Google credentials;
- broad `drive` / `drive.readonly` scopes;
- automatic AI image generation inside DiagramCloud;
- exporting PPTX by live-linking remote Drive images;
- multi-provider asset synchronization/conflict resolution.

Next useful asset work: a provider-neutral asset-source interface plus optional OneDrive/R2 adapters, then an AI image generation action that feeds the same sanitize/cache/provenance pipeline.

## Bridge V1 pass (2026-09-24)

Done on the DiagramCloud side: explicit Explore vs Open task workspace actions (PR #6 CI green), repository sidecar open/review/apply, conflict-guarded save back to `.datapass/diagramcloud.json`, create-if-missing, and contract tests pinned to DataPass `fde955a`.

Next, in order:

1. ~~DataPass side~~ done in julian-passebecq/datapass-vscode#11 (branch `feat/diagramcloud-bridge-v1`, CI green): sidecar detection, Open architecture, Copy AI context (JSON), Import AI plan with base-revision checks, per-operation approval and a journaled write. V1 applies `set-project-metadata` and `link-node-workspace` only; its output bytes equal `serializeSidecar`. After that PR merges, bump `docs/contracts/datapass-diagramcloud-bridge.lock.json` to the merged commit (the contract README gained additive V1 notes; the schemas are unchanged).
2. Define DiagramCloud payload shapes for the `diagramcloud-document` plan actions (`link-node-workspace`, `add-item`, `add-placement`, …) as a reviewed contract bump, then a shared apply function both products can test.
3. Persist the folder handle in IndexedDB so the link survives a reload (with a permission re-prompt).
4. VS Code webview hosting: DataPass posts the sidecar text to an embedded DiagramCloud with an origin-checked message channel.

## Report screens pass (2026-09-24)

Done: Report view (context rail, provenance footer, export parity), KPI trends, hbar/stacked/donut/scatter charts, status badges, a Gantt with groups/milestones/dependencies, and filters/callouts/steps/tabs items. There are three TotalEnergies showcase screens from portfolio pp.6/9/10. Details are in `docs/pro-pass/START_HERE.md`.

FOIL screens are done: five report screens linked from the Foil'O diagram (see START_HERE, "FOIL screens").

Composed-workspace PPTX export is done (native charts and tables; see START_HERE, "PowerPoint export").

Project and scope decks are done (see START_HERE, "Project and scope decks").

The semantic-model (star schema) item is done (see START_HERE, "Semantic model item").

Drag-to-move and drag-to-resize in Edit board are done.

Undo and redo for board edits are done.

The data-model editor is done (see START_HERE, "Data-model editor").

Multi-select, group move and align are done.

Counting KPI tiles are done.

Next candidates: distribute/stack for selections; a form to set a KPI's counted source; diagram box → task-screen slide links inside the project deck; a map/geo item for the site-assessment slide (p.16) if a licensed basemap is chosen.
