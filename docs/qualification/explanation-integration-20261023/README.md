# Explanation integration: local and CI qualification

Source: d7ceb456c6905e6277cdeb1dea801298bd7e77e9. Source tree: b90ea89563174a2921047a7e239c5c190e58fc50. [Integration PR #131](https://github.com/julian-passebecq/diagramcloud/pull/131) owns the adoption decision. This evidence branch archives local and CI receipts for that source; it is not the product release branch.

## Outcome

Combined #129/#130 and repaired two draft-loss paths: review Escape/Close returns to the request; undoing Tours initialization preserves the original draft and refuses stale review/apply. User/AI/UX31/native documentation is reconciled.

Node 22.23.4: TypeScript and production build PASS; full units 2,030 PASS / 0 FAIL / 3 SKIP; full Chromium 362 PASS / 0 FAIL / 0 flaky / 5 SKIP using four workers; all 12 explanation cases pass at 1440/390, included in that total. Isolated bundled CLI/MCP 21 PASS. Windows packaging dry run PASS, 12/12 checksum entries matched, DRY-RUN only. The verification receipt identifies clean source d7ceb456 and E2E_VERIFIED. Fresh independent GitHub fetch matched commit/tree.

## Independent CI evidence

[CI 39976506510](https://github.com/julian-passebecq/diagramcloud/actions/runs/39976506510), job 120492380749, passed every step: TypeScript, 2,030 units / 0 failures / 3 skips, 21 isolated bundled-client checks, production build, 362 Chromium cases / 0 failures / 0 flaky / 5 skips, verification receipt, Linux packaging dry run and artifact upload. All 367 browser cases have one result in the downloaded report; all 12 explanation-editor cases passed.

Artifact 12513746196 is 68,693,346 bytes. Its downloaded ZIP SHA-256 matches GitHub's API digest: aa85fb915226c963f6f6256bdf27000d804fa0a9cc77faae596bb1883917a053. All 372 ZIP entries pass CRC; both nested source archives match all 923 tracked Git blobs byte for byte, including all 20 changed files. The source/build archive checksum, all 12 Linux dry-run checksum entries, and the 127-file dist manifest match. The independent audit under ci/ retains the comparisons and verification script. Playwright gitCommit is the checked-out d7ceb456 source; metadata.ci.commitHash is the PR event merge identity da8e05d68bcceda7b7d80455f68a69cd67452a45, not the tested source.

CI unit skips differ from local: PDF unit case 502 runs before CI installs Chromium, optional real-atlas case 1495, and optional Z025 case 2031. Chromium is installed for the later passing browser step. The five browser skips remain optional external owner-viewer checks. Neither environment's omitted checks are silently counted as passed.

## Visual evidence

visual/ contains 16 screenshots and a hash manifest from disposable Chromium contexts. Review -> Back retained every downloaded request field and original source basis; Apply added one revision and tour. No page errors, remote requests, observed overlap or horizontal overflow. AI screenshot inspection, not human owner approval.

pptx/ contains a synthetic two-slide deck copied from an individually passing custom-icons case in the interrupted first browser attempt. ZIP CRC passed. PowerPoint 16.0.14334.20974 opened only that copy read-only, exported both slides, and left its bytes unchanged. Both PNGs were inspected without obvious clipping, overlap or distortion. This bounded check is not all-export or installed-host acceptance.

## Problems, attempts and questions

The first local unit attempt had 2,029 PASS / 1 FAIL / 3 SKIP: source identity was absent under concurrent load. No source/assertion changes were made; the 15-case module and complete bounded rerun passed. The first serial browser attempt was interrupted to run the same suite with four workers and is not a complete-suite receipt. Logs retain both attempts. The existing large-bundle warning remains.

Unit skips: Windows symlink privilege, optional private real atlas, optional Z025 metadata gate. Browser skips: five optional external owner-viewer cases. No private fixtures were invented.

Remaining decision: the native integrator selects final adoption/version/package under the handoff's release authority, then validates the resulting exact deployed source. Main/live production was independently read at 2ea334fa80f44b42f1b1e670e4193b09f7df0b27. No production merge, new release package, installed-host update or broader Studio wave is claimed. Preserve existing packages and owner worktrees.

## Artifact identities

SHA256SUMS.txt covers the published evidence bytes. Logs are exact local outputs; screenshots and receipts are synthetic/reference qualification artifacts. The full source CI artifact and final checks are linked from PR #131.
