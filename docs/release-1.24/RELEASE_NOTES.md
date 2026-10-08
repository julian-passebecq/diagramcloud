# DiagramCloud 1.24.0 — Project Intelligence

New analysis opens Repository, Guided and Hybrid inputs without a model account. Every candidate uses the existing validation, stable-ID preview, revision guard and local persistence. Explore, Edit, Portfolio, Present, sidecars and the existing export paths remain available.

## Usable journeys

- Repository: inspect one selected local folder with Quick or Standard. Unknown languages, documentation-only and empty inputs produce an honest inventory instead of invented architecture. Overview, Structure, Relationships (including an explicit absence) and Evidence / gaps are accessible from the canvas toolbar.
- Guided: paste/import a ProjectBrief or enter title, stable project ID, purpose and workstreams. Declared tasks have inert evidence workspaces. Parent architecture remains visible while navigating child views. Reimport adds explicitly identified content and preserves existing author text, layout, visibility, evidence and story.
- Hybrid: a brief or manifest declares membership and relationships. Logical scope bindings remain distinct from repositories. Rescan available members individually in Project atlas; unavailable members remain declared/unscanned. Each repository keeps its own revision, with no single project SHA. Refresh preserves authored presentation and attachments; old scan components absent from the new selected scope remain explicitly uncertain.
- Documents: selected safe Markdown headings/relative links and CSV records/source_ids retain exact lines. Broken, ambiguous and omitted references remain diagnostics. No prose is promoted to an architecture decision and no locator is fetched.
- Publication: Business overview shows supplied purpose, up to five components, stated roles, provenance and caveats. Its public semantic HTML is offline. Public JSON, interactive HTML and diagram/deck exports still use publicDocument. Captions and evidence citing a private source are omitted before rendering; publication requires the author's visibility/source review.
- Graphics: the optional Assets context provides registry resolution, generic fallbacks and JSON/CSV checklists without downloads, generated branding, provider tokens or uploads.

Project / Repositories / Views are one filtered navigation tree at a time. Evidence / Gaps / Assets is optional on the right; narrow layouts show one side panel at a time. Existing back/forward, canvas and minimap remain. Manual assistance copies/downloads scoped context and imports reviewed proposals; it is not an executor.

## Limits

Quick admits at most 200 files, 64 KiB each and 4 MiB total. Standard admits at most 1,500 files, 256 KiB each and 16 MiB total. Markdown/CSV retain the tighter 200-file, 128 KiB/file, 8 MiB document limits. Paths are sorted before truncation; exclusions and safety filtering precede reads. Analysis yields between reads, reports progress and supports cancellation. Inventories and document maps are bounded private evidence and survive normal save/reload.

The content digest identifies inspected bytes, separately from a readable Git HEAD hint. Dirty state is unknown; this is not a clean-worktree or runtime attestation. A browser picker can omit Git metadata, so unknown revision is normal. Repository identity is based on selected folder name; similarly named independent roots should use explicit Hybrid repository IDs. Reanalysis retains existing author/component text and evidence while replacing the selected inventory/document context; it is not an automatic destructive graph synchronization. Hybrid refresh rejects conflicting edge identity rather than silently rewiring an authored relationship. Missing prior scan components never prove removal.

Supported static adapters remain the existing scanner plus Markdown/CSV. No universal language/AST resolver, implicit cross-repository joins, remote fetching, live deployments, model/provider service, R2, database, new framework or other-repository writes were added. Only Chromium is qualified. ProjectBrief is an input compiler, not another persisted model; generated facts remain private until review. Observation review/shareability remains the human author's decision.

## Qualification and delivery

The release candidate is qualified by the existing exact-head CI for [PR #56](https://github.com/julian-passebecq/diagramcloud/pull/56): TypeScript, unit/contract tests, generated production build and Chromium, with receipt and source/build package. The tag/release artifacts carry the commit and SHA256 package checksum. The deployment status and smoke result are recorded separately in the release result; CI success alone is not deployment evidence.

Three new synthetic Chromium scenarios cover the journeys above, including reimport preservation, Hybrid rescan, saved document inventory, private sentinel filtering, asset downloads, narrow layout and offline public overview. Focused unit checks cover acquisition budgets/safety/cancellation, document diagnostics, reimport/refresh and public source filtering. Existing qualification continues to cover storage faults, rejected imports, parent-retaining drilldown and offline interactive HTML. Local visual checks inspect source, Guided, Hybrid and public HTML; a real local DiagramCloud atlas passes design-quality without committing its snapshot.
