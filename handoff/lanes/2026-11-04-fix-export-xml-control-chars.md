# Lane 2026-11-04 · fix-export-xml-control-chars

## What changed
- `src/export/xmlText.ts` (re-exported by `diagram.ts`, kept in its own module so the cited lines `diagram.ts:23`, `:54` and `drawio.ts:33` of the self-description guide do not move): new `xmlChars` (replaces C0 controls other than tab/LF/CR, U+FFFE/U+FFFF and unpaired surrogates with U+FFFD) and `xmlSafe` (applies it to every string of a plain JSON value, same reference when nothing changes). `xml()` now runs `xmlChars` before entity escaping, so every SVG renderer (classic, blueprint, editorial, every Diagram Design type), the manual, the HTML exports and the book that use `xml()` are covered.
- `src/export/drawio.ts`: `attr()` runs `xmlChars` first.
- PPTX (pptxgenjs only escapes `& < > " '`): `exportPptx` and `addArchitectureSlides` (`src/export/pptx.ts`), `buildDeck` (`src/export/deck.ts`) and `buildDesignDeck` (`src/export/design/slides.ts`) pass their public document / plan through `xmlSafe`.
- The model is unchanged: existing documents with such characters still load; only export output differs, and only for those characters.

## How verified
- `tests/export-xml-wellformed.test.ts` (3 tests): failed 3/3 on the unfixed tip (U+0001 in classic SVG, U+000B in the architecture slide), passes 3/3 after the fix. It checks every SVG renderer, every design type, draw.io (also parsed with the repo's XML reader), the manual, and every `.xml` part of the architecture, project and design decks.
- `npx tsc --noEmit`, `npm test`, `npm run build` (counts in the PR).

## Problems hit
- None in code. `validateDocument` returns the document (it throws on failure), not `{ok}`.

## Remaining issues
- `src/export/meetingSummary.ts` (owned by another lane tonight) and `src/export/projectOverview.ts` (HTML, `esc`) are not changed; HTML tolerates these characters better than XML but they would still appear raw there.
- `src/experience/pptx.ts` called on its own (not through `buildDeck`) is not sanitized; inside the project deck it is.
- No visual check of a PPTX in PowerPoint was done for this change (text content only changes for forbidden characters).

## Next steps
- Sanitize `projectOverview.ts` `esc` and the meeting summary escaper the same way (one patch).
- Optionally refuse these characters in the model (`short`/text refine) with a migration for stored documents (dispatch: touches validation and storage).
