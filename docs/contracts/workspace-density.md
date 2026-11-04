# Workspace density and floating Explorer (1.34.0, P4)

Status: implemented in `src/core/workbenchLayout.ts`, `src/ui/WorkbenchFrame.tsx` and `src/ui/workbenchFrame.css`;
saved through the existing arrangements (`src/core/workspaceArrangements.ts`). Physical layout only: nothing here is
Project content, a revision, an Undo step, a route, a camera, a permission or an audience.

## Floating Explorer

- `WorkbenchLayout.floating` now has three keys: `explorer`, `companion`, `dock`. Each is `null` (docked) or an integer
  rectangle `{x,y,width,height}` with `x`, `y` in 0-8192 and `width`, `height` in 120-2000.
- The Explorer uses the same controls as the companion and the bottom panel: **Float explorer / Dock explorer**,
  **Move floating explorer** and **Resize floating explorer** (pointer drag, or arrow keys with Shift for one pixel,
  Home and End for the bounds, Escape cancels a pointer drag).
- First Float places it at 16, 16 with 320 x up to 560 px. Presentation is clamped to the measured frame with a
  220 px minimum width (companion 260, bottom panel 320) and 180 px minimum height; the saved request is never rewritten
  by the clamp.
- A floating Explorer releases its docked column (the primary view gets the width) and hides its resize separator.
  The region is the same mounted element: its content, scroll and keyboard focus survive Float and Dock.
- Floating is suspended, never cleared, on compact screens (width or height below the desktop budget, for example
  390 x 844), in Present focus, when the Explorer is collapsed and when the host supplies no Explorer slot. F6 still
  cycles every visible region.

## Density

- `WorkbenchLayout.density` is `comfortable` (default) or `compact`, chosen under **Layout > Density**.
- Compact tightens pane chrome only: header and body padding, pane headings, floating tools, tab rows inside the frame
  (`[role=tablist]`, `.side-tabs`, `.pi-tabs`), bottom-panel heading, map/activity padding and status bar. Controls keep a
  target of at least 26 px (frame buttons 28 px). Content, canvas zoom, routes and figure sizes are unchanged.
- The frame exposes the value as `data-density` on `.workbench-frame`.

## Validation and older records

- A layout without `density` normalises to `comfortable` in memory; a layout whose `floating` has only `companion` and
  `dock` normalises `explorer` to `null` in memory. Stored arrangement records are never rewritten on read.
- Any other value is refused whole: an unknown density (`dense`, `Compact`, `null`, a number or object), an extra
  top-level field, a fourth or unknown floating key, or a malformed rectangle. In storage, a refused entry makes the
  arrangement record `corrupt`; it is left untouched until the reader discards it explicitly.
- Records written by 1.34 carry `density` and `floating.explorer`; an older build reads them as corrupt (unknown field)
  and leaves them untouched.

## Saved arrangements

- Both values are saved with **Save arrangement** and applied only by **Restore arrangement**, per project, audience and
  browser host, as before. Opening or reloading a project never applies them; Reset session layout returns to
  comfortable and docked.

## Out of scope

Separate browser windows, arbitrary docking trees, tabbed pane groups, snapping between panes, per-pane density and
cross-device synchronisation.
