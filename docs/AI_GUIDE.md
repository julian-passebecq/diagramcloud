# DiagramCloud for AI agents

This page is for an AI agent (Claude Code, Codex, any LLM with a shell) that has to graph a repository or a set of projects with DiagramCloud, edit a DiagramCloud document safely, or draw publication figures. Read it once, then work from the command table. The JSON examples on this page are checked by `tests/ai-guide.test.ts` against the real validators, so they are valid as written.

## 1. What DiagramCloud is

- **A document model, not a drawing.** A project is one JSON document (`diagramcloud.json`, schema version 1). It has components (`nodes`), connections (`edges`), views that each show a subset with positions, evidence blocks, sources, a guided story and optional observations. `src/core/model.ts` is the contract and `validateDocument` is the gate: JSON Schema alone (`public/diagramcloud.schema.json`, written by `npm run generate`) is not enough.
- **Facts come from repositories, not from memory.** A deterministic scanner reads a folder (no code run, no network, no secret files) and produces components and links, each with file:line evidence and a confidence. An atlas joins several repositories, each at **its own Git revision**: there is never one project revision.
- **Drawing is a separate layer.** Diagram Design mode renders any public view as one of 20 figure types. You choose the figure through a *design brief*; you never change facts to make a picture look better.
- **Public vs private is enforced.** Every export goes through `publicDocument`, which drops private components, connections, evidence and repositories. Mark something `"visibility": "private"` instead of leaving it out.

## 2. Three meanings you must keep apart

| Meaning | Where it lives | Who sets it |
|---|---|---|
| **Planned / designed** | a component's `status` (`idle`, `running`, `complete`, `warning`, `failed`) and `basis: "planned"` | the author or the manifest |
| **Read from source** | `basis: "static-source"`, scanner evidence with file:line | the scanner |
| **Observed / verified** | `observations` (dated external claims) | a human, through a reviewed patch only |

A scan is never "observed". A status board shows designed status, not reality. Synthetic or illustrative numbers stay labelled `"provenance": "synthetic"` everywhere and are never results.

## 3. Commands

All commands run from the repository root after `npm ci`. They read files and write files; none of them changes the input document.

| Goal | Command | Output |
|---|---|---|
| Graph one repository | `npm run scan -- <folder> --out repo.json [--name "Title"]` | a validated document: system → containers → components → files, data lineage, infrastructure |
| Graph several repositories | write a project manifest (section 4), then `npm run atlas -- project.manifest.json --out atlas.json` | one atlas document, each repository at its own revision |
| See what moved since last time | `npm run atlas -- project.manifest.json --previous atlas.json --out atlas2.json` | a new snapshot; the report lists changed / unchanged / unknown revisions |
| Draw every public view | `npm run design -- doc.json --out figures/` | one SVG per view, `index.html`, `book.html` (figure book) and `suggestions.json` |
| …with your figure choices | add `--brief brief.json` | the brief is applied in memory and its review printed |
| …as PDF | add `--pdf` | `book.pdf` and one PDF per view (offline Chromium; `npx playwright install chromium` once) |
| …one figure type for all | add `--type <type>` and/or `--theme light\|dark\|editorial` | |
| Before / after a rescan | `npm run design -- new.json --delta old.json --out figures/` | Before · Changes · After per view, compared by stable ID |
| Check your edits | `npx tsc --noEmit`, `npm test`, `npm run build`, `npx playwright test` | the qualification a change needs before a PR |

The scanner also skips nested repositories and git worktrees (any sub-folder with its own `.git`, `.claude/worktrees`, `.worktrees`), `node_modules`, build output and secret files.

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
| Where does it run? | `deployment` | providers running 2+ components |
| How much is backed by source? | `matrix` | basis and confidence |
| What touches this part? | `hub` / `radial` | a component with 3+ connections |
| What enters and leaves? | `context` | entry points and sinks |
| Which parts are in which designed state? | `status` | designed statuses |
| Where does this come from and go? | `lineage` | a flow 3+ steps deep |
| How much moves along each connection? | `sankey` | `quantity` on connections |
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
