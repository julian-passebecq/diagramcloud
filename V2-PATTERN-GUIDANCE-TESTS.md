# Qualification locale — Pattern Guidance

Produit PARTIAL. Source 7015aaf6c22a26283e8aa2ca9e4a2ebaad5a3219ebb39a877598c38f6661a4d7, 546 entrées, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0.

| Gate réelle | Résultat | Preuve |
|---|---|---|
| TypeScript | sortie 0 | .local/v2-pattern-guidance/typecheck-final.log et exit séparé |
| Build | sortie 0 | .local/v2-pattern-guidance/build-final.log et exit séparé |
| Unitaire complet | 750 réussis / 751, 1 ignorés, 0 échoués, 0 annulés, 91277.4934ms | .local/v2-pattern-guidance/unit-evidence.json |
| Full Chromium, 135 cas réels | 135 réussis / 135, 0 échoués, 0 ignorés, 0 instables, sortie 0, 608721.3799999999ms | .local/v2-pattern-guidance/browser-final-report.json |
| Revue indépendante finale | 1 alias hérité résolu, aucun finding concret ouvert | .local/v2-pattern-guidance/independent-final-review.json |
| Inspection UI | 9 PNG réellement vus et liés par hash | .local/v2-pattern-guidance/visual-review.json |

Les comptes unitaires viennent du reçu réel, sans constante 751. Les 135 cas sont vérifiés contre les statistiques finales ; ces helpers ne lancent aucune gate. La première ciblée 4 PASS / 1 FAIL Audience est préservée ; le replay sélecteur v2 est réellement 1 PASS, distinct de full 135. Les 24 tests du writer sur Node 26 ne sont pas hérités comme qualification Node 22.

La revue indépendante vérifie avec les sources réelles les copies de requiredKinds/requiredTags/evidenceRequirements/gaps et requirements/tags/perspectives/scalar, la mutation de la réponse query et la guidance. Les registres, prochains appels et Project restent inchangés ; ajout de faits privés invisible au query public, repo invalide vide/unknown, règles du matcher identiques. Aucun nouveau modèle ou observation n’est introduit.

Les trois parcours navigateur lisent les cartes/sources, ouvrent un détail existant avec parent retenu, comparent le JSON auteur, testent Portfolio/Present, le reset transitoire et 390 px sans overflow. Les liens externes sont inspectés sans les ouvrir. Les sept PNG obligatoires sont deux cartes auteur, détail natif, deux projections publiques et deux cartes 390 px. Ce sont des exemples synthétiques, pas des clients réels ni exécutions.

Aucun échec inattendu dans la gate primaire finale.

- Whole V2 and all eight workstreams remain PARTIAL; this bounded local slice does not close broader original acceptance.
- Only two authored static cards are added. Other catalogue topics, workflows, specialists, real clients and full content remain open.
- Applicability remains UNKNOWN_NOT_ASSESSED; coarse kind/tag candidates and context citations do not prove applicability, deployed/conformant results or persisted reference-to-instance mapping.
- Five primary documentation pointers distinguish authored content revision, packet review, retrieval and provider page dates. All external revisions remain null/UNKNOWN; no immutable upstream content hash or live freshness check.
- Copying returned arrays/requirements resolves one pre-existing alias. Matching rules, canonical Project, evidence/observations, membership and statuses are unchanged.
- Initial focused browser remains 4 PASS / 1 FAIL: exact-label Audience selector that did not resolve the observed combobox. A scoped exact selector correction is a separate 1-case replay; it never erases the original failure or replaces full 135.
- Writer 24/24 tests ran on Node 26 as a diagnostic, not this checkpoint’s qualification. Root’s Node 22 integrated/mandatory gates have independent actual receipts.
- No cookbook, renderer, exported figure, PPTX or CLI implementation changed; no inherited bundles/native artifacts promoted to fresh PASS.
- Windows npm/npx launcher uses Node26 while live Playwright controller, child worker and Vite preview execute Node22; actual selected-process metadata is retained. Direct unit execution is Node22. No raw Project, GraphSnapshot or atlas evidence is required or allowed. Private raw logs/traces/sessions, owner viewer bytes, credentials and font binaries are excluded.
- Dirty local source only; no exact-commit remote CI, complete V2 acceptance, release READY, owner acceptance, publication, commit/push/merge/deploy/cloud/spending or other-product write.
