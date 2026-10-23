# Roadmap

Updated 23 October 2026. This is the canonical current roadmap, not a new backlog or a permission grant. The complete earlier narrative, Julian’s ideas, original horizons and pass logs remain byte-preserved in [the historical roadmap](ROADMAP_HISTORY_20261021.md). Its old “current”, “next” and effort paragraphs describe their dated source cuts, not today’s unfinished work.

## Current source and delivered package

Source version: `1.33.1` ([patch notes](release-1.33/RELEASE_NOTES-1.33.1.md): storage recovery and persistence fixes #118-#120, entry documents #122). The last recorded private package is `diagramcloud/1.33.1-0892f9d` (source `0892f9d`, PR #125 and #126; the earlier `1.33.1-1ee51db` stays unchanged); its immutable receipt remains in [outcome.json](../outcome.json), `privatePackages`. Post-release fixes must be identified by commit and qualified separately. They do not silently update that package or establish installation, a public release or deployment.

[RESUME.md](../RESUME.md) records the current implementation/qualification checkpoint. [RELEASE.md](RELEASE.md) owns the release procedure and historical release receipts. The older direct-hardening document [RELEASE-READINESS-20261021.md](product/RELEASE-READINESS-20261021.md) is a recovered source checkpoint, not an instruction to reapply fixes already adopted in 1.33.0 and subsequent PRs.

## Release reliability delivered; combined source candidate

**Delivered:** #125 and #126 merged and the reliability successor `diagramcloud/1.33.1-0892f9d` was privately published. Current production is `2ea334fa80f44b42f1b1e670e4193b09f7df0b27`; [main CI 39880731437](https://github.com/julian-passebecq/diagramcloud/actions/runs/39880731437) passed, and [the native receipt](https://github.com/julian-passebecq/diagramcloud/pull/128#issuecomment-6354772786) records four deployed cases passing on that source. The earlier absent-source handshake and pending package/adoption instructions in the [22 October closure record](release-1.33/RELEASE_CLOSURE_20261022.md) are preserved history, not outstanding release gates.

**Combined source candidate, separate from that release:** branch `codex/diagramcloud-explanation-integration-20261023` composes #129's [23 October package identity guard](release-1.33/POST_RELEASE_20261023.md) and #130's authored-explanation form. The packaging preflight checks the existing build's full source SHA, product version and standalone identity before any package directory or bundler is created. It refuses rather than changing build metadata. This prevents a future source/build mismatch; it is not evidence that the delivered package has one.

The form follows **Edit → Tours → Author explanation → Review explanation → Apply explanation**, with optional authored state, frozen code and takeaway. The private draft stays in the session; downloads do not establish a project save. Back to request retains all fields and the original full source basis; source drift, including a same-revision change, is refused. A missing Tours collection is initialized only through a separate explicit, undoable edit. The wider UX31 limits remain in [V3_WORKSPACE](product/V3_WORKSPACE.md): incomplete CLI input coverage, no request-file import or draft autosave, companion Contract/Questions gaps and no AI execution.

Combined-source qualification is pending in [RESUME.md](../RESUME.md): exact-head typecheck, full units, CLI/MCP, build, browser tests and the existing packaging dry run. The candidate is not yet deployed or released. The existing native integrator owns final composition and release authority; passing source tests does not transfer it. Main auto-deploys, so any adopted commit needs a new exact deployment observation rather than inheriting `2ea334f`. Keep prior packages immutable; no repeated upload to their paths.

Preserve the existing explanation/design/comparison/presentation workbench, learning/interviews, ideas, linked views, join evidence, meeting summaries, history and delivery reading. The [recovery audit](release-1.33/RECOVERY_CAS_20261022.md) and [persistence audit](release-1.33/PERSISTENCE_BOUNDARIES_20261022.md) retain their baseline failures and evidence limits. Finish this bounded candidate before selecting unrelated expansion; no new feature ID or parallel acceptance system is introduced.

Further proposed independent blocks remain explicit source refresh and recoverable return context, and meeting-summary publication parity. Cross-project correspondence follows an explicit identity/authority contract. These proposals do not launch work or replace the original acceptance below; one native integrator owns shared App/contracts/release files.

## Retained complete Studio scope

The selected r3/r4 V2 scope remains the complete standalone architectural Studio. The [eight-workstream status and original acceptance crosswalk](product/V2_WORKSTREAM_STATUS.md) retain its exact clauses. The workstreams are general core; standalone Studio; Galaxy Atlas and external projects; general IT catalogue; analyses/bridges/diagnostics; visualization quality; integrations; and publication. All unfinished criteria remain open. A bounded recovery fix or successful T3 integration does not complete any whole workstream by implication.

The [R4 crosswalk](product/R4_CROSSWALK.md) owns its row-level implementation/test mapping. [V3_WORKSPACE](product/V3_WORKSPACE.md) records the adopted V3 mission, UX26–UX46 additions and their boundaries. Its introductory and older version paragraphs are dated adoption context; later row updates and exact release evidence must be read together. [EXPRESSIVENESS](product/EXPRESSIVENESS.md) retains explanation/related-context acceptance. [CAPABILITY_ATLAS](product/CAPABILITY_ATLAS.md) preserves broader capability direction, not a second launch queue.

The original F001–F115 inventory and recovered matrices remain in the [product source index](product/README.md); the 17 selected DG rows remain in the [NIGHT4 crosswalk](product/NIGHT4_CROSSWALK.md). Do not invent replacement IDs, retag historical statuses as shipped, or quietly move unfinished selected V1–V3 work to a later horizon.

## Remaining product gaps are not all release blockers

V3 remains integrated rather than complete. Read current acceptance rows before selecting work: delivery-task links and saved linked contexts already shipped and must not be redispatched from an older “Left” paragraph. Remaining directions include cross-project correspondence, free docking/saved layouts, richer delivery/capacity reasoning, the wider explanation-authoring limits beyond the candidate above, companion Contract/Questions surfaces, meeting-summary PDF/PPTX, and richer semantic/spatial lesson diagrams where their original acceptance is still open.

A token forecast, queue model or claimed current activity requires an actual model and supplied evidence. Supplied allowances and static snapshots are not measurements, execution or live scheduling. UX29/UX30 remain partial where queue/calendar/actual-result evidence is absent. No live collector or dispatcher is launched by this roadmap.

T3/Mosaic, remote MCP, local-model and selected external-owner integrations retain their own source, capability and acceptance requirements. Missing external authority does not block independent authorized DiagramCloud implementation, but it does prevent claiming that an untested owner integration is complete. Do not rebuild FOIL tools, a portfolio website or another orchestrator as a substitute.

## Qualification and owner boundaries

Chromium CI qualifies only its recorded cases and source. Installed VS Code/Cursor, update/rollback, signing and Marketplace require their own applicable checks. External-host skips remain explicit. A source/render review in LibreOffice is not native PowerPoint or owner acceptance; generated PDF geometry is not proof that a person read a printed meeting summary.

Public artifacts must use the public projection and preserve rights/provenance; authoring backups are private full documents. Real private client/Brain/Atlas inputs require approved sources and destinations. Owner decisions AC02 (profile levels), AC09 (run/attempt model) and AC11 (Brain format) remain owner/contract decisions rather than invented defaults.

## Original parked horizons

The original V4 rows stay F004 (DiagramCloud-owned autonomy requiring an owner contract and execution authority), F061 (DataPass-owned Hop), F071 (Structurizr/LikeC4 for a concrete qualified interchange need) and F072 (renderer/layout-engine replacement requiring a benchmark). R&D stays F044 (IsoSVG), F045 (Trace), F100 (R2) and F102 (external image generation with source/semantics/rights qualification). Existing static spatial and rights-aware asset capabilities are not removed. No selected unfinished acceptance is newly parked here.

## Historical continuity

[The historical roadmap](ROADMAP_HISTORY_20261021.md) retains every prior section, including Julian’s October ideas, the full-product campaign, version history, donor decisions and direct Pro source checkpoints. [The historical README](../README_HISTORY_20261021.md) retains detailed earlier walkthroughs; [historical continuation notes](../RESUME_HISTORY_20261021.md) retain old handoffs. Those records are evidence and context, not competing current roadmaps. Calendar completion and total remaining effort are unknown; old uncalibrated allowances must not be summed into a new forecast.
