# DiagramCloud - post-release Pro verification, 23 October 2026

This continues the existing release-reliability mission. **The 1.33.1 reliability release is delivered.** The separate package-preflight contribution below is maintenance, not a reopening of #125-#128 or a claim that the delivered package is corrupt. It introduces no new backlog or acceptance IDs.

## Now / preserve / unverified

| Dimension | Evidence and status |
| --- | --- |
| Browser application | Existing canonical origin `https://diagramcloud.vercel.app/`; Vercel `dpl_4pJLsaZCceXQJ3nBaCLzezFh8sUa`, READY/production, source `2ea334fa80f44b42f1b1e670e4193b09f7df0b27`, freshly read through the provider connector. |
| Final-main CI | [39880731437](https://github.com/julian-passebecq/diagramcloud/actions/runs/39880731437), all steps passed, including browser tests and packaging dry run. Artifact 12471630442 independently downloaded and its SHA-256 matched `cf64f40d7c2b1c942dab77cd2931588e1948d34b2b39ddba09802722b8c7560d`. |
| Main browser evidence | The downloaded Playwright report is bound to `2ea334f` and that CI run: 350 expected passes, 0 unexpected, 0 flaky, 5 skipped, 355 total. This is inspected CI evidence, not a new Pro browser execution. |
| Deployed acceptance | [Native post-merge receipt](https://github.com/julian-passebecq/diagramcloud/pull/128#issuecomment-6354772786), 23 October 00:56 UTC: 4 PASS at 1440/390 on `2ea334f`. This pass could read provider metadata but its direct HTTP/browser route was unavailable; it did not rerun those live cases. |
| Private package | `diagramcloud/1.33.1-0892f9d`, source `0892f9df2c29ab8313c2cb4f60c59061c57478cc`, [package 73509686](https://gitlab.com/juliandatapass-group/galaxy-release-vault/-/packages/73509686). [PR #128](https://github.com/julian-passebecq/diagramcloud/pull/128) is merged and records 14/14 authenticated re-download hashes and anonymous refusal. Vault project 87564954 was freshly read as private; its package files were not re-downloaded here. |
| Package-source CI | [39869462768](https://github.com/julian-passebecq/diagramcloud/actions/runs/39869462768), attempt 2; artifact 12469595491 independently downloaded, SHA-256 `8357959a65642f5d26e06c21432a3502a93205a261445747f5d7cddc781bf032` matched. |
| Build comparison | Both downloaded CI artifacts passed their outer archive checksum and all 12 dry-run checksum entries. Their dist trees have the same 140 paths: 139 files byte-identical, only `galaxy/version-handshake.json` differs. Each handshake names its exact own source. This compares CI builds, not Vercel bytes or the private vault package. |
| Installed / human gates | No new installed VS Code/Cursor, update/rollback, signing, Marketplace or owner PowerPoint acceptance. These are not silently added as dependencies of the delivered standalone browser release. |

Preserve the existing origin, browser projects and immutable `1.33.1-0892f9d`, `1.33.1-1ee51db` and earlier packages. Product version remains `1.33.1`, schema 1, Galaxy G0. The original roadmap's full Studio scope remains open where its acceptance is incomplete. No percentage or total Studio completion date is inferred from these release receipts.

## Selected maintenance: refuse stale dist before packaging

At base `2ea334fa80f44b42f1b1e670e4193b09f7df0b27`, `scripts/package-campaign.ts` (blob `7b9afe1320fa3c2062aacd927064965be7aa93bd`) checks a clean Git tree and exact-head evidence, but its only web-build precondition is the existence of `dist/index.html`. It can therefore proceed to output creation with an old or unidentified dist. The previous handoff required a manual source comparison; this contribution makes that check executable in the existing packager.

`assertPackageBuildIdentity` reads the existing, bounded `dist/galaxy/version-handshake.json` and requires the exact current full Git SHA, product version, application, schema, standalone flag and G0. Missing, unreadable, malformed, oversized, wrong-source or wrong-version identity is refused. The call runs before creating package output or invoking the bundler, in both candidate and dry-run mode. It never rewrites the handshake or rebuilds implicitly to turn a refusal into success.

The check is deliberately limited: a matching handshake is not cryptographic asset attestation, protection against concurrent dist writers, a successful test, or release permission. Existing evidence, allowlists, archive checksums and native release gates remain necessary. No App/runtime, export renderer, model/schema, dependency, lockfile, version, host setting or workflow changed.

Fileset: existing `scripts/package-campaign.ts`; new `scripts/lib/packageBuildIdentity.ts`; `tests/package-build-identity.test.ts`; `tests/package-build-preflight.test.ts`; current RESUME/ROADMAP and this result. Shared release identity and integration remain with the native lead. No native session or subagent was launched by this pass.

## What ran here

| Check | Result and limits |
| --- | --- |
| Exact baseline | Original package script's bytes matched its Git blob before modification. |
| Scoped static check | PASS for the helper and both new test files with local TypeScript 5.8.3 / Node 22.16.0 and strict/noUncheckedIndexedAccess. This is not the repository's pinned full typecheck. The first attempt had a missing node-type path; the corrected run passed. |
| Helper tests | 22 PASS: exact/additive identity accepted unchanged; missing/stale/abbreviated/zero source, wrong version/app/schema/maturity, malformed/oversized/non-file identity refused. |
| Packager preflight tests | 6 PASS: missing/stale/wrong-version identity in both dry-run and candidate mode, nonzero exit and no output directory. Real temporary Git repositories and filesystem operations. Candidate evidence is explicitly synthetic test input, not a real CI receipt or published candidate. |
| Same baseline controls | Original source with the same six preflight assertions: 0 PASS / 6 FAIL. It reached downstream bundling/output instead of the required refusal. |
| Actual artifact inputs | The helper accepted each downloaded CI build with its own source, refused it with the other's source, and left both handshakes unchanged. These are two positive/two negative observations, not added to the 28-test count. |

Because a locked dependency installation was unavailable in this executor (Git clone DNS failure; bounded npm install did not complete), local tests used TypeScript-emitted JavaScript. The local preflight execution substitutes only a downstream bundler sentinel and a Node relay for the unavailable tsx launcher; they establish early refusal, not real bundling or a complete package. The committed test uses the repository's real tsx and production module imports, without those substitutions. Local verification scripts are not a new product harness. The PR's existing full CI is authoritative for normal pinned tests/build/browser/packaging; read its current result instead of inheriting predecessor CI.

Raw scoped logs and source changes are retained in the conversation evidence archive. The failed setup attempt and baseline failures are not relabelled as passes. No new live browser, full local product suite, private publication or installed-host run is claimed.

## Claude continuation - maintenance only

1. Recover the current native worktree/dirty state and preserve any active writer. Read this contribution's PR and exact-head CI first. #125-#128 and the reliability package are finished, not adoption tasks.
2. Review the four-file guard/test change and current checkpoint corrections. Require the existing full CI, especially the six real-tsx preflight cases and successful normal packaging dry run. Diagnose actual failures before rerunning or changing assertions. No new CI or harness.
3. Rebuild after the final clean source commit. `npm run package:candidate -- --dry-run --out .local/integration/DIAGRAM/<new-unused-directory>` must succeed only with a matching build. Do not stamp an old dist or waive its source check. Reuse unchanged runtime/export evidence; do not re-download and re-publish the existing immutable package merely for a tooling-only patch.
4. Integrate only under the existing native release grant. Main auto-deploys; any new deployed build needs its own identity observation and applicable four-case deployed check. Record final observations in the PR to avoid another receipt-only main deployment loop. A separate new package is needed only when a successor distribution is actually selected.

**Planning allowance:** 0.5-1.5 active engineer-hours for review, clean-source adoption and applicable checks, assuming this PR's normal CI is green and the existing native environment is available. Basis: one existing entrypoint, one small helper, two test files and checkpoint corrections; no App behavior changes. CI queues, access waits and new repairs are additional. This is not a calendar commitment or estimate for the full Studio.

**Owner action now:** none required to use the delivered browser release. Claude's native integration/deployment authority is not transferred to Pro. Any MFA or new publication permission remains an owner action only if genuinely encountered.

## Whole-family direction after maintenance

Keep DiagramCloud as the local-first explanation and publishing consumer, not another execution platform. It consumes reviewed documents/snapshots from PM, DataPass, Brain or domain owners; those producers retain runtime facts, scientific validity, access and execution. DiagramCloud owns canonical explanation IDs, review, reading context and public projection. CLI/MCP, React/VSIX and Mosaic/AtlasNote export consumers are optional boundaries, not mandatory browser-release dependencies.

Recommended next selection, not launched work:

| Independent block | User-visible outcome and reused implementation | Owner / dependencies / acceptance |
| --- | --- | --- |
| Authored explanation request editor | Ask a question in the App, select explicit subjects/steps, preview the existing explanation compiler's private patch, then Apply or cancel through the ordinary review. | Native DiagramCloud UI lead; reuse `explanationWalkthrough` and JSON review, no new agent runtime. Test stale source, private content, cancel/Undo, save/reopen and 390px keyboard use. Shared App wiring belongs to the integrator. |
| Explicit source refresh and return context | Reopen a source, see what changed or is unavailable, retain authored evidence, and return to the same permitted view without silently rebinding identities. | DiagramCloud source/reading lead; existing scan/reimport and context contracts. Synthetic/local work independent; real producer journeys wait only for their own approved source/contract. |
| Meeting publication parity | Take a selected meeting summary to the requested printable/native outputs while preserving public/private omissions and cited evidence. | DiagramCloud publication lead; existing summary/public projection/export scene. Distinct renderer files; visual PDF/PPTX and privacy checks required. Not blocked by the source-refresh lane. |

Cross-project correspondence and Contract/Questions surfaces should follow explicit identity, audience and producer-contract decisions. Capacity/queue/calendar/actual-result reasoning must use supplied evidence, not guessed live activity. AC02/AC09/AC11 remain real owner/contract decisions. The complete R4/V3 matrices stay authoritative; delivered task links and saved linked contexts are not missing. No Rust rewrite, external service, new orchestrator, cross-app implementation or new feature wave is launched here.
