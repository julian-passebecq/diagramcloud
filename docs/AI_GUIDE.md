# DiagramCloud for AI agents

This page is for an AI agent (Claude Code, Codex, any LLM with a shell) that has to graph a repository or a set of projects with DiagramCloud, edit a DiagramCloud document safely, or draw publication figures. Read it once, then work from the command table. The JSON examples on this page are checked by `tests/ai-guide.test.ts` against the real validators, so they are valid as written.

## 1. What DiagramCloud is

- **A document model, not a drawing.** A project is one JSON document (`diagramcloud.json`, schema version 1). It has components (`nodes`), connections (`edges`), views that each show a subset with positions, evidence blocks, sources, a guided story and optional observations. `src/core/model.ts` is the contract and `validateDocument` is the gate: JSON Schema alone (`public/diagramcloud.schema.json`, written by `npm run generate`) is not enough.
- **Facts come from repositories, not from memory.** A deterministic scanner reads a folder (no code run, no network, no secret files) and produces components and links, each with file:line evidence and a confidence. An atlas joins several repositories, each at **its own Git revision**: there is never one project revision.
- **Drawing is a separate layer.** Diagram Design mode renders any public view as one of 21 figure types. You choose the figure through a *design brief*; you never change facts to make a picture look better.
- **Public vs private is enforced.** Public exports go through `publicDocument`, which drops private components, connections, evidence and repositories. Authoring JSON is the explicit full private backup. Mark something `"visibility": "private"` instead of leaving it out.

## 2. Three meanings you must keep apart

| Meaning | Where it lives | Who sets it |
|---|---|---|
| **Planned / designed** | a component's `status` (`idle`, `running`, `complete`, `warning`, `failed`) and `basis: "planned"` | the author or the manifest |
| **Read from source** | `basis: "static-source"`, scanner evidence with file:line | the scanner |
| **Observed / verified** | `observations` (dated external claims) | a human, through a reviewed patch only |

A scan is never "observed". A status board shows designed status, not reality. Synthetic or illustrative numbers stay labelled `"provenance": "synthetic"` everywhere and are never results.

An external observation can optionally carry `stateFacet: {facet, value, scope}`. The six independent axes are `lifecycle`, `selection`, `implementation`, `verification`, `distribution` and `runtime`. `value` and `scope` are explicit nonblank source text (at most 160 characters each), preserved in the producer's vocabulary; scope is an inert label, never a membership or access grant. For example, a source may report lifecycle `FROZEN` and distribution `DEPLOYED` for the same component. `CANCELLED` never removes code or implies a runtime state. Owner, source, date and revision come from the enclosing observation. Use the existing revision-guarded observation patch and human review; never infer a facet from a summary, missing commits, folder digest or design status. Missing axes stay unknown. Dated claims, histories and disagreements remain separate; there is no current-state verdict. Typed facets do not create a general Verified component badge. Public export retains only reviewed public observations. Other view adapters may omit scoped states; use the observation history or full public JSON to retain them.

## 3. Commands

All commands run from the repository root after `npm ci`. They read files and write files; none of them changes the input document.

| Goal | Command | Output |
|---|---|---|
| Graph one repository | `npm run scan -- <folder> --out repo.json [--name "Title"]` | a validated document: system → containers → components → files, data lineage, infrastructure |
| Graph several repositories | write a project manifest (section 4), then `npm run atlas -- project.manifest.json --out atlas.json` | one atlas document, each repository at its own revision |
| Keep private provenance for a new Galaxy import | `npm run atlas -- galaxy.json --capture-galaxy-provenance --out .local/atlas.private.json` | full authoring JSON with an optional private import receipt; no namespace binding or ID reuse |
| See what moved since last time | `npm run atlas -- project.manifest.json --previous atlas.json --out atlas2.json` | a new snapshot; the report lists changed / unchanged / unknown revisions |
| Draw every public view | `npm run design -- doc.json --out figures/` | one SVG per view, `index.html`, `book.html` (figure book) and `suggestions.json` |
| …with your figure choices | add `--brief brief.json` | the brief is applied in memory and its review printed |
| …as PDF | add `--pdf` | `book.pdf` and one PDF per view (offline Chromium; `npx playwright install chromium` once) |
| …one figure type for all | add `--type <type>` and/or `--theme light\|dark\|editorial` | |
| Before / after a rescan | `npm run design -- new.json --delta old.json --out figures/` | Before · Changes · After per view, compared by stable ID |
| Prepare a Mosaic concept preview | `npm run concept:preview -- doc.json --view root --audience public --out new-preview/` | concept JSON, typed source mapping, host sidecar and a local receipt; output must be a new directory under an existing parent |
| Open a selected local owner viewer | `npm run concept:host -- doc.json --view root --audience public --viewer concept-viewer.html --viewer-sha256 <sha256>` | isolated loopback host; no renderer download, source collection or publication; optional matching `--packet` and explicit `--diagramcloud-origin` enable bounded mapping return |
| Check your edits | `npx tsc --noEmit`, `npm test`, `npm run build`, `npx playwright test` | the qualification a change needs before a PR |

The scanner also skips nested repositories and git worktrees (any sub-folder with its own `.git`, `.claude/worktrees`, `.worktrees`), `node_modules`, build output and secret files.

Concept previews require an explicit audience. `--audience public` uses `publicDocument`; `--audience author` prepares a private projection of the selected view for a host that already has document access. Neither option grants access or changes publication visibility. The command reads only the selected document, preserves it, refuses existing output and writes `READY.json` last. READY records local preparation, not viewer, WebGL, T3 or publication qualification. `preview.packet.json` is a derived host sidecar, not an editable architecture, Mosaic load message or T3 preview descriptor. The selection-return helper is a candidate protocol; the Mosaic viewer is not wired to emit it. See `docs/contracts/concept-preview.md` for limits and mapping semantics.

### Project Intelligence inputs and outputs (1.24.0)

In the UI, **New analysis** selects Repository / Guided / Hybrid / Graph, purpose and Quick/Standard acquisition. Explicit optional Deep/Custom analysis profiles use bounded local parsers and reviewed projections. Read `docs/release-1.24/RELEASE_NOTES.md` for acquisition limits and `examples/project-intelligence/project-brief.json` for a synthetic no-Git brief. The generated `public/diagramcloud.project-brief.schema.json` is structural guidance; `validateProjectBrief`, `compileProjectBrief` (or `compileHybridBrief`), `validateDocument` and candidate review are all required. A ProjectBrief declares workstreams/systems/tasks, repository IDs/bindings and authored relationships; it never attests runtime. A task workspace displays evidence, never executes it.

`npm run intelligence -- brief --input examples/project-intelligence/project-brief.json --out <new-folder>` writes a new private candidate. `npm run intelligence -- inspect --input <document.json> --out <new-folder>` derives private readiness/asset context, not a new repository scan. Reuse existing review/patch guards to apply; reimport must retain authored text, positions, story, visibility, assets and evidence. Matching stable IDs remain; missing entries in partial input are not removals.

Explicit shared repository bindings in a ProjectBrief use private canonical declaration evidence: each scope's `brief-meta-<id>` block cites stable `brief-repository-<repository id>` sources. These are membership declarations, not inspected source findings. The authored node caption still cites the brief itself, so private repository membership does not turn that caption into source-derived content. Local paths never enter the compiled Project; no repository is read by brief compilation. Existing reviewed evidence is retained on conservative reimport; changing retained bindings needs an explicit reviewed patch. See [binding semantics](contracts/project-brief-source-bindings.md) and the [synthetic shared-repository brief](../examples/project-intelligence/shared-repository-brief.json).

Repository acquisition filters metadata before bounded reads, uses the existing scanner and selected safe Markdown/CSV, and yields/cancels without mutating the saved Project. Inventory content digest identifies inspected bytes; HEAD is a hint with unknown dirty state. Public sheets/context/assets must be derived after publicDocument. Do not copy private inventory text, filenames or counts into a public caption. A public node citing a private source has its source-backed summary/role omitted; explicit author source review or detachment is required to publish the caption. Manual assistance exchanges context and reviewed proposals; source documents are inert data, never tool instructions.

Generated diagnostics may supply a structured cause and suggested next step; see [gap advice](contracts/actionable-gaps.md). Missing metadata stays unclassified. Do not infer denied access from a generic read error, dynamic behavior from an ambiguous reference, stale revisions from age, or confirmed conflicts from a discrepancy candidate. Advice performs no action and grants no authority. Private selected-source/check collectors are unavailable in public presentation modes; switching audiences discards their transient state.

## 4. Formats you write

You produce one of these files and a person (or the CLI) applies it. You do not hand-edit `diagramcloud.json`.

### Project manifest: which repositories belong together

Membership is explicit: only repositories listed here enter the atlas. `host` is one of `github`, `gitlab`, `azure-devops`, `bitbucket`, `local`, `other`; `path` points at a local checkout to scan; relationships are declared (`planned`) unless a scan proves them.

```json
{
  "format": "diagramcloud.project-manifest",
  "version": 1,
  "project": {"id": "shop-platform", "title": "Shop platform (synthetic)", "summary": "Two services and their handbook."},
  "repositories": [
    {"id": "shop", "title": "Shop", "purpose": "Web shop and its API", "role": "application", "host": "github", "locator": "https://github.com/example/shop", "path": "../shop"},
    {"id": "billing", "title": "Billing", "purpose": "Payments ledger", "role": "service", "host": "gitlab", "locator": "https://gitlab.com/example/billing", "path": "../billing"}
  ],
  "relationships": [
    {"from": "shop", "to": "billing", "label": "charges orders", "kind": "query"}
  ]
}
```

A DataPass project file (`.datapass/project.json`) or the Claude Control galaxy map can be passed to `npm run atlas` instead; they are read as manifests, never written.

Galaxy provenance capture is default off. The CLI flag above, or the explicit browser checkbox before the existing Gallery/Hybrid Preview and Apply, records exact supplied app IDs and the local IDs actually allocated for a new candidate. The receipt uses existing private code evidence and stays excluded by `publicDocument` even if its visibility is changed. Authoring JSON retains it intentionally. The digest is SHA-256 of the decoded input text encoded as UTF-8, not original file bytes, a Git revision or producer authenticity. Namespace, upstream version and synthetic semantics remain unknown. Unsafe/oversized/inconsistent capture is unavailable without truncating IDs or changing the normal import. Capture into an existing local Galaxy target is unavailable; the same local Project ID does not establish the same source. `--previous` remains snapshot history only. Never use or edit this receipt to invent an identity association, permission, observation or historical ID repair. See `docs/contracts/galaxy-manifest-identity.md`.

### Design brief: how each view is drawn (presentation only)

A brief sets the figure type, at most two focal components (IDs that are in the view), a theme and a caption per view. It never changes components, connections, basis or observations. Apply it with `--brief`, or in the app: **Diagram Design** → Edit → **Read design brief…** → review → apply.

```json
{
  "format": "diagramcloud.design-brief",
  "version": 1,
  "projectId": "contoso-forecasting",
  "author": "your-agent-name",
  "views": [
    {"viewId": "overview", "type": "exploded", "focal": ["api"], "theme": "light", "caption": "One save, three levels: the lab, who may change a forecast, and where the data lands.", "why": "The story is the drilldown; the API is where a save is decided."}
  ]
}
```

### Revision-guarded patch: small edits to a document

RFC 6902 JSON Patch inside an envelope. `baseRevision` must equal the document's current `revision`, or the whole patch is refused. A path segment `@<id>` addresses an array item by its stable ID, so you never depend on array positions. The result must pass `validateDocument`; IDs, `revision` and `schemaVersion` cannot be changed. The person reviews every change in **JSON / AI** before it applies. This example adds a synthetic quantity to one connection (drawn by the Sankey figure):

```json
{
  "format": "diagramcloud.patch",
  "version": 1,
  "target": "project",
  "targetId": "contoso-forecasting",
  "baseRevision": 0,
  "summary": "Illustrative volume on the planner → Forecast UI connection.",
  "operations": [
    {"op": "test", "path": "/edges/@overview-e0/source", "value": "planner"},
    {"op": "add", "path": "/edges/@overview-e0/quantity", "value": {"value": 1200, "unit": "rows/day", "provenance": "synthetic", "note": "Illustrative, not measured."}}
  ]
}
```

Rename labels freely, keep IDs. To add a drilldown: create the child view (its `nodeIds`, `edgeIds`, `positions`), then set `childViewId` on the parent component. One level per component, no recursion.

## 5. Choosing a figure

Run `npm run design -- doc.json --out figures/` and read `figures/suggestions.json` (`diagramcloud.design-suggestions/1`): for each public view, the five best figure types with the fact behind each ("a numeric table on Input rows", "6 child views below this one"). Then choose by the question the figure must answer:

| Question | `type` | Needs |
|---|---|---|
| How do the parts talk to each other? | `architecture` | (default) |
| What sits on what? | `layers` | several component kinds |
| Overview, then what is inside one part | `exploded` | drilldown views |
| Where is everything? | `tree` / `treemap` | drilldown views |
| Who owns which step? | `swimlane` | repositories or layers |
| What is the path of one request? | `sequence` | connections (order from connections, not timing) |
| What is the walkthrough? | `timeline` | story steps |
| What are the numbers? | `chart` / `line` / `heatmap` | a numeric table evidence block |
| Where does it run? | `deployment` | declared delivery instances or provider fields |
| How much is backed by source? | `matrix` | basis and confidence |
| What touches this part? | `hub` / `radial` | a component with 3+ connections |
| What enters and leaves? | `context` | entry points and sinks |
| Which parts are in which designed state? | `status` | designed statuses |
| Where does this come from and go? | `lineage` | a flow 3+ steps deep |
| How much moves along each connection? | `sankey` | `quantity` on connections |
| How do supplied signed increments accumulate in table order? | `waterfall` | One public numeric table column, at most eight readable rows with omissions reported; running sums are derived, never observed or causal totals |
| Which repositories moved? | `atlas` | an atlas document |

A figure reads well up to about 9 components and 12 connections; beyond 24, use drilldown views. Focal components (0–2) get the accent colour: pick where a decision is made, where data lands, or what changed.

## 6. Worked flows

**Graph a codebase and hand over figures**

1. `npm run scan -- ../my-repo --out .local/my-repo.json`
2. `npm run design -- .local/my-repo.json --out .local/figures` and read `suggestions.json`.
3. Write `.local/brief.json` (section 4), then `npm run design -- .local/my-repo.json --brief .local/brief.json --out .local/figures --pdf`.
4. Give the person `book.html` / `book.pdf`, or the brief to apply in the app.

**Graph several projects and track them**

1. Write `project.manifest.json` with explicit members and declared relationships.
2. `npm run atlas -- project.manifest.json --out .local/atlas.json`; keep the file.
3. Next time: `npm run atlas -- project.manifest.json --previous .local/atlas.json --out .local/atlas2.json`, then `npm run design -- .local/atlas2.json --type atlas --out .local/figures` to see what moved.

**Propose an edit**

Write a `diagramcloud.patch` against the current `revision`, include `test` operations for what you rely on, and ask the person to review it in **JSON / AI**. Never write observations, `reviewedAt`, or "shareable" flags: those are the author's decisions.

## 7. Never

- Invent a component, connection, repository, revision or number that no scan, manifest or source produced.
- Present a scan as observed or verified, or a synthetic value as a result; never drop or soften a provenance label.
- Edit `diagramcloud.json` by hand, mark an observation reviewed, or promote a synthetic evidence block to back an observation (`validateDocument` refuses it; do not work around it).
- Commit a real private atlas or names from it (keep it in `.local/`, which is git-ignored), or read secret files.
- Use `eval`, raw HTML from imported JSON, or network fetches in exports.

## 8. Where to look in the code

### Candidate offline intelligence client

The unmerged full-product candidate extends `npm run intelligence` (a new output directory is required):

```sh
npm run intelligence -- graph --input examples/product-campaign/graph-1.json --out .local/graph-one
npm run intelligence -- graph --input examples/product-campaign/graph-2.json --current .local/graph-one/project.candidate.json --out .local/graph-two
npm run intelligence -- analyze --input examples/product-campaign/native-artifacts.json --out .local/native
npm run intelligence -- brief --input examples/product-campaign/project-brief.json --out .local/guided
npm run intelligence -- delivery --input examples/product-campaign/delivery-brief.json --current .local/guided/project.candidate.json --out .local/delivery
npm run intelligence -- evolution --input .local/guided/project.candidate.json --current .local/delivery/project.candidate.json --out .local/evolution
npm run intelligence -- query --input .local/delivery/project.candidate.json --out .local/public-context
npm run intelligence:mcp -- .local/delivery/project.candidate.json
```

Graph imports and reimports are private proposals; review `proposal.patch.json` in JSON / AI. Generation comparison does not execute tombstones. The browser can browse a large selected file and create a bounded partial selection; the CLI requires a scoped input within Project limits. Declared environments, artifacts and instances are separate from source branches. A `diagramcloud.delivery-brief/1` cannot create or review observations. Use the versioned examples rather than writing observed claims. The `deployment` figure groups declared instances by environment when those facts exist; its runtime remains unknown.

Project Evolution in Edit compares a selected previous authoring backup locally; it does not import it. Comparison JSON is private. MCP stdout is JSON-RPC over stdio (protocol 2025-06-18); the process reads one selected document at startup and exposes seven public query/render/proposal tools. An explicit optional startup analysis bundle adds a private bounded author-context tool. It cannot read arbitrary files or execute checks. MCP clients must initialize before calling tools. See `docs/product/CAMPAIGN_CLIENT.md` for supported source versions, limits and missing capabilities.

| Need | File |
|---|---|
| Document contract, validation | `src/core/model.ts` |
| Public redaction | `src/core/operations.ts` (`publicDocument`) |
| Patches | `src/core/patch.ts` |
| Scanner | `src/core/scan/` |
| Atlas and manifests | `src/core/atlas/` |
| Renderer-neutral view spec | `src/core/viewspec.ts` |
| Auto layout | `src/core/layout.ts` |
| Figures, suggestions, figure book, deck | `src/export/design/` |
| Design brief | `src/core/designBrief.ts`, `skills/diagramcloud-design/SKILL.md` |
| Contributor rules and current limits | `AGENTS.md` |


### Continuation interfaces (unmerged candidate)

The CLI also accepts `profile`, `bundle`, `deep`, `verification-spec`, `verification-receipt`, `cockpit`, `entity-proposal`, `cross-repository` and `publication`. Each command requires explicitly selected inputs and a new output directory. `deep` takes `{files, profile, repositoryId, revision}` and uses installed or packaged local WASM grammars; it never compiles or executes source. `bundle` has the same selected-source identity and generates lexical source analysis, separate from the bounded authoring Project. Read `docs/product/CAMPAIGN_CLIENT.md` for arguments and supported formats.

MCP defaults to seven public-only Project tools. Optional startup `--analysis <selected-analysis-bundle.json>` adds one private author-context query, only for that explicitly selected, validated bundle. Neither mode accepts filesystem paths as tool arguments or collects another source. Entity, design, project, publication and NOT_RUN verification tools produce proposals. Receipt/cockpit imports stage private, unreviewed observations through patches; the author decides review, visibility and sharing in Edit.

A `diagramcloud.publication-brief/1` holds existing public view/story selection, audience, detail, paper size and rendering profile. It changes presentation only. Immutable public library snapshots retain independent source revisions; collections never flatten repository identities or manufacture one project SHA. Custom icon references use a scoped existing raster asset with recorded rights; inspect the public artwork fidelity ledger before sharing.

Saved collection/publication links are local stable identities: `?collection=<saved-id>` or `?publication=<saved-id>`, with at most one library target and optional project context. They resolve only through validated local IndexedDB records; missing targets report unavailable and never inject frozen outputs into editable projects. The publication `digest` covers its public document; `outputDigest` additionally binds normalized header/brief/time/ID/revision vector. Older records are explicitly `legacy-unbound`. Neither digest is an external verification or signature.

The Details panel offers **Pin context** to retain its explanatory selection while the canvas and canonical editor follow another component. **Follow selection** resumes the active selection. Pins are session pointers to current canonical IDs, not saved facts or Project fields; removed or private targets become unavailable in the current audience. Reload starts in Follow. See `docs/contracts/context-pin.md`. Its Evidence tab also offers a **Completion request**, using the context actually displayed. Choose an existing component or view, write a question, select the audience, prepare the bounded context and inspect it before confirming disclosure. Downloading or copying is a manual exchange; DiagramCloud does not transmit the context or call an assistant. The derived `diagramcloud.selected-context/1` includes its base project revision, explicit source references, permitted fields, omissions and budgets. It is not an authoring document or an importable permission.

The local Studio layout provides **Hide/Show sidebar**, **Hide/Show details** and **Reset workspace layout**, outside the hideable panels in every presentation profile. **Panel placement and widths** uses native keyboard controls to move the whole canonical sidebar left/right and size it (220–420 px) and Details (260–480 px). At 1200 px or less the visible panels stack; requested desktop choices resume when space allows. Collapse keeps filter and Pin state mounted; the existing **Close details** still ends the pinned context. Changes remain temporary until **Save placement and widths** stores only the side and requested widths for this project/host in this browser's existing localStorage. Saved physical choices load on project/host entry or reload. **Load saved placement and widths** preserves current collapse, selection and Pin; **Reset workspace layout** also replaces an existing saved record with defaults, without enrolling a never-saved session. Corrupt/blocked storage falls back with generic warnings and no implicit repair. Other-tab changes notify without moving panels; the last explicit preference save wins, with no atomic conflict guarantee or synchronization. Layout never edits/selects a Project component; hidden panels still receive the current privacy projection. Do not put UI preferences into Project, patches or authoring backups. Collapse and context stay temporary, and the presentation-profile storage contract is unchanged. Separate docking, semantic saved views and installed-host parity remain open. See `docs/contracts/studio-layout.md`; runtime qualification is recorded separately from this interface description.

**Relationships** lists canonical connections once each, with exact endpoint IDs, kind, basis, supplied quantity/provenance and every permitted view membership. Native Previous/Next controls expose 50 rows per page and totals for the permitted scope; the table scrolls locally on small screens. Public filtering precedes scope, counts and source lookup. An explicitly unavailable or empty repository selector never falls back to the whole project. Endpoint citations are context, not independent proof of a connection; missing connection-level sources/confidence stay unknown. Paging and row details do not select or edit. Existing view buttons still navigate normally and may clear the active selection. See `docs/contracts/navigation-relations.md`.

**Browse existing recipes and patterns** filters visible cards by static title/ID, recipe question, authored topic key, the two existing entry lists and supplied/missing guidance. It does not search project labels, evidence or match reasons, change rankings or configure an analysis profile. **Reset catalogue filters** restores all entries; a project or public/author transition resets temporary filters. Missing matches or guidance do not establish incompatibility. Domain/platform/workload taxonomies, maintained source updates and reference-instance mappings remain open. See `docs/contracts/pattern-guidance.md`.

**Public JSON** and explicit **Authoring JSON / Download backup** do not require icon loading; other formats that do not consume IconData also proceed independently. Public exports still redact through their existing producers. Authoring JSON is the explicit full private backup, including unsaved in-memory edits, sources and evidence; inspect its destination before sharing. SVG/PNG/HTML and the existing editable/deck exporters that consume vendor bytes retain the same icon-loading behavior and artwork. This is local file recovery, not synchronization or publication. See `docs/contracts/export-recovery.md`.

After normal JSON/source-structure validation, the Galaxy-map consumer rejects more than 40 apps before local identity, membership or connection resolution; it never silently selects the first 40. It also refuses repeated exact `apps[].id` values within supported scope. Both rejection messages omit source IDs, names and paths. Distinct source IDs can still have identical labels or colliding slugs; their existing local suffix mapping remains input-order dependent and is not a persistent identity across imports. Old snapshots lack the source app identity needed to repair that ambiguity without guessing. Use an unambiguous authorized source and the normal preview/review/Apply path; reading a map neither scans its members nor verifies runtime. See `docs/contracts/galaxy-manifest-identity.md`.

**Sources & Bridge** is a read-only disclosure in Structure/Evidence outputs, selected or pinned context Evidence, and a configured analysis result. It distinguishes the existing acquisition receipt from a transient configured bundle: requested profile versus returned output, source revision hints versus consumer versions, aggregate digests versus supplied per-file SHA-256, and read admission versus unknown coverage. Each configured source row keeps its repository and source IDs; identical filenames, revisions or bytes never join repositories. Explicit repository receipts do not fall back to global context, and a transient bundle cannot be combined with a repository selector. Public mode returns a constant private-metadata-unavailable message before reading private metadata; ordinary public citations remain in their source lists. Producer versions, original input contract, freshness and unavailable hashes stay UNKNOWN. This creates no stored facts or new analyzer; modern v5 conversion, live sidecar session state and missing GraphSnapshot source-ref retention remain open. See `docs/contracts/source-bridge-status.md`.

The local React source entry `src/react/index.ts` exports `DiagramCloudViewer`, `REACT_VIEWER_API_VERSION` (1) and its selection/intent types. Supply an immutable canonical document, explicit nonempty `allowedViewIds` and controlled `{projectId,baseRevision,viewId,nodeId? or edgeId?}` selection. It validates the document and public projection before rendering the permitted closure. Selection, child/parent navigation and source opening emit only bounded ID/revision intents through callbacks supplied by the host; they do not open files or mutate the Project. The host owns any separate reviewed edit transaction. Unsupported inputs or targets return one generic unavailable state. Old bindings cannot deliver into replaced documents, narrowed scopes or withdrawn callbacks. The viewer uses generic glyphs and visibly omits repository revision vectors, deployment/workspace context and custom artwork. For a selected component or view, its manual public file uses the existing Completion Kit producer, `diagramcloud.selected-context/1` schema, safety checks, byte limits and omissions; selected connections explicitly have no file fallback. It sends nothing and applies no response. The test-only independently compiled consumer is outside the Studio production routes. This source entry is not a published package or an installed host; runtime qualification is recorded separately. See `docs/contracts/react-viewer.md`.

Guided also offers the original r3 **Petit client sans outils** as a private workflow template. **Load private workflow template** only fills the ProjectBrief editor with a new local instance ID; it never replaces the open project. Inspect the supplied inputs, outputs, constraints and three unknowns, then use the ordinary Preview/review/Apply path. Scope and relation IDs remain stable, query and control stay distinct, and the compiled result remains a private synthetic definition with no occurrence or external observation. The source card records the exact original archive entry and hash. See `docs/contracts/workflow-templates.md`; the other seven workflow documents and real-client qualification remain open. Those seven supplied owner documents are private: compatible selected-file import does not authorize including their bytes or names in public examples or application bundles.

For draw.io quantities, an absent or blank numeric declaration must not become a known zero. The adapter now omits invalid declarations with a counted generic loss; nonzero values that underflow to zero are invalid too. An explicitly supplied zero and representable positive subnormal values remain supported, with their original unit vocabulary, provenance and note. Inspect the loss report before applying. This changes neither the canonical quantity schema nor the missing Agent/Config usage contract. See `docs/contracts/quantity-import.md`.

The existing **Recipe and pattern workbench** has authored guidance for medallion, C4 context, modular monolith and event-driven patterns, and the jobs recipe: problem, conditions to assess, contraindications, alternatives, tradeoffs, level questions and documentation sources. The three new cards use the existing `c4`, `modular-monolith` and `event` pattern IDs/version1; no match rule changes. Applicability stays UNKNOWN; pattern matches remain candidates. Static documentation citations, their retrieval/update dates, packet research and authored content dates, and unknown external revision are separate from this project's evidence and installed versions. Synthetic input/output examples define questions; they create no occurrence, retry, source, observation or runtime guarantee. Repository/environment preview selectors constrain recipes; the pattern comparisons, learning links and audit are explicitly project-wide within the supplied public/author projection. **Open existing view** opens a supplied view, never creates a reference or mapping. The existing recipes query carries optional guidance; no new command or Project field is added. See `docs/contracts/pattern-guidance.md`; migration/API/IaC/observability topics, provenance-bearing reference-instance mappings and broader catalogue coverage remain open. Current qualification belongs to the source-bound continuation report, never to the presence of a card.

Return an ordinary `diagramcloud.patch` version 1, using only the request's permitted stable-ID paths. Its summary must follow `Provenance: author candidate; Sources: <supplied IDs separated by commas, or none>; Limits: <nonblank limitation>`. The initial policy permits selected component captions and, in author context only, eligible unshared author text. Public requests permit only nonempty projected caption fields, so empty and source-redacted captions remain indistinguishable and cannot overwrite hidden authoring text. It cannot change facts, observations, status, references, visibility, sharing or review. A test-only `/revision` patch is abstention. Use **Review completion response**, validate, inspect the existing diff, then let the human author apply. Wrong scope, an unknown source or a stale base is refused without mutation; Apply validates the captured request again against the live project. See `docs/contracts/completion-kit.md`. This local workflow does not supply cross-host draft persistence, live MCP authoring or automatic approval.


### Standalone session return and saved semantics

Studio Back/Forward remembers the current diagram path, active view, component or connection selection, and visible overview/structure/relationships/evidence sheet. These are up to 50 session entries, independent of authoring Undo/Redo. Returning stops transient story playback and uses current permitted document facts; it never rolls back a revision, applies a patch, switches modes or restores a Pin. A selected parent may already have its child open. New root-level component selection still truncates descendants normally; returning only restores a previously recorded valid chain.

Each return checks exact current view/node/edge membership and every parent→child link. An orphan/removed/private target is unavailable, with no redirect or source text in the notice; only that invalid transient entry is removed, allowing another Back/Forward. A project or author/public boundary starts fresh history before controls can replay old pointers. A same-ID target that remains valid after an edit opens the current revision, not cached historical evidence. Source/repository context continues to derive from the live selection and view.

This history is not stored or included in JSON/exports. Browser-local saved placement/widths and the UI profile remain physical preferences. Existing `Project.views` and authored `Project.story` provide durable semantics through the validated document and save/backup paths; a story is still a presentation narrative, not an implicit private bookmark. Named saved navigation variants and compact/full/host transport remain partial/open. A link, Pin, history entry or saved panel preference never grants access or authorizes edits, collection, execution or publication.


### Edit the text of an existing view

In Edit mode, use **Edit view details** below a canvas heading to draft its existing title and description (the author's stated purpose). Apply validates a nonblank title of 1–160 characters and description of at most 2000 characters. It preserves valid text exactly; nothing is trimmed or truncated. Apply changes only those two fields through one normal Undo/save operation. Applying unchanged text creates no edit. Cancel or Escape discards the draft and saves nothing.

The draft belongs to one current Project object, view, revision and authoring/navigation context. Project replacement, Undo/Redo, a different active selection/view/sheet, mode or modal change invalidates it; stale Apply is refused against live state. Layout and Pin are independent. Stable IDs, memberships, perspective, design, positions, visibility, sources, observations and story are unchanged. Public output still uses publicDocument; a private view does not become public by changing its text. Authoring JSON is the explicit full private backup. Existing save/conflict/recovery behavior remains in force.

Authoring is refused outside the live diagram, in Diagram Design/task workspaces or while a modal is open. The optional Canvas edit callback is supplied only by Studio Edit; Explore/Portfolio/Present and the standalone controlled public React viewer remain read-only. Canonical view text is durable authored explanation, not evidence of an observed result or a saved navigation bookmark. Complete saved context, revision/environment/variant/host transport and broader V2 work remain unfinished. Existing placed labels and parallel edge hitboxes can obscure a short connection; the navigation QA fixture widening did not improve that renderer behavior.


The Edit-mode publication library can review and restore an explicitly selected `diagramcloud.publication-snapshot/1` JSON into the existing immutable local library. This bounded file route accepts only validated public structured snapshots without assets, experience workspaces or observations, and refuses known sensitive text. It does not strip unsupported fields or manufacture new hashes. Generic JSON / AI remains the separate Project/patch/Graph/Galaxy importer; a frozen publication never becomes an editable Project. Existing publication Open regenerates a handbook with the installed trusted producer; imported HTML, scripts, iframe contents and blobs are never executed. Restoring inputs does not reproduce historical HTML bytes or authenticate a producer.

Review shows the supplied stable identity, document/output binding, selected views and independent source revisions. Choose **Restore reviewed publication** explicitly, or Cancel. Changing file/project/revision, leaving Edit or entering public mode revokes pending preparation. An identical already-present record is a no-op; an ID collision refuses replacement, preserving the old link. A confirmed transaction that already committed is not described as rolled back. Legacy output remains `legacy-unbound`, missing source revisions stay UNKNOWN and this local file route is not remote publication, cloud synchronization or original source-vector `v2:recovery`. Original V2 library/publication/private-audience clauses and all eight workstreams remain PARTIAL.


### Reuse one canonical component in existing views

In Studio Edit, **Reuse existing component** opens an explicit chooser below the current canvas heading. Select **Component to reuse** by its stable ID and choose **Apply component reuse**, or Cancel/Escape. This adds that same component ID and one position to this existing view; it does not duplicate the component, add connections, change its facts or invent a view. The new position is the centre of this canvas viewport converted through its current pan/zoom at Apply. Other positions stay intact; existing filters can still hide the component and ordinary Fit/layout controls remain available.

The live Project, revision, view and authoring/navigation context must still match. Mode/modal/project/view changes revoke the draft. Invalid membership or recursive drilldown is refused through the existing validator, with no mutation. One accepted change uses ordinary Undo/save; an already-present component is a no-op. Visibility, evidence/source IDs, designed status and observations remain as authored. Adding an already-public component to a reachable public view can include its existing public evidence in an export, so review the disclosure before Apply. The standalone controlled React viewer gets no authoring callback.

When a perspective offers several reachable views of the selected component, its native **choose view** disclosure lists the supplied titles and stable view IDs. Pick an existing target explicitly. A single target keeps its direct button; partial/unknown/unsupported retain their meanings. The permitted current document supplies the choices, so public modes do not reveal private views. Selection changes navigation only: no source association, architecture, history claim or access grant is inferred. Full cross-project identity/reuse and saved semantic variants remain open.


### Inspect a selected connection without editing

In Studio Explore, activate a connection or its native **Select connection** placed-label button to read **Connection details** in Inspector. Enter/Space work on the label button. Portfolio/Present use only the permitted public projection. The summary shows exact current connection/endpoint IDs, native kind, supplied basis, quantity including zero and its provenance, current view memberships and endpoint citations as context only. Missing quantities or semantics remain UNKNOWN; a static or planned connection is never observed runtime, and a synthetic quantity is never measured. Read-only inspection exposes no Apply/Delete or observation review action. Edit still opens the existing connection editor.

A selected connection must actually belong to the current reachable permitted view with both endpoints. Unknown/private/deleted/unplaced/out-of-view targets show a generic unavailable state; no fallback view or parent is invented. The complete **Relationships** table still exposes unplaced authoring facts in its existing rows without a new selection route. Pin remains independent node/view context; inspection and Back/Forward do not change canonical JSON, revisions, authoring Undo, source scope, modes or layout preferences. This local summary does not expand the standalone controlled React viewer API, producer relation semantics or installed host permissions. See `docs/contracts/navigation-relations.md`.

## Remove a component from one existing view

In Edit on a displayed diagram, choose **Remove from this view**, select the exact existing component ID, then **Review view removal**. Review the view, component and incident connection memberships before **Apply view removal**; Cancel or Escape changes nothing. This is presentation membership only. Global **Delete component** still deletes globally and must not be used as a substitute.

Canonical components/connections, other views, evidence, sources, quantities and observations stay intact. Story/focal dependencies, newly unreachable child views in either the authoring or public projection and an invalid retained parent path refuse without automatic rewriting; use existing author controls to resolve dependencies and start a fresh review. Public exports still call `publicDocument`: unplaced public content may be omitted without deleting authoring facts. No observation becomes reviewed/shareable through membership editing. A successful change has one ordinary Undo/save; obsolete review intents cannot overwrite a newer document or mode. No new CLI/JSON format, public React authoring callback or source/owner grant is introduced. Qualification belongs to the exact reviewed source and its recorded gates.


## General authoring: supplied inputs and retained diagnostics

These controls belong to the selected applied General Authoring source. Its exact-source qualification is recorded separately; no dated checkpoint qualifies later code. All eight V2 workstreams remain PARTIAL.

In Edit on a displayed diagram, **Remove from this view** lets you select an existing component, then **Review view removal** before **Apply view removal**. **Cancel view removal** or Escape changes nothing. This removes only the reviewed view membership/position and incident connection memberships in that view; global **Delete component** remains distinct. Dependencies and newly unreachable child views in either the authoring or public projection refuse without automatic repairs. Live project/revision/view/mode guards and ordinary Undo/save remain required. Existing components, canonical connections, other memberships, sources, quantities, observations and visibility are retained.

In Explore, choose **Business overview**, open **Illustrative architecture pattern catalog**, then **Inputs behind this suggestion** on an existing pattern. Read the supplied component contributors, canonical connections between kind-matched components and current contributor citations in separate tables. Every required kind must be supplied; any required tag may occur elsewhere in the permitted Project, so an unrelated component can contribute a tag. This explains the unchanged coarse matcher, without creating an approved reference-instance mapping or applicability, confidence or runtime proof. **Previous** and **Next** page the current component, connection and citation tables with exact displayed/omitted counts. All original evidence requirements remain unestablished questions. Static authored guidance/documentation sources are separate from current Project citations. Reading or paging changes no Project, profile, source or observation.

In **Sources & Bridge**, open **Producer-supplied diagnostic causes** and use **Next diagnostics** / **Previous diagnostics** to read retained rows, eight per page. Page counts describe retained validated diagnostics only. Producer-omitted diagnostics cannot be recovered or inferred by paging. Only a supplied typed cause provides cause-specific advice; legacy prose remains unclassified, and every suggestion is inert. No source lookup, acquisition, repair, retry, permission grant or external action runs. Public mode reports the existing constant private-metadata-unavailable state before private readers and reveals no private diagnostic count or validity. Project/scope/revision/public changes reset transient paging; stale rows are not resurrected.

These local gestures do not supply source-vector recovery, cross-project identity/namespace association, durable semantic saved views, owner adoption or installed host permissions. Original98references/152rows remain acceptance provenance, not grants or full V2 certification. Public exports call `publicDocument`; the explicit full Authoring JSON backup remains private authoring data.


## Existing workspace views and retained assertions

In the authoring Library, expand Existing workspace views to browse supplied reachable views across the currently loaded projects. Open view uses the current canonical project/view IDs and a permitted parent path. Copy view link reuses the existing local URL fields; a link resolves the current browser document and does not restore an immutable historical revision, another device, Pin, layout or a complete saved semantic context. Bundled examples are not presumed saved. Unavailable clipboard access leaves an ordinary copyable link and reports the limitation. Browsing, opening and copying do not create a project, revision or stored context.

The private Graph explorer offers Retained source assertions alongside its existing component table and bounded chain. Its pages disclose the selected retained generation's exact assertion IDs, endpoint IDs, family, source-declared origin and direct citation IDs. Endpoint citations do not substitute for missing assertion citations. Missing full predicates, observation/validity times and confidence remain UNKNOWN. A source category such as OBSERVED is not a reviewed DiagramCloud observation. Paging does not recover producer omissions, collect usage, execute code or contact another application. Public output continues through publicDocument.

These are bounded local capabilities. Full named semantic contexts, installed host parity, authoritative usage/counter semantics, original source-vector recovery and external adoption remain open. All eight V2 workstreams remain PARTIAL.


## Manual quantity fidelity

The existing Technical manual (HTML / PDF) export keeps each connection stable ID and supplied quantity value, unit, canonical provenance and optional note in compact tables and dense/full keyed tables. An explicit zero stays zero; a missing quantity says Not supplied. Notes are escaped text, including markup-like strings; units and provenance are not normalized or relabelled as measured results. Public filtering and selected chapter boundaries run before publication, and omitted private facts remain omitted. Synthetic declarations stay synthetic. No observations, timing, totals across units or executed transformations are inferred. The same static offline HTML is the print source for A4 or Letter; browser print layout and actual PDF all-page review are separate evidence. See docs/contracts/export-recovery.md. This applied slice remains pending exact-source qualification; all eight V2 workstreams remain PARTIAL.
