# Lane report: lesson-figure-interaction

Date: 2026-11-05 · Branch: `feat/diagramcloud-lesson-figure-interaction` (base `origin/main` 7c9a2b1)

## What changed
Closes the ROADMAP gap "clicking the figure does nothing yet" left by #137.
- **`src/intelligence/learning/figureInteraction.ts`** (new): a pure reducer for one selection and a drill trail (`select`, `drill`, `back`, `reset`), `selectedIn` (a component outside the scene is never shown selected), `drillTarget` (Open inside only for a component in `scene.collapsed`, below Detail, so it follows explicit childViewId, stays within two levels and never revisits a view), `backTarget`.
- **`src/ui/LessonDiagramFigure.tsx`**: the SVG stays `role="img"`; each drawn component gets a real `<button>` laid over it (accessible name = label, `aria-pressed`, in scene order). The SVG now sits in a `lesson-diagram-stage` wrapper that carries the zoom width; the SVG fills it, so figure sizes are unchanged. A selected card gets a dashed accent stroke (played steps keep the solid one).
- **`src/ui/LessonDiagram.tsx`**: one selection shared by the figure, the list (each row gets a "Select … in the figure" button and `data-selected`) and a new "Selected component" panel with the same facts as the list row. "Open inside X" moves the diagram one depth deeper through the existing `explore` depth action; "Back to <depth>" returns. Focus goes to Back after a drill and to the component's figure button after Back. The lesson depth radio and explanation do not move; a lesson depth or diagram change clears the trail. Nothing touches zoom, environment, perspective, variant, run, audience or the document.
- **`src/ui/lessonFigure.css`** (new, loaded from `src/main.tsx`): overlay button and visible focus ring (inset, so the camera box does not clip it).
- `docs/contracts/lesson-diagram-figure.md`: Interaction and Tests sections updated.

## How verified
- `npm run check`: passes.
- `npx tsx --test tests/lesson-figure-interaction.test.ts tests/learning-depth-playback.test.ts`: 19/19 (6 new).
- Full unit suite `npx tsx --test tests/*.test.ts`: 2314 tests, 2311 pass, 0 fail, 3 skipped.
- `npm run build`: passes.
- Playwright, `DIAGRAMCLOUD_E2E_PORT=26830`: `lesson-figure-interaction.spec.ts` 2/2 (click, list, Open inside, Back, document unchanged at 1440; Tab/Enter/Space only at 390x844, no horizontal overflow), `learning-depth-playback.spec.ts` 3/3 unchanged, `learning-catalogue`, `learning-instance`, `learning-release-recovery` 10/10.

## Problems hit
- Interactive children inside an SVG `role="img"` are hidden from assistive tech, and the existing tests assert that role. Overlaying HTML buttons positioned in percentages of the figure's viewBox keeps the picture role and gives real buttons.

## Remaining issues
- Depth is scene-wide: Open inside on one container opens every container at that level (the depth model has no per-node expansion). The note says which component the drill started from.
- No arrow-key navigation between figure buttons (Tab order only, in scene order).
- Frame headers (the "Inside X · view" labels) are not interactive.

## Next steps
- Per-container expansion (open only the chosen container) would need a depth-scene option; size: dispatch.
- Arrow keys between figure buttons in spatial order; size: one patch.
