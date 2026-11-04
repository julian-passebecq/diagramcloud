# Lane report: fix-import-bounds (2026-11-04)

## What changed
- `src/core/interchange/zip.ts`: new `inflateBounded` (chunked read, cancels past a byte limit, throws `InflateLimitError`). `zipText` inflates a Visio part at most up to its declared size (never above 64 MiB) and refuses a part whose real size differs from the central directory (stored or deflated) as damaged.
- `src/core/interchange/drawio.ts`: `inflate` uses `inflateBounded` with one 12 MiB (`MAX_DOCUMENT_BYTES`) budget shared by every compressed page of a file, and a 12 MiB limit for a PNG zTXt chunk. The size error passes through `pageModel` instead of becoming "cannot read". A parent chain that cycles (self-parent, A in B in A) is broken before any ancestor walk: the cell that closes the cycle is detached to the page and reported as "cell(s) with a cyclic parent detached to the page".
- `src/core/interchange/mermaid.ts`: `&` lists drop repeated keys, and link expansion stops at `EDGE_PARSE_CAP` (4 x `MAX_EDGES`, now exported from `graph.ts`), reporting the skipped pairs.
- `tests/import-bounds.test.ts`: four regression tests (Visio bomb + size mismatch, draw.io page / multi-page / PNG zTXt bombs + normal page, draw.io parent cycles, Mermaid cross product).

## How verified
- Each new test was run against the unfixed code first: Visio and draw.io size tests failed (no rejection / wrong error), the cycle test failed (stack overflow), the Mermaid test hung until killed.
- `npx tsc --noEmit` clean; `npm test` 2219 tests, 2215 pass, 1 fail (the known Windows CRLF "entry documentation local links" test), rest skipped; `npm run build` ok. No Playwright spec touched.

## Problems hit
- A Mermaid flowchart with more than 1000 connections in its single view is refused by `validateDocument` (a view holds at most 1000 `edgeIds`) although `documentFromGraph` keeps up to 1500. The test accepts either a bounded import or that refusal.

## Remaining issues
- Per-view edge cap mismatch above (one patch: cap edges per view at the schema's 1000 in `documentFromGraph`, with its own report line).
- Visio still re-inflates one part once per `<Page>` that points to it and has no page count or total-bytes budget across parts (one patch).
- App.tsx reads a picked `.drawio.png` / `.vsdx` into memory without a file-size check before parsing (one patch).

## Next steps
- The three remaining issues above, each one patch.
