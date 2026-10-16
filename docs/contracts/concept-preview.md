# Selected concept previews

DiagramCloud owns the validated Project and ViewSpec; MosaicStudio owns concept rendering. `conceptSpec(project, viewId)` remains a public export through `publicDocument`. An empty public view refuses with an actionable message. No core or Mosaic schema changes are introduced.

`authorConceptPreview(project, {projectId, baseRevision, viewId})` is a separate private projection for a host that already holds access. It rejects a different project or stale revision and never changes visibility. It sends selected-view references, not unattached private notes, unrelated sources or unrelated repository revisions. An audience option is not authorization.

## Files

```sh
npm run concept:preview -- document.json --view root --audience public --out new-preview
```

Use `--audience author` only for a private preview. The output leaf must not exist; its parent must exist. Optional `--now <ISO-time>` fixes the generation timestamp. The CLI validates a bounded selected file, never follows paths from document content, and leaves the input unchanged. It writes:

- `preview.concept.json`: Mosaic's existing `datapass.concept-spec/1`.
- `mapping-report.json`: typed node/edge source IDs, target IDs, retained/merged/omitted states and losses.
- `preview.packet.json`: candidate `diagramcloud.concept-preview/1` host envelope, bound by SHA-256 to project, revision, view, audience and projection.
- `PREPARING.json`, then `READY.json`: local receipt with input and output hashes; PREPARING without READY means incomplete output.

The digest is neither a signature nor semantic verification. Rebuild from the authorized document at an external deserialization boundary; do not trust a viewer-supplied packet. READY does not establish publication, runtime health, a working viewer or T3 integration.

## Mapping and losses

Target identities share one namespace; source nodes and edges do not. Canonical target IDs are reserved before rewritten IDs, in stable sorted order. The legacy untyped `idMap` is retained, but typed `report.nodes` and `report.edges` are authoritative when source spellings collide. Stability applies when the same selected source set is reordered.

Dependency is not data transfer: it uses the target control style and keeps its source kind in the label and mapping. Confidence stays in labels, evidence and mappings. Compatible parallel relations may merge; incompatible ones are explicitly omitted. Reverse relations merge only with matching meaning and full labels. Self-flows, omitted endpoints and target limits are reported. Long source URLs are omitted, never truncated into different locators. Quantities stay in DiagramCloud and their loss is reported. Target limits remain 40 nodes, 64 flows, eight domains and three nodes per layer/domain cell.

`active` means present in the explanatory projection, not healthy. `documented` keeps the existing v1 meaning of references attached to every component, not execution verification. Synthetic fixtures remain labelled synthetic; no observation is created or reviewed.

## Host boundary and remaining integration

`resolveConceptPick` accepts only the candidate `diagramcloud.concept-pick/1` shape and resolves IDs against the host's current packet. Stale hashes, unknown IDs and extra action fields refuse. `acceptConceptMessage` additionally requires an exact HTTP(S) origin and bound source window. Opaque/file origins are unsupported by this helper; use a file/read-only route. The helper neither mutates the document nor executes commands or URLs.

The [isolated local host](mosaic-local-host.md) now loads Mosaic's existing `datapass.concept-spec/load` and ready protocol using an explicitly selected owner artifact. The viewer does not emit the proposed pick message; separate mapping buttons can return a unique current source. No new viewer, WebGL engine, T3 session, MCP author permission or publication path is added. The sidecar and READY are not `datapass.preview/1` or `datapass.artifact/1`. Native T3 and automatic WebGL context restoration remain unqualified.
