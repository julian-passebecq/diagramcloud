# Reopenable persistence and repository writes — 22 October 2026

Scope: existing local-save, recovery and repository-bridge acceptance. No schema,
new feature ID, service, dependency, permission, migration or release-version change.
The existing 1.33.0 private package remains immutable.

## Defects reproduced against the preceding source

A structurally valid Project can exceed the existing 12 MiB UTF-8 import limit.
Local storage accepted it and replaced the last good copy, but reopening then
quarantined that save. Repository serialization had the same mismatch; reads
also allocated oversized file contents before admission checks. Character count
is not byte count: the regression uses labelled synthetic non-ASCII evidence.

Local and repository saves could capture a caller-mutated document after an
await rather than the snapshot requested. Concurrent saves to the same picked
repository handle could both pass the old hash check and overwrite each other.
A failed review read erased the uncertain-write receipt before providing any
new evidence. A rejected save could recreate an externally deleted sidecar as
an empty file.

## Repairs

- Snapshot local JSON before yielding; check its UTF-8 bytes before opening a
  write transaction. Refuse an oversized draft without replacing the stored copy.
- Bound repository serialization and admission by the same existing limit,
  checking both file metadata before allocation and actual UTF-8 bytes after read.
  Review notes remain renderable, and a refused repository download reports its
  error through the existing UI instead of throwing an uncaught callback error.
- Snapshot the repository document and base before prompts or queue waits.
  Serialize writes to the same handle; a queued stale base is refused, not rebased.
  An unrelated handle is independent and a rejected write does not poison the queue.
- Clear an uncertain-write receipt only after a successful read, and only if it
  is still the receipt observed when that read began. A late read cannot clear a
  newer failure. Keep the existing landed-attempt reconciliation behavior.
- Do not create a missing repository file before checking the expected base.
  When intentionally creating one, recheck that another file did not appear.
  Compute the attempted content hash before opening the writable stream.

The repository queue is per handle identity in this runtime. It is not an OS
lock, a cross-tab lock or atomic filesystem compare-and-swap against external
editors or independently picked aliases. The UI now states that limitation.
Authoring backups remain available for an oversized in-memory draft, but such a
backup must be reduced before normal reimport; downloading it does not count as
saving it or proving that the user retained it. No content is silently truncated.

## Verification

The 15-case persistence regression file gives **3 passes / 12 failures** on the
preceding source. With the repairs, the six-module persistence/storage/queue/
startup selection gives **58 passes**, zero failures/skips. The broader available
16-module selection gives **246 passes**, zero failures/skips, including those
58. These selections are not additive.

Local execution uses Node 22.16.0, a TypeScript 5.8.3 transpilation loader and the
actual Zod sources recovered from the verified predecessor CI artifact. Storage
and repository fixtures are controlled protocol doubles. These results are not
a pinned npm build, semantic typecheck or native File System Access proof.
Syntax/transpilation diagnostics and git diff whitespace checks are clean.

Two actual-App browser cases, at 1440 and 390 pixels, import a reopenable near-limit
project, make an oversized form edit, verify the disk copy is byte-identical,
download the intact authoring draft, check the repository-download error, Undo,
save and reload without quarantine. They require exact-head CI before adoption.
The patch, model, public export and existing CI gates remain unchanged; no test,
mandatory skip, assertion or timeout is weakened. Installed hosts and successor
packaging remain separate from source integration.
