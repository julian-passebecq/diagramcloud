# Roadmap

Current state and verification live in [README.md](../README.md) and [RELEASE.md](RELEASE.md). This page lists what 1.0 contains, the honest post-V1 boundaries, and (below) the historical pass logs.

## Shipped in 1.15.0

- **Figure book** (every public view as its Diagram Design figure on one offline page; also `book.html` from `npm run design`) and the **Technical manual** printing each view's chosen figure. New figures: Deployment, Evidence matrix, Treemap, Hub, Heatmap, Line chart, built in parallel by a six-coder workflow, each from facts already in the model.

## Shipped in 1.14.0

- **Architecture delta** (diagram-design `type-architecture-delta`): two versions of one project, one view, Before · Changes · After with a change ledger; added / removed / changed / moved / rewired by stable ID with non-colour encodings (badges, dash patterns), `data-snapshot` / `data-object-id` / `data-status` metadata. In the app (Compare with another version…, nothing imported) and the CLI (`--delta`). Pairs naturally with rescans and Lens: a rescan's review shows the change list, the delta shows it as a figure.

## Shipped in 1.13.0

- **Diagram Design figures, second set:** Swimlane (repositories or layers as lanes, columns in reading order, on the shared routes), Sequence (participants and numbered messages from the view's connections; labelled reading order, not timing), Story timeline (guided story steps; private steps counted) and Chart (bars from a table evidence block, provenance printed on the figure). Still candidates: architecture delta (two atlas snapshots), dependency graph styling for scans, line and heatmap charts, sankey and loop (need edge quantities and a cycle layout).

## Shipped in 1.12.0

- **Diagram Design mode** (Idées de Julian, 2026-10-07): the visual grammar of cathrynlavery/diagram-design (MIT, `d137637`) as a mode of DiagramCloud rather than a new project: Architecture, Layer stack, Exploded stack (3D) and Drilldown tree, light / dark / editorial, focal components, `view.design` hints, the Diagram Design figure export, `npm run design`, and the `diagramcloud.design-brief/1` bridge so an AI agent picks figures and focal components after scanning (`skills/diagramcloud-design/SKILL.md`). Next candidates from diagram-design's 44 types, each from facts already in the model: architecture delta (two atlas snapshots), swimlane / data flow (repositories as lanes), sequence (story steps), timeline (snapshots), dependency graph (scan), medallion (data perspective), and charts from table evidence blocks (bar, line, heatmap, treemap). Sankey and loop need edge quantities and a cycle layout first.

## Idées de Julian (2026-10-07)

- **diagram-design + DiagramCloud = "a true beast"**: integrate as much of diagram-design as possible. Decision (Julian, 2026-10-07): a Diagram Design **mode inside DiagramCloud**, not a new project and not a rebuild, so the scanner, Git lineage, atlas, Lens, redaction and exports keep working. Shipped in 1.12.0; more figure types per release.
- **AI bridge**: an AI writes tips (a design brief) so DiagramCloud can graph every project. Shipped in 1.12.0 as `diagramcloud.design-brief/1` plus the repository skill.

## Shipped in 1.11.0

- **Lens Git projections** (Project Atlas brief §8): `datapass.lens.minimap/1` (tern-vscode `minimapProjection`, branch `feat/tern-v01` @ `15a425b`, not yet on main) read into a new reviewed snapshot as observed runtime pointers; scans go stale against Lens heads; unknown revisions filled with authority `lens`; credential-bearing links dropped; unmatched repositories reported. Not done, on purpose: a commit graph, churn or "lines changed" views (Lens leaves them out; lines changed are not productivity). **Brain project context**: no Brain format exists on disk (survey 2026-10-07); `contextRefs` stays the slot, DiagramCloud works without it.

## Shipped in 1.10.0

- **Technical Manual preset** (Project Atlas brief §13): one static HTML manual from publicDocument and the ViewSpec, printable to PDF; cover with snapshot, revision vector, generated time, audience, provenance, basis counts and omissions. PPTX and AtlasNote keep their own exports. Next: Lens Git projections (`datapass.lens.minimap/1`, still on an unmerged tern-vscode branch) and the Brain project-context contract (no Brain format exists yet).

## Shipped in 1.9.0

- **MosaicStudio adapter** (Project Atlas brief §7): a view as `datapass.concept-spec/1` built from the public ViewSpec, with a loss report and an ID map; checked in unit and browser tests with the owner's validator (vendored from datapass-mosaicstudio `8b22d9c`), and cross-app with MosaicStudio's standalone viewer (`scripts/qualify-concept.ts`, record in docs/RELEASE.md). Next: Lens Git projections, Brain project context, Technical Manual preset.

## Shipped in 1.8.0

- **Galaxy and Contoso atlases** (Project Atlas brief §11, §12): `galaxy.json` read as a project manifest (members from apps, relationships from connections, live = static source, branch/planned = planned, self-reads and unknown apps reported); the real Galaxy atlas is generated locally (private repository names, not committed). Contoso Forecasting reference atlas from `contoso-data-studio` at `61353848b4e7`: lab as built vs Fabric target, data zones separate from environment. Repository `visibility` for cardless repositories in public output. draw.io import merges a component a DiagramCloud export repeats on several pages (same ID) instead of duplicating it.

## Shipped in 1.7.0

- **Blueprint mode** (Project Atlas brief §4, §5, §6): Blueprint and Editorial SVG renderers built from the ViewSpec plus the shared export scene (the standard SVG export is unchanged), with a title block carrying the revision vector and provenance; a canvas Blueprint toggle (remembered per browser). SeeCode was rejected as a renderer (CDN fonts/encoders, no ID preservation); diagram-design is used as visual grammar only (`docs/research/seecode-diagram-design.md`).

## Shipped in 1.6.0

- **Perspectives and ViewSpec** (Project Atlas brief §2, §3, §5): `perspectivesFor` (available / partial / unknown / unsupported), a Perspectives strip in the inspector, Back / Forward, perspective and repository revision in each view heading, a basis filter, `pathTo`, and `diagramcloud.viewspec/1` (`viewSpec`, export option). Repository scans add a CI/CD view (opened from the CI card) so a system appears in two perspectives with one ID.

## Shipped in 1.5.0

- **Project atlas, multi-repository snapshots** (Project Atlas brief §1): `diagramcloud.project-manifest/1` and DataPass `.datapass/project.json` as explicit membership; a document `atlas` field with up to 20 snapshots, each a revision vector (host, locator, revision, ref, scan status, authority per repository) plus runtime/context pointers for other apps; per-repository scans embedded under an ID prefix with a shared budget; rescan one repository, add a repository, compare snapshots, stale/missing detection; `npm run atlas`; `basis` (planned / static-source / unknown) on nodes and edges; `perspective` on views. Next: ViewSpec and perspective switcher, Blueprint mode, Galaxy and Contoso atlases, Lens/Brain/Studio contracts, Technical Manual.

## Shipped in 1.4.0

- **AtlasNote cheatsheet export** (Idées de Julian, 2026-10-06): Export & share → AtlasNote cheatsheet writes `urn:atlasnote:cheatsheet:1.1` JSON (schema version 1.1, "architecture" preset): one page per public view in drilldown order with the diagram at its canvas positions, a component table and a story page. Tested against AtlasNote's own validator (vendored from AtlasNote `d162b31`) and checked visually with AtlasNote's renderer. Works for repository scans too, so AtlasNote can show a scanned repository. Next: list DiagramCloud as a producer of the cheatsheet format in `galaxy.json` (Claude Control owns that file).

## Shipped in 1.3.0

- **Repository scanner:** a local Git folder (browser folder picker, read in the browser) or `npm run scan` becomes System context → Containers → Components → Files, plus Data lineage and Infrastructure views, from manifests, Dockerfiles, docker-compose, Kubernetes, Terraform, GitHub Actions, SQL/dbt/Prisma and TypeScript/JavaScript/Python imports. Evidence (file, line, finding) and confidence (confirmed / inferred / possible) on everything; secret files never read; stable IDs so a rescan is reviewed as a diff. Informed by the 2026-10 gap analysis (Groma.md, Tecture, Compass, CodeFlow).

## Idées de Julian (2026-10-06)

- **AtlasNote visualisation (shipped in 1.4.0):** export a DiagramCloud view or a repository scan as an AtlasNote cheatsheet (the "Architecture" starter on its native SVG grammar, `urn:atlasnote:cheatsheet:1.1`) so AtlasNote can show what DiagramCloud generates; check `galaxy.json` before adding a cross-app format.
- **Content database:** a Git repository of DiagramCloud documents (`diagramcloud.json` per project, already the sidecar format) that other apps read from outside; the CLI scanner can refresh it in CI.
- **Repository → many formats:** a scan already exports to draw.io, Mermaid, SVG, PowerPoint and HTML; next candidates are D2, PlantUML, Structurizr and LikeC4 (gap analysis ranks 2, 4, 8).

## Shipped in 1.2.0

- **Visio import:** `.vsdx` / `.vsdm` / `.vstx` packages read in the browser (a small ZIP reader over `DecompressionStream`): pages, shape text or master names, glued and dropped connectors, containers, frames and captions, with a loss report. Checked during development against 12 public `.vsdx` files (the BSD-licensed `dave-howard/vsdx` test drawings and the Azure Architecture Center AKS baseline drawing), none committed. Binary `.vsd` and `.vdx` are refused with a message.
- **draw.io export:** every public view as an editable draw.io page with the shared orthogonal routes pinned, drilldowns as page links, and DiagramCloud IDs/types/providers as shape data; re-import is round-trip tested for every sample and rendered in diagrams.net.
- **Research:** `docs/research/2026-10-gap-analysis.md` (user needs, interchange formats, repo-to-architecture generators) feeds the ranked candidates below.

## Shipped in 1.1.0

- **Interchange import:** draw.io / diagrams.net (`.drawio`, `.xml`, compressed pages, editable `.drawio.svg` / `.drawio.png`, multi-page, containers and frames, C4 placeholders, AWS/Azure/GCP stencil names, unsnapped connectors, junction dots) and Mermaid (`flowchart`/`graph`, `architecture-beta`), each with a kept / not-imported report, into a new reviewed project. Checked against 19 public draw.io examples from jgraph/drawio-diagrams (AWS, Azure, IBM, C4, network, data-flow) during development.
- **Cloud architecture gallery:** AWS serverless, Azure web app with private data, Google Cloud streaming, Kubernetes microservices and an event-driven outbox reference, each with a drilldown, cited official guidance, synthetic-labelled code and rows and a two-step story; gallery filters (Portfolio, Cloud architectures, Your projects) and a "What's new" card.

## Shipped in 1.0.0

- **Core:** canonical `Project` JSON (schema 1) with stable IDs, parent-retaining multi-level drilldown, task workspaces with reusable evidence items, sources and provenance labels, guided stories with a visual composer, public/private projection.
- **Authoring without raw JSON:** components, connections, child views, workspace links, project metadata and sources, text/code/image/metrics/**table** editors, block ordering, **transformation explainer** (input → logic → output, mapping, grain/keys/quality rules), board editing (multi-select, align, distribute, stack), data-model and KPI source editors, undo/redo.
- **Realization:** designed / observed / presented kept apart; observations enter only through a reviewed, revision-guarded patch or a staged Galaxy publication snapshot; review, visibility and sharing are author decisions; reviewed public observations survive HTML, SVG, PNG, PPTX, the project deck, Mermaid (lossy) and the portfolio index.
- **Galaxy grammar:** `galaxy.entity/1`, `galaxy.evidence-ref/1`, `galaxy.version-handshake/1`, `galaxy.publication-snapshot/1` (produce, and consume through review in the UI), `galaxy.deep-link/1`, `galaxy.verification-receipt/1`; Galaxy maturity G0.
- **Inspector grammar:** Identity, Meaning, Realization, Evidence, Work, Publication for every component.
- **Exports:** authoring/public JSON, standalone HTML, SVG, PNG, native editable PPTX, project and scope decks, Mermaid, browser print/PDF, portfolio index; one measured export scene with orthogonal, box-avoiding routes on the shipped samples.
- **Reliability:** latest-snapshot save queue, corrupt-row quarantine and recovery screen, multi-tab conflict detection, quota/open failure messages, leave-page guard, stale whole-document and patch imports refused.
- **Visuals:** icon registry with source, commit, package version, git blob and terms; eight Microsoft Fabric item icons; generic original symbols elsewhere.
- **Integrations (optional):** Google Drive asset vault (`drive.file`), DataPass repository folder bridge (`.datapass/diagramcloud.json`, review before apply, revision/hash conflict guard, download fallback).

## Post-V1 candidates

| Candidate | Why it is not in 1.0 |
|---|---|
| Persist the DataPass folder handle in IndexedDB with a permission re-prompt | Convenience; reopening the folder or JSON import already works |
| Azure and Databricks vendor artwork | Needs per-icon terms review (Azure ships a separate download; Databricks publishes no icon terms) |
| Firefox / Safari qualification | 1.0 qualifies Chromium only |
| Canvas routing shared with the export scene | The interactive canvas still routes edges with React Flow |
| Repository scanner next steps: diff between two commits, more languages (Go, Java, C#), call graph, Helm and Bicep, OpenAPI routes | 1.3 ships the declaration-based scanner |
| Structurizr DSL import; D2, PlantUML, Lucid CSV/.lucid, Excalidraw, LikeC4 and mingrammer `diagrams` exports | draw.io, Mermaid and Visio import and draw.io export shipped; the others are not started |
| Graph auto-layout (layered, ELK-style) | The layout button is still a grid |
| Architecture diff between two documents or scans (stable-ID overlay) | Not started |
| Read-only metadata adapters (dbt manifest, SQL DDL, Databricks Jobs, Fabric items) | Explicit V1 non-goal; would mark observed vs authored relationships |
| Graph auto-layout (ELK or similar) preserving user overrides | Licensing and UX evaluation pending |
| Portfolio composition layouts (executive / technical / interview) | Current deck and story cover the release |
| Map/geo item for site-assessment screens | Needs a licensed basemap |
| VS Code webview hosting of DiagramCloud | DataPass-side work; out of scope for this repository |

## Not implemented, by design (V1 non-goals)

No binary .vsd or Lucidchart native import; no lossless Mermaid round trip (imports are adapters with a loss report); no arbitrary SVG → editable graph; no universal graph auto-layout; no live Azure/Fabric/Databricks discovery or infrastructure control; no SQL/DAX/Python/Spark execution; no real-time collaboration or server sync; no complete arbitrary-layout PPTX fidelity; no exhaustive cloud icon pack; no GIS engine; no Electron/desktop distribution; no automatic confidentiality approval.

## Sample scope

The supplied PDFs are a starting portfolio source, not immutable production documentation. Source-derived narratives stay distinct from synthetic rows, snippets and illustrative financial scenarios. Do not present numerical illustrations as real achievements. Further CV projects need source confirmation first.

---

# History (pass logs, kept for context)

The sections below record earlier passes as they were written. Branch names refer to branches that have since been merged into `main`; limitations listed there may since have been solved (see "Shipped in 1.0.0" above).

## V1.1 reliability pass (2026-09-21)

Implemented in `feat/diagramcloud-v1.1-reliability`:

- **Latest-snapshot save queue.** IndexedDB writes remain serialized, but an older write can no longer flash `Saved locally` while a newer edit is still queued. Terminal save/error state belongs only to the newest queued generation.
- **Rapid-edit history hardening.** Edit/undo/redo operations read and update a synchronous history ref before React rerenders, preventing back-to-back edits from being derived from a stale render snapshot.
- **Recoverable workspace loading.** A malformed IndexedDB row is reported and left untouched while healthy projects still load. A stored key/document-ID mismatch is also isolated rather than silently accepted.
- **Blocked-database recovery.** A blocked IndexedDB open no longer leaves a stale connection promise or later leaked handle.
- **Whole-document AI/JSON review guard.** Same-project imports show stable-ID additions/changes/removals and project-field changes. They may only apply when the imported base revision equals the currently open revision. This is a review guard for whole-document edits, **not yet JSON Patch**.
- **Shared export geometry.** SVG and editable PowerPoint now share node dimensions and deterministic orthogonal Manhattan connector routing. React Flow canvas geometry is still an independent interactive renderer and remains future convergence work.
- **Mermaid hardening.** Pipe characters in labels are escaped so authored labels cannot accidentally change Mermaid edge-label syntax.
- **Regression coverage.** Added save-queue, change-preview, shared-routing, corrupt-row and stale-revision tests. `package-lock.json` is checked in and CI installs with `npm ci` using `actions/setup-node` npm caching, so every run validates the same resolved dependency tree.

Save/recovery fault injection is done (2026-09-25): real-IndexedDB browser tests for a two-tab conflict, storage that cannot open, and a quota failure mid-session, with a leave-page guard while work is unsaved. See `tests/e2e/storage.spec.ts`.

Revision-guarded JSON Patch is done (2026-09-25; see below).

Shared measured export scene is done (2026-09-25): SVG, PNG, HTML and PPTX draw one Arial-measured scene with identical line breaks, detour routes around boxes in the way and embedded registered icons. The canvas keeps its own React Flow rendering. Since the channel fallback (2026-09-25) no sample route passes through a box; this is a unit-tested property of the samples, not a guarantee for every layout.

The recovery screen for quarantined rows is done (2026-09-25): download raw, repair in the JSON editor, or delete after confirmation. With that, no P0 item from this list is open.


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

Distribute and stack are done.

The KPI count-source form is done.

Project deck box → task-screen slide links (and links back) are done.

Save/recovery tests are done, with a leave-page guard and plain-language storage errors.

The AI change preview is done: item-by-item before → after, with cautions (below).

Revision-guarded JSON Patch is done: small AI edits as RFC 6902 operations, addressed by stable ID and refused when stale.

The visual story composer is done (Edit → Story): add, reorder, edit and preview guided-story steps without JSON.

The shared export scene is done: one measured layout for SVG/PNG/HTML/PPTX (see ARCHITECTURE.md, "Shared export scene").

Lane separation is done: connections never draw on the same stretch, and connection labels never cover a box or each other.

The icon registry is done (`src/core/icons.ts`): each icon records its origin; vendor icons also record source, commit, package version, git blob and terms, and the build checks them. It holds two vendor icons so far: Fabric Lakehouse, and Fabric Pipeline on the Fabric sample's "Data Factory pipeline" box (added with Julian's approval). Adding more Fabric/Azure/Databricks artwork is a separate, per-icon decision: each needs its terms checked first.

Next candidates: a map/geo item for the site-assessment slide (p.16) if a licensed basemap is chosen.

## Realization overlay pass (2026-09-25)

Done: the observation contract (`src/core/model.ts`, `src/core/realization.ts`) with four claims
(observed/verified/partial/not-observed), a revision-guarded `diagramcloud.patch` producer
(`observationPatch()`) and **New observation patch** in the JSON / AI dialog; the private → reviewed →
public → shareable lifecycle with review controls in Edit mode (`src/ui/Realization.tsx`); refusal of
credential-like values, `.env`-looking text, credential links and synthetic-evidence backing
(`src/core/secrets.ts`); the `diagramcloud.portfolio-index/1` export (`src/export/portfolioIndex.ts`),
validated against a verbatim port of Mongoku's own projection consumer
(`tests/contracts/mongokuProjection.ts`, pinned to Mongoku-datapass commit `8e83981`); the
`?project=&view=&node=` deep-link format and **Copy deep link** (`src/core/links.ts`); a canvas realization
chip and status-dot tooltip, a Realization section, story citations of reviewed observations, and a
standalone-HTML "Observed by other apps" list. Details in
[docs/contracts/realization-overlay.md](contracts/realization-overlay.md).

Remaining limits:

- ~~PPTX, the project deck, SVG, PNG and Mermaid exports do not show observations yet.~~ Solved in 1.0.0: see
  "Realization in exports" in the realization contract.
- No live sync: an observation is a one-time reviewed patch, not a subscription to the source app.
- No automatic observation fetching; DiagramCloud never polls or connects to another app to pull facts.
- DiagramCloud is not a runtime, a password/secret store, a MongoDB client, or a task authority: it refuses
  credential-shaped content, has no Mongo driver, and never applies a `datapass.ai-plan` itself.
