# The 1.24 release contract

This is the code-lead release cut, not a menu of open choices. Complete the mandatory user journeys; keep deferred research in the backlog. Do not stop after writing another plan or shipping only the readiness inspector.

## Mandatory user journeys

### 1. Understand an arbitrary selected Git folder

From New analysis, source = Repository, purpose = Understand, depth = Standard by default. Inspect a user-selected local folder, not a whole GitHub account. Resolve metadata under the selected root, respect current nested-repository/secret exclusions, and never execute files in the analyzed repository.

Return four useful outputs:
1. Overview: root project, detected technologies and exactly what was scanned.
2. Structure: bounded folder/module tree, with a path back to the selected source.
3. Relationships: reuse strongest available typed relations. With none, explain that no relationship was established. Do not manufacture arrows or microservices.
4. Evidence/gaps: data provenance, inspected scope, unsupported/ignored files, contextual questions, source freshness.

A Markdown-only repo, a five-file unknown-language repo, or a script with no manifests must open successfully. An empty folder is an understandable empty state, not a crash. Expected content below an ignored nested `.git` is not silently analyzed as this repo.

### 2. Describe a project without Git

Source = Guided. Import/paste the ProjectBrief example or enter its core fields through a small form. Compile with `compileProjectBrief`, preview, apply once, save/reload through existing Project storage. Navigate workstream -> system/task, open evidence/task workspace where supplied. Render a Project Overview business sheet from the same facts. No repo, model account or cloud credentials required.

Existing `Project.experience` can already represent organization/project/workstream/subsystem/task. Reuse it where valuable; do not create a third entity registry. A task is not mechanically inferred from a filename.

### 3. Explain an explicitly declared multi-repo project

Source = Hybrid. Brief/manifest declares exactly three or more repository identities, their logical bindings and declared inter-repo relations. Reuse `briefManifest` and the existing `documentFromAtlas`/`rescanRepository` flow. Each selected repo keeps its own revision, scan status and source vector. Unavailable members remain declared/unscanned; they do not block views for available members.

For 1.24, correlate only explicit IDs/membership/bindings. Label human relationships declared; keep static findings alongside rather than upgrading them. Do NOT infer a service call because two repos mention the same cloud, database driver or word `api`. A complete cross-repo static resolver is deferred.

### 4. Understand selected project documentation

Use the new `mapDocuments` after metadata/path/budget/safety filtering. Map Markdown sections and exact relative doc links. CSV source_ids resolves only unique records from selected sources.csv, with exact row/line references. Show broken/ambiguous/out-of-scope links honestly. Do not treat historical/current filenames, free-form prose or status words as an accepted architecture decision.

Initially render a bounded document inventory + provenance links using the existing tree/matrix/architecture renderers. Source snippets are inert, escaped, private by default. Link to exact source location, never perform an arbitrary filesystem/network fetch from an imported locator. Do not feed untrusted document text into system/tool instructions.

### 5. Prepare and publish a small deliverable

Business Project Overview: purpose, scope, 3-5 steps/components, stated contributions/owners where supplied, evidence and caveats. Use existing experience items/export machinery or simple semantic HTML; do not add a chart engine. Existing Classic/Editorial/Blueprint/Mosaic concept exports remain intact.

Private preview and public export are different operations. Public filtering occurs BEFORE summaries, counts, prompts, graphs, metadata, CSV asset manifests and navigation entries. A private source cannot leak through a public node's caption/hover. No renderer or model invents exact numerical results.

Provide offline HTML/public JSON through existing paths, with the diagram/sheet and provenance visible. Keep native/editable vs rasterized PPTX distinctions. No remote asset fetch while generating a public deliverable.

### 6. Prepare graphics without an agent

Use the existing icon registry. Unknown icons fall back safely. Export asset-plan JSON/CSV with which node uses which asset and why. Original/generic/provider/project illustration are distinct. A known provider without an approved exact icon is still drawn with a generic symbol and label.

No public R2 bucket, new token, asset upload, automatic image generation or fake official logo is part of 1.24. The plan is useful offline. Missing graphical assets and missing information are separate gap classes.

## Interaction contract

Left: switch Project / Repositories / Views. Do not open all three trees at once.
Center: current diagram OR business/document sheet; breadcrumb/back/forward and existing minimap.
Right: optional details with Evidence / Gaps / Assets. Do not add a permanent AI chat panel.

Navigation stores selection/scope, not a duplicate graph. Collapsing a group does not delete its entities. Project and physical trees retain distinct identities and bindings. Restore the previous view/viewport on back where already supported; no rewrite of the docking/window manager. On narrow screens only one side drawer opens at once.

First use offers source/purpose; depth is a small secondary control. Advanced options remain collapsed. `Quick` and `Standard` must actually affect budgets/selected detail. Do not show an enabled Deep/Autonomous control that does nothing. Language/technical names remain accurate; reuse the existing English UI for this release.

## Non-goals and preserved future seams

| Later feature | Seam to preserve now | Not required for 1.24 |
|---|---|---|
| Environments / deployments | explicit environment IDs; logical component vs instance distinction | live accounts, promotion execution, drift engine |
| Evolution | snapshot ID, inventory completeness, revision vector, stable entity IDs | continuous monitoring or full Git history |
| Domain scanners | pure input -> facts/diagnostics adapter function | all Fabric, TMDL, Bicep, C#, Databricks, dbt parsers |
| Agentic | inspectable JSON, context-relative gaps, existing reviewed patch | internal shell, remote MCP service, new agent runtime |
| IsoSVG | existing ViewSpec/scene, structural depth only | WebGL, independent scene database, arbitrary 3D art |
| R2 / image generation | existing normalized asset cache and registry boundaries | cloud/backend provisioning or vendor/model SDK |
| Collections | explicit project summaries / links | flatten every project into one mega graph |
| Security / operations | optional typed source refs and unknowns | certify IAM/SLO/DR/cost/tenancy from a source scan |

Ordinary version differences between dev and prod are not automatically drift. Branch != environment; Bronze/Silver/Gold != environment; beta/stable release channels != deployment environments. A `prod.yaml` declaration is not an observed deployment. No assumption that all projects need all these dimensions.

## Definition of done

- All six journeys implemented (not placeholder controls).
- Existing imports, sidecars, public projection, workspaces and exports retained.
- Current typecheck, unit suite, build and Chromium suite pass on the exact candidate revision, plus short visual review of the new screens.
- Three synthetic end-to-end scenarios suffice initially: unknown/docs-only; Guided project; Hybrid multi-repo. Negative safety cases live in focused unit tests.
- Candidate is packaged, version/lockfile/release notes updated to 1.24.0 only after the journeys work.
- Continue normal repo PR/merge/tag/release policy; no forced merge/protection changes. Observe existing deployment if it runs, and distinguish merged vs deployed vs smoke-checked.
- If actual permissions/credentials/environment block release, retain passing code and report the exact blocker. Do not ask the owner to choose module names or perform routine fixes.
