# Current continuation - 27 October 2026

Source version: `1.33.1` (patch release of #118, #119, #120 and #122; [notes](docs/release-1.33/RELEASE_NOTES-1.33.1.md)). Read [the roadmap](docs/ROADMAP.md) for selected scope and [release verification](docs/RELEASE.md) for release gates. This file is the resumable source checkpoint, not an installed-release claim.

## Now - reliability release delivered; explanation source merged separately

**Verified 23 October 2026:** the previous release closure is complete. PR #125 and #126 are merged. The immutable private package is `diagramcloud/1.33.1-0892f9d`, source `0892f9df2c29ab8313c2cb4f60c59061c57478cc`, recorded by [PR #128](https://github.com/julian-passebecq/diagramcloud/pull/128). Its native receipt records 14 authenticated re-download hashes matched and anonymous access refused. The 23 October review read that receipt and confirmed the vault was private; it did not re-download the vault package.

**Last recorded deployment checkpoint (23 October 2026):** the canonical production alias was recorded serving `2ea334fa80f44b42f1b1e670e4193b09f7df0b27`, Vercel deployment `dpl_4pJLsaZCceXQJ3nBaCLzezFh8sUa`, READY. This is a dated receipt, not a fresh observation of the alias. [Final-main CI 39880731437](https://github.com/julian-passebecq/diagramcloud/actions/runs/39880731437) passed all steps. [The native post-merge receipt](https://github.com/julian-passebecq/diagramcloud/pull/128#issuecomment-6354772786) records all four deployed cases passing at 1440/390 on this exact commit. In that 23 October review, provider metadata and CI artifact hashes were verified by Pro; the four live browser cases are Claude's dated execution evidence, not a new Pro browser run. The old missing-source blocker and PR #125 adoption are closed.

**Merged source increment:** [PR #131](https://github.com/julian-passebecq/diagramcloud/pull/131) was merged on 23 October 2026 as [`130c70744ec8fdeefebb784c56afb53c182f8dfa`](https://github.com/julian-passebecq/diagramcloud/commit/130c70744ec8fdeefebb784c56afb53c182f8dfa). It composes [#129](https://github.com/julian-passebecq/diagramcloud/pull/129), the [package identity guard](docs/release-1.33/POST_RELEASE_20261023.md), and [#130](https://github.com/julian-passebecq/diagramcloud/pull/130), the authored-explanation form. The existing packager refuses missing, stale or wrong-version dist identity before creating output. It checks the existing handshake; it is not asset attestation or release permission, and does not establish that the delivered package was defective.

The merged source's user journey is **Edit → Tours → Author explanation → Review explanation → Apply explanation**. Optional state, frozen code and takeaway stay authored content; Review applies nothing, Apply is one revision and one Undo. **Back to request** retains all authored fields and the original full source basis; a source change at the same revision is still refused. Missing Tours initialization is a separate explicit, undoable edit. The private session draft and request/patch downloads are not persisted project saves. Wider UX31 limits stay open: not all CLI prerequisite/case/question inputs have controls, no request-file import or draft autosave, companion Contract/Questions tabs absent, and no AI execution.

**Source qualification:** [main CI 39985734370](https://github.com/julian-passebecq/diagramcloud/actions/runs/39985734370) completed successfully on 23 October 2026 for merge commit `130c70744ec8fdeefebb784c56afb53c182f8dfa`. The [workflow](.github/workflows/ci.yml) runs TypeScript, unit tests, standalone CLI/MCP bundles, production build, Chromium browser tests and a Linux packaging dry run. This result was read during the 27 October documentation review; it is not a newly executed test run or an installed-host receipt. [PR #131](https://github.com/julian-passebecq/diagramcloud/pull/131) retains the pre-merge qualification and artifact evidence.

The integration retains every authored field and the original source basis when returning from review, closing review with Escape/X or removing Tours through Undo. Stale drafts stay downloadable and cannot be applied. These behaviors are covered by the integrated source and its recorded qualification; no new private package or current deployment is established by that source result.

**Next delivery step:** the existing native integrator/Claude owns package and deployment qualification for any successor. Rebuild after any final source commit, retain immutable previous packages, and record exact-source deployment observations. Main auto-deploys; do not infer the currently served source from an earlier receipt. The #125-#128 release sequence and #131 source adoption are complete. Whole Studio acceptance remains in the roadmap; further feature blocks are proposals, not launched work.

## Preserve delivered packages and historical evidence

Keep `diagramcloud/1.33.1-0892f9d`, `diagramcloud/1.33.1-1ee51db` and `diagramcloud/1.33.0-3e907db` immutable. [outcome.json](outcome.json), `privatePackages`, owns their receipts. Recorded production source `2ea334f` and package source `0892f9d` are separate identities; their post-package difference contains only records/docs/a contract assertion, not App code. The merged explanation form is additional source and is not inside either delivered artifact. No new tag, Marketplace release, signing, installed-host update/rollback, or human owner acceptance is established by this pass.

The [22 October closure record](docs/release-1.33/RELEASE_CLOSURE_20261022.md) preserves the earlier attempted checks, repaired defects and completion outcome. Its pre-merge pending paragraphs and old production `8281539` observations are dated history, not current work instructions. Installed VS Code/Cursor checks are not established for this merged source increment. No current owner profile was changed.

## Integrated recovery fixes

PR #118 integrated as `2aa6bc082fc2b772d4c4e79879d8690020ad3faa`. Exact head `d92b928bb9fea219322191823c5fc96b16c54d4d` passed CI `39674865347`; main then passed `39689388205`. It repairs malformed save generations, recovery-row adoption and closed database reconnection. The verified artifact has 332 passed Chromium cases, zero failed/flaky and five existing optional external-host skips.

PR #119 integrated as `f54550df414ddfc45b4a0552bbb81afe04187754`. Exact head `e286afe6647893bb2215b8d05518abb633c2d6a2` passed CI `39690285115`, including all eight new recovery-deletion cases: 340 passed, zero failed/flaky and five existing optional skips. It guards confirmed deletion and same-writer saves against a changed observed row. [Audit and reproduced failures](docs/release-1.33/RECOVERY_CAS_20261022.md).

## Persistence continuation

PR #120, source `33ec95f9faa3c5334db53e77958883fc163f077c`, adds the existing 12 MiB UTF-8 boundary to persistence, snapshots requested bytes before async work, serializes same-handle repository writes, preserves uncertain receipts and refuses recreating an externally deleted file on a failed save. [Audit](docs/release-1.33/PERSISTENCE_BOUNDARIES_20261022.md). Its [qualification and integration record](https://github.com/julian-passebecq/diagramcloud/pull/120) is authoritative for that exact source; earlier source tests or predecessor CI cannot substitute for it.

## Evidence and remaining checks

The downloaded #118 and #119 CI artifact digests were independently matched before integration; receipts and SOURCE_COMMIT.txt identify their exact heads. Source tests use controlled protocol doubles when stated. Native Chromium browser tests are separate evidence, not native File System Access or installed-editor proof.

The #118 CI `presented.pptx` (18 slides, SHA-256 `2a4a0b6f2287730e6e349649111e56d59a340049a27b40cfe5b34ea3d4ba7538`) was rendered with LibreOffice for a bounded visual review. Contact sheets of all slides and a full-resolution evidence table showed no obvious clipping; this is not native PowerPoint, whole-product readability or owner acceptance. No export renderer changed in these persistence fixes.

The historical adoption and release sequence above is complete. Qualification still outstanding for a new source contribution is listed only in the current section and its PR. Keep all old packages and failed-attempt evidence intact; do not reapply the earlier direct-hardening or learning/idea packets.

## History and scope

[Earlier continuation notes](RESUME_HISTORY_20261021.md) are byte-preserved history, including their old “Now”, “Next” and forecasts. They are not current work instructions. The original F/DG/R4/V3 acceptance sources remain authoritative through [the roadmap](docs/ROADMAP.md). No new feature ID, model schema, dependency, cloud service, execution permission or other product’s fileset was introduced by this pass.
