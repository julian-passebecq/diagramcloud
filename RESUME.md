# Current continuation - 23 October 2026

Source version: `1.33.1` (patch release of #118, #119, #120 and #122; [notes](docs/release-1.33/RELEASE_NOTES-1.33.1.md)). Read [the roadmap](docs/ROADMAP.md) for selected scope and [release verification](docs/RELEASE.md) for release gates. This file is the resumable source checkpoint, not an installed-release claim.

## Now - reliability release delivered; combined source candidate separate

**Verified 23 October 2026:** the previous release closure is complete. PR #125 and #126 are merged. The immutable private package is `diagramcloud/1.33.1-0892f9d`, source `0892f9df2c29ab8313c2cb4f60c59061c57478cc`, recorded by [PR #128](https://github.com/julian-passebecq/diagramcloud/pull/128). Its native receipt records 14 authenticated re-download hashes matched and anonymous access refused. This pass read that receipt and confirmed the vault is private; it did not re-download the vault package.

The canonical production alias serves `2ea334fa80f44b42f1b1e670e4193b09f7df0b27`, Vercel deployment `dpl_4pJLsaZCceXQJ3nBaCLzezFh8sUa`, READY. [Final-main CI 39880731437](https://github.com/julian-passebecq/diagramcloud/actions/runs/39880731437) passed all steps. [The native post-merge receipt](https://github.com/julian-passebecq/diagramcloud/pull/128#issuecomment-6354772786) records all four deployed cases passing at 1440/390 on this exact commit. Provider metadata and CI artifact hashes were freshly verified by Pro; the four live browser cases are Claude's dated execution evidence, not a new Pro browser run. The old missing-source blocker and PR #125 adoption are closed.

**Current candidate:** `codex/diagramcloud-explanation-integration-20261023` composes [#129](https://github.com/julian-passebecq/diagramcloud/pull/129), the [package identity guard](docs/release-1.33/POST_RELEASE_20261023.md), and [#130](https://github.com/julian-passebecq/diagramcloud/pull/130), the authored-explanation form. The existing packager refuses missing, stale or wrong-version dist identity before creating output. It checks the existing handshake; it is not asset attestation or release permission, and does not establish that the delivered package was defective.

The candidate's user journey is **Edit → Tours → Author explanation → Review explanation → Apply explanation**. Optional state, frozen code and takeaway stay authored content; Review applies nothing, Apply is one revision and one Undo. **Back to request** retains all authored fields and the original full source basis; a source change at the same revision is still refused. Missing Tours initialization is a separate explicit, undoable edit. The private session draft and request/patch downloads are not persisted project saves. Wider UX31 limits stay open: not all CLI prerequisite/case/question inputs have controls, no request-file import or draft autosave, companion Contract/Questions tabs absent, and no AI execution.

**Qualification:** read the integration pull request for the completed exact-source TypeScript, full unit tests, CLI/MCP, production build, Chromium browser suite and packaging dry-run outcomes. This source checkpoint precedes those runs and does not assert their success. `tests/e2e/explanation-request.spec.ts` adds "Back to request retains every authored field and original source basis before review and Apply" at 1440 and 390 px. A named test is a coverage definition until its result is read. This integration also preserves the draft when review closes with Escape/X or source Undo removes the Tours collection; the stale draft stays downloadable and cannot be applied. The candidate is not yet deployed or released; earlier receipts do not qualify its changed source.

**Next:** the existing native integrator/Claude owns final composition, adoption and release authority after reviewing the exact-source results and CI. Rebuild after any final source commit, retain immutable previous packages, and use existing release authority for integration. Main auto-deploys; bind any new deployed observation to its new source. Do not reopen the completed #125-#128 release sequence or re-publish an existing package path. Whole Studio acceptance remains in the roadmap; further feature blocks are proposals, not launched work.

## Preserve delivered packages and historical evidence

Keep `diagramcloud/1.33.1-0892f9d`, `diagramcloud/1.33.1-1ee51db` and `diagramcloud/1.33.0-3e907db` immutable. [outcome.json](outcome.json), `privatePackages`, owns their receipts. Recorded production source `2ea334f` and package source `0892f9d` are separate identities; their post-package difference contains only records/docs/a contract assertion, not App code. The combined candidate's form is additional source and is not inside either delivered artifact. No new tag, Marketplace release, signing, installed-host update/rollback, or human owner acceptance is established by this pass.

The [22 October closure record](docs/release-1.33/RELEASE_CLOSURE_20261022.md) preserves the earlier attempted checks, repaired defects and completion outcome. Its pre-merge pending paragraphs and old production `8281539` observations are dated history, not current work instructions. Installed VS Code/Cursor checks are not established for this combined candidate. No current owner profile was changed.

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
