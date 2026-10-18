# DiagramCloud 1.29.1: uncounted public omissions and a steady concept-host watch

A patch release on top of [1.29.0](RELEASE_NOTES.md). Document schema stays 1 and the model is unchanged. V2 is still not complete: the [R4 crosswalk](../product/R4_CROSSWALK.md) says which rows moved.

## What changed

- **Public omissions are no longer counted** ([#100](https://github.com/julian-passebecq/diagramcloud/pull/100), AC25 now implemented). When a view has private cards or connections, every public format that reads the view's omission list prints one sentence, `PUBLIC_OMISSION_NOTICE` in `src/core/viewspec.ts`: "Some private or unreachable content is not shown." The Technical Manual cover no longer counts private views and the story timeline no longer counts steps on private views; it still counts public steps beyond its 12-step limit, since those are public facts. Author output is unchanged. `tests/public-omission-counts.test.ts` renders about 30 public formats for every sample (figures, manual, book, HTML, draw.io, AtlasNote, concept, MCP tools, React viewer) and checks that 1 and 5 private items give byte-identical output.
- **Watched concept host** ([#99](https://github.com/julian-passebecq/diagramcloud/pull/99)). `scripts/concept-host.ts` records the document's size and modification time synchronously before its first read and polls with its own timer instead of `watchFile`, so a save made right after start is regenerated (at worst the same content once). `runConceptHost(args,{watch:true})` returns `ready` and `nextRegeneration()`, and the test waits on those instead of timers. This replaces the 1.29.0 integration note about letting the file watcher take its first reading.

## Limits

- The public notice still says whether a view has private content (present or absent), as tour stops already do.
- The binary PPTX exports (`exportPptx`, the Diagram Design deck) are not byte-compared; the deck places figures that the test does compare. Completion-kit omission counts are unchanged.
- A save that leaves both size and modification time unchanged is still not detected by the watched concept host.
- Everything listed under Limits in the [1.29.0 notes](RELEASE_NOTES.md) still applies, except the open AC25 omission-count question. Only Chromium is qualified.

## Qualification

The commands in [RELEASE.md](../RELEASE.md): `npm run check`, `npm test`, `npm run build`, `npm run test:e2e`, and the real-local-atlas design-quality gate. The integration pull request records the results for the exact head, the CI run and the sha256 of the local candidate package. This page makes no claim about a tag, a public release or a deployment.
