# Implementation architecture and important corrections

## Dependency direction

```
existing core Project/Atlas/scan/experience
                 |
                 v
src/intelligence (pure derived functions + input compiler)
       |                           |
       v                           v
CLI/file/browser acquisition    UI/controller
       |                           |
       +----- candidate preview ---+
                         |
                         v
existing validateDocument / patch / persistence
                         |
                         v
existing publicDocument / ViewSpec / scene / exporters
```

No runtime dependency from core/model back into intelligence. No React in the pure analysis files. The document parser knows no filesystem or network. It receives explicitly selected text. The CLI is a thin boundary, not a new analysis engine.

## Contract/persistence decisions

| Contract | Owner | Persistence | Approval / freshness |
|---|---|---|---|
| Project schema v1 | existing core/model | existing IndexedDB + authoring JSON/sidecar | existing revision/preview/undo |
| ProjectManifest v1 | existing Atlas | explicit input file | membership declared; per-repo revision |
| ProjectBrief v1 | intelligence input | selected source file; not another synchronized store | strict validate -> NEW candidate -> review |
| readiness/1 | intelligence | ephemeral/exportable private report | identifies Project revision, not live source |
| document-map/1 | intelligence | derived selected-source context | exact line links; no runtime/decision inference |
| asset-plan/1 | intelligence | derived private plan/checklist | registry resolution; no approval or generation |
| future AnalysisBundle | intelligence | start in memory, rebuild; don't introduce DB migration yet | content/scope digest + profile/analyzer versions |
| future observations/receipts | external producer | existing reviewed overlay | artifact/env/revision/time-specific evidence |

Do not generalize every internal report into a separately versioned public ecosystem standard now. The three file formats exist because users/agents export them; other interfaces can remain ordinary TypeScript types.

## Stable identity / source identity

Authored entities and edges have explicit IDs. The compiler now requires relationship IDs so insertion/reordering does not rename an edge. Generated filesystem identity is repository-qualified normalized path + entity kind; use content hash for freshness, not as the entity ID (editing text should not rename the entity). Renames require explicit mapping or a clearly labelled candidate, not automatic merge by similar label.

For a real source scan, keep repository ID, declared/ref SHA, actual content digest, scan profile version, parser version, limits and completeness separately. Worktree dirty/untracked content may not match HEAD. An input digest identifies what was seen; it does not attest runtime or ownership.

Partial scope, filtering, missing access and parser changes invalidate naive snapshot comparisons. A disappearing node is not proof that production removed it. A different prod version is not an error unless it violates a stated desired state or compatibility rule.

## Information truth dimensions (do not collapse)

Origin (authored/extracted/inferred), review (draft/accepted), visibility, evidence strength (static/test/runtime), source version and event time are independent. Four levels are NOT a single confidence percentage. A UI label 'verified' or test exit code cannot promote every connected component.

A foreign key describes a schema relationship, not row movement. An import is a code dependency, not a network call. A document backlink is provenance, not implementation. A package dependency is not deployment. A CI file mentioning a job does not prove the job ran. A standard brief hierarchy is business structure, not filesystem containment.

## Mode strategy

Source and purpose can be persisted as small UI/session settings; current graph remains Project. Depth controls actual acquisition/projection limits. No 'Deep' until supported. AI Off is deterministic; Assist is a bounded context/proposal exchange, no token configuration. Autonomous remains a deferred capability, not a checkbox that creates execution authority.

Gaps are evaluated against the requested output. Unknown business owners do not block code structure. Unknown assets do not block rendering. Runtime evidence missing blocks a runtime claim, not the whole diagram. A tiny repository is not deficient because it lacks Kubernetes or DR.

## Privacy and resource safety

- Filter selected roots/paths and size budgets before reads. Existing .env/key/state exclusions remain. Never follow symlinks or nested repo roots implicitly.
- Use actual content safety filtering for document excerpts; mapDocuments requires a caller filter. Name filtering is not secret detection. Secret detector heuristics are not a general data-loss guarantee.
- Don't publish raw input brief, local paths, document text, absolute paths or authoring reports by accident. Export-time redaction applies to graph, captions, tables, counts, alt text, SVG metadata and all context files.
- Browser import requires a legitimate selected file/root. Remote URLs are locators, not permission to fetch.
- JSON/CSV is inert data, not shell or instructions. CSV writer defends against spreadsheet formula injection.
- Imported SVG/code labels do not become executable DOM. No arbitrary HTML/functions in these contracts.

## Quick wins retained vs distractions cut

Retained: reuse current figure recommendations, inspect current Project for missing useful context, source-linked Markdown/CSV, private asset checklist, labelled generic fallback, one Business Overview, one existing Atlas with logical bindings, clean empty state for unsupported Git.

Cut from 1.24: 25 full fake enterprise clients, complete graph DB, giant pluggable analyzer framework, full App rewrite, universal parser, new dock manager, remote model provider stack, fork T3, reimplement Hop, image-generated diagrams, endless renderer A/B testing.

No promise of universal completeness. Every unsupported case must degrade honestly, not be silently mapped to the nearest fashionable cloud architecture.
