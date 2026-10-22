# Evidence handoff: capability examples (V3 W2)

For the integrator. This records what the two capability examples contain, which source they cite, and what they deliberately leave UNKNOWN. It is not a qualification receipt and certifies nothing.

## Source cut

| Example | Source cut | Recorded in |
|---|---|---|
| DiagramCloud self-description | `github.com/julian-passebecq/diagramcloud` at the revision in `diagramcloud-self.anchors.json` `sourceCut` (first `ecf4af6f45816a62c456a7ebd9aa8f108aae5452`, main, "V3 foundation (W0 + W5)"; re-cut on 2026-10-22 when the README was rewritten and its cited lines moved verbatim to `README_HISTORY_20261021.md`) | guide `sourceCut`, `diagramcloud-self.anchors.json` `sourceCut`, and every source `url` (`blob/<sha>/<path>#L<line>`) |
| Synthetic question-answering service | No product revision: the cited file is the synthetic specification added with this change | guide `sourceCut` says so in words |

Every source `location` is `path:line`. The paired `*.anchors.json` gives the exact text expected on that line; `tests/v3-capabilities.test.ts` re-reads the file and refuses a citation whose line no longer holds it. The cited files were read at the source cut; this change adds files only and edits none of them.

## What exists

| File | Role |
|---|---|
| `tests/fixtures/v3-capabilities/diagramcloud-self.guide.json` | Capability guide input: 15 capabilities, 8 technologies, 57 cited sources (README, AI guide, third-party notices, licence, CI workflow, CLI and MCP scripts, core and export modules) |
| `tests/fixtures/v3-capabilities/synthetic-rag.guide.json` | Capability guide input: 4 capabilities (ingest, ask, plan, evaluate), 3 unchosen technologies, 19 sources, all in the synthetic specification |
| `tests/fixtures/v3-capabilities/*.anchors.json` | Expected anchor text per source and the source cut |
| `examples/v3-capabilities/synthetic-rag/SPEC.md` | The invented specification the synthetic guide cites; labelled SYNTHETIC on its first lines |
| `examples/v3-capabilities/*.project.json` | Ordinary Project documents compiled from the guides (`build.ts`); regenerate with `write.ts` |
| `tests/v3-capabilities.test.ts` | Guide validation, citation existence and anchors, compiled equality, `validateDocument`, no observation or review, UNKNOWN for unsupplied detail, public projection, synthetic labels, no private names or local paths |

DiagramCloud capabilities covered, each with how-to-use, implementation and limits cited: one validated document and the three modes; public projection; observations only through reviewed patches; repository scan (CLI and browser); multi-repository atlas; draw.io / Mermaid / Visio import; public exports (HTML, SVG, Mermaid, draw.io, PowerPoint, technical manual); Diagram Design figures and their origin; the local intelligence CLI; the stdio MCP and four of its tools; proposal validation; the read-only React viewer and host negotiation; deterministic layout; capability guides themselves; local and CI checks.

Interfaces named: browser studio, JSON file and JSON patch, CLI, MCP, React module, exports, CI, TypeScript module.

Origins: MIT licence of the original source, upstream licences of the runtime libraries, the diagram-design visual grammar (attributed, no code copied), the pinned tree-sitter runtime.

## What remains UNKNOWN

- **Runtime and verification.** No capability supplies a `runtime` state, so the scope table reads "UNKNOWN - not supplied". The only `verification` state is "Checks declared in CI" scoped to the workflow definition, not a run result. No test run, CI result or deployment is claimed.
- **Versions of libraries.** Only `web-tree-sitter` 0.25.10 is cited; the other technologies read "version UNKNOWN" because `package.json` is not cited (it changes at every release).
- **Distribution.** Only the static web build is stated; hosting, packages and the VS Code host are not covered.
- **Economics.** No cost section in either example.
- **Coverage.** The self-description is a selection, not an inventory: features such as saved contexts, tours, variants, decisions, evidence forms, learning catalogue, concept previews and host packaging are not described. Absence here is not absence in the product.
- **Synthetic example.** Model, embedding model, vector index, hosting, latency, cost and accuracy are not chosen and stay UNKNOWN; its tool-call limit is a design rule, not a measurement.

## Boundaries kept

No observation, review, mapping, delivery claim or approval is created (`compileCapabilityGuide` creates none; the test checks it). Node status stays `idle` (designed, not observed). The synthetic example has every block `provenance: "synthetic"`, a `synthetic` tag on the project and every node, and a SYNTHETIC project provenance. All sources are public; `publicDocument` keeps the guide and drops the private source-cut context block. No version bump, release notes or AGENTS.md change.

## For the integrator

- If a cited file moves before integration, the test names the source; update its `location` line and `url`, or re-cut all citations at the new head and record that SHA.
- The examples are not added to the in-app gallery; adding them is an App change outside this fileset.
