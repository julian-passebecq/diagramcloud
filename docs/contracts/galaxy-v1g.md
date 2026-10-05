# DiagramCloud Galaxy contract support

Date: 2026-10-03, updated 2026-10-05 for 1.0.0 (verification receipt, snapshot import in the UI).

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
- `galaxy.verification-receipt/1` (produce only, optional; see below)

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

In the app, paste a snapshot into **JSON / AI → Validate JSON**: `isPublicationSnapshot` recognises it, `stagePublicationSnapshot` maps its claims to DiagramCloud nodes through owned entity IDs or `galaxy:diagramcloud:node:<id>` aliases, and the result is shown as an ordinary revision-guarded patch with a note naming the producing app and every unresolved claim (self claims, `designed`, unmapped subjects, already imported). Applying it adds private, unreviewed observations; nothing else changes.

The consumer never sets `reviewedAt`, public visibility or `shareable` on the author's behalf.

Public snapshots require explicit human confirmation and may only contain public entities/evidence plus reviewed or qualified claims. Synthetic evidence cannot back a `verified` claim.

## Verification receipt

`galaxy.verification-receipt/1` (`verificationReceipt`, `validateVerificationReceipt` in `src/core/galaxy.ts`) describes one release candidate: receipt ID, the `diagramcloud` app identity as a `galaxy.entity/1` subject (`entity_type: release`), the exact 40-character commit, product version, document schema version, Galaxy maturity, the checks, evidence refs, timestamp, status and caveats.

The verification level is **derived** from the checks, never passed in, and never inferred upward:

| Level | Needs passed checks |
|---|---|
| IMPLEMENTED | typecheck |
| BUILD_VERIFIED | + unit, build |
| PACKAGE_VERIFIED | + package (sha256 manifest of the static `dist/` bundle) |
| E2E_VERIFIED | + e2e (Chromium) |
| MANUAL_QUALIFIED | + manual-visual, citing a hashed human review record (`MANUAL_REVIEW=<file>`) |

The validator refuses `GALAXY_QUALIFIED` (that needs a cross-app qualification outside DiagramCloud), any Galaxy level other than `G0`, a dirty working tree, synthetic evidence, a failed check under status `passed`, and unknown evidence references. `npm run qualify` runs every check locally and writes `release/verification-receipt.json`; CI records the same receipt from its step outcomes and uploads it with the `diagramcloud-ci` artifact.

## Deep links

DiagramCloud defines the semantic route:

```text
diagramcloud.project-view-node/1
?project={project}&view={view?}&node={node?}
```

This route belongs to DiagramCloud's own contract surface. No external launcher or Hub integration is assumed.

## Current maturity

Current handshake (product version 1.0.0):

```text
galaxy_level = G0
standalone = true
```

Product version, release qualification level (receipt) and Galaxy maturity are three separate dimensions.

A future V1G promotion would require an explicitly approved external interoperability project and fresh qualification evidence. It must not require modifying DataPass unless that is separately requested.
