import {validatePracticeBank,type InterviewBank} from './interviewPractice';
/** Original teaching content. Sources support concepts, not fictional company facts. */
export const interviewBank:InterviewBank=validatePracticeBank({
  "id": "data-platform-interviews",
  "revision": "2026-10-20.2",
  "authorship": "original-teaching",
  "sources": [
    {
      "id": "python",
      "title": "Python data structures",
      "url": "https://docs.python.org/3/tutorial/datastructures.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "Python 3 tutorial; examples use portable Python 3 syntax."
    },
    {
      "id": "pandas",
      "title": "pandas merge and join",
      "url": "https://pandas.pydata.org/docs/user_guide/merging.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "Version-specific documentation; null joins differ from SQL."
    },
    {
      "id": "statistics",
      "title": "Python statistics",
      "url": "https://docs.python.org/3/library/statistics.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "Standard-library statistics, not a proof of a population model."
    },
    {
      "id": "nist",
      "title": "NIST exploratory statistics",
      "url": "https://www.itl.nist.gov/div898/handbook/eda/section3/eda35b.htm",
      "retrievedOn": "2026-10-20",
      "versionScope": "Distribution shape; illustrative samples are not calibrated estimates."
    },
    {
      "id": "sql-joins",
      "title": "PostgreSQL table expressions",
      "url": "https://www.postgresql.org/docs/current/queries-table-expressions.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "PostgreSQL 18 documentation; dialect assumptions stated."
    },
    {
      "id": "sql-window",
      "title": "PostgreSQL window functions",
      "url": "https://www.postgresql.org/docs/current/tutorial-window.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "PostgreSQL 18; examples need deterministic ordering."
    },
    {
      "id": "pg-mvcc",
      "title": "PostgreSQL concurrency",
      "url": "https://www.postgresql.org/docs/current/mvcc-intro.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "PostgreSQL 18; isolation and locking are distinct."
    },
    {
      "id": "pg-explain",
      "title": "PostgreSQL EXPLAIN",
      "url": "https://www.postgresql.org/docs/current/using-explain.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "ANALYZE executes; do not run untrusted queries."
    },
    {
      "id": "parquet",
      "title": "Apache Parquet overview",
      "url": "https://parquet.apache.org/docs/overview/",
      "retrievedOn": "2026-10-20",
      "versionScope": "File format, not by itself a table transaction protocol."
    },
    {
      "id": "delta",
      "title": "Delta Lake documentation",
      "url": "https://docs.delta.io/",
      "retrievedOn": "2026-10-20",
      "versionScope": "Protocol/features must match each reader and writer."
    },
    {
      "id": "iceberg",
      "title": "Apache Iceberg evolution",
      "url": "https://iceberg.apache.org/docs/latest/evolution/",
      "retrievedOn": "2026-10-20",
      "versionScope": "Schema/partition evolution depends on engine support."
    },
    {
      "id": "spark-cluster",
      "title": "Apache Spark cluster overview",
      "url": "https://spark.apache.org/docs/latest/cluster-overview.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "Version-specific documentation; managed Fabric/Databricks runtimes may differ."
    },
    {
      "id": "spark-df",
      "title": "PySpark DataFrame quickstart",
      "url": "https://spark.apache.org/docs/latest/api/python/getting_started/quickstart_df.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "Version-specific documentation; snippets are displayed, not executed here."
    },
    {
      "id": "spark-tune",
      "title": "Spark SQL tuning",
      "url": "https://spark.apache.org/docs/latest/sql-performance-tuning.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "Runtime settings and join strategies are environment-dependent."
    },
    {
      "id": "spark-stream",
      "title": "Structured Streaming guide",
      "url": "https://spark.apache.org/docs/latest/streaming/index.html",
      "retrievedOn": "2026-10-20",
      "versionScope": "End-to-end guarantees depend on source, sink and application."
    },
    {
      "id": "fabric-store",
      "title": "Fabric Warehouse/Lakehouse decision guide",
      "url": "https://learn.microsoft.com/en-us/fabric/fundamentals/decision-guide-lakehouse-warehouse",
      "retrievedOn": "2026-10-20",
      "versionScope": "Vendor guidance checked 2026-10-20; not measured client suitability."
    },
    {
      "id": "fabric-semantic",
      "title": "How Direct Lake works",
      "url": "https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-how-it-works",
      "retrievedOn": "2026-10-20",
      "versionScope": "OneLake versus SQL Direct Lake differ; never assume the same fallback/security."
    },
    {
      "id": "db-jobs",
      "title": "Databricks bundles and jobs",
      "url": "https://docs.databricks.com/aws/en/dev-tools/bundles/",
      "retrievedOn": "2026-10-20",
      "versionScope": "Bundles deployment concepts; test the actual target runtime and CLI version."
    },
    {
      "id": "db-governance",
      "title": "Databricks Unity Catalog",
      "url": "https://docs.databricks.com/aws/en/data-governance/unity-catalog/",
      "retrievedOn": "2026-10-20",
      "versionScope": "AWS documentation; permissions and features differ by cloud/runtime."
    },
    {
      "id": "iac-plan",
      "title": "Terraform plan",
      "url": "https://developer.hashicorp.com/terraform/cli/commands/plan",
      "retrievedOn": "2026-10-20",
      "versionScope": "Planning is not approval; untrusted configuration is not safe to execute."
    },
    {
      "id": "iac-secrets",
      "title": "Terraform sensitive data",
      "url": "https://developer.hashicorp.com/terraform/language/manage-sensitive-data",
      "retrievedOn": "2026-10-20",
      "versionScope": "Sensitive redaction is not removal from plan/state."
    },
    {
      "id": "docker",
      "title": "Docker architecture",
      "url": "https://docs.docker.com/get-started/docker-overview/",
      "retrievedOn": "2026-10-20",
      "versionScope": "Container, image, host and virtual machine are separate concepts."
    },
    {
      "id": "git",
      "title": "Git branching",
      "url": "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell",
      "retrievedOn": "2026-10-20",
      "versionScope": "Ancestry is not feature or runtime causality."
    },
    {
      "id": "ci-security",
      "title": "GitHub Actions secure use",
      "url": "https://docs.github.com/en/actions/reference/security/secure-use",
      "retrievedOn": "2026-10-20",
      "versionScope": "Self-hosted runners and untrusted inputs require explicit isolation."
    },
    {
      "id": "mcp",
      "title": "MCP architecture",
      "url": "https://modelcontextprotocol.io/docs/learn/architecture",
      "retrievedOn": "2026-10-20",
      "versionScope": "MCP architectural concepts. Match actual protocol version of the host; no installed host compatibility checked."
    },
    {
      "id": "skills",
      "title": "Agent Skills overview",
      "url": "https://agentskills.io/home",
      "retrievedOn": "2026-10-20",
      "versionScope": "Portable instruction packages; no tools or permissions granted by a file."
    },
    {
      "id": "agents",
      "title": "Building effective agents",
      "url": "https://www.anthropic.com/engineering/building-effective-agents",
      "retrievedOn": "2026-10-20",
      "versionScope": "Author-reported design patterns, not a mandatory orchestrator design."
    },
    {
      "id": "rag",
      "title": "Retrieval augmented generation",
      "url": "https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview",
      "retrievedOn": "2026-10-20",
      "versionScope": "Retrieval augments supplied context; citations do not guarantee correctness."
    },
    {
      "id": "http",
      "title": "HTTP method and retry semantics",
      "url": "https://datatracker.ietf.org/doc/html/rfc9110#section-9.2.2",
      "versionScope": "RFC9110; actual API idempotency still requires its contract.",
      "retrievedOn": "2026-10-20"
    },
    {
      "id": "metadata-copy",
      "title": "Metadata-driven copy pipelines",
      "url": "https://learn.microsoft.com/en-us/azure/data-factory/copy-data-tool-metadata-driven",
      "versionScope": "ADF/Synapse reference pattern; not universal Fabric parity.",
      "retrievedOn": "2026-10-20"
    },
    {
      "id": "fabric-cost",
      "title": "Fabric Apps pricing and usage",
      "url": "https://learn.microsoft.com/en-us/fabric/apps/pricing",
      "versionScope": "Dated documentation; no actual bill or workload measurement.",
      "retrievedOn": "2026-10-20"
    },
    {
      "id": "dc-authoring",
      "title": "DiagramCloud authoring rules",
      "url": "https://github.com/julian-passebecq/diagramcloud/blob/27916edd3463124a9ab9096d00193ba2e5005ca3/AGENTS.md",
      "versionScope": "Pinned source instructions; not evidence about employers.",
      "retrievedOn": "2026-10-20"
    },
    {
      "id": "python-defaults",
      "title": "Python function definitions",
      "url": "https://docs.python.org/3/tutorial/controlflow.html#default-argument-values",
      "versionScope": "Python 3 mutable default semantics.",
      "retrievedOn": "2026-10-20"
    }
  ],
  "cases": [
    {
      "id": "cedar",
      "name": "Cedar Commerce",
      "classification": "fictional",
      "business": "A fictional retailer needs reliable order, payment and return reporting.",
      "decision": "How should operational events become trustworthy customer and margin metrics?",
      "constraints": [
        "Late returns and duplicate deliveries exist in the scenario.",
        "Finance needs a traceable definition of net revenue."
      ],
      "unknowns": [
        "Actual volumes, budget, privacy jurisdiction and existing stack must be elicited."
      ],
      "interviewFocus": [
        "Grain and historical joins",
        "API idempotency",
        "Analytical versus operational state"
      ]
    },
    {
      "id": "tidal",
      "name": "Tidal Energy Lab",
      "classification": "fictional",
      "business": "A fictional laboratory compares synthetic renewable-energy experiments.",
      "decision": "How should asset meaning, measurements and simulated outcomes stay distinguishable?",
      "constraints": [
        "Sensor gaps are not zero.",
        "Model versions and units must be preserved.",
        "No calibrated physics or real FOIL geometry is supplied."
      ],
      "unknowns": [
        "No real client parameters or measured business results are provided."
      ],
      "interviewFocus": [
        "Data quality and uncertainty",
        "Batch/stream/replay",
        "Scientific provenance"
      ]
    },
    {
      "id": "harbor",
      "name": "Harbor Data Consulting",
      "classification": "fictional",
      "business": "A fictional consultancy helps migrate legacy analytics while keeping reports usable.",
      "decision": "Which parts should move, coexist or be retained?",
      "constraints": [
        "Metric and security parity matter more than matching vendor logos.",
        "Rollback must address data as well as code."
      ],
      "unknowns": [
        "Licenses, identity, runtime versions, network access and service limits need discovery."
      ],
      "interviewFocus": [
        "SSIS/SSAS and platform migration",
        "Semantic models",
        "Trade-offs and handover"
      ]
    },
    {
      "id": "beacon",
      "name": "Beacon Operations",
      "classification": "fictional",
      "business": "A fictional team operates an API and uses coding assistants to maintain it.",
      "decision": "How can humans review, qualify and safely ship a change?",
      "constraints": [
        "A generated plan is not approval.",
        "A green unit test is not an installed release.",
        "Agents have only actual host-granted capabilities."
      ],
      "unknowns": [
        "No live provider, deployed estate, real employee or agent telemetry is claimed."
      ],
      "interviewFocus": [
        "Full-stack request path",
        "IaC and CI isolation",
        "RAG, permissions and review"
      ]
    }
  ],
  "rounds": [
    {
      "id": "sql",
      "title": "SQL: grain, joins and windows",
      "domain": "SQL",
      "caseId": "cedar",
      "overview": "Start with what one row means. A correct query must preserve the required population and avoid accidental fanout.",
      "questions": [
        {
          "prompt": "What changes when you use GROUP BY instead of a window function?",
          "hint": "Think about the number and identity of output rows.",
          "answer": "GROUP BY produces one row per grouping key. A window calculation annotates rows in a defined partition; choose its frame and ordering explicitly.",
          "checks": [
            "State the output grain.",
            "Explain the partition and ordering."
          ],
          "pitfall": "A window does not automatically collapse duplicates.",
          "sourceIds": [
            "sql-window"
          ],
          "id": "sql-1",
          "kind": "concept"
        },
        {
          "prompt": "Why can a filter on the right table in WHERE change a LEFT JOIN?",
          "hint": "Evaluate the unmatched row after it is null-extended.",
          "answer": "A predicate such as r.active = true in WHERE removes null-extended rows. Put the predicate in ON when the intention is to keep all left rows with only qualifying right matches.",
          "checks": [
            "Identify null-extended rows.",
            "Explain the intended population."
          ],
          "pitfall": "Moving predicates changes semantics; do not apply the rewrite without checking intent.",
          "sourceIds": [
            "sql-joins"
          ],
          "id": "sql-2",
          "kind": "syntax"
        },
        {
          "prompt": "Write a query returning the latest event per order. Timestamps can be null; prefer known timestamps and break ties by a unique non-null event_id.",
          "hint": "Rank within each order, then retain one row.",
          "answer": "Use ROW_NUMBER() partitioned by order_id and ordered by event_ts DESC NULLS LAST, event_id DESC, then filter rn = 1. Require a unique non-null tie-breaker; this chooses one record but does not resolve conflicting business versions.",
          "checks": [
            "Use both ordering keys.",
            "Avoid MAX(timestamp) joined back without tie handling."
          ],
          "pitfall": "DISTINCT is not a latest-record rule.",
          "sourceIds": [
            "sql-window"
          ],
          "code": {
            "language": "sql",
            "text": "WITH ranked AS (\n  SELECT *, ROW_NUMBER() OVER (\n    PARTITION BY order_id ORDER BY event_ts DESC NULLS LAST, event_id DESC\n  ) AS rn FROM events\n)\nSELECT order_id, event_id, event_ts FROM ranked WHERE rn = 1;"
          },
          "id": "sql-3",
          "kind": "exercise"
        },
        {
          "prompt": "A join preserves the row count but revenue increases. How would you investigate?",
          "hint": "Loss and duplication can cancel in the count.",
          "answer": "Compare input/output identities and match multiplicity, not only counts. Check missing keys, duplicate dimension keys, effective-date overlaps and amount totals. Resolve the business meaning before deduplicating.",
          "checks": [
            "Check both lost and repeated rows.",
            "Ask current versus historical dimension semantics."
          ],
          "pitfall": "A count match is not evidence of metric parity.",
          "sourceIds": [
            "sql-joins"
          ],
          "id": "sql-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Order line",
          "Join predicate",
          "Matched / unmatched rows",
          "Revenue definition"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [],
      "level": "foundation"
    },
    {
      "id": "python",
      "title": "Python and pandas: dependable transformations",
      "domain": "Python",
      "caseId": "cedar",
      "overview": "Distinguish collection semantics, missing values and bounded in-memory work before moving to a distributed engine.",
      "questions": [
        {
          "prompt": "When would you use a dictionary rather than a list of records?",
          "hint": "Consider key uniqueness and lookup intent.",
          "answer": "A dictionary provides keyed access and overwrites on repeated assignment to the same key. A list preserves separate occurrences. Choose deliberately whether duplicate business keys should be retained, grouped or refused.",
          "checks": [
            "Define key policy.",
            "Discuss memory and ordering needs."
          ],
          "pitfall": "Overwriting duplicate keys may silently lose events.",
          "sourceIds": [
            "python"
          ],
          "id": "python-1",
          "kind": "concept"
        },
        {
          "prompt": "What is wrong with this default argument: def collect(x, rows=[])?",
          "hint": "The default object is created once.",
          "answer": "The same mutable list is reused across calls. Use None as the default and allocate a new list inside the function when no list was passed.",
          "checks": [
            "Identify shared mutable state.",
            "Keep an explicitly supplied list meaningful."
          ],
          "pitfall": "Replacing every false-like input is not the same as checking None.",
          "sourceIds": [
            "python-defaults"
          ],
          "id": "python-2",
          "kind": "syntax"
        },
        {
          "prompt": "Group amounts by customer; preserve zero and skip only None.",
          "hint": "Do not use `if amount` for a valid zero.",
          "answer": "Use an explicit None check, validate numeric input for a real contract, and accumulate per key. Decide separately what to do with unknown customers and invalid values.",
          "checks": [
            "Zero remains valid.",
            "None policy is explicit."
          ],
          "pitfall": "Do not silently parse malformed money as zero.",
          "sourceIds": [
            "python"
          ],
          "code": {
            "language": "python",
            "text": "def total_by_customer(rows):\n    totals = {}\n    for row in rows:\n        amount = row['amount']\n        if amount is None:\n            continue\n        key = row['customer_id']\n        totals[key] = totals.get(key, 0) + amount\n    return totals"
          },
          "id": "python-3",
          "kind": "exercise"
        },
        {
          "prompt": "A pandas merge unexpectedly grows the table. What checks would you add?",
          "hint": "Specify the expected key relationship.",
          "answer": "Use merge validation such as many_to_one when that is the contract, inspect key duplicates and unmatched rows, and explicitly handle null keys: pandas null matches differ from typical SQL equality joins.",
          "checks": [
            "State expected cardinality.",
            "Check null-key behavior and memory limits."
          ],
          "pitfall": "A SQL-looking API does not imply identical null semantics.",
          "sourceIds": [
            "pandas"
          ],
          "id": "python-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Input records",
          "Typed keys / missing data",
          "Transformation",
          "Contract checks"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [],
      "level": "foundation"
    },
    {
      "id": "statistics",
      "title": "Statistics and scientific data quality",
      "domain": "Statistics",
      "caseId": "tidal",
      "overview": "An answer needs a population, units and uncertainty, not just a precise-looking number.",
      "questions": [
        {
          "prompt": "Why can the mean hide an operational problem that the median or tail reveals?",
          "hint": "A few long delays can dominate a distribution.",
          "answer": "The mean summarizes the arithmetic average; the median locates the middle. Inspect tail latency and distribution shape when rare slow operations matter. State sample size and the population represented.",
          "checks": [
            "Identify decision-relevant statistic.",
            "Keep sampling scope visible."
          ],
          "pitfall": "One statistic is not the complete distribution.",
          "sourceIds": [
            "statistics",
            "nist"
          ],
          "id": "statistics-1",
          "kind": "concept"
        },
        {
          "prompt": "Should a missing sensor value be replaced with zero before averaging?",
          "hint": "Ask whether zero is a physical observation.",
          "answer": "No automatic replacement is justified. Zero may be a legitimate reading while missing means unavailable. Report coverage and a justified imputation rule separately.",
          "checks": [
            "Separate observed zero from absence.",
            "Preserve quality flags."
          ],
          "pitfall": "Imputation changes the analytical question.",
          "sourceIds": [
            "statistics"
          ],
          "id": "statistics-2",
          "kind": "syntax"
        },
        {
          "prompt": "For readings [0, 4, None, 8], calculate the mean of available readings and coverage.",
          "hint": "Use separate denominators.",
          "answer": "Available mean = 4; coverage = 3/4 = 75%. Neither value proves that missingness is random or that the mean represents the whole interval.",
          "checks": [
            "Mean denominator is 3.",
            "Coverage denominator is 4."
          ],
          "pitfall": "A 75% coverage statistic does not validate the missing interval.",
          "sourceIds": [
            "statistics"
          ],
          "code": {
            "language": "python",
            "text": "values = [0, 4, None, 8]\nobserved = [x for x in values if x is not None]\nmean = sum(observed) / len(observed) if observed else None\ncoverage = len(observed) / len(values) if values else None"
          },
          "id": "statistics-3",
          "kind": "exercise"
        },
        {
          "prompt": "An experiment reports a 6% improvement from one synthetic run. What can you claim?",
          "hint": "Separate calculation, experiment design and real-world evidence.",
          "answer": "Only the stated synthetic comparison under its inputs. Request paired conditions, versioned models, units, repeated trials and uncertainty before broader inference. No production or scientific validation follows from a diagram.",
          "checks": [
            "Name population and provenance.",
            "Ask what was held constant."
          ],
          "pitfall": "Simulation output is not calibrated machine performance.",
          "sourceIds": [
            "nist",
            "statistics"
          ],
          "id": "statistics-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Population / sample",
          "Quality flags",
          "Estimator",
          "Decision with limits"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [],
      "level": "foundation"
    },
    {
      "id": "warehouse",
      "title": "Warehousing and semantic models",
      "domain": "Warehousing",
      "caseId": "harbor",
      "overview": "A lake, warehouse, dimensional model and semantic layer answer different responsibilities.",
      "questions": [
        {
          "prompt": "How do a fact table and dimension table cooperate?",
          "hint": "Describe the event grain and descriptive context.",
          "answer": "A fact represents measurements or events at a declared grain. Dimensions supply descriptive context, possibly versioned. Keys and relationships determine which context applies.",
          "checks": [
            "Give one concrete grain.",
            "Separate event time from changing attributes."
          ],
          "pitfall": "A table named FactSales does not establish its grain.",
          "sourceIds": [
            "sql-joins",
            "fabric-store"
          ],
          "id": "warehouse-1",
          "kind": "concept"
        },
        {
          "prompt": "Why can joining two facts directly by customer produce incorrect totals?",
          "hint": "A customer can have several rows on both sides.",
          "answer": "The join can form all combinations within each customer. Aggregate each fact to a compatible grain or use a deliberately designed bridge; validate the metric's additive behavior.",
          "checks": [
            "Show multiplicity.",
            "Define compatible comparison grain."
          ],
          "pitfall": "Do not sum every numeric column after a join.",
          "sourceIds": [
            "sql-joins"
          ],
          "id": "warehouse-2",
          "kind": "syntax"
        },
        {
          "prompt": "Design the minimum model for order lines and returns.",
          "hint": "A return may be partial and occur later.",
          "answer": "Keep order-line facts and return events separately identified, with dates, quantities and currencies. Define net revenue using the agreed return policy; do not overwrite original sales history.",
          "checks": [
            "Preserve multiple returns.",
            "Specify currency and date roles."
          ],
          "pitfall": "One mutable order total loses the event history needed for audit.",
          "sourceIds": [
            "fabric-store",
            "sql-joins"
          ],
          "id": "warehouse-3",
          "kind": "exercise"
        },
        {
          "prompt": "A team wants to replace its BI frontend. Which model responsibilities should be preserved?",
          "hint": "A new screen does not redefine a KPI.",
          "answer": "Retain governed measure definitions, relationships, security and tested filters where appropriate. Evaluate the new interface independently from data storage and semantic-model migration.",
          "checks": [
            "Identify semantic parity tests.",
            "Separate read-only analytics from writeback."
          ],
          "pitfall": "A frontend migration is not automatically a warehouse migration.",
          "sourceIds": [
            "fabric-semantic",
            "fabric-store"
          ],
          "id": "warehouse-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Business event",
          "Dimensional model",
          "Semantic measures / policy",
          "Reports and apps"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "sql"
      ],
      "level": "foundation"
    },
    {
      "id": "formats",
      "title": "Files, table formats and exchange",
      "domain": "Data formats",
      "caseId": "harbor",
      "overview": "A byte format and a transactional table protocol are not interchangeable.",
      "questions": [
        {
          "prompt": "What does Parquet provide, and what does a Delta table add?",
          "hint": "Separate a columnar file from a managed table state.",
          "answer": "Parquet structures columnar data files. Delta adds a transaction log and table semantics over its data files. Reader/writer compatibility and retention policies still matter.",
          "checks": [
            "Distinguish file and table.",
            "Mention compatible table readers."
          ],
          "pitfall": "A directory of Parquet files is not automatically a valid Delta table.",
          "sourceIds": [
            "parquet",
            "delta"
          ],
          "id": "formats-1",
          "kind": "concept"
        },
        {
          "prompt": "Is copying only the data files of a Delta table sufficient for a faithful table copy?",
          "hint": "What identifies the valid table snapshot?",
          "answer": "Not generally. The log and data referenced by the selected snapshot matter. Use a supported consistent copy/export approach and validate protocol features and completeness.",
          "checks": [
            "Bind a snapshot.",
            "Check references and permissions."
          ],
          "pitfall": "Copying visible files while writers run may not be a consistent cut.",
          "sourceIds": [
            "delta"
          ],
          "id": "formats-2",
          "kind": "syntax"
        },
        {
          "prompt": "Design a metadata manifest for a transferable dataset.",
          "hint": "Keep identity, schema and evidence apart from storage credentials.",
          "answer": "Include dataset ID, snapshot/version, file list with size/hash, schema, grain, units, partitioning, provenance and validation results. Keep secrets outside the manifest.",
          "checks": [
            "Version schema and snapshot.",
            "Verify expected files and types."
          ],
          "pitfall": "A manifest hash establishes byte identity, not business correctness.",
          "sourceIds": [
            "parquet",
            "iceberg"
          ],
          "id": "formats-3",
          "kind": "exercise"
        },
        {
          "prompt": "Should a migration choose Delta or Iceberg solely because of a vendor logo?",
          "hint": "Start from engines and needed features.",
          "answer": "Compare actual reader/writer support, mutation and schema-evolution needs, governance, maintenance and interoperability. Test selected operations on pinned engines rather than assume universal format parity.",
          "checks": [
            "Identify required operations.",
            "Test upgrades and rollback limits."
          ],
          "pitfall": "Shared Parquet storage does not imply protocol interchangeability.",
          "sourceIds": [
            "delta",
            "iceberg"
          ],
          "id": "formats-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Files",
          "Table metadata / snapshot",
          "Compatible engine",
          "Consumer contract"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "warehouse"
      ],
      "level": "foundation"
    },
    {
      "id": "ingestion",
      "title": "APIs, ingestion and checkpoints",
      "domain": "Ingestion",
      "caseId": "cedar",
      "overview": "Reliable ingestion preserves identity and restart semantics across partial failures.",
      "questions": [
        {
          "prompt": "How do a full reload, incremental load and CDC differ?",
          "hint": "Which changes can the source expose?",
          "answer": "A reload rereads a population. An incremental load uses a change boundary. CDC exposes change events including deletes when supported. Each requires explicit consistency and replay rules.",
          "checks": [
            "Explain delete handling.",
            "Define a checkpoint."
          ],
          "pitfall": "A last-updated filter is not automatically a complete change log.",
          "sourceIds": [
            "metadata-copy",
            "spark-stream"
          ],
          "id": "ingestion-1",
          "kind": "concept"
        },
        {
          "prompt": "Why is updating a watermark before a successful write dangerous?",
          "hint": "Simulate a crash after the update.",
          "answer": "A retry may skip data that was never committed. Bind checkpoint advancement to successful durable output and design retry/idempotency for the sink.",
          "checks": [
            "Walk through the crash window.",
            "Avoid claiming universal exactly-once."
          ],
          "pitfall": "Retries alone do not prevent loss or duplication.",
          "sourceIds": [
            "spark-stream"
          ],
          "id": "ingestion-2",
          "kind": "syntax"
        },
        {
          "prompt": "Draft metadata for two source tables using the same pipeline.",
          "hint": "Parameters must not become executable untrusted SQL.",
          "answer": "Use allowlisted source and target identifiers, key columns, load mode, watermark policy, schema expectations and owner. Validate identifiers and keep secrets as external references.",
          "checks": [
            "Reject unsupported identifiers.",
            "Keep control metadata separate from business data."
          ],
          "pitfall": "A metadata-driven pipeline is not permission to evaluate arbitrary code.",
          "sourceIds": [
            "metadata-copy",
            "ci-security"
          ],
          "id": "ingestion-3",
          "kind": "exercise"
        },
        {
          "prompt": "An API times out after a write. Should you repeat it?",
          "hint": "The server may have committed before the response was lost.",
          "answer": "Determine whether the operation supports an idempotency key or status lookup. Reconcile the original operation before retrying a non-idempotent mutation. Bound retries and distinguish unknown outcome from failed write.",
          "checks": [
            "Explain ambiguous success.",
            "Preserve original operation identity."
          ],
          "pitfall": "A timeout does not prove no side effect occurred.",
          "sourceIds": [
            "http"
          ],
          "id": "ingestion-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Source changes",
          "Validated extraction",
          "Durable sink",
          "Checkpoint / replay"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [],
      "level": "foundation"
    },
    {
      "id": "spark",
      "title": "Spark architecture and execution",
      "domain": "Spark",
      "caseId": "tidal",
      "overview": "Driver, executor, task, partition and storage are different levels of the system.",
      "questions": [
        {
          "prompt": "What responsibilities belong to the Spark driver and executors?",
          "hint": "Where is planning versus distributed task work?",
          "answer": "The driver coordinates the application and schedules tasks. Executors run tasks and hold application data/cache. A cluster manager allocates resources; it is not the driver's query planner.",
          "checks": [
            "Separate application from cluster.",
            "Explain task versus executor."
          ],
          "pitfall": "More executors do not repair driver-side collection overload.",
          "sourceIds": [
            "spark-cluster"
          ],
          "id": "spark-1",
          "kind": "concept"
        },
        {
          "prompt": "Why can `collect()` fail even after workers finish successfully?",
          "hint": "Where does the final result go?",
          "answer": "It returns all rows to the driver process. A result larger than driver capacity can fail there. Use bounded inspection or distributed writes appropriate to the goal.",
          "checks": [
            "Name the driver bottleneck.",
            "Suggest bounded alternatives."
          ],
          "pitfall": "Distributed input does not imply distributed final output.",
          "sourceIds": [
            "spark-df"
          ],
          "id": "spark-2",
          "kind": "syntax"
        },
        {
          "prompt": "Explain why groupBy(key).count() can require a shuffle.",
          "hint": "Rows for a key may begin on several partitions.",
          "answer": "The engine must bring relevant rows together across partition boundaries, with possible partial aggregation first. Inspect the actual plan rather than infer stages solely from source-line count.",
          "checks": [
            "Describe data movement.",
            "Distinguish code expression and physical plan."
          ],
          "pitfall": "Not every transformation starts a separate job.",
          "sourceIds": [
            "spark-cluster",
            "spark-tune"
          ],
          "id": "spark-3",
          "kind": "exercise"
        },
        {
          "prompt": "One task runs much longer than the others. What evidence would you inspect?",
          "hint": "Compare partition volume, spills and key distribution.",
          "answer": "Inspect task durations, records/bytes, skewed keys, shuffle, spills and executor failures. Select repartitioning, join strategies or skew handling based on evidence and test correctness.",
          "checks": [
            "Separate skew from general capacity shortage.",
            "Use runtime evidence."
          ],
          "pitfall": "Blindly increasing the cluster can preserve the same skew.",
          "sourceIds": [
            "spark-tune"
          ],
          "id": "spark-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Driver / plan",
          "Stages and shuffle",
          "Tasks / partitions",
          "Executors"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "python"
      ],
      "level": "foundation"
    },
    {
      "id": "pyspark",
      "title": "PySpark and Spark SQL",
      "domain": "PySpark",
      "caseId": "cedar",
      "overview": "DataFrame operations describe a query; favor transparent expressions and explicit data contracts.",
      "questions": [
        {
          "prompt": "Why can Spark SQL and DataFrame code produce similar execution plans?",
          "hint": "They use structured data and a shared optimization path.",
          "answer": "Both describe relational operations processed by Spark SQL. Compare the optimized and executed plans for the actual expressions; Python syntax alone does not imply row-by-row Python execution.",
          "checks": [
            "Separate built-in expressions and Python UDFs.",
            "Inspect actual plans."
          ],
          "pitfall": "Equivalent-looking code is not proof of identical runtime cost.",
          "sourceIds": [
            "spark-df",
            "spark-tune"
          ],
          "id": "pyspark-1",
          "kind": "concept"
        },
        {
          "prompt": "How do you filter a nullable status column without pretending null is false?",
          "hint": "Use column expressions and a declared null policy.",
          "answer": "Use isNull/isNotNull and boolean Column expressions with parentheses. Decide whether unknown status belongs in the result; do not use Python `and` to combine Spark Columns.",
          "checks": [
            "Use & or | for column predicates.",
            "State null handling."
          ],
          "pitfall": "Unknown business status is not automatically rejected or accepted.",
          "sourceIds": [
            "spark-df"
          ],
          "id": "pyspark-2",
          "kind": "syntax"
        },
        {
          "prompt": "Write PySpark code for the latest event per order using a deterministic tie-breaker.",
          "hint": "Use Window.partitionBy and row_number.",
          "answer": "Partition by order_id; order by event_ts descending with null placement and event_id descending. Keep row_number == 1; validate uniqueness/conflicting versions separately.",
          "checks": [
            "Declare tie-breaker.",
            "Do not use unordered dropDuplicates as latest."
          ],
          "pitfall": "Sorting before dropDuplicates does not define a portable survivor policy.",
          "sourceIds": [
            "spark-df",
            "sql-window"
          ],
          "code": {
            "language": "python",
            "text": "from pyspark.sql import Window, functions as F\nw = Window.partitionBy('order_id').orderBy(\n    F.col('event_ts').desc_nulls_last(), F.col('event_id').desc())\nlatest = events.withColumn('_rn', F.row_number().over(w)) \\\n    .filter(F.col('_rn') == 1).drop('_rn')"
          },
          "id": "pyspark-3",
          "kind": "exercise"
        },
        {
          "prompt": "When should you broadcast a dimension table?",
          "hint": "Consider the actual materialized size and executor memory.",
          "answer": "When the build side fits safely and the join supports it; inspect statistics and the plan. Avoid unconditional hints for a dimension that can grow. Recheck skew, memory and correctness.",
          "checks": [
            "Use measured/estimated size explicitly.",
            "Keep fallback options."
          ],
          "pitfall": "A table name or row count alone is not a memory guarantee.",
          "sourceIds": [
            "spark-tune"
          ],
          "id": "pyspark-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "SQL / DataFrame expression",
          "Logical plan",
          "Physical strategy",
          "Result contract"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "sql",
        "spark"
      ],
      "level": "intermediate"
    },
    {
      "id": "streaming",
      "title": "Streaming, event time and recovery",
      "domain": "Streaming",
      "caseId": "tidal",
      "overview": "Freshness is a requirement; streaming is one possible implementation, not automatically the right one.",
      "questions": [
        {
          "prompt": "How do event time and processing time differ?",
          "hint": "When did it happen versus when was it processed?",
          "answer": "Event time belongs to the event's declared clock. Processing time belongs to the engine. Late and out-of-order data require explicit aggregation, retention and correction policies.",
          "checks": [
            "Name the two clocks.",
            "Explain clock quality and lateness."
          ],
          "pitfall": "Arrival order is not necessarily business order.",
          "sourceIds": [
            "spark-stream"
          ],
          "id": "streaming-1",
          "kind": "concept"
        },
        {
          "prompt": "Does a watermark guarantee that every late record is retained?",
          "hint": "A watermark bounds state under assumptions.",
          "answer": "No. It expresses a lateness/state-management policy. Results depend on the operation, output mode and source/sink support. State and data beyond the policy may be discarded.",
          "checks": [
            "Describe the trade-off.",
            "Keep version-specific behavior explicit."
          ],
          "pitfall": "A watermark is not a promise of complete historical truth.",
          "sourceIds": [
            "spark-stream"
          ],
          "id": "streaming-2",
          "kind": "syntax"
        },
        {
          "prompt": "Specify a deduplication key and state policy for retried sensor events.",
          "hint": "Use producer identity, not arrival timestamp alone.",
          "answer": "A candidate key is producer_id plus stable event_id; retain event time, ingestion time and quality. Define duplicate conflicts and state retention; a changed payload for the same ID needs review.",
          "checks": [
            "Use stable identity.",
            "Bound retention without silently claiming eternal deduplication."
          ],
          "pitfall": "A timestamp alone may not identify one event.",
          "sourceIds": [
            "spark-stream"
          ],
          "id": "streaming-3",
          "kind": "exercise"
        },
        {
          "prompt": "A lab produces one small file each hour. Must it use a streaming engine?",
          "hint": "Start from required latency and operational burden.",
          "answer": "No. Scheduled bounded processing may meet the need more simply. Compare latency, volume, late-data handling, replay, state, operations and cost before choosing.",
          "checks": [
            "State a freshness target.",
            "Explain a simpler alternative."
          ],
          "pitfall": "Real-time branding does not establish a business requirement.",
          "sourceIds": [
            "spark-stream",
            "fabric-store"
          ],
          "id": "streaming-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Producer event time",
          "Arrival / ingestion",
          "State and windows",
          "Sink and replay"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "ingestion",
        "spark"
      ],
      "level": "foundation"
    },
    {
      "id": "fabric",
      "title": "Fabric: storage, semantics and execution",
      "domain": "Microsoft Fabric",
      "caseId": "harbor",
      "overview": "Choose a development and consumption path from workload and governance needs, not from a single preferred icon.",
      "questions": [
        {
          "prompt": "When would you begin with Fabric Warehouse versus Lakehouse?",
          "hint": "Consider T-SQL, Spark, data types and transaction needs.",
          "answer": "Warehouse is a candidate for relational T-SQL workflows and multi-table transactions. Lakehouse is a candidate for Spark and mixed data. Test the chosen interface's actual supported operations.",
          "checks": [
            "Separate item from engine.",
            "State what would change the decision."
          ],
          "pitfall": "The Lakehouse SQL analytics endpoint is not a general write endpoint.",
          "sourceIds": [
            "fabric-store"
          ],
          "id": "fabric-1",
          "kind": "concept"
        },
        {
          "prompt": "Are Import, DirectQuery and Direct Lake three names for the same read path?",
          "hint": "Track where data is stored and queries execute.",
          "answer": "No. They differ in storage/query behavior, refresh and security. Direct Lake on OneLake and on SQL also have different fallback and configuration behavior; identify the exact variant.",
          "checks": [
            "Identify actual mode.",
            "Avoid a universal fallback claim."
          ],
          "pitfall": "The latest vendor documentation does not prove a tenant is configured that way.",
          "sourceIds": [
            "fabric-semantic"
          ],
          "id": "fabric-2",
          "kind": "syntax"
        },
        {
          "prompt": "Sketch a metadata-driven ingestion table for three source entities.",
          "hint": "Describe required fields, not an unbounded execution language.",
          "answer": "Use allowlisted source/target IDs, load mode, keys, watermark/checkpoint policy, schema version, owner and validation settings. Separate orchestration metadata from credentials and business rows.",
          "checks": [
            "Validate identifiers and supported load modes.",
            "Explain failed-run recovery."
          ],
          "pitfall": "A configuration row must not grant arbitrary query or deployment authority.",
          "sourceIds": [
            "metadata-copy",
            "ci-security"
          ],
          "id": "fabric-3",
          "kind": "exercise"
        },
        {
          "prompt": "A new frontend over a semantic model seems cheaper than SQL writeback. How would you compare it?",
          "hint": "Hold workload and capability requirements constant.",
          "answer": "Compare read versus write needs, actual queries, concurrency, idle periods, storage and service meters. Record capacity, time units and observation windows; do not reuse another user's CU measurements as your bill.",
          "checks": [
            "Use equivalent user journeys.",
            "Keep observed versus forecast cost distinct."
          ],
          "pitfall": "A UI choice does not remove downstream compute.",
          "sourceIds": [
            "fabric-cost",
            "fabric-semantic"
          ],
          "id": "fabric-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Sources and access",
          "OneLake / chosen store",
          "Semantic model",
          "Report or data app"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "warehouse",
        "formats"
      ],
      "level": "foundation"
    },
    {
      "id": "databricks",
      "title": "Databricks: jobs, governance and delivery",
      "domain": "Databricks",
      "caseId": "tidal",
      "overview": "A notebook, job definition, deployment bundle and catalog serve different roles.",
      "questions": [
        {
          "prompt": "What is the difference between notebook code, a job and a deployment bundle?",
          "hint": "Separate code, orchestration and deployment configuration.",
          "answer": "A notebook contains code and explanatory cells. A job specifies tasks and execution relationships. A bundle carries code/configuration for managed deployment; validation, deployment and execution are distinct.",
          "checks": [
            "Separate the three artifacts.",
            "Identify runtime inputs and output evidence."
          ],
          "pitfall": "A successfully deployed job has not necessarily run successfully.",
          "sourceIds": [
            "db-jobs"
          ],
          "id": "databricks-1",
          "kind": "concept"
        },
        {
          "prompt": "Does a catalog permission automatically grant access to every table?",
          "hint": "Consider privileges at each level and execution identity.",
          "answer": "No. Inspect catalog/schema/object grants and the identity used by the job or query. Do not infer permissions from a UI folder or a successful run as another user.",
          "checks": [
            "Name the caller identity.",
            "Check object privileges."
          ],
          "pitfall": "A catalog name is not an authorization boundary by itself.",
          "sourceIds": [
            "db-governance"
          ],
          "id": "databricks-2",
          "kind": "syntax"
        },
        {
          "prompt": "Design a run record that makes a synthetic experiment reproducible.",
          "hint": "Bind code, configuration, data and model—not just a timestamp.",
          "answer": "Record run ID, source revision, input versions, model/version, parameters, seed, environment/dependencies, units, output identities and validation. Label synthetic assumptions and missing calibration.",
          "checks": [
            "Keep immutable inputs.",
            "Distinguish deterministic code from reproducible environment."
          ],
          "pitfall": "The seed alone is insufficient.",
          "sourceIds": [
            "db-jobs",
            "db-governance"
          ],
          "id": "databricks-3",
          "kind": "exercise"
        },
        {
          "prompt": "How would you move a Databricks pipeline to Fabric without claiming automatic parity?",
          "hint": "Separate data format, execution, identity and semantics.",
          "answer": "Inventory runtimes, libraries, functions, table features, job behavior and governance. Reuse shared data where appropriate, test representative outputs and permissions, and define coexistence and rollback.",
          "checks": [
            "Compare actual operations and contracts.",
            "Retain an unchanged reference output."
          ],
          "pitfall": "A common Spark or Delta name does not prove complete portability.",
          "sourceIds": [
            "db-jobs",
            "fabric-store",
            "delta"
          ],
          "id": "databricks-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Versioned code / bundle",
          "Job tasks and identity",
          "Governed data",
          "Run and output evidence"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "spark",
        "formats"
      ],
      "level": "intermediate"
    },
    {
      "id": "postgres",
      "title": "PostgreSQL: storage, MVCC and plans",
      "domain": "PostgreSQL",
      "caseId": "beacon",
      "overview": "Explain a query from application request to rows, indexes, snapshots and measured behavior.",
      "questions": [
        {
          "prompt": "Why can a database keep more than one version of a row?",
          "hint": "Think about concurrent readers and writers.",
          "answer": "MVCC lets transactions see an appropriate snapshot while changes create row versions. Isolation and locks still matter; cleanup and long transactions affect operational behavior.",
          "checks": [
            "Explain snapshot visibility.",
            "Do not claim locking disappears."
          ],
          "pitfall": "MVCC is not 'every query sees the newest committed row at all times'.",
          "sourceIds": [
            "pg-mvcc"
          ],
          "id": "postgres-1",
          "kind": "concept"
        },
        {
          "prompt": "How does EXPLAIN differ from EXPLAIN ANALYZE?",
          "hint": "One describes a plan; the other also runs the statement.",
          "answer": "EXPLAIN shows a plan. ANALYZE executes and reports actual measurements. Treat writes, triggers and side effects carefully; do not run it on untrusted production statements just to inspect them.",
          "checks": [
            "Flag execution.",
            "Use an appropriate read-only test scope."
          ],
          "pitfall": "A rollback cannot necessarily undo external side effects.",
          "sourceIds": [
            "pg-explain"
          ],
          "id": "postgres-2",
          "kind": "syntax"
        },
        {
          "prompt": "Choose an index candidate for filtering customer_id and ordering recent created_at values.",
          "hint": "Use the access pattern and verify it.",
          "answer": "Consider a composite index beginning with the selective/equality customer key and then created_at, subject to actual workload. Compare plans and timings on representative data and include write/storage cost.",
          "checks": [
            "State workload assumptions.",
            "Measure before/after."
          ],
          "pitfall": "An index is not automatically used or beneficial.",
          "sourceIds": [
            "pg-explain"
          ],
          "id": "postgres-3",
          "kind": "exercise"
        },
        {
          "prompt": "The same query becomes slow only during peak traffic. What would you inspect beyond SQL text?",
          "hint": "Include contention, I/O and transaction lifetime.",
          "answer": "Check actual plans, row estimates, locks/waits, cache/I/O, connections, concurrent workload and long-running transactions. Distinguish observed cause from hypotheses before changing configuration.",
          "checks": [
            "Use time-correlated evidence.",
            "Preserve a baseline and rollback."
          ],
          "pitfall": "A 3D database picture does not observe an installed database.",
          "sourceIds": [
            "pg-explain",
            "pg-mvcc"
          ],
          "id": "postgres-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "API request",
          "Planner / executor",
          "Snapshot + indexes",
          "Storage / results"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "sql"
      ],
      "level": "intermediate"
    },
    {
      "id": "cloud-iac",
      "title": "Cloud, VMs, containers and Terraform",
      "domain": "Cloud and IaC",
      "caseId": "beacon",
      "overview": "Keep planned resources, actual infrastructure, code execution and approval separate.",
      "questions": [
        {
          "prompt": "How do a virtual machine, container image and running container differ?",
          "hint": "Distinguish virtual hardware from packaging and a process environment.",
          "answer": "A VM has a virtualized machine/OS boundary. An image is packaged filesystem/configuration; a container runs from it under a host kernel or supporting virtualization. Neither is automatically a secure multi-tenant sandbox.",
          "checks": [
            "Separate artifact and runtime.",
            "Describe host dependencies."
          ],
          "pitfall": "A container name is not proof of isolation or persistence.",
          "sourceIds": [
            "docker"
          ],
          "id": "cloud-iac-1",
          "kind": "concept"
        },
        {
          "prompt": "Does Terraform `sensitive = true` remove a value from state and plan files?",
          "hint": "Display redaction is not data removal.",
          "answer": "No. It commonly hides display output while values can remain in state/plan. Use appropriate state protection and supported ephemeral/write-only features where applicable; do not commit raw state.",
          "checks": [
            "Identify storage exposure.",
            "Keep provider-specific support explicit."
          ],
          "pitfall": "A redacted screenshot does not prove the file is sanitized.",
          "sourceIds": [
            "iac-secrets"
          ],
          "id": "cloud-iac-2",
          "kind": "syntax"
        },
        {
          "prompt": "Review a deployment handoff without running it. What references do you need?",
          "hint": "Bind target, source, permissions and expected changes.",
          "answer": "Request repository/ref, reviewed configuration, provider/version lock, workspace/target, sanitized plan summary, approval boundary, validation and rollback. Keep credentials out and distinguish review from apply.",
          "checks": [
            "Identify replacement/destructive changes.",
            "Do not execute untrusted configuration for convenience."
          ],
          "pitfall": "Terraform plan can invoke providers/data sources; it is not a harmless text parser.",
          "sourceIds": [
            "iac-plan",
            "iac-secrets"
          ],
          "id": "cloud-iac-3",
          "kind": "exercise"
        },
        {
          "prompt": "A team says its CI passed inside a Windows guest. Does that qualify production?",
          "hint": "Ask which identity, artifact, environment and journey were exercised.",
          "answer": "No. Record the tested user/session, guest boundaries, exact artifact, network policy and checks. A guest startup proof, unit pass, installed journey and production deployment are different evidence.",
          "checks": [
            "Name the precise tested scope.",
            "Preserve unknown deployment state."
          ],
          "pitfall": "A native runner or guest grant does not authorize new cloud actions.",
          "sourceIds": [
            "ci-security",
            "docker"
          ],
          "id": "cloud-iac-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Source / plan",
          "Approval and target",
          "VM / container runtime",
          "Evidence / rollback"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "ingestion"
      ],
      "level": "foundation"
    },
    {
      "id": "agents",
      "title": "LLMs, RAG, MCP and skills",
      "domain": "AI and agents",
      "caseId": "beacon",
      "overview": "Protocol, model, retrieval, tool execution and human authority must not be drawn as the same capability.",
      "questions": [
        {
          "prompt": "How does RAG differ from fine-tuning?",
          "hint": "Does the operation change retrieved context or model weights?",
          "answer": "RAG retrieves information for the current response context. Fine-tuning changes model parameters through training. They can be combined, but retrieved sources and correct answers are not synonymous.",
          "checks": [
            "Separate training and inference.",
            "Mention retrieval and answer evaluation."
          ],
          "pitfall": "Citations alone do not make a response correct.",
          "sourceIds": [
            "rag"
          ],
          "id": "agents-1",
          "kind": "concept"
        },
        {
          "prompt": "Does installing an MCP server or a skill grant the assistant every action it describes?",
          "hint": "Capability discovery and authorization are separate.",
          "answer": "No. A host/client/server interface exposes supported operations; host and server authorization still apply. Skill content supplies instructions/resources, not new permissions. Respect the pinned protocol and actual tools.",
          "checks": [
            "Identify the enforcing host/server.",
            "Separate instructions from execution."
          ],
          "pitfall": "A file claiming a tool exists does not make it callable.",
          "sourceIds": [
            "mcp",
            "skills"
          ],
          "id": "agents-2",
          "kind": "syntax"
        },
        {
          "prompt": "Design a safe read-only document-answering path.",
          "hint": "Keep untrusted text out of the instruction authority.",
          "answer": "Use access-filtered retrieval, bounded context, explicit source citations and refusal/uncertainty when evidence is absent. Treat retrieved instructions as data and keep action tools outside this read-only scope.",
          "checks": [
            "Preserve tenant/document permissions.",
            "Separate prompt text from policy."
          ],
          "pitfall": "A classifier or delimiter is not a complete injection defense.",
          "sourceIds": [
            "rag",
            "mcp"
          ],
          "id": "agents-3",
          "kind": "exercise"
        },
        {
          "prompt": "Should every coding task have an orchestrator and several reviewers?",
          "hint": "Compare complexity, independence, cost and integration ownership.",
          "answer": "No. Start with a clear outcome and bounded work. Delegate genuinely independent files/resources and retain one integrator. Use stronger review where ambiguity/risk warrants it; record actual workers and results.",
          "checks": [
            "Explain when parallel work helps.",
            "Keep no-worker fallback explicit."
          ],
          "pitfall": "More agents do not automatically improve correctness or elapsed time.",
          "sourceIds": [
            "agents",
            "ci-security"
          ],
          "id": "agents-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Question / permission",
          "Retrieval and context",
          "Model / tool request",
          "Validation / cited answer"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "ingestion"
      ],
      "level": "foundation"
    },
    {
      "id": "git-fullstack",
      "title": "Full-stack architecture and agentic Git review",
      "domain": "Software engineering",
      "caseId": "beacon",
      "overview": "A meaningful review follows the user's request through code, data, side effects and evidence.",
      "questions": [
        {
          "prompt": "Which parts of a full-stack app should a request walkthrough show?",
          "hint": "Follow both success and failure paths.",
          "answer": "Show UI state, request contract, authentication/authorization, backend logic, storage, async work, response and observable failures. Keep static call candidates separate from recorded traces.",
          "checks": [
            "Explain the trust boundary.",
            "Include state and error handling."
          ],
          "pitfall": "A route name or imported library does not prove a working capability.",
          "sourceIds": [
            "mcp",
            "ci-security"
          ],
          "id": "git-fullstack-1",
          "kind": "concept"
        },
        {
          "prompt": "Is a branch the identity of a feature or a running agent?",
          "hint": "A branch points into history; work identities need explicit records.",
          "answer": "No. Git branches are movable references. A feature can span branches/repositories; an agent can make no commit or several. Preserve actual commit parents separately from authored work associations.",
          "checks": [
            "Separate commit, branch and work item.",
            "Do not infer agents from author names."
          ],
          "pitfall": "Filtering commits must not invent new ancestry edges.",
          "sourceIds": [
            "git"
          ],
          "id": "git-fullstack-2",
          "kind": "syntax"
        },
        {
          "prompt": "Draft the minimum handoff for two independent implementation lanes.",
          "hint": "Define output, boundaries and integration before prompts.",
          "answer": "Provide outcome, acceptance, base source, disjoint filesets/resources, prerequisites, tests, return checkpoint and the integrator. Each lane returns exact diffs and failed checks; an unlaunched lane remains the lead's responsibility.",
          "checks": [
            "Name shared files and conflicts.",
            "Include stop/recovery and no-worker behavior."
          ],
          "pitfall": "A prepared prompt is not a launched session.",
          "sourceIds": [
            "agents",
            "git"
          ],
          "id": "git-fullstack-3",
          "kind": "exercise"
        },
        {
          "prompt": "A frontend and API both pass tests, but production login fails. What was missing?",
          "hint": "Look at the integrated user journey and deployment vector.",
          "answer": "Check origin/cookie/CORS configuration, redirect URIs, identity claims, API authorization, environment variables and the actual deployed pair. Preserve secrets and verify a scoped user journey rather than declaring source tests sufficient.",
          "checks": [
            "Bind frontend/backend/environment versions.",
            "Distinguish authentication and authorization."
          ],
          "pitfall": "A green component suite is not an installed full-stack qualification.",
          "sourceIds": [
            "ci-security",
            "mcp"
          ],
          "id": "git-fullstack-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Browser state",
          "API and authorization",
          "Service / database",
          "Build, deploy and evidence"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "cloud-iac"
      ],
      "level": "foundation"
    },
    {
      "id": "company",
      "title": "Company understanding and portfolio explanation",
      "domain": "Business and interviews",
      "caseId": "harbor",
      "overview": "Explain the client's problem first; distinguish your contribution, team work, current facts and proposed ideas.",
      "questions": [
        {
          "prompt": "How would you explain a data platform to a nontechnical recruiter in 90 seconds?",
          "hint": "Begin with a decision or problem, not a product list.",
          "answer": "Describe the business problem, data involved, your bounded contribution, a concrete journey and the supported outcome. Then offer technical detail. Label team contributions and uncertainties.",
          "checks": [
            "Use a business-to-data chain.",
            "Attribute work honestly."
          ],
          "pitfall": "A fictional teaching case is not employment evidence.",
          "sourceIds": [
            "dc-authoring"
          ],
          "id": "company-1",
          "kind": "concept"
        },
        {
          "prompt": "What is wrong with presenting a company architecture inferred from its job advertisement as fact?",
          "hint": "A requested skill is evidence of a requirement, not the deployed estate.",
          "answer": "Keep public company facts, job requirements, hypotheses and candidate recommendations separate. Ask focused questions to validate assumptions rather than filling gaps with a plausible diagram.",
          "checks": [
            "Label evidence categories.",
            "Do not invent customer data or achievements."
          ],
          "pitfall": "Interest in a tool does not prove its use across the company.",
          "sourceIds": [
            "dc-authoring"
          ],
          "id": "company-2",
          "kind": "syntax"
        },
        {
          "prompt": "Create a three-view explanation of a fictional industrial project.",
          "hint": "Business object, data meaning and technical implementation.",
          "answer": "Use an asset/process view, a mapping-to-data view and an application/decision view. Preserve units, grain, model versions, synthetic provenance and unresolved mappings; share exact IDs only when justified.",
          "checks": [
            "Use explicit correspondences.",
            "Keep business context in the data view."
          ],
          "pitfall": "An attractive anatomy illustration is not calibrated engineering.",
          "sourceIds": [
            "dc-authoring"
          ],
          "id": "company-3",
          "kind": "exercise"
        },
        {
          "prompt": "How should a personal portfolio distinguish a delivered client project from an AI experiment?",
          "hint": "Show status and evidence in the content, not only a disclaimer.",
          "answer": "Separate professional delivery, independent demonstration and proposed work. Use approved/sanitized sources, clear role attribution, dates and evidence. Keep confidential/raw material and private activity records off the public site.",
          "checks": [
            "Name contribution and evidence.",
            "Keep future AI/RAG/CAD proposals separate."
          ],
          "pitfall": "Do not turn repository activity into employment claims.",
          "sourceIds": [
            "dc-authoring"
          ],
          "id": "company-4",
          "kind": "scenario"
        }
      ],
      "diagram": {
        "nodes": [
          "Client problem",
          "Business objects and data",
          "Your contribution",
          "Evidence / next question"
        ],
        "edges": [
          [
            0,
            1,
            "follow meaning"
          ],
          [
            1,
            2,
            "follow meaning"
          ],
          [
            2,
            3,
            "follow meaning"
          ]
        ]
      },
      "prerequisites": [
        "warehouse"
      ],
      "level": "foundation"
    }
  ]
});
