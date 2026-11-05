# Lesson diagram figure (`diagramcloud.depth-figure/1`)

Extends R4-AC-12 (semantic depth). A lesson diagram shows each depth scene as a spatial SVG figure above the existing nested list. The list stays the text and keyboard alternative.

## Source

- `depthScene(doc, viewId, depth, {audience})` (`src/intelligence/learning/depth.ts`) stays the only source of components, connections and opened views.
- `depthSceneViewSpec(scene, layoutFrom?)` derives one renderer-neutral `ProjectView` whose `nodeIds` and `edgeIds` are exactly the scene's IDs, plus one frame per opened view. It adds no facts.
- `depthFigureDocument(doc, audience)` gives the document the figure reads: `publicDocument(doc)` for a public audience (adoption journeys), the author's copy for compiled lesson examples, which are private by default and never exported.
- The figure is drawn by the shared export scene (`buildScene` in `src/export/scene.ts`): the same measured boxes and orthogonal routes as the SVG, HTML and PPTX exports. `src/ui/LessonDiagramFigure.tsx` renders it as inline SVG.

## Containers

- A frame exists only for a `scene.views[]` entry with `via`, which means explicit `childViewId` drilldown. A connection, a shared label or a tag never creates a container.
- A frame sits below the components of the view that holds its container. A level-2 frame is nested inside its level-1 frame.
- Inside each frame, positions are the author's own positions in that source view, shifted but never re-ranked. A view without positions uses a three-column grid in scene order.
- A component already shown higher up is not drawn again inside a frame. This is the same de-duplication the scene already does.

## Interaction

- **Step playback:** `depthHighlight(scene, nodeId)` returns the played component and the scene connections that touch it. A step whose component is not in the scene highlights nothing. The list keeps `aria-current="step"` on the component and marks the touched connections.
- **Camera zoom:** sizes the figure only. The SVG width is `min(zoom × 100%, zoom × figure width px)` inside its own scroll box. Zoom never changes depth, the environment, the list or the page width.
- **Declared environment:** when an environment is chosen, components with a declared instance in it get a "declared in X" tag on the figure. This is a declaration, never a deployment or an observation.
- **Reduced motion:** highlight changes use no transition, and scrolling the figure to a highlighted component is instant. Without a browser (server render), motion counts as reduced.
- The drawing is `role="img"` with a summary label. Each drawn component also has a real `<button>` laid over it (accessible name = component label, `aria-pressed` when selected, visible focus ring), in scene order, reached by Tab.
- **Selection** (`src/intelligence/learning/figureInteraction.ts`): click, Enter or Space selects a component; pressing it again clears the selection. One selection is shared by the figure, the list (each row has a "Select … in the figure" button and is marked `data-selected`) and the "Selected component" panel, which shows the same facts as the list row (kind, declared instance, summary and evidence at Detail, the components inside it). A component that is not in the current scene is never shown as selected.
- **Open inside:** offered only when `drillTarget(scene, nodeId)` finds the component in `scene.collapsed` and the scene is below Detail. It moves the diagram one semantic depth deeper (the same `explore` depth action), so its view opens through explicit `childViewId` drilldown, bounded at two levels, never revisiting a view. At Detail a collapsed component says it is beyond the two-level bound.
- **Back:** "Back to <depth>" returns to the depth the drill started from and reselects the drilled component; focus moves to Back after a drill and to the component's figure button after Back. The lesson's own depth radio and explanation do not move; changing the lesson depth or the diagram source clears the trail.
- Selection and drill never change zoom, environment, perspective, variant, run or audience, and never create a document revision.

## Never

- Store a figure, a layout or a highlight in the Project. There is no new model, revision, observation or review.
- Draw an ID that is not in the depth scene, or read a private component for a public audience.
- Treat playback order as timing or a run. The playback label is unchanged.

## Tests

- `tests/learning-depth-playback.test.ts` checks:
  - the view holds only depth-scene IDs for every lesson diagram and depth;
  - author-only components are absent for the public audience;
  - frames nest by drilldown;
  - no dependency edge becomes a container;
  - the highlight mapping;
  - a figure renders for every depth.
- `tests/lesson-figure-interaction.test.ts` checks the selection and drill reducer, the two-level bound, that drilling moves only the depth, and that each drawn component renders as a named button.
- `tests/e2e/lesson-figure-interaction.spec.ts` checks click selection shared by figure, list and panel, Open inside and Back (focus, lesson depth unchanged, document unchanged), and a Tab/Enter/Space-only walk at 390x844 without horizontal scroll.
- `tests/e2e/learning-depth-playback.spec.ts` checks, at 1440 px:
  - a figure and frames are present for each depth;
  - the environment tag appears;
  - zoom resizes the figure but not the list;
  - stepping highlights the component and its two connections.
- The same spec checks, at 390 px with reduced motion:
  - the page has no horizontal overflow, even at 200% zoom;
  - the highlight has no transition;
  - keyboard playback still works.
