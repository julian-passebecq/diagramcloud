# Diagramming ecosystem and reuse decisions

Reviewed 2026-09-21. This is a broad, decision-oriented survey of relevant maintained libraries, editors, diagram-as-code tools and the user's supplied links, not a claim to have audited every open-source repository or every transitive license. License names below describe the reviewed upstream project; hosted services, plugins, examples, icons and trademarks can have different terms. Recheck a pinned revision before incorporating code or assets.

## Conclusion

Build a small project-explanation product on an established canvas, not a new drawing engine. Use **React + Fluent UI 9 + React Flow + a validated, renderer-independent JSON model**. Reuse the ideas behind model-driven views, narrative steps, graph tracing, low-friction text authoring, rich evidence and portable artifacts. Do not fork several complete editors into a large monolith.

The distinction is not that other tools lack interaction. Mermaid already has animated edges. Archify already combines typed JSON, validation, drilldown, inspection, narrative and static HTML. LikeC4 already provides model-driven interactive views. DiagramCloud's proposed focus is a deliberately simple combination for data-engineering explanation: **parent diagram retained above, task diagram below, implementation evidence attached, then interview/presentation output from that same model**.

## Primary comparison

| Tool / source | License or category reviewed | Useful capability | DiagramCloud decision |
|---|---|---|---|
| [React Flow / xyflow](https://reactflow.dev/) | MIT core | React nodes, connection handles, drag, zoom, selection, minimap, custom edges | Use as V1 interactive canvas; keep domain independent of its serialized UI state |
| [Microsoft Fluent UI](https://github.com/microsoft/fluentui) | MIT code; assets separately licensed | Consistent React controls, themes, accessible interaction primitives | Use React v9 shell, not a collection of unrelated custom widgets |
| [Mermaid](https://github.com/mermaid-js/mermaid) | MIT | Text-based flowcharts, sequence/state/ER views, architecture groups, animated flow edges | Add a limited export now; later a narrowly specified import adapter. Not our rich-document database |
| [draw.io / diagrams.net](https://github.com/jgraph/drawio) | Apache-2.0 source; inspect separate icon/stencil terms | Mature editor, grouping, connectors, many shapes, editable exports and integrations | Borrow interaction expectations; consider isolated embed/interchange later. Do not copy its whole UI or blindly redistribute all stencils |
| [mingrammer/diagrams](https://github.com/mingrammer/diagrams) | MIT Python library | Provider-oriented diagrams-as-code, clusters, Graphviz rendering, versionable scripts | Good authoring adapter and example source; not an interactive evidence/portfolio application or cloud provisioner |
| [tt-a1i/archify](https://github.com/tt-a1i/archify) | MIT | Typed JSON intermediate representation, validation, nested exploration, inspector, story and standalone HTML | Closest conceptual reference. Adopt the validated-document and read-only portable-viewer pattern, rather than claiming drilldown is novel |
| [LikeC4](https://likec4.dev/) | MIT | One model, multiple views, nested elements, interactive navigation, embeddable/generated documentation | Strong reference for semantic identity and progressive explanation. Candidate future import/export, not a second source of truth |
| [D2](https://github.com/terrastruct/d2) | MPL-2.0 | Text diagrams, containers, layout engines and polished vector outputs | Optional future layout/authoring adapter; not required for V1 |
| [TALA](https://d2lang.com/blog/tala-is-open-source/) | MPL-2.0 as announced 2026-09-07 | Architecture-oriented layout and orthogonal routing | Newly relevant open-source layout option. Do not repeat older advice that it is necessarily proprietary |
| [tone-row/flowchart-fun](https://github.com/tone-row/flowchart-fun) | MIT repository; hosted/premium services distinct | Fast indentation-based text-to-graph authoring using Cytoscape and a parser | Inspiration for a later lightweight outline editor; importing the whole hosted product adds unnecessary scope |
| [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) | MIT | Graph traversal/analysis, compound nodes and visualization ecosystem | Strong alternative for graph-heavy analytics; React Flow better matches the immediate rich React-card authoring need |
| [AntV X6](https://github.com/antvis/X6) | MIT | SVG/HTML graph editor, ports, routing, grouping and plugins | Credible alternative to React Flow, but mixing two canvas engines in V1 is unnecessary |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | MIT | Freeform whiteboard, sketch-like diagrams, libraries and portable scene data | Optional sketch/evidence embed. A whiteboard alone does not provide stable task/evidence semantics |
| [JointJS](https://github.com/clientIO/joint/blob/master/LICENSE) | MPL-2.0 core; commercial products distinct | Custom diagram elements, links and detailed SVG modeling | Viable with license review, but not MIT and not needed beside React Flow |
| [tldraw](https://tldraw.dev/community/license) | Current custom SDK license, not a generic MIT option | Excellent programmable infinite canvas and shape tooling | Do not select it on a mistaken 'all MIT, production free' assumption. Current production use involves a suitable license/key |
| [Kroki](https://kroki.io/) | Rendering gateway; engines have independent licenses | One API for many diagram syntaxes | Optional isolated rendering service later. A server is unnecessary for local-first V1 and introduces privacy/licensing boundaries |
| [HariSekhon/Diagrams-as-Code](https://github.com/HariSekhon/Diagrams-as-Code) | MIT collection | Real diagram scripts and regeneration workflows across formats | Curated example and CI inspiration, not a standalone diagram engine |
| [lucid-bi/Fabric-Architecture-Diagrams](https://github.com/lucid-bi/Fabric-Architecture-Diagrams) | Community example repository; a reuse license was not established in the reviewed root listing | Fabric diagram examples and presentation conventions | Visual research only until licensing is established. It is not an official Microsoft architecture library merely because it concerns Fabric |
| [Lucidchart reference-architecture skill](https://github.com/jeremylongshore/tons-of-skills-marketplace/blob/main/plugins/saas-packs/lucidchart-pack/skills/lucidchart-reference-architecture/SKILL.md) | Instructions/integration recipe, not the Lucidchart engine | Documentation and integration workflow ideas | Do not infer that Lucidchart itself is open source or reusable under the skill repository's license |
| [Gliffy guide](https://www.gliffy.com/resources/cloud-architecture-diagrams) / Lucidchart | Proprietary products and documentation | Templates, grouping, layout conventions, presentation and collaboration expectations | Inspiration only, not source-code donors |

Additional supplied discovery sources: [Reddit cloud architecture discussion](https://www.reddit.com/r/devops/comments/1h1ekir/cloud_architecture_diagrams/) and [Medium tool roundup](https://medium.com/@alexandre_43174/the-top-10-cloud-infrastructure-diagramming-tools-a51a3896a160). These are useful for finding candidates, not authoritative evidence of current licenses. Repeated links in the request were deduplicated.

## Capabilities worth combining

### Semantic architecture

Use distinct node, edge, view, evidence, source and story entities. Represent infrastructure, a task workflow and a table contract as different views of a project rather than forcing all detail into one crowded cloud drawing. Reuse an entity across views without duplicating its identity. Represent an arrow as a documented relationship: batch data, event stream, query, orchestration/control or dependency. Do not imply actual runtime lineage from a manually drawn edge.

### Progressive explanation

Clicking should not erase the user's context. Preserve the root above; append the selected sub-view; keep a breadcrumb and allow closing one level. A leaf should answer: what enters, what work happens, why this choice, what comes out, which constraint matters, and what was the person's contribution? Offer code, small sample tables, images and sources. A portfolio reader should not need to understand a huge canvas first.

### Authoring and AI

A machine-readable document is more valuable than prompting an image generator to redraw an architecture. Stable IDs permit repeatable edits. Validation should reject dangling links, ambiguous table structures, invalid child references and unknown versions before replacing the last good document. A later JSON Patch interface should include a base revision and a previewable diff. Raw execution strings and functions must not be embedded in a presentation document.

### Motion with honest semantics

Use movement for an explanatory distinction, not decoration everywhere. Stream particles, batch movement, a query highlight, a retry/wait status and a step-by-step narrative can reveal what is happening. Provide pause and reduced-motion support. Slow/fast is an authored simulation unless linked to a clearly named measurement with units and timestamp. Vendor identity should remain static; an activity ring can rotate independently.

Mermaid's [flowchart documentation](https://mermaid.js.org/syntax/flowchart.html) already describes edge animation, and its [architecture syntax](https://mermaid.js.org/syntax/architecture) covers services, groups, edges and junctions. DiagramCloud should complement these capabilities, not advertise them as absent elsewhere.

### Portfolio and exports

An interactive HTML export solves a different problem from a PNG. HTML should contain the whole public walkthrough, work offline and exclude private data from its payload. PowerPoint should expose editable text/shapes/tables, not only screenshots. SVG needs a documented distinction between vector artwork and an editable semantic model; private data must not leak through metadata. Print/PDF pagination needs a separate design rather than assuming a giant scrolling canvas will automatically print well.

## Official icons and reference architecture

Microsoft's [Fabric icon terms](https://learn.microsoft.com/en-us/fabric/fundamentals/icons) allow specified architecture/training/documentation uses and explicitly restrict cropping, flipping, rotating and distorting the artwork. The repository's MIT code license does not override these terms. The same separation must be checked for other provider logos.

V1 ships one identified Fabric Lakehouse SVG with source-blob provenance, plus original generic symbols. It does not yet ship a full AWS/Azure/GCP/Databricks catalog. Next, add a versioned icon registry with provider, product, official source, license/usage link, asset checksum and permitted transformation policy. Keep branding artwork separate from node semantics so that export adapters can use the right asset without changing the underlying project.

The Fabric and Databricks templates are independently authored teaching examples based on [Microsoft medallion guidance](https://learn.microsoft.com/en-us/fabric/onelake/onelake-medallion-lakehouse-architecture) and [Databricks medallion guidance](https://docs.databricks.com/gcp/en/lakehouse/medallion). They are not copied official drawings or vendor certifications. Official documentation links belong in the source registry.

## Why not simply fork Archify or embed draw.io?

Archify is close to the desired semantics; its ideas are worth studying further. However, the user explicitly wants a Fluent React authoring shell, stacked child canvases, reusable evidence blocks and multiple presentation exports. A small independent document core gives control over those boundaries. No Archify source was copied in this pass.

Embedding draw.io could deliver mature drawing features quickly, but rich project evidence and parent/child semantic navigation would still need a separate model. It also introduces a second editor lifecycle and interchange mapping. Keep it an optional future bridge rather than make its XML the only representation of every task, table and interview note.

The practical V1 tradeoff is intentional: less general drawing sophistication, more control over explanation, provenance, portability and AI-readable changes. The next investment should be layout/export fidelity and curated assets, not another database or cloud runtime.
