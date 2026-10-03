# DiagramCloud Galaxy contract support

Date: 2026-10-03.

## Boundary

DiagramCloud remains the standalone, local-first authority for its own `Project` document, architecture model, evidence review and publication workflow.

The Galaxy adapters in `src/core/galaxy.ts` are **local contract support only**. They do not require, modify or qualify DataPass VS Code, DataPass Hub, MongoDB runtime services or any other companion application.

DiagramCloud currently reports `G0` in its version handshake. Contract support alone does not promote Galaxy maturity.

## Supported contract shapes

DiagramCloud can validate or emit these generic shapes:

- `galaxy.entity/1`
- `galaxy.evidence-ref/1`
- `galaxy.version-handshake/1`
- `galaxy.publication-snapshot/1`
- `galaxy.deep-link/1`

Build-time JSON Schema and manifests are generated under `public/galaxy/`.

## Identity

A Galaxy entity carries a globally stable `entity_id` plus the owning application's `local_id`. DiagramCloud keeps its own stable Project/View/Node IDs unchanged.

Labels, paths, display names and canvas positions are never identity.

## Evidence

`galaxy.evidence-ref/1` is a portable provenance reference. It does not make external evidence authoritative inside DiagramCloud.

Foreign evidence is never silently converted into a local DiagramCloud evidence block.

## PublicationSnapshot

`galaxy.publication-snapshot/1` is treated as a reviewed projection, never as a replacement for the DiagramCloud Project document.

DiagramCloud producer flow:

```text
Project
  ↓ publicDocument()
reviewed projection
  ↓
PublicationSnapshot
```

DiagramCloud consumer flow:

```text
PublicationSnapshot
  ↓ validate
stable entity mapping
  ↓
staged diagramcloud.patch
  ↓
private + unreviewed observation
  ↓
human DiagramCloud review
```

The consumer never sets `reviewedAt`, public visibility or `shareable` on the author's behalf.

Public snapshots require explicit human confirmation and may only contain public entities/evidence plus reviewed or qualified claims. Synthetic evidence cannot back a `verified` claim.

## Deep links

DiagramCloud defines the semantic route:

```text
diagramcloud.project-view-node/1
?project={project}&view={view?}&node={node?}
```

This route belongs to DiagramCloud's own contract surface. No external launcher or Hub integration is assumed.

## Current maturity

Current handshake:

```text
galaxy_level = G0
standalone = true
```

A future V1G promotion would require an explicitly approved external interoperability project and fresh qualification evidence. It must not require modifying DataPass unless that is separately requested.
