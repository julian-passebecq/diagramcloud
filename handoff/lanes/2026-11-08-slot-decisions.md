# Lane report: slot-decisions

Date: 2026-11-08 · Branch: `claude/slot-decisions` (base `origin/main` e5ff301)

## What changed
A choice can now describe one variable part of a system (a "slot") whose options are candidates tested by experiments. Additive, `schemaVersion` stays 1.
- **Model** (`src/core/model.ts`): option `testPlan` (string 1..500, Planned/designed) and `rejection: {reason, decidedAt, decidedBy?}` (strict); choice `observationIds` (max 50). `validateDocument` refuses an unknown observation ID, a rejection on the chosen option and a rejected recommendation. Lines were kept so `validateDocument` stays at model.ts:214 (cited by the self-description journeys).
- **Redaction** (`publicDocument`): a choice keeps only cited observations that are Presented (reviewed, public, about a kept component); an emptied list is deleted, so the count of dropped ones never shows. `rejection.decidedBy` is kept, like `decidedBy`.
- **Fingerprint** (`choiceFingerprint`): test plans, rejection reason and date, and cited observations (content and reviewed flag) join the print only when present, so earlier decisions keep their print.
- **Proposals** (`src/core/proposal.ts`): recording or changing a rejection is `self-review` (like accepting); a test plan or observation IDs may be proposed.
- **Helpers** (`src/core/decisionReview.ts`): `optionSlotState` (adopted only for an accepted decision's chosen option, then rejected, under test, candidate) and `citedObservations` (reviewed, awaiting-review, missing).
- **Inspector** (`src/ui/Choices.tsx`): per-option chip and rejection/test-plan lines; cited observations with date, summary and review state.
- **Figure** `decisions` (`src/export/design/decisions.ts`, registered in `DESIGN_TYPES`, index, availability, recommend): one row per public slot, wrapped candidate cells, reviewed observations as "Observed <date> · <summary>", decision line. Withheld with the "what is missing" panel when there is no public choice.
- **Sample**: the agent work map gets two illustrative slots (memory layer, accepted with one rejection; model per role, candidate with test plans); still zero observations.
- Docs: AI_GUIDE Choices section and chooser table (24 figure types), one sentence in AGENTS.md.

## How verified
- `npx tsc --noEmit`, `npm run build`: pass.
- Unit: `tests/slot-decisions.test.ts` (5 new), `proposal-parity` (2 new cases, CLI/MCP parity), `decision-review`, `design-quality` (renders `decisions` on every sample view), `ai-guide`, `agent-systems-workmap`, `design-contract`, `design-withhold`, `comparison-figure`, `adoption-journeys`, `v3-capabilities`; full suite run locally.
- Playwright (`DIAGRAMCLOUD_E2E_PORT=24573`): new `slot-decisions.spec.ts`, plus `json-drawer`, `evidence-figures`, `design`, `agent-systems-workmap`: 10/10.

## Problems hit
- Adding schema lines moved `validateDocument`, breaking two file:line citation tests; lines were merged instead of re-citing.

## Remaining issues
- No Edit-mode form to record a rejection or a test plan; they are written through the JSON drawer or a patch (an author-origin patch may record a rejection).
- View-owned choices are drawn by the figure but still not shown in the Inspector (unchanged).
- The PPTX deck picks the figure up through the shared renderer; not inspected in PowerPoint.

## Next steps
- Edit-mode "Reject candidate" action with a named person and date (mirrors Accept); size: one patch.
