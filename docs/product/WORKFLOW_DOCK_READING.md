# Read authored workflow steps from the connected dock

When the permitted Project has story steps, **Show workflow steps** appears alongside the dock's project/view/selection context. It explicitly opens Workflow and focuses the retained Workflow tab. Selection, hover and ordinary dock tab changes never invoke this reveal action or silently switch the reader's tab.

Workflow begins with two separate readings:

- **Active story step** shows the host's current permitted story index and its supplied narration. **Open first story step**, **Previous story step** and **Next story step** navigate only that declared sequence. Boundary buttons remain focusable with `aria-disabled`; they do nothing at the boundary. No active index means no inferred current step.
- **Selected component in authored steps** lists every exact `story.nodeId` match for the selected permitted component. **Read step …** explicitly chooses that authored step through the existing story/navigation callback. Repeated references are all retained. Shared labels, membership in a view, highlighted edge endpoints and visual proximity do not infer participation. Selecting a component does not select a story step.

The complete story list and existing workflow components follow. Capacity and supplied-usage controls remain available, with their existing disclosures and state, after the authored story content. There is no new wrapper disclosure or execution control.

`projectDockModel` applies `publicDocument` before selecting or matching. Private story subjects, names and counts do not enter the public match list. Project, revision, Undo, camera, source permissions and saved arrangements remain owned by their existing authorities. Story order is a presented explanation—not execution order, chronology, timing or run evidence. This slice uses the existing story, not a new workflow/tour data model.

The optional `ProjectDockProps.onRevealWorkflow` callback is a host integration point for physical reveal/reading height. It fires only on explicit **Show workflow steps**, never an ordinary Workflow-tab click. The host may select the dock and change its requested height while preserving other layout fields. The component itself does not own or rewrite WorkbenchLayout. Root integration and its physical-layout qualification are separate from this donor.

Focused qualification: `tests/project-dock-workflow.test.ts` covers repeated exact references, missing/invalid cursors, no inferred matches, no model mutation, public noninterference, and story-before-calculations order. `tests/e2e/project-dock-workflow.spec.ts` exercises explicit reveal/focus, previous/next boundaries, parent context, unchanged Project JSON, no tab hijack, public omissions and keyboard/no-overflow behavior at 1440 and 390 pixels. Existing connected-workspace and capacity/usage journeys remain applicable.
