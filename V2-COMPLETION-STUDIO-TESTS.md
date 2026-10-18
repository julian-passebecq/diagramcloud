# Qualification locale — Studio et completion kit

Statut produit PARTIAL. Source 39879b8c3d78c50f52de663682f715db6d161efb1d53fca91263b3114028c6fe, 535 fichiers sélectionnés, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0. Node22.23.3 / full Chromium153.0.8010.12 sur Windows ; même distribution que la gate précédente.

| Contrôle | Résultat réel | Preuve locale |
|---|---|---|
| npm run check | sortie0 | .local/v2-completion-studio/typecheck-final.log |
| SOURCE_DATE_EPOCH=1792023600 npm run build | sortie0 | .local/v2-completion-studio/build-final.log |
| node node_modules/tsx/dist/cli.mjs --test --test-concurrency=4 tests/*.test.ts, DIAGRAMCLOUD_QUALITY_DOCS=atlas sélectionné | 730total,729PASS,1SKIP,0FAIL, 111496.6388ms | .local/v2-completion-studio/unit-evidence.json |
| npx playwright test --config .local/v2-completion-studio/browser-final.config.ts | 129 réussis, 0 échoués, 0 ignorés, 0 instables, sortie0, 635785.5449999999ms | .local/v2-completion-studio/browser-final-report.json et .log |
| Revue indépendante | Trois findings corrigés et reproductions synthétiques recontrôlées | .local/v2-completion-studio/completion-security-review.json |
| Inspection UI | Quatre images finales vues par root, hashes liés aux fichiers réellement produits | .local/v2-completion-studio/visual-review.json |

Atlas local sélectionné : SHA256 07c3a0717f241c37539830c79b374761154b5bb62df45d03e5fca6308796e07b, snapshot antérieur de ce dépôt, sans données ni certification d’un client. Ses 3 948 figures et projections denses passent les contrôles inchangés ; seul le real-stage indépendant optionnel sans entrée est ignoré. Le log unitaire brut privé reste hors livraison.

Le premier check d’intégration a détecté un accès ZodDefault incorrect, le suivant deux erreurs de typage dans la nouvelle fixture unitaire ; tous corrigés avant la gate finale. 31 tests ciblés puis huit parcours ciblés ont passé. Leur première capture de revue, partiellement défilée, a été remplacée dans le test final par une capture du dialogue sur la section de diff, sans retirer d’assertion ni relever de délai.

La revue a découvert (1) une relation d’une autre vue incluse par simple égalité des endpoints, (2) une erreur de test révélant une légende privée, (3) une question auteur conservée au passage en public. Corrections : appartenance view.edgeIds, champs projetés vides read-only et erreurs publiques génériques, remontage du panneau par projet/audience/sélection et reset de son audience. Tous les changements sont sur le modèle/patch existants ; le schéma Project reste identique.

Les anciens checkpoints ont leurs résultats propres : 7cbee… =710/711unit et123/124browser, draw.io FAIL ; ancien overnight =683/685unit et121/122browser. Le diagnostic isolé Headless Shell passe une fois (4.148s), les replays isolés full Chrome avaient aussi passé ; aucun ne prouve la cause du timeout dans la suite. Aucun timeout ou contournement sécurité ajouté.

- Whole V2 and all eight workstreams remain PARTIAL. Bounded caption completion and context-panel pinning are not the full original clauses.
- Public empty and source-redacted captions are equally read-only; public requests never permit author-text block edits. Source-derived/synthetic/reference blocks, facts, observations, visibility, review and permissions cannot change through completion.
- No structural completion, new source extraction, AI call, automatic transmission, remote grant, exactly-once cross-host receipt or live MCP/browser-storage authoring is implemented.
- Pins retain canonical IDs in this mounted session only. They do not persist in Project, keep historical facts or replace the active editor selection.
- Usage/counter ingestion remains open: only a dossier example marked non-importable was supplied, not a pinned Agent/Config producer contract. Independent work continues.
- The Petit client workflow is structurally prequalified in ignored local QA only, still PRIVATE_DRAFT. No cookbook/template adoption, real client or occurrence is claimed in this checkpoint.
- Historical full-browser draw.io failures and both isolated diagnostics remain separate. No cause, timeout fix, security bypass or general Chrome distribution conclusion is claimed.
- Renderer/PPTX/CLI implementation files are unchanged by this slice; prior native/export/bundle proofs are dated checkpoints, not newly executed gates inherited here.
- One independent real-stage unit gate without selected input remains optional/skipped; actual selected-atlas geometry and dense checks ran.
- Dirty local source only; no exact-commit remote CI, release readiness, owner acceptance or deployment. No commit/push/merge/cloud/spending/other-product write/publication.
- Private atlas contents/renders, raw unit log, sessions/traces, owner viewer bytes, fonts and negative secret fixture bytes are excluded from delivery.
