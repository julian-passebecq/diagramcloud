# Interview and client authoring

Source contribution, 20 October 2026. Read docs/AI_GUIDE.md, the native product limits and source revision before using it.

## Interview practice

The existing catalogue already contains per-lesson explain-back questions. This contribution preserves them and adds a local practice client: **16 rounds, 64 original questions, four fictional company contexts and 33 source records**. Each round is concept -> syntax/semantic trap -> small exercise -> engineering scenario. It includes a reference answer, hints, checks, a common mistake, source/version context and a small relationship list.

Topics: SQL; Python/pandas; statistics/scientific quality; warehousing/semantics; file and table formats; ingestion/API/checkpoints; Spark execution; PySpark/Spark SQL; streaming; Fabric; Databricks; PostgreSQL; VM/container/IaC; AI/RAG/MCP/skills; full-stack/Git/review; company/portfolio explanation. Foundation and intermediate labels are editorial, not assessed user competence.

`InterviewBank` is an authored TypeScript module, **not a newly supported top-level App JSON import or MCP command**. Amend through reviewed source/content, validatePracticeBank, source tests and the existing catalogue composition. Preserve question IDs where semantics are unchanged, revise content version and retain reference provenance. The session binds actual full bank content, not just the advertised revision.

Typed answers, reveal state and self-review exist only in local component memory. They are not part of Project JSON, public search, saved contexts, bank export or an external model call. Context changes/remount/reload clear them. A hidden answer remains in the client bundle: it is a learning aid, not secure exam delivery. No code runs, no automatic grading, no certification prediction and no hiring ranking. Self-review is a user declaration; editing an answer invalidates that declaration.

Primary references explain technical concepts. Fictional business facts, prompts and scenarios are original teaching content, not claims about real employers or their interviews. Some answers are design reasoning, not a vendor quotation. Reference dates and version scopes are snapshots; managed runtimes may differ. PostgreSQL ordering in the sample explicitly uses NULLS LAST and a unique event tie-breaker. Spark sample code is displayed, not proof of a managed-runtime execution.

## Choose the existing input for the outcome

| Outcome | Required input | Optional | Not established |
|---|---|---|---|
| Company/full-stack explanation | Ordinary Project with business purpose, stable entities, responsibilities, source refs, explicit views and permitted visibility | Contracts, code, sample rows, typed relations, tours | Actual company stack or runtime without sources |
| Brainstorm and compare proposals | Idea brief described in idea-portfolios.md, compiled through reviewed staging | Attributed assessments, explicit alternative relations, supplied dates | Approval, task launch, forecast from ranking |
| Organization/project progress | delivery-view/1 plus exact native sources, scoped task snapshots and receipts | Supplied phases, allowances, conflicts, intervals | Global live synchronization, new authorizations or schedule from phase order |
| Recruiter portfolio | Approved public facts, roles/contributions, dates and evidence | Category dock, search, concise diagram/summary, career timeline | Public release of private client notes or proposed AI work as delivered experience |
| IaC / CI / VM explanation | Sanitized source and target/version/identity declarations | Actual measured and qualified outcome receipts | Permission to apply Terraform, deploy, spend or open private infrastructure |

## Context and view recipes

Keep organization/project/source context, current question/viewpoint, reading chapter/question and delivery phase independent. A reading step does not mean work completed. Multiple organization memberships are explicit relations, not access grants. Search only indexes the permitted cut.

Use existing view routes and unsaved-work guards. The reading wayfinder derives two levels or a route list from explicit childViewId relationships. It neither converts data dependencies into parents nor guesses which parent a shared view belongs to. The new phase strip only groups phases supplied by the plan, including phase 0. It computes no dates.

For a full-stack case, begin with business/capability, then application responsibilities, request/trust boundaries, data grain/provenance and source/CI/IaC/delivery. The included Beacon Evidence Library is fictional and validated as a native Project. It is not a reconstruction of the private gallery, FOIL or a real employer. Navigation portals are not extra runtime services.

For a portfolio website, defer implementation until the native reading client is qualified. Inspect julianvuev2 before choosing reuse or a successor repository. A future thin public site can reuse a pinned public Project/view/export, omit development controls and show Cloud/BI/Analytics/AI category dock plus public search. Do not fork App state, publish private work history or equate career progression with Git ancestry.
