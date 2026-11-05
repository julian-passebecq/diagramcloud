# Companion: related concepts and detour return (1.34.0, P2)

Code: `src/core/companionPane.ts` (pure state), `src/ui/CompanionPane.tsx` (rendering). Tests: `tests/companion-pane.test.ts`, `tests/e2e/v3-companion.spec.ts`.

## Concepts tab

- Built from `conceptsExplaining` through `companionConcepts(project, publicMode, nodeId)`. Only **stored** concept mappings (`learningMappings`) that target the component are listed. Nothing is inferred from a shared word, tag or icon; a look-alike component without a stored mapping has no Concepts tab.
- Offered only when at least one row exists for the current audience (`companionTabs(content, conceptCount)`).
- Public / Present: the public projection runs first (`publicDocument`), so only public reviewed or source-declared mappings appear; suggestions, rejected and private mappings never do, and cited private sources are absent.
- Each row shows the mapping state label (`MAPPING_STATE_LABELS`: suggested is "candidate, not evidence", stale lists its reasons and is never rebound), the lesson revision it was bound to, the reviewer when there is one and the permitted cited evidence titles.
- `CompanionPane` takes an optional `onLesson(conceptId)`. When it is absent the tab is a read-only list; when present, a concept with a catalogue title is a button "Open lesson <title>". The App does not pass it yet (handed to P7: pass `onLesson={openLesson}` to the `CompanionPane` mount in `src/App.tsx`).
- The tab never edits the document, creates no mapping, review or observation.

## Selected question

- The Questions tab lists the focus question and follow-ups of the component's `explanation-details/1` record as a radio group "Selected question". The choice is reading state only, never stored in the project.
- A choice is bound by component ID, kind (focus / follow-up), position and exact text (`resolveQuestion`). Another component never inherits it, and a moved or reworded question is dropped, never rebound.

## Detour record and Return

- `startDetour(doc, origin, target, current, {audience, reading})` records project ID, revision, audience (`author` or `public`), the origin and target anchors with their labels, and the reading state: tab, related-context filters (copied, not shared) and selected question. A second hop in the same project and audience keeps the first origin and its reading state; a hop in another project or audience starts a new record.
- `resolveReturn(project, publicMode, detour)` checks the record against the **current permitted document**. Return is refused with the generic `VIEW_ROUTE_UNAVAILABLE` message ("This navigation target is unavailable in the current permitted context.") when the project or audience changed, or the origin view or component is gone, revoked for this audience or no longer reachable through explicit drilldown. The notice never names what is missing, and a refused detour shows no recorded label.
- When available, Return restores the anchor, the tab (Related when that tab no longer has content), the filters and the question (dropped when it changed). A revision change alone is not a refusal: identity is checked in the current document, and `revisionChanged` reports it.
- In the App, leaving for Portfolio or Present remounts the pane, so an author detour is dropped rather than carried into a public reading; the refusal is what a reader sees when the origin is removed or revoked while the pane stays mounted (for example an import or Undo during the detour).

## Limits

- Selected question and detour are session state of the mounted pane; they are not saved, deep-linked or part of saved contexts.
- No lesson opens from the companion until the App passes `onLesson`.
