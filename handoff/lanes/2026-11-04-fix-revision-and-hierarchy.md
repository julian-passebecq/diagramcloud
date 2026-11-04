# Lane report: fix-revision-and-hierarchy (2026-11-04)

Branch `feat/diagramcloud-fix-revision-and-hierarchy`, from `2b5cc9d`. Fixes two confirmed findings from the bug hunt.

## What changed
- `src/core/operations.ts` `undo`/`redo`: the restored content now gets `present.revision + 1` (same as `src/experience/history.ts`), so revisions only go up. Before, Undo put back the older revision number. The next edit then reused a number that was already used, and a `diagramcloud.patch` written for the undone state passed the revision guard.
- `src/core/hierarchy.ts` `parentPaths`: child links are indexed once with duplicates removed (the first component leading to each child view is kept). A reverse search from the target finds the views that can reach it, and the walk follows only those views. It returns early when the root cannot reach the target. The 12-path cap and the `truncated` flag are unchanged.
- `src/core/operations.ts` `pathToView`: the same deduplication and pruning, still depth-first in document node order. It is kept on one line so that the `publicDocument` citation at `operations.ts:9`, used in `journeys.ts` and the self-description fixtures, stays valid.

## How verified
- New regression tests:
  - `tests/core.test.ts`: "undo and redo only raise the revision…".
  - `tests/hierarchy.test.ts`: "duplicate links and unreachable views never make…exponential". It uses a chain of 40 views with two links per hop plus one unreachable view.
- On the unfixed code, the first test failed and the second ran past the 40 s kill (exit 124).
- Equivalence check: a throwaway script compared the old and new `parentPaths` and `pathToView` on every sample document and 5000 random graphs, cyclic ones included. All 40,775 outputs were identical.
- Gates: `tsc` clean. `npm test`: 2217 tests, 2215 passed. The 2 failures are the known Windows CRLF docs-links test and a design-pdf spawn timeout under load, which passed when re-run alone. `npm run build` passed.
- Playwright: this lane touched no spec. A wider local run of the specs that exercise Undo (`DIAGRAMCLOUD_E2E_PORT=26300`) never started: the config's 30 s web-server timeout ran out twice while the fixture servers built on the loaded PC. The e2e result therefore comes from CI.

## Problems hit
- Several tests compared `undo(h).present` deep-equal to the earlier object, revision included. They now compare content and assert the new revision: decision-review, explanation-request-draft, explanation-walkthrough, json-drawer, variants-tours and proposal-parity.
- In proposal-parity, a proposal checked again after Undo is now refused as both `stale-revision` and `replay`. A copy relabelled to the current revision is still refused as `replay` alone.

## Remaining issues
- A hand-built document with drilldown cycles, which `validateDocument` refuses, could still need backtracking in `pathToView`/`parentPaths`. Validated documents have no cycles, so the walk is polynomial for them.

## Next steps
- None required. One patch, optional: share one child index between `pathToView`, `parentPaths` and `resolveViewRoute`.
