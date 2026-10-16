# DiagramCloud 1.26.0: learning milestone

A bounded milestone on top of 1.25.0 and V2 (#62). It is not a complete V2: the original acceptance IDs remain open where they are not satisfied. Every R4 work package and acceptance row, with its test or its gap, is in the [R4 crosswalk](../product/R4_CROSSWALK.md). Document schema stays 1; every addition is optional, and documents without it validate unchanged.

## What is new

- **Learning catalogue** ([#63](https://github.com/julian-passebecq/diagramcloud/pull/63)). Typed entries (concept, pattern, procedure, technology, case study, view recipe) next to the unchanged legacy patterns and recipes. Twelve authored lessons with Overview / Mechanism / Detail depths, alternatives, failure modes, sources, interview questions with a Reveal button and labelled synthetic examples (warehouse, RAG, agents) that download as JSON for the normal import review. Opens without Git, cloud or AI.
- **Choices and the JSON drawer** ([#64](https://github.com/julian-passebecq/diagramcloud/pull/64)). Optional choices on components and views (candidate or accepted, never a numeric score), validated and redacted. In Edit mode, a JSON drawer edits the whole project or one component by stable ID; Apply is one revision and one Undo, and a stale or invalid draft changes nothing.
- **Concept to instance navigation** ([#65](https://github.com/julian-passebecq/diagramcloud/pull/65)). Optional `learningMappings` pin a lesson revision to an exact component or view with cited evidence. A name match is only a candidate; review is a person's act in Edit mode; a changed target or lesson makes the mapping stale and it is never rebound. "In my project" opens the exact instance and "Back to lesson" returns to the same lesson, depth and revision.
- **Adoption journeys** ([#66](https://github.com/julian-passebecq/diagramcloud/pull/66)). Three built-in projects: DiagramCloud describing itself (every component cites a file:line of this repository), a Galaxy agent process (procedure, synthetic attempt, lesson and live process kept apart) and a synthetic FOIL local/environment slice. A "What is missing to explain this?" section names missing timing, quantities and mappings.

## Limits

- The catalogue is reached through Business overview, which shows the default sample project; there is no CLI or MCP catalogue lookup, and no AI tool proposes mappings yet.
- Gaps are reported, not enforced: Diagram Design still draws a Sankey or timeline when explicitly asked.
- Variants (R3-02), tours, step playback, a Gantt figure and the optional external adapters (R4-W7) are not implemented.
- Switching project while an edited draft is open is implemented but has no browser test; only component choices are shown in the Inspector.
- Only Chromium is qualified.

## Qualification

The same commands as [RELEASE.md](../RELEASE.md): `npm run check`, `npm test`, `npm run build`, `npx playwright test`, plus the design-quality test against a local real atlas that is never committed. Results for the exact head, the CI run and the sha256 of the candidate package are recorded in the release pull request, not here. No tag, public release or deployment claim is made by this page.
