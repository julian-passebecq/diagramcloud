# Lane report: overnight lead (2026-11-05)

## What changed

Merged on `main` overnight, each through its own PR (squash merges):

| PR | What | Merge SHA |
|---|---|---|
| #136 | Readiness purpose badge | 8721bed |
| #137 | Lesson depth scenes as spatial figures | d7c0477 |
| #138 | Companion Concepts tab and detour Return | 9130975 |
| #139 | Import bounds (Visio/draw.io inflation, draw.io cycles, Mermaid expansion) | f4c9080 |
| #140 | Monotonic revisions, polynomial parent paths | 0cc6bec |
| #141 | Three public-boundary fixes | 4dacc96 |
| #142 | Floating Explorer and compact density | fa3c1a0 |
| #143 | Meeting summary browser-print PDF and editable PPTX | 2f77bbb |
| #144 | Revise and remove applied explanations | 432f6a8 |
| #145 | XML-safe SVG, draw.io and PPTX exports | 27743fb |
| #146 | PPTX drilldown footer link, CRLF-safe doc tests | 0cac258 |
| #147 | Source refresh summary and recoverable return context | dbab3f8 |
| #148 | Import hardening follow-ups (per-view cap, Visio budget, file-size check) | f1a192d |
| #149 | Public omission notice in meeting summary and linked reading | 3c9fae6 |
| #150 | QA UI polish (readable refusals, header, tabs, concept opens lesson) | 9345912 |

The 1.34.0 source release PR (this lane's last PR) confirms every PENDING item of `docs/release-1.34/RELEASE_NOTES.md` against its merged PR (none dropped), adds entries for #148, #149 and #150, removes the closed AGENTS.md limits (no readiness badge, no meeting-summary PPTX, no App file-size check), adds the 1.34.0 additions to the AGENTS.md 1.34.0 paragraph, and completes `handoff/lanes/README.md` (one line per report file, duplicate line removed). No package, deployment or tag.

## How verified

- Every PR above read as MERGED with `gh pr list --state all` before the release branch merged `origin/main`.
- Release branch gates: `npm run check`, `npm test`, `npm run build`, full Playwright suite with `DIAGRAMCLOUD_E2E_PORT=26750`; counts in the release PR body. The release PR's exact-head CI is the qualification record.
- No cited line moved: AGENTS.md line 19 and every `file:line` fixture untouched; doc edits replace text inside existing lines.

## Problems hit

- Worktree isolation: several workflow worktrees shared one scratchpad; one agent's `npm test` log was overwritten by another's. Logs now go inside the worktree. A builder wrote `D:/PROJ/npmci-wf3.log` outside its worktree (empty, still to delete by hand). Git commands with compound shell syntax are refused in isolated worktrees; plain separate commands work.
- `gh pr merge --delete-branch` could not delete local branches still checked out in other worktrees (`wf_a8440779-a0e-2/-3/-4`); the merges themselves succeeded.
- Lane-index conflicts: parallel lanes all appended to `handoff/lanes/README.md`; `merge=union` keeps every line but produced one duplicate line and left four report files unlisted, fixed here.
- Flaky browser test `quota failure retains keyboard focus` (`tests/e2e/explanation-draft-recovery.spec.ts`) failed locally on two #150 runs; not touched by any PR tonight.
- Self-description line citations (`tests/v3-capabilities.test.ts`, `tests/adoption-journeys.test.ts`): new code had to go in new modules (`src/app/importFileLimit.ts`, `src/export/xmlText.ts`, `src/export/meetingSummaryPptx.ts`) or after cited lines so `App.tsx`, `diagram.ts`, `drawio.ts`, `pptx.ts` and `ci.yml:43` positions stay put.

## Remaining issues

- Stale local branches of merged PRs #148-#150 in other worktrees; remote deletion unconfirmed.
- Meeting-summary export-menu label in `src/App.tsx` still reads "Meeting summary (HTML)" although PDF and PPTX are offered.
- Design-profile meeting summary prints the omission notice twice on a view page.
- CLI and MCP input limits unchanged by #148.
- Flaky quota-focus browser test.

## Next steps

- Rename the "Meeting summary (HTML)" menu label without moving a cited `App.tsx` line (one patch).
- Print the omission notice once in the design-profile meeting summary (one patch).
- Stabilise `quota failure retains keyboard focus` (one patch).
- Apply the #148 file-size limits to the CLI and MCP inputs (dispatch).
- Remove stale worktree branches and `D:/PROJ/npmci-wf3.log` after the lanes are archived (one patch, by the lead).
