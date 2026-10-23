# Current continuation — 22 October 2026

Source version: `1.33.1` (patch release of #118, #119, #120 and #122; [notes](docs/release-1.33/RELEASE_NOTES-1.33.1.md)). Read [the roadmap](docs/ROADMAP.md) for selected scope and [release verification](docs/RELEASE.md) for release gates. This file is the resumable source checkpoint, not an installed-release claim.

## Current proposed closure and Claude handoff

**Done 22 Oct 23:07 UTC:** #125 (`b3bd161`) and #126 (`0892f9d`, Vercel source identity) merged on green; production serves 1.33.1 with `source_revision` `0892f9d`, and the four deployed cases pass at 1440/390. Private package `diagramcloud/1.33.1-0892f9d` published 23 Oct ([package 73509686](https://gitlab.com/juliandatapass-group/galaxy-release-vault/-/packages/73509686); 14/14 authenticated re-download hashes match, anonymous access refused; receipt in `outcome.json` `privatePackages`). Outcome table in the [closure record](docs/release-1.33/RELEASE_CLOSURE_20261022.md). The paragraphs below are the pre-merge Pro-pass record.

[22 October release closure](docs/release-1.33/RELEASE_CLOSURE_20261022.md) is the current bounded continuation on `pro/diagramcloud-release-closure-20261022`, based on `8281539`. It repairs structured-cloned malformed-row recovery, near-limit authoring-backup round trips and build-source identity on Vercel/GitHub; preserves historical LF bytes on Windows; and adopts the earlier deployed-smoke contribution. Local check/build pass; full unit suite 1,974 pass / three existing skips; bundled clients 21 pass. All eight new real-App regressions passed at 1440/390 using the exact pinned browser. Eleven source-identity cases pass. Read the PR for the final clean-build result and current CI before replaying checks.

Provider metadata confirms the existing production alias serves source `828153990544bd05768a83248ac9542f7c115547`; its HTTP handshake reports 1.33.1/G0 but lacks `source_revision`. The strict deployed test correctly refused that missing identity before App interaction. Rebuild after the final clean source commit, verify the dist handshake matches HEAD, then qualify all four deployed cases on the authorized successor. Read-only deep-link inspection is not isolated save/reload/export acceptance. The proposed branch is not a new package or production release. Claude is the requested receiving integrator, not an observed running session; preserve the existing native writer and package identity.

## Delivered package remains immutable

The last recorded private package is `diagramcloud/1.33.1-0892f9d`, source `0892f9df2c29ab8313c2cb4f60c59061c57478cc` (PR #126, main CI 39869462768), which adds #125 and #126 to the earlier `diagramcloud/1.33.1-1ee51db` (source `1ee51db`, PR #123: #118, #119, #120 and #122); both stay unchanged, as does the 1.33.0 package `diagramcloud/1.33.0-3e907db` stays unchanged. Its publication receipt is in [outcome.json](outcome.json), `privatePackages`. Post-release source commits below are not inside that package. No successor tag, public release, Marketplace publication, owner acceptance or separately verified deployment is established by this continuation.

## Integrated recovery fixes

PR #118 integrated as `2aa6bc082fc2b772d4c4e79879d8690020ad3faa`. Exact head `d92b928bb9fea219322191823c5fc96b16c54d4d` passed CI `39674865347`; main then passed `39689388205`. It repairs malformed save generations, recovery-row adoption and closed database reconnection. The verified artifact has 332 passed Chromium cases, zero failed/flaky and five existing optional external-host skips.

PR #119 integrated as `f54550df414ddfc45b4a0552bbb81afe04187754`. Exact head `e286afe6647893bb2215b8d05518abb633c2d6a2` passed CI `39690285115`, including all eight new recovery-deletion cases: 340 passed, zero failed/flaky and five existing optional skips. It guards confirmed deletion and same-writer saves against a changed observed row. [Audit and reproduced failures](docs/release-1.33/RECOVERY_CAS_20261022.md).

## Persistence continuation

PR #120, source `33ec95f9faa3c5334db53e77958883fc163f077c`, adds the existing 12 MiB UTF-8 boundary to persistence, snapshots requested bytes before async work, serializes same-handle repository writes, preserves uncertain receipts and refuses recreating an externally deleted file on a failed save. [Audit](docs/release-1.33/PERSISTENCE_BOUNDARIES_20261022.md). Its [qualification and integration record](https://github.com/julian-passebecq/diagramcloud/pull/120) is authoritative for that exact source; earlier source tests or predecessor CI cannot substitute for it.

## Evidence and remaining checks

The downloaded #118 and #119 CI artifact digests were independently matched before integration; receipts and SOURCE_COMMIT.txt identify their exact heads. Source tests use controlled protocol doubles when stated. Native Chromium browser tests are separate evidence, not native File System Access or installed-editor proof.

The #118 CI `presented.pptx` (18 slides, SHA-256 `2a4a0b6f2287730e6e349649111e56d59a340049a27b40cfe5b34ea3d4ba7538`) was rendered with LibreOffice for a bounded visual review. Contact sheets of all slides and a full-resolution evidence table showed no obvious clipping; this is not native PowerPoint, whole-product readability or owner acceptance. No export renderer changed in these persistence fixes.

Next: finish any outstanding exact-head qualification before adoption, retain main’s post-merge result, then run the affected installed/export gates and prepare a separately identified successor only under its delivery authority. Keep the existing package and all failed-attempt evidence intact. Do not reapply the earlier direct-hardening or learning/idea packets.

## History and scope

[Earlier continuation notes](RESUME_HISTORY_20261021.md) are byte-preserved history, including their old “Now”, “Next” and forecasts. They are not current work instructions. The original F/DG/R4/V3 acceptance sources remain authoritative through [the roadmap](docs/ROADMAP.md). No new feature ID, model schema, dependency, cloud service, execution permission or other product’s fileset was introduced by this pass.
