# Overnight changes — implementation inventory

This report describes the current uncommitted implementation, not a completed V2 release or a qualification receipt. Commands, source states, results and outstanding gates belong in `OVERNIGHT-TESTS.md`; scope dispositions belong in `OVERNIGHT-OUTCOME.md` and `RESUME.md`.

## Source reconciliation: adopted 1.25

The worktree remains on `codex/concept-preview-r4`, with HEAD `091947452683102849eb225d67ef870fc6e2f1d0`. Its original NIGHT4/1.24 source was reconciled with existing 1.25 source `f0a3c40680dd4d75da0f1a2ef2662892a4055d68`, preserving the local r4 work. No branch reset, replacement application, new commit, push, merge or deployment was performed. Ignored `.local/overnight/base-reconciliation/report.json` records the source vector and file identities.

These capabilities were adopted from the existing 1.25 implementation, rather than newly authored overnight:

- The `src/app/` workspace, review, export and navigation seams; reviewed GraphSnapshot acquisition, grouping, filtering and reimport with retained source identities.
- Existing Quick/Standard/Deep/Custom analysis, optional local Tree-sitter runtimes, native domain adapters, selected document/source bundles, private generated analysis and cache identities under `src/intelligence/`.
- Existing recipes and cookbook content; source, perspective, evolution, delivery and publication/library panels; immutable snapshots and independent revision vectors.
- Existing verification proposal/receipt staging, explicit entity proposals, public MCP tools and the separately selected private analysis tool; packaged CLI/MCP clients.
- Existing HTML, SVG, PDF/manual, editable and picture PowerPoint, Diagram Design, AtlasNote and interchange paths, retaining their formats, rights and public-projection boundaries.

README, architecture and AI-guide reconciliation retained that implementation alongside r4. Historical 1.25 reports remain source-specific evidence; reconciliation does not transfer their qualification to this working tree.

## Preserved r4 projection and file route

`src/export/concept.ts` retains the public export through `publicDocument` and a separate private selected-view author projection. Typed node/edge mappings preserve identities, dependency meaning and confidence while reporting merges, omissions and target budgets. Author preview does not change visibility or include unrelated private content.

`src/interop/conceptPreview.ts` binds the derived packet to project, revision, view, audience, timestamp and projection with SHA-256. Return validation rejects malformed envelopes, stale digests and unknown targets; interactive return requires one canonical source and an exact origin/source-window binding. A packet is presentation data, not another editable architecture or an authorization grant.

`scripts/concept-preview.ts` and `concept:preview` retain bounded explicit input, mandatory audience, exclusive output directories and input/output hashes. READY is written last and records local preparation only. The public MCP render surface and bundled-client route include concept preparation without implying native viewer adoption or publication.

## Overnight Mosaic host and workspace

`src/interop/conceptHost.ts` and `scripts/concept-host.ts` add `concept:host` around an explicitly selected, SHA-256-checked existing owner viewer. A supplied packet is regenerated from the authorized document before reuse. Fixed routes, checked Host headers, IPv4/IPv6 loopback, separate parent/viewer origins and a restrictive helper CSP bound the local connection; the main application CSP is unchanged. Viewer bytes are selected locally, never installed or downloaded by this route.

The host reuses Mosaic load/ready for layered, isometric and WebGL views. Separate mapping controls return a unique source to an explicitly bound opener. They are labelled separately from selection inside Mosaic. No native viewer-pick emitter or automatic WebGL recovery is added.

`src/ui/MosaicPreview.tsx`, its stylesheet and `src/App.tsx` add audience selection, preparation, downloads, local-host connection and return to a canonical component/connection with the parent path retained. Current project/view/revision, origin and source-window checks reject stale or ambiguous returns. Public modes hide stored author packet contents and reject an in-flight author preparation after an audience-mode transition.

## Presentation profiles and late callback guards

`src/core/presentationProfile.ts`, `src/ui/PresentationProfile.tsx` and its stylesheet add Vanilla, Standard and Advanced as presentation preferences. Small versioned preferences are isolated by project and host; blocked/corrupt storage falls back safely. Standard retains ordinary controls, Vanilla puts rendering controls in More tools, and Advanced adds source/comparison shortcuts. Source navigation, evidence, JSON, exports and recovery stay reachable. Profile selection does not change Project data, acquisition depth, assistance, permissions, audience or collection behavior.

`src/App.tsx` tracks file/import-validation generations and current JSON workspace context. Closing the workspace, replacing its text, changing project or superseding a request invalidates late results. Pending state disables conflicting validate/apply/editor controls. Binary and text adapters stage only a current candidate through the existing review path.

`ProjectOverview.tsx` and `IntelligenceInsights.tsx` pass the permitted projection to public panels, revoke authoring callbacks and unmount private collectors in public modes. `SourceBundlePanel.tsx` cancels stale reads/analysis and guards asynchronous results by operation identity. `WorkVerificationPanel.tsx` invalidates late file callbacks on unmount, project change, superseding requests and loss of the authoring callback. Receipt completion additionally requires the same spec, runner and run identity. A newly proposed NOT_RUN check supersedes a pending spec read. These guards neither run checks nor review observations for the author.

## Actionable generated gaps

`src/intelligence/gapDetails.ts` defines optional causes and bounded advisory descriptors for `missing-declaration`, `missing-source`, `access-denied`, `unsupported-analyzer`, `dynamic-unresolved`, `stale-revision`, `conflicting-evidence` and `consumer-error`. Advice carries no command, URL, permission grant or automatic AI/collection action.

Generated-report types/validators in `types.ts`, `profile.ts` and `materialize.ts` preserve optional metadata without changing the Project schema. Legacy state/code/message fields and string diagnostics remain available. `documentBundle.ts` and `sourceBundle.ts` carry structured details alongside strings; parser identities distinguish the new generated output.

Classification occurs at direct producer branches:

- `readiness.ts`: missing required declarations and explicitly missing atlas sources. Absent relationships and failed/unscanned members retain unknown causes.
- `documents.ts` / `structuredDocuments.ts`: known unsupported reference capabilities. Unresolved references may receive source-selection advice while their cause remains unclassified.
- `selectedFileRead.ts` / `acquisition.ts`: explicit permission-denial names with fixed sanitized messages. Generic read failures remain unclassified; underlying private error text is discarded.
- `domainAdapters.ts` / `nativeAdapters.ts`: explicit unsupported versions/shapes, contradictory dbt dependency declarations and narrowly recognized unevaluated ARM parameter/variable expressions. Ambiguous literals and general unresolved expressions are not guessed into dynamic causes.
- `sourceBundlePatch.ts`: differing known full source commits for the same explicit atlas member. `sourceBundleClient.ts` / `sourceBundleWorker.ts`: known consumer startup or worker-result failures, distinguished from generic build/input failure and cancellation.
- `sourceConflicts.ts`: documentation/driver discrepancies remain review candidates with advice, without becoming asserted conflicting evidence. Legacy wording is never parsed into a new cause.

`ProjectContext.tsx`, `AnalysisOutputs.tsx` and `SourceBundlePanel.tsx` show source location, explanation, classified/unclassified cause and inert next-step advice. Private acquisition/source diagnostics are omitted from public projections; legacy serialized context remains readable. This is bounded diagnostic support, not classification of every V2 gap or source failure.

## Scanner semantics, documentation and synthetic artifacts

`src/core/scan/scanner.ts` now marks resolved source imports as dependencies while preserving stable IDs, exact evidence and confidence. Actual SQL/data relationships retain their meanings; imports do not establish runtime data transfer.

`scripts/overnight-demo.ts`, synthetic standalone fixtures and `tests/e2e/overnight-journey.spec.ts` prepare a reproducible source/evidence/edit/save/reopen/Mosaic/export journey independent of Galaxy and T3. Generated local artifacts include separate author/public packets, public JSON/HTML/SVG, manual/PDF and editable/editorial PowerPoint with local manifests/hashes. Private authoring artifacts and local inputs remain ignored; this work adds no real client data or font binaries to delivery.

`docs/contracts/concept-preview.md`, `mosaic-local-host.md` and `docs/AI_GUIDE.md` document the routes and limits. Host documentation distinguishes viewer library, reusable authoring core and remote API client SDK; Forge remains optional tooling, and Cloudflare `cf` is separate.

Added coverage addresses projection/host boundaries, profile persistence, gap producer paths and counterexamples, private serialization/public redaction, reader/consumer errors, stale source projection, late import/verification callbacks and standalone exports. Actual browser journeys cover advice visibility and public-mode transitions; gap unit tests avoid loading the UI graph merely for server rendering. Test presence is not a result: current outcomes and interrupted/superseded executions are recorded in `OVERNIGHT-TESTS.md`.

Browser-harness corrections preserve all product assertions and existing timeouts/retries. The Mosaic public-mode test locates the inert header tab by its DOM text because the modal removes its accessible name and Fluent renders a second measurement label. The collection-conflict test explicitly activates each tab before editing it and before reading the original tab's stored row. A separate bounded diagnostic retains the inactive renderer's five-second timeout; activation is not a claim that unattended background execution was fixed. These are test changes; the production build is unchanged by them.

The standalone journey now exercises the same scanned, annotated, saved and reopened Project in the explicitly selected owner viewer: both SVG views, settled WebGL, exact represented-node selection, separate unique mapping return, unchanged canonical Project, and subsequent public/offline exports. Without both owner path/hash variables it records nativeownerNOTRUN while retaining the ordinary standalone journey. Both project and collection conflict tests activate tabs at their real return points. Local proof is recorded separately from owner adoption and passive background responsiveness.

## Unapplied owner proposal and retained boundaries

Ignored `.local/overnight/staged/mosaic-pick/` contains a candidate patch, source/blob/hash fileset and proposal for optional correlated node return in the existing Mosaic viewer. Its applicability was checked read-only; it was not applied, built or runtime-qualified. A separate proposal describes accessible WebGL loss/retry/manual-SVG behavior. No MosaicStudio or T3 source was edited, and no replacement owner artifact is supplied. Flow picking, native T3 alternative authoring and automatic WebGL restoration remain outside this implementation.

The canonical model remains `src/core/model.ts`; no parallel architecture engine or renderer was introduced. Planned design, static analysis, dated observations and author-selected publication remain distinct. Original acceptance identifiers and uncompleted V2 clauses are retained. Final qualification, owner adoption, private delivery and remaining decisions belong to the companion outcome/test/resume documents, not this inventory.
