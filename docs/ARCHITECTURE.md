# Architecture decision record - V1

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

Save failures remain visible. A failed or corrupted load does not clear the database. The user can export the in-memory authoring document. Site storage is not an external backup; clearing the origin, changing browser profiles or device loss requires a previously exported JSON file. Further quota/recovery/fault-injection testing is explicitly on the roadmap.

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
