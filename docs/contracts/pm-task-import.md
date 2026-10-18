# PM task snapshot: read-only import into an explanation

The ordinary JSON import dispatcher accepts the existing `datapass.owner-tasks/1` document. The authoritative shape remains PM's `src/owner-work.ts`; this consumer does not introduce a cross-product task schema or import PM's filesystem/provider code.

## Reader contract

A task belongs to an explicit organization/privacy/project/repository scope and document revision. Fields, IDs, state vocabulary, review vocabulary and local prerequisite references are validated. The visual subset is at most 60 tasks, 1000 local dependency edges and 256 KiB of input. PM's full task document can contain up to 1000 tasks; this visual subset refuses larger input completely and reports the generic unsupported-scope error. Nothing is silently dropped to make a graph fit.

The compiler makes one canonical node per task, shared between its state-column view and the dependency view. A detail child contains the exact full title, description, acceptance IDs, author, timestamps and declared state. Long PM titles remain in full in detail; native card labels are bounded. Edges mean only declared same-document prerequisites. Missing cross-project prerequisites require the separate source plan; none are inferred from titles, phases, actors, timestamps or layout.

All task/scope/source data is private. The public root is a neutral shell; no task IDs, counts, titles, source digest or scope is visible in public exports. No observation is created. Task state and review status are quoted declarations: `DONE` does not qualify a release, and `APPROVED` does not review an observation. Canonical diagram state remains idle/planned. Desired dates are not scheduled starts or durations and do not generate a Gantt.

## Ordinary staging and persistence

`stageImportText` calls the compiler through the normal JSON preview path. A new random, non-content-derived Project ID identifies the presentation snapshot. The exact input digest is private. Importing identical bytes already represented by the current document/library refuses with a generic notice; it does not overwrite an edited presentation. Changed bytes create another snapshot. This is not a bidirectional sync or automatic upsert. Compare/discard/update remains an explicit existing workspace action.

A failed stage has no mutations. The normal App import guard, preview, human Apply and existing local storage own subsequent opening/save behavior. Navigation and presentation edits do not call PM, update PM tasks, bind a native session, approve work or execute a prompt. The authoring backup is a DiagramCloud Project, never an owner-task authority file.

## Handoff boundary

A Pro release plan can be distributed in PM's existing `galaxy.sync-manifest/1` package: selected Markdown adoption affects future prepared prompts only. A `delivery-view/1` plan is not an owner-task document. Optional generators can prepare existing PM work-proposal/task shapes only after exact caller-supplied scope and acceptance binding. PM retains registry admission, expected-SHA authority writes, Config preparation, manual/native dispatch and session/result association.

This reader requires neither a PM installation nor a live model to explain a selected file. It does not make a private file public, acquire sources, fetch links or verify its claimed authority. Its own displayed source hash establishes bytes, not source authenticity.

## Qualification

The contribution includes actual source tests for the full dispatcher/compiler, native validation/public projection, state/dependency/detail identity, long text, source replacement, repeated input refusal, malformed input and unchanged normal Project/patch/provider/completion handling. Existing native import/preview/Apply/save/reopen, browser history and keyboard/390px journeys remain integration gates. Component/source tests are not installed PM, current runtime, host compatibility, public publication or a released V3 product.
