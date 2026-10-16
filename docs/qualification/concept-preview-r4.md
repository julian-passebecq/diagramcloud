# Concept preview r4 local integration

Date: 2026-10-14. Branch: `codex/concept-preview-r4`. Checkout base: `0919474`.

Integrated the six-file concept-export/preview candidate from `DiagramCloud_V2_Code_r4_2026-10-14.zip` (archive SHA-256 `3303b4dbb1fc3c83c67104988124d1428398320adcb6c38a990be2a6b05480f2`). All six candidate files matched their recorded SHA-256 hashes before integration. The existing adapter had no Git diff from the packet's `f0a3c40` baseline; the package configuration differed, so only the new npm script was added. The existing product version, dependencies and lockfile were preserved. No other repository was edited.

The candidate was corrected to avoid assigning a later one-way label to both directions of an already combined flow, retain component confidence before long summaries, report quantity loss for merged/omitted relations and avoid repeating parallel labels. Sample coverage now reads the source samples directly, so tests do not require generated build files. Documentation and two browser regression cases accompany the integration.

## Local checks

Windows, Node.js 22.23.3 for compilation/tests/build/CLI; dependency installation completed with the host's Node.js 26.9.0/npm 11.19.1. These are local working-tree checks, not an exact-commit CI receipt or a release qualification claim.

| Check | Result |
|---|---|
| `npm ci` | Passed; no dependency/lockfile changes |
| TypeScript `tsc --noEmit` | Passed |
| Focused preview/CLI/historical concept suites | 45 passed; 67 public sample views accepted by the unchanged vendored owner validator |
| `npm test` | 442 passed, zero failures/skips |
| `npm run build` | Passed |
| `npm run test:e2e` | 77 passed in 5.2 minutes, zero failures; includes both new concept cases, parent-retained drilldown, rejected imports, public redaction, stale revisions, storage failures/conflicts and offline HTML |
| Actual CLI processes | Public sample and explicitly private synthetic fixture prepared; private fixture refused by the public route; input preserved |
| PowerPoint visual check | Exported five-slide Diagram Design deck rendered by installed PowerPoint to PNG; all five slides inspected, with no clipping/overlap found |
| Browser visual check | Release desktop screenshot inspected; parent and child diagrams, selected evidence and provenance remain visible |

Local evidence is under ignored `.local/`: `concept-r4-unit.log`, `concept-r4-e2e.log`, `concept-r4-public/`, `concept-r4-smoke/` and `concept-r4-pptx-review/`. Browser traces/screenshots remain under ignored `test-results/` and `playwright-report/`.

## Remaining boundaries

This qualifies the local DiagramCloud adapter/CLI changes only. The proposed pick message is not emitted by the Mosaic viewer. Native Mosaic load/ready integration, WebGL fallback/accessibility/disposal/context-loss and the T3 journey remain unqualified. No remote CI run, push, merge, deployment, version bump or publication was performed. The wider V2 handoff is not represented as completed by this candidate.
