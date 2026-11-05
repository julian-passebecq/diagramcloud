# Lane report: lesson-figure-interaction (independent verification)

Date: 2026-11-05 · Branch: `feat/diagramcloud-lesson-figure-interaction` (PR #152)

## What changed
Nothing in product code. This pass only verified the builder's work and merged current `origin/main` into the branch.

## How verified
- Fresh `npm ci`, `npm run check` (tsc) passes.
- `tests/lesson-figure-interaction.test.ts`, `learning-depth-playback`, `v3-capabilities`, `adoption-journeys`, `learning-catalogue`: 52/52 (cited file:line positions and snapshot digests unchanged; no reserved file or ci.yml edited).
- `npm run build` passes.
- Playwright with `DIAGRAMCLOUD_E2E_PORT=26835`: lesson-figure-interaction 2/2, learning-depth-playback 3/3, learning-catalogue, learning-instance, learning-release-recovery: 15/15 in total. The specs click real overlay buttons, check one shared selection across figure, list and panel, Open inside and Back (focus, lesson depth unchanged, project JSON byte-identical before and after), and a Tab/Enter/Space-only walk at 390x844 without horizontal overflow.
- Invariants read in the diff: selection and drill are navigation state (no revision, no observation, no review mark); the lesson diagram still reads the public projection; no new data source.

## Problems hit
None.

## Remaining issues
Unchanged from the builder's report: depth is scene-wide (per-container expansion: dispatch); no arrow keys between figure buttons (one patch).

## Next steps
Per-container expansion: dispatch. Arrow-key navigation: one patch.
