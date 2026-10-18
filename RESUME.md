# Now / Next (2026-10-18, V3 integration in progress on 1.29.1)

**Now.** V3 integration is in progress. W0 (adopt) lands the four handoff patches and the adoption report [V3_WORKSPACE](docs/product/V3_WORKSPACE.md): view routes and workbench layout presets, reading perspectives and a history lane over supplied records, capability briefs and usage arithmetic, and the private read-only PM task import (`datapass.owner-tasks/1`) reachable from the import dialog with a browser journey. The workbench, perspective, history, capability and usage modules are not yet mounted in the App. One Claude lead coordinates a workflow; W2 runs as a native subagent lane; no external Codex writer.

**Next.** W1 (mount the workbench and route resolution in `src/App.tsx`), W2 (cited capability examples) and W5 follow-ups in parallel after W0; then W3 and W4 after W1; W6 integrates, versions and qualifies. Filesets and acceptance UX26-UX30 are in V3_WORKSPACE.

## Previous: 1.29.1

1.29.1 ([notes](docs/release-1.29/RELEASE_NOTES-1.29.1.md)) is a patch on 1.29.0: public figures never count private items and print one generic notice, "Some private or unreachable content is not shown." (#100, AC25 now implemented in the [R4 crosswalk](docs/product/R4_CROSSWALK.md)), and the watched concept host records its change baseline synchronously so a save right after start is regenerated (#99). AGENTS.md "Current limits (1.29.1)" has the details. The integration PR records the exact head, CI and the candidate under `.local/integration/DIAGRAM/1.29.1-<sha>/`.

**Next.** These are still open:
- Owner decisions: AC02 profile levels (L1 vs rich pack), AC09 run/attempt model, AC11 Brain format.
- Small UI follow-ups: a completeness badge in the readiness panel, an AbortSignal from the folder picker to the scanner, a host that calls `acceptPublicReturn`, navigator/search/story steps honouring a chosen parent.
- Byte comparison of the binary PPTX exports for omission counts; completion-kit omission counts.
- Host runs in CI, extension update, signing and Marketplace.
- R4-W7 adapters (optional).

V2 is not complete: all eight workstreams stay partial.

## Previous: 1.29.0

1.29.0 ([notes](docs/release-1.29/RELEASE_NOTES.md)) integrates eight V2 standalone packages: hierarchy rail and Choose parent with a real Tab walk at 390x844 (#89), schedule and measure forms with cited compatibility evidence (#90), host refusals that keep their input, Cursor proven locally and a Linux packaging dry run in CI (#91), one studio environment selection (#92), public noninterference and private-ID refusal (#93), uncertain writes, unknown-module imports and image digests (#94), instruction files as declared rules with bounded cancelable scans (#95), and artifact entry with declared-workflow playback (#96). Rows moved are in the [R4 crosswalk](docs/product/R4_CROSSWALK.md) and AGENTS.md "Current limits (1.29.0)". The integration PR records the exact head, CI and the candidate under `.local/integration/DIAGRAM/1.29.0-<sha>/`.

**Next.** These are still open:
- Owner decisions: AC02 profile levels (L1 vs rich pack), AC09 run/attempt model, AC11 Brain format, and whether public figures may print omission counts (AC25 strict reading).
- Small UI follow-ups: a completeness badge in the readiness panel, an AbortSignal from the folder picker to the scanner, a host that calls `acceptPublicReturn`, navigator/search/story steps honouring a chosen parent.
- Host runs in CI, extension update, signing and Marketplace.
- R4-W7 adapters (optional).

V2 is not complete: all eight workstreams stay partial.

## Previous: 1.28.1

1.28.1 ([notes](docs/release-1.28/RELEASE_NOTES-1.28.1.md)) adds an installed VSIX proof in VS Code (#86, `npm run test:host:vscode`, local desktop only), env-selectable e2e ports above 20000 (#85, `DIAGRAMCLOUD_E2E_PORT`, default 24173-24175), an evidence-only packaging inspection report with Windows tar (#85), and tour and saved-context controls checked at 390x844 with keyboard and reduced motion (#87). The integration PR records the exact head, CI and the candidate under `.local/integration/DIAGRAM/1.28.1-<sha>/`.

1.28.0 integrates the DiagramCloud standalone V2 mission ([mission](https://github.com/julian-passebecq/galaxy-prompt-spec/blob/main/missions/2026-10-17-diagramcloud-standalone-v2.md)). The packages are P1 evidence figures (#79), P2 saved contexts (#78), P3 visual variants (#77), P4 React host session and VSIX source package (#80), P6 decision review (#82), P5 tour Resume (#83), and P7 proposal parity with offline journeys (from #81, folded into the integration PR). The changes are in [release notes](docs/release-1.28/RELEASE_NOTES.md), the [R4 crosswalk](docs/product/R4_CROSSWALK.md) and AGENTS.md "Current limits (1.28.0)". The integration PR records the exact head, the CI run and the local candidate package with its hashes, under `.local/integration/DIAGRAM/1.28.0-<sha>/`.

**Next.** These are still open:
- A Cursor run of the VSIX, and a host run in CI (the VS Code test is local only); extension update, signing and the webview "Download return file" button.
- Form editors for schedules and measures.
- An environment selection, so saved contexts can carry one.
- Compatibility evidence for the substitution check.
- A full Tab walk to canvas cards, and the sidebar tabs and canvas at 390 px.
- Packaging on Linux after the tar change.
- R4-W7 adapters.

V2 is not complete: all eight workstreams stay partial.

# History

# Remaining product and qualification boundaries

State on 2026-10-14: DiagramCloud 1.25.0 is merged (PR #59, f230ae0f234092ddeaaf6b5925f56568d425bf83), kept on Vercel Production with the owner's agreement, and its package is published privately in juliandatapass-group/galaxy-release-vault as generic package diagramcloud/1.25.0-f230ae0 (authenticated re-download matched all sha256, anonymous access refused; receipt in `outcome.json` release.packageReceipt). The import-review-edit-save-reopen-export journey also passed on the production site. No tag, public release or Marketplace entry exists. Open: owner review (`ownerVerified` stays false until Julian reviews). PR #57 is merged and #58 was closed after integration; read `outcome.json`, `SHIP-REPORT.md`, `docs/product/CAMPAIGN_CLIENT.md` and the sole `docs/ROADMAP.md` before new work. The final exact-SHA immutable receipt determines which qualification actually ran.

The original full selected V1–V3 implementation is assessed row-by-row against original bounded acceptance, not a representative increment. Earlier missing canvas/Brain/native/evolution/release/collection/Deep/verification prerequisites have working implementations and private qualification evidence. Real Brain and atlas contents must never be committed or copied into public packages. Runtime collection/agent execution/observation review remain owned by external producers and human Edit decisions.

Genuinely separate remaining horizons are unchanged:

1. F004 (V4): define external execution/autonomy ownership and permission contract before any DiagramCloud execution port. Current AI-Off/manual/external proposals remain sufficient for independent operation.
2. F061 (V4): obtain Hop's owner contract and a concrete selected link workflow; do not implement another DataPass engine.
3. F071 (V4): identify a concrete Structurizr/LikeC4 workflow and owner-compatible loss report/fixtures before adding interchange.
4. F072 (V4): measure a layout-engine need on source-backed fixtures before replacing existing deterministic geometry.
5. F044/F045 (R&D): specify IsoSVG/Trace semantics and qualified offline fallback before adding illustrative animation; existing static Exploded remains preserved.
6. F100/F102 (R&D): obtain explicit provider authorization and qualified rights/cache/redaction contracts before R2 or image generation integration. No service or paid installation is authorized here.

Known supported-subset limits do not become facts: templates/MSBuild/compiler dispatch/DAX/dynamic infrastructure are not executed; YAML aliases/tags and remote references are not resolved; syntax call candidates are not runtime calls; Git subtree history is not inferred from selected file names. Quantitative conservation is UNKNOWN without a supplied closed-flow assumption. Unsupported/partial recipe availability and scoped omission receipts stay visible. Publications use generated detail pages and source tables rather than claiming a specialized dense figure retained every encoding. Legacy output digests are explicitly unbound. Chromium is the qualified browser; source folders/permissions are session-selected.

Before proposing any later completed change run TypeScript, unit, production build and full Chromium. Renderer changes also require the unchanged real-local-atlas geometry gate and real PowerPoint PNG/ZIP visual inspection. Use a fresh evidence/package directory and exact source SHA; read final CI conclusion. Main merge, tag, deployment, production publication, external collector/executor and provider actions are not authorized by this campaign.
