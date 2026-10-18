# Codex worktree publication audit — 2026-10-18

## Decision

Preserve this work as a historical audit branch, `codextobedeterminedwasnot`. It contains useful implementation and qualification history, but is not a candidate to merge wholesale into current main. No product code was changed by this audit.

The existing GitHub branch `audit/codex-concept-preview-r4-wip-20261018` already points to snapshot `c4c97f008d0821c4f2bdad1fdc66e57e9da4e45b`. This branch starts from that exact snapshot, then adds this report and a file-level inventory. No force push, main update, release or deployment is part of this pass.

## What was actually uncommitted and unpublished?

The original `codex/concept-preview-r4` checkout has 85 tracked changes and 299 individual untracked files: 384 status entries. All 384 regular files were compared. All 381 publishable regular files match the snapshot's Git blobs after path filters. The only three regular files absent from the snapshot are `CLAUDE-HANDOFF-STATE.json`, `CLAUDE-HANDOFF.md` and `OVERNIGHT-TESTS.md`. These contain machine-local paths and remain excluded. The original checkout and its index were left intact.

The chat checkout started clean at detached `091947452683102849eb225d67ef870fc6e2f1d0`. Its HEAD has no commits absent from all fetched origin branches. This audit covers that HEAD and the named dirty checkout, not every other worktree or branch in the repository.

## Is the work useful?

Yes, as historical implementation and evidence. It includes concept preview/CLI integration, source acquisition and analysis, React viewing, source bundles, workflow and state facets, studio controls, export hardening, and associated unit/browser tests and contracts. Main's history records integration of the Codex working tree in PR #62 (`ee1303a`), followed by later changes and releases.

Against fetched main `39c0816`, of the 381 matching snapshot files:

- 255 are byte-identical Git blobs on main.
- 73 exist on main with different contents. This does not establish missing features: main contains subsequent fixes and extensions. These require semantic review before any selective recovery.
- 53 are absent from main, all historical Markdown progress, resume, outcome or test notes. They are useful audit history, not missing application modules.

There are no application source files in the dirty checkout that are absent from both the published audit snapshot and current main. The snapshot differs from current main in 275 files overall; replacing main with it would discard newer work. The inventory beside this report lists each compared file, its Git blob identity and main comparison for external review.

## Problems, evidence and open questions

- Historical `V2-CONTINUATION-TESTS.md` records TypeScript/build success, 710 passing unit tests with one skip, and a failed full browser gate (123 pass, one failure). These are historical reports, not fresh validation of this branch. The recorded draw.io timeout cause remained unresolved at that time; this audit does not determine whether current main still has that problem.
- Earlier concept-preview qualification records 442 unit and 77 browser passes. Those results apply to an earlier selection, not the entire later snapshot.
- Historical reports retain incomplete V2/owner/installed-host acceptance boundaries. Later main work may supersede them; do not treat their old open items as a current backlog without checking main.
- No TypeScript, unit, build, browser, real-atlas rendering or native PowerPoint qualification was rerun in this archival pass. No renderer or application behavior was changed. Verification here is Git/file provenance, inventory consistency and remote branch publication, not product or release qualification.
- No CI pass is claimed. The snapshot workflow runs push CI only for main and matching feature branches; the requested archive branch does not match that filter.
- No user decision is needed for archival publication. The useful follow-up, if requested, is a selective semantic review of the 73 divergent files against current main, rather than a bulk merge. Nothing was deleted from the original dirty checkout.
