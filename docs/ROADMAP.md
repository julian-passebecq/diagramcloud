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
