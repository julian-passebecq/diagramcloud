# Qualification locale — React Viewer

Source 18d07d70e42d4c2de6039ea0ef787b779e75cb4905c876e1da115b60a00cb912, 569 entrées, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0.

| Gate réelle | Résultat | Preuve |
|---|---|---|
| TypeScript | sortie0 | .local/v2-react-viewer/typecheck-final.log + exit |
| Build Studio | sortie0 | .local/v2-react-viewer/build-final.log + exit |
| Unitaires complets | 774 réussis / 775, 1 ignorés, 0 échoués, 0 annulés, 68901.8347ms | .local/v2-react-viewer/unit-evidence.json |
| Full Chromium 146 cas | 146 réussis / 146, 0 échoués, 0 ignorés, 0 instables, sortie0 | .local/v2-react-viewer/browser-final-report.json |
| Consumer fixture build local | sortie0, 10017.193099999999ms | .local/v2-react-viewer/consumer-build-evidence.json, hashes seulement |
| Peer indépendant source-only | 10 findings comptabilisés, aucun ouvert | .local/v2-react-viewer/independent-final-review.json |
| Visuel | 2 PNG réellement vus | .local/v2-react-viewer/visual-review.json |

Runtime navigateur réel séparé du peer source-only ; aucun test navigateur attribué à une inspection statique. expectedCases provient du --list final et est comparé aux stats réelles, sans comptes prédits. Consumer output files restent ignorés/local et ne sont pas un SDK publié.

| Clause originale | Rôle | Progrès | Preuve/limite |
|---|---|---|---|
| v2:react-sdk | primary | PARTIAL | Local public read-only 2D source entry implements explicit scoped controlled IDs/revision, bounded optional intents, permitted retained-parent navigation, form-safe controls, CSS/provider/DOM-ID isolation and public privacy seams, plus the existing CompletionKit request file fallback for component/view only. Actual consumer build and full regression results are recorded separately in qualification.json. No published package, owner adoption or SDK reviewed-edit transaction is claimed. |
| v2:host-contract | secondary | PARTIAL | Local API version, strict canonical input/scope/base revision and bounded callback-presence checks implement a limited React boundary; missing callbacks are unavailable and an inert existing-format file route is explicit. This is not the proposed shared producer/schema/core/host wire negotiation, source-execution authority or installed owner contract. Original owner_selection PENDING_CHECKPOINT remains a limit. |
| r3:agent-capabilities | secondary | PARTIAL | The local source entry and contract distinguish read/navigation requests and inert existing CompletionKit files from authoring/reviewed apply/publish. No filesystem/token provider, arbitrary URI/command execution, source collection, remote service or live stdio-to-Studio control is added. Broader CLI/MCP/remote/native adoption remains outside this bounded React scope; final evidence is root-owned. |
| v2:vsix | secondary | OPEN | This slice supplies no standalone extension packaging, full editor/library or compact companion installation/update/rollback, selected VS Code/Cursor runtime or installed native journey. A local React source entry and synthetic consumer do not establish VSIX delivery or install authority. |
| v2:product-routes | secondary | OPEN | No selected installed Hub/PM/Brain/React producer-version route or owner open-inspect-source/work/evidence-return journal is supplied. Local controlled retained-parent navigation is a bounded viewer behavior, not continuity of owner context/revision/variant/environment/back routes or an external writer grant. |

Les 5 critères exacts et 7UX du plan SDK conservent leur horizon et owner_selection/native adoption. Pas de nouvelle ligne ni renumérotation de l’index98.

Historique propre au lot : .local/v2-react-viewer/diagnostic-history.json, SHA256 1183a911919ce1ef7a617749f8bb82fb177de66973aeaf4c5ffaef2174423fcd. Résumé metadata seulement ; toutes les preuves brutes restent locales. Aucun ciblé ne remplace le full final.

- sdk-affected-initial: FAIL, source ed491ea60cc8e7d186725c926bb7b40388225fb9d52c7644f1f51688812f9fc3. First actual affected unit gate rejects the invalid synthetic fixture DAG: a node in outside drills to outside. Static fixture assurances did not predict this validation failure.
- sdk-affected-v2: FAIL, source 761e308c9a679a85191dba74df7db0f3059e0a714664def0c86e0ea0921c6ffb. After fixture correction, one actual unit case still fails: selecting a child when original root is outside grant loses an admitted parent. This is a concrete source behavior failure, not a passing static proof.
- sdk-affected-v3: ENVIRONMENT_BLOCKED, source e89e4f99698783241a05aaaad46a5b34cf4d3ba8bb8a8cdb9c52e452f8083435. Corrected source passed affected TypeScript,72/72 unit in5685.7745ms and Studio build. Browser startup then exited1 after31563.081ms with zero executed cases; not26 failed cases or product browser PASS.
- sdk-consumer-direct-e89e: PASS, source e89e4f99698783241a05aaaad46a5b34cf4d3ba8bb8a8cdb9c52e452f8083435. Independent fixture direct compile exit0,11905.53ms (Vite6.4.3 reported10.33s). Compilation only, no browser/native/published SDK claim. This record binds immutable direct runtime/log/exit, not shared build receipts later regenerated by v6.
- sdk-browser-affected-v4: ENVIRONMENT_BLOCKED, source e89e4f99698783241a05aaaad46a5b34cf4d3ba8bb8a8cdb9c52e452f8083435. Browser v4 used explicit workspace cwd/absolute CLI. Studio all-interface preview reported port4173 occupied and silently tried4174, then timed out. CLI1, zero executed cases,31131.717ms; not a slow consumer compilation verdict.
- sdk-browser-affected-v5: ENVIRONMENT_BLOCKED, source e89e4f99698783241a05aaaad46a5b34cf4d3ba8bb8a8cdb9c52e452f8083435. Browser v5 added strictPort to Studio all-interface bind. Preview failed immediately on4173; CLI1, zero executed cases,1198.2800000000002ms. Bounded later port diagnostics identified a desktop outgoing HTTPS-bound socket, not an HTTP listener; no desktop process may be stopped.
- sdk-browser-affected-v6: FAIL, source e89e4f99698783241a05aaaad46a5b34cf4d3ba8bb8a8cdb9c52e452f8083435. Loopback-only Studio --host127.0.0.1 --strictPort made both required servers available. Actual26-case affected run then completed24PASS/2FAIL,CLI1,118341.847ms. Two failures remain genuine recorded gate failures, distinct from prior zero-case startup blocks and later source/test corrections.
- sdk-browser-affected-v7: FAIL, source b35dd6a205a9ced6cf3bde637ddd91a68aaced6dd3cd2f7ea3dad773f0719a9b. After separate CSS hit-testing and actual SVG-path visibility assertion corrections, v7 completed25/26PASS1FAIL,CLI1,68100.64899999999ms onb35. Remaining failure was synthetic host outputB horizontal overflow446px at390px. This is a retained browser FAIL, not a final source PASS.
- sdk-browser-affected-v8: PASS, source 22b55ab4c4157fce2f30da641820d126c72d017c5eff571685d075af69484e5c. After fixture output wrapping and meaningful SVG finite width-or-height/stroke/canvas-overlap assertions, v8 completed26/26PASS,CLI0,58601.638999999996ms on22b55. It qualifies that affected case set on its own source only; subsequent18d shipped startup/config/docs changes need their actual final gates.

Aucun échec inattendu dans la gate primaire finale.

- Whole DiagramCloud V2 and each of the eight original workstreams remain PARTIAL: Core général; Studio autonome; Galaxy Atlas et projets externes; Catalogue général IT; Analyses, bridges et diagnostics; Qualité des visualisations; Intégrations; Publication.
- The authority plan .local/v2-core-sources/next-host-sdk-plan.json retains exactly five original feature clauses and seven original UX rows, twelve original rows total. Its acceptance and PENDING_CHECKPOINT/native-adoption states are provenance, not execution instructions, external grants, owner approval or current PASS.
- This is a local source-module entrypoint in the existing private package. No published npm SDK, package export/distribution, installed native host, external owner adoption, commit CI, release acceptance or publication is claimed.
- A pinned shared producer/schema/core/host capability wire contract and actual owner adapter/version negotiation remain open. Local React props and bounded callbacks do not implement or grant an owner protocol.
- Standalone VSIX editor/library and compact companion, selected VS Code/Cursor installation/update/rollback, and installed Hub/PM/Brain/React open-inspect-source/evidence-return routes remain OPEN.
- No SDK authoring, reviewed apply, observation approval, automatic mutation or publication API is exposed. Any future edit remains an explicit host-owned reviewed transaction using the existing guarded patch path.
- Repository revision vectors, deployment/workspace context and custom artwork are omitted from this public viewer. Broader spatial/3D parity, owner Mosaic native picks and automatic context-loss restoration are not qualified by this local 2D slice.
- No remote authenticated agent API or live Studio control is established. Static selected-file stdio, local read-only React callbacks and inert request files remain separate surfaces with their existing limits.
- Selected-edge context download remains unavailable. There is no automatic source URI opening, unrelated-view/global-context fallback or authoring JSON backup through the viewer.
- The calling host owns authorization and already possesses its input in the same JavaScript realm; the viewer is not a sandbox against that host. Immutable input/scope/selection updates and unique React identifierPrefix values across SSR roots remain host obligations; SSR/hydration is not qualified here.
- No fresh CLI, native editor, PPTX, nonselected browser/bundler, real client, private atlas or other-product qualification is added. Prior sealed checkpoints remain dated history; the prepared next catalogue proposal is not part of this React checkpoint.
- Whole V2 and all eight workstreams remain PARTIAL. Exact original SDK/host criteria retain PENDING_CHECKPOINT/native-adoption limitations; an archive acceptance row is not an external write/install/publish grant.
- This is a local public React viewer slice only if declared and evidenced in final scope. No second canvas/model/store, arbitrary command, filesystem/token provider, observation approval or automatic apply authority.
- The independent fixture consumer is test-only. Its output bundles stay ignored and local; only a source-bound bounded build receipt is delivered. A source entrypoint is not a published/installable SDK.
- Actual typed owner host contracts, Hub/PM/Brain routes, selected VS Code/Cursor install/update/rollback, native picks/WebGL restoration and author SDK transaction adoption remain unqualified.
- Public callbacks/context must remain scoped after publicDocument; public project-wide metadata or invalid-selection fallbacks are not permission to widen scope.
- No raw Project, GraphSnapshot, AnalysisBundle, selected author context or atlas evidence exception. Only explicit PNG and bounded safe metadata are selected.
- Previous sealed Core/Sources checkpoint is metadata-only dated history. None of its counts, compiler/browser failures, corrections, diagnostics or captures are inherited as current facts.
- Current optional diagnostic history is root supplied only; absence records no attempts. Focused success never replaces the final full browser result.
- No new renderer/PPTX/native/CLI qualification inferred. Private raw logs/traces/sessions, credentials, owner artifacts and fonts remain excluded.
- Dirty local source only; no exact-commit remote CI, complete V2 acceptance, release READY, owner acceptance, commit/push/merge/deploy/cloud/spending/publication or other-product write.
