# Lane report: lesson-diagram-spatial (P5, 1.34.0 plan)

Date: 2026-11-04 · Branch: `feat/diagramcloud-lesson-diagram-spatial` (base `5da1806`)

## What changed
Lesson diagrams used to be a nested list only. Each depth scene is now also drawn as a spatial SVG figure.
- **`depthSceneViewSpec`** (`src/intelligence/learning/depth.ts`)
  - Derives a view over exactly the depth scene's IDs.
  - Adds one frame per opened view. Frames come from explicit drilldown only, and a level-2 frame nests inside its level-1 frame.
  - Places components at their authored positions, shifted.
- **`depthHighlight`** (same file) maps a played step to its component and the connections that touch it.
- **`depthFigureDocument`** (same file) returns `publicDocument` for a public audience.
- **`src/ui/LessonDiagramFigure.tsx`** draws the shared export scene (`buildScene`) inline.
  - Camera zoom sizes only the figure, which scrolls inside its own box.
  - The declared-environment tag appears on the figure.
  - The highlight follows reduced motion: no transition, instant scroll.
- **`src/ui/LessonDiagram.tsx`** places the figure above the list.
  - The list is no longer scaled by zoom and stays the text and keyboard alternative.
  - Connections touched by the played step are marked in the list.
  - Environment and instances are now read from the permitted document.
- New contract: `docs/contracts/lesson-diagram-figure.md`.

## How verified
- `npx tsc --noEmit`: passes.
- `tests/learning-depth-playback.test.ts`: 13/13 pass, 5 of them new.
- `npm test`: 2220 tests, 2215 pass, 2 fail, 3 skipped. Both failures were already there and are outside this lane's files:
  - `adoption-journeys` cites `.github/workflows/ci.yml:43`;
  - `release-entry-docs` checks the README anchor `#exports-and-fidelity`.

  `deep-cache` failed once in a full run and passed on its own, so it looks flaky.
- `npm run build`: passes.
- Playwright (Chromium, port base 26220):
  - `learning-depth-playback`: 3/3, including a new 390 px reduced-motion test;
  - `learning-catalogue` and `learning-instance`: pass;
  - `learning-release-recovery`: 6/6 at 1440 and 390.
- Screenshots at 1440 and 390 px were inspected by eye.

## Problems hit
- The old spec asserted `transform: scale(2)` on the list wrapper. Zoom now sizes the figure, so the spec checks `data-zoom` and compares the figure and list widths instead.

## Remaining issues
- Routes can cross a frame's dashed border or header text when a connection links a framed component to one shown higher up. This is readable but not avoided.
- Authored positions are used as they are. A view laid out for wide cards can make a sparse figure.
- Clicking a component in the figure does nothing. The list is the interaction path.

## Next steps
- Route connections around frame headers (treat each header as an obstacle in `routeAround`). Size: one patch.
- Optional: clicking a figure component focuses its list row. Size: one patch.
- Fix the two failing base tests (the stale `ci.yml:43` citation and the README anchor). Size: one patch, and it belongs to the release package.
