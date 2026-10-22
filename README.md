# DiagramCloud

**Architecture → the work behind it → the evidence.**

DiagramCloud is a local-first, static web studio for explaining, editing and presenting a project. Open a component’s child architecture while keeping its parent visible, inspect its tasks and evidence, then publish selected public views from the same document. It does not execute the systems it describes.

For contributors, start with [AGENTS.md](AGENTS.md). Agents using the application start with [the AI guide](docs/AI_GUIDE.md) and [llms.txt](llms.txt). The detailed earlier walkthroughs and dated checkpoints are preserved in [the historical README](README_HISTORY_20261021.md); their old versions and test counts are not current release evidence.

## Current state (read this first)

| Dimension | State | Authority |
|---|---|---|
| Source version | `1.33.1` | [package.json](package.json) |
| Document schema | `1` | [canonical model](src/core/model.ts) |
| Galaxy maturity | `G0` standalone | [release contract](docs/RELEASE.md) |
| Last recorded private package | `diagramcloud/1.33.1-1ee51db` | [outcome.json](outcome.json), `privatePackages` |
| Post-release source and exact-head checks | Separate from the immutable package | [current continuation](RESUME.md) |

The package above is 1.33.1 from `1ee51db` (PR #123); later source commits are not inside it. A matching version string does not mean two source commits or delivered packages are identical. Read the exact source, CI receipt and package identity before claiming a release is installed or verified.

1.33.1 is a patch of storage recovery and persistence fixes ([1.33.1 notes](docs/release-1.33/RELEASE_NOTES-1.33.1.md)). 1.33.0 includes interview practice, idea portfolios, the reading wayfinder, exact delivery-task links, restored linked-view contexts and storage recovery. See [the release notes](docs/release-1.33/RELEASE_NOTES.md). V2/V3 are integrated in bounded slices, not complete products: [the roadmap](docs/ROADMAP.md), [R4 acceptance](docs/product/R4_CROSSWALK.md) and [V3 acceptance](docs/product/V3_WORKSPACE.md) retain the remaining work.

## Start locally

Use Node.js 22 in a clean checkout:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. A production build is static, but serve `dist/` over HTTP rather than opening its `index.html` directly. Exported standalone portfolio HTML is a different artifact and supports offline file opening.

Before proposing a completed source change:

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The full CI also checks standalone CLI/MCP bundles and a Linux packaging dry run. [Release verification](docs/RELEASE.md) explains receipts, artifact checks and the additional visual/installed checks. A packaging dry run is not a published release.

## First walkthrough

Open the TotalEnergies example, choose **SQL quality checks**, then **Required fields**. The parent architecture stays visible while the child workflow and evidence open. These are authored explanations; sample numbers must not become verified employer results.

**Explore** is read-only. **Edit** enables visual authoring and Undo/Redo. **Portfolio** uses the public projection. **Present** follows a guided story. The Studio also supports linked views, saved contexts, interview practice and idea-reading modes. Use the current permitted document when navigating; similarly named objects are not replacements for missing stable IDs.

## The grammar

One validated Project owns components, connections, views, evidence, sources and story steps. Views reuse stable identities and own their memberships and positions. The domain is independent of the canvas library.

**Designed** is intent. **Observed/verified** is a dated, source-backed claim. **Presented** means explicitly reviewed and selected for sharing. These are different states. Synthetic evidence stays synthetic and cannot establish an observed result. See [the realization contract](docs/contracts/realization-overlay.md).

## Authoring without raw JSON

Use the visual editors for project metadata, components, connections, child views, sources, evidence, tables, metrics, schedules and stories. JSON / AI is the advanced import and patch route: validate, inspect the proposed changes, then explicitly Apply. Stale revisions are refused rather than merged silently.

[The detailed authoring walkthrough](README_HISTORY_20261021.md#authoring-without-raw-json) and [AI formats and examples](docs/AI_GUIDE.md) remain available. Imported code and transformation examples explain work; they are not executed.

## Learning milestone (1.26.0)

The catalogue distinguishes concepts, patterns, procedures, technologies, case studies and view recipes. Examples and practice references are authored learning content, not certifications or deployed-system evidence. [R4 acceptance](docs/product/R4_CROSSWALK.md) records the implemented slices and tests; [the earlier catalogue guide](README_HISTORY_20261021.md#learning-milestone-1260) preserves the original walkthrough.

## Teach an authored explanation

An explanation walkthrough is an **author-written narrative**, not a live trace, an executed simulation or automatic semantic zoom. The author supplies the question, explicit view/component IDs, step order, narration and any before/after tables or frozen code excerpts. These describe an authored case; they do not prove that a system ran or that a result was measured.

The offline compiler produces a private, revision-guarded `diagramcloud.patch`, a preview and an explanation map. It changes neither input and never applies the patch or publishes the result. For example, from a clean checkout:

```sh
npm run explain -- --project examples/pro-expressiveness/retry-metadata.base.json --request examples/pro-expressiveness/retry-metadata.walkthrough.json --out explanation-output
```

The output directory must not already exist; each input is limited to 4 MiB of exact UTF-8. Review the generated patch through the ordinary JSON / AI import before applying it. The six teaching projects in [the expressiveness guide](docs/product/EXPRESSIVENESS.md) are labelled synthetic examples, not observed runs. The companion pane follows explicit related-context connections; similarly named subjects are not inferred correspondence. **Focused explanation HTML** exports the selected public story for offline reading, with its code/state evidence. An in-App walkthrough request editor and the companion’s Contract and Questions tabs remain unfinished.

## Project Intelligence (1.24.0)

Repository, Guided and Hybrid analysis feed the same reviewed document path. Static declarations and inferred candidates remain distinct from runtime facts. [The earlier analysis guide](README_HISTORY_20261021.md#project-intelligence-1240) describes the entry points; [the AI guide](docs/AI_GUIDE.md) records the current commands.

## Project atlas: several repositories

An explicit manifest can assemble multiple repositories while preserving their source identities and omissions. A membership, remote, branch, instance and release are not interchangeable. [Atlas walkthrough](README_HISTORY_20261021.md#project-atlas-several-repositories).

## Diagram Design mode

Figures are projections of the same model, not separate documents. Missing quantities, schedules or baselines must be reported rather than fabricated. [Figure selection and examples](docs/AI_GUIDE.md) and [design walkthrough](README_HISTORY_20261021.md#diagram-design-mode).

## Perspectives and the view spec

Perspective, environment, source revision, semantic depth and camera zoom have separate meanings. Reuse stable IDs and preserve absent or stale context explicitly. [View-spec walkthrough](README_HISTORY_20261021.md#perspectives-and-the-view-spec).

## Diagram from a repository

Scans are bounded, declaration-based and subject to review. Supported syntax is not proof of deployed topology, current traffic or successful execution. [Scanner walkthrough](README_HISTORY_20261021.md#diagram-from-a-repository).

## Import draw.io, Mermaid and Visio

Interchange adapters report unsupported or lost information. They do not promise lossless conversion of styles, vendor artwork or arbitrary diagrams. [Supported interchange details](README_HISTORY_20261021.md#import-drawio-mermaid-and-visio).

## Included examples

The gallery includes authored portfolio explanations, cloud/reference architectures, learning examples and blank projects. Provenance and synthetic labels remain attached to each example. [Example catalogue and caveats](README_HISTORY_20261021.md#included-examples).

## Exports and fidelity

**Authoring JSON is the full private backup path.** It is not a safe public artifact. Public JSON, standalone HTML, SVG, PNG, decks and other publication formats use the permitted public projection; public text still requires human confidentiality review.

PPTX uses editable semantic shapes and text, not a pixel-identical canvas screenshot. Technical-manual/print PDF and the meeting-summary HTML are distinct outputs; meeting-summary PDF/PPTX are not established by the HTML feature. [The detailed format/fidelity table](README_HISTORY_20261021.md#exports-and-fidelity) and [release checks](docs/RELEASE.md) describe the relevant boundaries.

## Galaxy contracts

DiagramCloud remains usable without a companion app, account or model. Its [Galaxy contracts](docs/contracts/galaxy-v1g.md) cover identity, evidence, publication, deep links and verification receipts. Optional hosts and adapters do not grant editing, execution, publication or access to another product. No automatic orchestration is implied.

## Storage and safety

Projects are saved in this browser origin’s IndexedDB. Export authoring backups; there is no server synchronization or collaborative merge. A failed save must leave the draft available and distinguish it from the last stored copy. A recovery action must not overwrite or delete a newer copy from another tab.

The document import limit is **12 MiB of UTF-8**, not a character count. An oversized in-memory authoring backup retains its content but must be reduced before normal reimport. A downloaded backup neither acknowledges a database save nor proves the user retained the file.

The optional repository bridge uses an explicitly chosen folder and checks the stored file before writing. Same-handle serialization is not an operating-system lock against another editor, another tab or a separately picked handle. The folder handle is not persisted across reloads. Exact adopted fixes and qualification are recorded in [RESUME.md](RESUME.md).

Private visibility is not encryption, DLP or secret scanning. Public exports remove private objects, but a sensitive statement marked public remains public. Preserve source provenance, review decisions and asset rights.

## Current limitations

Chromium is the qualified browser family in CI. Installed VS Code/Cursor acceptance, extension update/rollback, signing and Marketplace are separate checks. The browser suite’s optional external-host skips do not certify those integrations.

No live cloud discovery, arbitrary code execution, automatic agent dispatch, server sync or real-time collaboration is provided. Source declarations, estimates and supplied delivery snapshots are not live telemetry or calibrated forecasts. External adapters, broader host behavior and remaining V2/V3 acceptance stay open in [the roadmap](docs/ROADMAP.md).

## License and documents

Original source is MIT. Dependencies and provider artwork retain their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Do not bundle font files.

Use [architecture decisions](docs/ARCHITECTURE.md), [research decisions](docs/RESEARCH.md), [release verification](docs/RELEASE.md), [the canonical roadmap](docs/ROADMAP.md) and [current continuation](RESUME.md) for their separate purposes. Dated architecture/research checkpoints are not current qualification receipts. [Optional Drive guidance](docs/GOOGLE_DRIVE.md) is separate from core local persistence.
