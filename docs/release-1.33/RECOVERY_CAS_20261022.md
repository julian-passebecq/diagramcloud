# Recovery compare-and-delete hardening — 22 October 2026

Scope: extend existing UX45 recovery acceptance. No new feature ID, document
schema, migration, dependency, release version, deployment or private package.

## Qualified predecessor

PR #118 was integrated as `2aa6bc082fc2b772d4c4e79879d8690020ad3faa` after exact-head
`d92b928bb9fea219322191823c5fc96b16c54d4d` passed CI `39674865347`. Its downloaded
artifact `12382192590` (67,702,374 bytes) matches SHA-256
`235843550da51c831152bc17daa5737ea1158ecb83776f237e45d9289139a46c8ab`.
This digest was recomputed from the downloaded ZIP and matched to GitHub metadata.
It corrects the earlier incorrect `805b424f...` digest in this audit and prior
qualification comments; historical commits and the delivered package are not rewritten.
The browser report contains 332 passed, zero failed/flaky and five existing
optional external-host skips. All eight recovery-generation cases passed.
The receipt and SOURCE_COMMIT.txt name d92b928; the integrated tree is identical.
This is not installed-host proof or a new release receipt.

## Additional reproduced defects

- An old recovery warning could delete a replacement project, including one
  with the same timestamp. Confirmation authorized an ID, not the observed row.
- Deleting an already externally removed row could clear the remembered basis,
  permitting the old tab to recreate it silently on its next save.
- A caller could delete a row it never observed.
- A restored row retaining this tab's writer ID bypassed the content/generation
  guard, despite differing from the last observed or saved copy.

Deletion now reads, compares and deletes within one read/write transaction.
It captures the expected quarantined or healthy row before awaiting storage.
Missing or changed rows reject without clearing conflict state. Unchanged rows
still support explicitly confirmed deletion and deliberate recreation.
Saves compare the full observed basis regardless of writer equality.

The guard compares the existing row basis (JSON, writer and generation), not
an immutable audit log. It is conflict detection, not collaboration, a security
boundary against other scripts on the origin, or universal corruption recovery.

## Source evidence

Six new source cases contain five failing baseline regressions and one passing
control. The 23-case recovery-contract selection on the predecessor produced
18 passes and five failures; after repair the five-module storage/queue/startup
selection produced 43 passes, zero failures/skips. Counts are not additive.
Local execution uses Node 22.16.0, TypeScript 5.8.3 transpilation and the actual
Zod sources recovered from the verified predecessor's source maps. Protocol
doubles are not native IndexedDB; this is not a pinned npm build/typecheck.

Eight new Playwright cases at 1440 and 390 pixels cover a replacement arriving
in another real tab after confirmation opens, disappearance, unchanged-row
deletion/reload and same-writer replacement with preservation of the author's
backup. No existing test, skip, assertion, timeout or CI rule was weakened.

## Qualification and integration

PR #119 exact head `e286afe6647893bb2215b8d05518abb633c2d6a2` passed complete CI
`39690285115`: semantic typecheck, full units, CLI/MCP qualification, production
build, Chromium browser tests and Linux packaging dry run. All eight new browser
cases passed. The report totals 340 passed, zero failed/flaky and five existing
optional external-host skips; these counts include the predecessor's cases.

Downloaded artifact `12388134456` (67,691,779 bytes) matches SHA-256
`1e65161042735456e0843257a85132dada3325f35f5b49afe5c0c10ab6de6ede`.
The receipt and SOURCE_COMMIT.txt identify e286afe. PR #119 integrated as
`f54550df414ddfc45b4a0552bbb81afe04187754` only after that qualification.

These results qualify the named source, not a later documentation or persistence
head. Keep the existing 1.33.0 private package immutable; successor packaging,
installed hosts and any changed export visuals remain separately gated.
