# Prompt for Claude — continue DiagramCloud Pro and DataPass bridge

You are taking over an existing implementation. Do **not** restart or redesign it from scratch.

## Repositories

### DiagramCloud

Repository: `julian-passebecq/diagramcloud`

Working branch:

`feat/diagramcloud-experience-pro-pass`

Draft PR:

`#6 Pro pass: architecture to task workspaces, reusable items and reviewed JSON imports`

Stacked base:

`feat/project-constellation-v1.4` / PR #5

Read first:

1. `docs/pro-pass/START_HERE.md`
2. `docs/pro-pass/CLAUDE_CONTINUATION.md`
3. `docs/contracts/datapass-diagramcloud-bridge.lock.json`

### DataPass VS Code

Repository: `julian-passebecq/datapass-vscode`

Bridge contract branch:

`docs/diagramcloud-bridge-v1`

Draft PR:

`#9 Define DataPass ↔ DiagramCloud bridge V1 contract`

Read the contract revision pinned by DiagramCloud. Do not silently use a newer unreviewed branch state.

## Product boundary

DataPass VS Code is the real-project/control-plane layer.

It owns:

- organization/project/work-scope context;
- repository/provider bindings;
- readiness/status;
- official-tool routing;
- optional company/domain packs;
- safe AI context export;
- reviewed AI plan import.

DiagramCloud is the interactive project-experience atlas.

It owns:

- architecture;
- drilldown;
- tasks;
- screen-like workspaces;
- reusable evidence items;
- custom portfolio boards;
- publication views.

Do not merge the two products.

## First task — unblock DiagramCloud CI

The last code revision before handoff-only docs is:

`8cc03637a84ad15e470d185b20c6a4d1aa29000d`

At that code revision:

- TypeScript passes.
- Unit tests pass.
- Production build passes.
- Browser tests fail: 5 failed / 11 passed.

Failing suites include:

```text
tests/e2e/experience.spec.ts
- in-app workspace drills into SQL task and remixes shared items
- experience mini document, panel PNG and stable-ID JSON are downloadable
- architecture nodes open their linked task workspaces directly

tests/e2e/studio.spec.ts
- gallery and three-level drilldown retain the architecture
- edit, undo and persistence survive reload
```

Observed Playwright messages include:

```text
<aside class="xp-nav"> ... intercepts pointer events
<button>Project controls</button> ... intercepts pointer events
```

There is also a product-semantics conflict:

some nodes now have both:

- `childViewId`
- `experienceWorkspaceId`

The current click path can both drill into architecture and open the task-workspace modal.

Resolve this deliberately.

Preferred interaction model:

```text
select architecture node
├── Explore architecture
└── Open task workspace
```

or another equally explicit deterministic model.

One click must not silently trigger both navigation modes.

Do not use Playwright `force: true` to hide a real overlap.

Update tests to the chosen product contract and get the exact-head Browser suite green.

Stop and report the resulting interaction contract before beginning broad new UX work.

## Preserve existing Pro functionality

Do not remove:

- `Project.experience`;
- `experienceWorkspaceId`;
- reusable item stable IDs;
- separate item vs placement model;
- note/code/table/KPI/chart/Gantt/image items;
- portfolio remix/custom boards;
- focus/restore;
- numeric placement;
- two-column/single-column presets;
- board duplication;
- remove/re-add-by-reference behavior;
- item search/type filtering;
- board title/description/visibility;
- image attachment;
- public/private/provenance/approval projection;
- JSON import/export and revision guard;
- CodeWiki module-tree importer;
- sanitized DataPass manifest importer;
- DataPass Galaxy source-derived workspace;
- item PNG/SVG;
- mini-document HTML.

## Second task — implement Bridge V1 only after CI is green

Canonical project files:

```text
.datapass/
├── project.json
└── diagramcloud.json
```

Do not create separate canonical `architecture.json` and `experience.json` files.

`.datapass/diagramcloud.json` is one validated DiagramCloud project document including optional embedded experience content.

Implement the smallest useful DataPass actions:

```text
Open architecture
Copy AI context
Import AI plan
Copy current project/scope summary
```

Use the pinned schemas:

- `datapass-ai-context-v1.schema.json`
- `datapass-ai-plan-v1.schema.json`

AI return flow must be:

```text
parse
→ schema validate
→ base-revision check
→ human diff/review
→ selective approval
→ file write
```

No automatic cloud mutation.

No credentials in AI context.

Do not make Bridge V1 depend on a manifest schema bump if convention-based detection of `.datapass/diagramcloud.json` is sufficient.

## PDFs

If your task is only CI/bridge implementation, you do not need a PDF.

If you work on native task-workspace/report component fidelity, ask the user to upload:

**Primary:**
`Julian_Passebecq_Portfolio_TotalEnergies_First_NoGlossary (2)(1).pdf`

This 18-page PDF is the main visual reference for architecture views, KPI dashboards, tables, SQL/DAX areas, semantic model, Gantt, CAPEX/OPEX, notebook/job/MLflow screens, scientific charts and Streamlit-style scenario screens.

For compact TotalEnergies/Foil storytelling, also ask for:

`Total_Foilo_Portfolio_6_pages (2)(1).pdf`

Do not commit the private source PDFs into the public GitHub repositories.

## CodeWiki / Penpot / OpenDesign

CodeWiki:
- repository-analysis input;
- module/dependency facts;
- do not map every code module directly to a business task.

Penpot:
- later rich design/publication peer/integration;
- do not fork it into DiagramCloud now.

OpenDesign:
- later lightweight Fabric.js interaction donor/reference;
- not required for current CI/bridge release.

Canva:
- optional downstream polish/publication;
- not canonical project grammar.

## Storage later

Do not implement this until the local/Git bridge is stable:

- GCS → reusable machine-facing image/object artifacts;
- Google Drive → final PDF/PPTX/CV/portfolio deliverables;
- BigQuery → optional artifact metadata/search catalog.

## Completion for your first pass

Report:

1. exact interaction contract selected;
2. files changed;
3. exact-head CI result;
4. whether PR #6 is safe to review;
5. next smallest Bridge V1 implementation step.

Do not merge PR #6 automatically unless explicitly requested.
