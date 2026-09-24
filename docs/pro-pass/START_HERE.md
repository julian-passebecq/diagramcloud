# DiagramCloud: project experience architecture

Date: 2026-09-24
Status: product contract and bounded implementation pilot, not a completed release.
Base: the existing V1.4 architecture-content branch. Preserve the existing React/Fluent shell and React Flow canvas.

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
