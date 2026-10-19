# Linked reading of one Project through two SVG viewpoints

Source contribution against DiagramCloud 1.31.0 / edd9f51. This is an explicit offline export, not an App route, new architecture model, renderer, collector or live connection.

`linkedReadingHtml(project, reading, {now})` combines native `designSvg` output and native `publicDocument`. The input is an ordinary validated Project. Both panes use exact node identities in that one public source cut. The small reading configuration specifies chapter IDs and parents, left/right view IDs, native design choices and a native theme. It is export/host configuration, not another stored project or work authority.

Supported: prepared chapter pairs; Light/Dark/Editorial; native SVG exploded/architecture and other design choices when their required data exists; exact linked selection; right selection pin; independent zoom and focus; hierarchy versus browsing history; collapsible explorer/companion/bottom regions; explanation/source/route dock; keyboard component lists. SVG IDs for markers and accessibility references are namespaced without changing canonical data-node-id values. The render-time view root is scoped to the selected pane to avoid pulling the catalogue's parent hierarchy into a local exploded figure. The persisted Project itself is not mutated.

The public-content key binds the native public projection including its displayed revision. It is a change detector, not a signature or access token. Private payload changes at an unchanged public revision do not affect the output. Public revision changes deliberately invalidate the request. Private and absent targets give the same generic refusal. The exporter does not make private inputs public; the real Galaxy client must remain in the normal author-mode import, not forced through this export.

Limits: at most 16 chapter pairs, 10 MiB serialized payload, precompiled native themes. Rich domain interactions are authored, not executed. A native renderer may withhold a specialized figure when evidence is missing. Its clipping/aggregation limits remain; this exporter does not fabricate hidden nodes or alter native geometry. The component list only includes IDs actually rendered. No labels are used to guess correspondence, no cross-project automatic mapping, no synchronized cameras, no independent autoplay, no network collection, no saved-layout store or PM writes.

## Explicit command

After applying under the native owner's scope and using the existing pinned dependencies:

```sh
./node_modules/.bin/tsx scripts/export-linked-reading.ts PROJECT.json READING.json NEW_DIRECTORY
```

Both inputs must be regular UTF-8 files, no symlink path. The Project is bounded at 12 MiB; reading configuration at 64 KiB. The output directory must not exist. Validation/rendering happen before output creation. Existing user content is never overwritten. If a write fails, retain and inspect the new partial directory; do not silently reuse it. No files are published by the command.

An original documentation-derived catalogue is built by `buildTechnicalCatalogue` in `examples/client-atlas/build.ts`: 13 topics, 14 paired chapters, 29 views and 20 primary references. This is an authored Reference client, not automatic discovery, a full technology encyclopaedia or native catalogue-home registration. HNSW node B is one identity at three levels; the query vector is outside indexed planes. Milvus, Neo4j/property graphs, PostgreSQL, medallion, file/table/memory formats, Python 3.15, APIs, events, RAG, trust boundaries, delivery and cloud deployment remain separate questions. Version and source limitations travel with the content.

## Native integration, separate from this export

Use the existing WorkbenchFrame, PerspectiveBar, CompanionPane, routes and source/audience epochs. Expose another read-only rendering slot, not a second selection authority or substitute App. Distinguish same-project perspectives from architecture variants. Exact public/author projection occurs before render; do not change content visibility to make a pane work. Reuse existing persistent Studio layout support deliberately when adding workspace persistence; avoid a third layout store.

The provided Playwright spec follows existing offline-export tests. Pro exercised matching behavior through Python Playwright/system Chromium; the TypeScript spec and full pinned App integration still need native execution. No App/manifest/dependency/CI changes are included. Keep the 1.31.0 tour referenced-content fix and its native regression tests.

The original public technology catalogue can be generated with `tsx scripts/export-linked-reading.ts --catalogue NEW_DIRECTORY`. This creates an ordinary Project, its paired-reading configuration and the native-SVG HTML without fetching sources or installing software. An existing output directory refuses. The catalogue is source-cited teaching content, not a discovered client implementation.
