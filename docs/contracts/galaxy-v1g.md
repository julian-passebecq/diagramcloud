# DiagramCloud ↔ DataPass Galaxy V1G contracts

Date: 2026-10-03. Implementation branch: `feat/diagramcloud-galaxy-v1g`.

## Boundary

DiagramCloud remains the local-first architecture / work / evidence / publication authority for its own `Project` document. Galaxy adds portable identity, evidence references, navigation and reviewed publication exchange. It does **not** replace `src/core/model.ts`, React Flow, IndexedDB, the author review workflow or DiagramCloud exports.

V1G requires no server, MongoDB runtime client, polling loop or shared execution engine. Every Galaxy companion is optional; an incompatible or absent companion disables only that integration.

## Contract set

DiagramCloud implements the accepted minimal V1G set:

- `galaxy.entity/1`
- `galaxy.evidence-ref/1`
- `galaxy.version-handshake/1`
- `galaxy.publication-snapshot/1`
- `galaxy.deep-link/1`

The canonical TypeScript validators/adapters are in `src/core/galaxy.ts`. Build-time JSON Schema and manifests are generated under `public/galaxy/`.

## Identity

A Galaxy entity carries a globally stable `entity_id` **and** the owning application's `local_id`. DiagramCloud keeps its existing stable Project/View/Node IDs unchanged.

Recommended generated ID:

```text
galaxy:<owner_app>:<entity_type>:<percent-encoded-local-id>
```

Consumers treat the complete `entity_id` as opaque. Labels, paths and positions are never identity.

## Evidence

`galaxy.evidence-ref/1` points to external evidence such as Git commits, CI runs, runtime receipts, files or documents. It records source system, locator, capture time, visibility, synthetic status and review/qualification state.

An EvidenceRef is a pointer/provenance object, not a claim that DiagramCloud independently verified the source. Foreign EvidenceRefs are not silently converted into DiagramCloud evidence blocks.

## Version handshake

DiagramCloud publishes a static-compatible handshake containing:

- product version;
- current Galaxy maturity;
- standalone flag;
- produced/consumed contract versions;
- available/partial capabilities;
- registered deep-link routes;
- graceful-degradation statements.

The implementation deliberately reports `G0` until cross-app V1G qualification is actually completed. Implementing the schemas does not self-promote the application to `V1G`.

## Deep link

Route ID:

```text
diagramcloud.project-view-node/1
```

Relative route:

```text
?project={project}&view={view?}&node={node?}
```

The deployment base URL belongs to Galaxy/Hub configuration, not this semantic contract. Existing `src/core/links.ts` remains the application implementation.

## PublicationSnapshot

`galaxy.publication-snapshot/1` is an immutable, reviewed and visibility-scoped projection.

It contains:

- producer and exact source revision when available;
- stable subject entity;
- reviewed publication metadata;
- public/internal entity projections;
- typed relationships;
- EvidenceRefs;
- realization claims;
- optional non-authoritative presentation hints;
- exact contract versions.

### DiagramCloud as producer

`publicationSnapshot()` first uses `publicDocument()`. Private/unreachable authoring content is therefore excluded before the Galaxy projection is built.

A public snapshot requires `human_confirmed: true`.

### DiagramCloud as consumer

`stagePublicationSnapshot()` validates the snapshot and converts only safely mapped **external realization claims** into the existing `diagramcloud.patch` review path.

Flow:

```text
PublicationSnapshot
      ↓ validate
entity mapping to existing DiagramCloud Node
      ↓
staged diagramcloud.patch
      ↓ normal change preview / base-revision guard
private, unreviewed Observation
      ↓
human DiagramCloud review
      ↓
optional public / shareable presentation
```

The import never directly overwrites a Project and never sets `reviewedAt`, public visibility or `shareable` on the author's behalf.

Claims produced by DiagramCloud itself are not re-imported. Unmapped foreign entities remain unresolved instead of being guessed by name.

## Relationship to existing contracts

This V1G layer deliberately reuses rather than replaces:

- `diagramcloud.patch` for guarded changes;
- the realization observation lifecycle;
- `diagramcloud.portfolio-index/1` for Mongoku's bounded read-only portfolio projection;
- the DataPass sidecar bridge;
- the project/view/node deep-link behavior.

`PublicationSnapshot` is the richer semantic exchange contract; `portfolio-index/1` remains the small curated portfolio projection.

## Qualification

Required checks before Galaxy maturity can change from G0 to V1G:

1. TypeScript and unit tests on exact revision.
2. Generated JSON Schemas/manifests validate.
3. PublicationSnapshot fixtures round-trip between at least two applications.
4. DataPass or another producer supplies a reviewed external claim that stages into DiagramCloud without bypassing review.
5. Hub/Galaxy resolves the registered deep link.
6. Missing companions leave standalone DiagramCloud unaffected.
7. Exact evidence for the qualification is recorded in Galaxy as a verification receipt/audit.
