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

## Wave 4

### PRs and SHAs

- #152 lesson-figure-interaction, `04cd247c35a434b53ef6ad54a38c9c7bd2566edb`: lesson figure components are buttons sharing one selection with the list; Open inside / Back drill by explicit childViewId.
- #153 cli-mcp-input-limits, `e14a49fe3f1a6ecd3cd94d1d9ad3c562cc8ddcb7`: CLI and MCP inputs size-checked before reading with the App's limits (`src/core/inputLimits.ts`).
- #154 post-1-34-polish, `a474742e84cfcfd37c54f5707ca766051b640f9b`: "Meeting summary (HTML, PDF, PowerPoint)" menu label, omission notice printed once, quota-focus test fixed (it was a real `check()` misuse, not flakiness).
- #155 fix-wave4-findings, `eb212001e52faffb9b70d7962d118fae7b947506`: the four verified medium findings below.
- Release PR "Release 1.35.0 (source)" from `release/diagramcloud-next`: notes `docs/release-1.35/RELEASE_NOTES.md`, every PENDING entry confirmed against its merged PR, nothing dropped.

### How verified

- Each lane: builder gates (tsc, unit, build, targeted Playwright on ports 26810-26845) and an independent verify agent; every PR merged on green `validate` and Vercel checks after merging `origin/main` into it (`gh pr view` reads MERGED).
- Release branch: `origin/main` merged in, `npm run check`, `npm test`, `npm run build` locally; full Chromium suite in the release PR's CI.

### Problems

- Local branch deletes failed on every merge because other workflow worktrees still had them checked out (harmless).
- #153 and #155 conflicted with or lagged main and were refreshed by merging `origin/main` (no conflicts).
- Lane reports of verify passes were not added after merge, to avoid another ~30 min CI cycle.

### Verified findings

Fixed by #155 (medium): Mermaid `a & b & …` lists quadratic (`src/core/interchange/mermaid.ts`); draw.io deep parent chains quadratic with a stack overflow (`src/core/interchange/drawio.ts`); meeting summary PPTX wrote XML-forbidden control characters (`src/export/meetingSummaryPptx.ts`); MCP propose_mapping suggestions arrived stale (`src/intelligence/learning/query.ts`).

Not fixed (low): an empty Mermaid file stages a raw JSON parse error (`src/app/stageImport.ts`); a draw.io file with a DOCTYPE shows a JSON error (`looksLikeDrawio`, `src/core/interchange/drawio.ts`); the meeting summary Paper option reads "letter" next to "A4" (`src/ui/MeetingSummaryDialog.tsx`; the menu-card half was fixed by #154).

### Next steps

- Empty-file and DOCTYPE draw.io refusals with a format-specific message instead of the JSON parser (one patch).
- Label the Paper option "Letter" (one patch).
- Editable PowerPoint (`pptx.ts`) speaker notes repeat each view description (one patch).
- App.tsx / ProjectStart.tsx size literals to the shared constants without moving cited lines (one patch).
- Test the package:candidate 1 MiB evidence limit in a clean temporary repository (one patch).
- draw.io frame detection quadratic on flat pages of many labelled, unreferenced boxes (one patch).
- Lesson figure per-container expansion (dispatch) and arrow-key navigation between figure buttons (one patch).
