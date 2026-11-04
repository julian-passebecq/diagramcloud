# Lane report: workspace-docking-density (P4, 1.34.0 plan) - 2026-11-04

Branch `feat/diagramcloud-workspace-docking-density`, cut from `5da1806` (reviewed tip of #133-#135).

## What changed
- `src/core/workbenchLayout.ts`: `floating.explorer` (third floating pane, 220 px minimum width) and `density`
  (`comfortable` | `compact`). Legacy layouts without `density` or with a two-key `floating` normalise in memory; any
  unknown value or extra key is refused whole. A floating Explorer releases its docked column; compact screens, Present,
  a collapsed Explorer or a missing slot suspend floating without clearing the request.
- `src/ui/WorkbenchFrame.tsx`: Explorer gets the shared floating header (Float/Dock, Move, Resize, live placement text)
  on the same mounted region; resize separator hidden while floating; Layout > Density select; `data-density` on the frame.
- `src/ui/workbenchFrame.css`: compact density rules for pane chrome, tab rows, dock heading and status (targets >= 26 px).
- `src/core/workspaceArrangements.ts`, `src/ui/WorkspaceArrangements.tsx`: comments and one sentence of UI copy; the
  existing explicit save/restore carries both values unchanged.
- New contract `docs/contracts/workspace-density.md`.

## How verified
- `npx tsc --noEmit` clean; `npm run build` OK.
- Unit: `workbench-floating`, `workbench-layout`, `workspace-arrangements` (+ perspective, saved-context): 66/66.
- `npm test`: 2219 tests, 2210 pass, 6 fail, 3 skipped/other. 4 failures are packaging-preflight timeouts under machine
  load (the file passes 6/6 alone); 2 are pre-existing on the base and in files this lane does not touch
  (`adoption-journeys` cites `.github/workflows/ci.yml:43`, `release-entry-docs` README anchor `#exports-and-fidelity`).
- Playwright (Chromium, port base 26250): `workbench-floating` 4/4 and `workspace-arrangements` 5/5 (new cases cover
  1440 and 390); `connected-workspace`, `v3-workspace`, `v3-comparison` green; `keyboard-walk-mobile` timed out once
  under load and passed alone.

## Problems hit
- Playwright's 30 s web-server start budget expired while other lanes were building; ran with an untracked local config
  that only raised that budget.

## Remaining issues
- An older build reads a 1.34 arrangement record as corrupt (unknown `density`); it is left untouched, not migrated.
- Density covers frame chrome and tab rows only; inner panels keep their own spacing.

## Next steps
- Per-pane density or density inside companion/inspector panels: one patch.
- Tabbed pane groups or snapping floating panes to edges: dispatch (needs a UX decision; arbitrary docking trees stay out of scope).
- Pre-existing failures in `adoption-journeys` / `release-entry-docs`: one patch, owned by the release lane (P8) since they touch README/CI citations.
