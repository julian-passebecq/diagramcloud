# Idea portfolios: discussion input, ordinary Project output

20 October 2026. This is a source contribution against 27916ed, not a released capability. Existing Project/choices/evidence/review and public projection remain authoritative. No agent backend, project-management authority or separate idea database is added.

## What is accepted

`diagramcloud.ideation-brief/1` is a bounded authoring input. In this contribution the **actual JSON / AI stage dispatcher** compiles it to a new ordinary Project and presents the normal import review. It does not Apply, launch, accept an idea or mutate the open document. Existing project ID collisions refuse rather than overwrite edits. The helper `compileIdeationBrief` can be called by an offline producer. The CLI/MCP have not acquired a new idea-generation command: producers can supply the compiled ordinary Project or prepare a reviewed code/content change.

The example `examples/idea-client/orchard.brief.json` is the complete executable input example. `ideationBriefSchema` plus `validateIdeationBrief` define the contract; do not infer fields from this prose.

Required root: schema, id, title, question, provenance, sources, groups, ideas, relations. Visibility defaults PRIVATE. A `supplied-discussion` **must** remain private; create a separately reviewed sanitized Project for publication. A fictional, independently authored teaching brief may be public. The authoring helper does not infer consent from a screenshot or accessible URL.

Source: stable id, title, location; optional HTTPS URL without embedded credentials. Location should identify supplied document/revision/line/page, or an authored-case declaration. A source pointer is not proof the source is accurate or current. Do not place secrets in it.

Group: id, label, kind organization/project/theme, description. These are lenses, not one imposed containment taxonomy or permission boundary. An idea can belong to several groups while retaining one identity.

Idea: id, title, groupIds, problem, proposal, benefits, risks, unknowns, conditions, consideration, assessments, estimate, sourceIds. Consideration is candidate/exploring/deferred/rejected/superseded. **No approved, running or shipped state is accepted from a brainstorm.** Assessment criterion is feasibility/difficulty/value, rating low/medium/high/unknown, with rationale and sourceIds. Empty assessments are valid; absence is not low. Optional estimate is null or low/high active-minutes with basis/sourceIds. Zero is preserved; inverted ranges refuse. These are opinions/allowances, not measured throughput or a task forecast.

Relations are explicit depends-on/alternative/related/supersedes/conflicts-with. Full reasons and citations are retained in native evidence tables. Circular idea dependencies can be displayed as discussion; they do not become a runnable DAG. The input may contain a native schedule with timezone and actual supplied/estimate intervals, but no dates are calculated from priorities, opinion scores or reading order. Every scheduled idea must exist. Unsupported dates/intervals fail native validation.

## Boundaries and storage

At most 512 KiB input, 120 ideas, 24 groups, 80 sources and 400 relationships. Unknown fields, duplicate IDs/references, unresolved endpoints and unsafe citation URLs are refused. Strings are inert; nothing in a proposal is executed.

Output uses ordinary nodes, explicit child-view navigation, code/table evidence profiles, source records, dependency/control edges, and **candidate** native choices. Observations are always empty. The normalized input digest is a change detector, not raw-file identity, authenticity or approval. Product source/task/receipt bindings remain separate.

Private discussions have a generic public root/title. Every real group, source, profile, question and idea is private. Public projection precedes search, counts, metadata inspection and navigation. Edited or corrupt profiles are reported as invalid, never reconstructed from similar labels. Newly private cited sources make their profiles unavailable. Do not relabel private discussion payloads public as a shortcut to publication.

## Reading and navigation

The author workspace's Brainstorm toggle exposes cards, comparison matrix and a consideration board. No drag-to-approve or implicit priority score. The right pane begins with a scope summary and follows a selected idea; Pin keeps it explicitly independent. Related proposals are navigable, with their relation type visible. A source/audience change clears transient picks and pins.

Focus selects a readable detail view; it is not a new 3D camera. The optional context reminder retains the current containing/filter scope and surrounding ideas. It is **not** the previous page, browser Back, a semantic parent inferred from an edge, or a minimap of a copied private image. No extra permanent bottom panel is required. Opening a native architecture target checks source equality, idea identity and a real permitted child route; the App rechecks after its ordinary unsaved-edit guard.

The idea UI does not write PM tasks or complete delivery blocks. A human/native lead may explicitly select a bounded scope in its existing mission and link it to the source idea through reviewed records. The existing delivery-view/1 and PM task contracts then own work, estimates, resources, results and release evidence. That selection is not granted by reading or importing this brief.
