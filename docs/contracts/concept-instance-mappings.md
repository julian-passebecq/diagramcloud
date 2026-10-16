# Concept to instance mappings (R4-W3)

A bounded reference-to-instance association. It is not a graph assertion, an observation, a crosswalk relation or a proof of applicability.

## Model

`Project.learningMappings` is optional (`src/core/model.ts`); documents without it are unchanged and valid. Each mapping has a stable `id`, the catalogue `conceptId` and lesson `contentRevision`, a `target` (`projectId`, `kind` node or view, exact `id`, `projectRevision` at binding, evidence `fingerprint`), `evidence` (`sourceIds`, `blockIds` of the same project), `state`, `origin` (`author`, `ai`, `imported`, `source`), optional `suggestedBy`, `reviewedBy`, `reviewedAt`, `note` and `visibility`.

The fingerprint (`src/core/learningMapping.ts`) is a deterministic hash of the target's evidence: for a component its kind, cited sources (title, location, URL) and evidence blocks; for a view its component and connection membership. It identifies evidence; it does not make it true. Labels, summaries, positions and designed status are presentation and do not change it.

## States

Stored: `suggested`, `source-declared`, `reviewed`, `rejected`. Derived: `stale`, when the lesson content revision, the target's evidence, the target's existence, a cited reference or the project id no longer match. A stale mapping keeps its stored binding and is never rebound automatically; only an explicit Edit-mode review binds it to the current revisions.

`validateDocument` enforces: unique IDs and one mapping per concept/target pair; source-declared and reviewed mappings cite at least one project source or evidence block (a shared name, tag or icon is not evidence); reviewed records `reviewedBy` and `reviewedAt`; suggested and source-declared carry no reviewer; an `ai` origin records `suggestedBy`, is never `source-declared`, and is never reviewed by its own `suggestedBy`. A dangling target or citation is stale, not invalid, so deleting a component never blocks an edit.

## Operations (`src/intelligence/learning/mappings.ts`)

`suggestMapping` takes a strict proposal without state or review fields and binds the current revisions. `reviewMapping` and `rejectMapping` are the explicit human actions offered only in Edit mode; one action is one validated commit and one Undo. `mappingCandidates` ranks components by shared words, labelled *candidate, not evidence*, and never creates a mapping. `lessonInstanceFacts`, `conceptsExplaining` and `savedExplanation` read after public projection when asked for the public view; `savedExplanation` always does and binds the lesson content revision.

## Privacy

`publicDocument` projects mappings last, after every other closure, so a mapping never pulls a source, block, node or view into public output. It keeps only public reviewed or source-declared mappings whose target is kept and whose evidence still matches the authoring document, filters citations to kept public ones (dropping the mapping when none remain), drops `note`, and records the public target fingerprint so staleness reads the same in both projections. Suggestions, rejections and stale-target rows stay in the authoring document. Counts, candidate search and Explained by lists are computed on the projection.

## Navigation

**Open** goes to the exact component in the first reachable view that contains it, or to the view itself; an unreachable target has no fallback. The studio keeps a return context (lesson ID, depth, content revision) and shows **Back to lesson <title> rev <revision>**; returning restores the lesson at that depth and says so, including when the content revision has changed. Navigation saves nothing.

## Limits

No automatic mapping, no observation is created, and Lens/Mosaic contracts are unchanged. Catalogue content stays versioned code; a content revision change makes existing mappings stale for re-review.
