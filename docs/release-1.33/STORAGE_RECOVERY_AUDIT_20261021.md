# Storage recovery audit — 21 October 2026

Status: proposed source hardening, not a release or a completed qualification.

## Baseline and scope

Audited product main is `39a3c9bbdcf6a01307a6032dc6251020eb427349`, version 1.33.0.
Its GitHub Actions run `39615141239` passed. The source used here came from that
run's `diagramcloud-ci` artifact `12352988265`; its ZIP SHA-256 was verified as
`ae02a46315e5dc53fb033b0f9c921f094256bb3d949c1ec2b8ed3520458d818c`.
That green run qualifies the baseline, not these changes.

This is a focused extension of UX45 recovery acceptance, not a new workstream,
feature contract, schema, dependency, release version or storage migration.
The existing backup, explicit recovery and cross-tab conflict boundaries remain.
No main merge, release publication, installed-host proof or deployment is claimed.

## Reproduced defects and repairs

1. **Malformed recovery generations.** Explicitly adopted rows with NaN,
   positive infinity, text or an unsafe large generation either refused repair,
   remained unreadable after saving, or stopped advancing their generation.
   Save now produces a finite safe-integer generation while ordinary valid
   generations still advance. Negative infinity is retained as a passing control.
2. **Recovery can rebind to a changed row.** Recovery reads JSON and then adopts
   the row separately. A replacement or deletion between those operations must
   not authorize saving the older draft. Adoption now requires the exact
   quarantined snapshot observed by `loadWorkspace`; save also compares the
   observed JSON, writer and generation inside its write transaction. Reusing a
   timestamp does not by itself authorize overwriting different content.
3. **Unexpected database close poisons the cached connection.** An IndexedDB
   `close` event now invalidates only the promise that produced that connection.
   A late close event from an older connection cannot invalidate its replacement.
   Known conflict bases survive a reconnect.

Changes are restricted to `src/core/storage.ts`, source regression tests and a
new native-IndexedDB browser specification. These guards are not a universal
corruption-repair, automatic-merge or loss-proof guarantee.

## Evidence from this pass

- Existing targeted storage suite on unchanged source: **25 passed**.
- The 19-case regression selection on unchanged source: **9 passed, 10 failed**.
  It includes 7 existing cases and 12 added cases; passing controls are preserved.
- The expanded targeted suite after repair: **37 passed, 0 failed, 0 skipped**.
- The available broader selection after repair: **225 passed, 0 failed,
  0 skipped**, across 15 modules. This includes the 37 targeted cases; counts
  are not additive. It covers core validation, reliability, public-source
  filtering, saved contexts, patches, decision review, JSON drafts, delivery
  task links, ideation, reading wayfinding, storage, queues and startup conflicts.

Source tests used Node 22.16.0, a TypeScript 5.8.3 transpilation loader, and the
actual Zod runtime source embedded in the baseline CI build's source maps.
This was an isolated bounded runtime, **not** the pinned `npm test` environment
and **not** a semantic TypeScript check. Storage tests use a controlled IndexedDB
request/transaction double, not native browser persistence.

Two broader attempts each emitted 225 passing cases but could not load
`selected-file-read.test.ts`: first the YAML package was unavailable, then an
extracted YAML dependency was absent. Both failed attempts are retained in the
local evidence bundle. The final 15-module selection explicitly excludes that
unavailable module; it is not marked passed or skipped.

Pinned installation attempt `npm ci --ignore-scripts --offline --no-audit --no-fund`
failed with `ENOTCACHED` for `zustand-4.5.7.tgz`. Chromium navigation to the local
baseline app was refused with `ERR_BLOCKED_BY_ADMINISTRATOR` before assertions.
No alternative hostname, browser policy bypass or security override was used.

## Required qualification before adoption

Run the repository's unchanged full CI at the proposed head: pinned dependency
installation, `npm run check`, `npm test`, `npm run build`, CLI/MCP qualification,
`npm run test:e2e` and packaging dry run. Prior main CI is not substitute evidence.

`tests/e2e/storage-recovery-generation.spec.ts` adds **eight unrun native browser
cases**: NaN, positive infinity and text generation repair with save/reload, and
rejection of a newer row through an older recovery warning, each at 1440 and 390
pixels. Existing cross-tab, multi-project, unavailable-storage, backups and
public-boundary journeys must also remain green. No test or CI gate is weakened.

The exact head's CI result, native browser results and any successor package
receipt must be recorded separately. No release-ready claim follows from this
audit document or from the baseline artifact.
