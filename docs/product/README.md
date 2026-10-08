# DiagramCloud product source index — 2026-10-08 reconciliation

**Product authority:** [`docs/ROADMAP.md`](../ROADMAP.md) owns the current human-readable roadmap, and the exact Git/CI/release files own shipped product truth. The original recovered CSVs below are **immutable historical design inputs**, not a second current backlog and not new accepted NIGHT4 requirements.

**Release baseline:** [`v1.24.0`](https://github.com/julian-passebecq/diagramcloud/releases/tag/v1.24.0), `main`/tag `309099ef8b4fcaa8e6f836f2b40a39b148b5a6c1`, [CI run 37731465431](https://github.com/julian-passebecq/diagramcloud/actions/runs/37731465431). Release facts remain in [`docs/release-1.24/`](../release-1.24/), not in these matrices.

**NIGHT4 scope:** [`NIGHT4_CROSSWALK.md`](./NIGHT4_CROSSWALK.md) relates existing F IDs to the **17 selected DG**; normative acceptance remains [the pinned Galaxy NIGHT4 source](https://github.com/julian-passebecq/galaxy-prompt-spec/blob/92d256f75e334b685fb327ab552e718fbb51f001/workstreams/COCKPIT-20261008-NIGHT4/features.csv). No Galaxy-owned roadmap is copied here.

## Recovered source artifacts (not reconstructed)

| Canonical archival file | Original rows | Role | Original artifact SHA-256 |
|---|---:|---|---|
| [FEATURES_PREPRO_20261008.csv](./FEATURES_PREPRO_20261008.csv) | 115 | original F001-F115 feature inventory; historic statuses and targets | `abf21ebfc8acbc5025d1827ce86627b985bbaf4f36ac676951a32753828993ae` |
| [FEATURE_DISPOSITION_PRE124_20261008.csv](./FEATURE_DISPOSITION_PRE124_20261008.csv) | 115 | actual pre-1.24 Code Lead dispositions; no post-release retagging | `6500bffc27135319018a000dffbf031c909724a7822abc02266e1a6cff7cb3a0` |
| [UX_COMPONENTS_PREPRO_20261008.csv](./UX_COMPONENTS_PREPRO_20261008.csv) | 22 | candidate component-level UX inventory | `cc499d23281419617fde0915f1091026f8511e57e38c043da19ae97f18b05f90` |
| [UX_PRESETS_PREPRO_20261008.csv](./UX_PRESETS_PREPRO_20261008.csv) | 20 | candidate selection presets; PROPOSED is not shipped | `e4a6ca3b8c061ea0c41e786f76bbf217f4e31c540142acd8db84d7fea769dae5` |
| [MINIMUM_VIEWS_PREPRO_20261008.csv](./MINIMUM_VIEWS_PREPRO_20261008.csv) | 33 | potential contextual view recipes | `d2d3c86a97605360e4833b68896ed2e1069acd7c3f33b408fee0fd1b176ec7e9` |
| [RENDER_LIBRARY_PREPRO_20261008.csv](./RENDER_LIBRARY_PREPRO_20261008.csv) | 46 | rendering library / future profiles; not 46 released renderers | `b626dbb2e1d281866a3cae635698495f464ee5504bedbce0c037df78902328af` |
| [ARCHITECTURE_DECISIONS_PREPRO_20261008.csv](./ARCHITECTURE_DECISIONS_PREPRO_20261008.csv) | 38 | design decisions from pre-Pro; 'ACCEPT' means planning acceptance only | `6efbdbe62552f06ec896a60cc55282ae27aafc0bf4dd446f078d464cf746d0c9` |
| [SCANNER_ADAPTERS_PREPRO_20261008.csv](./SCANNER_ADAPTERS_PREPRO_20261008.csv) | 34 | analyzer capability inventory, including future adapters | `192ee4709f4ea73e492bf16764c1bfc1ecc61c6fd2ca12ea1a46fd53db53105c` |
| [FEATURE_DEPENDENCIES_PREPRO_20261008.csv](./FEATURE_DEPENDENCIES_PREPRO_20261008.csv) | 56 | dependency edges between original F IDs | `8101e7e4dc2f5d317c2a70dc81cc8348eb63d0ca2c9555337d3a9d592c9f5060` |
| [QUALIFICATION_ZOO_PREPRO_20261008.csv](./QUALIFICATION_ZOO_PREPRO_20261008.csv) | 25 | synthetic fixture ideas / truth-manifest scenarios; not 25 validated repos | `a46deecf24544db53b2a05b89506e4effe125dc15b88fd606174bb441d7ca434` |
| [POST124_TECHLEAD_AUDIT_20261008.md](./POST124_TECHLEAD_AUDIT_20261008.md) | document | actual read-only post-1.24 Tech Lead report; distinct from release CI receipt | `98c7da81acd6255b36bc10abd310c418e75cdf2a00662dcb658cfbaf959be385` |

Provenance: files recovered from previous user-visible local pre-Pro/code-lead artifacts in this conversation (`diagramcloud-prepro-consolidation-2026-10-08`, `diagramcloud-codex-release-handoff-2026-10-08`, and post-1.24 audit). SHA-256 values identify **original artifact bytes**. Git publishing normalized CSV line endings/BOM via text-file transport; Git blob hashes are separate. No F or DG rows were generated to fill absent source lines.

## Existing authoritative documents reused, not duplicated

- [`docs/ROADMAP.md`](../ROADMAP.md): ongoing full-product narrative and version-aware plans.
- [`docs/release-1.24/RELEASE_CONTRACT.md`](../release-1.24/RELEASE_CONTRACT.md), [`RELEASE_NOTES.md`](../release-1.24/RELEASE_NOTES.md), [`CODEX_WORK.md`](../release-1.24/CODEX_WORK.md): release 1.24 scope, implementation handoff and existing proof.
- [`docs/pro-pass/START_HERE.md`](../pro-pass/START_HERE.md) and related handoffs: older Pro guidance and design history; do not treat as current runtime.
- [`docs/contracts/galaxy-v1g.md`](../contracts/galaxy-v1g.md), [`src/core/galaxy.ts`](../../src/core/galaxy.ts): shipped baseline integration that NIGHT4 must preserve.
- External [GraphSnapshot schema/CONTRACTS.md](https://github.com/julian-passebecq/galaxy-prompt-spec/tree/92d256f75e334b685fb327ab552e718fbb51f001/workstreams/COCKPIT-20261008-NIGHT4) are normative for the **input adapter** only; they do not replace the `Project` model.

## Preservation, selected work, and deferrals

- Preserve all 1.24 flows: Repository, Guided, Hybrid, Markdown/CSV, offline overview, asset checklist, Explore/Edit/Portfolio/Present, Atlas, sidecars, workspaces, evidence, privacy/publicDocument and exports.
- NIGHT4 V1 = DG-001..017 only, including offline GraphSnapshot client, generic family views, Fabric, Databricks, dbt, .NET/OpenAPI adapters and capability-driven recipes; a selected spec is NOT completion evidence.
- Unselected longer-term plans remain planned, not secretly added to NIGHT4: environment/deployment/promotion/drift, rich Project Evolution, semantic document knowledge, advanced IsoSVG/Trace, R2 / generation, general agentic/MCP. See archived F IDs for source-level intent.
- Small post-1.24 code observations in the audit are **suspected** issues only; reproduce before fixing.

## Missing or uncertain

- The full earlier 160 conversation messages and native Codex host transcripts were **not** recovered from local artifacts. The matrices/Tech Lead report named above **were** recovered exactly at row level.
- Current Windows `D:\\PROJ` worktrees and any provider-local active session cannot be attested from this remote branch; do not overwrite their work.
- Post-release F-by-F implementation statuses were **not** recomputed in this document synchronization; only the v1.24 shipped contract is independently supported. Future DG completion must cite exact commit/test/receipt.

**Edit ownership:** maintain current roadmap in `docs/ROADMAP.md`, status and tests in product code/CI, original F inputs in this immutable archive, and external DG acceptance only at the pinned Galaxy source.
