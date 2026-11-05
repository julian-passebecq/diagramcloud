# Revising and removing an applied explanation

**Edit → Tours → Existing explanation → Revise explanation / Remove explanation** reopens or removes a walkthrough that `prepareExplanationWalkthrough` already added. Both go through the ordinary review: preparing changes nothing, Apply is one revision, one Undo restores the previous project exactly, and a download of the proposed patch is not a save.

## Reading an applied walkthrough back

`readExplanationWalkthrough(project, id)` (`src/intelligence/explanationWalkthrough.ts`) rebuilds the `diagramcloud.explanation-walkthrough` v1 request from what Apply recorded, and refuses rather than guesses:

| Request field | Read from |
|---|---|
| walkthrough ID, title | tour `walk-<id>.tour` (ID and title) |
| source cut (revision, fingerprint) | entry card `walk-<id>` role line |
| question | intro block `walk-<id>.intro` |
| top-level sources | entry card `sourceIds` |
| step order and IDs | tour stops, each on frame `walk-<id>.<step>.view` |
| step title | note `walk-<id>.<step>.note` label |
| step subjects | frame members except the note, frame connections |
| narration | tour stop narration |
| basis, case, prerequisites, questions | `diagramcloud.explanation-details/1` record `walk-<id>.<step>.contract` |
| step sources | note `sourceIds` minus the top-level sources |
| before / after state | tables `.before` / `.after` |
| takeaway | the one paragraph of `.text` found nowhere else |
| code focus | locator `.locator` (block and lines) |
| source view | the only non-explanation view holding the frame's subjects (and, without code, the frame's perspective) |

The rebuilt request is then rendered again at the recorded cut with the same renderer Apply used, and every recorded copy is compared with the rendering. Anything that differs is refused with its ID: an edited text, table or note, a re-narrated, reordered or removed tour stop, an extra card in a frame, a non-answer block attached to a generated note, an unexpected `walk-<id>.*` item, a connection to a generated card, or a generated card placed in another view (the entry card excepted). The reader cannot tell which of two copies the author meant, so it never chooses one. Visibility and card positions are author choices outside the request and are not compared.

Refused, not guessed: no or several candidate source views, a missing entry cut, question record or details record, an unreadable prerequisite or code locator, or a recorded request the v1 schema rejects. A refused explanation stays listed with its reason; Revise and Remove stay focusable (`aria-disabled`) and say why.

Two reconstructions are exact in output but not in input: an edge-only step comes back with its connection endpoints as explicit components (the frame is the same), and a step source already cited at the top level is not repeated. A frozen code excerpt is re-derived and compared while its cited block still has the recorded content fingerprint; after the cited code changed, the frozen copy is the only record of those lines and is read as recorded.

## Revise

`reviseExplanationWalkthrough(project, request)` takes a request bound to the **current** full-source fingerprint (a stale binding is refused like any other preparation) whose ID names the applied walkthrough; the App keeps the ID read-only. It renders the request with the current source facts (so a frozen excerpt refreshes from the current code) and produces one replace patch over exactly that walkthrough's generated cards, evidence, frames, index and tour, guarded by `test` operations on nodes, edges, views, blocks, sources, tours and story.

- **Stable IDs.** Generated IDs follow the walkthrough and step IDs. A kept step keeps its stop ID; a new step gets a new stop ID that no old stop used. The entry card keeps its place in the root view; kept frames keep their card positions.
- **Visibility.** A generated item that the author made public stays public; new items are private. The review says how many.
- **Answers.** Saved answers on a kept step stay attached and read **stale**: their question source (details record, cut) changed, and the saved binding is never rewritten. Answers on a dropped step are removed with it and listed in the review; Undo restores them. An answer also attached to a non-generated card stays there.
- **Story.** Story steps that point into a dropped frame or note are removed with it and listed.
- **Collisions.** A new step whose generated ID already belongs to other content is refused, as in authoring.
- Anything else that would still reference removed content fails document validation and is refused with the validator's reason.

## Remove

`removeExplanationWalkthrough(project, id)` removes the same set plus the entry card from every view that holds it, under the same refusals, with the same answer and story handling, and lists public items that leave the public view. Removing a freshly applied private walkthrough returns the source content exactly.

## Limits

- The request never recorded its source view, so a step whose subjects are held by several views cannot be revised or removed from the App; edit the JSON or keep the explanation.
- Any edit of generated content after Apply (including a narration edit in Tours) blocks Revise and Remove until it is undone. There is no merge of hand edits into a request.
- A frozen excerpt whose cited code changed cannot be checked for hand edits; Revise replaces it from the current code, visible in the review.
- Public projections, exports and Present never show these controls; the walkthrough content keeps the visibility its items have. No observation, review mark, execution or network request is created.
