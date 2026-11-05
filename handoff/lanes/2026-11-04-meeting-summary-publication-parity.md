# Lane report: meeting-summary-publication-parity (P1, 1.34.0 overnight plan)

Branch `feat/diagramcloud-meeting-summary-publication-parity`, based on `5da1806` (#133-#135 stack tip).

## What changed

- `src/export/meetingSummary.ts`: `meetingSummaryModel(project, brief)` is the one shared public model (overview projection, brief validation, selected views, components, public blocks, cited sources, highlights, story stops, per-view density). `meetingSummaryHtml` reads it; its output is unchanged. New `MEETING_SUMMARY_FORMATS` and a fidelity note that names the PDF (browser print, A4/Letter) and the PPTX (editable shapes, text and tables), both not backups.
- New `src/export/meetingSummaryPptx.ts`: `planMeetingSummaryDeck` (deterministic slide list, 120-slide limit), `buildMeetingSummaryDeck` (pptxgenjs; cover, linked contents, talking points, findings with reading limits, per-view native figure through `addArchitectureSlides` or the business/dense fallback, component tables, evidence slides with the synthetic label on every slide, sources and limits), `downloadMeetingSummaryPptx` (`<project id>.meeting-summary.pptx`).
- `src/ui/MeetingSummaryDialog.tsx`: Format choice (HTML default, PDF via browser print from a sandboxed script-free frame removed after `afterprint`, PowerPoint). Props unchanged, so `App.tsx` is untouched.
- Docs: new `docs/contracts/meeting-summary-outputs.md`; one-sentence truth fixes in `docs/AI_GUIDE.md`, `docs/contracts/review-workspace.md` and `docs/contracts/ai-reading-inputs.md`, which said "no PPTX" (AGENTS.md requires AI_GUIDE to stay true when formats change).

## How verified

- `npx tsc --noEmit` clean; `npm run build` green.
- Unit: `tests/meeting-summary-pptx.test.ts` (6, new) and `tests/meeting-summary.test.ts` (21, dialog test updated) pass.
- Browser: `tests/e2e/meeting-summary.spec.ts` 7/7 (A4 and Letter `page.pdf` with media box, page count, stable count and text read from the PDF's ToUnicode maps; PPTX download and Letter print from the real App at 1440 and 390, offline, private label absent everywhere).
- PPTX inspected visually: slides rendered to PNG with local PowerPoint (COM export); table rows were then reduced to five per slide and hard line breaks removed from cells after the first render showed a table touching the footer.

## Problems hit

- Headless Chromium completes `print()` at once and fires `afterprint`, so the print frame is gone before a locator sees it; the e2e test records the frame with a MutationObserver instead.
- `addArchitectureSlides` assumes the root view is in the deck; the figure copy sets `rootViewId` to the drawn view, and drops box drilldown links (Contents links every view instead).
- The PC ran at 100 % CPU (parallel lanes): some Playwright web servers timed out at startup and two spawn-based unit tests timed out in the full run; both pass alone.

## Remaining issues

- The export-menu button in `src/App.tsx` still reads "Meeting summary (HTML)" and its description says "print to PDF from the browser" (one patch, for the App.tsx owner P7: rename to "Meeting summary (HTML / PDF / PowerPoint)").
- Pre-existing failures, unrelated files: `tests/adoption-journeys.test.ts` (`.github/workflows/ci.yml:43` anchor) and `tests/release-entry-docs.test.ts` (README `#exports-and-fidelity` anchor).
- Figure boxes in the PPTX say "Component" instead of "Open subdiagram" for navigation nodes, because drilldown links are dropped (one patch: an optional slide map in `ArchitectureParts`, which needs an edit to `src/export/pptx.ts`).
- No CLI/MCP command produces the PDF or PPTX; a person reading a printed PDF is not recorded.

## Next steps

- One patch: App export-menu label (P7 or P8).
- One patch: drilldown links between selected views inside the PPTX figures.
- Release notes (P8): close the UX38 "no PPTX" gap and the roadmap "meeting-summary PDF/PPTX" item.
