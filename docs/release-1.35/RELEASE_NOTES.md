# DiagramCloud 1.35.0: interactive lesson figures, CLI/MCP input limits and post-1.34 polish

**Source release only.** This page describes source merged on `main` after 1.34.0. No package, deployment, tag, Marketplace publication or installed-host result is claimed here; the last recorded private package is still `diagramcloud/1.33.1-0892f9d` in `outcome.json` `privatePackages`. Document schema stays 1. No new runtime dependency.

Each PR keeps its own exact-head evidence. Prepared on 5 November 2026 before any of the lanes below had a pull request: every entry is **PENDING** until its PR is merged, then the finalizer replaces the PENDING tag with the PR number, its tests and its limits as the merged PR body states them, or deletes the entry.

**Version rule for the finalizer.** 1.35.0 only if lesson-figure-interaction merges (a feature). If it does not, rename this folder to `docs/release-1.34/RELEASE_NOTES-1.34.1.md` (patch), delete the lesson-figure entry and switch every 1.35.0 mention (package.json/lock, AGENTS.md header and paragraph, README, RESUME, ROADMAP, RELEASE, V3_WORKSPACE) to 1.34.1.

## Merged

- **PENDING (lane post-1-34-polish, no PR yet) — post-1.34 polish.** The export menu entry reads "Meeting summary" (HTML, print PDF and PPTX) instead of "Meeting summary (HTML)"; the design-profile meeting summary prints the public omission notice once per view page instead of twice; the quota-focus browser test is stabilised. Tests: to be copied from the merged PR. Limits: to be copied from the merged PR.
- **PENDING (lane cli-mcp-input-limits, no PR yet) — CLI and MCP input limits.** The CLI and the local MCP refuse an over-limit input with the same limits as the App (12 MiB for JSON, SVG, draw.io XML and Mermaid; 16 MiB for Visio and draw.io PNG; before the input is read), with a reason and no output written. Tests: to be copied from the merged PR. Limits: to be copied from the merged PR.
- **PENDING (lane lesson-figure-interaction, no PR yet; decides 1.35.0) — interactive lesson figures.** The components of a spatial lesson figure (`src/ui/LessonDiagramFigure.tsx`) are focusable and selectable with pointer and keyboard, and selection is the same one the list alternative shows; an optional drill in/out follows explicit `childViewId` drilldown only. Frames, the public projection and reduced motion are unchanged from 1.34.0. Tests: to be copied from the merged PR. Limits: to be copied from the merged PR (state whether drill in/out shipped).
- **PENDING (lane fix-wave4-findings, only if it exists; `gh pr list --state all --search fix-wave4-findings` returned nothing on 5 November 2026) — wave-4 findings.** Delete this entry if no such PR merges.

## Limits kept

- Chromium is the only qualified browser. Installed VS Code/Cursor hosts, update/rollback, signing and Marketplace are not re-run for 1.35.0.
- No token forecast, queue, calendar or dispatch model; supplied usage and effort stay arithmetic over supplied inputs.
- Cross-project correspondence in linked views, separate browser windows and free docking trees are not built.
- No tag, public release, private package or deployment is claimed by this page.

## Qualification

The release branch runs `npm run check` and `npm test`; the release pull request records the exact-head CI run (unit, CLI/MCP bundles, build, full Chromium `test:e2e`, Linux packaging dry run). A private package, if one is made, is recorded separately in `outcome.json` `privatePackages` after merge.
