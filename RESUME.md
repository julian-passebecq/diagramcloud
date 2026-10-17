# Now / Next (2026-10-17, 1.28.0)

**Now.** 1.28.0 integrates the DiagramCloud standalone V2 mission ([mission](https://github.com/julian-passebecq/galaxy-prompt-spec/blob/main/missions/2026-10-17-diagramcloud-standalone-v2.md)). The packages are P1 evidence figures (#79), P2 saved contexts (#78), P3 visual variants (#77), P4 React host session and VSIX source package (#80), P6 decision review (#82), P5 tour Resume (#83), and P7 proposal parity with offline journeys (from #81, folded into the integration PR). The changes are in [release notes](docs/release-1.28/RELEASE_NOTES.md), the [R4 crosswalk](docs/product/R4_CROSSWALK.md) and AGENTS.md "Current limits (1.28.0)". The integration PR records the exact head, the CI run and the local candidate package with its hashes, under `.local/integration/DIAGRAM/1.28.0-<sha>/`.

**Next.** These are still open:
- An installed VS Code/Cursor run of the VSIX.
- Form editors for schedules and measures.
- An environment selection, so saved contexts can carry one.
- Compatibility evidence for the substitution check.
- Tour controls checked at 390x844 and with reduced motion.
- An env-selectable Playwright port above 20000. 4173-4175 are pinned, so parallel lanes collide.
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
