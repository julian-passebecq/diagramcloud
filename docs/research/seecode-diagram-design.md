# SeeCode and diagram-design as donors for DiagramCloud (researched 2026-10-06)

Sources: https://github.com/Aryanutkarsh/SeeCode and https://github.com/cathrynlavery/diagram-design (README pages, via WebFetch summary; not cloned, no code read). Anything marked "unknown" was not stated on the pages.

Both are agent "skills" (instructions plus scripts for Claude Code, Codex, Copilot), not libraries. The search found no npm package for either.

| | SeeCode | diagram-design |
|---|---|---|
| URL | github.com/Aryanutkarsh/SeeCode | github.com/cathrynlavery/diagram-design |
| License | MIT. Font and icon terms: unknown | MIT. Fonts: Instrument Serif, Geist, Geist Mono (licenses not stated on the page; check before bundling). Icons: Tabler (MIT), Simple Icons (CC0) |
| Input | Short JSON spec, plus imports of Mermaid, DOT, PlantUML, D2, draw.io, Excalidraw, Structurizr DSL, BPMN, SQL, OpenAPI | Natural-language request through an agent; imports of draw.io, Mermaid, Excalidraw |
| Output | Interactive animated HTML, SVG, PNG, JPEG, GIF, MP4 | Self-contained static HTML + SVG, PNG, optional JSON block registry |
| Offline | Not by default. Fonts come from Google Fonts and the GIF/MP4 encoders from jsDelivr. This breaks the "no CDN" profile unless patched | Yes by default: no JS and no external assets. Google Fonts loads only with the `--fonts` flag. PNG export needs Playwright + Chromium |
| Executes code or commands | Runs as an agent skill, needs Node 20+; installed with `npx skills add`. Whether the HTML runs scripts: unknown (it is interactive, so very likely yes) | Runs as an agent skill; uses Python scripts for extraction and validation. Output has no JS |
| Node IDs in output | Not documented | `data-block-id` and `data-block-parent` (block registry mode) |
| Architecture and sequence | Yes (42 types) | Yes, including an architecture-delta variant and sequence with ALT fragments (42 types) |
| Activity | 7 stars, 13 commits (very young) | About 44k stars, 257 commits, "recent". The star count looks implausibly high and was not verified |

## Verdicts
- **SeeCode: reject as a renderer.** It is a tiny project with a CDN dependency, interactive scripted output, and no documented ID preservation. At most, borrow ideas for animation and tracing.
- **diagram-design: use as visual grammar only.** The static, no-JS, SVG-first output and the `data-block-id` idea fit our offline exports. It is an agent skill, not an embeddable TypeScript renderer, so adopt its layout and style conventions and the ID attributes. Do not depend on its code. Check the font licenses before bundling Geist or Instrument Serif. DiagramCloud already has its own export scene; keep it.

## Rejected candidates
- Cocoon-AI/architecture-diagram-generator: a Claude skill that outputs a dark-themed standalone HTML/SVG file. It is not the named project.
- davidje13/SequenceDiagram, swark-io/swark, AleksandarDev/vscode-sequence-diagrams: unrelated names from the same search.

## Caveat
Next step before any reuse: clone both repos and check their LICENSE files, font files and the HTML output for script tags. These findings come from README summaries only.
