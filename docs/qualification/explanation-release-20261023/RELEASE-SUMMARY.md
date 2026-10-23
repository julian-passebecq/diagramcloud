# DiagramCloud explanation release continuation

PR #131 is merged as `130c70744ec8fdeefebb784c56afb53c182f8dfa`. The merge retains PR #129 packaging safeguards and PR #130 explanation authoring, and both precursor PRs are merged. Product version remains 1.33.1; the distinct private successor package is named `1.33.1-130c707`. This snapshot records qualification before package publication. The final publication receipt will be added separately.

The deployed application at https://diagramcloud.vercel.app reports this exact source. Explanation review supports returning to the retained editor, including Escape and the close button. Undoing Tours initialization preserves the draft while stale guards prevent review/apply. The authoring guide and UX31 roadmap describe the shipped behavior.

## Exact-source checks

- Main CI: https://github.com/julian-passebecq/diagramcloud/actions/runs/39985734370, successful push/main run. TypeScript and build passed; units 2030 passed / 3 skipped; browser 362 passed / 5 skipped / zero flaky, unexpected or retries; bundled CLI/MCP 21 passed.
- Downloaded CI artifact 12516666057: 68,644,187 bytes; SHA256 `97419f422106c6bd45997ac6256d8ae0f217845b0dfb58d93b307ca6c33485bb`, matching API and upload log. Both nested source archives match all 923 Git blobs and all 20 changed files; 12 dry-run checksums and 127 dist manifest members verified. CI dry-run has no package READY and is not the private candidate.
- Canonical local source: 923/923 raw Git blobs match. Fresh local build succeeded. The initial checkout contained 218 CRLF-only differences despite Git reporting clean; those bytes were restored from Git, the unchanged tree was verified, and affected local checks were rerun. Superseded checks are not transferred to the canonical package.
- Fresh local browser supplement: 6/6 passed, covering the selected MosaicStudio owner viewer (four cases), local workspace host (one), and malformed optional artwork/raster fallback (one). Owner viewer source is declared as `70c55bf784d5fc1fee6cf939c679c3107902d9da`; selected HTML SHA256 `382381cd7728b1af8c62bc25e094aa904d16a45a0d54eea156f3e0f7c80658b5`. The private owner artifact is not published here.
- Real local atlas geometry and isolated CLI/MCP checks have separate sanitized receipts. The private atlas and raw logs are excluded. Native VS Code results and any failed attempts are recorded separately with the exact VSIX hash.
- Two-slide PowerPoint export: valid 46-entry ZIP, no external relationships or macros; PowerPoint 16 exported both slides to PNG for visual inspection. Final deck SHA256 `79a4e892c70131ebb8d573ea545cc666e1ede3f1d8332990543c60f4ee0b826a`.
- Actual deployed smoke: 4/4 passed. Explanation journeys at 1440 and 390 pixels passed Back/retained request/Apply checks, with 16 screenshots inspected. Every journey checked the exact production identity before and after.

## Problems, questions and boundaries

Both canonical VS Code host attempts timed out waiting for a return-file quick-input prompt, causing a dependent stale-return assertion to fail. Each attempt had four passing and three failing reported tests (including the parent suite), with cleanup and uninstall verified. Both receipts are retained. The second run had no concurrent native PowerPoint activity, so desktop overlap is not an established cause. Installed VS Code qualification for the canonical VSIX is FAILED/INCOMPLETE; the earlier seven-pass result belongs to a different VSIX and is not transferred. This optional native host result is separate from the eight web/CLI package gates.

CI skips remain explicit: PDF execution before Chromium installation, the private real-atlas case, optional independent Z025 receipt, and five browser cases needing optional host/owner inputs. Supplemental checks do not rewrite the CI counts. Cursor is NOT_RUN because the existing harness hides onboarding; no Cursor success is claimed.

No human owner acceptance, all-product Studio/Galaxy GA, provider execution, Marketplace/Open VSX publication, or update/rollback qualification is inferred. Historical package versions and other owner worktrees are preserved. There are no blocking questions for this bounded successor. Broader acceptance and the Cursor harness remain separate follow-up work.

Source, main CI, local canonical build, installed VSIX, deployed origin and private package each retain their own identities and receipts. The final private publication claim requires exact file readback and anonymous access refusal, recorded after upload.
