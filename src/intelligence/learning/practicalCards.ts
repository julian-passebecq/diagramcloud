/**
 * Practical learning cards: eight migration / CI / handoff cases and six world-data patterns,
 * authored for the unified continuation. Pure data and plain builders: this module imports no
 * runtime value from `./catalogue` (which composes it), so there is no import cycle.
 *
 * Every card keeps applicability UNKNOWN_NOT_ASSESSED, carries no instance mapping and never
 * receives one of the five source-pinned reference families. A reconciliation decision decides
 * which cards join the App catalogue (`PRACTICAL_RECONCILIATION`, docs/product/CATALOGUE-RETURN.md).
 */

/** A dated documentation pointer in the shape of `learningSourceSchema` (validated by `./catalogue`). */
export type PracticalSourceRow = {
  id: string;
  title: string;
  url: string;
  kind: 'primary-documentation';
  retrievedOn: string;
  externalRevision: null;
  contentSha256: null;
  limits: string;
};

const RETRIEVED_ON = '2026-10-19';

const sourceRows = (rows: readonly (readonly [string, string, string])[], limits: string): PracticalSourceRow[] =>
  rows.map(([id, title, url]) => ({id, title, url, kind: 'primary-documentation', retrievedOn: RETRIEVED_ON, externalRevision: null, contentSha256: null, limits}));

/** Sources of the migration / CI / handoff cases. Primary references are dated pointers, not immutable copies or tenant tests. */
export const MIGRATION_SOURCES: readonly PracticalSourceRow[] = sourceRows([
  ['DC-SSIS-PREVIEW', 'Fabric Invoke SSIS Package (Preview)', 'https://learn.microsoft.com/en-us/fabric/data-factory/invoke-ssis-package-activity'],
  ['DC-SSIS-AZURE', 'Azure-SSIS integration runtime', 'https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime'],
  ['DC-SSAS-KINDS', 'Tabular and multidimensional solutions', 'https://learn.microsoft.com/en-us/analysis-services/comparing-tabular-and-multidimensional-solutions-ssas'],
  ['DC-ONELAKE-UNIFY', 'Unify data with shortcuts and mirroring', 'https://learn.microsoft.com/en-us/fabric/onelake/unify-data'],
  ['DC-FABRIC-MIGRATE', 'Fabric migration overview', 'https://learn.microsoft.com/en-us/fabric/fundamentals/migration'],
  ['DC-CLAUDE-SUBAGENTS', 'Native Claude subagents', 'https://code.claude.com/docs/en/sub-agents'],
  ['DC-SANDBOX', 'Windows Sandbox architecture', 'https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-overview'],
  ['DC-POSTGRES-JOINS', 'Relational table expressions', 'https://www.postgresql.org/docs/current/queries-table-expressions.html'],
], 'Dated documentation pointer. Exact environment eligibility, version compatibility and client approval are not established by this entry.');

/** Sources of the world-data patterns. Documentation references only; no cloud test performed. */
export const WORLD_DATA_SOURCES: readonly PracticalSourceRow[] = sourceRows([
  ['DC-FABRIC-CONNECTORS', 'Fabric Apps connector operations', 'https://learn.microsoft.com/en-us/fabric/apps/connectors'],
  ['DC-RAYFIN-SEMANTIC', 'Rayfin semantic models', 'https://rayfin.ai/docs/connectors/semantic-models'],
  ['DC-FABRIC-NOTEBOOK', 'Fabric notebooks', 'https://learn.microsoft.com/en-us/fabric/data-engineering/how-to-use-notebook'],
  ['DC-FABRIC-JOB', 'Fabric Spark job definitions', 'https://learn.microsoft.com/en-us/fabric/data-engineering/spark-job-definition'],
  ['DC-FABRIC-QUEUE', 'Fabric Spark queue eligibility', 'https://learn.microsoft.com/en-us/fabric/data-engineering/job-queueing-for-fabric-spark'],
  ['DC-FABRIC-COST', 'Fabric Apps capacity usage', 'https://learn.microsoft.com/fabric/apps/pricing'],
  ['DC-FABRIC-SQL', 'Fabric SQL usage reporting', 'https://learn.microsoft.com/en-us/fabric/database/sql/usage-reporting'],
  ['DC-FABRIC-CICD', 'Fabric CI/CD overview', 'https://learn.microsoft.com/en-us/fabric/cicd/cicd-overview'],
], 'Documentation reference only. Client eligibility, exact SDK/runtime and observed behavior need separate evidence; no cloud test performed.');

type MigrationLesson = {
  id: string;
  title: string;
  domain: 'warehousing' | 'data-engineering' | 'agentic-development';
  sources: readonly string[];
  definition: string;
  input: string;
  steps: readonly string[];
  output: string;
  failure: string;
};

/** The eight migration, CI and handoff cases (authored drafts). */
export const MIGRATION_LESSONS: readonly MigrationLesson[] = [
  {
    id: 'ssis-modernisation', title: 'SSIS to Fabric: classify before replacing', domain: 'data-engineering', sources: ['DC-SSIS-PREVIEW', 'DC-SSIS-AZURE'],
    definition: 'Inventory package components, endpoints and secrets before choosing retain, host, or rewrite. Fabric documents a bounded Invoke SSIS Package preview; that does not make every legacy package compatible.',
    input: 'An invented SSIS package reading an on-premises database with a third-party component.',
    steps: ['Inventory package and configuration dependencies.', 'Check preview eligibility: OneLake package location, supported public endpoints and components.', 'Keep an existing approved runtime when dependencies fail those checks.', 'Compare a rewrite with parameter, restart, data-quality and operational parity fixtures.', 'Plan a reversible cutover and separate data rollback.'],
    output: 'A compatibility matrix and candidate route, not a deployed migration.',
    failure: 'Do not turn preview support into a universal migration guarantee or copy credentials into diagrams.',
  },
  {
    id: 'ssas-semantic-migration', title: 'SSAS migration: model type changes the work', domain: 'warehousing', sources: ['DC-SSAS-KINDS'],
    definition: 'Tabular and multidimensional models require different migration assessments. Preserve business measures and access semantics, not merely table names.',
    input: 'An invented cube with measures, role filters, hierarchy navigation and scheduled processing.',
    steps: ['Identify tabular versus multidimensional model and versions.', 'Catalogue measures, MDX/DAX consumers, roles, hierarchies and processing.', 'For a tabular target, test compatibility rather than assuming every feature transfers.', 'Treat multidimensional-to-tabular as redesign of semantic behaviour, not file conversion.', 'Check totals, filter context, security and refresh under a controlled cutover.'],
    output: 'A semantic parity plan with unresolved features named.',
    failure: 'A working dashboard screenshot is not measure parity or role-security qualification.',
  },
  {
    id: 'databricks-fabric-coexist', title: 'Databricks and Fabric: coexist before relocating compute', domain: 'data-engineering', sources: ['DC-ONELAKE-UNIFY'],
    definition: 'Choose whether to share access, replicate data or migrate runtime. These are different decisions with different owners and failure modes.',
    input: 'An invented governed table produced by a Databricks job and consumed by a Fabric report.',
    steps: ['Identify producer of record and latency requirement.', 'Check source-specific mirroring or shortcut semantics.', 'Map identity, catalog governance, storage access and table compatibility.', 'Validate the actual consumer query and update visibility.', 'Only then assess moving code or compute as a separate change.'],
    output: 'A source/consumer contract without duplicate metric ownership.',
    failure: 'A shortcut does not port notebooks, jobs, permissions or all governance rules.',
  },
  {
    id: 'spark-runtime-migration', title: 'Spark runtime migration: same language is not parity', domain: 'data-engineering', sources: ['DC-FABRIC-MIGRATE'],
    definition: 'A Spark migration should bind code, runtime, packages, storage, identity and workload fixtures. Syntax compatibility alone is insufficient.',
    input: 'A synthetic parameterised transformation with late events and one rejected row.',
    steps: ['Capture source runtime and dependency versions.', 'Map scheduler, storage and authentication behaviour explicitly.', 'Test keys, nulls, timestamps, decimals, checkpoints and failure recovery.', 'Measure equivalent workloads before comparing cost or duration.', 'Keep a rollback and retain old source/result identities.'],
    output: 'Comparable behaviour evidence for one selected workload.',
    failure: 'Do not label an identical file as a qualified migration or claim performance from engine names.',
  },
  {
    id: 'multicloud-data-placement', title: 'Multicloud: reference, copy or CDC?', domain: 'data-engineering', sources: ['DC-ONELAKE-UNIFY'],
    definition: 'Select data placement from ownership, freshness, residency and failure behaviour. A logical link and a physical copy do not have the same operational contract.',
    input: 'An invented external object store and a governed reporting consumer.',
    steps: ['Name the authoritative data and required availability.', 'Compare reference access, snapshot copy and change replication.', 'Check egress, consistency, deletes, schema changes and access revocation.', 'Verify lineage and correction handling on a small fixture.', 'Record which system can write each data product.'],
    output: 'A placement decision with explicit tradeoffs and verification.',
    failure: 'No universal zero-copy, zero-egress or full mirroring guarantee is implied.',
  },
  {
    id: 'pro-native-handoff', title: 'Pro to native lead: outcome, boundaries, evidence', domain: 'agentic-development', sources: ['DC-CLAUDE-SUBAGENTS'],
    definition: 'One integration lead can delegate disjoint deliverables after shared contracts are settled. The handoff specifies outcomes and checks; the native lead chooses actual tools and subagents.',
    input: 'A synthetic two-view feature, a data inspector and an authored catalogue case.',
    steps: ['Recover exact source and active ownership once.', 'Define shared contracts and acceptance before parallel edits.', 'Give each lane allowed files, read inputs and a result checkpoint.', 'Keep App/manifests/release identity under one integrator.', 'Continue unclaimed work locally rather than waiting for an unlaunched worker.'],
    output: 'An inspectable proposed work plan, not automatic task admission or a launched session.',
    failure: 'A prompt cannot add model capabilities, grant tools, create workers or establish approval.',
  },
  {
    id: 'ci-runner-boundaries', title: 'CI host, runner, isolated guest and test target', domain: 'agentic-development', sources: ['DC-SANDBOX'],
    definition: 'A CI scheduler, execution runner, isolated guest and application under test are separate components. Record where each test actually ran.',
    input: 'A synthetic Windows-only UI test with a bounded guest and an offline package.',
    steps: ['Separate source trigger from runner and guest identity.', 'Declare inputs, outputs, networking and granted lifetime.', 'Qualify the required user/session and installed application boundary.', 'Bind artifacts and results to exact source and environment.', 'Dispose the guest without silently extending permissions or claiming a hosted run.'],
    output: 'A source-bound qualification plan and a truthful result location.',
    failure: 'A bare-editor diagnostic pass is not a full product release check; an old grant is not renewed by a new diagram.',
  },
  {
    id: 'join-lineage-review', title: 'Join inspection: simultaneous fanout and loss', domain: 'data-engineering', sources: ['DC-POSTGRES-JOINS'],
    definition: 'Trace supplied input-row identities through explicit join keys before interpreting counts and totals. Lineage evidence has a coverage boundary.',
    input: 'Four invented order rows sum to 42; an inner join produces four rows summing to 70.',
    steps: ['Declare input/output grain, types and null policy.', 'Inspect each left row and matching right row identities.', 'Report unmatched rows and repeated matches independently.', 'Compare aggregates only under their declared measure semantics.', 'Use a logical lineage diagram, not a Sankey unless compatible quantities and conservation are supplied.'],
    output: 'A bounded explanation, not SQL execution or complete production lineage.',
    failure: 'Equal input/output row counts can hide both lost records and duplicated measures.',
  },
];

type WorldDataCase = {
  id: string;
  title: string;
  domain: 'warehousing' | 'data-engineering' | 'case-studies';
  question: string;
  definition: string;
  sources: readonly string[];
  basis: 'authored-reasoning' | 'primary-source-summary';
  /** The two linked panes of the reading: left (business) and right (data). */
  a: string;
  b: string;
  input: string;
  steps: readonly string[];
  output: string;
  limits: readonly string[];
  alternatives: readonly (readonly [string, string])[];
  failure: string;
};

/** The six world-data practical patterns (authored drafts). */
export const WORLD_DATA_CASES: readonly WorldDataCase[] = [
  {
    id: 'dual-world-data', title: 'Physical equipment to data product', domain: 'data-engineering',
    question: 'How does a business object become records and decisions without losing meaning?',
    definition: 'A physical asset, configuration, signal, sample, aggregate and decision metric should retain separate identities and explicit mappings.',
    sources: ['DC-FABRIC-CONNECTORS'], basis: 'authored-reasoning', a: 'Physical / business view', b: 'Data contract view',
    input: 'Synthetic asset W-01; configuration v1; one missing wind sample; explicit m/s units.',
    steps: ['Name the business decision and the asset/configuration scope.', 'Declare sample grain, event time, quality and source units.', 'Map the asset and channel to different records; retain unknown calibration.', 'Inspect raw-to-window lineage and the chosen missing-data rule.', 'Switch both panes to data while retaining the business context.'],
    output: 'Inspectable mappings and a versioned data contract, not calibrated physical behavior.',
    limits: ['Illustrative fixture; no real machine or query execution.', 'No automatic unit conversion or inference of missing mappings.'],
    alternatives: [['Signal-first telemetry', 'When operational diagnosis needs event-time detail and quality before business aggregation.'], ['Scenario-first scientific model', 'When comparing model/configuration/resource alternatives; preserve the simulation identity.']],
    failure: 'Joining on labels, overwriting configurations or mixing telemetry with simulated yield destroys interpretation.',
  },
  {
    id: 'report-app-coexistence', title: 'Power BI and Fabric App: reuse before migration', domain: 'warehousing',
    question: 'Do we need a new workflow or a replacement report?',
    definition: 'A Rayfin semantic-model connector queries existing model logic through delegated executeQuery; an application need not replace the analytical model.',
    sources: ['DC-RAYFIN-SEMANTIC', 'DC-FABRIC-CONNECTORS'], basis: 'primary-source-summary', a: 'Existing reporting product', b: 'Candidate operational application',
    input: 'A synthetic reporting KPI plus an unmet alert-acknowledgement workflow.',
    steps: ['Keep the existing reporting route and define the missing user action.', 'Reuse a compatible semantic contract for reads.', 'Put commands in a separately validated store; do not overwrite measurements.', 'Compare user identity, metric totals and error cases.', 'Measure access, operational cost and support before selecting a migration.'],
    output: 'A reversible coexistence proposal with explicit parity gates; no app is deployed.',
    limits: ['Connector support is version- and permission-specific.', 'The documented lakehouse SQL connector is read-only.'],
    alternatives: [['Keep Power BI', 'When the need is analysis, reporting and existing model security.'], ['Add an application', 'When task entry, multi-step actions or specialised interaction has a demonstrated benefit.']],
    failure: 'Copying DAX into frontend code or assuming a new UI removes backend costs creates divergent truth.',
  },
  {
    id: 'notebook-vs-job', title: 'Notebook versus Spark job: choose the execution contract', domain: 'data-engineering',
    question: 'Which authoring and launch mode fits this transformation?',
    definition: 'Fabric supports interactive notebooks and notebook jobs; Spark job definitions package an entrypoint, libraries and arguments for submitted work.',
    sources: ['DC-FABRIC-NOTEBOOK', 'DC-FABRIC-JOB', 'DC-FABRIC-QUEUE'], basis: 'primary-source-summary', a: 'Interactive investigation', b: 'Repeatable submitted workload',
    input: 'One synthetic transformation with pinned inputs, environment and expected output.',
    steps: ['Explore a small fixture interactively and separate reusable logic from UI state.', 'Choose notebook activity or job definition for the intended entrypoint.', 'Pin parameters, environment and access identity.', 'Test rerun idempotency, failure output and data-quality checks.', 'Record queue/start/run intervals separately for the actual launch mode.'],
    output: 'A tested execution contract and recovery procedure, not a universal notebook-to-job migration.',
    limits: ['Scheduled notebooks can be production work; a .py file alone is not production readiness.', 'Queue eligibility differs from interactive/API submissions; check current capacity support.'],
    alternatives: [['Notebook activity', 'When code plus explanation and existing notebook orchestration are useful.'], ['Spark job definition', 'When packaged code, dependencies and parameters form the release boundary.'], ['Local Polars / DuckDB', 'For bounded local analysis that does not require distributed execution.']],
    failure: 'An interactive success does not establish service identity, scheduling, idempotency or queue behavior.',
  },
  {
    id: 'capacity-denominators', title: 'Capacity measurements: units and windows first', domain: 'case-studies',
    question: 'What do CU, CU-seconds and an idle tail actually establish?',
    definition: 'A capacity share needs usage in CU-seconds divided by capacity CU times a stated reporting interval; it is not automatically a currency bill.',
    sources: ['DC-FABRIC-COST', 'DC-FABRIC-SQL'], basis: 'authored-reasoning', a: 'Usage and component scope', b: 'Window and cost assumptions',
    input: 'Illustrative 3 CU-seconds, capacity 2 CU; windows 30 seconds and 300 seconds.',
    steps: ['Keep documented meter behavior separate from a community report.', 'Record item, operation, trial/paid context, version and raw evidence.', 'Recompute 3/(2*30)=5 percent and 3/(2*300)=0.5 percent.', 'Merge overlapping idle tails only for the same physical database.', 'Separate SQL floor, scale-up, storage, API, functions and semantic-query costs.'],
    output: 'A transparent scenario and unresolved measurements, not a tenant cost prediction.',
    limits: ['No Capacity Metrics data was fetched.', 'A mean or median query number is not a page total; no smoothing/throttling model is implemented.'],
    alternatives: [['Read-only semantic route', 'When governed read queries satisfy the application goal.'], ['Transactional SQL route', 'When validated durable writeback is required and measured capacity is acceptable.']],
    failure: 'Calling 3 CU-seconds 0.5 percent of a 60 CU-second budget is a tenfold denominator error.',
  },
  {
    id: 'ci-host-vs-fabric-git', title: 'Git host, CI runner and Fabric deployment are separate', domain: 'data-engineering',
    question: 'Can the existing team workflow deploy this application safely?',
    definition: 'Version control, validation and deployment are separate stages. A runner calling an API is not the same integration as native workspace Git synchronisation.',
    sources: ['DC-FABRIC-CICD'], basis: 'authored-reasoning', a: 'Source and review', b: 'Build and deployment evidence',
    input: 'A synthetic repository, a changed data contract and one TEST target.',
    steps: ['Recover the current repository and review boundary.', 'Validate source and parameterised data contracts without publishing.', 'Use the already-approved deployment identity and target.', 'Capture exact artifact and target receipts.', 'Test rollback of schema/data and application state separately from Git revert.'],
    output: 'An evidence-linked release procedure, not new tenant permissions or a new CI system.',
    limits: ['Native Git provider coverage is distinct from external runner portability.', 'A deployment-ready package is not a successful live deployment.'],
    alternatives: [['Existing hosted pipeline', 'When its identity, artifact and environment controls already fit.'], ['Approved local runner', 'When equivalent checks and isolation are actually qualified.']],
    failure: 'A green build does not certify tenant permissions, data migration or runtime compatibility.',
  },
  {
    id: 'stream-batch-contract', title: 'Stream, batch and replay: preserve one data meaning', domain: 'data-engineering',
    question: 'How do live-like data and backfills avoid becoming different truths?',
    definition: 'An ingestion contract should separate event time, ingestion time, stable event identity and transformation version so replay can be reconciled with online processing.',
    sources: ['DC-FABRIC-JOB'], basis: 'authored-reasoning', a: 'Events and source retention', b: 'Reconciled analytical output',
    input: 'Synthetic measurements with one late event and one sensor dropout.',
    steps: ['Preserve immutable input and the original sample IDs.', 'State the watermark/window and correction policy.', 'Keep missing distinct from zero and log rejected inputs.', 'Use a new transformation/run identity for replay.', 'Compare output keys and aggregates before replacing a served view.'],
    output: 'A reconciled source-to-output contract, not a new streaming engine.',
    limits: ['No exactly-once guarantee follows from this illustration.', 'Low latency is optional and workload-driven.'],
    alternatives: [['Batch files', 'When delayed data and simple reproducibility satisfy the decision.'], ['Event ingestion', 'When latency, volume and operational response justify the added complexity.']],
    failure: 'Dropping late data silently or inventing zeros can invalidate downstream scientific or service metrics.',
  },
];

const AUTHORED = {provenance: 'r4-packet-authored-draft', packetContentStatus: 'AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN', adoptedOn: RETRIEVED_ON, applicability: 'UNKNOWN_NOT_ASSESSED'} as const;
const UNRELATED = {status: 'RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE', canonicalTopicId: null} as const;

/** Learning entries (unvalidated plain objects) for the eight migration / CI / handoff cases. */
export function migrationCardEntries() {
  return MIGRATION_LESSONS.map(l => ({
    entryKind: 'pattern' as const, id: l.id, version: 1 as const, title: l.title, summary: l.definition.slice(0, 500), domain: l.domain,
    editorial: {contentRevision: '2026-10-19-unified-review-draft', ...AUTHORED, sourceRefs: [l.sources[0]]},
    lesson: {
      definition: [{text: l.definition, basis: 'authored-reasoning' as const, sourceRefs: [] as string[]}],
      problem: l.title, prerequisites: [] as string[],
      levels: {overview: l.definition, architecture: l.steps.join(' '), detail: l.failure},
      example: {provenance: 'authored-synthetic' as const, input: l.input, steps: [...l.steps], output: l.output, limits: ['Proposed exercise, not executed on a client.', 'Documentation and target support must be refreshed before implementation.']},
      alternatives: [
        {label: 'Preserve the working system', whenToConsider: 'When no unmet requirement justifies change, or compatibility remains unresolved.', status: 'CANDIDATE_NOT_SELECTED' as const},
        {label: 'Incremental migration or coexistence', whenToConsider: 'When a bounded capability can be qualified and reversed independently.', status: 'CANDIDATE_NOT_SELECTED' as const},
      ],
      failureModes: [{text: l.failure, basis: 'authored-reasoning' as const, sourceRefs: [] as string[]}],
      sourceRefs: [...l.sources],
    },
    related: {...UNRELATED}, instanceMappings: [] as never[],
    instanceMappingPolicy: 'Explicit source-bound client mapping and review required; no universal recommendation or client adoption.',
  }));
}

/** Learning entries (unvalidated plain objects) for the six world-data patterns. */
export function worldDataCardEntries() {
  return WORLD_DATA_CASES.map(c => ({
    entryKind: 'pattern' as const, id: c.id, version: 1 as const, title: c.title, summary: c.question, domain: c.domain,
    editorial: {contentRevision: '2026-10-19-domain-data-draft', ...AUTHORED, sourceRefs: [...c.sources]},
    lesson: {
      definition: [{text: c.definition, basis: c.basis, sourceRefs: c.basis === 'authored-reasoning' ? [] : [...c.sources]}],
      problem: c.question, prerequisites: [] as string[],
      levels: {overview: c.definition, architecture: c.a + ' versus ' + c.b, detail: c.failure},
      example: {provenance: 'authored-synthetic' as const, input: c.input, steps: [...c.steps], output: c.output, limits: [...c.limits]},
      alternatives: c.alternatives.map(([label, whenToConsider]) => ({label, whenToConsider, status: 'CANDIDATE_NOT_SELECTED' as const})),
      failureModes: [{text: c.failure, basis: 'authored-reasoning' as const, sourceRefs: [] as string[]}],
      sourceRefs: [...c.sources],
    },
    related: {...UNRELATED}, instanceMappings: [] as never[],
    instanceMappingPolicy: 'No client adoption or applicability is inferred; explicit source-bound mapping and native review required.',
  }));
}

export type PracticalDecision = {
  id: string;
  set: 'migration' | 'world-data';
  decision: 'keep' | 'drop';
  /** Existing R4 cards (or kept practical cards) this candidate was judged against. */
  judgedAgainst: readonly string[];
  reason: string;
};

/** One decision per candidate; docs/product/CATALOGUE-RETURN.md records the same table. */
export const PRACTICAL_RECONCILIATION: readonly PracticalDecision[] = [
  {id: 'ssis-modernisation', set: 'migration', decision: 'keep', judgedAgainst: ['dbt-spark-sql'], reason: 'No R4 card covers legacy package classification; distinct problem (retain, host or rewrite).'},
  {id: 'ssas-semantic-migration', set: 'migration', decision: 'keep', judgedAgainst: ['star-grain', 'oltp-olap'], reason: 'Semantic-model parity (measures, roles, model type) is not the star-grain or workload question.'},
  {id: 'databricks-fabric-coexist', set: 'migration', decision: 'keep', judgedAgainst: ['medallion-environments', 'multicloud-data-placement'], reason: 'Separates sharing access from relocating compute; multicloud-data-placement covers placement only.'},
  {id: 'spark-runtime-migration', set: 'migration', decision: 'keep', judgedAgainst: ['dbt-spark-sql'], reason: 'dbt-spark-sql explains technology roles; this card is runtime parity evidence for one workload.'},
  {id: 'multicloud-data-placement', set: 'migration', decision: 'keep', judgedAgainst: ['batch-stream-cdc', 'databricks-fabric-coexist'], reason: 'Reference, copy or replication as a placement contract; batch-stream-cdc explains arrival and processing, not placement.'},
  {id: 'pro-native-handoff', set: 'migration', decision: 'drop', judgedAgainst: ['worktrees-ci', 'workflow-agent'], reason: 'Same problem as worktrees-ci: declared write scopes, separate candidate work and one integrator. Its remaining point (a plan is not a launch) is already stated by workflow-agent and the V3 handoff contract.'},
  {id: 'ci-runner-boundaries', set: 'migration', decision: 'keep', judgedAgainst: ['worktrees-ci', 'pro-native-handoff'], reason: 'worktrees-ci binds a check to a source revision; this card separates scheduler, runner, isolated guest and test target, a different question (where did the test run).'},
  {id: 'join-lineage-review', set: 'migration', decision: 'keep', judgedAgainst: ['star-grain', 'scd-history'], reason: 'star-grain teaches declaring grain and detecting one double-counting join; this card traces row identities through simultaneous fanout and loss (42 becomes 70 with two rows unmatched), backed by the join inspection.'},
  {id: 'dual-world-data', set: 'world-data', decision: 'keep', judgedAgainst: ['oltp-olap'], reason: 'Physical asset to data product identity mapping is not covered by any R4 card.'},
  {id: 'report-app-coexistence', set: 'world-data', decision: 'keep', judgedAgainst: ['oltp-olap', 'workflow-agent'], reason: 'Reuse before migration for a reporting product; alternatives stay candidates, never a recommended replacement.'},
  {id: 'notebook-vs-job', set: 'world-data', decision: 'keep', judgedAgainst: ['dbt-spark-sql'], reason: 'Execution contract inside Spark (interactive versus submitted), not the SQL / dbt / Spark role split.'},
  {id: 'capacity-denominators', set: 'world-data', decision: 'keep', judgedAgainst: ['anthropic-scion'], reason: 'Unit and window arithmetic for capacity readings; no R4 card covers measurement denominators.'},
  {id: 'ci-host-vs-fabric-git', set: 'world-data', decision: 'keep', judgedAgainst: ['worktrees-ci', 'ci-runner-boundaries'], reason: 'Deployment evidence and data rollback separate from Git revert; neither worktrees-ci nor ci-runner-boundaries covers deployment.'},
  {id: 'stream-batch-contract', set: 'world-data', decision: 'drop', judgedAgainst: ['batch-stream-cdc'], reason: 'Same problem as batch-stream-cdc (duplicates, order, replay and idempotent output); kept in the domain-data reading example only.'},
];

const KEPT = new Set(PRACTICAL_RECONCILIATION.filter(row => row.decision === 'keep').map(row => row.id));

/** Practical cards that join the App catalogue, in decision order (migration first, then world data). */
export function practicalCatalogueEntries() {
  return [...migrationCardEntries(), ...worldDataCardEntries()].filter(entry => KEPT.has(entry.id));
}

/** Sources cited by at least one kept practical card; a source cited only by a dropped card stays in its example. */
export function practicalCatalogueSources(): PracticalSourceRow[] {
  const cited = new Set(practicalCatalogueEntries().flatMap(entry => [...entry.editorial.sourceRefs, ...entry.lesson.sourceRefs, ...entry.lesson.definition.flatMap(row => row.sourceRefs)]));
  return [...MIGRATION_SOURCES, ...WORLD_DATA_SOURCES].filter(source => cited.has(source.id));
}
