# Lane report: readiness-purpose-badge (P6, 1.34.0 plan) - 2026-11-04

## What changed
- `src/intelligence/readiness.ts`: presentation helpers only. `purposeBadge(report)` wraps `completeForPurpose` with the text "Complete for <purpose>" or "N required gap(s) open for <purpose>", the notice `PURPOSE_BADGE_NOTICE` ("Not a completeness percentage, runtime certificate or review.") and the required gaps (id, title) it links to. `readinessDownload(report)` is the report plus `purposeBadge`. No new rule: the badge fields equal `completeForPurpose`.
- `src/ui/ProjectReadiness.tsx`: the badge sits under the purpose select in the JSON / AI readiness panel (`data-testid="readiness-purpose-badge"`, `role="status"` so a purpose change is announced). Each required gap has a "Go to gap: <title>" button that scrolls to and focuses that gap's list item (`tabIndex=-1`). "Download readiness JSON" now writes `readinessDownload(report)`.
- `src/ui/project-intelligence.css`: badge styles (words and a border colour only; no progress bar or percentage).

## How verified
- `npx tsc --noEmit` clean; `npm run build` OK.
- `tests/intelligence.test.ts`: two new tests (complete and incomplete badges, singular/plural, equality with `completeForPurpose` for all 7 purposes, no percentage or ratio, download carries the same badge, report not mutated).
- `tests/e2e/readiness-badge.spec.ts` (new), at 1440 and 390 px: badge text follows the select for every purpose and matches the pure helper on the App's project, link click focuses the gap, Tab from the select reaches the first gap link and Enter focuses the gap, downloaded JSON carries the badge, Project JSON unchanged, no horizontal overflow. With `intelligence.spec.ts` and `independent-journeys.spec.ts`: 6 passed.
- `npm test`: 2217 tests, 2212 pass, 2 fail, 3 skipped. Both failures are outside this lane and unrelated to its files: `tests/adoption-journeys.test.ts` (".github/workflows/ci.yml:43 still contains if: always()") and `tests/release-entry-docs.test.ts` ("README.md: #exports-and-fidelity has a heading").

## Problems hit
- None in the feature. The two unit failures above come from the base (ci.yml and README.md are not touched here).

## Remaining issues
- The badge is only in the JSON / AI readiness panel; the Project overview and V3 workspace show no badge (not asked).
- AGENTS.md still says "the readiness panel shows no badge for it" (1.29 limit): P8 owns AGENTS.md and should drop that sentence.

## Next steps
- P8 removes the 1.29 "no badge" limit from AGENTS.md and lists this PR in the 1.34.0 notes - one patch.
- Fix the two pre-existing unit failures (self-description citation of ci.yml:43, README anchor) - one patch.
