# Lane report: fix-public-boundary-leaks (2026-11-04)

Branch `feat/diagramcloud-fix-public-boundary-leaks`, from `2b5cc9d`. Bug-hunt findings 4, 9 and 10.

## What changed
- **Proposal validator** (`src/core/proposal.ts`): a non-author proposal that records or rewrites a choice's `reviewBasis`, or adds or changes an option's `compatibility` record, is refused with `self-review`. Removing either stays allowed (it only lowers trust). The check lives in `decisionClaims`, called from `reviewClaims`, so manual import, CLI `validate-proposal` and MCP `diagramcloud_validate_proposal` give the same reasons.
- **MCP propose_mapping** (`src/intelligence/learning/query.ts`): the suggestion, its ID, the duplicate check and the dry-run apply now use the public projection only. A pair held only by a private, suggested or rejected mapping gets the same patch as an unmapped pair; the author's import review then refuses the duplicate without mutation. The patch always appends with `add /learningMappings/-`.
- **Patch extension** (`src/core/patch.ts`): `add` at `<member>/-` creates an absent array member. Without it, a patch built from the public projection would have to emit `add /learningMappings`, which replaces any private mappings the writer cannot see.
- **Atlas manifest** (`src/core/atlas/manifest.ts`): a Galaxy app without a repo is located by its Galaxy ID, never its local filesystem path. `path` is kept for scanning and does not reach the public snapshot or facts.
- Cited lines (`src/core/patch.ts:113`, `src/core/proposal.ts:101`) were kept in place: the new code is in helpers placed after them, so no journey or anchor citation changed.

## How verified
- New regression tests, each confirmed failing against the unfixed `src/`: `tests/proposal-parity.test.ts` (two new parity cases through manual/CLI/MCP, plus a test for origins and the removal cases), `tests/public-noninterference.test.ts` (AC16 propose_mapping, in process and over MCP, three hidden mapping states, import refusal without mutation, private mapping of another pair survives the append), `tests/atlas.test.ts` (local path never in the public document), `tests/patch.test.ts` (the append extension).
- `npx tsc --noEmit` clean; `npm test` 2218 tests, 2214 pass, 3 skipped, 1 fail (the known Windows-only CRLF failure 'entry documentation local links resolve…'); `npm run build` ok. No Playwright spec was touched.

## Problems hit
- The first version of the fix moved lines that `journeys.ts` and the v3 self-description anchors cite. Fixed by putting the new code into hoisted helpers after the cited lines, never by editing the citations.
- A first `npm test` run under load had 6 `spawnSync ETIMEDOUT` failures (git/identity/CLI tests); the rerun passed them.

## Remaining issues
- Compatibility records are compared per `requirementId` with canonical JSON. A reordering of records is not a claim, and two records of one requirement are already refused by `validateDocument`.
- The in-App import still shows its own non-blocking caution as well (decisionReview.ts); it now also gets the validator's refusal.

## Next steps
- None required. Optional (one patch): name the `add …/-` creation extension in docs/AI_GUIDE.md if agents should rely on it when writing patches.
