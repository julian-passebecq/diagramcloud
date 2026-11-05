# Lane report · 2026-11-05 · source-refresh-return-context (P7)

## What changed
- `src/intelligence/refresh.ts`:
  - New pure `refreshSummary(current, proposal, {repositoryId?, audience?})`. It reports added, changed, uncertain (never removed), unavailable, retained authored evidence, and authored evidence the proposal does not retain. A public audience reads `publicDocument` only.
  - New `resolveRefreshReturn`: it reopens the exact permitted path. Otherwise it refuses with `VIEW_ROUTE_UNAVAILABLE`.
  - `NOT_ESTABLISHED` tag constant. A component that a later scan establishes again now loses that tag and returns to `static-source`. Before, it kept the tag forever.
- `src/ui/SourceRefreshSummary.tsx` (new): the summary panel shown in the JSON review of an atlas rescan. Inline styles only, no new CSS.
- `src/ui/Atlas.tsx`: one note explaining the refresh review and the return.
- `src/App.tsx`:
  - The rescan captures its return context (project, path, view, node, sheet).
  - The review shows the summary.
  - Apply and Cancel return to that view, or refuse with the generic message.
  - The legacy "Diagram from a repository" picker registers with `analysisJob` and passes `abort.signal` to `scanPickedFolder` (lifts the 1.29 limit).
- `docs/contracts/source-refresh.md` (new contract).
- `tests/fixtures/repo-shop-refresh/` (new): a reduced synthetic repository.

## How verified
- `npm run check`: clean.
- `npm test`: 2231 passed. 1 failed: the known Windows-only CRLF failure "entry documentation local links …".
- `tests/intelligence-refresh.test.ts`: 6/6. `tests/scan.test.ts`: 9/9, including the new legacy cancel test.
- `npm run build`: OK.
- Playwright, `DIAGRAMCLOUD_E2E_PORT=26610`:
  - `tests/e2e/atlas.spec.ts`: 3/3. The new case runs at 1440 and 390 px: rescan, summary, Apply returns to the same view with the same card selected, one Undo, Cancel returns, a revoked view is refused, no horizontal scroll.
  - interchange, perspectives, project-intelligence, import-race and v3-companion: 17/17.

## Problems hit
- Scanned cards overlap on the `shop.overview` canvas, so a plain click on the first card is intercepted by another node. The test selects the first card that a real click reaches. The overlap itself is a layout limit and was not changed here.
- Selecting a card that has a child view extends `path` below the active view. The return therefore checks the prefix down to the active view, keeps deeper levels only if they are still permitted, and closes them otherwise.

## Remaining issues
- `onLesson` is not wired into CompanionPane. PR #138 was still OPEN when this PR was opened, so the plan's v3-companion concept-to-lesson e2e case is not added either.
- PR #143 (meeting summary formats) was also still OPEN, so the export menu label was not reviewed against it.
- The legacy picker has no visible Cancel button while it runs. It is aborted when another analysis starts or the start dialog closes, as for the other analyses.

## Next steps
- Wire `onLesson` into CompanionPane in `App.tsx` and add the v3-companion "concept opens lesson" case once #138 is merged. Size: one patch.
- Check the "Meeting summary" export entry label once #143 is merged. Size: one patch.
- Optional: a Cancel control on the busy banner for every analysis job. Size: one patch.
