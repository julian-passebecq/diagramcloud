# Qualification locale — V2 Studio Identity

Source 034e46cd03cc9651e42e76863d25c0509028c921c96d1b99e7f7cdbfb332e731, 572 inputs, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0.

| Gate réelle | Résultat | Preuve |
|---|---|---|
| TypeScript | exit0 | .local/v2-studio-identity/typecheck-final.log + exit |
| Unit | 806/807, skipped 1, failed 0, cancelled 0, 54626.351ms | .local/v2-studio-identity/unit-evidence.json |
| Build | exit0 | .local/v2-studio-identity/build-final.log + exit |
| Full Chromium | 165/165, failed 0, skipped 0, flaky 0, exit 0, 469890.91500000004ms | .local/v2-studio-identity/browser-final-report.json + exit |
| Actual case selection/runtime | 165 actual final --list cases | .local/v2-studio-identity/browser-list.json, .local/v2-studio-identity/browser-runtime.json |
| Independent peer | SOURCE_ONLY, 4 findings, zero open | .local/v2-studio-identity/independent-final-review.json |
| Visual | 4 explicit fresh PNGs viewed by root | .local/v2-studio-identity/required-artifacts.json, .local/v2-studio-identity/visual-review.json |

| Original clause | Role | Disposition | Evidence/limit |
|---|---|---|---|
| r3:simple-modes | secondary | PARTIAL | Preservation constraint only: applied session return must keep existing public boundary, stable canonical IDs, UI profile/layout, author edits and browser storage independent. Broader original clause remains unfinished. |
| r3:representability-oracle | secondary | PARTIAL | Preservation constraint only: applied session return must keep existing public boundary, stable canonical IDs, UI profile/layout, author edits and browser storage independent. Broader original clause remains unfinished. |
| r2:workspace-layout | secondary | PARTIAL | Preservation constraint only: applied session return must keep existing public boundary, stable canonical IDs, UI profile/layout, author edits and browser storage independent. Broader original clause remains unfinished. |
| v2:revision | secondary | PARTIAL | Applied bounded slice: return resolves current permitted facts without restoring a snapshot; forward capture can preserve separate decoded-text digest and repository revision. No single SHA, build/deployment/runtime freshness or cross-host parity claim. |
| v2:private-audience | secondary | PARTIAL | Preservation constraint only: applied session return must keep existing public boundary, stable canonical IDs, UI profile/layout, author edits and browser storage independent. Broader original clause remains unfinished. |
| v2:storage | secondary | PARTIAL | Preservation constraint only: applied session return must keep existing public boundary, stable canonical IDs, UI profile/layout, author edits and browser storage independent. Broader original clause remains unfinished. |
| v2:navigation | primary | PARTIAL | Applied bounded slice: bounded session-only Back/Forward sheet+edge return, exact root-started current permitted chain, scope reset and generic invalid-target pruning. Semantic saved views, host transport and environment/variant retention remain OPEN. |
| v2:shared-root | secondary | OPEN | Bounded applied prerequisite only: Original clause remains OPEN outside bounded forward capture: shared membership, source access, scope/host/client parity and publication are not implemented by importer metadata. |
| v2:identity | primary | PARTIAL | Applied forward-only prerequisite: explicit opt-in source/local assignment provenance for new candidates only. Historical IDs remain unchanged/UNKNOWN; no automatic reuse, namespace repair, runtime truth or source grant. |
| v2:selection | secondary | OPEN | Bounded applied prerequisite only: Original clause remains OPEN outside bounded forward capture: shared membership, source access, scope/host/client parity and publication are not implemented by importer metadata. |
| v2:landscape | secondary | OPEN | Bounded applied prerequisite only: Original clause remains OPEN outside bounded forward capture: shared membership, source access, scope/host/client parity and publication are not implemented by importer metadata. |
| v2:galaxy-client | secondary | OPEN | Bounded applied prerequisite only: Original clause remains OPEN outside bounded forward capture: shared membership, source access, scope/host/client parity and publication are not implemented by importer metadata. |
| v2:external-client | secondary | OPEN | Bounded applied prerequisite only: Original clause remains OPEN outside bounded forward capture: shared membership, source access, scope/host/client parity and publication are not implemented by importer metadata. |
| r3:scope-profiles | secondary | PARTIAL | Bounded applied prerequisite only: Bounded complete private mappings, no implied organization/project association or provider inventory. |
| r2:privacy-isolation | secondary | OPEN | Bounded applied prerequisite only: Original clause remains OPEN outside bounded forward capture: shared membership, source access, scope/host/client parity and publication are not implemented by importer metadata. |
| v2:preserve | secondary | PARTIAL | Bounded applied prerequisite only: Default-off compatible capture and unchanged accepted IDs/legacy readers/previous history. |

Exact selected original feature and UX rows from each hash-bound plan remain in qualification.originalCriteria, without a mandatory catalogue plan or fixed future clause count. Browser execution is separate from source-only peer review. No new consumer/CLI/PPTX qualification is required or inherited.

- forward-intermediate-before-studio: NOT_RUN, source f5717269d3291f4bb666c51809f4e3d3405542ae604265b8f315ec0ede081b4f. Forward-only application intermediate check. TAP counts and duration are parsed from actual Atlas output, never encoded. Build/browser were explicitly NOT_RUN; this stage is not whole-source qualification.
- affected-v1: FAIL, source 4479834ee4a5c8c22872941cee90be80a14b7911f0ea0faac00c1886d21c56de. Actual first combined affected attempt. TSC/unit/build succeeded; browser FAIL is retained. Root identified exact-raw Galaxy digest trimming and a forced SVG edge-group click under the fixed header. These are diagnostic attributions, not inferred runtime causes or retroactive qualification. Counts/durations come from actual TAP/report.
- affected-v2: FAIL, source 855998ae1f67d7cd9ed8564fea3fd2d8d68e95db9502cc2bb6b1eb373097f7b4. Actual affected-v2 after root retained raw Galaxy text separately from parser-trimmed text and replaced the forced group click with a real SVG hit-test/pointer helper. Browser FAIL retained: the exact native hit-test found no intended edge receiver on the overlapping parallel interaction bands. No forced click or assertion removal. Counts/durations are parsed from actual stable proofs.
- focused-navigation-distinct-edge-fixture: FAIL, source 16d9574f2e5721777db0581eddc9135005902af0f9b1877868b912e4fe599332. Actual focused browser-only attempt after changing connection01.source to parent in the separate synthetic session fixture. The native hit precondition still refused the short connection00 gap, covered by its existing label badge. The failure is retained; no forced event, timeout or assertion weakening. All other source inputs equal affected-v2; build/typecheck/unit NOT_RUN. Counts/duration come from actual stable report.
- focused-navigation-widened-synthetic-gap: NOT_RUN, source 034e46cd03cc9651e42e76863d25c0509028c921c96d1b99e7f7cdbfb332e731. Actual focused browser-only rerun after root widened the small session fixture gap (right x900/private x1200), retaining the original53-edge fixture and every assertion. Exact source vectors differ only in this test; root reused unchanged-product dist. Native hit testing and real pointer actions remained. This is a focused result only, never a build/unit/typecheck or mandatory full-source qualification. Counts/duration are parsed from actual stable report.

No unexpected failure in the completed primary final browser gate.

- All eight original workstreams remain PARTIAL. Original rows, qualifiers, blank IDs and PENDING selections are immutable provenance, not implementation outcomes or permission.
- Semantic saved views remain OPEN: transient session return does not add durable saved bookmarks, revisions, environments, variants or host transport.
- Original v2:recovery concerns source-vector/handoff reconciliation and remains OPEN; browser backup does not satisfy it. It is not a selected clause in these two plans.
- Actual final gates, production receipt, independent source review and root-viewed fresh synthetic PNGs are bound to this source. Assembly/integrity and any external acceptance remain separate steps; previous checkpoint metadata inherits no result.
- Previous sealed General Product checkpoint metadata is supplied and hash-verified: previous-checkpoint.json records source8702, archive e49a585b5da79e11123631234dde92448598dff57b765b072e823de04a510792 and manifest421ca5d4d7d48f11a0684ea685970327b6f71083c28b67938adeb69e0586e5ac. It is dated history only, with no inherited PASS.
- No new product model, persistent store, database, renderer, mapping engine, reviewed observation, source permission, ID reuse, namespace/runtime truth, installed host or external adoption.
- No future test results, consumer/CLI/PPTX/native result or public/private external delivery is inherited or presumed. Supplemental r4 rows and UX do not become canonical index98 feature IDs.
- Existing canvas interaction limit remains OPEN: a placed label can cover a short connection stroke and parallel connection hit areas can overlap. The semantic-history browser fixture separates its connections and widens its gap; this qualifies real pointer navigation and history, not improved label/edge hit testing or general graph routing.
- Whole V2 and all eight original workstreams remain PARTIAL. Original acceptance clauses, qualifiers, IDs and all prior dated CSV fields are preserved; none becomes PASS/COMPLETE.
- The selected Studio return, forward Galaxy identity capture and any other root-selected bounded plans preserve their exact original feature and UX rows as acceptance evidence, not permission or full product certification. One aggregate qualification covers the selected batch; no micro-change is presumed independently sealed.
- No new product model, persistent store, analysis/mapping engine, permission, reviewed observation, automatic apply or external publication authority is created by a local review checkpoint.
- The preceding sealed General Product checkpoint is metadata-only dated history. Its source/archive/manifest/baseline hashes identify history; no preceding gate outcome, count, capture, failed attempt or consumer result becomes a current fact.
- This profile requires actual typecheck/unit/build/full browser, final runtime and --list, independent SOURCE_ONLY review, and explicit PNG/visual review. It adds no consumer-build, CLI, native editor or PPTX gate, and inherits none.
- Consumer fixture bundles, owner executable bytes, raw Project/GraphSnapshot/AnalysisBundle/selected context/atlas, private payloads, credentials, sessions, traces and fonts are excluded.
- Optional current-lot diagnostic history remains secondary metadata. Absence creates no invented attempt, count or PASS; a focused result cannot replace a completed primary full gate.
- Local dirty source only; no exact-commit remote CI, release READY, completed V2, commit/push/merge, install, cloud action, deployment or published SDK is claimed.
