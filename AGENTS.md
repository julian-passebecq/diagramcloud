# DiagramCloud contributor and AI editing rules

Start with README.md, docs/ARCHITECTURE.md, docs/RELEASE.md, docs/RESEARCH.md and docs/ROADMAP.md. An agent that uses DiagramCloud (rather than changing it) starts with docs/AI_GUIDE.md; keep it true when commands, formats or figure types change (`tests/ai-guide.test.ts`). Extend this repo; never start a parallel notebook, diagram or portfolio app.

## Documents

`src/core/model.ts` is the contract; every proposed document must pass `validateDocument` (JSON Schema alone is not enough). Keep stable IDs on rename. Preserve sources, synthetic/source-derived labels, visibility flags and image rights. Never present a portfolio number as a verified employer result; never rewrite an unretrieved CV from memory.

Child view: node/edge memberships and positions, then childViewId on a parent node; no recursive drilldown. Code, tables and explanations are evidence blocks; code is never executed. Synthetic data stays labelled.

Observations (`src/core/realization.ts`) enter only through a reviewed `diagramcloud.patch`; never author one directly, mark it reviewed or shareable, or back it with a synthetic block. Keep Planned (node status), Observed (dated external claim) and Presented (selected for the story) distinct.

## Code

Keep the domain independent of React Flow; UI coordinates are never the sole model. Public exports call publicDocument: no private data in HTML comments, SVG metadata, slides, notes or bundled JSON. Escape XML/HTML and script serialization separately; no eval or raw HTML from imported JSON.

Provider icons: record source and version/blob; a repo's MIT license does not cover its logos; never alter Microsoft artwork. No font binaries.

Before proposing a change, run TypeScript, unit tests, production build and browser tests (drilldown with parent kept, rejected imports unchanged, public redaction, storage conflicts, offline HTML export); inspect exported PPTX visually. Use a feature branch; do not overwrite another branch or claim CI passed without reading its result.

## Current limits

Per-module rules and limits: docs/LIMITS.md; read it before touching a module. What shipped: the latest docs/release-*/RELEASE_NOTES.md and docs/product/V3_WORKSPACE.md. Keep tests/r4-crosswalk.test.ts passing; never mark a crosswalk row implemented without its test.
