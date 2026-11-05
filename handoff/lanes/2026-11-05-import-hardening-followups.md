# Lane report: import-hardening-followups (2026-11-05)

Follow-ups left by PR #139 (`2026-11-04-fix-import-bounds.md`) and the #141 AI guide note.

## What changed
- `src/core/interchange/graph.ts`: `documentFromGraph` caps each view at `MAX_VIEW_EDGES` (1000, the validator's per-view `edgeIds` limit) before building the document, with its own report line ("Only the first 1000 connections of “<page>” were imported: one view holds at most 1000 connections."). The 1500 document total keeps its line, now shown only when that total was reached. Applies to Mermaid, draw.io and Visio (they all build through this function). A wide Mermaid flowchart no longer ends in a raw validator error.
- `src/core/interchange/zip.ts`: `partReader` reads each package part at most once (cached) and charges every part's declared size against one total budget before inflating it (inflation is already capped at the declared size), throwing `InflateLimitError`.
- `src/core/interchange/visio.ts`: all parts go through one reader with a 64 MiB total; a page part shared by several pages is read and parsed once; at most `MAX_VISIO_PAGES` (160) foreground pages are read, the rest counted in the report. A package over budget is refused ("<file> expands to more than 64 MiB of Visio parts. Nothing was imported.") through the existing import error path.
- `src/app/importFileLimit.ts` (new) + one call in `src/App.tsx` (same line, line count unchanged): the JSON / AI import file input checks `file.size` before any read: JSON, SVG, draw.io XML and Mermaid up to 12 MiB (`MAX_DOCUMENT_BYTES`), Visio packages and draw.io PNGs up to 16 MiB (their readers bound what they expand to). Replaces the former generic "File exceeds 16 MiB".
- `docs/AI_GUIDE.md`: describes that `add` at `<member>/-` creates an absent optional array and why it is preferred over `add` at the member (which would replace hidden entries when written against the public projection).

## How verified
- `tests/import-hardening.test.ts` (6 tests): Mermaid 40,000-pair flowchart imports with 1000 connections and the per-view line, the validator still refuses 1001; draw.io two pages capped 1000 then 500 (total 1500) with both lines; Visio 200 pages sharing one part read 160 and the part counted once; part budget refusal, cached re-read, 3 x 22 MiB pages refused with the input bytes unchanged; size limits per file type and the App.tsx call order; AI guide claim and patch behaviour.
- e2e `tests/e2e/interchange.spec.ts` new test: 17 MiB .vsdx and 13 MiB .mmd refused with the message, editor unchanged, Apply disabled.
- `npm run check` clean; `npm test` 2246 tests, 2243 pass, 0 fail, 3 skipped; `npm run build` ok; Playwright (DIAGRAMCLOUD_E2E_PORT=26720) interchange, import-race, authoring-backup-roundtrip, storage-size-boundary, quantity-import: 16 passed.

## Problems hit
- `git grep -l -i import tests/e2e` matches every spec (TS imports); the import-dialog specs were picked by the "Import document" label and size-limit text instead.

## Remaining issues
- CLI / MCP input paths have their own input limits and were not changed here.
- Item 8 of the QA list (meeting summary and linked-reading figures dropping `PUBLIC_OMISSION_NOTICE`) is outside this lane.

## Next steps
- Omission notice in meeting summary / linked-reading figures (one patch).
