# DiagramCloud 1.27.0: R4 remainder

A bounded milestone on top of 1.26.1. It closes most of the R4 acceptance rows that 1.26.0 left partial and two inherited R3 features. It is still not a complete V2: every R4 work package, new and inherited acceptance row, with its test or its gap, is in the [R4 crosswalk](../product/R4_CROSSWALK.md). Document schema stays 1; `variants` and `tours` are optional fields, and documents without them validate unchanged.

## What is new

- **Lesson content guards** ([#70](https://github.com/julian-passebecq/diagramcloud/pull/70)). `validateLearningCatalogue` refuses a lesson sentence that ties retrieval or RAG to a weight change, or asserts how the Brain is implemented. A grain check reports an order-line fact joined on a non-unique customer key as double counting (total 35 becomes 70); the temporal join keeps 35. SCION networking and unrelated search results never become a source, card or mapping. Lesson snippets are inert text with no run control.
- **Catalogue lookup through the CLI and MCP** ([#69](https://github.com/julian-passebecq/diagramcloud/pull/69)). One module (`src/intelligence/learning/query.ts`) serves search, a lesson at a depth, prerequisites and public mappings to the UI, the CLI (`catalogue`, `suggest-mapping`) and the local stdio MCP (`diagramcloud_catalogue`, `diagramcloud_propose_mapping`). A mapping suggestion is a proposed `diagramcloud.patch` with one `suggested` mapping; it is never applied, and its origin is set by the calling path.
- **Figure withholding** ([#71](https://github.com/julian-passebecq/diagramcloud/pull/71)). A Sankey without a drawable quantity, a story timeline without public story steps and a sequence without a connection are withheld: SVG, the HTML book and the PPTX deck show what is missing, why, what would supply it and the Architecture fallback. Suggested figures mark them unavailable and rank them after every available figure. A drawn story timeline says it shows presentation order, not timing.
- **Semantic depth and step playback** ([#72](https://github.com/julian-passebecq/diagramcloud/pull/72)). A lesson with a compiled example or an adoption journey has a lesson diagram whose Overview, Mechanism and Detail depths are containment levels from explicit drilldown (at most two levels). Zoom and environment never change depth. Step playback walks declared steps or a declared control chain by button or keyboard, is labelled a presented sequence (not a run, not timing) and records nothing.
- **Variants and tours** ([#73](https://github.com/julian-passebecq/diagramcloud/pull/73)). In Edit mode, a variant is a named change set against a recorded baseline of one view: selecting it compares without changing anything, a changed baseline makes it stale until an explicit Rebase, and Apply is one revision-guarded patch that one Undo reverts. Public copies never carry a variant. A tour stores stops on stable subject IDs with narration; a stale or missing anchor is shown as such when played, never rebound. Public copies keep only public tours and mark omitted stops without naming hidden subjects.
- **Crosswalk.** The inherited R3 and R2 rows that were `unmapped` are now each `implemented`, `partial` or `not implemented` with evidence. A new test checks that the concept preview packet names its own format and is never presented as `datapass.preview/1`.

## Limits

- Lesson guards are keyword checks, not semantic ones: a rephrased conflation can pass them.
- There is no Gantt figure, no story Resume, no run or retry model, no profile-depth model and no Brain format (`contextRefs` is the slot).
- The Suggested figures list in Design preview does not hide unavailable figures; they always rank after available ones.
- Optional external adapters (T3, remote MCP, local model; R4-W7) are not implemented.
- Only Chromium is qualified.

## Qualification

The same commands as [RELEASE.md](../RELEASE.md): `npm run check`, `npm test`, `npm run build`, `npx playwright test`, `npm run qualify`, plus the design-quality test. Results for the exact head, the CI run and the sha256 of the local candidate package are recorded in the release pull request, not here. No tag, public release or deployment claim is made by this page.
