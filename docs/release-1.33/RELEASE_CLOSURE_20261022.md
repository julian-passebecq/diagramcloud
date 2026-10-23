# DiagramCloud release closure — 22 October 2026

Current bounded Pro result and Claude continuation. This extends the existing release-reliability work in [ROADMAP](../ROADMAP.md); it does not replace the original Studio acceptance or authorize a production deployment. The branch is `pro/diagramcloud-release-closure-20261022`, based on `828153990544bd05768a83248ac9542f7c115547`. The pull request owns its exact proposed source and subsequent CI evidence.

## Outcome — successor deployed and accepted (22 October 2026, 23:07 UTC)

**Production now serves the reliability successor, accepted by the four deployed cases.** The sections below are the dated Pro-pass record that led here.

| Step | Evidence |
| --- | --- |
| #125 merged | `b3bd161675b1d583a8b2f5dd153d62beba32fc9a`, exact-head PR CI [39859801595](https://github.com/julian-passebecq/diagramcloud/actions/runs/39859801595) success (all steps incl. browser tests and Linux packaging dry run); main CI 39863815028 success |
| Defect found after merge | Vercel production build of `b3bd161` (22:17 UTC) still served no `source_revision`. The PR preview build log of #126 proved why: `Build source revision: none (omitted: checkout has 1 changed or untracked path(s), e.g. vercel.json)`. Vercel edits the tracked `vercel.json` during its build. |
| #126 merged | `0892f9df2c29ab8313c2cb4f60c59061c57478cc`. On Vercel only (`VERCEL=1`), with HEAD equal to `VERCEL_GIT_COMMIT_SHA`, untracked files and that one `vercel.json` edit are ignored; any other tracked change still omits identity. `.vercel/` ignored. The generator prints the identity and its basis. Exact-head PR CI [39866568609](https://github.com/julian-passebecq/diagramcloud/actions/runs/39866568609) success; preview log: `Build source revision: 4686e80… (Vercel commit SHA equals HEAD; build platform files ignored: vercel.json)`. 15 source-identity tests pass. |
| Production identity | `https://diagramcloud.vercel.app/galaxy/version-handshake.json`: `product_version` 1.33.1, `source_revision` `0892f9df2c29ab8313c2cb4f60c59061c57478cc`, `generated_at` 2026-10-22T23:05:55.987Z |
| Four deployed cases | **4 PASS** (26 s, Windows, Playwright 1.63.0 Chromium): anonymous deep link with parent context and no page errors, and synthetic import → IndexedDB reload → public export withholding private text, each at 1440 and 390 px. Identity verified before and after each case. |
| Version | Stays 1.33.1; the handshake `source_revision` identifies the build. |

Private package: `diagramcloud/1.33.1-0892f9d` published 23 Oct to `galaxy-release-vault` ([package 73509686](https://gitlab.com/juliandatapass-group/galaxy-release-vault/-/packages/73509686)) from the full evidence file of `scripts/package-campaign.ts` (exact-head main CI 39869462768, local gates, real-atlas quality 3/3, PPTX visual by the release agent); 14/14 authenticated re-download hashes match, anonymous access refused; receipt in `outcome.json` `privatePackages`. Left: nothing for this successor. This receipt commit redeploys production at a docs-only SHA; the four cases were re-run against it (see the PR).

## Decision and current release

**The standalone browser app is already privately packaged and deployed as 1.33.1.** Close the concrete reliability repairs and exact deployed-browser acceptance before declaring the successor accepted. The complete architectural Studio remains broader than this release increment.

| Dimension | Observed or recorded evidence |
| --- | --- |
| Live application | [diagramcloud.vercel.app](https://diagramcloud.vercel.app/) |
| Production source | `828153990544bd05768a83248ac9542f7c115547` |
| Provider observation this pass | Vercel `dpl_7UUUCTFuADj7YQBtgsKcaPoLGnDR`, READY, production, canonical alias assigned |
| Current-main CI | [39726385154](https://github.com/julian-passebecq/diagramcloud/actions/runs/39726385154), success; this qualifies the predecessor, not this proposed source |
| Immutable private package | `diagramcloud/1.33.1-1ee51db`, source `1ee51db6cd443afe2cd3126c46fd2f1c5644915d`; [package 73369695](https://gitlab.com/juliandatapass-group/galaxy-release-vault/-/packages/73369695) |
| Package-source CI | [39721881018](https://github.com/julian-passebecq/diagramcloud/actions/runs/39721881018), success |
| Earlier package delivery | `outcome.json` records 14 matching authenticated re-downloads and refused anonymous access. That receipt was read; the vault was not downloaded again here. |
| Live public HTTP | Root and version handshake return 200; version 1.33.1 / Galaxy G0; JS `index-Dj7CmFBz.js`, CSS `index-BcbUKMHV.css` |
| Installed host | [PR123](https://github.com/julian-passebecq/diagramcloud/pull/123) records VS Code 1.143.0, 7/7. It is not a new installed-host result for this patch. |

`1ee51db..8281539` contains documentation/receipt changes and a campaign-contract assertion, with no runtime-source change. The private archive and provider build nevertheless have different identities; runtime-source equivalence is not byte-equivalent delivery. No old package is replaced.

## Repairs built in this branch

### Recover unchanged malformed rows without weakening stale-row protection

IndexedDB structured-clones every read. The old `sameBasis` compared malformed object-valued fields by object identity, so an unchanged quarantined row could be impossible to delete or repair. The protocol double also returned the same references and hid this defect.

`src/core/storage.ts` now compares the observed plain records/arrays by exact values, retaining primitive distinctions, missing properties, array holes, cycles and shared-reference structure. The comparison is iterative. A newer nested replacement still refuses deletion or adoption. The unit store now clones every get/getAll result, matching the relevant IndexedDB behavior.

Original source with the same expanded regression tests: **29 PASS / 3 FAIL**. Corrected source: **32 PASS / 0 FAIL**. Unsupported structured-clone object types, such as Date, Map and Blob in malformed envelope fields, remain conservatively refused; this patch does not claim generalized repair of every possible corrupt value.

Six new real-App cases in `tests/e2e/storage-recovery-objects.spec.ts` cover raw backup and explicit deletion, a newer nested replacement after confirmation, and metadata repair/save/reload at 1440 and 390 pixels.

### Keep a saved project's authoring backup importable

A valid synthetic document was **12,581,912 UTF-8 bytes**, within the **12,582,912-byte** import limit. Pretty-printing made its authoring backup **12,587,601 bytes**, so both backup reimport and unchanged “Load current JSON” validation failed.

`src/core/authoringJson.ts` preserves readable JSON when it fits and otherwise emits the complete compact representation. Authoring export, emergency backups and current/generated-project editor prefills share it. No content is redacted or truncated. Oversized unsaved emergency drafts still export all content and remain correctly refused by ordinary import; a backup is never a save acknowledgment. Public-export behavior and the 12 MiB boundary are unchanged.

Four focused unit cases pass. Two new browser journeys in `tests/e2e/authoring-backup-roundtrip.spec.ts` import a near-limit project, validate current JSON, download its authoring backup, reimport in a fresh context and reopen the stored project.

### Preserve historical bytes on Windows

The three historical entry documents have exact blob-hash tests. Native Git checkout with `core.autocrlf=true` / `core.eol=crlf` previously changed all three files. Exact `text eol=lf` attributes now preserve their original bytes. The original documents and hash assertions are untouched. Both conversion cases were reproduced in isolated temporary Git repositories; the corrected three hashes match. Existing release-entry checks pass 4/4.

### Adopt the earlier deployed-check contribution

The five files from the earlier production-closure dossier were recovered and matched against all recorded preimage/postimage SHA-256 values before adoption: `scripts/lib/e2eTarget.ts`, `playwright.config.ts`, `tests/e2e-target.test.ts`, `tests/e2e/deployed-smoke.spec.ts`, and `vercel.json`.

This extends the existing Playwright runner. Ordinary mode retains local tests; explicit deployed mode selects only four synthetic smoke cases, starts no fixture servers and requires the exact HTTPS DiagramCloud origin, full source SHA and stable version. Handshake mismatches fail before App interaction. New contexts carry no saved authentication state; the synthetic edit case refuses remote HTTP mutations and foreign hosts. Vercel's repository install command becomes `npm ci --no-fund --no-audit`; Node settings, manifests, lockfile and workflow are unchanged.

### Identify the actual build source on GitHub and Vercel

Running the deployed check exposed a third release defect: the real 1.33.1 production handshake has no `source_revision`. The generator read only `GITHUB_SHA`, which Vercel does not supply. On GitHub pull requests that variable can identify a temporary merge commit even though this repository's workflow checks out the PR head.

`scripts/lib/buildSourceRevision.ts` now uses the actual full HEAD of a clean checkout, including linked worktrees. Dirty tracked or untracked source, an unborn checkout or unreadable Git status leaves the optional identity absent; provider metadata cannot disguise those states. An archive without its own Git metadata uses a validated full `VERCEL_GIT_COMMIT_SHA`, then `GITHUB_SHA`, otherwise omits the field. It never borrows the HEAD of an enclosing repository. Eleven focused tests exercise these cases with real temporary Git repositories. The existing Galaxy schema already allows this field; no schema, product version or G0 change is introduced.

The four deployed cases remain strict. The current production build cannot pass their exact-source guard until a separately qualified successor includes the corrected handshake. Its source is presently established by Vercel metadata, not a source field in its HTTP handshake. The failed attempt stopped in `beforeEach` before App interaction; it is not evidence of a broken save or export.

## Verification and limits

The local verification environment was Linux / Node **24.19.0**, with `npm ci` from the existing lockfile. The existing CI uses Node 22. Counts below are local executions on the proposed working tree, not a claim that predecessor CI qualifies it.

| Check | Result |
| --- | --- |
| TypeScript, `npm run check` | PASS |
| Full `npm test` | **1,974 PASS / 0 FAIL / 3 existing SKIP**, 1,977 total; approximately 82 seconds |
| Production build | PASS; existing large-bundle warning retained |
| Standalone CLI/MCP qualification | **21 PASS**; actual bundled clients isolated from project node_modules, synthetic inputs |
| Deployed-target helper | **42 PASS**; included in the full unit count |
| Normal/deployed discovery | Existing local suite selected normally; deployed mode selects exactly four tests in one file |
| New browser regressions | **8 PASS**, 59.4 seconds, at exact 1440/390 viewports on the clean `cec841a27ba1938956ab840531b05d81037bf920` build. The subsequent source-identity repair does not change App behavior. Earlier missing-executable and extracted-file permission failures are retained as setup failures. |
| Build source identity | **11 focused PASS**, including actual checkout versus PR merge SHA, Vercel fallback, dirty/untracked source, worktrees, ignored generated output and a corrupt Git index. |
| Pinned Chromium installation | The original CDN returned a 195-byte HTML page instead of a ZIP. The exact same Chrome Headless Shell **153.0.8010.12** was then obtained from Google's official per-version manifest URL; Google MD5, ZIP CRC and executable version verified. Archive SHA256: `a9da028861a0cf789ff25c2fed45f5f1aaf969ed9247835b6a7821a4f7af9d1d`. No browser version changed. |
| Live connected Chrome inspection | Read-only deep link opened at the canonical alias; parent and child views plus Export & share visible; no captured error logs. Measured CSS widths were 433 and 1600 after viewport requests, so this is not the exact 390/1440 automated qualification. Viewport override reset afterward. |
| Four deployed cases | Initial direct connection failed DNS; the unchanged suite then reached production through the configured credential-free egress proxy. It correctly refused the missing `source_revision` before App interaction: one setup failure, three not run. Fresh deployed save/reload/export/privacy remain pending on the corrected successor. |
| Installed Cursor/update/rollback/signing/Marketplace | No new qualification |

The controlled IndexedDB unit tests and the eight real-browser regressions are distinct evidence. The existing full unit suite exercises export/public-redaction behavior; no export renderer changed, and no new native PowerPoint/human-readability acceptance is claimed. The local CLI receipt honestly identifies a dirty working tree based on the predecessor; use the PR's current exact-head CI for release binding. The PR records later complete-suite and clean-build/package results; do not inherit a superseded commit's CI.

## Claude continuation: one integrator, finite remaining blocks

1. **Recover ownership and exact source.** Read Galaxy START/NOW, native AGENTS/README/RESUME/ROADMAP/RELEASE and this PR. Preserve any active native writer or dirty checkout. Compare the PR source; do not replay #115–#124 or copy the old five-file contribution again. The proposed fixes are already together on this branch. No Claude session was launched by publication.
2. **Qualify and rebuild the final clean source using the existing runner.** Read this PR's current CI result and failed logs first. Require the full normal typecheck/unit/CLI/build/browser/package checks, including the eight new cases. When inputs match, reuse those receipts instead of repeating all tests. After the final source commit, rebuild and explicitly require `dist/galaxy/version-handshake.json.source_revision` to equal `git rev-parse HEAD` before packaging; an earlier dirty build deliberately lacks this exact identity. Resolve a real failure without forced clicks, weakened assertions, or another CI/harness.
3. **Qualify the selected deployed successor.** Re-read provider source/version before setting the three variables below. The current predecessor is known to omit the source field, so it cannot pass this strict gate. After authorized successor deployment, run the four isolated deployed cases, retain their screenshots/downloads/errors and verify identity before and after. Do not claim the predecessor live-page inspection qualifies a newly built successor. Do not disable protection, clear owner storage, change origin or use bypass credentials.
4. **Integrate and deliver under the native release grant.** The native lead owns semver, manifests, merge, final source/package identity and production action. Main auto-deploys; this PR is not merged by the Pro pass. Preserve `1.33.1-1ee51db` and earlier packages, recheck rollback eligibility, and bind final acceptance to exact source/deployment/assets/time. A receipt-only main commit may trigger another deployment: keep final observations in the PR receipt, or verify that new deployment explicitly.

After the corrected successor is selected, replace the placeholders with independently re-read provider and product identity:

```powershell
$env:DIAGRAMCLOUD_DEPLOYMENT_URL = 'https://diagramcloud.vercel.app'
$env:DIAGRAMCLOUD_EXPECTED_SHA = '<full source SHA of the selected deployed successor>'
$env:DIAGRAMCLOUD_EXPECTED_VERSION = '<product version of the selected deployed successor>'
npm run test:e2e -- --list
npm run test:e2e
Remove-Item Env:DIAGRAMCLOUD_DEPLOYMENT_URL, Env:DIAGRAMCLOUD_EXPECTED_SHA, Env:DIAGRAMCLOUD_EXPECTED_VERSION
```

Source qualification and read-only deployed-predecessor inspection can proceed independently. Exact-source successor acceptance follows the final clean source, rebuild and authorized deployment. No Azure/Fabric credentials are needed for this bounded standalone-browser work. Actual MFA or new release authority remains the owner's action only if encountered; no secret or credential is transferred in this handoff.

**Planning allowance:** 1–3 active engineer-hours for a clean native finish with an available browser, passing PR checks and existing release authority. CI/build queues, account/owner waits and repairs are additional and unknown. This is not a calendar promise. Reforecast on the first browser or CI defect.

## Scope-wide direction after this patch

The local-first Explain/Design/Compare/Present product already includes linked views, reviewed imports, learning/interview/ideas, source evidence, delivery reading and public exports. Its optional CLI/MCP/React/VSIX consumers remain independent of browser release.

The [original workstreams](../product/V2_WORKSTREAM_STATUS.md), [R4 crosswalk](../product/R4_CROSSWALK.md) and [V3 acceptance](../product/V3_WORKSPACE.md) remain open wherever their acceptance is incomplete. Meaningful remaining directions include cross-project linked correspondence; fuller docking/layout/context parity; an in-App walkthrough-request editor; Contract/Questions and question/decision surfaces; capacity/queue/calendar/actual-result reasoning; maintained broader learning coverage; and meeting-summary PDF/PPTX. Delivery-task links and saved linked contexts already shipped and must not be redispatched as missing.

After release, propose the existing onboarding/explicit-refresh wave first, then question-led cross-project reading. AC02/AC09/AC11 and external-owner contracts require their real product decisions; optional integrations do not become automatic launch dependencies. No successor wave, Rust rewrite, new service, collector, orchestrator or other Galaxy/FOIL work is launched by this document.

## Stop boundary

This Pro pass delivers reviewed source repairs, eight passing new App regressions, a reproduced deployment-identity gap and its source repair, current deployment observations and a native continuation. It does not treat a refused deployed handshake as acceptance, mutate the current production alias, transfer ownership, or mark the whole Studio complete. Consult the PR for newer exact-head CI evidence before acting on the dated observations above.
