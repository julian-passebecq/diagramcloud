# DiagramCloud

**Architecture -> the work behind it -> the evidence.**

A local-first React + Microsoft Fluent UI project studio. Select a component to keep the parent architecture visible and open its child diagram underneath. Continue into a task, function, table or code example. Use the same document for an interview walkthrough, a public portfolio and presentation exports.

Authoritative repository: `julian-passebecq/diagramcloud`. Initial V1 work is on `feat/diagramcloud-v1`, not the initialization-only `main` branch.

## Start locally

Use Node.js 22. From a fresh checkout:

```sh
npm install
npm run check
npm test
npm run build
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The generated `dist/` can be served by any static HTTP host. Do not double-click `dist/index.html`: the editor uses ES modules and a normal browser origin. In contrast, the exported `*.html` portfolios are self-contained files that can be opened directly, offline.

The CI source artifact includes the resolved `package-lock.json`; use `npm ci` when working from that artifact. Browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

A static Cloudflare Workers assets configuration is included in `wrangler.jsonc`. It does not deploy anything by itself. No cloud account, database, Python runtime, API key or paid diagram service is required to use V1 locally.

## First walkthrough

Open **TotalEnergies**. Click **SQL quality checks**, then **Required fields**, then **Validation query**. The architecture stays above, a validation workflow opens below, and the third level exposes synthetic input rows, a SQL function and expected exceptions. Evidence appears below the diagrams; the left Inspector explains the selected component.

Explore is read-only. Edit enables dragging, handle-to-handle connections, node and edge properties, new components, child diagrams, evidence creation, image attachment and undo/redo. Portfolio removes private/unreachable content from the displayed model. Present adds a guided narrative. Light is the default; a dark theme and reduced-motion behavior are included.

## Included examples

| Project | Scope | Provenance |
|---|---|---|
| TotalEnergies | Cost/schedule flow, SQL checks, sample model and reporting | Reconstructed from two supplied PDFs; synthetic code and rows |
| Foil'O Ecologie | Physical hydrofoil, Databricks workflow, governance, scenario assumptions | Reconstructed from the PDFs; not a verified scientific solver |
| Microsoft Fabric | Medallion architecture, ingestion and Silver transformation | Independently authored reference with official documentation links |
| Databricks | Medallion architecture, contracts and deduplication | Independently authored reference with official documentation links |
| Blank project | One component to start editing | Author-created |

The supplied PDFs contain illustrative financial scenarios with different figures. These are not silently combined or presented as employer achievements. The remote CV PDF was not successfully retrieved during this pass; the gallery does not claim to cover every job in the full CV. The original PDFs and any confidential employer files are not stored in this repository.

## Exports and fidelity

| Format | Included | Deliberate limits |
|---|---|---|
| Authoring JSON | Full validated source document, including private and unattached content | A backup, not a safe public artifact |
| Public JSON | Reachable public graph, evidence, assets and sources | Public text still requires human confidentiality review |
| Interactive HTML | All public views, click drilldown, evidence, guided story, no network dependency | Read-only; static diagrams rather than live execution |
| SVG | Current public view; embedded full public document metadata supports re-import | Semantic export, not pixel-identical to the editor; generic artwork |
| PNG | Current view, up to 4096-pixel longest edge | Raster and static; no drilldown or metadata |
| PowerPoint | Native editable shapes, text and tables; view slides, evidence, source notes; child-view hyperlinks | Static; layout is a semantic reconstruction, not a screenshot |
| Mermaid | Basic flowchart of the current view | No general Mermaid import or lossless evidence/hierarchy round trip |
| Print / PDF | Browser print of currently expanded public views and selected evidence | Not an all-project pagination engine |

**SVG metadata contains the entire public project, not just the visible diagram.** Arbitrary SVG can be attached as an image, but cannot automatically become an editable graph. Uploaded SVG is sanitized and rasterized; PNG/JPEG/WebP uploads are decoded and re-encoded. Code snippets are displayed, never executed.

## Root architecture

`src/core/model.ts` is the source-of-truth contract. The UI and exporters are adapters; React Flow serialization is not the document format.

```text
AI / JSON import -> schema + reference validation -> canonical Project
                                                   |             |
                                            IndexedDB         public filter
                                                   |             |
                                          React + Fluent     HTML / SVG / PNG
                                           React Flow        PPTX / Mermaid
```

Read [architecture](docs/ARCHITECTURE.md), [research and license matrix](docs/RESEARCH.md), [roadmap](docs/ROADMAP.md), and [AI editing instructions](AGENTS.md). The build generates `public/diagramcloud.schema.json` plus JSON/HTML/SVG examples. JSON Schema checks structure; `validateDocument` additionally checks references, memberships and drilldown cycles.

## Storage and safety

Projects are saved in this browser's IndexedDB. Clearing site data or using a different browser/profile does not preserve the workspace. Export Authoring JSON backups. Save failures and conflicting edits from another tab are surfaced; there is no server synchronization or collaborative merge. Undo history is bounded and in-memory.

Private objects are removed from public outputs, not merely hidden with CSS. This is not secret scanning or an access-control system: a sensitive fact marked public remains public. Never publish credentials, customer records, private screenshots or employer data without authorization.

Motion represents an authored explanation: stream/batch/query/control links and slow/medium/fast visual cues. It is not measured throughput, Spark execution or a performance comparison. Activity rings move around symbols; Microsoft product artwork itself is not rotated.

## License and scope

Original DiagramCloud source is MIT. Dependencies and Microsoft artwork retain their own licenses and usage terms; see [third-party notices](THIRD_PARTY_NOTICES.md). No font files are bundled. Only one official Fabric item icon is currently bundled; other symbols are original generic symbols. This is not yet a complete cloud icon collection.

V1 is a working foundation, not a replacement for every feature of draw.io. It does not yet provide live cloud discovery, SQL/dbt lineage parsing, general draw.io/Visio import, automatic graph layout, real-time collaboration, a visual story composer or a DAX/Python runtime. Those should extend the same core rather than become separate apps.
