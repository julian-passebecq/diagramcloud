# Catalogue return: practical cards reconciled into the App catalogue

19 October 2026, continuation after 1.31.0 (lane C). This page records how the fourteen practical candidates of the unified continuation (eight migration / CI / handoff cases and six world-data patterns) were reconciled with the twelve R4 lessons. The decisions are data in `src/intelligence/learning/practicalCards.ts` (`PRACTICAL_RECONCILIATION`); `tests/practical-patterns.test.ts` checks that this page and the code agree on what the App shows.

## Where the cards live

- The card data moved out of `examples/` into `src/intelligence/learning/practicalCards.ts`, so the App bundle never imports `examples/`. `examples/review-workspace/patterns.ts` and `examples/domain-data/patterns.ts` re-export it; there is no second copy of any literal.
- `learningCatalogue` (`src/intelligence/learning/catalogue.ts`) is the twelve R4 lessons, unchanged and first, then the kept practical cards. `learningSources` is the R4 sources, unchanged, then the sources cited by a kept card.
- The legacy matcher snapshot (`tests/fixtures/catalogue-matcher-snapshot.json`) is unchanged: lessons never take part in matching.
- The UI, the CLI (`npm run intelligence -- catalogue`) and the stdio MCP (`diagramcloud_catalogue`) read the same composed catalogue; `tests/catalogue-retrieval.test.ts` keeps the three paths identical.

## Dedupe rule

1. A candidate whose problem equals an existing card's problem (case and spacing ignored) is not added. The composition enforces this mechanically (`problemKey`), so a later duplicate cannot slip in.
2. Overlaps were judged by reading each candidate against the twelve R4 cards, explicitly `worktrees-ci` against `ci-runner-boundaries` and `pro-native-handoff`, and `star-grain` against `join-lineage-review`. A candidate that answers the same question as an existing card is dropped, even when its wording differs.
3. Source IDs are unique across the registries, and so are URLs: the composition refuses a URL that appears under a second ID. A source cited only by a dropped card is not added (`DC-CLAUDE-SUBAGENTS`).
4. Every kept card passes `validateLearningCatalogue` and the content guards, keeps applicability `UNKNOWN_NOT_ASSESSED`, has `instanceMappings: []`, has related status `RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE` with no canonical topic, and never receives one of the five source-pinned reference families. Its alternatives stay `CANDIDATE_NOT_SELECTED`.

## Decisions

| Candidate | Set | Decision | Judged against | Reason |
| --- | --- | --- | --- | --- |
| `ssis-modernisation` | migration | keep | `dbt-spark-sql` | No R4 card covers legacy package classification; distinct problem (retain, host or rewrite). Now also cites the Azure-SSIS integration runtime, the "existing approved runtime" alternative. |
| `ssas-semantic-migration` | migration | keep | `star-grain`, `oltp-olap` | Semantic-model parity (measures, roles, model type) is not the star-grain or workload question. |
| `databricks-fabric-coexist` | migration | keep | `medallion-environments`, `multicloud-data-placement` | Separates sharing access from relocating compute; `multicloud-data-placement` covers placement only. |
| `spark-runtime-migration` | migration | keep | `dbt-spark-sql` | `dbt-spark-sql` explains technology roles; this card is runtime parity evidence for one workload. |
| `multicloud-data-placement` | migration | keep | `batch-stream-cdc`, `databricks-fabric-coexist` | Reference, copy or replication as a placement contract; `batch-stream-cdc` explains arrival and processing, not placement. |
| `pro-native-handoff` | migration | **drop** | `worktrees-ci`, `workflow-agent` | Same problem as `worktrees-ci`: declared write scopes, separate candidate work and one integrator. Its remaining point (a plan is not a launch) is already stated by `workflow-agent` and the V3 handoff contract. |
| `ci-runner-boundaries` | migration | keep | `worktrees-ci`, `pro-native-handoff` | `worktrees-ci` binds a check to a source revision; this card separates scheduler, runner, isolated guest and test target, a different question (where did the test run). |
| `join-lineage-review` | migration | keep | `star-grain`, `scd-history` | `star-grain` teaches declaring grain and detecting one double-counting join; this card traces row identities through simultaneous fanout and loss (42 becomes 70 with two rows unmatched), backed by the join inspection. |
| `dual-world-data` | world data | keep | `oltp-olap` | Physical equipment to data product identity mapping is not covered by any R4 card. Title changed from "Physical asset to data product": the word "asset" made the lexical candidate ranker offer this lesson for an unrelated "Scion Asset Management" component, which AC-20 forbids. |
| `report-app-coexistence` | world data | keep | `oltp-olap`, `workflow-agent` | Reuse before migration for a reporting product; alternatives stay candidates, never a recommended replacement. |
| `notebook-vs-job` | world data | keep | `dbt-spark-sql` | Execution contract inside Spark (interactive versus submitted), not the SQL / dbt / Spark role split. |
| `capacity-denominators` | world data | keep | `anthropic-scion` | Unit and window arithmetic for capacity readings; no R4 card covers measurement denominators. |
| `ci-host-vs-fabric-git` | world data | keep | `worktrees-ci`, `ci-runner-boundaries` | Deployment evidence and data rollback separate from Git revert; neither `worktrees-ci` nor `ci-runner-boundaries` covers deployment. |
| `stream-batch-contract` | world data | **drop** | `batch-stream-cdc` | Same problem as `batch-stream-cdc` (duplicates, order, replay and idempotent output). It stays a chapter of the domain-data reading example only. |

Result: 24 lessons in the App catalogue (12 R4 + 12 practical), 36 catalogue rows with the 12 legacy pattern and recipe entries. Kinds: concept (11), case-study (1), pattern (12).

## What this does not do

- No card is matched to a client, reviewed or applied; a lesson is authored teaching content. A shared word between a card and a component is a candidate only, never evidence.
- No prerequisite link was added between a practical card and an R4 card: the candidate builders in `examples/` validate each set on its own sources, and a cross-set prerequisite would make them depend on the composed catalogue. The relationship is recorded in the "Judged against" column instead.
- The two dropped candidates remain in their examples (`buildMigrationCandidates` returns eight, `buildPracticalPatternCandidates` six); they are teaching drafts, not App entries.
