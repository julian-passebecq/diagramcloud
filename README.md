# DiagramCloud

**Architecture → the work behind it → the evidence.**

DiagramCloud is a local-first, static web studio for explaining a project: select a component and its child architecture opens underneath while the parent stays visible, continue into a task workspace, and read the evidence (code, tables, metrics, images, sources) behind it. The same document produces a public portfolio, a guided walkthrough and native exports. It is the DataPass/Galaxy product for architecture explanation, realization evidence and publication.

## Current state (read this first)

| | |
|---|---|
| Repository | `julian-passebecq/diagramcloud`, branch `main` (the only maintained line) |
| Product version | **1.15.0** (`package.json`; shown in the header) |
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

## Project atlas: several repositories

A project is often several repositories. **Import project manifest** in the gallery reads a `diagramcloud.project-manifest` JSON (or a DataPass `.datapass/project.json`, or a Claude Control `galaxy.json` map: apps become members, connections become relationships labelled with their contract; *live* connections that name a source file are static source, *branch* and *planned* ones stay planned) and creates one project: a root view with one card per repository and the relationships the manifest declares (basis *planned*). Membership only comes from that file or from an explicit **Add repository**: DiagramCloud never scans an account and guesses.

Each repository keeps its own host, locator and revision: a snapshot is a **revision vector** (`shop @ a1b2…, billing @ c3d4…`), never one project SHA. **Project atlas** (header) lists the repositories with their revision, branch and scan status, names stale or missing sources (never scanned, scan failed, folder missing, revision unknown, scanned long ago, source moved on), compares two snapshots, and **Rescan…** replaces one repository from its local folder after the usual review, under its own ID prefix so the others are untouched. Up to 20 snapshots are kept; public exports keep only the current one, only for public repositories, without runtime or project-context pointers.

```
npm run atlas -- project.manifest.json --out atlas.json [--previous atlas.json] [--stale-days 30]
```

The CLI scans every repository that has a local `path` in the manifest, records each revision from `.git/HEAD`, and prints the revision vector, the comparison with `--previous` and stale or missing sources. It is read-only and never runs git or touches the network.

**Read Lens minimap** (Project atlas, Edit) reads a `datapass.lens.minimap/1` export from DataPass Lens, the authority for observed Git and delivery state. Repositories are matched to atlas members by name and host; others are reported, never added. After review, a new snapshot records, per matched repository, the observed default-branch head, exact-head CI, request states, agent sessions and attention counts as runtime pointers (basis observed). They are not components, never change a design status and never reach public exports. A scanned repository keeps the revision its content was read at; when Lens sees a newer head, the panel marks it stale ("source is now at …"). An unknown revision is filled from Lens, labelled "from lens".

A repository without a card on the canvas reaches public exports only when its author marked it `visibility: "public"`.

The gallery's **Contoso Forecasting** reference atlas is read by hand from the public `contoso-data-studio` repository at one revision: the local lab as built (static source, each component linked to its file), the Fabric App target (planned; shared code keeps the same IDs in both views), and a data-zone view kept separate from the environment. Latency figures are the repository's own report, shown as a source-derived note, not an observation.

## Diagram Design mode

**Diagram Design** (canvas toolbar) draws the current public view as an editorial figure in the visual grammar of [diagram-design](https://github.com/cathrynlavery/diagram-design) (MIT; see THIRD_PARTY_NOTICES.md): semantic colour roles, rectangular type tags, rounded right-angle connectors with masked uppercase labels, fanned attach points, zones per repository, a legend strip and accessible SVG. The facts stay DiagramCloud's (scans, atlas, basis, revision vector, public redaction); only the drawing changes. 14 figures:

| Figure | Draws | Best for |
|---|---|---|
| Architecture | the view's components and connections on the shared box-avoiding routes | how parts talk |
| Layer stack | one band per layer (experience, services, control, data, sources), component chips, links counted between bands | what sits on what |
| Exploded stack (3D) | the drilldown chain through the view as stacked axonometric planes, parent on top, dashed traces from the component that opens each level; a view without drilldown is exploded by layer | levels of detail |
| Drilldown tree | every public view under the component that opens it, current view highlighted | where everything is |
| Swimlane | one lane per repository (two or more) or per layer, columns in reading order, on the same box-avoiding routes | who owns which step |
| Sequence | the view's components as participants with lifelines; every connection is one numbered message, in reading order (derived from the connections, not timing) | the path of one request or save |
| Story timeline | the guided story as numbered steps on an axis, steps on the current view highlighted; private steps counted, never drawn | the walkthrough at a glance |
| Chart | the first table evidence block of the view's components with numbers, as bars; its provenance (synthetic, source-derived, reference, author) is printed on the figure | the numbers behind a component |
| Deployment | components nested in one zone per provider (where they run), connections between them | where things run |
| Evidence matrix | components in a grid of basis (planned, read from source, unknown) by confidence (confirmed, inferred, possible) | how much is backed by source |
| Treemap | the drilldown hierarchy as nested tiles, area by number of components, current view highlighted | size of each part |
| Hub | one component (focal or most connected) at the centre with its direct upstream and downstream neighbours | what touches this part |
| Heatmap | a table evidence block as a grid of cells shaded per column, provenance printed | patterns in a table |
| Line chart | a table evidence block as up to three lines with direct labels, provenance printed | a trend in a table |

Themes: light, dark and editorial (adds drilldown path, revision vector and provenance cards). One or two **focal** components get the accent; without a hint, the single clearly most-connected component does, and the legend says so. In Edit, **Use for this view** stores the figure and theme on the view (`view.design`), so the **Diagram Design figure (SVG)** export and other people get the same figure. Figures are static, offline SVG with no script, built from `publicDocument`.

**Figure book and manual.** **Diagram Design figure book (HTML)** (Export & share) puts every public view on one offline page as its chosen figure, in drilldown order; `npm run design` also writes `book.html`. The **Technical manual** prints a view's Diagram Design figure when the view has a hint (dark prints light), and the numbered editorial figure otherwise.

**Architecture delta.** In Diagram Design mode, **Compare with another version…** reads another `diagramcloud.json` or authoring export of the same project (for example before a rescan) and draws Before · Changes · After for the current view, following diagram-design's architecture-delta conventions: components and connections compared by stable ID; added (+), removed (−, dashed), changed (Δ, with old → new in the ledger), moved (↗) and rewired (dotted) are readable without colour; unchanged objects stay quiet. The lower revision is Before. Nothing is imported, both versions go through `publicDocument`, and the figure says that a delta does not establish order or cause. `npm run design -- new.json --delta old.json` writes a delta per view.

**Design brief (AI bridge).** An agent that has scanned a repository or an atlas writes a `diagramcloud.design-brief/1` JSON: per view, the figure type, up to two focal component IDs, a theme, a caption and a short reason. **Read design brief…** (Diagram Design, Edit) shows what it changes and what it skips before you apply; it never touches components, connections, basis or observations. `npm run design -- <document.json> [--brief brief.json] [--out folder]` renders every public view without changing the file. The agent instructions are in `skills/diagramcloud-design/SKILL.md`; an example brief is `docs/design-brief.example.json`.

## Perspectives and the view spec

Every view has a perspective: System, Code, Data, Cloud, Git, CI/CD, Agents, Decisions or Evidence (views without one count as System). Selecting a component shows a **Perspectives** strip: *available* (the same component ID appears in a view of that perspective), *partial* (one of its drilldowns or the view that opens it has it), *unknown* (the project has that perspective, not for this component) or *not in this project*. Opening a perspective keeps the drilldown parents visible; **← / →** go back and forward through paths and selections. Each view heading names its perspective and, in a project atlas, the repository and revision it comes from. The **Basis** filter dims components that are not planned, read from source, unknown or unstated.

**Export & share → View spec (JSON)** writes `diagramcloud.viewspec/1` for the current public view: stable IDs, typed edges, basis, confidence, evidence and source references, presented realization, drilldown path and children, repository groups, the revision vector, a legend and what was omitted. It is the renderer-neutral contract for other renderers (a MosaicStudio scene, an editorial publisher); every built-in export reads the same document.

## Diagram from a repository

**Diagram from a repository** in the gallery reads a local Git folder in the browser (nothing is uploaded) and builds a project with four levels of detail, each a drilldown:

| Level | View | From |
|---|---|---|
| Macro | System context: the repository as one system, the external systems it uses, CI/CD and its deployment targets, its infrastructure as code per cloud provider | dependencies, example env files, GitHub Actions, Terraform |
| Medium | Containers: packages, compose services, Kubernetes workloads and ingresses, datastores, and a data model card | `package.json`, `requirements*.txt`, `pyproject.toml`, `go.mod`, Dockerfiles, docker-compose, Kubernetes manifests |
| Mini | Components: the modules (top-level source folders) of each container and the imports between them, with counts | TypeScript/JavaScript and Python import statements |
| Files | The files of each module and the imports between them | the same import statements |

Plus a **Data lineage** view (SQL `CREATE … AS SELECT`, `INSERT … SELECT`, foreign keys, dbt `ref`/`source`, Prisma relations) and an **Infrastructure** view per provider (Terraform resources and references).

Every component carries a *source-derived* evidence table (file, line, finding) and every link a confidence: **confirmed** (declared: `depends_on`, an import, a Terraform reference, a foreign key), **inferred** (implied: a database driver in the dependencies, a host name in configuration) or **possible** (a key name in an example env file; drawn dashed). Secret files (`.env`, keys, certificates, `tfvars`, state) are never read, environment values never enter the document, and only `HEAD` and refs are read from `.git` (to record the branch and commit). Scanning the same repository again produces the same IDs, so the import review shows what changed.

The same scanner runs from the command line for agents and CI:

```
npm run scan -- <repository folder> --out diagramcloud.json
```

It detects declarations, not runtime behaviour: calls, traffic and resources declared outside the repository are not seen, and other languages' imports are not read.

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
| AtlasNote cheatsheet | Every public view (≤ 64 pages) as a 1200 × 1600 page in AtlasNote's validated cheatsheet format (`schemaVersion` 1.1): title, description, a graph diagram at the canvas positions, a component table (type, provider, drilldown target, presented realization) and a story page. Load it in AtlasNote → Cheatsheet source | ≤ 80 boxes and 240 connections per diagram and 10 table rows per page, with the remainder counted on the page; straight connections and generic shapes (AtlasNote draws its own); no evidence tables, sources or images |
| Technical manual (HTML / PDF) | Every public view in drilldown order: a cover with project ID and revision, snapshot, revision vector, generated time, audience, provenance, basis counts and omissions; then per view an editorial figure, component and connection tables (basis, confidence, what backs each component) and observed claims; evidence and sources appendices | Static, no script, no network, system fonts; prints to A4 with one section per page set; light and dark screens, narrow screens scroll tables in place |
| MosaicStudio concept (JSON) | Current public view as `datapass.concept-spec` 1.0.0: components on layers by role (stores, processing, services, apps, sources and people), domains per repository, flows (data / control / auth), planned components as `planned`, sources and evidence references, drilldowns as notes | MosaicStudio draws it; IDs are kept where the contract allows (others are rewritten and listed); merged connections, shortened labels and dropped confidence marks are reported |
| Blueprint drawing (SVG) | Current view as an engineering drawing: grid, zone references (A1, B2…), high-contrast linework, typed line patterns, a legend of what is drawn, and a title block with project, project ID and revision, view ID, perspective, revision vector, date, provenance and notes | Static; system fonts; an original DataPass Blueprint grammar, no third-party artwork |
| Editorial figure (SVG) | Current view as a publication figure: numbered callouts and a key with type, basis and confidence | Static; inspired by diagram-design's visual grammar only |
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
- The repository scanner is deterministic and declaration-based: no call graph, no runtime traffic, imports only for TypeScript/JavaScript and Python, Terraform parsed by pattern (no HCL evaluation), no git history or diff between commits other than the stable-ID review of a rescan.
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
