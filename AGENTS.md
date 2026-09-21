# DiagramCloud contributor and AI editing rules

Start with README.md, docs/ARCHITECTURE.md, docs/RESEARCH.md and docs/ROADMAP.md. Continue the existing `julian-passebecq/diagramcloud` implementation. Do not create another notebook, diagram or portfolio app in parallel.

## Documents

Use `src/core/model.ts` as the canonical contract and the generated `public/diagramcloud.schema.json` for structural guidance. Every proposed document must pass `validateDocument`; JSON Schema alone is insufficient. Keep stable IDs when renaming labels. Preserve referenced sources, synthetic/source-derived distinctions, visibility flags and image rights. Never infer that a portfolio number is a verified employer result. Do not rewrite an unretrieved CV from memory.

Add a child view by creating its node/edge memberships and positions, then assigning childViewId to a parent node. No recursive drilldown. Attach code, tables and explanations as evidence blocks; code is not executed. Synthetic data must stay labelled. Add useful input/output examples and explain the contribution, constraint or decision, rather than duplicating a vendor product description.

## Code

Keep the domain independent of React Flow. UI coordinates must not become the sole model. Public exports must call publicDocument; do not ship hidden private data in HTML comments, SVG metadata, slides, notes or bundled JSON. Authoring JSON is the explicit full backup path. Escape XML/HTML and script serialization separately. No eval or raw HTML from imported JSON.

Provider icons have their own terms. Record source and version/blob identity; never assume a repository's MIT license covers its logos. Do not crop, rotate, recolor or distort Microsoft artwork. No font binaries in source or delivery archives.

Before proposing a completed change, run TypeScript, unit tests, production build and browser tests. Test drilldown with the parent retained, rejected imports without mutation, public redaction, storage failures/conflicts and exported HTML without a network. Inspect exported PPTX visually as well as checking that it is a valid ZIP. Use a feature branch; do not overwrite another branch or assert that CI passed without reading its result.

## Next pass

Prioritize a measured shared export scene, orthogonal routing, icon registry, save/recovery tests, AI change preview, JSON Patch revision guards and a visual story composer. The current layout button is a grid, not a graph auto-layout engine. No full draw.io/Visio/Mermaid import has been implemented. Keep these limitations explicit until corresponding code and tests exist.
