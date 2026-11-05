# Lane: meeting-summary-omission-notice (2026-11-05)

## What changed
- `src/export/design/context.ts`: `DesignOptions.omissionBase?: Project`. A renderer given an already-redacted copy is told which authoring document it came from; when that base view holds more members than the public view, the context's ViewSpec gets the one uncounted `PUBLIC_OMISSION_NOTICE`. Nothing is drawn from the base (view membership sizes only). New helper `viewHasOmissions(view, base)`.
- `src/export/meetingSummary.ts`: the shared model gains `omitted: Record<viewId, boolean>` computed against the validated authoring document. The HTML (and so the browser-print PDF) prints the notice on each affected view page, in every profile (design, business, dense), and the design figure gets `omissionBase`.
- `src/export/meetingSummaryPptx.ts`: the view slide subtitle carries the notice (figure slides through the drawn view's description, text slides directly). `src/export/pptx.ts` untouched.
- `src/export/linkedReadingHtml.ts`: native figures get `omissionBase: input`.
- `tests/public-omission-counts.test.ts`: new test over every sample: meeting HTML and PPTX (design and business) and linked reading are byte-identical for 1 and 5 private items, include the notice, count nothing, leak nothing, and print no notice when nothing is hidden.

## How verified
- `npm run check` (tsc) green.
- `npx tsx --test tests/public-omission-counts.test.ts`: 3/3.
- `npx tsx --test` meeting-summary, meeting-summary-pptx, linked-reading, domain-correspondence, design-quality, v3-capabilities, adoption-journeys: 136/136.
- `npm run build` green.
- Playwright (`DIAGRAMCLOUD_E2E_PORT=26730`) meeting-summary, v3-meeting, linked-reading-export specs: 14/14.

## Problems hit
- Waited about 2 h 20 for PR #143 (meeting summary PDF/PPTX) to merge before branching.

## Remaining issues
- In the design-profile HTML the notice appears twice on a page: once as a view-page paragraph and once in the figure footer (the footer matches `designSvg(input)`). Deliberate; collapse if it reads as noise. One patch.
- PPTX was compared by slide and notes XML only (document properties carry the write time); not inspected visually in PowerPoint. The subtitle may wrap to two lines when a view has a long description (caption is clipped at two lines). One patch, if seen.

## Next steps
- Visual check of a meeting deck with a private member in PowerPoint (export to PNG). One patch.
