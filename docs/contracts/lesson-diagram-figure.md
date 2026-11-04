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
- The figure is `role="img"` with a summary label. Its components are not focusable. The list is the keyboard path.

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
- `tests/e2e/learning-depth-playback.spec.ts` checks, at 1440 px:
  - a figure and frames are present for each depth;
  - the environment tag appears;
  - zoom resizes the figure but not the list;
  - stepping highlights the component and its two connections.
- The same spec checks, at 390 px with reduced motion:
  - the page has no horizontal overflow, even at 200% zoom;
  - the highlight has no transition;
  - keyboard playback still works.
