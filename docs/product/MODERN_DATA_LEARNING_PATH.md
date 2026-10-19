# Modern data: a navigable learning map, not a vendor feature dump

The catalogue is a client corpus. Start with the user's question, then choose a lesson, a worked case and a project mapping. This map groups possible lessons; it does not claim every lesson or adapter is implemented. Existing catalogue entries and native roadmap remain the actual inventory. Source references belong on each lesson and are refreshed independently.

| Area | Concepts to connect | Useful paired reading | Practical verification question |
| --- | --- | --- | --- |
| Business meaning | Capability, business object, event, decision, metric, owner, privacy | Business process / data contract | What does one row mean, and which decision depends on it? |
| Data modelling | Keys, grain, normalisation, relationships, dimensions/facts, slowly changing dimensions, semantic measures | ER/star / example rows and joins | Do joins duplicate measures or drop business objects? |
| Database behaviour | Transactions, isolation, MVCC, WAL, indexes, plans, constraints, concurrency | Logical operation / state and query evidence | What survives partial failure, and what does the index actually accelerate? |
| Storage and formats | Object/file/table, CSV/JSON, Parquet, Arrow, Delta, Iceberg, partitions, schema evolution | File/table layers / reader-writer compatibility | Is this a storage format, table protocol, in-memory layout or managed service? |
| Ingestion | Batch, event stream, CDC, snapshots, replication, shortcuts, deletion propagation | Producer/change path / consumer data state | Which system owns the truth, how fresh is it, and what is retained? |
| Processing | SQL, dbt, notebooks, Spark jobs, local Polars/DuckDB, reusable packages | Transformation logic / execution context | Which runtime, parameters, identity and retry contract are actually used? |
| Data correctness | Contracts, quality rules, nulls, units, timezones, late data, reconciliation, lineage | Before/after rows / lineage and checks | Does the evidence cover a sample or the whole relevant population? |
| Serving and analytics | Warehouse/lakehouse, semantic layer, Import/DirectQuery/Direct Lake, cache, APIs, application commands | Analytical definitions / consumer interfaces | Does a new frontend preserve metric, permission and freshness semantics? |
| Reliability and economics | Retry/idempotency, queue/backpressure, SLOs, capacity, duration, allocation, failure recovery | Control flow / dated observed or estimated intervals | What is measured, what is assumed, and where can costs be double-counted? |
| Governance and security | Identity, authentication/authorisation, roles, data access, secrets, audit, residency | Trust boundaries / principal-operation-policy table | Which principal can perform which action on which exact data? |
| AI and knowledge | LLM, RAG, vector index, property graph, graph retrieval, tools/MCP, skills, evaluation | Product architecture / retrieval or tool evidence | What was retrieved or executed, and which claims remain unsupported? |
| Migration and operation | SSIS/SSAS, Databricks/Fabric, multicloud, Git/CI, tests, artifacts, environments, rollout/rollback | Current/target / compatibility and qualification | What changes for the user, how is parity checked, and can data be recovered? |

This release adds eight bounded migration/engineering pattern candidates beside the prior technical and practical cases. It does not require a new repository, taxonomy service, training pipeline or automatic content collector. Start with three example clients (Galaxy, synthetic commerce, FOIL) and extend only when a new case reveals a genuine semantic or UX gap.

For each lesson: define the concept, distinguish neighbouring concepts, show a small mechanism/example, state when to use it and alternatives, identify failure modes, and point to source/version evidence. The right pane may be a table, code excerpt or short report. Not every concept deserves a node-link graph.
