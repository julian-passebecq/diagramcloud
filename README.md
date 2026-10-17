# DiagramCloud

**Architecture → the work behind it → the evidence.**

DiagramCloud is a local-first, static web studio for explaining a project: select a component and its child architecture opens underneath while the parent stays visible, continue into a task workspace, and read the evidence (code, tables, metrics, images, sources) behind it. The same document produces a public portfolio, a guided walkthrough and native exports. It is the DataPass/Galaxy product for architecture explanation, realization evidence and publication.

**For AI agents:** start with [docs/AI_GUIDE.md](docs/AI_GUIDE.md) (also indexed by [llms.txt](llms.txt)): commands, the formats an agent writes, choosing a figure, and what never to do.

## Current state (read this first)

The selected DiagramCloud V2 continuation covers the complete architectural Studio, independently of T3. Its [eight-workstream acceptance status](docs/product/V2_WORKSTREAM_STATUS.md) preserves the original r3/r4 criteria and distinguishes implemented behavior, dated qualification and open work. The local Mosaic raccord is one integration checkpoint, not completion of the other V2 workstreams.

The local React source entry at `src/react/index.ts` reuses the same canvas as a public, read-only viewer with controlled selection and bounded callbacks. It starts no Studio workspace or storage and grants no file access or editing. Its [local qualification](V2-REACT-VIEWER.md) covers an independently built consumer, two-instance isolation and the complete Chromium regression suite on the recorded source. Package publication, installed hosts and the complete SDK acceptance remain open. The browser tests keep the independent SDK consumer separate from the Studio. The browser suite also uses a separate internal Canvas QA server; it remains distinct from independent SDK consumer proof. See the [viewer contract](docs/contracts/react-viewer.md).

The [Catalogue + Studio checkpoint](V2-GENERAL-NEXT.md) qualifies C4 context, modular-monolith and event-driven guidance plus explicit browser-local saving of panel placement and requested widths. Its recorded source passed TypeScript/build, 782 of 783 unit cases (one optional skip) and all 151 Chromium cases; three synthetic captures were inspected. Catalogue applicability stays unknown, and panel preferences never become architectural facts. See [pattern guidance](docs/contracts/pattern-guidance.md) and [Studio layout](docs/contracts/studio-layout.md).

The [General Product checkpoint](V2-GENERAL-PRODUCT.md) qualifies the complete paged **Relationships** table, static catalogue display filters, explicit rejection of Galaxy maps beyond the existing 40-app limit, and JSON/recovery exports that do not wait for unused icons. Its recorded source passed TypeScript/build, 795 of 796 unit cases (one optional skip) and all 157 Chromium cases; five fresh synthetic PNGs were inspected and its local review archive was integrity-verified. Earlier failures remain recorded. These changes preserve the existing model, matcher, storage and export renderers. See [relation tables](docs/contracts/navigation-relations.md), [Galaxy admission](docs/contracts/galaxy-manifest-identity.md) and [export recovery](docs/contracts/export-recovery.md).

The [Studio / Galaxy checkpoint](V2-STUDIO-IDENTITY.md) qualifies session Back/Forward for the visible sheet and connection selection with live permitted-path checks, plus explicit private provenance capture for a new Galaxy import. Its recorded source passed TypeScript/build, 806 of 807 unit cases (one optional skip) and all 165 Chromium cases; four synthetic captures were inspected and its local archive was integrity-verified. Capture preserves exact decoded source text, without ID reuse or a namespace grant; session return does not add persisted bookmarks. Existing short-edge label/hit-area limitations remain open.

The [Catalogue families / View authoring checkpoint](V2-CATALOGUE-FAMILY.md), source `46e898f6bc7798afc389abf075a010e359cf3f50a5085f1cdb690cc25fb56538`, qualifies sourced editorial-family browsing and direct title/description editing of existing canonical views. TypeScript/build passed, 811 of812 unit cases passed with one optional skip, and all173 Chromium cases passed. Five fresh synthetic PNGs were inspected; the local review archive was integrity-verified. View edits retain stable IDs, use explicit Apply/Cancel and existing Undo/save, and reject stale contexts. Full heading/description/breadcrumb text wraps without truncation. Broader saved semantic contexts, mobile fit/readability and catalogue applicability remain open.

The [Migration guidance / Native labels checkpoint](V2-MIGRATION-EDGE.md), source `b0661f936503cd0dc8e76b225bfe91d55019bef537b502f9729f25936e46602a`, qualifies conditional guidance for the existing Migration pattern and native pointer/keyboard selection of visible placed connection labels. TypeScript/build passed, 815 of 816 unit cases passed with 1 optional skip, and all 177 Chromium cases passed. The local review archive was integrity-verified. The original native mouse behavior is retained; Enter/Space activation and focus survive callback changes. Runtime card measurements are never persisted as architecture. Family applicability, short/parallel hit bands, larger touch targets and broad mobile fit/readability remain open.

The [Sources / Local publications checkpoint](V2-PUBLICATION-DIAGNOSTICS.md), source `2a8c9af1999bfeda6b241fc3bd12b00cad02c9dbdf6e9655ccf1768dd0d0f427`, qualifies author-only absent/unreadable source-context diagnostics and reviewed local restoration of narrow native immutable public publication snapshots. TypeScript/build passed, 825 of 826 unit cases passed with 1 optional skip, and all 183 Chromium cases passed. Four fresh synthetic PNGs were inspected and the local review archive was integrity-verified. Public source-summary output reveals no private receipt presence. Restore retains identity, refuses collisions and unsupported assets/workspaces/observations, and leaves the editable Project intact. Remote publication and original source-vector recovery remain open.

The [Studio membership / Perspective choice checkpoint](V2-STUDIO-MEMBERSHIP.md), source `d210f534ea7de8b3e1e3d65715fb24457dc9b76731ad3060ac66231589eb3002`, qualifies explicit reuse of an existing canonical component in another existing view and explicit choice among supplied reachable perspective views. TypeScript/build passed, 831 of 832 unit cases passed with 1 optional skip, and all 187 Chromium cases passed. Four fresh synthetic PNGs were inspected and its local review archive was integrity-verified. Reuse changes only one view membership and position, retains shared IDs and facts, and uses live Edit guards, Cancel and ordinary Undo/save. Perspective choice preserves permitted paths and public privacy. The separate chooser capture at390px uses a1100px-high viewport; full390x844 fit and durable semantic contexts remain open.

The [Explore connection checkpoint](V2-EXPLORE-CONNECTION.md), source `ba967c4de023488ff7001a9745705c2196d1b34a9c933c35d80cbea0b498b0d0`, qualifies read-only inspection of an exact current permitted connection using the existing Inspector and Relationships facts. Its archived 2026-10-15 source passed TypeScript/build, 835 of 836 unit cases with 1 optional skip, and all 191 Chromium cases. 4 fresh synthetic PNGs were inspected by root and the local review archive was integrity-verified (SHA256 `93a0ccaa8cdaf61edafb051a4a2f17d57d47e3262a090f4334295b775a5557d3`). Quantity zero, supplied provenance/basis and endpoint citations remain distinct from runtime proof; source-opening and authoring actions are absent from the read-only summary. The compact Inspector retains its380px scrollport: separate390px group captures used1800px-high viewports and establish no complete390x844 or whole-phone fit. Broader hitbox/readability, durable semantic contexts and source-vector recovery remain OPEN.

The [General authoring checkpoint](V2-GENERAL-AUTHORING.md), source `e84f5898db6c78c132f4a6039f7f74089114e25ffcbf0bbc457ec8c006f09810`, qualifies reviewed removal of a single view membership, explanations of the unchanged catalogue matcher inputs, and paging of retained typed diagnostics. TypeScript/build passed, 852 of 853 unit cases passed with 1 optional skip, and all 203 Chromium cases passed on that dated source. Root inspected 7 fresh synthetic PNGs and the local archive was integrity-verified (SHA256 `1d922186e88225eb5303cfaeaa53291a5b884d53c440c9819d87011d3fb58263`). Canonical facts remain intact on removal, evidence questions remain unestablished, and retained rows stay distinct from producer omissions. These bounded results do not qualify later source.

The bounded Library / Graph checkpoint is [Library / Graph](V2-LIBRARY-GRAPH.md), selected source `f588aa5506579c4c4d771c43cfcd17b4d3cc09926e3f538284684fa8989c8643`: TypeScript/build passed, 862/863 unit cases passed with 1 optional skip, and 210/210 full Chromium cases passed without retry or skip. Its verified local review archive has SHA256 `bc3344d7d59f52163db4e2b335899f0cd26693e3d9c67500d55bf3dd3f4012d5`. Root inspected 10 exact synthetic PNGs; documented horizontal scroll and tall-group limits remain. Existing-view opening/copying uses current canonical identities and guarded parent paths, without mutation or a new store. Complete retained assertion paging shows source-declared categories and UNKNOWN omissions; it creates no reviewed observations. This is dated local evidence only: original98references/152rows are preserved, all eight workstreams remain PARTIAL, and full semantic contexts, installed hosts, usage/counter semantics, W1 source-vector recovery and external adoption remain OPEN.

The next applied Manual quantity slice retains stable connection IDs, explicit zero, absent quantities, exact units, canonical provenance and optional notes in compact/dense/keyed public connection tables. It reuses the existing technical manual, public view spec and publication planner; no quantity or measured result is invented. Five reviewed existing targets are APPLIED_PENDING_QUALIFICATION. TypeScript, affected and full browser, source-bound A4/Letter PDF extraction/rendering/all-page visual review and local archive integrity remain separate. All eight V2 workstreams remain PARTIAL; original v2:interop-assets is not complete.

| | |
|---|---|
| Repository | `julian-passebecq/diagramcloud`, branch `main` (the only maintained line) |
| Product version | **1.28.0** (`package.json`; shown in the header) |
| Document schema | `schemaVersion: 1` (`src/core/model.ts`; additive changes only since V1) |
| Galaxy maturity | **G0**, standalone (`public/galaxy/version-handshake.json`); contract support does not promote it |
| Release verification | [docs/RELEASE.md](docs/RELEASE.md): commands, the `galaxy.verification-receipt/1` receipt and the release record |
| Browser target | Chrome / Chromium (the only browser the test suite qualifies) |
| Hosting | Any static host; production is the Vercel project connected to `main` ([docs/VERCEL.md](docs/VERCEL.md)) |

**What it is:** React + TypeScript + Fluent UI + React Flow, Vite build, IndexedDB storage, no server, no account, no database. Optional integrations (Google Drive asset vault, DataPass repository folder bridge) stay optional.

**What it is not:** a cloud runtime, an IDE, a notebook kernel, a SQL/Python/DAX/Spark engine, a Git or task authority, a MongoDB UI, live infrastructure monitoring, or a replacement for DataPass VS Code, Studio or Galaxy. Code and rows are displayed, never executed.

## Learning milestone (1.26.0)

1.26.0 adds the learning catalogue (typed lessons with depths, alternatives, interview questions and labelled synthetic examples), optional choices, the Edit-mode JSON drawer, reviewed concept-to-instance mappings with a return path, and three adoption journeys. It is a bounded milestone, not a complete V2. See the [release notes](docs/release-1.26/RELEASE_NOTES.md) and the [R4 crosswalk](docs/product/R4_CROSSWALK.md), which maps every R4 and inherited acceptance row to its test or its gap.

## Project Intelligence (1.24.0)

DiagramCloud 1.25.0 integrates the full-product campaign (`codex/full-product-campaign-20261009`, PR #58, stacked on PR #57). It extends source-backed analysis, grouped GraphSnapshot exploration, reviewed environment/release declarations, semantic evolution, independent collections, immutable curated publications, and optional selected-file CLI/MCP. It keeps Project schema 1 and all existing authoring, workspace, story and export paths. Integration does not imply owner verification. See [interfaces and limits](docs/product/CAMPAIGN_CLIENT.md), [qualification report](SHIP-REPORT.md), [original acceptance outcomes](outcome.json) and the [sole roadmap](docs/ROADMAP.md).

**New analysis** offers Repository (automatic static analysis), Guided, Hybrid and selected GraphSnapshot. Source, purpose and Quick/Standard acquisition settings remain for the session. Deep/Custom are explicit optional analysis profiles with budgets, a cancellable local Tree-sitter worker and selected-result review; repository code is never executed. Business overview includes recipes, source evidence, How It Works, verification, evolution, delivery and publication tools. **Navigate** keeps logical scope, repository hierarchy and views separate, with environment/snapshot filters and source-cited crosswalks. **Details panel** synchronizes Details / Evidence / Gaps / Alternatives / Assets with the selected component or view. Advanced tools remain collapsed.

A selected unknown/docs-only folder returns a bounded inventory and exact Markdown/CSV provenance links, with honest missing-relationship and unsupported states. Guided ProjectBrief tasks reuse evidence workspaces. Hybrid uses the existing Atlas and individual rescans; unavailable members remain declared and each repository keeps its own revision. Acquired files and reports are private until author publication review. Business overview exports semantic public HTML offline; asset plans use the icon registry and generic fallbacks. No model, Git setup, server, token or cloud service is needed.

Quick: 200 files / 64 KiB each / 4 MiB total. Standard: 1,500 / 256 KiB / 16 MiB; Markdown/CSV keep tighter limits. Content digest, readable HEAD hint and unknown dirty state remain separate. Reimport preserves existing authored text and positions; it adds stable IDs instead of deleting unmatched work. Browser folder-name identity is bounded: use explicit Hybrid IDs for similarly named independent roots. See [release notes and limits](docs/release-1.24/RELEASE_NOTES.md).

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

**Diagram Design** (canvas toolbar) draws the current public view as an editorial figure in the visual grammar of [diagram-design](https://github.com/cathrynlavery/diagram-design) (MIT; see THIRD_PARTY_NOTICES.md): semantic colour roles, rectangular type tags, rounded right-angle connectors with masked uppercase labels, fanned attach points, zones per repository, a legend strip and accessible SVG. The facts stay DiagramCloud's (scans, atlas, basis, revision vector, public redaction); only the drawing changes. 20 figures:

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
| System context | the view as one boundary; components with nothing coming in on the left, nothing going out on the right (direction only, no invented actors) | what enters and leaves |
| Status board | components in columns by their designed status; says it is not an observation | what is designed in which state |
| Lineage | left-to-right flow around one component: everything upstream and downstream of it, the rest muted | where this comes from and goes |
| Radial reach | rings of components 1, 2 and 3 connection steps from one component | what a change here can reach |
| Atlas revisions | one card per repository of an atlas (`npm run atlas`): short revision, ref, authority, scan state; Δ old → new, + added, − removed since the previous snapshot; declared relationships dashed; no single project revision | which repositories moved |
| Sankey | bands between components, thickness proportional to each connection's stated quantity (one unit per figure, other units listed), provenance printed; synthetic bands dashed | how much moves where |

Themes: light, dark and editorial (adds drilldown path, revision vector and provenance cards). One or two **focal** components get the accent; without a hint, the single clearly most-connected component does, and the legend says so. In Edit, **Use for this view** stores the figure and theme on the view (`view.design`), so the **Diagram Design figure (SVG)** export and other people get the same figure. Figures are static, offline SVG with no script, built from `publicDocument`.

**Suggested figures.** Under the figure controls, Diagram Design suggests three figures for the current view, ranked from its public facts, each with its reason ("a numeric table on Input rows", "6 child views below this one", "DiagramCloud has 3 connections"); one click shows it. Table figures are never suggested without a numeric table. `npm run design` also writes `suggestions.json` (`diagramcloud.design-suggestions/1`, top five per view) for an agent writing a design brief. A view without a hint still opens as Architecture.

**Auto layout.** In Edit mode, **Auto layout** (next to Grid layout) arranges the view left to right from its connections: columns by reading order, rows ordered to reduce crossings, groups kept together. It is one undoable edit and does nothing new when clicked twice. A flow longer than 6 columns wraps into bands that all read left to right, kept only when the wrap adds no crossing.

**Routed connections.** The canvas draws every connection along the same box-avoiding, right-angle route as the exports (rounded corners); while a card is dragged its connections use a simple path and snap back to the route on drop. On the real 14-repository Galaxy atlas it cuts the crossings of the authored layout from 32 to 2.

**Connection quantities.** In Edit mode the connection editor takes an optional quantity: value, unit, where it comes from (author estimate, synthetic, derived from a source, reference) and a note. It is stored on the connection (`quantity`), kept by public exports and draw.io, never inferred by an importer, and drawn by the Sankey figure, which prints the provenance and never adds different units.

**PDF.** `npm run design -- doc.json --out dir --pdf` also writes `book.pdf` (one figure per page) and one figure-sized PDF per view, rendered offline by Playwright's Chromium (any network request aborts the run).

**Diagram Design deck.** **Diagram Design deck (PowerPoint)** (Export & share) builds a cover and one slide per public view in drilldown order, each the view's chosen figure as a picture (PNG rasterised in the browser) with the figure's title and description as alt text and a caption naming the figure type and view; dark figures get a dark slide. Pictures, not editable shapes: **Editable PowerPoint** stays the native-shape export.

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

The gallery filters to **Portfolio**, **Cloud architectures** (every reference above), **Reference recipes**, **Adoption journeys** (the last three rows: open them with no project, Git or AI; the Details panel's Gaps tab says *what is missing to explain this?* when timing, quantities or concept mappings are absent, instead of drawing a misleading figure) and **Your projects** (blank, imported and your own).
| AWS serverless web application | CDN, API, functions, table; request path with idempotency | Independently authored reference citing AWS documentation |
| Azure web app with private data | Front Door, App Service, Key Vault, private SQL; private networking path | Independently authored reference citing the Azure Architecture Center |
| Google Cloud streaming analytics | Pub/Sub, Dataflow, BigQuery, dead-letter; windowing detail | Independently authored reference citing Google Cloud documentation |
| Microservices on Kubernetes | Ingress, services, config, autoscaling detail | Independently authored reference citing Kubernetes documentation |
| Event-driven orders with an outbox | Outbox relay, broker, idempotent consumers, dead-letter queue | Independently authored, cloud-agnostic pattern reference |
| Blank project | One component to start editing | Author-created |
| DiagramCloud describes itself | Author, validate, review, export; catalogue, lesson, mapping; two source-declared concept mappings | Read from this repository's own files, each component citing file:line; static source, never observed |
| Galaxy agent process | Session, worktree, pull request, CI, merge, handoff; procedure, attempt, lesson and live process kept apart | Partly cited from AGENTS.md and the CI workflow; the attempt and unsourced steps are synthetic |
| FOIL local and environments | Logical capability, local and cloud realization, DEV/TEST/PROD instances, bronze/silver/gold refinement | Synthetic; no private FOIL source read |

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
| MosaicStudio concept (JSON) | Current public view as `datapass.concept-spec` 1.0.0: components on layers by role (stores, processing, services, apps, sources and people), domains per repository, flows (data / control / auth), planned components as `planned`, sources and evidence references, drilldowns as notes | MosaicStudio draws it; typed source mappings explain ID rewrites, merges and omissions; confidence stays in labels/evidence, dependencies use a labelled control style, and incompatible parallel relations are reported as omitted |
| Blueprint drawing (SVG) | Current view as an engineering drawing: grid, zone references (A1, B2…), high-contrast linework, typed line patterns, a legend of what is drawn, and a title block with project, project ID and revision, view ID, perspective, revision vector, date, provenance and notes | Static; system fonts; an original DataPass Blueprint grammar, no third-party artwork |
| Editorial figure (SVG) | Current view as a publication figure: numbered callouts and a key with type, basis and confidence | Static; inspired by diagram-design's visual grammar only |
| Mermaid | Flowchart of the current view, realization as classes and comments | Lossy: no evidence, hierarchy or caveats |
| Print / PDF | Browser print of the expanded public views and selected evidence | Not an all-project pagination engine |
| Portfolio index | `diagramcloud.portfolio-index/1` for Mongoku's read-only view | Only reviewed, public, shareable observations; ≤ 25 items, ≤ 64 KiB |

All exports are built from `publicDocument`: private objects are removed, not hidden. Uploaded SVG is sanitized and rasterized; PNG/JPEG/WebP uploads are re-encoded. Details: [realization contract](docs/contracts/realization-overlay.md), [architecture](docs/ARCHITECTURE.md).

For a local Mosaic preview with a complete source mapping, use **Mosaic preview** in the Studio or run `npm run concept:preview -- document.json --view root --audience public --out new-preview`. The output directory must be new. A host that already has document access can explicitly select `--audience author` for a private preview of that view. The [isolated local host](docs/contracts/mosaic-local-host.md) loads an explicitly selected existing Mosaic viewer in layered, isometric or 3D mode; separate mapping buttons return a unique source. Native viewer picking and automatic context restoration remain owner integration limits. T3 is optional.

**Presentation profile** chooses Vanilla, Standard or Advanced tool placement for the current project and host. Vanilla keeps rendering controls under More tools; Advanced brings source/comparison shortcuts forward. All profiles retain sources, evidence, editing, exports and recovery. They do not change source selection, analysis depth, assistance, audience or permissions.

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
- Edit offers Grid layout (three per row in view order) and deterministic Auto layout computed from the view connections. Auto layout uses layered columns with bounded six-column bands and is not a general graph layout engine. Both change positions in one undoable edit. The canvas reuses the export scene router around its taller measured cards; dragged-card edges use a smooth step until drop, and canvas labels use the longest segment. Routing and label placement can therefore differ from exports.
- No live cloud discovery, no execution of SQL/DAX/Python/Spark, no real-time collaboration or server sync.
- Observations are one-time reviewed imports, not subscriptions; DiagramCloud never polls another app.
- The DataPass folder bridge needs the folder to be chosen again after a reload (the handle is not persisted).
- Vendor artwork: eight Microsoft Fabric item icons; Azure and Databricks use generic symbols.
- PPTX fidelity is a semantic reconstruction, not a pixel copy of arbitrary layouts.

## License and documents

Original source is MIT. Dependencies and Microsoft artwork keep their own terms: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No font files are bundled.

Read next: [AGENTS.md](AGENTS.md) (rules for AI and human contributors), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/RELEASE.md](docs/RELEASE.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/RESEARCH.md](docs/RESEARCH.md), [docs/GOOGLE_DRIVE.md](docs/GOOGLE_DRIVE.md). Documents under `docs/pro-pass/` and `docs/ARTIFACT_PLATFORM.md` are historical working notes.
