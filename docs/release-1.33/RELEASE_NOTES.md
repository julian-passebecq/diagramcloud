# DiagramCloud 1.33.0: learning, ideas, orientation and recovery

A minor release on top of [1.32.0](../release-1.32/RELEASE_NOTES.md). Document schema stays 1 and the model is unchanged. 1.33.0 contains the saved-context follow-up (#113), the learning, ideas and orientation contribution (#115) and a storage-recovery and reading-repair pass from a ChatGPT Pro source contribution. The status of each acceptance row, with the test behind it, is in [V3_WORKSPACE](../product/V3_WORKSPACE.md) (UX39-UX46). The boundaries are in AGENTS.md, "Current limits (1.33.0)".

## What changed

- **Saved contexts restore the linked-views pair (#113).** Left and right view IDs, anchor and detail placement are restored in the V3 workspace; a lost side closes the pair with the generic reason.
- **Interview practice (UX39).** 16 rounds of 4 original questions (64) with fictional contexts: local drafts, optional hints, reference reveal and self-review. Nothing is scored, executed or sent.
- **Idea portfolios (UX42-UX44).** A `diagramcloud.ideation-brief/1` file in JSON / AI compiles to an ordinary Project staged in the import review. Brainstorm read mode (author audience) offers cards, a comparison matrix and a consideration board over stable idea IDs.
- **"Where am I?" wayfinder (UX40).** Two explicit levels or a route list, with the chosen parent kept. It now marks the current route by its full path, not by view ID, so a view shared under two parents shows the right one.
- **Phase strip and task links (UX41, UX46).** Supplied phases are shown (phase 0 is not "missing"). Delivery task links match a PM snapshot by exact bytes and scope, never by title.
- **Brainstorm keyboard repairs (UX43).** Focus returns to a sensible control when Focus, Back, Scope or Unpin remove the activated one. Choosing Cards, Matrix or Board leaves focused-idea mode.
- **Storage recovery (UX45).** Failed saves are tracked per project. A local-save notice (`src/ui/LocalSaveNotice.tsx`) offers a backup of that project. Edits made before storage opens are protected and the open is retried. An external deletion of a loaded project is a conflict, never silently recreated. A malformed foreign row is replaced only after explicit adoption. Quarantine recovery is acknowledged per project. A backup download failure gives a generic, actionable message and never counts as a save.
- **Release journeys.** `tests/e2e/learning-release-recovery.spec.ts` runs three cases at 1440 and 390: "Beacon saved copy and its chosen shared parent survive real reload and reopen", "brainstorm focus, return and view switching keep keyboard location and source unchanged" and "private brainstorming pins and searches do not survive the public audience or its exported file". `tests/e2e/storage-multi-project.spec.ts` covers multi-project failures. At 390 the Beacon spec returns to the View pane before opening the wayfinder.
- **New unit tests.** `local-save-notice`, `save-queue-projects`, `storage-open-retry`, `storage-recovery-contract` and `workspace-startup-conflicts`.

## Limits

- Interview references ship in the client bundle. Hiding them is a learning aid, not secure delivery.
- Idea briefs have no CLI or MCP command; they enter through the App import only.
- Storage recovery is qualified in Chromium only. Multiple real tabs are covered only by `tests/e2e/storage-multi-project.spec.ts`.
- The installed VS Code / Cursor hosts and PPTX were not re-run.
- UX46 stays partial: the private candidate is recorded after merge in `outcome.json`.
- No FOIL tool, portfolio site or cloud resource was built. The FOIL discussion is sample content kept outside the repository.

## Qualification

The release branch ran `npx tsc --noEmit`, `npm test`, `npm run build` and the full `npx playwright test`; the pull request records the counts for its exact head and the CI run. This page makes no claim about a tag, a public release or a deployment.
