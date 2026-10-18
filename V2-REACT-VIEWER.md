# PARTIAL — React Viewer DiagramCloud V2

Périmètre final réellement implémenté/revu :

- Implemented local scope bound to this source identity. Actual source-bound execution, counts, consumer-build and visual review are recorded separately in qualification.json. Local qualification does not complete DiagramCloud V2.
- Local public read-only 2D React source entry src/react/index.ts reuses the canonical validated Project, publicDocument, DiagramCanvas and SceneEdge without mounting App, workspace storage or a second model/store.
- Explicit allowedViewIds and controlled projectId/baseRevision/viewId/nodeId-or-edgeId selection fail closed. Optional selection/navigation/source callbacks carry bounded canonical IDs, never locators, commands, tokens or filesystem access; absent callbacks are unavailable and host refusal retains controlled selection.
- Only permitted memberships, attached public sources/evidence and granted child/parent path are presented. Document revision is labelled separately from repository revision; one constant omission warning replaces global repository/workspace/custom-artwork context. Errors use fixed generic text.
- Per-canvas React Flow providers, instance-specific DOM/ARIA/marker identities, scoped viewer styles and generic glyphs provide the implemented isolation seams. Shared card buttons explicitly avoid native host-form submission; Studio defaults remain in the existing shared renderer.
- Input identity, numeric revision, current scoped public content, selection, granted views, callbacks and unmount are rechecked for intent delivery. A cloned document is a new input identity without an invented revision increment.
- On-screen selected context is an internal DTO. Explicit component/view file fallback reuses createCompletionRequest and completionRequestSchema on a single-view public closure, with existing budgets and secret checks; selected-edge file fallback is explicitly unavailable rather than silently broadened.
- Synthetic units, an independent test-only consumer build harness and two-instance browser journeys are included as verification mechanisms, including an enclosing host form and a separate host React Flow canvas. Their actual executions, counts and outcomes belong to root's final evidence, not this candidate scope. Consumer output bundles remain local-only.
- The shipped Playwright configuration now launches both Studio preview and the independent consumer with the controller Node executable, explicit workspace cwd, loopback-only hosts, strict ports and no server reuse. The contract documents the standard production-build then npm run test:e2e route; this reproducible startup seam adds no current gate-result claim.

| Chantier | Progrès local borné | Ouvert |
|---|---|---|
| 1. Core général | Le même Project validé, ses IDs et sa projection publique sont réutilisés ; voir scope déclaré. | Aucun second modèle/store. Sémantique générale, métriques et multi-hôtes restent partiels. |
| 2. Studio autonome | Studio conserve son propre cycle de stockage et de revue ; le viewer local ne le monte pas. | Parité installée/compact-full générale non qualifiée par un consumer synthétique. |
| 3. Galaxy Atlas et projets externes | Aucune adoption provider ou inventaire owner nouveau déclaré. | Appartenance multi-org, clients réels et routes installées restent ouverts. |
| 4. Catalogue général IT | Aucune nouvelle fiche catalogue qualifiée par ce lot. | Tous les champs et critères précédents restent conservés. |
| 5. Analyses, bridges et diagnostics | The local source entry and contract distinguish read/navigation requests and inert existing CompletionKit files from authoring/reviewed apply/publish. No filesystem/token provider, arbitrary URI/command execution, source collection, remote service or live stdio-to-Studio control is added. Broader CLI/MCP/remote/native adoption remains outside this bounded React scope; final evidence is root-owned. | Le stdio statique ne contrôle ni IndexedDB ni permissions ; contrats owner restent requis. |
| 6. Qualité des visualisations | 2 PNG explicites source/hash liés réellement inspectés. | Canvas existant réutilisé ; pas de qualification renderer/PPTX/native/CLI héritée. |
| 7. Intégrations | Local public read-only 2D source entry implements explicit scoped controlled IDs/revision, bounded optional intents, permitted retained-parent navigation, form-safe controls, CSS/provider/DOM-ID isolation and public privacy seams, plus the existing CompletionKit request file fallback for component/view only. Actual consumer build and full regression results are recorded separately in qualification.json. No published package, owner adoption or SDK reviewed-edit transaction is claimed. | Viewer public local seulement ; contrat hôte commun, VSIX, routes installées, authoring SDK et publication restent ouverts. |
| 8. Publication | Revue locale explicitement sélectionnée ; le consumer bundle reste local, metadata de build seulement. | Pas de published SDK, installation, upload ni publication ; aucun raw Project/Graph/AnalysisBundle/atlas. |

TypeScript/build sortie0. Unitaires **774 réussis / 775, 1 ignorés, 0 échoués, 0 annulés**, 68901.8347ms. Full Chromium **146 réussis / 146, 0 échoués, 0 ignorés, 0 instables**, sortie0, 509182.803ms. Consumer build local sortie0, 10017.193099999999ms, bundle non livré. PASS local sur cette source seule ; V2 reste PARTIAL.

Source 18d07d70e42d4c2de6039ea0ef787b779e75cb4905c876e1da115b60a00cb912, 569 entrées, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0. [Tests](V2-REACT-VIEWER-TESTS.md), [reprise](V2-REACT-VIEWER-RESUME.md). Les 98refs/152lignes et tous champs précédents restent conservés. Aucun published SDK/VSIX/owner install/publication.

Historique propre au lot : .local/v2-react-viewer/diagnostic-history.json, SHA256 1183a911919ce1ef7a617749f8bb82fb177de66973aeaf4c5ffaef2174423fcd. Résumé metadata seulement ; toutes les preuves brutes restent locales. Aucun ciblé ne remplace le full final.
