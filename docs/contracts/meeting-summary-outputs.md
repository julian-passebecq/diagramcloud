# Meeting summary outputs: HTML, browser-print PDF, PPTX

One `diagramcloud.publication-brief/1` (see [review-workspace](review-workspace.md)) produces three formats from one shared public model. The App entry point stays **Export & share > Meeting summary** (`src/ui/MeetingSummaryDialog.tsx`, props unchanged: `{project, activeViewId, onDone, onCancel}`); the form adds a **Format** choice (Web page (HTML), PDF: browser print on the chosen paper, PowerPoint: editable shapes, text and tables). HTML stays the default.

## Shared public model

`meetingSummaryModel(Project, PublicationBrief)` (`src/export/meetingSummary.ts`) is the only reader of the project for every format. It applies the overview projection (`publicDocument` plus suppression of public captions backed by private sources), validates the brief against it and returns the selected views, their components, the attached public evidence blocks, the cited public sources, up to six highlights, the selected story stops and, per view, whether the view exceeds the readable summary budget. Refusals are the same for every format and change nothing: more than six views, a profile other than design or business, a duplicate, a story stop outside the selected views, and a private or unknown view ID, which both get "Publication references an unavailable public view".

## HTML and PDF

`meetingSummaryHtml` / `meetingSummaryFile` are unchanged in output (offline, Content-Security-Policy `default-src 'none'`, no script). The PDF is that page printed by the browser: `@page{size:A4}` or `@page{size:letter}` from the brief's paper, one page break before each selected view and before the evidence section. The PDF format in the dialog prints the summary from a sandboxed, script-free frame (`sandbox="allow-same-origin allow-modals"`, `srcdoc` = the summary HTML) and removes the frame after `afterprint`; the person chooses Save as PDF in the browser's own dialog. Nothing is uploaded and no PDF library is bundled.

Print qualification (`tests/e2e/meeting-summary.spec.ts`): Chromium `page.pdf({preferCSSPageSize:true})` of the summary gives an A4 (595 x 842 pt) or Letter (612 x 792 pt) media box per the brief, at least five pages for three views at standard detail, the same page count on a second print, the brief title as PDF title, and printed text (read from the PDF's ToUnicode maps) that contains the title, every selected view title, the synthetic label, the join rules and "Sources and limits", and never a private component label. The App journey prints the Letter copy from the dialog and checks the same.

## PPTX

`buildMeetingSummaryDeck(PptxGenJS, Project, PublicationBrief, {icons?})` (`src/export/meetingSummaryPptx.ts`) returns `{pptx, slides, plan}`; `downloadMeetingSummaryPptx` writes `<project id>.meeting-summary.pptx` in the browser. `planMeetingSummaryDeck(model)` computes the slide list before anything is drawn, so the slide count and internal links are deterministic:

| Slide | When | Content |
|---|---|---|
| Cover | always | "DIAGRAMCLOUD / MEETING SUMMARY / READ-ONLY PUBLIC CUT", title, audience, project ID, revision, question and scope (summary and provenance) |
| Contents | always | the summary glossary: one linked row per selected view and one for Sources and limits |
| Prepared talking points | story stops selected | three stops per slide |
| Key findings and decisions | always | up to six highlights, then the "Reading this brief" limits |
| View | per view | design profile and readable: native editable figure from `addArchitectureSlides` (shapes, text, routed connectors; no picture). Business profile: "text and tables, no graph". Dense view: the same fallback sentence as the HTML |
| Components | per view, unless overview detail with a readable figure (same rule as the HTML grid) | six components per slide: meaning, source basis and design status ("not runtime evidence"), evidence titles with their slide number |
| Evidence | standard and full detail | per block, 12 table rows or 18 text / 23 code lines per slide; every slide of a synthetic block shows "Synthetic example data, not a measured result."; image blocks keep the HTML's "pixels are not embedded" sentence |
| Sources and limits | always | eight cited public sources per slide, the publication limits and the fidelity note |

A deck above 120 slides is refused before drawing. The figure is drawn from a copy of the public projection holding only that view and the summary's own sources, with drilldown links removed from the boxes (the Contents slide links every selected view). Vendor artwork is not loaded by the dialog: generic symbols are used, as in other semantic exports. Speaker notes carry only text already on the public model.

## Fidelity note

Shown in the dialog (`MEETING_SUMMARY_FIDELITY_NOTE`): browser print gives the PDF on A4 or Letter from the summary print stylesheet; the PDF is a snapshot, not a backup; the PPTX is editable native shapes, text and tables from the same public brief, with no live panes or animation, and not a backup either. The Project JSON stays the editable model.

## Tests

`tests/meeting-summary-pptx.test.ts` (slide count follows the plan and is stable; same views, glossary links, sources and limits as the HTML; native shapes, no picture; synthetic label on every synthetic evidence slide; no private node, view, block, source, caption, story or private-notes text in any zip part for both profiles; seven views and private/unknown views refused with the HTML reasons; slide limit), `tests/meeting-summary.test.ts` (dialog format choice and fidelity note), `tests/e2e/meeting-summary.spec.ts` (A4 and Letter PDF; PPTX download and Letter print from the real App at 1440 and 390, offline).

## Limits

The App's export menu button reads "Meeting summary (HTML, PDF, PowerPoint)" (since the post-1.34 polish lane). PDF output is whatever the person's browser prints; only Chromium is qualified, and a person reading a printed copy is not recorded. The PPTX was checked as a ZIP and by its XML, not opened in PowerPoint and inspected visually. No PDF or PPTX is produced by the CLI or MCP.
