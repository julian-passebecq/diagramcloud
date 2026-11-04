# Lane report 2026-11-04 · explanation-revise-and-remove (P3, DiagramCloud 1.34.0 plan)

## What changed
- `src/intelligence/explanationWalkthrough.ts`: the generator is split into source facts + a pure renderer (prepare output byte-identical; `scripts/generate-expressiveness-examples.ts --check` still passes). New `readExplanationWalkthrough` (reverse reader: rebuilds the v1 request from tour, notes and `explanation-details/1` records, re-renders it at the recorded cut and refuses any differing copy), `listExplanationWalkthroughs`, `reviseExplanationWalkthrough` (one replace patch over exactly that walkthrough, bound to the current full-source fingerprint) and `removeExplanationWalkthrough`.
- `src/intelligence/explanationRequestDraft.ts`: `startExplanationRevision`, `prepareExplanationRevision` (walkthrough ID fixed), `prepareExplanationRemoval`.
- `src/ui/ExplanationAuthoring.tsx`: Edit → Tours shows "Existing explanation" with Revise / Remove (aria-disabled with the refusal reason when not reconstructable); one review modal for author / revise / remove with an effects list (kept/added/dropped steps, stale and removed answers, removed story steps, kept public visibility).
- `src/ui/ExplanationRequestDialog.tsx`: revise mode (dialog "Revise an explanation", read-only ID, "Review revised explanation"); `src/ui/explanationRequest.css` small additions.
- `docs/contracts/explanation-revision.md` (new).

## How verified
- `npx tsc --noEmit` clean.
- New `tests/explanation-revise.test.ts` (38 tests): the six committed example project files read back to their committed requests; each example revises with stable IDs and stop IDs and removes back to the exact source; public example projects keep visibility; one revision + one Undo for revise and remove; stale binding refused; nine hand-edit kinds refused without mutation; ambiguous source view and ID collisions refused; answers stale on kept steps, removed and listed on dropped steps; public projection unchanged.
- Related unit tests (`tests/explanation-*.test.ts`, `tests/question-answers.test.ts`): 160/160 pass. `npm test`: 2253 tests, 2246 pass, 4 fail, 3 skipped. The 4 are not in files this lane touched: `adoption-journeys` (`.github/workflows/ci.yml:43` still has `if: always()`) and `release-entry-docs` (README `#exports-and-fidelity` anchor) fail on the base stack too; `build-source-revision` and `package-build-preflight` timed out under load and pass when rerun alone (21/21).
- `npm run build` passes; `scripts/generate-expressiveness-examples.ts --check` reports examples current.
- New `tests/e2e/explanation-revise.spec.ts` at 1440 and 390: revise → review → Apply → Undo restores exactly; remove → Apply → Undo; edited stop refused with a reason by keyboard. Affected specs (explanation-request, explanation-request-files, explanation-draft-recovery, explanation-revise, v3-companion): 41 run, 39 pass. The 2 failures are `explanation-draft-recovery` "quota failure retains keyboard focus" (`locator.check` races the quota refusal that unchecks the box); it fails on the base build too (1440 failed there, 390 passed) and is flaky on this branch (3 of 4 repeats failed), and this lane does not touch draft recovery.

## Problems hit
- Playwright's 30 s webServer start timeout was exceeded on this loaded PC (the fixture servers rebuild with Vite on start). Ran the specs through a scratch wrapper config that only raises that timeout; `playwright.config.ts` is unchanged.
- The request format never recorded a step's source view; the reader accepts only a single candidate view and refuses otherwise.

## Remaining issues
- Pre-existing flaky `explanation-draft-recovery` quota test: one patch (assert the unchecked state instead of `check()`), owner of that spec.
- Source view is inferred (unique candidate). Recording it in generated content would remove the ambiguity but changes generator output and the committed examples — one patch.
- Any hand edit of generated content (including a narration edit in Tours) blocks Revise/Remove; no merge of edits into the request — dispatch if wanted.
- A frozen excerpt whose cited code changed cannot be checked for hand edits; Revise refreshes it from current code (visible in review) — documented limit.
- App/AGENTS/V3_WORKSPACE/EXPRESSIVENESS rows for UX31 are P8's to update.

## Next steps
- one patch: record the source view of each step in generated content (and regenerate examples) so ambiguous views stop blocking Revise.
- one patch: P8 notes the closed EXPRESSIVENESS authoring limit ("applied walkthrough cannot be reopened or removed").
