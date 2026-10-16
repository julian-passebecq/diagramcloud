# Catalogue retrieval through the CLI and MCP (R4-AC-25)

One catalogue and mapping model, reached from the Learning catalogue UI, the TypeScript module, the CLI and the selected-file stdio MCP. The CLI and MCP call `src/intelligence/learning/query.ts`, which calls the same functions as the UI (`catalogueRows`, `matchesCatalogueRow`, `lessonInstanceFacts`, `conceptsExplaining`, `mappingCandidates`, `suggestMapping`). `tests/catalogue-retrieval.test.ts` checks that all paths return identical results.

## Read operations (`catalogueQuery`, format `diagramcloud.catalogue-query/1`)

| `op` | Arguments | Result |
|---|---|---|
| `search` | `query`, `kind`, `domain`, `family`, `limit` (1-200, default 50) | `total`, `limited` and the list rows the UI shows: lessons, legacy patterns and recipes decoded unchanged, and omitted or invalid rows with their reason |
| `lesson` | `id`, `depth` (`overview`, `architecture`, `detail`) | the lesson with the explanation at that depth only, resolved sources and editorial metadata; a legacy registry ID is refused as having no authored lesson |
| `prerequisites` | `id` | direct prerequisites and every transitive prerequisite, learn-first |
| `mappings` | `conceptId` or `nodeId` (optional) | public reviewed or source-declared mappings with stale reasons and the gap, or the concepts explaining one public component, plus the count of concepts without a reviewed mapping |

`search`, `lesson` and `prerequisites` read static content (`scope: static-catalogue`). `mappings` needs the selected project and reads only its public projection (`scope: public-projection`).

## Proposal (`proposeMappingSuggestion`)

Without a target: the name-based candidates of the public projection (`CANDIDATES_ONLY`), labelled *candidate, not evidence*. With a target: `diagramcloud.proposal/1`, `state: REQUIRES_AUTHOR_REVIEW`, carrying a `diagramcloud.patch` (version 1, `test /revision`, one `add` of a `suggested` mapping) checked with `applyDocumentPatch` before it is returned. The request is strict: no `origin`, `state`, `suggestedBy`, `reviewedBy` or `reviewedAt`. The calling path sets the origin: MCP `ai` with the client's `clientInfo.name` as `suggestedBy`; CLI `imported` (`suggestedBy: diagramcloud intelligence CLI`) unless a person passes `--author <name>`, which records `author`. Applying stays the ordinary reviewed import; review and rejection stay Edit-mode actions, and an AI suggestion cannot be reviewed by its own suggester.

## Privacy

Public projection runs first. A hidden component, view, source or mapping never appears in a result, a candidate list or a count; a hidden target and an absent one get the same refusal (`Target unavailable in public projection`, `Component unavailable in public projection`); a citation outside the public projection is refused. Results are capped at 1 MiB.

## Limits

No network, model call, execution or file write besides the CLI's new output directory. The MCP keeps protocol 2025-06-18 and reads only the document selected at startup; tool arguments never name files. No automatic mapping, no review, no observation.
