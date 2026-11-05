# Lane report: companion-concepts-detour-return (1.34.0 P2), 2026-11-04

## What changed
- `src/core/companionPane.ts`: new `concepts` tab (`companionConcepts` over `conceptsExplaining`, audience-projected), `companionPaneTabs`, selected-question binding (`companionQuestions`, `resolveQuestion`), detour record with project ID, revision, audience and reading state (tab, filters, question), and `resolveReturn` that refuses with the generic `VIEW_ROUTE_UNAVAILABLE` message.
- `src/ui/CompanionPane.tsx`: Concepts tab (state labels, stale reasons, cited evidence; read-only unless the optional `onLesson` prop is passed), "Selected question" radio group in Questions, Return restores tab, filters and question, refused detour shows only the generic notice and End detour.
- `src/ui/contextPane.css`: styles for the question group and concept rows.
- `docs/contracts/companion-return.md`: the contract.

## How verified
- `npx tsc --noEmit` clean; `npm run build` ok.
- `tests/companion-pane.test.ts`: 12/12 (6 existing unchanged, 6 new: tab only with stored mapping, public hides suggestions and private mappings, question binding, detour round-trip, refusal after audience switch / node removal / revoked view / other project, cross-audience hop).
- `tests/e2e/v3-companion.spec.ts`: 3 existing cases unchanged plus 3 new (1440 and 390 journey, 390 keyboard path).
- `npm test`: 2221 tests, 2216 pass, 2 fail, both outside this lane's files (`tests/adoption-journeys.test.ts` cites `.github/workflows/ci.yml:43`; `tests/release-entry-docs.test.ts` README anchor `#exports-and-fidelity`), so they come from the base `5da1806`.
- Playwright (port 26210): `v3-companion`, `explanation-request`, `question-answers-app`: 24/24 passed, at 1440 and 390.

## Problems hit
- In the App, switching to Portfolio remounts the companion, so an author detour is dropped there rather than refused; the e2e checks that no Return or private label survives, and checks the refusal through an origin removed by an import during the detour.
- Worktree guard refuses compound shell commands with heredocs; edits went through the Edit tool.

## Remaining issues
- App does not pass `onLesson` yet (P7 owns `src/App.tsx`): one patch, `onLesson={openLesson}` on the `CompanionPane` mount.
- Selected question and detour are not saved in saved contexts or deep links (by design for now).

## Next steps
- P7: wire `onLesson` and add the concept-to-lesson e2e (one patch).
- P8: update UX31/UX32 rows and the AGENTS.md limits paragraph for the companion (one patch).
