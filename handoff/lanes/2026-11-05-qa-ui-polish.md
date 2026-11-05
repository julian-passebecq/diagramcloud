# Lane report · qa-ui-polish · 2026-11-05

Branch `feat/diagramcloud-qa-ui-polish`. Source: QA pass 1 (items 1-3) and two second-pass findings (a, b).

## What changed
- **Readable schema refusals (QA 3).** `errorMessage` (`src/core/model.ts`, appended helpers `validationIssues`, `issuePath`, `formatIssues`) turns a ZodError, or an Error whose message is the raw issue array, into one `path: message` line per issue (`nodes[3].label: Expected string, received number`), at most 12 lines plus a count. The JSON drawer, the import dialog and every other `errorMessage` caller benefit; refusals still apply nothing. Helpers sit after line 214 so the cited `validateDocument` line does not move.
- **Header (b).** At 1440 the header actions stay on one row in Explore and Edit (JSON drawer shown or open): no wrap, tighter Fluent button padding, the theme toggle is a 32x32 button centred with the others. `Edit view details` / `Reuse existing component` (and their form buttons) use the app button style (`.view-inline-edit`).
- **Lesson at 390 (QA 1).** The `Lesson diagram source` label wraps and the select shrinks (`.lesson-diagram-source`), so the page no longer scrolls sideways.
- **Context tabs (QA 2).** The `Alternatives` tab that broke mid-word at 1280-1440 is the Project context `Context scope` tablist (not CompanionPane's own tabs, which were already fixed). Its tabs now keep whole labels and the row wraps between tabs (`src/ui/project-intelligence.css`).
- **Concept to lesson (#138 follow-up).** App passes `onLesson` to CompanionPane: a related concept opens its catalogue lesson and switches the compact workspace to the primary pane so the lesson is visible at 390. The Concepts list is now `CompanionConcepts` (exported) so its read-only form without a handler is unit-tested.
- **Explanation authoring (a).** Walkthrough ID, Title, Question to explain, Step title and Narration are marked `(required)` with `aria-required`; the form uses `noValidate` so the app's own message shows. A refused Review (or validated download) reads one sentence per field (`src/intelligence/explanationRequestErrors.ts`): "Question to explain is required.", "Step 1 question 1 (in Case, prerequisites and questions) is required.". Nothing is filled in or trimmed. The top-level Question field was already outside the collapsed details at this cut; the per-step questions stay in that section and are named with it.

## How verified
- `npm run check` clean; `npm test` 2301 tests, 2298 pass, 0 fail, 3 skipped; `npm run build` ok.
- New unit tests: `tests/readable-errors.test.ts` (3), `tests/explanation-request-errors.test.ts` (3).
- Playwright (`DIAGRAMCLOUD_E2E_PORT=26710`, 1440 default plus 390/1280 cases): new `tests/e2e/qa-ui-polish.spec.ts` (5), new cases in `v3-companion.spec.ts` (concept-to-lesson open, 1440 and 390) and `explanation-request.spec.ts` (required fields and readable refusal); also ran json-drawer, learning-depth-playback, keyboard-walk-mobile, learning-catalogue, explanation-request-files, explanation-draft-recovery, authoring, context-pane-tabs: 58 passed, 2 failed (the known flaky `quota failure retains keyboard focus`; this lane does not touch draft recovery).
- The tab-wrap test was checked to fail with the CSS fix removed.

## Problems hit
- `v3-companion.spec.ts` asserted the Concepts tab was a read-only list "without an onLesson host handler". Wiring the handler in App makes that state unreachable in the App, so the e2e line now expects the three lesson buttons and the read-only state moved to a component test (`CompanionConcepts` rendered without `onLesson`).
- `quota failure retains keyboard focus 1440` failed on two runs here (checkbox reverts too fast for Playwright's `check`); listed as a known flake.

## Remaining issues
- Header at widths between 1150 and about 1300 in Edit with Project atlas and Recovery buttons present was not measured; only 1440 is asserted. Size: one patch.
- `quota failure retains keyboard focus` flake: make the test use `click` plus an explicit state assertion instead of `check`. Size: one patch.

## Next steps
- QA follow-ups 4-8 in the QA notes (AI_GUIDE patch note, Mermaid cap, Visio budget, App file-size check, meeting-summary omission notice). Size: dispatch (one patch each).
