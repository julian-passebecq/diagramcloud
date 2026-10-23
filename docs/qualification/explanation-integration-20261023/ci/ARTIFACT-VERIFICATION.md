# Independent CI artifact verification

Result: PASS. Read-only audit of run 39976506510, source d7ceb456c6905e6277cdeb1dea801298bd7e77e9, compared with base 2ea334fa80f44b42f1b1e670e4193b09f7df0b27. No tests, builds, tracked source edits, deployment or publication performed by this audit.

- GitHub artifact 12513746196: 68,693,346 bytes; SHA-256 aa85fb915226c963f6f6256bdf27000d804fa0a9cc77faae596bb1883917a053 matches the API metadata and uploaded-job digest.
- Outer ZIP: 372 entries, CRC verified, no duplicate names.
- Source tar SHA-256: 7728b412205f2141ffc0bd2417c9415a3bfba4abaf7d275acd5e5c30d5a1b0f4; checksum matched.
- Both the CI source/build tar and dry-run source/build tar match all 923/923 tracked Git blobs byte-for-byte, including all 20/20 files changed from the stated base. No missing or mismatched source files. Git blobs were read with git cat-file --batch, without checkout or line-ending conversion.
- All 12 dry-run checksum entries match. DRY-RUN.json is synthetic; package-dry-run/READY.json is absent. The separate client concept-preview READY marker only records preparation. No package release is established.
- SOURCE_COMMIT files, built handshake, verification receipt and client receipt identify the stated source. Built identity is DiagramCloud 1.33.1/G0, standalone=true. The complete 127-file dist manifest recomputes to 5efd213de6b3c9ccb2b6e2cf5c8f8e2f331c5ae07c4624b7227f9e0217f3d2cb, exactly matching the receipt; dry-run packaged dist bytes match the CI build.
- Verification receipt: E2E_VERIFIED, passed; typecheck/unit/build/static-package/e2e checks passed. This is not MANUAL_QUALIFIED or GALAXY_QUALIFIED.
- Bundled CLI/MCP: 21 PASS results with synthetic inputs; all 6 recorded grammar hashes and sizes match the packaged bytes.
- Browser report independently decoded from its HTML-embedded ZIP: 367 cases across 89 files, 362 passed, 5 skipped, 0 unexpected, 0 flaky, 367 total results, max retry 0, one actual worker. All 12 explanation-request cases passed. The embedded ZIP CRC also passed. The five skips concern the unselected Mosaic owner viewer.
- CI unit log: 2,033 cases, 2,030 passed, 0 failed, 3 skipped. PDF case 502 skipped because Chromium was absent at the unit stage; Chromium was installed later in the browser step. The real private atlas case 1495 and Z025 independent real-stage case 2031 also skipped. Do not replace these with local unit counts.
- Playwright metadata.ci.commitHash is da8e05d68bcceda7b7d80455f68a69cd67452a45 (PR event/merge identity), while metadata.gitCommit.hash is d7ceb456c6905e6277cdeb1dea801298bd7e77e9. The workflow deliberately checks out the PR head and the job log confirms that exact checkout. The two metadata fields are distinct; the packaged source bytes match the tested head.

Problems: none found in these bounded artifact checks.

The JSON audit contains per-file Git blob IDs and SHA-256 comparisons, every checksum, receipts, skip descriptions and browser metadata. The reusable verifier expects artifact.zip, artifact-metadata.json and job.log beside it by default; run from the repository or supply --repo and --artifact. Supply --output-dir only when its metadata/log companions are present there. No raw ZIP or HTML report needs to be published with this report.
