# Claude continuation — DiagramCloud Pro + DataPass bridge

Date: 2026-09-24  
Primary repo: `julian-passebecq/diagramcloud`  
Working branch: `feat/diagramcloud-experience-pro-pass`  
Stacked base: `feat/project-constellation-v1.4`  
Draft PR: #6

## Start here

Do not redesign the website shell and do not restart the project.

Read, in this order:

1. `docs/pro-pass/START_HERE.md`
2. this file
3. `docs/contracts/datapass-diagramcloud-bridge.lock.json`
4. the pinned DataPass contract from that lock
5. current failing Playwright tests / CI logs

Last code commit before the contract/handoff-only continuation:

`8cc03637a84ad15e470d185b20c6a4d1aa29000d`

Docs-only commits may appear after that SHA. The product/code blocker described below still refers to the code at 8cc0363 unless a later code commit explicitly fixes it.

## Product vision

DiagramCloud is an **interactive project-experience atlas**:

```text
organization / company
        ↓
project
        ↓
architecture
        ↓
system / component
        ↓
task
        ↓
workspace
        ↓
reusable evidence items
        ↓
custom portfolio board
        ↓
HTML / PNG / PDF / PPTX
        ↓
optional Penpot / Canva polish
```

Architecture is navigation, not the final output.

The task/workspace layer is where code, tables, charts, screenshots, Gantt, semantic-model evidence, experiment tables and explanations can be presented like a reconstructed application/workbench.

Keep JSON/stable IDs as the controllable grammar. ChatGPT/Claude must be able to export/import reviewed structured changes.

## Product ownership

### DataPass VS Code owns

- organization/project/work-scope context;
- repository bindings;
- provider/resource bindings;
- readiness/status;
- official-tool routing;
- company/domain-pack configuration;
- sanitized AI context export;
- reviewed AI plan import;
- explicit application of project file changes.

### DiagramCloud owns

- interactive architecture;
- drilldown/navigation;
- task storytelling;
- reusable evidence items;
- task workspaces;
- custom portfolio boards;
- public/private/provenance presentation;
- publication views.

Do not merge the two products.

## Canonical bridge contract

The cross-product bridge is canonical in:

`julian-passebecq/datapass-vscode`

Draft contract PR:

**DataPass PR #9 — Define DataPass ↔ DiagramCloud bridge V1 contract**

Pinned revision:

`fde955ab4617ef0a9c6c82ac6727fad14cf67a81`

Canonical paths at that revision:

```text
contracts/diagramcloud/README.md
contracts/diagramcloud/datapass-ai-context-v1.schema.json
contracts/diagramcloud/datapass-ai-plan-v1.schema.json
handoff/DIAGRAMCLOUD_BRIDGE_V1.md
```

DiagramCloud pins that revision in:

`docs/contracts/datapass-diagramcloud-bridge.lock.json`

When DataPass PR #9 is merged, update the DiagramCloud lock to the final merged contract commit rather than tracking `main` implicitly.

## Where project data lives

For an ordinary project repository:

```text
<project repository>/
└── .datapass/
    ├── project.json
    └── diagramcloud.json
```

### `.datapass/project.json`

Owned by DataPass.

Current manifest schema:

`julian-passebecq/datapass-vscode/schemas/datapass-project.schema.json`

Stores project identity, safe repository/platform configuration and links.

No credentials/secrets.

### `.datapass/diagramcloud.json`

Owned by DiagramCloud's document schema but discovered/routed by DataPass.

One file contains the DiagramCloud project document plus optional embedded `experience` pack.

This is the Bridge V1 decision.

**Do not create separate canonical `architecture.json` and `experience.json` files.**

The current DiagramCloud project model already validates the embedded experience pack.

### AI exchange

Generated exchange files may be written temporarily as:

```text
.datapass/ai/context.json
.datapass/ai/plan.json
```

They are not another source of truth and should not be committed by default.

The durable truth remains:

- `.datapass/project.json`
- `.datapass/diagramcloud.json`
- source repositories/provider state

## Company/project customization

Use the DataPass V2.1 architecture rule:

```text
generic core + provider adapter + optional domain pack
```

FOIL-specific forms, units, engineering evidence labels or case semantics belong in a FOIL domain pack.

DiagramCloud consumes reviewed generic entities/tasks/evidence. It does not execute the domain pack.

Do not hard-code one fixed company hierarchy into the DiagramCloud schema.

## Immediate blocker — fix this before adding more features

Current exact code head 8cc0363:

- TypeScript: passes.
- Unit tests: pass.
- Production build: passes.
- Browser tests: **5 fail / 11 pass**.

Failing tests:

```text
tests/e2e/experience.spec.ts
- in-app workspace drills into SQL task and remixes shared items
- experience mini document, panel PNG and stable-ID JSON are downloadable
- architecture nodes open their linked task workspaces directly

tests/e2e/studio.spec.ts
- gallery and three-level drilldown retain the architecture
- edit, undo and persistence survive reload
```

Observed Playwright behavior includes:

```text
<aside class="xp-nav"> ... intercepts pointer events
<button>Project controls</button> ... intercepts pointer events
```

A second semantic conflict exists:

some architecture nodes now have both:

- `childViewId`
- `experienceWorkspaceId`

The current click handler can both drill the underlying architecture path and open the workspace modal.

Old tests still assume that clicking such a node only opens the architecture view.

### Required UX decision

Do not keep ambiguous single-click behavior.

Prefer explicit actions:

```text
node select
├── Explore architecture
└── Open task workspace
```

or an equivalent deterministic pattern.

One click must not silently perform both navigation modes.

Then update the E2E tests to the agreed product semantics.

Do not merely use Playwright `force: true` to hide a real UI overlap.

## Existing Pro implementation that must be preserved

- optional `Project.experience` grammar;
- `experienceWorkspaceId` node linkage;
- note/code/table/KPI/bar-line-chart/Gantt/image items;
- stable item IDs;
- placement separate from item data;
- focus/restore;
- numeric 12-column placement editing;
- two-column and single-column layouts;
- duplicate workspace as board;
- empty custom board;
- removing a placement does not delete the underlying item;
- reusable-item search and type filtering;
- board title/description/visibility;
- bounded image attachment;
- public/private/provenance/approval filtering;
- JSON import/export;
- revision/conflict checking;
- source-derived DataPass Galaxy workspace;
- CodeWiki module-tree importer;
- sanitized DataPass manifest importer;
- per-item PNG/SVG;
- printable mini-document HTML.

## DataPass ↔ DiagramCloud first implementation after CI is green

Do not start GCS/Canva/Penpot first.

### DataPass side

Add project actions:

```text
Open architecture
Copy AI context
Import AI plan
Copy current project/scope summary
```

DataPass should detect by convention:

`.datapass/diagramcloud.json`

No manifest-schema bump is required for the first bridge if convention-based detection is sufficient.

### Context export

Must validate against:

`contracts/diagramcloud/datapass-ai-context-v1.schema.json`

Context is sanitized and bounded.

It may include:

- project identity;
- selected scope;
- safe repo identities/revisions;
- platform readiness;
- current tasks/blockers;
- DiagramCloud document ID/revision.

It must exclude secrets, credentials, unsafe environment values and private machine-specific values.

### AI plan import

Must validate against:

`contracts/diagramcloud/datapass-ai-plan-v1.schema.json`

Required sequence:

```text
parse
→ schema validate
→ base-revision check
→ human diff
→ selective approval
→ apply file changes
```

No AI plan implies automatic cloud mutation.

### DiagramCloud side

Open/validate `.datapass/diagramcloud.json`.

Do not allow DataPass to silently push unvalidated internal objects into React state.

## PDFs — which files Claude actually needs

The written docs describe the component grammar extensively, but they do **not** replace the original visuals when doing UI/layout fidelity work.

### PDF 1 — give this to Claude for workspace/component/UI work

**Required visual reference:**

`Julian_Passebecq_Portfolio_TotalEnergies_First_NoGlossary (2)(1).pdf`

18 pages.

This is the most important PDF because it demonstrates the broad component vocabulary:

- architecture/process views;
- KPI/report layouts;
- production charts/distributions;
- semantic model;
- DAX + SQL areas;
- Gantt;
- CAPEX/OPEX/cash-flow;
- notebook/job/MLflow-style screens;
- scientific curves/sensitivity/maps;
- Streamlit-style scenario screen;
- medallion/table/monitoring views.

Use the actual PDF when implementing layout/component fidelity.

Do **not** commit this PDF to the public GitHub repository.

Upload it directly to Claude's conversation or provide it through the private handoff package.

### PDF 2 — give this when implementing compact Total/Foil stories

`Total_Foilo_Portfolio_6_pages (2)(1).pdf`

6 pages.

Useful for:

- compact TotalEnergies business-input → Excel → Oracle → SQL checks → reporting story;
- schedule/Gantt;
- CAPEX view;
- Foil compact walkthrough.

It is not necessary to fix CI or implement the DataPass bridge contract.

Again, do not commit the private source PDF to public Git.

### If Claude only fixes the blocker/bridge

No PDF is required.

The repository docs are sufficient for:

- the E2E interaction fix;
- contract implementation;
- JSON bridge;
- DataPass commands;
- source ownership.

### If Claude designs native report/workspace components

Give the 18-page PDF first.

Give the 6-page PDF second if compact portfolio-story fidelity matters.

## CodeWiki / Penpot / OpenDesign roles

### CodeWiki

Use as a repository-analysis **input**:

```text
repo
→ dependency/module facts
→ reviewed mapping
→ DiagramCloud architecture/tasks
```

A code module is not automatically a business task.

Do not make DiagramCloud another CodeWiki UI.

### Penpot

Long-term peer/integration for rich design/publication.

Relevant concepts:

- open design representation;
- SVG/CSS/HTML/JSON;
- components/variants;
- design tokens;
- grid/flex;
- plugin/API/MCP ecosystem.

Do not fork Penpot into DiagramCloud as the next step.

### OpenDesign

Lightweight Fabric.js interaction donor/reference for future mini-canvas editing.

Useful for object manipulation, templates, image/text placement and agent-friendly explicit controls.

Not required for the first stable task/workspace/bridge release.

### Canva

Optional final publication/polish layer.

Not the canonical DiagramCloud grammar.

## Storage later

Do not block the local/Git vertical slice on storage.

Target after the bridge is reliable:

```text
GCS
  reusable image/PNG/object artifacts

Google Drive
  final PDF/PPTX/CV/portfolio deliverables

BigQuery
  optional artifact catalog/search metadata
```

Project schemas and stable structured state remain in Git.

## Git / PR topology

DiagramCloud:

```text
main
  ↓
PR #5 / feat/project-constellation-v1.4
  ↓
PR #6 / feat/diagramcloud-experience-pro-pass
```

Do not merge PR #6 before its Browser tests are green.

DataPass bridge contract:

```text
datapass-vscode main
  ↓
PR #9 / docs/diagramcloud-bridge-v1
```

Treat PR #9 as the contract branch until reviewed/merged.

DiagramCloud's lock file pins the exact contract commit.

## First Claude session prompt

You are continuing two related repositories, but do not merge their responsibilities.

1. Read DiagramCloud `docs/pro-pass/START_HERE.md`.
2. Read DiagramCloud `docs/pro-pass/CLAUDE_CONTINUATION.md`.
3. Read `docs/contracts/datapass-diagramcloud-bridge.lock.json`.
4. Open the pinned DataPass contract.
5. Inspect PR #6 exact-head Playwright failures.
6. Make the architecture/task navigation semantics explicit so a node does not both drill and open a modal on one ambiguous click.
7. Fix the five E2E failures without weakening assertions with forced clicks.
8. Keep TypeScript, unit tests and build green.
9. Stop and report the resulting interaction contract before beginning the DataPass bridge implementation.
10. Once CI is green, implement the smallest DataPass↔DiagramCloud Bridge V1 vertical slice from DataPass PR #9.

Do not redesign the site, build a Canva/Penpot clone, provision cloud storage, or run autonomous cloud mutations during this first continuation.
