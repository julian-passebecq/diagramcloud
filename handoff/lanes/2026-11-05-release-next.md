# Lane report · release-next · 2026-11-05

Prepared the source release after 1.34.0 on branch `release/diagramcloud-next` from `origin/main` `7c9a2b1`. Not merged; no PR opened by this lane.

## What changed

- Version 1.35.0 in `package.json` and `package-lock.json`.
- New `docs/release-1.35/RELEASE_NOTES.md`: PENDING entries for lanes post-1-34-polish, cli-mcp-input-limits, lesson-figure-interaction and fix-wave4-findings (no PR found for it on 5 November 2026), the version rule (1.35.0 only if lesson-figure-interaction merges, else 1.34.1) and the 1.34.0 limits kept.
- `AGENTS.md`: header `Current limits (1.35.0)`; the 1.34.0 limits "clicking the figure does nothing" and "CLI and MCP input limits are unchanged" kept in place with a "closed in 1.35.0, PENDING" note; a new 1.35.0 paragraph after the 1.34.0 one with one PENDING sentence per lane. Line 19 (cited by `tests/adoption-journeys.test.ts`) did not move.
- `README.md`, `RESUME.md` ("Now - 1.35.0 source preparation"), `docs/ROADMAP.md`, `docs/RELEASE.md` (product version, PENDING history row), `docs/product/V3_WORKSPACE.md` (baseline line, PENDING 1.35.0 section).

## How verified

- `npm run check` and the doc-citation tests (`release-entry-docs`, `ai-guide`, `r4-crosswalk`, `adoption-journeys`, `v3-capabilities`, `independent-journeys`, `concept-mcp`).

## Remaining issues

- None of the lanes had a PR or a commit when drafted: the finalizer writes each entry from its merged PR body, removes the PENDING tags, deletes the two closed 1.34.0 limits in AGENTS.md and the ROADMAP "clicking the figure does nothing yet" clause, and adds a 1.35.0 gate-additions line to `docs/RELEASE.md` (one patch).
- Without lesson-figure-interaction: switch to 1.34.1 (notes to `docs/release-1.34/RELEASE_NOTES-1.34.1.md`, every 1.35.0 mention), one patch.

## Next steps

- Finalizer: rebase on main after the lanes merge, resolve PENDING (one patch), open the release PR, merge on green (dispatch).
