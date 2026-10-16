# Gap causes and suggested next steps

Gap advice is optional metadata on generated readiness, document and selected-source reports. It is not part of the canonical Project graph, a verification claim or an action runner. Existing messages, diagnostic codes, IDs and source pointers remain intact. Older reports without advice stay readable and unclassified.

| Cause | Evidence required before the producer supplies it | Suggested next step |
|---|---|---|
| `missing-declaration` | A known authored field or source registry declaration has not been supplied. | Supply the declaration. |
| `missing-source` | An explicitly selected repository is reported missing. | Review the selected scope and supply an authorized source if available. |
| `access-denied` | The selected-file reader receives an explicit `NotAllowedError` or `SecurityError`. | Request access from the source owner or choose another authorized source. |
| `unsupported-analyzer` | A producer reaches a known unsupported format/version/capability branch. | Use a compatible source or supporting specialist. |
| `dynamic-unresolved` | A recognized expression needs evaluation that the static analyzer does not perform. | Supply a resolved declaration or external evidence; retain the unresolved relation. |
| `stale-revision` | A source bundle and the same explicit atlas member have different known full Git commits. | Refresh the selected source or regenerate the proposal. |
| `conflicting-evidence` | Explicit declarations contradict one another, such as dbt parent maps and declared dependencies. | Review both declarations and their scope. |
| `consumer-error` | A known analyzer runtime/worker stage fails or returns invalid generated output. | Report the consumer failure with sanitized operation/version context. |

An unavailable Markdown target has source-selection advice, but its cause stays unclassified: it might be omitted, unreadable or outside the selected scope. An ambiguous reference is not automatically a dynamic expression. A documentation/driver discrepancy is a review candidate, not a confirmed conflict. Unknown revisions, scan age, generic read errors, cancellation and invalid input do not establish stale source, denied access or a consumer defect. Producers do not classify legacy message text by keywords.

**Structure**, **Evidence / gaps** and **Details panel → Gaps** show the available reason, source location and next step. Configured-source diagnostics additionally expose private producer details. Advice is text; it performs no collection, permission change, AI call, evaluation, verification or apply. External evidence still needs the existing human-reviewed patch path before it can become an observation.

Selected-source bundles retain their string diagnostics and may add bounded `diagnosticDetails`. Their validator checks these details and their paths; the parser/cache identity distinguishes the new output. Acquisition context persists optional advice through the existing private evidence block and save/reopen boundary. Public projections omit that private context. Portfolio and Present unmount private source/check collectors, cancel cancellable work and discard transient selected-file errors, counts and results. A late verification file read cannot propose a patch after unmount, a new selection or a Project change. A UI profile does not change those audience rules.

Relevant implementation: `gapDetails.ts`, `readiness.ts`, `materialize.ts`, the existing document/native producers, selected-file and worker boundaries, and `sourceBundlePatch.ts`. The advice does not replace their validators or review guards.
