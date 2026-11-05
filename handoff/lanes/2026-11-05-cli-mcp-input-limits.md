# Lane report: cli-mcp-input-limits (2026-11-05)

Next step "Apply the #148 file-size limits to the CLI and MCP inputs" from `2026-11-05-overnight-lead.md`.

## What changed
- `src/core/inputLimits.ts` (new): the one module for input limits. Holds `MAX_PACKAGE_FILE_BYTES` (16 MiB, moved from `src/app/importFileLimit.ts`), `importFileLimit` / `checkImportFileSize` (moved, App wording unchanged), `MAX_BRIEF_BYTES` (512 KiB), `MAX_MCP_REQUEST_BYTES` (1 MiB), `MAX_EVIDENCE_FILE_BYTES` (1 MiB), `MAX_CONCEPT_VIEWER_BYTES` / `MAX_CONCEPT_PACKET_BYTES` (8 / 32 MiB), `MAX_READING_OPTIONS_BYTES` (64 KiB), re-exports `MAX_DOCUMENT_BYTES` (12 MiB), `GRAPH_SNAPSHOT_MAX_BYTES` and `EXPLANATION_REQUEST_FILE_LIMIT` (4 MiB) from their owners, plus `formatBytes`, `inputLimitMessage`, `InputLimitError` and `checkPayloadSize`.
- `src/app/importFileLimit.ts`: now a re-export (App.tsx untouched).
- `scripts/lib/boundedInput.ts` (new): `readBoundedText` / `readBoundedBytes` open the file, `fstat` it, refuse a non-regular file or one above its limit before reading, then re-check the bytes read.
- CLI paths now size-checked before the whole read, with the message "<file> is <size>: a <kind> is read up to <limit>. Nothing was read or written.":
  - `scripts/intelligence.ts`: `--input` (per mode: ProjectBrief 512 KiB, GraphSnapshot 4 MiB, docs set 16 MiB, otherwise 12 MiB), every `--current`, `--applied`, `--spec`, `--sources`, `--brief` (all 12 MiB). Literal `12*1024*1024` removed; line count and cited lines 1, 40, 120 unchanged.
  - `scripts/intelligence-mcp.ts`: startup document and `--analysis` bundle (12 MiB; refusal exits 1 before the server starts); `diagramcloud_propose_project` and `diagramcloud_propose_design` arguments checked at 512 KiB before parsing (ordinary `isError` result); request-line and tool-result limits use `MAX_MCP_REQUEST_BYTES`. Cited lines 1, 24, 25, 30, 32 unchanged.
  - `scripts/atlas.ts`: manifest and `--previous` (12 MiB), both read before any scan or output.
  - `scripts/design.ts`: document and `--delta` (12 MiB), `--brief` (512 KiB); `--delta` is now read before the output folder is created (it used to be read after `mkdirSync`).
  - `scripts/concept-preview.ts`, `scripts/concept-host.ts`, `scripts/export-linked-reading.ts`, `scripts/prepare-explanation.ts`, `scripts/package-campaign.ts`: already bounded; now use the shared constants and name the limit in the refusal.
- `src/intelligence/brief.ts`: `parseProjectBrief` uses `MAX_BRIEF_BYTES` (same line).
- `docs/AI_GUIDE.md`: one paragraph "Input size limits" after the `npm run intelligence` brief/inspect paragraph.

Not changed: no CLI reads draw.io, Mermaid or Visio files (grep of `scripts/`), so the interchange limits stay App-only. `npm run scan` reads a folder with its existing per-file (512 KiB) and count budgets. `scripts/qualify-real.ts` (64 KiB source manifest) is a qualification harness and keeps its own limit.

## How verified
- `tests/cli-input-limits.test.ts` (7 tests): shared module and App re-export; `readBoundedText` at limit accepted, +1 byte refused, folder refused; intelligence CLI 12 MiB document accepted (exit 0, outputs) and 12 MiB + 1 refused (exit 1, message, no output directory), `--current` and ProjectBrief refusals; MCP starts with a 12 MiB document, refuses 12 MiB + 1 and an over-limit `--analysis` at startup (exit 1, empty stdout), oversized propose_project / propose_design arguments return `isError`; atlas and design (document, `--delta`, `--brief`) refuse with no output file or folder; concept preview, linked reading (64 KiB) and explanation (4 MiB, at limit read and refused for content only) create no output; concept host refuses before starting a server.
- `npm run check` clean; `npm test` 2315 tests, 2312 pass, 0 fail, 3 skipped (parity tests `catalogue-retrieval` and `proposal-parity` unchanged and passing; `ai-guide` and `v3-capabilities` passing); `npm run build` ok. No Playwright spec touched.

## Problems hit
- The worktree guard refuses heredoc appends and compound `git` commands; edits went through small Python scripts and the Edit tool.

## Remaining issues
- `scripts/package-campaign.ts` evidence limit is not covered by a test: the command refuses a dirty working tree before it reads `--evidence`, so a unit test would need a clean temporary repository.
- The App still holds its own 512 KiB literals for design and project briefs in `src/App.tsx` (lines 386, 396) and `src/ui/ProjectStart.tsx`; replacing them with `MAX_BRIEF_BYTES` must keep cited `App.tsx` lines in place.

## Next steps
- Replace the App and ProjectStart 512 KiB / 4 MiB literals with the `src/core/inputLimits.ts` constants without moving cited App.tsx lines (one patch).
- Test the packaging evidence limit in a clean temporary repository (one patch).
