# DiagramCloud: project experience architecture

Date: 2026-09-24
Status: product contract and bounded implementation pilot, not a completed release.
Base: the existing V1.4 architecture-content branch. Preserve the existing React/Fluent shell and React Flow canvas.

> **Reviewing PR #6?** Start with [REVIEW_GUIDE.md](REVIEW_GUIDE.md): a 30-minute click-through, the content decisions only the author can make, and the merge order.
>
> **Continuation entry point:** read [CLAUDE_CONTINUATION.md](CLAUDE_CONTINUATION.md) before making new changes. It records the current Browser-test blocker, the DataPass ↔ DiagramCloud Bridge V1 contract location, exact Git/PR topology, PDF guidance, and the next implementation sequence. The pinned bridge revision is in `docs/contracts/datapass-diagramcloud-bridge.lock.json`. For a ready-to-paste next-agent instruction, use [PROMPT_FOR_CLAUDE.md](PROMPT_FOR_CLAUDE.md).

## The decision that unblocks this project

DiagramCloud is an interactive project-experience atlas. Its job is to connect an architecture to the work behind it, and to compose reusable evidence into small project briefs or portfolio screens.

Do not make the next milestone a generic Canva clone, a standalone Artifact Studio app, a new notebook runtime, a BigQuery deployment, or another collection of hard-coded cloud diagrams. The earlier Artifact Studio/OpenDesign plan in ARTIFACT_PLATFORM.md is optional future visual-authoring research; it is NOT a prerequisite for finishing DiagramCloud.

The central model is:

    project graph -> task -> workspace -> reusable item
                                   |
                                   +-> portfolio composition
                                   +-> mini document / card export
                                   +-> optional Canva polish

A company can contain projects and workstreams, but the grammar must not require the same depth for every project. A repository is not a company. A code module is not necessarily a business task. A workspace is a layout, not a second database. A screenshot is evidence, not the entire application model.

## Source review

The user supplied two PDFs, used as visual/component references rather than verified production data:

- `Julian_Passebecq_Portfolio_TotalEnergies_First_NoGlossary (2)(1).pdf`, 18 pages.
- `Total_Foilo_Portfolio_6_pages (2)(1).pdf`, 6 pages.

Do not publish the original files or assume their illustrated figures are measured achievements. In particular, the Foil financial examples differ between the two documents. Preserve them as separate source scenarios; do not reconcile them into a single claimed result.

### Component inventory from the 18-page portfolio

| Pages | What is shown | Reusable grammar/component |
| --- | --- | --- |
| 4 | oil workflow architecture | graph, group, edge, process stage |
| 5-6 | KPIs, filters, production bars, asset plots, load tables | metric, chart, filter state, table, run log |
| 7 | production profiles and cumulative distributions | multi-series curve and distribution |
| 8 | semantic model with table explorer | entity model, relationship metadata, schema inspector |
| 9 | fact rows, DAX measure and SQL source | code pane, table, tabs, task input/output contract |
| 10 | Gantt planning and task table | timeline, milestone, progress, dependency |
| 11 | assumptions, production matrix, CAPEX/OPEX and cash flow | parameter panel, matrix, bar/line chart, KPI |
| 13-14 | catalog, notebook, job and MLflow-style screens | catalog tree, code/result split, DAG, experiment table |
| 15-16 | model curves, sensitivity, experiments and maps | chart, equation, map/image, provenance |
| 17 | Streamlit-style scenario application | composed screen with parameters, results and explanation |
| 18 | medallion, table examples and monitoring | architecture with drilldown to schemas/tasks |

The six-page portfolio is useful for the first compact walkthrough: business inputs -> Excel -> Oracle -> SQL quality checks -> reports, plus schedule and CAPEX views. Its illustrative quarterly CAPEX values 120/180/220/260 and cumulative values 120/300/520/780 are retained as a labeled teaching fixture, not a project-total claim. The new Foil UI sample uses separate invented fixture values rather than implying a scientific model run.

## Product boundaries

| System | Responsibility |
| --- | --- |
| DiagramCloud | navigate architecture, explain tasks, compose workspaces, review evidence, publish selected views |
| DataPass VS Code | real-project context, resource/repository bindings and routing to official tools |
| Mosaic / learning runtime | code execution and learning; do not embed a second copy in DiagramCloud |
| CodeWiki | optional repository analysis/documentation input; not the business-task or portfolio authority |
| Canva | optional downstream visual polish and document publication |
| OpenDesign | optional donor/reference for future free-form visual editing; not required for this release |
| GCS | private image/object storage, with separately approved public derivatives |
| Google Drive | final PDF/PPTX/portfolio deliverables |
| BigQuery | optional searchable metadata projection; never required to open or edit a project |

Keep ordinary browser use and manual AI import/export functional without cloud credentials, a paid agent, an LLM API or a query service.

## Graph, task, workspace and item semantics

1. **Entity graph**: organizations, projects, workstreams, subsystems, tasks, components, resources and repositories. Navigation can be hierarchical, but relationships are typed and resources can appear in multiple contexts without becoming multiple real resources.
2. **Task**: intent, inputs, transformation/decision rule, outputs, acceptance evidence and contribution. A task can map to many files/functions; one function can support several tasks. Do not mechanically rename every CodeWiki leaf to a task.
3. **Workspace**: a screen-like layout of items. It may represent a reconstructed workbench, a reporting screen or a deliberately mixed portfolio board. It is not an embedded live Oracle/Fabric/Databricks application.
4. **Item**: independently addressable text, code, table, metric, chart, timeline or image. Reuse by stable ID. Layout/placement is separate from item content. Removing a placement must not delete the underlying item.
5. **Composition/publication**: select approved items and arrange a smaller portfolio board/brief. Placing two charts next to each other does not join their underlying datasets or imply compatible units.

The ideal navigation keeps a remembered path and viewport: global architecture -> scope -> task workspace -> focused item -> restore workspace -> back to the prior architecture. Deep links, docked tabs and richer semantic zoom are later work, not claims of this pilot.

## Canonical JSON ownership

The existing `src/core/model.ts` remains the canonical project boundary.

This pilot adds an optional `Project.experience` extension with its own format/schema version, plus `ProjectNode.experienceWorkspaceId` for linking an existing diagram node to a workspace. `validateDocument` validates the embedded pack and its link references. `publicDocument` redacts embedded experience content before any public serialization. Existing V1 documents remain valid.

The isolated `diagramcloud.experience` JSON file is an exchange envelope and component-test fixture. Save it into the current project; it is not a second independently synchronized source of truth. A future schema migration should consolidate overlapping entity/view concepts behind stable IDs rather than maintain two competing registries forever.

The experience envelope contains:

- format, schemaVersion, id, title, revision, rootId;
- sources with locators, source revisions/pages and visibility;
- entities with type, children, workspace references and assertion status;
- typed relations with provenance;
- reusable items;
- workspace placements.

Example relationship:

    capex-data (table)
       +-> capex-chart (bar)
       +-> capex-curve (line)

    controls-screen -> placement(itemId=capex-curve)
    remix-screen    -> placement(itemId=capex-curve)

The same table and chart are not copied merely because they appear in two screens. For released portfolios, add explicit immutable snapshot/version references so later source edits do not silently rewrite a published deliverable.

## Manual AI control

Required authoring loop:

    export selected context -> ChatGPT/Claude edits JSON
       -> structural validation -> reference validation
       -> revision check -> human preview -> apply
       -> save in current project -> export publication

Current pilot implements bounded JSON import/export, validation, a count preview and same-pack revision checking. The existing whole-project JSON preview includes the experience change. A fine-grained experience diff/patch protocol with base hash, stable-ID operations, selective approval and conflict reporting is still required for the final release.

Do not accept JavaScript functions, arbitrary HTML, external scripts, SQL execution or shell commands in the display grammar. Imported text/code is inert, escaped content. A displayed query is not an executed query. Charts render explicit bounded display tables only.

## CodeWiki adapter

The inspected FSoft-AI4Code/CodeWiki README documents repository dependency analysis, hierarchical module documentation, Mermaid, artifact-aware build/config analysis and incremental updates. Relevant output includes module_tree.json, metadata.json, module pages and saved dependency graphs. The observed module-tree shape is:

    {
      "Module": {
        "path": "src/core",
        "components": ["src/core/a.ts::A"],
        "children": {"Submodule": {...}}
      }
    }

The pilot imports this hierarchy, deduplicates repeated component identities, and labels the result private/inferred. It does not run CodeWiki, execute repository code, contact an LLM, invent code excerpts, infer cloud resources or assert deployment. The small adapter contract tests use fixtures matching the observed structure, not a successful full CodeWiki run on all the user's repositories.

Next ingestion milestone: accept an explicitly selected source bundle with repository identity, pinned commit, metadata, module tree and selected source excerpts. Normalize candidates, show provenance and conflicts, then merge only reviewed entities/relations. Inferred clustering, parsed references, declared resources and observed runtime evidence remain distinct.

CodeWiki generation may consume a configured model/API/subscription. Offline import of already-generated files must remain available.

Primary sources:
https://github.com/FSoft-AI4Code/CodeWiki
https://github.com/FSoft-AI4Code/CodeWiki/blob/main/docs/module_tree.json

## DataPass adapter

The inspected implemented v1 schema is `schemas/datapass-project.schema.json`. It carries project identity, repository paths/labels, known platform configurations and links. The V2 handoff describes a richer typed graph/manual AI bridge, but a target document is not proof that the current export already implements it.

The pilot accepts v1 declarations, retains only project/repository labels and recognized platform names, and drops local paths, URLs, commands, hosts and environment values. It labels imported content private/declared. It does not turn a platform key into a verified cloud deployment.

Target bridge: export sanitized scope/resource bindings and explicit evidence from DataPass. DiagramCloud adds layouts and presentation context without pushing cloud operations or silently modifying the DataPass project.

Primary sources:
https://github.com/julian-passebecq/datapass-vscode/blob/main/schemas/datapass-project.schema.json
https://github.com/julian-passebecq/datapass-vscode/blob/main/handoff/V2_HANDOFF.md

## Native components, images and exports

Generate tables, code panes, KPIs, timelines and numeric charts from structured data. Use PNGs for screenshots, illustrations, branded visuals or approved source evidence. Do not ask an image model to invent legible SQL, financial tables or exact chart labels.

Current native item renderers: note, code, table, KPI, bar/line chart, Gantt and normalized image. Current item export: PNG/SVG. Current workspace publication: self-contained printable HTML with a Canva page annotation. Code/table item PNG exports are compact representations; the HTML/JSON retain the underlying text/data.

Existing DiagramCloud architecture HTML/PPTX exporters are retained. The new composed workspace is NOT yet rendered to editable PPTX by that old exporter. Implement an explicit adapter before advertising that capability. Full offline interactive workspace export is also later work; current mini documents are static.

Canva is an optional publication adapter, not the canonical grammar. Transfer the approved mini document/cards, preserve a source pack/revision, and record the returned design identifier. Do not promise exact layout preservation, editable native charts, or a lossless Canva-to-JSON round trip. Download final exports into Drive; do not persist a temporary Canva download URL as the canonical asset identity.

## Storage and publication

No cloud provisioning is part of this pilot. Core authoring stays local-first/Git-backed.

- GCS: reusable image objects and generated PNGs. Use stable artifact IDs, hashes and object-generation references, not expiring signed URLs in Git. Default private; publish only explicitly approved derivatives. Never make the entire screenshot bucket public for convenience.
- Drive: human-facing final PDFs/PPTX and project briefs. Keep immutable publication versions and a selected current pointer.
- BigQuery: optional catalog projection over approved artifact metadata; not the source of truth for editing.
- The free tier is a bounded allowance, not a universal zero-spend guarantee. Review regions, storage, operations, egress and retained/deleted versions before provisioning. Budget alerts are not a hard spending cap.

## Evidence and privacy rules

Separate these dimensions:

- provenance: source-derived, synthetic, reconstruction, author;
- assertion: declared, inferred, illustrative, verified-in-source;
- approval: draft or approved;
- visibility: private or public;
- future runtime state: unknown, observed at timestamp, verified by a cited run.

A public item citing a private source must not leak that source or its content through a public export. A chart whose input table is private/draft is removed. Public export is a real data projection, not CSS hiding. The original user PDFs and private repository payloads are not bundled in the public source.

## Pilot delivered by this branch

- one Evidence workspaces entry inside the existing app;
- architecture nodes can link directly to an experience workspace with `experienceWorkspaceId`; the first wired paths are TotalEnergies SQL quality checks -> `quality-screen` and Data Projects constellation / DataPass VS Code -> `galaxy-screen`;
- architecture navigation reuses the existing DiagramCanvas, with containment fixes for nested modal maps;
- six seeded example workspaces plus a source-derived DataPass Galaxy screen; reusable items include SQL, tables, KPI, bar/line charts, Gantt, narrative and bounded images;
- task-level SQL input/rule/expected-output composition;
- reference reuse across a mixed portfolio board;
- focus/restore, numeric grid placement editing, two-column/single-column layout presets, empty custom-board creation and duplicate-as-board composition;
- image attachment using the existing bounded normalizer, private/draft by default;
- manual experience/DataPass/CodeWiki JSON import;
- save into the existing canonical project/IndexedDB flow;
- diagram-node -> workspace links;
- redacted, read-only workspace viewing in Portfolio/Present modes;
- per-item PNG/SVG and selected mini-document HTML export;
- generated JSON Schema/example files under public/experience;
- unit/security/adapter tests and browser journeys.

Numeric grid editing is NOT a completed drag/dock window manager. Code is inert display, not a notebook kernel. DataPass v2 synchronization, full CodeWiki generation, actual GCS uploads, new composed PPTX rendering, automatic Canva publishing and live database queries are not implemented here.

## Finish gates

### Gate 1: reliable vertical slice

Prove: company -> project -> task -> code/table/result screen; edit/reuse an item; save/reload; export/re-import; private/draft content absent in publication. Keep old diagrams and exports working.

### Gate 2: workspace ergonomics

Add reusable docking/grid interactions, named layouts, tab groups, keyboard movement/resize, item selection across views, scoped filters, remembered viewport, breadcrumbs and deep links. Reuse tested Mosaic layout primitives where licensing/contracts permit, not its runtime or private dataset stores.

### Gate 3: credible source ingestion

Add reviewed DataPass snapshot bundles and pinned CodeWiki/source excerpts. Separate imported facts from inferred architecture and human task/contribution descriptions. Add source-to-task mapping, refresh/stale evidence markers and diff review.

### Gate 4: publication fidelity

One task brief and one mixed portfolio brief exported to HTML/PDF and native/editable PPTX where supported. Optional Canva import/export is verified on a real mini document. Redaction must precede every format, including image captions and embedded metadata.

### Gate 5: connected asset storage

Implement GCS upload/read/signing boundary and Drive final publication. Add hash-based asset manifest and optional BigQuery metadata projection only after the local vertical slice works. No secrets in Vite variables or project JSON.

## Acceptance journeys for the next implementer

1. Open Evidence workspaces -> TotalEnergies -> Project controls -> Validate schedule rows. Show input, SQL, expected exceptions and task contract.
2. Open Portfolio remix. Add Portable project context by reference. Focus/restore it, move/resize the placement, remove the placement and verify the source item still exists.
3. Save while an existing architecture node is selected. Reload and click that node; it should reopen the saved workspace.
4. Export the experience pack, change a title without changing the base revision, validate/preview/apply. Reject stale revisions and malformed references.
5. Import a CodeWiki-shaped module tree. Show inferred modules/components without invented tasks or query results.
6. Import a DataPass v1 manifest containing test paths/hosts/commands. Verify the sanitized pack contains none of those values.
7. Mark a table private or draft. Its dependent charts disappear from the public output. Verify Portfolio mode does not expose the authoring pack.
8. Export a mini document and individual chart PNG. Inspect readability, provenance and clipping. Do not describe a static export as interactive.

Run `npm run check`, `npm test`, `npm run build`, then `npm run test:e2e` with Playwright Chromium. Local browser-policy blocks are environment failures, not passing browser evidence. Prefer the hosted CI artifact for interaction proof when the local environment blocks localhost.


## Latest continuation after recovery

The recovered Pro branch was continued without changing the product direction.

### Direct architecture-to-workspace vertical slices

- The TotalEnergies `SQL quality checks` architecture node carries `experienceWorkspaceId: quality-screen`.
- The constellation's `Data Platform VS Code control plane` node carries `experienceWorkspaceId: galaxy-screen`.
- Linked nodes are labelled **Open task workspace** in the architecture card rather than pretending the click only opens a subdiagram.
- Closing a linked workspace leaves the user on the associated deeper architecture path underneath.

### Source-derived DataPass Galaxy screen

A second DataPass source was pinned to repository commit `5af14e5e9a5e825b5c3e5d1854cde04b35be5e4b` and is used for a source-derived Galaxy task workspace. The workspace records the implemented README-level surfaces (Galaxy, project manifests, Fabric, Databricks, Power BI, Grafana and infrastructure), their provider-tool boundaries, and the repository's explicit safety contract. It is documentation of repository behavior, not a live environment-health capture.

### Board composition

A workspace can now be duplicated into a new private board while retaining the same item IDs. Removing a placement does not remove the underlying item; it can be added back or reused elsewhere. Users can also create an empty private board and apply two-column or single-column layout presets. This is the first concrete implementation of the portfolio-remix idea and should be evolved toward drag/dock layouts rather than replaced with a separate Canva-style source of truth.

## Report and task screens (2026-09-24)

Workspaces now open in **Report view**: a screen styled after the 18-page portfolio slides. It has a dark context rail (scope trail, workspace `context` sections and cited sources), a title, panels without editing controls, and a footer that repeats each provenance class and the "no live query" statement. **Edit board** switches to the previous editing tools (focus, placement, add/remove references, per-item PNG/SVG); **Report view** switches back. The in-app screen and the exported mini document come from the same `reportScreenHtml`, so the export matches what was on screen. The export has no script, and the tabs are CSS-only.

New grammar, all optional (existing packs stay valid):

| Where | Added |
| --- | --- |
| `kpi` | `delta`, `trend` (up/down/flat), `tone`, `comparison`: a displayed comparison, not a computed one |
| `chart.chartType` | `hbar`, `stacked`, `donut` (one value column), `scatter` (x and y value columns, coloured by label) |
| `table` | `statusColumn` → status badges; numeric columns right-aligned; key/ID/year columns unformatted |
| `gantt` | task `id`, `group` (colour and legend), `dependsOn`; `milestones` |
| new `filters` | displayed slicer state ("not a live filter") |
| new `callouts` | insight cards with tone |
| new `steps` | numbered process strip (e.g. Input → Rule → Exceptions → Decision) |
| new `tabs` | 2–6 existing items as tabs; no nesting; public export keeps only public children and drops a set left with fewer than two |
| workspace | `context` rail sections and `accent` (blue/teal/orange/violet) |

Showcase screens (invented values, generic asset names, labelled synthetic; the slides are layout references only): **BI quicklook** (portfolio p.6), **DAX & SQL** (p.9) and **Gantt planning & delivery** (p.10). The SQL quality task gained a step strip and context rail. The TotalEnergies "Power BI reporting" node opens the quicklook screen.

Not yet (editable PPTX was added later; see "PowerPoint export" below): drag/resize in Report view, FOIL (Streamlit/Databricks, pp.13–18) and model/semantic-diagram screens (p.8), and live filtering.

### FOIL screens (2026-09-24)

Five report screens under the FOIL scope, modelled on the six-page (pp.4–6) and 18-page (pp.13, 17, 18) portfolios:

| Screen | Foil'O diagram box that opens it | Reference page |
| --- | --- | --- |
| Oscillating hydrofoil system: conversion chain, active control, machine data contract, what was modelled | Site and machine inputs | 6-page p.6 |
| Physics, Monte Carlo and Spark: power formula, P ∝ V³ curve, design grid, 1,000-draw AEP distribution, P90/P50/P10 | PySpark simulation | 6-page p.5 |
| Techno-economic modelling: AEP/LCOE/NPV/payback, scenario table, LCOE formula, sensitivity tornado, LCOE by discount rate | Gold scenario outputs | 6-page p.4 |
| Databricks pipeline: medallion strip, Bronze→Silver PySpark notebook, Unity Catalog objects, job runs, MLflow runs, volume by layer | Jobs, catalog and tracking | 18-page pp.13, 18 |
| Scenario decision app: parameters, KPIs, production vs installed power, cost by stage (upgrades the earlier FOIL screen; its items are kept) | Streamlit decision app | 18-page p.17 |

The two decks use different illustrative figures (for example NPV). These screens use a third, invented set, and a unit test checks that neither deck's headline figures appear. The P ∝ V³ curve is computed from the formula with stated constants (available power, not machine output). "Role", "What was modelled", "Monte Carlo method" and "What was delivered" repeat portfolio wording and are labelled *reconstruction* with the page cited. Photos from the decks are not reused (image rights unknown).

New grammar: a `formula` item (plain-text equation plus symbol legend, nothing evaluated) and `hbar` with two value columns for low/high range bars (tornado). Tables show negative numbers in red.

### PowerPoint export of report screens (2026-09-25)

**Export PowerPoint** (report and edit views) downloads `<workspace>.pptx`, built by `src/experience/pptx.ts` with the same rail, title, 12-column grid, provenance chips and footer as the Report view. It uses only `publicPack` content, like the HTML export.

- Charts are native, editable PowerPoint charts (bar, stacked, horizontal, range/tornado, line, doughnut, scatter), each with its data sheet. Tables are native tables with status colours and negative numbers in red. The Gantt, steps, filters, callouts, formula and KPI tiles are shapes and text. Nothing is a screenshot.
- A tall screen splits across slides at row boundaries no panel crosses (at most 9 grid rows per slide when possible). A tab set shows its first tab; the other tabs follow on their own slides.
- A long table, code block or note is shortened on the slide with an explicit "… N more / continued" marker. The full content, plus sources and provenance, is in the speaker notes.
- Verified by opening the generated decks, including the one the browser downloads, in desktop PowerPoint and exporting every slide to PNG. That check found a stacked chart with `outEnd` data labels, which made PowerPoint refuse the whole file; `tests/pptx.test.ts` now guards against it.

Limits: text sizes are estimated (there is no font measurement in the browser), so a very dense panel can still look crowded. Gantt dependency lines are simple elbows, and images are placed with contain-sizing.

### Project and scope decks (2026-09-25)

- **Export & share → Project deck (PowerPoint)** downloads `<project>.deck.pptx`. It contains a cover, a contents slide with clickable links, an Architecture section (the public views, with box → child-view links kept), one section per scope group with every public report screen reachable from the project's experience root, and a sources-and-provenance table.
- **Evidence workspaces → scope map → Export scope deck** does the same for the selected scope (report screens only), for example FOIL alone.
- Groups are the scope's direct children. When every group would hold a single screen, they merge into one section named after the scope, so the deck has no divider per screen. A screen shared by two scopes appears once.
- Built by `src/export/deck.ts` on top of `addArchitectureSlides` (src/export/pptx.ts) and `addWorkspaceSlides` (src/experience/pptx.ts). Everything passes through `publicDocument` / `publicPack`. The limit is 180 slides; above it, the export asks for a scope deck instead.
- Tests resolve every hyperlink in the saved file to its target slide. Downloaded decks were opened in desktop PowerPoint, which confirmed the link targets.

Not included in the project deck: node evidence blocks (they remain in the architecture-only PowerPoint).

### Semantic model item (2026-09-25)

New `model` item for star schemas (portfolio p.8):

- `tables` have a kind (fact/dimension/bridge/other) and columns with optional `pk`/`fk` markers. `relationships` are `"Table.Column" → "Table.Column"` with cardinality `*:1`, `1:1` or `*:*`, and `active` (inactive relationships are drawn dashed). `measures` hold names with an optional home table.
- Validation checks duplicate tables and columns, unknown `Table.Column` references, relationships inside one table, dots in table names, half-given positions, and measures that name an unknown table.
- `src/experience/semantic.ts` computes one layout shared by the in-app view, the HTML export and the PowerPoint export. Facts sit in the middle band and each dimension goes above or below, near the facts it relates to. When a row is too wide it falls back to even spacing. Setting `col`/`row` on every table overrides the automatic layout. Keys are listed first; wide tables show five columns plus a "… N more" line. PowerPoint notes carry the full table, column and relationship list.
- The showcase task is **BI reporting → Design the semantic model**: three facts and seven shared dimensions, consistent with the DAX & SQL screen's `Fact_Energy` / `DimProduct` / `DimRegion` / `DimDate`. It reuses that screen's DAX measures item by reference. "What the model serves" repeats portfolio p.8 wording (reconstruction); the "Design rules" are an authored explanation.

Not included: many-to-many bridge routing hints, cross-filter direction arrows, and an editor. Change the model through Workspace JSON / AI.

### Drag to move and resize panels (2026-09-25)

In **Edit board**, every panel has a ⠿ grip (top-right) to move it and a corner handle (bottom-right) to resize it. While dragging, a ghost outline snaps to the 12-column grid and names the target cell. It turns red and states the reason when the drop would overlap another panel or leave the grid, and dropping there changes nothing. With keyboard focus on the grip, arrow keys move by one cell; on the corner handle, they change width and height. A status line reports every result.

The geometry lives in `src/experience/layout.ts` (pure, unit-tested; its limits mirror `packSchema`). Commits go through the usual `change()` → `validatePack` path, so a dragged layout is validated like any other edit, and **Save in current project** persists it. The numeric Layout form still works. Report view and the HTML/PowerPoint exports use the new positions. Dragging is off in Report view, read-only modes and item focus.

### Undo and redo for board edits (2026-09-25)

Every edit in Evidence workspaces can be undone and redone: moves, resizes, added or removed panels, layout presets, board settings, new boards, attached images and applied imports. The **↶ Undo** and **↷ Redo** buttons in Edit board name the step ("Undo: Resized 'SQL validation rule'"). Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Shortcuts are ignored while typing in a field, where Ctrl+Z stays text undo.

`src/experience/history.ts` is pure and unit-tested. Labels come from comparing the pack before and after an edit, so new edit types are labelled automatically. History holds 50 steps. Undo and redo restore content but always issue a new, higher revision, so an AI import prepared against an older revision is still refused (tested). History lives while the Evidence workspaces dialog is open. After **Save in current project**, the project-level Undo in Edit mode can revert the whole saved change.

### Data-model editor (2026-09-25)

In **Edit board**, a model panel has an **Edit model** button that opens an editor above the board. The diagram, HTML export and PowerPoint update live.

- **Tables:** add, rename, delete; set the kind. A new table starts with a key column so it can be related at once.
- **Columns:** add, rename, delete; set the type and the PK/FK key.
- **Relationships:** add them by picking `Table.Column` on each side; change cardinality; switch active/inactive; delete. A second path between two tables that are already related starts inactive.
- **Measures:** add (with an optional home table) and delete.

Renaming a table or column rewrites every relationship and measure that refers to it. Deleting one also removes the relationships that used it, and the undo label says how many ("Removed table DimArea and 1 relationship"). Each change is one undo step. Names apply on Enter or when leaving the field; Escape or a refused edit (duplicate name, dot in a table name, unrelated columns…) restores the old value and shows the reason.

The edits are pure functions in `src/experience/modelEdit.ts`; every result is checked against `validatePack` in `tests/modelEdit.test.ts`.

Not included: the KPI tiles on the showcase screen ("10 tables", "10 relationships", "6 measures") are separate authored items, so they do not recount themselves after model edits. Relationships are added from lists rather than by dragging between tables in the diagram.

### Multi-select and align (2026-09-25)

In **Edit board**:

- **Selecting:** tick a panel's checkbox, or Ctrl/Shift-click its header, to select it. Esc clears the selection without closing the dialog.
- **Moving a group:** dragging the grip of a selected panel moves the whole selection, with one ghost per panel. Arrow keys on that grip move the group one cell. The move is limited so the whole group stays on the grid.
- **Aligning:** with two or more panels selected, the toolbar offers Align left / right / top / bottom (to the outermost selected edge) and Match width / height (to the largest).
- **Safety and undo:** a group move or alignment that would overlap another panel or leave the grid changes nothing and names the clash ("'SQL validation rule' would overlap 'Scenario comparison'"). Each group action is one undo step ("Moved 2 panels", "Align top: 2 panels").
- **Code:** `groupShift`, `groupProblem` and `aligned` live in `src/experience/layout.ts` and are unit-tested. Resizing stays single-panel.

### KPI tiles that count (2026-09-25)

A `kpi` item can carry `derive: {itemId, metric}` to show a live count instead of its typed `value`:

- **Model metrics:** `tables`, `facts`, `dimensions`, `relationships`, `active`, `inactive`, `measures`, `columns`.
- **Table metric:** `rows`.
- **Notes:** the note may use the same counts as `{tokens}`, e.g. `"{facts} facts · {dimensions} dimensions"`. Unknown tokens stay visible.
- **Honesty:** a counted tile says "↻ counted from '<source title>'" in the app, the HTML export and PowerPoint (slide and notes). All three use `kpiDisplay` in `src/experience/kpi.ts`.
- **Validation:** a tile that counts from an unknown item, from itself, or from the wrong kind of item is rejected.
- **Privacy:** a tile counting a private or draft item is removed from public output, since a count can leak what redaction removed. A public tile keeps its public source in the pack even when the source isn't placed.
- **Showcase:** the three tiles on "Design the semantic model" now count from the star schema, so they follow edits made in the model editor.

Set `derive` with the Count source form (below) or through Workspace JSON / AI.

### Distribute and stack (2026-09-25)

The selection toolbar in Edit board adds:

- **Distribute horizontally / vertically** (3+ panels): the first and last panel stay where they are and the gaps between neighbours become equal. When the cells don't divide evenly, the extra cells go to the leading gaps.
- **Stack vertically / horizontally** (2+ panels): panels go edge to edge in their current order, starting at the selection's top-left and aligned on its left or top edge.

Sizes never change. As with align, the result is checked as a whole: overlaps or cells outside the grid (e.g. three 6-wide panels side by side) change nothing and give the reason. Each action is one undo step. Code: `arranged` in `src/experience/layout.ts`.

### KPI count-source form (2026-09-25)

In Edit board, each KPI panel has a **Count source** button. The form sets:

- **Counts from:** any model or table in the pack, or "Nothing: typed value".
- **Count:** only the metrics the chosen source provides, each shown with its current number.
- **Note:** the tokens available for the source are listed with their values.

A preview shows the tile as it will look, and **Apply count source** is one undo step; it stays disabled until something changes.

- **Stored value:** applying refreshes the tile's stored `value` to the count, so the fallback used if the source is later removed is current.
- **Back to typed:** switching back to a typed value keeps the current count, and fills the note's tokens from the old source, so the tile looks the same until someone edits it.
- **Public warning:** if the source is private, draft or cites a private source, the form warns that a public tile counting it will be left out of public exports.

Code: `withSource`, `countableSources` and `publicWarning` in `src/experience/kpi.ts` (pure, unit-tested), and `src/experience/KpiSourceEditor.tsx`.

### Project deck: box → screen links (2026-09-25)

In the project deck, a diagram box whose component has a task screen (`experienceWorkspaceId`) now links to that screen's first slide:

- **The box:** it gets a blue border and a small **SCREEN ›** link at its top right.
- **The box title:** it still opens the deeper view; when the box has no deeper view, the title opens the screen too.
- **The way back:** every slide of a linked screen (all parts and tab slides) has a **← Architecture: <view>** link in its header, to the first view that shows the box.
- **Speaker notes:** the view slide's notes list "Task screen: <title> (slide N)".

Boxes can only link to screens that are in the deck, i.e. public and approved. A private screen gets no link and no SCREEN label. The architecture-only PowerPoint and scope decks are unchanged.

**How slide numbers are known in advance:** screens come after the architecture slides, so the numbers are needed before those slides exist. `planLinks` in `src/export/deck.ts` counts each screen's slides by running `addWorkspaceSlides` into a throwaway deck; the count does not depend on the header text or links. `buildDeck` then checks that the real run lands every screen on the planned slide, and throws if not, so a wrong link cannot ship.

Verified in desktop PowerPoint: the links go to the right slides and the rendered slides were checked visually.
