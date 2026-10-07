# Architecture decision record

Current for DiagramCloud 1.16.0. The "V1.x" sections record when each decision was taken; they still hold unless a later section amends them.

Date: 2026-09-21. Status: implemented foundation, not a completed enterprise diagram editor.

## Product boundary

DiagramCloud is an interactive project explainer. Its root is an architecture graph, but a useful explanation also needs task decomposition, data contracts, code examples, screenshots, contribution notes, provenance and a narrative. It is not a cloud runtime or a notebook. Embedding it later in Datapass should reuse the core and viewer, not add a second execution platform.

## Canonical document, not canvas serialization

`src/core/model.ts` owns `Project` with schemaVersion 1. Nodes and edges are semantic entities with stable IDs. Views reference subsets of those entities and own their layout positions. A node can reference a child view. Evidence blocks are separate entities referenced by nodes. Source and asset registries prevent duplication of content and retain publication metadata. Story steps reference a view, an optional selected node and highlighted edges.

The same semantic node can appear in several views with different positions. A view is not a folder of duplicate nodes. Data-flow cycles are legal; recursive child-view expansion is not. The parent-to-child navigation graph is therefore validated separately from the data-flow graph.

`validateDocument` is mandatory at every import and committed edit. It performs Zod structural validation and relational checks: unique IDs, valid node/edge/view/block/source/asset references, edge endpoints inside each view, positions only for view members, table-row widths, story references and drilldown cycle rejection. `parseDocument` additionally enforces a 12 MiB serialized import limit. Unknown schema versions are rejected, not guessed or silently migrated.

The generated JSON Schema is useful for AI/editor autocomplete, but cannot replace relational validation. New schema versions require an explicit, tested migration function. Keep serialized data free of functions, executable expressions, React components and arbitrary HTML.

## Layers

| Layer | Files | Responsibility |
|---|---|---|
| Domain | `src/core/model.ts`, `operations.ts` | Validation, graph traversal, public projection, history |
| Persistence | `src/core/storage.ts` | IndexedDB transactions and other-tab conflict detection |
| Sample content | `src/data/samples.ts` | Independently authored reference and portfolio documents |
| Shell | `src/App.tsx`, `styles.css` | Modes, gallery, navigation path, editor and export workflow |
| Interactive renderer | `src/ui/Canvas.tsx` | React Flow node/edge mapping, pan/zoom, drag, connect, motion |
| Evidence | `src/ui/Evidence.tsx`, `Inspector.tsx` | Safe content rendering and property/block editing |
| Export adapters | `src/export/*` | Public HTML, SVG, PNG, PPTX and limited Mermaid |
| Build tools | `scripts/*` | JSON Schema, sample exports and attribution inventory |

Selection, zoom, current mode, modal visibility and the expanded navigation path are UI state. They are not the architecture itself. Layout positions are saved document data. Undo history is bounded to 25 prior snapshots and does not survive reload.

## Local storage and recovery

Each project is stored as one validated JSON record in IndexedDB. The stored row also contains a writer ID and monotonic saved timestamp. A read-and-compare occurs in the same read/write transaction as an update. A different tab with an unexpected generation aborts the write instead of silently overwriting it. This is conflict detection, not collaboration or a CRDT merge.

Save failures remain visible. A failed or corrupted load does not clear the database. The user can export the in-memory authoring document (**Download backup** in the save alert). Site storage is not an external backup; clearing the origin, changing browser profiles or device loss requires a previously exported JSON file.

While the newest edit is not stored (saving, failed, or storage unavailable), the page asks before it is closed or reloaded (`saveQueue.unsaved()`). Storage errors keep their real reason: a quota error says storage is full, blocked site data says so, instead of a generic abort. A later successful save stores a full snapshot, so it also recovers every edit whose save failed earlier. `tests/e2e/storage.spec.ts` covers these paths in Chromium's real IndexedDB: a two-tab conflict, storage that cannot open, and a quota failure mid-session (the previously stored document stays intact).

## Public boundary

`publicDocument` creates a new graph. It drops privateNotes; removes private and unreachable views/nodes; removes invalid or private edges; retains only attached public evidence; removes images whose assets are private; and retains only referenced public sources/assets. It validates the result. HTML, SVG, PNG, PPTX and Mermaid consume this projection. Full Authoring JSON is intentionally a different, clearly labelled backup operation.

The public filter is not authorization, anonymization, secret detection or employer permission. A screenshot/text marked public may still contain a secret. Review public content before publishing. A static portfolio contains all of its exported content and can be inspected by its recipient.

## Trust boundaries

React renders text as text. Standalone HTML assigns imported labels/content with textContent; its SVG markup comes from an XML-escaping exporter, not user HTML. Script payload serialization escapes the closing-script vector. Uploaded images are size-bounded; SVG is sanitized, external references and active elements are removed, then rasterized. Raster images are decoded and re-encoded. The canonical asset schema accepts embedded raster data only.

Code snippets are display-only. No eval, Python process, SQL connection, shell command, remote diagram server or cloud-account discovery is present. This is a limited V1 threat model, not a certified untrusted-file sandbox. Do not add an arbitrary Markdown/HTML renderer without updating both the export and browser security tests.

## Export contract

The interactive canvas and semantic exporters are currently separate adapters. They preserve meaning but not identical pixels. SVG contains a full public-document metadata payload for DiagramCloud re-import; arbitrary SVG cannot reconstruct the semantic graph. PNG has no drilldown. PowerPoint has native objects, static connections and view hyperlinks. HTML carries the complete public graph with a read-only nested explorer. Browser PDF print captures expanded views, not every possible project state.

The next architectural improvement is a shared export scene with measured labels and common connector routing. Do not solve export differences by making screenshots the only output: editable PowerPoint and searchable/vector SVG remain important.

## Motion

An edge's batch/stream/query/control/dependency type and slow/medium/fast speed are authored semantics. Status and activity are illustrative, not telemetry. Reduced motion starts paused and disables CSS animation. Provider artwork must not rotate; animate an independent ring or data particles. Do not encode performance claims such as 'Spark is faster than SQL' from visual speed.

## Deployment

Vite builds a static site. Cloudflare static assets configuration and security headers are supplied, but no deployment or domain was provisioned. Keep local-first ownership independent of the host. Server synchronization, identity, storage and external execution adapters are optional future services, not dependencies of this root.


## V1.1 reliability amendments

The persistence status shown in the shell is now driven by a latest-snapshot save queue (`src/core/saveQueue.ts`). Saves are serialized, but completion of generation *n* is ignored for UI terminal state once generation *n+1* has been queued. This prevents a false transient `Saved locally` indicator during rapid edits. The queue does not replace IndexedDB conflict detection; it only coordinates in-tab write ordering and status.

`loadWorkspace` validates stored rows independently. A corrupt row, invalid row envelope, or key/document-ID mismatch becomes a workspace warning while valid projects remain available. The raw invalid row is deliberately not deleted or rewritten automatically, preserving a future recovery path. IndexedDB `blocked` and `versionchange` events clear the cached connection state.

**Recovery screen.** When rows fail to load, the header shows **Recovery (N)** (`src/ui/Recovery.tsx`). Each row lists its ID, save time, size and the reason it failed, and nothing changes until the user acts:

- **Download raw copy:** the row exactly as stored (`readRawRow`).
- **Open in JSON editor:** only when the row holds JSON text. It goes through the normal validate → preview → apply path. `adoptRow` first records the row's stored generation, so the repaired save replaces that row instead of being refused by the other-tab guard. A later write from another tab is still detected. The row leaves the list only after its replacement has actually been saved.
- **Delete from this browser…:** needs a second click, **Delete permanently**, and says whether a raw copy was downloaded (`deleteRow`).

Whole-document JSON/AI editing remains explicit and human-applied. `src/core/changePreview.ts` computes a stable-ID diff across nodes, edges, views, evidence blocks, assets and sources plus top-level metadata/story changes. Same-project input must carry the exact current revision before Apply is enabled. This prevents a stale AI/editor snapshot from silently overwriting newer edits. It is optimistic revision guarding, not semantic merge and not a JSON Patch implementation.

`src/export/scene.ts` builds one measured scene per view, and every export draws it: SVG, PNG (from the SVG), the HTML portfolio (inline SVG) and PowerPoint. See "Shared export scene" below. The React Flow canvas is not drawn from the scene: it keeps its own interactive routing and CSS text, so the canvas and exports share node positions and box size but not pixel identity.


## V1.2 optional cloud asset connector

Google Drive is the first external asset provider, but it is intentionally **not** a persistence backend. The canonical project remains the validated DiagramCloud JSON document stored locally. Each Drive-linked image has two layers:

```text
asset.data   = sanitized embedded PNG/JPEG/WebP used by renderers/exporters
asset.remote = private authoring metadata for the Google Drive source/backup
```

`asset.remote` can contain a Drive file ID, file name, MIME type, web view link, modification time, size and the last cache timestamp. `publicDocument()` deletes this remote object before any public serializer receives the project.

The connector uses Google Identity Services token flow in the browser and requests only `drive.file`. Access tokens live in module memory and are never persisted. Google scripts are dynamically loaded only after the user opens/uses the Drive feature. Google Picker is additionally gated on an API key and numeric Cloud project App ID.

The export boundary remains deliberately offline-first: PPTX, HTML and evidence rendering consume only `asset.data`. No exporter is permitted to dereference Drive URLs or request a Google token. This makes remote asset providers replaceable and keeps presentation generation deterministic.

Future providers (OneDrive, Dropbox, S3/R2, AI image APIs) should implement the same pattern: explicit import/sync into a validated cached asset, provider metadata private by default, and no remote fetch during public export.

## DataPass repository bridge (Bridge V1, DiagramCloud side)

Contract: DataPass `main` at `83c41e0` (merged via PR #13; schemas unchanged since the PR #9 draft `fde955a`), pinned in `docs/contracts/datapass-diagramcloud-bridge.lock.json`. The two schemas are vendored under `docs/contracts/datapass-bridge-v1/`; `tests/bridge.test.ts` fails if a vendored copy differs from the pinned upstream Git blob.

- `src/bridge/sidecar.ts` is React-free. It reads and writes `<repo>/.datapass/diagramcloud.json` through a minimal File System Access interface, so unit tests use in-memory folders.
- Opening: the JSON / AI dialog's **Open project folder…** reads the sidecar as text and places it in the ordinary `parseDocument` → stable-ID change preview → revision check → apply path. A repository file never reaches React state unvalidated. From `.datapass/project.json`, only `project.id` and `project.title` are read, to confirm the folder.
- Applying a sidecar opens it at its own revision (history resets) and links the project to that folder. If a stored local copy with the same ID has a different revision, apply is blocked; the only override is **Back up local copy, then open repository version**, which downloads the local authoring JSON first.
- Saving: **Save to repository** re-reads the file and compares its SHA-256 with the hash recorded at open/last save. Any difference (a DataPass plan applied, Git pull, another editor) refuses the write and leaves the file untouched; the alert offers a backup and a reopen for review.
- The sidecar is the full authoring document (the contract allows private presentation data in a repository). Review notes flag private objects and sidecars above 1 MiB before commit. Public exports remain separate and still go through `publicDocument`.
- `contextBlock()` is the `diagramCloud` member DiagramCloud guarantees for a `datapass.ai-context` V1 envelope and is tested against the pinned schema.

Limits: folder access needs a Chromium browser (Edge/Chrome); elsewhere use Import JSON and **Download diagramcloud.json**. The folder link is kept in memory only and must be reopened after a page reload. DiagramCloud does not apply `datapass.ai-plan` operations; that stays with DataPass per the contract.

## AI change preview

Before a whole-document import (JSON / AI dialog) or an Evidence-workspace import is applied, `src/core/changeDetail.ts` compares the proposal with the open version by stable ID. The preview lists every added, removed or changed item by name, with before → after for each changed field. Moved positions, placement lists and replaced images are summarised rather than dumped.

**Cautions.** Edits that the contributor rules say a human must confirm are listed first as cautions:

- making something public, or approving it for public export
- relabelling synthetic data as source-derived
- marking something as verified in source
- new source-derived content that cites no source
- a changed KPI figure
- changed image rights
- dropped sources
- mass removals
- an item removed and re-added under a new ID with the same name, which means a stable ID was replaced instead of its label edited

Cautions inform; they do not block. Validation and the revision check still decide whether the import can be applied.

**Rendering.** Names and values come from imported JSON and are rendered as React text, never as HTML (`src/ui/ChangeDetail.tsx`).

## Revision-guarded JSON Patch

Small AI edits can be sent as a `diagramcloud.patch` envelope instead of a whole document (`src/core/patch.ts`). Its fields are `target` (project or experience pack), `targetId`, `baseRevision`, `summary`, and RFC 6902 `operations`: add, remove, replace, move, copy and test.

**Stable-ID paths.** A path segment `@<id>` addresses an array item by its stable ID, e.g. `/nodes/@checks/label`, so a patch does not depend on array positions. Plain indexes and `-` still work.

**Guards.** The whole patch is refused when:

- the target or `targetId` does not match the open project or pack
- `baseRevision` is not its current revision (stale)
- it changes any `id`, or the document's own identity fields (`/id`, `/revision`, `/schemaVersion`, `/format`)
- it uses `__proto__` / `constructor` / `prototype` path segments
- any operation fails, including a `test`
- the result fails `validateDocument` / `validatePack`, or exceeds the size limit

**Applying.** Operations run on a copy, and a patch applies all-or-nothing. The result keeps the base revision and goes through the same change preview and Apply step as a whole-document import; applying it bumps the revision, so replaying the same patch is refused as stale.

**Schema.** `scripts/generate.ts` writes `public/diagramcloud.patch.schema.json` for AI tools. **New JSON Patch** in both dialogs fills in a template for the open version.

## Realization overlay

Every node's `status` is a Planned/designed illustration. `src/core/realization.ts` adds a second, external
layer: **observations** — dated facts about one component, owned by another Datapass Galaxy app, that enter
only through a reviewed `diagramcloud.patch` (`observationPatch()`) and stay private/unreviewed until an
author reviews them in Edit mode. The full pipeline is model → validation → UI → export:

- **Model** (`src/core/model.ts`): `observationSchema` on `documentSchema.observations`, plus a `portfolio`
  block holding portfolio-index settings (`projectRef`, `openUri`, `lastReviewedAt`, `indexVisibility`).
- **Validation** (`validateDocument`): refuses credential-like values and `.env` text in an observation
  (`src/core/secrets.ts`), synthetic evidence backing an observation, and `shareable` set without
  `reviewedAt` + public visibility; also checks a story step only cites a reviewed observation about a
  component in its own view.
- **UI**: `src/ui/Realization.tsx` (the Realization section and its review controls in Edit mode, the story
  evidence list), a `node-realization` chip and `status-dot` tooltip on the canvas card
  (`src/ui/Canvas.tsx`), and **New observation patch** in the JSON / AI dialog (`src/App.tsx`).
- **Export**: `publicDocument` keeps only reviewed+public observations; `src/export/portfolioIndex.ts`
  further narrows to shareable ones for the `diagramcloud.portfolio-index/1` file; the standalone HTML
  export (`src/export/html.ts`) lists a component's presented observations under "Observed by other apps."

Full field list, the four claim values, the patch shape, the review lifecycle, refusal rules, the
portfolio-index envelope, the deep-link format (`src/core/links.ts`) and the Galaxy integration roles are in
[docs/contracts/realization-overlay.md](contracts/realization-overlay.md).

## Icon registry

`src/core/icons.ts` is the only place an icon ID gets meaning.

**Original symbols.** The generic symbols are drawn in code by component kind and are DiagramCloud's own MIT artwork.

**Vendor icons.** A vendor icon is third-party artwork under its owner's terms. Each entry records:

- the file under `public/icons`
- the vendor, and the item it represents
- the upstream repository, full commit, package name and version
- the git blob ID of the exact file
- the controlling terms URL
- the usage rules: no cropping, flipping, rotating, recolouring or distorting, and never used as a product logo

**Rendering.** The canvas and the Inspector picker read the registry. An unregistered ID draws the generic symbol, never an unknown file. The vendor image carries its attribution as a tooltip.

**Build check.** `scripts/icons.ts` runs first in `npm run build` and fails when:

- a file in `public/icons` is not registered
- a registered file is missing
- a file's git blob differs from the recorded one; a recoloured or edited copy always does
- a vendor entry lacks its source or terms

`.gitattributes` marks `public/icons/**` as `-text`, so line-ending conversion can't change the bytes. The delivery notice `public/third-party-licenses.txt` includes one attribution line per registered icon.

**Exports.** Exports embed a registered vendor icon from its unmodified file (see "Shared export scene").

## Shared export scene

`buildScene(document, view)` in `src/export/scene.ts` returns everything an export needs to draw one view: node boxes, their measured text blocks, a square icon slot, connection routes and label positions.

**Measured text.** `src/export/measure.ts` measures text with Arial's advance widths (1/1000 em; metric-compatible with Helvetica and Liberation Sans). It needs no DOM and no font files. Lines break at spaces, then after `/` or `-`, then by characters; overflow ends with an ellipsis that still fits. Per box:

- provider: 1 line
- label (bold): up to 2 lines
- summary: 2 lines, or 1 when the label takes 2
- footer: 1 line

**SVG.** Draws each line as its own `tspan`, in Arial.

**PowerPoint.** Draws each block as one text box with the scene's line breaks, in Arial, with exact line spacing and wrapping off, so PowerPoint cannot re-wrap it. Scale is capped at 0.0165 in/px. Boxes are placed from a measured baseline model: first baseline = 0.905 em + half the extra leading. That model was calibrated by rendering in desktop PowerPoint.

**Routes.** The shared orthogonal route is kept unless it would pass behind another box, which would make it look connected to that box. In that case the route with the fewest crossings wins, from:

- through the gap between rows (vertical first)
- through the gap between columns (horizontal first)
- a lane just below or above the boxes in the way

If every one of those still crosses a box, `channelRoute` searches a small grid of channel lines: half-way between neighbouring box edges, the two box centres, and a lane just outside all boxes. It takes the shortest route, counting each bend as 100px. The route leaves the middle of a side of the source, enters the middle of a side of the target, and no segment passes through any box, its own two ends included. This only runs when every candidate crosses a box, so other routes keep their shape. If no channel is free, the candidate with the fewest crossings is kept.

Across the sample projects this took box crossings from 136 to 0. The last one was in the FOIL Databricks DAB detail: two boxes on the middle row of a 3×3 grid, with a box between them. Now it runs through the gap between the lower two rows.

**Lanes.** Routes are simplified (no repeated or collinear points). Then connections that share a straight stretch get their own lanes (`separateLanes`), `LANE_GAP` = 8px apart and centred on the shared line. A moved segment takes both of its end points along, so routes stay orthogonal and their ends only slide along the box side. Across the samples, overlapping pairs went from 42 to 0.

**Labels.** Connection labels sit on the longest visible straight run, limited to its free length, and wrap up to 3 lines above it. A label beside a vertical line tries the right side, then the left, then narrower wraps, and may slide along its line. The first spot that covers no box, no other label and no line (its own included) wins. If there is none, the first spot that covers no box and no other label wins. Across the samples, labels on another connection's line went from 32 of 189 to 3, and labels on their own line from 3 to 0. Labels are drawn last, after the boxes, on a background halo. Across the samples, no label covers a box or another label. The scene's bounds grow to include every route and label.

**Icons.** A registered vendor icon is embedded as a data URI of its exact file: the build and tests read `public/`, and the app fetches from its own origin (`src/export/iconData.ts`). It keeps a square slot, is never cropped or recoloured, and comes with a credit line (in the SVG footer, on the slide and in the slide notes). Tests check that the bytes inside the SVG and inside the PPTX media have the registry's git blob.

In PowerPoint the icon is an SVG with a PNG fallback. In the browser pptxgenjs draws that fallback as a real PNG; decks built in Node (build/tests) carry the SVG only.

**Known limits:**

- there is no auto-layout, and the channel search is a fallback, not a general obstacle router: it does not minimise crossings between connections or balance lanes across a whole view, and it gives up (keeping the fewest-crossings candidate) when boxes leave no free channel
- lanes are separated per straight stretch; crossings between different connections are allowed
- the canvas is not drawn from the scene

## 1.0 additions

**Realization in exports.** The export scene carries an optional realization badge per node (`SceneNode.realization`), only for Presented observations (reviewed and public; `presentedObservation` in `src/core/realization.ts`). SVG, PNG, PPTX, the project deck, HTML and Mermaid draw it from that one decision, so no export can show an unreviewed or private claim. Colours come from `CLAIM_BADGE` (blue/indigo/amber/slate, never green). Details: [realization contract](contracts/realization-overlay.md#realization-in-exports-10).

**Tables and transformations without JSON.** `src/core/table.ts` owns table drafts (cell parsing, row/column operations, TSV/CSV paste, limits of 20 columns and 500 rows) and refuses blank or duplicate column names. Evidence blocks can carry an optional `transform` step (`input`, `logic`, `output`, `mapping`, `rules`); `src/core/transform.ts` groups them into the transformation explainer. It is explanatory only: nothing is executed, and template input/output rows are labelled synthetic. Both are additive optional fields: the document schema stays 1.

**Inspector grammar.** `src/ui/Inspector.tsx` presents every component in a fixed order (Identity, Meaning, Realization, Evidence, Work, Publication), and the edit form uses the same groups. Visual editors (`src/ui/BlockEditor.tsx`, `src/ui/SourcesEditor.tsx`) cover tables, text/code/images, metrics and project sources; "Edit as JSON" stays as a per-block fallback.

**Verification receipt.** `galaxy.verification-receipt/1` (`src/core/galaxy.ts`) records a release's qualification: the exact git commit, a clean tree, the checks run and the level they support (IMPLEMENTED → BUILD_VERIFIED → PACKAGE_VERIFIED → E2E_VERIFIED → MANUAL_QUALIFIED). The level is derived from the checks and never inferred upward; `GALAXY_QUALIFIED` and any Galaxy level other than G0 are refused. `scripts/qualify.ts` writes it locally (`npm run qualify`) or from CI step outcomes. See [RELEASE.md](RELEASE.md).

**Version.** `package.json` is the single product version: Vite injects it as `__APP_VERSION__` (header, footer, About) and the generator writes it into the Galaxy handshake.

## 1.1 additions: interchange import

`src/core/interchange/` converts other diagram formats into the canonical document; it never touches the open project.

- `graph.ts`: the interchange graph (pages of boxes, connections and groups), label clean-up, provider and component-type inference from labels and shapes, and `documentFromGraph`, which builds one validated project: stable IDs (Mermaid node IDs; slugged labels for draw.io), group membership as tags, a root view of page cards when there is more than one page, positions (the source arrangement rescaled to the card size, or a layered layout when the source has none), and the import report. Imported projects get a new `import-…` ID, so applying one can never replace an existing project.
- `xml.ts`: a small non-validating XML reader (no DTD or external entities), the same in the browser and in Node tests.
- `drawio.ts`: pages (plain or compressed with raw deflate through `DecompressionStream`), editable SVG/PNG containers, cells and object wrappers, absolute positions through containers, frames detected geometrically, invisible groups, junction dots, placeholder labels, unsnapped connector ends. Vendor stencils keep only a provider name; no vendor artwork is drawn (see the icon registry).
- `mermaid.ts`: `flowchart`/`graph` and `architecture-beta`; other types are refused.

The report lists every kind of loss with a count. Tests cover a hand-written multi-page AWS file, compressed/SVG/PNG containers, malformed input, every Mermaid link form, round trips of our own Mermaid export for every sample, and refusals.

**Gallery.** `src/data/cloudGallery.ts` adds five independently authored references through the shared builders in `src/data/builders.ts`; `src/ui/Gallery.tsx` holds the gallery filters, card marks and the dismissible "What's new" card (browser storage only for the dismissal).

## 1.2 additions: Visio import and draw.io export

- `src/core/interchange/zip.ts` reads the central directory of a ZIP package and inflates parts with `DecompressionStream('deflate-raw')`; no ZIP64 or encryption, 64 MiB per part.
- `src/core/interchange/visio.ts` follows `visio/pages/pages.xml` and its relationships to each page part, inherits cells and text from master shapes (`visio/masters/`), converts Visio coordinates (inches, y up, group-local pins) to the page, and builds the same interchange graph as draw.io: shapes (text, else master name), groups of an icon and a caption as one component, groups of several labelled shapes and `msvStructureType` containers as frames, captions beside an unlabelled icon or on a frame, connectors from `<Connect>` glue or the shape under a loose end, arrows on the begin end reversed. Binary `.vsd`, `.vdx` and stencils are refused.
- `src/export/drawio.ts` writes an uncompressed `mxfile` from `publicDocument`: pages in drilldown order, `UserObject` boxes carrying `dcId`/`dcKind`/`dcProvider` (and a presented realization line), edges with `dcKind` in the style, exit/entry constraints and the scene's interior route points, so draw.io draws the same orthogonal lines. Labels are plain text (`html=0`), XML-escaped once.
- `documentFromGraph` keeps a carried DiagramCloud ID when valid and free, and turns page links into drilldowns when they reach every page exactly once from the first page (no "Pages" root view then).

## 1.3 additions: repository scanner

`src/core/scan/` is pure TypeScript shared by the browser and `scripts/scan-repo.ts`.

- `scanner.ts`: `wantedFile` filters paths before anything is read (ignored folders, secret files, size and count limits); `scanRepository` turns `{path,text}[]` into a model of items (system, containers, external systems, components, files, tables, Terraform resources, CI) and links, each with evidence `{file,line,finding,confidence}`. Detectors: manifests (npm, pip, pyproject, go.mod) through the catalogue in `tech.ts`, Dockerfiles, docker-compose (`yaml` package), Kubernetes workloads/Services/Ingresses, Terraform blocks and references, GitHub Actions deploy steps, example env key names, SQL/dbt/Prisma lineage, TypeScript/JavaScript/Python imports resolved to modules and files. Technology links resolve last, so a compose or Kubernetes service running PostgreSQL is preferred over an external PostgreSQL node.
- `document.ts`: one project with drilldown views (System context → Containers → Components → Files; Data lineage; Infrastructure per provider), node IDs derived from scan keys (stable across rescans), a source-derived evidence table per node, confidence as a tag and on non-confirmed edge labels, layered positions, and the import report.
- `index.ts`: `scanToDocument` and `scanPickedFolder` (`<input webkitdirectory>`; filters by path and size before reading).

A rescan of a project already in the library keeps its revision, so the JSON / AI review shows the stable-ID change preview before applying.

## 1.4 additions: AtlasNote cheatsheet export

`src/export/atlasnote.ts` turns `publicDocument(project)` into AtlasNote's cheatsheet JSON (1200 × 1600 fixed pages, no raw SVG: AtlasNote renders its own grammar). Pages follow the drilldown order of the draw.io export (`orderedViews`). The diagram uses the shared export scene: box centres keep their canvas arrangement, boxes are drawn at 80 % × 60 % of their canvas size so AtlasNote's mid-gap connection labels fit, and the layout is scaled into the frame (spread up to 1.4× when sparse). AtlasNote's limits (64 pages, 80 nodes, 240 edges, 16 × 60 tables) are applied with the remainder counted on the page. Every frame is a fresh object: AtlasNote refuses shared objects as non-canonical JSON. `tests/contracts/atlasnote/validation.mjs` is AtlasNote's validator, vendored for the contract test.

## 1.5 additions: project atlas

`src/core/atlas/` composes several repository scans into one document without a new graph model. `manifest.ts` validates the explicit membership (repository IDs ≤ 24 characters, locators without credentials, relationship endpoints). `compose.ts` builds the root view (one card per repository, declared relationships with basis `planned`), embeds each scan under the prefix `<repository>.` (IDs over 80 characters are shortened deterministically) with a budget shared across repositories (`scanBudget`), and appends a snapshot to `atlas.snapshots`. `rescanRepository` removes one prefix and embeds a new scan; `addRepository` adds an unscanned card. `snapshot.ts` compares revision vectors (a missing revision is `unknown`, never `unchanged`) and lists stale sources; it never polls. `publicDocument` keeps only the active snapshot, only repositories whose card is public, and drops runtime/context pointers. The CLI `scripts/atlas.ts` shares `scripts/lib/readRepo.ts` with `npm run scan`.

## 1.6 additions: perspectives and view spec

A perspective is a property of a view (`view.perspective`, default System), not a separate graph: one component keeps one ID and appears in as many views as the document says. `src/core/viewspec.ts` derives everything from the validated document: `pathTo` (breadcrumb from the root through drilldowns), `perspectivesFor` (per perspective: available, partial through a drilldown or parent view, unknown, unsupported), `repositoryOf` (atlas prefix → snapshot entry) and `viewSpec`, the serialisable renderer-neutral form of one view (public audience through publicDocument, with omissions stated). The app keeps an in-memory Back / Forward stack of {path, view, selection}, reset when another project opens.

## 1.7 additions: rendering styles

`src/export/styled.ts` renders one view in two more styles from the same inputs as every export: meaning from `viewSpec` (public audience), geometry from `buildScene`. Blueprint adds a grid, zone references derived from positions, kind symbols (storage drum line, control chamfer, application double frame), line patterns per edge kind, a legend limited to what is drawn, and a title block (project, view, perspective, revision vector, date, provenance, omissions). Editorial numbers the components and lists them in a key. Text is measured with the shared Arial metrics, so nothing re-wraps; output is static SVG with system fonts and `data-node-id` on every component. The canvas Blueprint toggle is CSS only.

## 1.8 additions: galaxy map and reference atlases

`parseManifest` reads a third input, the Claude Control galaxy map, without changing its format: apps with a repository become manifest members (host from the repository string, `path` for the CLI only), connections become relationships whose label is `contract · status`. Basis follows what the map can support: `live` with a source file is static source; `branch` and `planned` are planned; self-reads and unknown apps are reported, not drawn. A snapshot repository may carry `visibility`; without a card, only an author-marked public repository reaches `publicDocument`. The draw.io importer treats a repeated explicit `dcId` across pages as one component, which is how DiagramCloud exports a component shared by two views.

## 1.9 additions: MosaicStudio adapter

`conceptSpec(doc, viewId)` maps the public ViewSpec to MosaicStudio's concept spec. Layers come from what a component does (storage and tables, processing, control, apps and reports, sources and people), bottom to top with heights 0, 1, 2…; domains are repository groups or the view, and a cell above three components spills into a continuation domain. Kinds come from the provider first (SQLite → sql-db, DuckLake → lakehouse, dbt → pipeline, React → web-app…), then from the DiagramCloud kind; `lake` is never emitted because the contract allows one, on the bottom layer, which is the Studio author's call. Basis planned becomes status planned. Provenance is `documented` only when every component cites a source URL or an evidence block. Parallel connections merge into one flow, as the contract requires. Positions, navigation, story and evidence content stay in DiagramCloud, and the loss report says so.

## 1.10 additions: Technical Manual

`technicalManualHtml(doc)` composes existing parts rather than adding a renderer: the views in drilldown order (`orderedViews`), one `viewSpec` per view for tables and omissions, and the editorial SVG for figures (its marker ID is suffixed per figure so the page has unique IDs). Each component is counted once in the basis summary, however many views show it. Evidence blocks print with their provenance label; image blocks are named but stay in the interactive HTML. A Content-Security-Policy of `default-src 'none'` and the absence of any script make the file safe to open from disk and to archive; `@page` and print rules give A4 sections.

## 1.11 additions: Lens projections

Lens owns observed Git and delivery state; DiagramCloud keeps three meanings apart and adds no fourth. `applyLensMinimap` appends a snapshot whose `runtimeRefs` are `lens.<repo>.<kind>[.<n>]` pointers (default-branch-head, ci-state, work-in-progress, request, agent-session), all basis observed with the minimap's `observedAt`. Nodes, edges, views and design status are byte-for-byte unchanged, so nothing observed can be mistaken for Planned or Presented, and `publicDocument` already empties runtime pointers. The revision of a scanned repository is the one its content was read at; `lensHeads(snapshot)` feeds `staleRepositories({current})`, which already explains a moved source. Matching is by repository ID, locator basename or title, guarded by host; ambiguous and unknown entries are reported.

## 1.12 additions: Diagram Design mode

`src/export/design/` is a fourth family of renderers next to standard, blueprint/editorial and the manual. `designContext` builds everything from `publicDocument` and `viewSpec(input)` (so omissions are counted against the full input) and resolves the focal set: `view.design.focal` (at most two, validated as members of the view and filtered by `publicDocument`), else one strictly most-connected component with at least three connections, else none. `kit.ts` holds the tokens (diagram-design's semantic roles, light and dark), node box, rounded elbow path, masked labels, legend strip, header and the accessible SVG wrapper with per-figure marker IDs. Architecture reuses `buildScene` (scaled 0.8) for positions and box-avoiding routes, then fans shared attach points and places labels only where their mask clears every box. Layer stack and the exploded stack share one kind-to-layer table (the MosaicStudio layer cake reading); the exploded stack uses the drilldown chain through the view (the parent kept on top, at most four planes) and falls back to layers. The tree walks drilldowns from the root, first parent wins. The canvas preview shows the SVG as an image, never as injected markup. `designBrief.ts` turns an agent's brief into a reviewed change of `view.design` only, reported like an import.

## 1.13 additions: more Diagram Design figures

`flowRanks` gives each component of a view a reading-order rank (longest path from the components nothing points to; a cycle is broken at the earliest component in canvas order). The swimlane is the architecture renderer with a computed layout (`ArchitectureLayout`: positions in canvas units plus lanes), so it keeps the shared box-avoiding routes, fanned ports and label placement; lanes are repositories when a view spans two or more, else layers. The sequence figure orders the same connections by rank and says on the figure that the order is derived, not timed. The story timeline reads `story` from the public document only. The chart picks the first table block of the view's components with a numeric column and prints the block's provenance before the bars.

## 1.14 additions: architecture delta

`compareView(before, after, viewId)` builds both ViewSpecs from the public documents and compares by stable ID: a component's signature is label, kind, provider, summary, basis and design status; a move is a position change above 8 canvas units; a relationship's signature is label, kind and basis, and a rewire is the same ID with other endpoints. `deltaSvg` draws both panels with the shared scene (scaled 0.6, one origin for both so retained components keep their place) and a ledger between them, one entry per (object, change). Different project IDs, or a view that is not public in both versions, are refused with a message.

## 1.15 additions: figure book, manual figures, more figure types

`designBookHtml` concatenates the per-view figures (each SVG keeps its own slug, so IDs stay unique on one page) under a strict CSP. The manual's `figure()` uses `designSvg` when the public view carries `design`, else the editorial figure with numbered callouts. New renderers, one file each in `src/export/design/`: `deployment.ts`, `matrix.ts`, `treemap.ts`, `hub.ts`, `heatmap.ts`, `line.ts`; all take the same `designContext` and print only public facts.

## 1.16 additions: context, status, lineage, radial

Four renderers in `src/export/design/` (`systemContext.ts`, `status.ts`, `lineage.ts`, `radial.ts`), all from the public ViewSpec: the context figure classifies components by connection direction only; lineage reuses `flowRanks` and traces transitive upstream/downstream of one subject; radial does an undirected breadth-first search to three steps; the status board reads the designed status. Custom SVG attributes use the `data-dd-` prefix.
