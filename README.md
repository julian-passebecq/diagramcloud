# DiagramCloud

**Architecture → the work behind it → the evidence.**

DiagramCloud is a local-first, static web studio for explaining a project: select a component and its child architecture opens underneath while the parent stays visible, continue into a task workspace, and read the evidence (code, tables, metrics, images, sources) behind it. The same document produces a public portfolio, a guided walkthrough and native exports. It is the DataPass/Galaxy product for architecture explanation, realization evidence and publication.

## Current state (read this first)

| | |
|---|---|
| Repository | `julian-passebecq/diagramcloud`, branch `main` (the only maintained line) |
| Product version | **1.2.0** (`package.json`; shown in the header) |
| Document schema | `schemaVersion: 1` (`src/core/model.ts`; additive changes only since V1) |
| Galaxy maturity | **G0**, standalone (`public/galaxy/version-handshake.json`); contract support does not promote it |
| Release verification | [docs/RELEASE.md](docs/RELEASE.md): commands, the `galaxy.verification-receipt/1` receipt and the release record |
| Browser target | Chrome / Chromium (the only browser the test suite qualifies) |
| Hosting | Any static host; production is the Vercel project connected to `main` ([docs/VERCEL.md](docs/VERCEL.md)) |

**What it is:** React + TypeScript + Fluent UI + React Flow, Vite build, IndexedDB storage, no server, no account, no database. Optional integrations (Google Drive asset vault, DataPass repository folder bridge) stay optional.

**What it is not:** a cloud runtime, an IDE, a notebook kernel, a SQL/Python/DAX/Spark engine, a Git or task authority, a MongoDB UI, live infrastructure monitoring, or a replacement for DataPass VS Code, Studio or Galaxy. Code and rows are displayed, never executed.

## The grammar

DiagramCloud uses one vocabulary in its model, Inspector, badges, exports and contracts, aligned with DataPass/Galaxy:

| Question | DiagramCloud answer |
|---|---|
| What is it? | **Project → Architecture / View → Component** (stable lowercase IDs; renaming never changes identity) |
| What was designed? | A component's design status: illustrative intent, never a deployment claim |
| What was actually seen? | An **Observation** from another app: observed / verified / partial / not observed, dated, at a source revision |
| How do we know? | **Evidence** blocks and **Sources**, each labelled source-derived, synthetic, reference or author |
| How strong is the claim? | The observation's claim and its owner; for releases, the **verification receipt** level |
| Who owns the fact? | The producing app and authority named on the observation; DiagramCloud only presents it |
| Can it be shared? | Author review + public visibility (**Presented**) + an explicit shareable flag for the portfolio index |
| Where is the work? | **Task / Workspace** screens linked from a component |
| How is it published? | Story, HTML, SVG, PNG, PPTX, project deck, portfolio index |

Synthetic evidence stays synthetic: it can never back an observation (`validateDocument` refuses it), and a Galaxy snapshot cannot back a `verified` claim with it.

The Inspector shows every selected component in the same order: **Identity, Meaning, Realization, Evidence, Work, Publication**.

## Start locally

Use Node.js 22.

```sh
npm ci
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). `npm run build` writes a static `dist/` that any HTTP host can serve; do not open `dist/index.html` from disk (ES modules need an origin). Exported `*.html` portfolios, by contrast, are self-contained and work offline from a file.

Qualification commands are in [docs/RELEASE.md](docs/RELEASE.md).

## First walkthrough

Open **TotalEnergies**. Click **SQL quality checks**, then **Required fields**. The architecture stays above, the validation workflow opens below, and the evidence appears underneath; the Inspector on the left explains the selected component. **Open task workspace** opens the linked task screen.

Modes: **Explore** is read-only. **Edit** adds dragging, connections, properties, new components and child diagrams, visual evidence editors, sources, story composition, observation review and undo/redo. **Portfolio** shows only the public projection. **Present** adds the guided story. Light and dark themes and reduced motion are supported.

## Authoring without raw JSON

Ordinary authoring is visual: project metadata and sources; components (identity, meaning, design status, cited sources, visibility); connections; child views; workspace links; explanations, code, images, metrics and **tables** (columns, rows, reorder, paste from a spreadsheet); block order; the **transformation explainer** (input rows → logic → output rows, column mapping, grain/keys/quality rules; explanatory only); story steps; observation review, visibility and sharing.

JSON / AI remains the path for whole-document edits, RFC 6902 patches addressed by stable ID (`@id` segments, refused when the base revision is stale), observation patches and Galaxy publication snapshots. Every import is validated, previewed item by item and applied only after review.

## Import draw.io, Mermaid and Visio

**Import draw.io / Mermaid / Visio** in the gallery (or the file button in JSON / AI) turns an existing diagram into a new DiagramCloud project. You can also paste Mermaid or draw.io XML into the JSON box. Visio files are converted as soon as you pick them.

| Source | Read | Kept | Not imported (listed in the report) |
|---|---|---|---|
| draw.io / diagrams.net | `.drawio`, `.xml` (plain or compressed pages), editable `.drawio.svg` and `.drawio.png` | every page (more than one page gives a root view of page cards that drill into each page), boxes, labels (HTML stripped, `%placeholders%` and C4 fields resolved), connectors and their labels, containers and drawn frames as group tags, the arrangement (rescaled for DiagramCloud cards), unlabelled AWS/Azure/GCP stencils named after their shape, provider names | colours, fonts, styles, waypoints, vendor artwork (generic symbols are drawn), free text, decorative shapes; connectors with a loose end; unsnapped connector ends are attached to the box under them and counted |
| Mermaid | `flowchart`/`graph` and `architecture-beta` (`.mmd`, `.mermaid`, or the first ```` ```mermaid ```` block of a `.md`) | node IDs as stable component IDs, labels, shapes as component types, links and labels (every link form, chains, `&` lists, edge IDs, `@{ shape }` data), subgraphs/groups as tags, the title, LR/TB direction with a layered layout | `classDef`, `class`, `style`, `linkStyle`, `click`, Markdown formatting; other diagram types (sequence, class, ER, Gantt…) are refused with a message |
| Visio | `.vsdx` drawings (also `.vsdm`, `.vstx`, `.vstm`); Lucidchart and most diagram tools can save as `.vsdx` | every foreground page (a root view of page cards when there is more than one), shape text or, without text, the master shape's name, connectors glued to shapes or dropped on them, containers and drawn frames as group tags, captions placed next to an unlabelled icon or at the top of a frame as its name, the arrangement, provider names from master shapes | themes, fills, lines, fonts, shape data, layers, pictures, background pages, connector routes; binary `.vsd` and Visio 2003 `.vdx` are refused with a "save as .vsdx" message |

Every import shows a report of what was kept and what was not, then becomes a **new** project (the open one never changes) after the usual validation and review. Component types and providers are inferred from labels and shapes: check them in the Inspector. Imported diagrams are public by default like any authored project; review before publishing.

## Included examples

| Project | Scope | Provenance |
|---|---|---|
| Data Projects \| constellation / DataPass architecture map | Platform, Foil macro architecture, provider sub-architectures, task/table examples | Author-created current-state planning model |
| TotalEnergies | Cost/schedule flow, SQL checks, data model, reporting screens | Reconstructed from two supplied PDFs; synthetic code and rows |
| Foil'O Ecologie | Hydrofoil, Databricks workflow, governance, scenario screens | Reconstructed from the PDFs; not a verified scientific solver |
| Microsoft Fabric | Medallion architecture, ingestion, Silver transformation | Independently authored reference with official documentation links |
| Databricks | Medallion architecture, contracts, deduplication | Independently authored reference with official documentation links |

The gallery filters to **Portfolio**, **Cloud architectures** (every reference above) and **Your projects** (blank, imported and your own).
| AWS serverless web application | CDN, API, functions, table; request path with idempotency | Independently authored reference citing AWS documentation |
| Azure web app with private data | Front Door, App Service, Key Vault, private SQL; private networking path | Independently authored reference citing the Azure Architecture Center |
| Google Cloud streaming analytics | Pub/Sub, Dataflow, BigQuery, dead-letter; windowing detail | Independently authored reference citing Google Cloud documentation |
| Microservices on Kubernetes | Ingress, services, config, autoscaling detail | Independently authored reference citing Kubernetes documentation |
| Event-driven orders with an outbox | Outbox relay, broker, idempotent consumers, dead-letter queue | Independently authored, cloud-agnostic pattern reference |
| Blank project | One component to start editing | Author-created |

Illustrative financial scenarios are not combined or presented as employer achievements. The original PDFs and any confidential employer files are not stored in this repository.

## Exports and fidelity

| Format | Included | Deliberate limits |
|---|---|---|
| Authoring JSON | Full validated document, including private and unattached content | A backup, not a safe public artifact |
| Public JSON | Reachable public graph, evidence, assets, sources, presented observations | Public text still needs human confidentiality review |
| Interactive HTML | All public views, drilldown, evidence, realization badges and lists, guided story; no network | Read-only; static diagrams |
| SVG | Current public view with realization badges; embedded public document metadata supports re-import | Semantic export, not pixel-identical to the editor |
| PNG | Current view with badges, up to a 4096-pixel longest edge | Raster, no metadata |
| PowerPoint | Native editable shapes, text, tables; realization badges, notes and appendix; source notes; drilldown hyperlinks | Static; a semantic reconstruction, not a screenshot |
| Project deck | Cover, linked contents, architecture, every public task screen, realization section, sources | Max 180 slides |
| Scope deck | One scope's report screens (Evidence workspaces) | Task screens only |
| draw.io | Every public view as an editable page: boxes at their positions, the export routes pinned as waypoints, labels, storage cylinders, drilldown cards as page links; component ID, type, provider and presented realization as shape data | No evidence, sources or story; generic symbols, not vendor artwork. Imports back with the same IDs, types, connections and drilldowns |
| Mermaid | Flowchart of the current view, realization as classes and comments | Lossy: no evidence, hierarchy or caveats |
| Print / PDF | Browser print of the expanded public views and selected evidence | Not an all-project pagination engine |
| Portfolio index | `diagramcloud.portfolio-index/1` for Mongoku's read-only view | Only reviewed, public, shareable observations; ≤ 25 items, ≤ 64 KiB |

All exports are built from `publicDocument`: private objects are removed, not hidden. Uploaded SVG is sanitized and rasterized; PNG/JPEG/WebP uploads are re-encoded. Details: [realization contract](docs/contracts/realization-overlay.md), [architecture](docs/ARCHITECTURE.md).

## Galaxy contracts

Local contract support (no companion app required): `galaxy.entity/1`, `galaxy.evidence-ref/1`, `galaxy.version-handshake/1`, `galaxy.publication-snapshot/1` (produce and consume through review), `galaxy.deep-link/1` (`diagramcloud.project-view-node/1`, `?project=&view=&node=`, parent drilldown kept, visible failure for unresolved targets) and `galaxy.verification-receipt/1` (release evidence). Galaxy owner app ID: `diagramcloud`. See [docs/contracts/galaxy-v1g.md](docs/contracts/galaxy-v1g.md).

## Storage and safety

Projects live in this browser's IndexedDB. Saves are queued so only the newest edit can report "Saved locally"; save failures, quota errors, corrupt rows (quarantined, with a recovery screen) and edits from another tab are surfaced; unsaved work triggers a leave-page guard. There is no server synchronization or collaborative merge. Export Authoring JSON backups.

Credential-like values and `.env`-looking text are refused where content crosses an app boundary (observations, snapshots, receipts, the portfolio index). This is not secret scanning, DLP or access control: a sensitive fact marked public remains public. Human publication review remains required.

## Current limitations

These are the genuine post-V1 boundaries (full list and candidates in [docs/ROADMAP.md](docs/ROADMAP.md)):

- Chrome/Chromium only is qualified; other browsers are untested.
- draw.io, Mermaid and Visio import are adapters with a loss report: no styles or vendor artwork, no binary `.vsd`, no Lucidchart native file (use its `.vsdx` export), no arbitrary SVG → editable graph, no lossless Mermaid round trip, only Mermaid flowchart / architecture-beta, and no export to Visio. draw.io export → import is a tested round trip for components, connections and drilldowns, not for styles.
- The layout button is a grid, not a graph auto-layout engine; export routing avoids boxes on the shipped samples (unit-tested), not on every possible layout. The interactive canvas routes edges on its own.
- No live cloud discovery, no execution of SQL/DAX/Python/Spark, no real-time collaboration or server sync.
- Observations are one-time reviewed imports, not subscriptions; DiagramCloud never polls another app.
- The DataPass folder bridge needs the folder to be chosen again after a reload (the handle is not persisted).
- Vendor artwork: eight Microsoft Fabric item icons; Azure and Databricks use generic symbols.
- PPTX fidelity is a semantic reconstruction, not a pixel copy of arbitrary layouts.

## License and documents

Original source is MIT. Dependencies and Microsoft artwork keep their own terms: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No font files are bundled.

Read next: [AGENTS.md](AGENTS.md) (rules for AI and human contributors), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/RELEASE.md](docs/RELEASE.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/RESEARCH.md](docs/RESEARCH.md), [docs/GOOGLE_DRIVE.md](docs/GOOGLE_DRIVE.md). Documents under `docs/pro-pass/` and `docs/ARTIFACT_PLATFORM.md` are historical working notes.
