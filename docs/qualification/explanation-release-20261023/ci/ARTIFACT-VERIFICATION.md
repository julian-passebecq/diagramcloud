# Independent main CI artifact verification

Result: PASS. Read-only audit of main push run 39985734370, source 130c70744ec8fdeefebb784c56afb53c182f8dfa, base 2ea334fa80f44b42f1b1e670e4193b09f7df0b27. No tests, builds, tracked source edits, deployment or publication performed by this audit.

- Workflow API: event=push, branch=main, status=completed, conclusion=success, head=130c70744ec8fdeefebb784c56afb53c182f8dfa.
- GitHub artifact 12516666057: 68,644,187 bytes; SHA-256 97419f422106c6bd45997ac6256d8ae0f217845b0dfb58d93b307ca6c33485bb. Compared with API digest sha256:97419f422106c6bd45997ac6256d8ae0f217845b0dfb58d93b307ca6c33485bb and job upload digest 97419f422106c6bd45997ac6256d8ae0f217845b0dfb58d93b307ca6c33485bb.
- Outer ZIP: 372 entries; CRC failure=None; duplicate names=[].
- Source tar checksum: 32bcc20cf2e41e965abd0e76b03a923891959c5c9ef0b494f7dd7e4b2ec56a9d; matches=True.
- Primary source tar: 923/923 Git blobs match, including 20/20 changed files. Missing=[]; mismatched=[].
- Dry-run source tar: 923/923 Git blobs match, including 20/20 changed files. Missing=[]; mismatched=[]. Git blobs came from git cat-file --batch with no checkout or line-ending conversion.
- Dry-run checksum entries: 12/12 match. DRY-RUN synthetic=True; package READY present=False. A client concept-preview READY marker is preparation only.
- Built identity: DiagramCloud 1.33.1/G0, standalone=True, source=130c70744ec8fdeefebb784c56afb53c182f8dfa. SOURCE_COMMIT files and both receipts are checked against the source.
- Dist manifest: 127 files; SHA-256 dfe27cde3197e4d8fdfc7393c68a9126f0fee43a52b515d2db3387e7fef96503; receipt match=True. Packaged dist bytes are compared with the CI build.
- Verification receipt: level=E2E_VERIFIED, status=passed; 5 check records inspected. No manual or Galaxy qualification is inferred.
- Bundled CLI/MCP: 21/21 cases PASS, with synthetic inputs; 6/6 grammar hashes and sizes match.
- Browser report decoded from its HTML-embedded ZIP: 367 cases across 89 files; outcomes={'expected': 362, 'skipped': 5}; detailed result statuses={'passed': 362, 'skipped': 5}; unexpected=0, flaky=0, results=367, max retry=0, actual workers=1. Embedded ZIP CRC failure=None. Explanation cases: 12/12 passed. Every skipped title is retained in browser-summary.json.
- CI unit log: tests=2033, passed=2030, failed=0, skipped=3. Chromium install follows the unit stage: True. The PDF skip therefore remains distinct from local runs where Chromium was installed already.
- Main push Playwright metadata: ci.commitHash=130c70744ec8fdeefebb784c56afb53c182f8dfa; gitCommit.hash=130c70744ec8fdeefebb784c56afb53c182f8dfa. Both are required to equal the exact main source; no PR event/merge exception applies.

Actual unit skips from this job:

- ok 502 - --pdf prints book.pdf (cover + one page per public view) and one figure PDF per view, offline # SKIP chromium not installed (npx playwright install chromium)
- ok 1495 - selected real local atlas dense page projections pass unchanged geometry without copying private fixtures # SKIP
- ok 2031 - Z025 optional independent real-stage gate reads receipt metadata only, never selected private source # SKIP

Problems: none found in these bounded artifact checks.

The JSON audit contains per-file blob comparisons, checksums, receipts and browser metadata. The reusable verifier expects artifact.zip, artifact-metadata.json, workflow-run.json and job.log beside it by default. Run from the repository or pass --repo/--artifact/--output-dir. Keep the raw ZIP and embedded HTML local. The synthetic dry-run is not a release candidate or deployment, and no human acceptance is asserted.
