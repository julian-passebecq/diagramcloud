# DiagramCloud 1.33.1: storage recovery and persistence fixes

A patch release on top of [1.33.0](RELEASE_NOTES.md) (`3e907db`). No new feature, acceptance row, document schema change, dependency or model change. Document schema stays 1. It packages the fixes merged on `main` after 1.33.0; each PR records its own exact-head CI.

## What changed

- **Recovery generations, stale rows and closed connections (#118).** An adopted save generation that is not a safe number (NaN, infinity, text) is normalised on the next save, and ordinary saves stay monotonic. Recovery adoption is bound to the exact quarantined JSON, writer and generation; a replaced or vanished row is refused, and the save transaction compares the full observed basis instead of a reused timestamp. An unexpected IndexedDB `close` invalidates only that connection attempt, so the next operation reconnects.
- **Stale recovery deletion and same-writer overwrite (#119).** An old recovery warning can no longer delete a newer replacement row; deletion compares the observed basis and deletes inside one read/write transaction. Deleting an externally removed row keeps the conflict guard (no silent re-creation), deletion refuses rows this tab never observed, and a save compares the full basis even when the stored row carries this tab's writer. [Audit](RECOVERY_CAS_20261022.md).
- **Reopenable saves and repository write guards (#120).** The existing 12 MiB UTF-8 import limit now applies before a local or repository write, so a save that could not be reopened is refused and the previous stored copy is kept. Requested bytes and the repository base are captured before any await. Writes through the same repository handle are serialised and a stale queued base is refused, never silently rebased. A failed review read no longer erases the uncertain-write receipt, and a rejected save never recreates an externally deleted sidecar as an empty file. This is not an operating-system file lock against external editors, other tabs or another handle to the same file; the UI says so. CI job timeout raised to 40 minutes. [Audit](PERSISTENCE_BOUNDARIES_20261022.md).
- **Current release guidance (#122).** README, ROADMAP and RESUME are current entry documents; their earlier text is preserved byte-for-byte in dated `*_HISTORY_20261021.md` files, checked by `tests/release-entry-docs.test.ts`.

## New tests

Unit: `tests/storage-recovery-contract.test.ts` (extended), `tests/storage-connection-close.test.ts`, `tests/persistence-boundaries.test.ts`, `tests/release-entry-docs.test.ts`. Browser (Chromium, 1440 and 390): `tests/e2e/storage-recovery-generation.spec.ts`, `tests/e2e/storage-recovery-delete.spec.ts`, `tests/e2e/storage-size-boundary.spec.ts`.

## Limits

- Storage and persistence fixes are qualified in Chromium only; File System Access writes are tested with controlled doubles where stated, not on a real operating-system file lock.
- PPTX export code is unchanged since 1.33.0 (`src/export` has no change); the PPTX decks are re-checked only as the package gates record them.
- The installed VS Code / Cursor host result for this version is stated in the release pull request; nothing here claims it beyond that record.
- No tag, public release, Marketplace publication or separately verified deployment.

## Qualification

The release branch ran `npm run check`, `npm test`, `npm run build` and the full `npm run test:e2e`; the pull request records the counts for its exact head and the CI run. The private package is recorded separately in `outcome.json` `privatePackages` after merge.
