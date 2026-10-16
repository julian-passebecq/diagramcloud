/** The twelve R4 learning-proposal cards, verbatim data (R4 packet catalogue/cards, contentRevision 2026-10-16.1). Adopted only through adoptLearningCard. */
export const R4_LEARNING_CARDS:readonly unknown[]=[
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "oltp-olap",
  "entryKind": "concept",
  "title": "Transactional systems versus analytical systems",
  "domain": "warehousing",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "Start from the question and workload, not the database logo.",
  "claims": [
   {
    "text": "OLAP serves analytical exploration and aggregation rather than the short transactional operations that motivate OLTP.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-OLAP"
    ]
   }
  ],
  "levels": {
   "overview": "Explain an order being recorded versus an analyst studying orders over time.",
   "architecture": "Show operational inputs, integration, analytic model and consumer separately. A logical role need not be a separate deployed service.",
   "detail": "Ask about concurrent writes, consistency, row grain, query shape, retention and refresh boundaries."
  },
  "prerequisites": [],
  "example": {
   "provenance": "authored-synthetic",
   "input": "Two fictional orders and a request for monthly sales.",
   "steps": [
    "Record each order once.",
    "Prepare a defined analytic slice.",
    "Group the retained sales by month."
   ],
   "output": "A transaction path and an analysis path with different responsibilities.",
   "limits": [
    "No throughput, cost or latency result is supplied."
   ]
  },
  "alternatives": [
   {
    "label": "Single-store reporting",
    "whenToConsider": "Small selected workloads may justify avoiding another store.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Separate analytical serving",
    "whenToConsider": "Consider when workload or historical requirements justify separation.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "Why is a transactional schema not automatically the best reporting model?",
   "answerHints": [
    "Describe different workloads.",
    "Explain grain and historical requirements.",
    "Avoid claiming one physical design fits every case."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-OLAP"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "star-grain",
  "entryKind": "concept",
  "title": "Fact grain, dimensions and joins",
  "domain": "warehousing",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "State what one fact row represents before drawing the star.",
  "claims": [
   {
    "text": "A star schema organizes measures in fact tables and descriptive context in dimensions. Fact grain must be defined.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-STAR",
     "S-FACT"
    ]
   }
  ],
  "levels": {
   "overview": "Explain sales by customer and date.",
   "architecture": "Draw FactSales, DimCustomer and DimDate, with keys and one declared fact grain.",
   "detail": "Inspect two order-line rows, key uniqueness and a join that accidentally multiplies totals."
  },
  "prerequisites": [
   "oltp-olap"
  ],
  "example": {
   "provenance": "authored-synthetic",
   "input": "Synthetic lines L1: 2 units at 10; L2: 1 unit at 15.",
   "steps": [
    "Declare one row per order line.",
    "Calculate each line amount.",
    "Join to one matching customer version and one date."
   ],
   "output": "Two rows and sales of 35 synthetic currency units.",
   "limits": [
    "The value is fixture arithmetic, not business evidence.",
    "A missing or nonunique dimension match must remain visible."
   ]
  },
  "alternatives": [
   {
    "label": "Flat export",
    "whenToConsider": "Useful for a bounded one-off analysis.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Star schema",
    "whenToConsider": "Useful when explicit dimensions and reusable aggregation are justified.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "What is the grain of your fact table, and how would you detect a double-counting join?",
   "answerHints": [
    "Name one row precisely.",
    "Check key cardinality.",
    "Compare row counts and sums before and after joining."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-STAR",
   "S-FACT"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "scd-history",
  "entryKind": "concept",
  "title": "Slowly changing dimensions and temporal joins",
  "domain": "warehousing",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "Distinguish correcting current data from preserving historical context.",
  "claims": [
   {
    "text": "SCD type 1 overwrites a value; type 2 keeps time-based versions of a member.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-DIM"
    ]
   }
  ],
  "levels": {
   "overview": "A fictional customer moves from North to South: should old sales move too?",
   "architecture": "Contrast current-state lookup with a business-key plus validity-period lookup.",
   "detail": "Inspect two customer versions and half-open validity intervals. Reject overlapping intervals for a claimed single-version match."
  },
  "prerequisites": [
   "star-grain"
  ],
  "example": {
   "provenance": "authored-synthetic",
   "input": "Customer C1 changes region on 2026-07-01; one sale is dated June and another August.",
   "steps": [
    "Create a North version valid before July.",
    "Create a South version valid from July.",
    "Match each sale to the version valid on its date."
   ],
   "output": "June maps to North and August to South.",
   "limits": [
    "This is an original teaching example.",
    "Do not infer that an owner dataset implements SCD2 from column names."
   ]
  },
  "alternatives": [
   {
    "label": "Type 1",
    "whenToConsider": "Use when current truth or correction is the intended question.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Type 2",
    "whenToConsider": "Use when the selected attributes require historical perspective.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "Why can joining facts to the current customer row change the meaning of historical results?",
   "answerHints": [
    "State the historical question.",
    "Explain validity ranges and surrogate versions.",
    "Test uniqueness at the fact timestamp."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-DIM"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "medallion-environments",
  "entryKind": "concept",
  "title": "Data refinement is not DEV, TEST and PROD",
  "domain": "data-engineering",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "A processing layer and a deployment environment are independent coordinates.",
  "claims": [
   {
    "text": "Medallion architecture separates raw, refined and consumption-ready data responsibilities.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-MEDALLION"
    ]
   }
  ],
  "levels": {
   "overview": "Follow a fictional event from received data to a useful report.",
   "architecture": "Place refinement responsibilities on one axis and environments on another.",
   "detail": "Inspect validation, rejects, schema and consumption contracts. Do not invent nine physical stores."
  },
  "prerequisites": [],
  "example": {
   "provenance": "authored-synthetic",
   "input": "One synthetic reading has a value; another is missing its required timestamp.",
   "steps": [
    "Retain the received records.",
    "Validate the timestamp requirement.",
    "Explain the accepted output and rejected record."
   ],
   "output": "An explicit accepted/rejected flow, repeated only in declared environments.",
   "limits": [
    "No workload or tenant execution is implied."
   ]
  },
  "alternatives": [
   {
    "label": "Direct pipeline",
    "whenToConsider": "Consider when fewer stages satisfy the stated contract.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Layered pipeline",
    "whenToConsider": "Consider when distinct refinement responsibilities justify extra handoffs.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "Does a bronze/silver/gold design tell you where DEV, TEST and PROD are?",
   "answerHints": [
    "Separate logical refinement from deployment.",
    "Explain materialization as an independent decision."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-MEDALLION",
   "S-STORE"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "EXISTING_NATIVE_TOPIC_REUSE",
   "canonicalTopicId": "lakehouse-medallion",
   "nativePatternId": "medallion"
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "batch-stream-cdc",
  "entryKind": "concept",
  "title": "Batch, streaming and change data capture",
  "domain": "data-engineering",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "Explain how changes arrive and how processing handles duplicates, order and restart.",
  "claims": [
   {
    "text": "Debezium captures database changes; Spark Structured Streaming expresses incremental stream processing on the Spark SQL engine.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-CDC",
     "S-STREAM"
    ]
   }
  ],
  "levels": {
   "overview": "Contrast a daily file, a continuous event feed and a database-change feed.",
   "architecture": "Show source, position/checkpoint, transport, transform and sink as separate responsibilities.",
   "detail": "Inspect duplicate event IDs, out-of-order arrival, replay and idempotent output assumptions."
  },
  "prerequisites": [],
  "example": {
   "provenance": "authored-synthetic",
   "input": "Events E1, E2 and a repeated E1 arrive in a fictional ingestion exercise.",
   "steps": [
    "Declare the event identity and deduplication window.",
    "Apply the exercise rule.",
    "Show retained and duplicate records."
   ],
   "output": "Two unique records under the stated rule.",
   "limits": [
    "No universal exactly-once claim.",
    "Source, engine, checkpoint and sink semantics require separate evidence."
   ]
  },
  "alternatives": [
   {
    "label": "Batch ingestion",
    "whenToConsider": "Consider when periodic freshness is sufficient.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Streaming or CDC",
    "whenToConsider": "Consider when the change/freshness requirements justify the operational contract.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "Does using streaming guarantee exactly-once business effects?",
   "answerHints": [
    "Separate engine guarantees from external side effects.",
    "Discuss replay, identity and the sink."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-CDC",
   "S-STREAM"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "dbt-spark-sql",
  "entryKind": "concept",
  "title": "SQL, dbt, Spark and orchestration have different roles",
  "domain": "data-engineering",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "Avoid drawing different kinds of technology as if they were interchangeable products.",
  "claims": [
   {
    "text": "dbt models transformation logic and its dependency graph; Spark provides a processing engine with SQL and DataFrame interfaces.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-DBT",
     "S-STREAM"
    ]
   }
  ],
  "levels": {
   "overview": "Explain the transformation goal before naming a tool.",
   "architecture": "Separate language, transformation project, compute engine, orchestrator and storage.",
   "detail": "Inspect a model definition, compiled artifact, job configuration, attempt and output receipt as distinct objects."
  },
  "prerequisites": [],
  "example": {
   "provenance": "authored-synthetic",
   "input": "A synthetic aggregation is expressed as a SQL model.",
   "steps": [
    "Identify the SQL logic.",
    "Identify the transformation project and dependencies.",
    "Identify the selected engine and orchestration route."
   ],
   "output": "A role-based architecture with unsupported choices left unknown.",
   "limits": [
    "No new dbt or Spark process is started.",
    "A source model is not a successful run."
   ]
  },
  "alternatives": [
   {
    "label": "Direct SQL",
    "whenToConsider": "Consider a small supported transformation with simple ownership.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Managed transformation project",
    "whenToConsider": "Consider when dependency management and tests justify the project machinery.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "Is dbt versus SQL a like-for-like comparison?",
   "answerHints": [
    "Separate language and tooling.",
    "Identify the actual execution backend.",
    "Name the orchestration boundary."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-DBT",
   "S-STREAM"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "EXISTING_NATIVE_TOPIC_REUSE",
   "canonicalTopicId": "spark-production",
   "nativeRecipeId": "jobs"
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "training-inference-rag",
  "entryKind": "concept",
  "title": "Training, fine-tuning, inference and RAG",
  "domain": "ai-systems",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "Make weight changes, retrieved context and generated output different paths.",
  "claims": [
   {
    "text": "Fine-tuning continues training a pretrained model. RAG supplies retrieved material to generation; retrieval is not the same operation as changing model weights.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-FINETUNE",
     "S-RAG"
    ]
   }
  ],
  "levels": {
   "overview": "Ask whether the need concerns fresh knowledge, behavior, or producing an answer.",
   "architecture": "Draw a training-data/weights path separately from an index/query/context/answer path.",
   "detail": "Inspect dataset versions, model identity, retrieval settings, evaluation scope and the allowed data."
  },
  "prerequisites": [],
  "example": {
   "provenance": "authored-synthetic",
   "input": "A fictional policy changes while the model version stays fixed.",
   "steps": [
    "Update the allowed retrieval source in the teaching scenario.",
    "Compare which evidence is available to the answer.",
    "Discuss separately whether a behavior change needs training."
   ],
   "output": "A comparison of approaches, not a trained model or measured answer quality.",
   "limits": [
    "These approaches can coexist.",
    "No fine-tune, paid inference or model download is launched."
   ]
  },
  "alternatives": [
   {
    "label": "Prompt and retrieval",
    "whenToConsider": "Consider when source-grounded context addresses the requirement.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Fine-tuning",
    "whenToConsider": "Consider a separately evaluated behavior/task adaptation need.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "When might you choose retrieval rather than fine-tuning, and when can both be useful?",
   "answerHints": [
    "Separate knowledge and behavior requirements.",
    "Define evaluation before making a selection."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-FINETUNE",
   "S-RAG"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "rag-pipeline",
  "entryKind": "concept",
  "title": "RAG indexing, query-time retrieval and evaluation",
  "domain": "ai-systems",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "A useful answer is not proven by drawing a retriever connected to an LLM.",
  "claims": [
   {
    "text": "RAG combines retrieval of relevant information with generation.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-RAG"
    ]
   }
  ],
  "levels": {
   "overview": "Show which permitted source supports the answer.",
   "architecture": "Keep the indexing flow and the query-time flow separate, with identity-preserving links.",
   "detail": "Inspect chunks, search results, optional reranking, supplied context, citations and independent retrieval/answer checks."
  },
  "prerequisites": [
   "training-inference-rag"
  ],
  "example": {
   "provenance": "authored-synthetic",
   "input": "Allowed policy A and denied policy B appear in a synthetic source registry.",
   "steps": [
    "Construct an allowed corpus.",
    "Retrieve from that corpus.",
    "Return a cited answer candidate or abstain."
   ],
   "output": "A traceable candidate using A only.",
   "limits": [
    "No actual model call is supplied.",
    "Retrieval success is not evidence that the answer is correct."
   ]
  },
  "alternatives": [
   {
    "label": "Lexical or direct lookup",
    "whenToConsider": "Consider for exact IDs and small structured sources.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Hybrid retrieval",
    "whenToConsider": "Consider when evaluated semantic and exact-match needs justify it.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "How would you distinguish retrieval failure from generation failure?",
   "answerHints": [
    "Inspect what was retrieved.",
    "Inspect what was actually provided.",
    "Check answer support separately."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-RAG"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "graph-memory",
  "entryKind": "concept",
  "title": "Graph retrieval, agent memory and source authority",
  "domain": "ai-systems",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "A context window, a retrieval index and durable notes are not the same memory.",
  "claims": [
   {
    "text": "Microsoft GraphRAG is a particular graph-based retrieval approach. Context engineering includes selective retrieval and persistent notes outside the active context.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-GRAPHRAG",
     "S-CONTEXT"
    ]
   }
  ],
  "levels": {
   "overview": "Explain what is stored, what is selected now, and what remains authoritative.",
   "architecture": "Separate source documents, disposable indexes, graph assertions, session context and durable notes.",
   "detail": "Follow an exact returned source and its generation binding. Do not turn a returned result into proof of comprehension."
  },
  "prerequisites": [
   "rag-pipeline"
  ],
  "example": {
   "provenance": "authored-synthetic",
   "input": "A synthetic note references source revision A; source revision B removes its basis.",
   "steps": [
    "Retain the old note as dated evidence.",
    "Flag the invalidated basis.",
    "Request a reviewed update rather than rewriting history."
   ],
   "output": "A stale-note explanation with a source link.",
   "limits": [
    "No claim that DataPass Brain uses Microsoft GraphRAG.",
    "Graph structure alone does not establish factual correctness."
   ]
  },
  "alternatives": [
   {
    "label": "Files and exact lookup",
    "whenToConsider": "Consider when selected sources are small and well keyed.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Scoped lexical/graph retrieval",
    "whenToConsider": "Consider when justified relations and measured retrieval benefit exist.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "Does adding a graph database give an agent reliable memory?",
   "answerHints": [
    "Separate persistence, retrieval, scope, provenance and evaluation.",
    "Explain why the database choice alone cannot establish correctness."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-GRAPHRAG",
   "S-CONTEXT"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "workflow-agent",
  "entryKind": "concept",
  "title": "Deterministic workflow versus model-directed agent",
  "domain": "agentic-development",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "Show who chooses the next action and who may perform it.",
  "claims": [
   {
    "text": "Anthropic distinguishes predefined workflow paths from agents that choose processes and tool use dynamically.",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-AGENT"
    ]
   }
  ],
  "levels": {
   "overview": "Contrast a known checklist with an open-ended investigation.",
   "architecture": "Compare chain, routing, parallel work and an evaluator loop with explicit stop conditions.",
   "detail": "Inspect permitted tools, step attempts, review gates, handoffs and observed results."
  },
  "prerequisites": [],
  "example": {
   "provenance": "authored-synthetic",
   "input": "A synthetic request needs a summary, a check and an owner decision.",
   "steps": [
    "Produce a candidate.",
    "Check it against fixed criteria.",
    "Ask for the decision at the existing gate."
   ],
   "output": "A bounded workflow; autonomous delegation remains a separate option.",
   "limits": [
    "No agents are launched by a lesson.",
    "Provider roles are illustrative, not live session ownership."
   ]
  },
  "alternatives": [
   {
    "label": "Single call or fixed workflow",
    "whenToConsider": "Consider for bounded predictable tasks.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Model-directed loop",
    "whenToConsider": "Consider when evaluated flexibility justifies additional uncertainty and cost.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "What makes a workflow agentic, and when would you avoid adding autonomy?",
   "answerHints": [
    "Identify who selects actions.",
    "Give termination and escalation rules.",
    "Measure usefulness rather than number of agents."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-AGENT"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "worktrees-ci",
  "entryKind": "concept",
  "title": "Agent worktrees, changes, review and CI",
  "domain": "agentic-development",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "A clean branch and a successful check do not by themselves mean a release.",
  "claims": [
   {
    "text": "Git worktrees provide distinct working directories associated with one repository. DiagramCloud CI can package evidence even when earlier checks fail because selected steps use always().",
    "basis": "primary-source-summary",
    "sourceRefs": [
     "S-GIT",
     "DC-CI"
    ]
   }
  ],
  "levels": {
   "overview": "Follow one task from isolated work to reviewed integration.",
   "architecture": "Separate repository identity, local worktree, branch/ref, source commit, CI run and artifact.",
   "detail": "Inspect exact SHA, dirty changes, check outcome, artifact digest and integration ownership."
  },
  "prerequisites": [
   "workflow-agent"
  ],
  "example": {
   "provenance": "authored-synthetic",
   "input": "Two synthetic agents touch overlapping paths in separate worktrees.",
   "steps": [
    "Record each write scope.",
    "Produce separate candidate revisions.",
    "Use one integrator and inspect the actual merged source checks."
   ],
   "output": "A reviewable integration path, not an automatic merge.",
   "limits": [
    "A worktree is not a security sandbox.",
    "Commit authorship is not automatically agent authorship."
   ]
  },
  "alternatives": [
   {
    "label": "One sequential writer",
    "whenToConsider": "Consider when changes share sensitive paths.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Independent worktrees",
    "whenToConsider": "Consider for bounded independent candidate work with one integration boundary.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "How would you prove which code a CI result qualifies?",
   "answerHints": [
    "Bind the result to its exact source revision.",
    "Separate working state and commit.",
    "Check the merged source separately where needed."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-GIT",
   "DC-CI"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 },
 {
  "proposalFormat": "diagramcloud.learning-proposal",
  "proposalVersion": 1,
  "id": "anthropic-scion",
  "entryKind": "case-study",
  "title": "Case study: Anthropic Scion, not a migration recommendation",
  "domain": "case-studies",
  "contentStatus": "AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN",
  "contentRevision": "2026-10-16.1",
  "applicability": "UNKNOWN_NOT_ASSESSED",
  "summary": "Study a workload-specific design choice without copying its scale assumptions.",
  "claims": [
   {
    "text": "Anthropic reported moving its monorepo to the in-house Scion system and explicitly said it is not a general-purpose Git replacement.",
    "basis": "provider-reported",
    "sourceRefs": [
     "S-SCION"
    ]
   }
  ],
  "levels": {
   "overview": "State the reported problem and the bounds of the comparison.",
   "architecture": "Compare the source-control client/server split and the resulting review/CI obligations.",
   "detail": "Ask which original constraints apply to our own repositories before suggesting any change."
  },
  "prerequisites": [
   "worktrees-ci"
  ],
  "example": {
   "provenance": "authored-synthetic",
   "input": "An authored comparison checklist for our present Git workflow.",
   "steps": [
    "Identify the observed local bottleneck.",
    "Compare a small change to existing Git tooling.",
    "Retain the status quo unless evidence justifies more."
   ],
   "output": "An explicit no-migration default for this campaign.",
   "limits": [
    "No Scion software, benchmark, connector or repository migration is supplied.",
    "Do not confuse it with GoogleCloudPlatform Scion, SCION networking, or Scion Asset Management."
   ]
  },
  "alternatives": [
   {
    "label": "Existing Git plus focused improvements",
    "whenToConsider": "The default here unless a measured bottleneck warrants change.",
    "status": "CANDIDATE_NOT_SELECTED"
   },
   {
    "label": "Study specialized source-control designs",
    "whenToConsider": "Research only; no assumption that an internal implementation is available or suitable.",
    "status": "CANDIDATE_NOT_SELECTED"
   }
  ],
  "interview": {
   "question": "Which assumptions would have to hold before you copied this case study?",
   "answerHints": [
    "Identify scale and workflow differences.",
    "Separate reported results from your own measurements.",
    "Account for ecosystem migration cost."
   ],
   "assessment": "SELF_EXPLANATION_NOT_CERTIFICATION"
  },
  "sourceRefs": [
   "S-SCION"
  ],
  "instanceMappings": [],
  "instanceMappingPolicy": "An explicit source-pinned link is required; names, icons and tags are not evidence.",
  "legacyMapping": {
   "status": "RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE",
   "canonicalTopicId": null
  },
  "displayDefaults": {
   "overviewFirst": true,
   "showDetails": false,
   "requiresGit": false,
   "requiresAI": false,
   "requiresCloud": false
  }
 }
];
