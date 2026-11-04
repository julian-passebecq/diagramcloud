# Lane: pptx-drilldown-crlf (2026-11-05)

## What changed
- `src/export/pptx.ts`: the component title already linked to its child view's slide; the "Open subdiagram" footer now carries the same internal slide link (with tooltip). A link is created only when the child view has a slide in the exported public deck (`slideNumbers.get` defined); otherwise no link, so a private child gets no link and no hint. `deck.ts` reuses `addArchitectureSlides`, so the project deck gets it too.
- `tests/pptx-drilldown.test.ts` (new): unzips the PPTX; parent slide has `a:hlinkClick` ids resolving through `ppt/slides/_rels` to the child slides; a private child view yields no link and no title text.
- `tests/helpers/readText.ts` (new): reads text with CRLF normalised to LF; used by `release-entry-docs.test.ts` and `adoption-journeys.test.ts` (the blob-identity test still reads raw bytes). Documents are unchanged.

## Verified
`npm run check` clean; `npm test` 2232 tests, 2229 pass, 0 fail; `npm run build` ok (Windows, autocrlf).

## Problems
The task premise was partly stale: the title link already existed (tested in `deck.test.ts`). No doc limit text saying the deck has no drilldown was found.

## Remaining
- One patch: other doc-reading tests (`ai-guide`, `r4-crosswalk`, `independent-journeys`) strip `\r` themselves; could move to `readText`.
- Slides were not inspected visually in PowerPoint.
