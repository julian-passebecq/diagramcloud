# Lane report: fix-revision-and-hierarchy (2026-11-04)

Branch `feat/diagramcloud-fix-revision-and-hierarchy`, from `2b5cc9d`. Fixes two confirmed findings from the bug hunt.

## What changed
- `src/core/operations.ts` history: Undo and Redo restore the exact stored document, revision included. `History` carries an optional `highWater`: the highest revision this history has issued, including discarded redo branches. `commitHistory` gives each new edit `highWater + 1`. Before, the next edit after an Undo reused a revision number that was already used, so a `diagramcloud.patch` written for the undone state passed the revision guard. (The first version of this lane raised the revision on every Undo instead, as `src/experience/history.ts` does. That broke Undo as an exact restore in 15 Chromium journeys, so the lead replaced it.)
- `src/core/hierarchy.ts` `parentPaths`: child links are indexed once with duplicates removed (the first component leading to each child view is kept). A reverse search from the target finds the views that can reach it, and the walk follows only those views. It returns early when the root cannot reach the target. The 12-path cap and the `truncated` flag are unchanged.
- `src/core/operations.ts` `pathToView`: the same deduplication and pruning, still depth-first in document node order. It is kept on one line so that the `publicDocument` citation at `operations.ts:9`, used in `journeys.ts` and the self-description fixtures, stays valid.

## How verified
- New regression tests:
  - `tests/core.test.ts`: "undo restores the exact revision, and a new edit never reuses a revision an undone state had".
  - `tests/hierarchy.test.ts`: "duplicate links and unreachable views never make…exponential". It uses a chain of 40 views with two links per hop plus one unreachable view.
- On the unfixed code, the first test failed and the second ran past the 40 s kill (exit 124).
- Equivalence check: a throwaway script compared the old and new `parentPaths` and `pathToView` on every sample document and 5000 random graphs, cyclic ones included. All 40,775 outputs were identical.
- Gates: `tsc` clean. `npm test`: 2217 tests, 2215 passed. The 2 failures are the known Windows CRLF docs-links test and a design-pdf spawn timeout under load, which passed when re-run alone. `npm run build` passed.
- Playwright: the first approach failed 15 Undo journeys in CI. With the high-water design, the `explanation-request`, `json-drawer` and `navigation-context` specs pass 45/45 locally.

## Problems hit
- Raising the revision on Undo made a content-identical Undo look like a source change. Explanation requests went stale, the JSON drawer and navigation drafts expired, and existing tests had to be loosened. That approach was dropped and its test edits were reverted.

## Remaining issues
- A reload starts a new history and forgets the high-water mark. If the persisted copy is an undone state, a patch written before the reload for a later-undone revision could still match. Closing that needs a persisted revision counter (one patch).
- A hand-built document with drilldown cycles, which `validateDocument` refuses, could still need backtracking in `pathToView`/`parentPaths`. Validated documents have no cycles, so the walk is polynomial for them.

## Next steps
- None required. One patch, optional: share one child index between `pathToView`, `parentPaths` and `resolveViewRoute`.
