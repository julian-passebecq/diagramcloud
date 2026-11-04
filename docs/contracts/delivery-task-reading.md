# Delivery evidence: truthful estimates and explicit PM task correspondence

This extends the existing `delivery-view/1` consumer. It does not change PM task authority, Project JSON,
workflow execution, permissions or release approval. The existing App dock **Plan, owners and remaining effort**
mounts the revised `DeliveryEvidencePanel`; no new App route or database is required.

## Required inputs and defaults

The plan keeps the existing `sources`, `products`, `blocks` and optional `handoff` fields. Loading it is local,
session-only and bounded to 256 KiB / 200 blocks / 100 sources / 20 products / 20 owners. Unknown metadata is listed
as not read; invalid recognized data refuses the whole file without replacing the last valid input.

`depends_on` and top-level `{from,to}` entries express work prerequisites (`from` depends on `to`). Existing portfolio
`{source,target,kind,label,source_id}` entries instead express **product relations**: they do not become work dependencies.
Mixed shapes and unknown product/source endpoints refuse. Unknown external block dependencies remain explicit gaps.

`blocker` and `boundary` strings are displayed, not executed. Non-string historical descriptions are ignored and listed.
`resources` declares potential shared resources such as one GUI or test target. Declared sharing does not acquire a lock,
a guest, a runner, permission or calendar availability.

## What an estimate means

A block's existing `estimate` is `{min_minutes,max_minutes,basis,estimated_at}`. States `done`, `merged` and `delivered`
are treated as **source-declared finished work** for this arithmetic, never proof of feature acceptance or deployment.

- `remaining.sumMinutes` is null when any unfinished block lacks an estimate. It must not display a known subtotal as a total.
- `knownSubtotalMinutes` preserves the sum of estimates that were actually supplied. All work declared finished yields `[0,0]`.
- `dependencyLowerBoundMinutes` is a known-work dependency calculation only. Unknown work contributes no *known* minutes;
  the result does not bound the duration of the whole outcome. `partial` names incomplete estimate/dependency coverage.
- Block and token assumptions remain inspectable. Calendar, queue, access waits and worker/resource scheduling remain unmodelled.
- Count each leaf of the selected work decomposition once. The reader does not deduplicate a parent's inclusive estimate against children.

Optional `tokens` on a block or its `handoff.block_details` entry accepts precisely:

```json
{"input":[4000,12000],"output":[1000,3000],"basis":"Planning allowance, uncalibrated", "estimated_at":"2026-10-20T08:00:00Z"}
```

Each direction can be null. Ranges are nonnegative safe integers up to 1e12. Missing any unfinished block's direction keeps
that aggregate UNKNOWN. Zero is an explicit supplied zero. Unsupported older shapes are listed, not interpreted. These are
**input/output planning allowances**, not usage receipts, costs, subscription credits, speed or productivity measurements.
No price or token estimate is inferred when absent.

## Exact PM task reference

To connect a plan block to a task, an author supplies `pm_task_refs` on that block (or its matching `handoff.block_details`):

```json
{"pm_task_refs":[{
  "task_id":"task.api",
  "input_sha256":"<64 lowercase hex digits of the exact task JSON bytes>",
  "revision":4,
  "scope":{"organizationId":"synthetic","privacyDomainId":"private","projectId":"service","repoId":"example.service"}
}]}
```

The placeholder is explanatory, not a valid digest. The two synthetic fixture files under `tests/fixtures/delivery-evidence/`
provide a runnable, byte-bound example. A producer/AI prepares the reference from the **actual chosen** task snapshot, never a
suggested title, invented ID or latest-looking revision. Identical local IDs in another scope are different tasks.

The person loads that snapshot through **Load PM task snapshot**. Browser decoding must preserve exact UTF-8 bytes;
BOM-stripping and invalid-encoding replacement are refused rather than hashed as an alias. `readDeliveryTaskSnapshot` uses the unchanged native
`datapass.owner-tasks/1` parser (256 KiB, 60 tasks) and the existing SHA-256 function. The resolver checks exact input digest,
four scope identifiers, revision and task ID. Whitespace changes the digest; refreshing is an explicit new source choice.

States: `NO_SNAPSHOT`, `SNAPSHOT_MISMATCH`, `AMBIGUOUS_SNAPSHOT`, `SCOPE_MISMATCH`, `REVISION_MISMATCH`, `TASK_ABSENT`, `MATCHED`.
A mismatch returns no task content. A matched task exposes its **source-declared** state/review, acceptance IDs and dates.
`DONE` or `APPROVED` never closes a DiagramCloud release gate. No task, review, observation or session is created.

The session inventory accepts at most **8 snapshots and 1 MiB of original UTF-8 bytes in total**; each individual snapshot
still passes the unchanged PM reader's 256 KiB / 60 task limits. **Load PM task snapshot** explicitly replaces the inventory;
**Add PM task snapshot** retains its other cuts. Exact duplicate bytes are refused on Add. A changed revision or different
whitespace is a distinct cut and never replaces an older one automatically. No automatic multi-repository fetch occurs.

Each reference selects by its exact input SHA-256 first, then validates all four scope IDs, revision and task ID. Same local
task IDs across repositories and multiple revisions of one scope coexist. The resolver refuses ambiguous input rather than
picking the first candidate. The UI lists retained scope/revision/digest identities and permits individual removal or clearing
all. Removing a cut leaves its references unmatched; neither a newer revision nor a similar title fills the gap. Invalid or
over-budget input preserves the whole previous inventory. These are transient supplied snapshots, never a task database.

## Source/audience safety

Private plan content is withheld from public audiences. PM task details are author-only even for a public surrounding plan.
A plan source, project/audience epoch or clear action discards the loaded task inventory. Removing a snapshot or clearing all
also invalidates pending file reads. Late file completions/errors cannot restore an older plan or task. An invalid file leaves
the previous valid snapshots with a visible refusal. Data stays in memory;
reload does not promise persistence. Source-reviewed `checked_at` and producer `event_at` are distinct supplied timestamps.

Cited HTTPS sources can be opened deliberately. Other URL schemes and user-info URLs remain inert text. Loading a file performs
no requests, authenticates nobody and does not prove that its cited URL or hash issuer is trustworthy.

## Declared conflict analysis

Filesets name a repository and a relative **prefix**, not a glob. `.` means the repository root. Slash and lexical dot segments
are normalized; absolute/drive/UNC paths, escape above root and glob patterns refuse. Writes at overlapping prefixes conflict;
read-only overlap does not. A conservative case-insensitive alias is labelled as such, not a filesystem observation.
Repository identifiers remain exact: aliases for the same real checkout need producer reconciliation.

Transitive prerequisite order is displayed separately from compatibility. A missing fileset or resource declaration is not
proof that writers are disjoint. Output is bounded to 256 fileset pairs and 256 resource pairs; truncation is explicit.

## What is still not established

These features advance UX29/UX30. They do not complete a live PM/agent/artifact verification chain, compute calendar ETA,
validate arbitrary lineage or resolve original package qualification. A task link is not the release receipt. Keep product
source, immutable artifact, relevant checks, distribution and owner review distinct. The private 1.32.0 package is pinned to
5dbcd67; main also contains the later linked-context fix. A future candidate needs its own exact identity.

## Qualification

Run existing native gates plus `tests/delivery-evidence.test.ts`, `tests/delivery-integrity.test.ts`,
`tests/delivery-task-links.test.ts`, `tests/delivery-task-inventory.test.ts`, `tests/e2e/delivery-task-links.spec.ts` and
`tests/e2e/delivery-task-inventory.spec.ts`. The browser specs exercise the real App at
1440 and 390 pixels. This source contribution's isolated component checks do not substitute for that native execution.
