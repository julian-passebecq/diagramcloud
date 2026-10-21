# Recovery compare-and-delete hardening — 22 October 2026

Scope: extend existing UX45 recovery acceptance. No new feature ID, document
schema, migration, dependency, release version, deployment or private package.

## Qualified predecessor

PR #118 was integrated as `2aa6bc082fc2b772d4c4e79879d8690020ad3faa` after exact-head
`d92b928bb9fea219322191823c5fc96b16c54d4d` passed CI `39674865347`. Its downloaded
artifact `12382192590` matched SHA-256
`805b424f2f12af76d77f9fc89e7d650c5e0d09eec15955e97c15b873eae74f26773`.
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

## Evidence and remaining qualification

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
backup. They require exact-head CI before adoption. No existing test, skip,
assertion, timeout or CI rule is weakened.

The predecessor's green CI does not qualify this differential. Record the new
head's typecheck, full units, build, browser suite and packaging result before
merging. Keep the existing 1.33.0 private package immutable; successor packaging,
installed hosts and any changed export visuals remain separately gated.
