# Lane fix-wave4-findings (2026-11-05)

Fixes four verified medium findings from the wave-4 review, each with a regression test in `tests/wave4-findings.test.ts`.

## What changed

- **Mermaid `a & b & …` lists were quadratic** (`src/core/interchange/mermaid.ts`). `readNodes` now keeps a Set beside the key array instead of `keys.includes`. The node ID and `&` regexes are sticky and compiled once, not once per reference. A second quadratic path turned up while measuring: splitting a long `a;b;c…` line with the quote-parity lookahead regex. It is now a one-pass split with the same semantics (`;` inside a quoted label still does not split). Measured: 160k refs (1.5 MB) in 0.17 s, where 40k used to take about 10 s. 20k `;` statements went from 2.0 s to 0.05 s.
- **draw.io deep parent chains were quadratic and overflowed the stack** (`src/core/interchange/drawio.ts`). The cycle check is now one pass with three states. It still detaches only the cell that closes a cycle, and the count is unchanged. `owner`, `abs`, the container part of `groupOf` and placeholder resolution are memoised per cell and run without recursion. An 80k-deep chain (12 MB) parses in 0.7 s. Before the fix, a 40k chain threw `RangeError: Maximum call stack size exceeded` after 82 s.
- **Meeting summary PPTX wrote XML-forbidden control characters** (`src/export/meetingSummaryPptx.ts`). The deck model now goes through `xmlSafe`, so every slide and notes part is covered, not only the figure slide. The `esc` in `projectOverview.ts` also applies `xmlChars`. The meeting summary HTML already used `xml()`, which does this.
- **MCP mapping suggestions arrived stale** (`src/intelligence/learning/query.ts`, new `mappingBasis.ts`). `proposeMappingSuggestion` records `target.fingerprintBasis: "public"`, an optional field added to the schema in `src/core/model.ts:126` on the same line. `mappingStatus` compares such a suggestion with `targetFingerprint(publicDocument(project))`. A target that leaves the public projection reads stale with its own reason. The basis counts only while the mapping is `suggested`. `reviewMapping` rebinds to the authoring fingerprint and drops the basis, and `publicLearningMappings` never carries it. A reviewed mapping that claims a public basis is still compared with the authoring copy. The MCP reply still hashes only public content. The contract is documented in `docs/contracts/concept-instance-mappings.md`.

## How verified

- `tests/wave4-findings.test.ts` has 5 tests. Against origin/main source:
  - The draw.io chain test failed with a RangeError.
  - The PPTX and mapping tests failed.
  - The Mermaid test did not finish: the same input took over 60 s in the bench.
  - The cycle and placeholder test passed, as intended, because it guards that behaviour is preserved.

  All 5 pass after the fix.
- `npm run check` passed. `npm test`: 2313 tests, 2310 pass, 0 fail, 3 skipped. `npm run build` passed.
- Playwright with `DIAGRAMCLOUD_E2E_PORT=26840` on interchange, meeting-summary, pattern-guidance, quantity-import and import-race: 30 passed.
- Cited lines were not moved: `mappings.ts` lines 80 and 95 are unchanged, the `model.ts` edit is on the same line, and `src/export/drawio.ts` was not touched.

## Problems hit

- The worktree guard refuses compound shell commands. Checking the old behaviour was done with a temporary WIP commit and `git checkout origin/main -- src`, then restored.

## Remaining issues

- draw.io `frames` detection (`vertices.filter(... vertices.filter(inside))`) is still O(n²) on a flat page with many labelled, unreferenced boxes, and `groupOf`'s frame lookup is O(frames) per cell. Sizing: one patch (spatial bucketing or a cap on candidate frames).
- The time-based tests use an 8 s bound, which is about 25 times the measured cost. A very slow CI runner could still flake them.

## Next steps

- The flat-page frames quadratic: one patch.
