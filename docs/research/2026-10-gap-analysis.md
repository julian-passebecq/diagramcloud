# DiagramCloud gap analysis (2026-10-06)

Method: WebFetch and WebSearch on 2026-10-06. Statements without a URL are my own judgement.

## 1. What users miss (evidence limits)
BLOCKED, content not read: both Medium articles (HTTP 403) and both Reddit threads (fetch refused). Nothing below is attributed to them. Read: github.com/mingrammer/diagrams (MIT, Python + Graphviz, 692 commits, 318 open issues, 200+ provider nodes). Other evidence: search snippets on Terraform-diagram tools ([TerraVision](https://github.com/patrickchugh/terravision), [Brainboard](https://www.brainboard.co/blog/ai-terraform-diagrammer), [DEV](https://dev.to/miketysonofthecloud/make-terraform-as-diagram-30mh)). This ranking is therefore a reasoned synthesis, not a poll. Please read the 4 blocked pages by hand to confirm.

Top 10 recurring needs (rank = my confidence):
1. Diagrams that do not go stale: generate from Terraform/code, run in CI ("docs as code"). Source: TerraVision/DEV snippets.
2. Diagram as code in git, diffable (mingrammer diagrams, D2, Structurizr, LikeC4).
3. Correct, current official provider icons without hunting (diagrams: 200+ nodes; DiagramCloud gallery covers this).
4. Auto-layout that looks clean (DiagramCloud has grid only; known gap in AGENTS.md).
5. Several levels of detail from one model (C4: context/container/component).
6. Import/export with draw.io, Visio, Lucid (no lock-in).
7. Free, offline, private, no account (browser-only).
8. Real-infra truth: link to live or IaC state, show drift (Brainboard/TerraVision).
9. Editable output (not a one-shot image).
10. Blast radius / dependency questions ("what breaks if X goes down", StackPrism, CodeFlow).

## 2. Interchange formats
| Format | Documented structure | Value | Effort |
|---|---|---|---|
| Lucid CSV | Process-diagram import requires ID, Name, Shape Library, Page ID, Contained By, Text Area 1; optional Line Source, Line Destination, Source Arrow, Destination Arrow, Text Area n. Line rows point to shape IDs. [help](https://help.lucid.co/hc/en-us/articles/15927090927508-Create-a-process-diagram-from-CSV-import) | Export (cheap, spreadsheet-friendly); import only as a side effect | S |
| Lucid Standard Import `.lucid` | ZIP with `document.json` (required: `version`, `pages[]`; optional `collections[]`, `extensionBootstrapData`), `/data` CSVs, `/images`; shapes/lines have id, type, boundingBox, text, endpoint1/2, connectedTo. Limits: json 1 MB, zip 50 MB. [overview](https://developer.lucid.co/v1.0/docs/overview-si), [fields](https://developer.lucid.co/v1.0/reference/document-contents) | Export (lets users land in Lucid). Native `.lucidchart` import has no public spec: not feasible | M (reuse zip.ts) |
| Structurizr DSL / C4 | `workspace { model { } views { systemContext, container, component, deployment... } }`; CLI exports plantuml, d2, mermaid, json. [ref](https://docs.structurizr.com/dsl/language), [export](https://docs.structurizr.com/cli/export) | Import (feeds drilldown: C4 levels = child views); export secondary | M |
| D2 | `a -> b: label`, `<->`, `--`, containers by braces or dots, style blocks. [guide](https://blog.logrocket.com/complete-guide-declarative-diagramming-d2/) | Export (simple, popular); import M because of dot-path/style rules | S export / M import |
| PlantUML | Not fetched, so unverified here; known `@startuml` text with components, nodes, `A --> B`, C4-PlantUML macros | Export (ecosystem reach) | S |
| Excalidraw JSON | Object with `elements[]` and appState; text uses `containerId`; arrows use `startBinding`/`endBinding` and `boundElements` on shapes. [schema](https://plus.excalidraw.com/docs/api/scene-content-schema) | Export (whiteboard users, hand-drawn look); import low value | M |
| LikeC4 | `specification {}`, `model {}`, `views {}` with include/exclude predicates, any nesting depth. [intro](https://likec4.dev/dsl/intro/) | Export of model+views; maps well to drilldown | M |
| mingrammer diagrams | Python: `with Diagram(...): a >> b`, `Cluster(...)`; MIT. [repo](https://github.com/mingrammer/diagrams) | Export only (generate a runnable .py; never execute Python). Import would need a Python parser: skip | S |

## 3. Repo to architecture generators
| Name | Verdict | Facts (source) |
|---|---|---|
| Groma.md | REAL | MIT; scans code to C4 map stored as Markdown (OKF) in git; deterministic scanners for ~14 languages; architecture diff across commits; systems/containers/components. [repo](https://github.com/MrLesk/Groma.md) |
| Tecture | REAL | MIT; `architecture/` folder with manifest.json, diagrams/*.json (nodes, edges), descriptions/*.md; agents write it; evidence script checks node paths and edges (drift). [repo](https://github.com/tecture-io/tecture) |
| Compass | REAL | MIT or Apache-2.0; Rust, tree-sitter; EXTRACTED vs INFERRED labels; `--at HEAD~20`; snapshot diff report; 1,553 commits. [repo](https://github.com/crabbuild/compass) |
| Codebase Visualizer | UNVERIFIED | Only generic same-name repos/VS Code extensions found; no identifiable project. |
| StackPrism | REAL but two unrelated projects | stackprism.ai (closed, SaaS, AI): reads manifests, lockfiles, Docker, Terraform, API routes; CVE/EOL badges; free tier + Pro $19.99/mo. [site](https://stackprism.ai/). setube/stackprism is a browser extension detecting website tech. |
| Grasp | REAL | ashfordeOU/grasp: browser-only, 35 languages, dependency graphs, ORM tracking, git change impact, MCP server. License not confirmed. [repo](https://github.com/ashfordeou/grasp) |
| Mercator-AI | REAL, tiny | shihwesley/mercator-ai: MIT, 11 commits, 4 stars; Merkle hashes for change detection, writes docs/CODEBASE_MAP.md. Not a diagram tool. [repo](https://github.com/shihwesley/mercator-ai) |
| CodeFlow | REAL | braedonsaunders/codeflow, MIT, runs in browser via GitHub API, 30+ languages, name-matching heuristic for dependencies, blast radius, churn, health score. Many clones. [repo](https://github.com/braedonsaunders/codeflow) |
| GitDiagram | REAL | ahmedkhaleel2004/gitdiagram, MIT, ~17k stars; LLM-generated diagram from a repo (server side, so not deterministic). [repo](https://github.com/ahmedkhaleel2004/gitdiagram) |

Features worth copying (design for a deterministic browser scanner; the design is mine, informed by the above):
- Files to read: package.json/lockfiles (stack), docker-compose (services, ports, depends_on), k8s manifests (Deployment/Service/Ingress), Terraform .tf (resources, references), `.github/workflows` (deploy targets), prisma/schema.prisma and SQL DDL (datastores, tables), `.env.example` (external services), imports (components).
- Evidence model (Compass EXTRACTED/INFERRED, Tecture path checks): every node/edge carries `confidence: confirmed | inferred | possible` plus `evidence[] = {file, line, snippet}`. Confirmed = explicit declaration (compose depends_on, TF reference); inferred = naming or import heuristic; possible = env var/dependency hint. Fits DiagramCloud's evidence blocks; keep scanner output as "source-derived", never "verified".
- Levels: system, container, component, file (Groma, Tecture) mapped onto childViewId drilldown.
- Diff: store scan as stable-ID JSON; diff two commits by node/edge ID (Groma, Compass); show added/removed/changed overlay.
- Privacy: browser-only, local folder or GitHub API (CodeFlow, Grasp).

## Ranked: what DiagramCloud should build next
1. Deterministic repo scanner v1 (compose, k8s, Terraform, package.json, Prisma) with confirmed/inferred/possible and file:line evidence: L
2. Structurizr DSL import (C4 levels become drilldown views): M
3. Graph auto-layout (ELK, layered) replacing the grid: M
4. D2 export + PlantUML export (text exporters sharing one graph walker): S
5. Architecture diff between two documents or two scans (stable-ID overlay): M
6. Lucid CSV export + `.lucid` export: S-M
7. mingrammer diagrams .py export + Excalidraw export: S + M
8. LikeC4 export (model plus views): M
