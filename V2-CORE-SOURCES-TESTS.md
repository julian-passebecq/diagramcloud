# Qualification locale — Core / Sources

Produit PARTIAL, source a6998703ea33639ca1873727d3c815c9dc7ed20eb9f55f1dc3a0063ca97951eb, 559 entrées, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0.

| Gate réelle | Résultat | Preuve |
|---|---|---|
| TypeScript | sortie 0 | .local/v2-core-sources/typecheck-final.log et exit séparé |
| Build | sortie 0 | .local/v2-core-sources/build-final.log et exit séparé |
| Unitaire complet | 764 réussis / 765, 1 ignorés, 0 échoués, 0 annulés, 111975.6012ms | .local/v2-core-sources/unit-evidence.json |
| Full Chromium, 142 cas réels | 142 réussis / 142, 0 échoués, 0 ignorés, 0 instables, sortie 0, 462344.07999999996ms | .local/v2-core-sources/browser-final-report.json |
| Revue indépendante | 2 findings comptabilisés, aucun ouvert | .local/v2-core-sources/independent-final-review.json |
| Revue visuelle | 5 PNG/SVG réellement vus | .local/v2-core-sources/visual-review.json et required-artifacts.json |

Tous les comptes viennent des reçus actuels et expectedCases du cas-set réellement listé. Aucun résultat précédent hérité. Les artefacts sont limités au manifeste explicite root, avec SHA/bytes/type/dataClass synthétique ou local autorisé ; aucun Project/Graph/AnalysisBundle/atlas raw.

| Clause originale | Rôle | Progrès | Preuve ou limite |
|---|---|---|---|
| v2:identity | primary | PARTIAL | Le consommateur Galaxy refuse les IDs d'app dupliqués sans mutation et conserve les endpoints des IDs distincts à slugs proches. Identité canonique many-to-many, aliases/mirrors et suffixes persistants indépendants de l'ordre restent ouverts. |
| r3:bridge-workspace | primary | PARTIAL | Résumé Sources & Bridge en lecture seule : identités et empreintes fournies, demande versus sortie, parser consommateur, diagnostics typés, limites et UNKNOWN explicites ; projection publique constante. Contrat v5, couverture Hub/Core, versions runtime et permissions owner restent ouverts. |
| v2:bridge | secondary | PARTIAL | Réemploi des readers/validateurs et producteurs existants, sans nouveau parser ni protocole ; aucun joint implicite entre scopes. Intégration owner complète et compatibilité multi-host non qualifiées. |
| r3:actionable-gaps | secondary | PARTIAL | Les causes structurées déjà fournies exposent le conseil existant en lecture seule ; le texte libre ne devient pas un classifieur. Actions spécialisées exécutables, permissions et diagnostics non fournis restent ouverts. |

Les 25 critères du plan Core/Galaxy et 3 critères Bridge + 4 UX demeurent des sources d’acceptation, pas des grants d’application. Primary/secondary sont disjoints ; PARTIAL/OPEN ne signifie pas clause achevée.

Historique ciblé propre à ce lot :
Historique propre à ce lot : .local/v2-core-sources/diagnostic-history.json, SHA256 d2ad0b3e30abf5a38c78076c3e67a8e7bbaa4dfe6d5e4b8c109edd4b286630f8. Les preuves brutes originales restent en place localement avec leurs hashes exacts ; aucune copie browser-focused ni promotion d’un ciblé vers le full courant. L’échec TS2345 initial et le FAIL 14/15 restent enregistrés ; le replay 1/1 ne qualifie que son cas corrigé.

- galaxy-affected — source ad5b059593f83de72bc98dad684728bf54e630a00ef312568a4ce42ce32071c1 (554 entrées), **PASS historique** : typecheck PASS (sortie 0); unit PASS (sortie 0, 21/21 PASS, 0 FAIL); build PASS (sortie 0); browser PASS (sortie 0, 2/2 PASS, 0 FAIL). Affected local Galaxy source-binding slice only, before Sources/Bridge additions. Does not qualify current source.
- bridge-affected-initial-typecheck — source 16b8595010ff24f2d0e065272fd34da7e65d2e6380383a40f06f42f964bfc43e (559 entrées), **FAIL historique** : typecheck FAIL (sortie 2); unit NOT_RUN; build NOT_RUN; browser NOT_RUN. First Bridge attempt stopped by compiler before unit/build/browser; absence is NOT_RUN, not a passing or failing browser execution.
- bridge-affected-v2 — source 0be79c0b984aaf8cecaab20b9730b9d3396fec90ba75b13447647e8f18b67f76 (559 entrées), **FAIL historique** : typecheck PASS (sortie 0); unit PASS (sortie 0, 25/25 PASS, 0 FAIL); build PASS (sortie 0); browser FAIL (sortie 1, 14/15 PASS, 1 FAIL). Affected Bridge gate after test-only type correction. Browser failure retained: reused saved fixture revision1 versus incoming revision0 correctly disabled Apply.
- bridge-affected-v3 — source a6998703ea33639ca1873727d3c815c9dc7ed20eb9f55f1dc3a0063ca97951eb (559 entrées), **PASS historique** : typecheck NOT_RUN; unit NOT_RUN; build NOT_RUN; browser PASS (sortie 0, 1/1 PASS, 0 FAIL). One corrected public-fixture isolation browser case only on latest source. It does not rerun or promote all 15 earlier cases, nor replace final full142.

Aucun échec inattendu dans la gate primaire finale.

- Identité canonique many-to-many, aliases/mirrors et stabilité des suffixes selon l'ordre : ouverts. Ce garde local ne certifie ni inventaire owner ni projet client réel.
- Contrat v5 et fixtures compatibles owner non fournis ; versions installées du producteur, fraîcheur, couverture d'origine des bundles et permissions non enregistrées restent UNKNOWN.
- Le reader existant ne distingue pas l'absence d'un reçu de certains reçus invalides. Les sélecteurs/hashes structurés Graph perdus lors de la compilation ne sont pas reconstitués depuis le texte.
- La session live Sidecar et son autorisation ne sont pas injectées dans ce résumé. Les propositions IA, observations et décisions humaines ne sont pas automatisées.
- Studio : disposition de panneaux de session précédemment qualifiée, parité multi-hôtes et persistance générale encore ouvertes. Catalogue : aucune nouvelle fiche dans ce lot.
- Visualisations et publication : aucune nouvelle modification de renderer ni qualification PowerPoint dans ce lot ; aucun export public de données privées et aucune publication externe.
- React SDK, VSIX installée, contrat hôte commun et réception Mosaic native : ouverts. Les plans ignorés ne sont ni des implémentations ni des autorisations.
- Les huit chantiers V2 restent PARTIAL et leurs 98 références originales restent conservées. Cette qualification locale ne vaut ni CI exact-commit ni acceptation complète V2.
- Whole V2 and all eight workstreams remain PARTIAL; local primary/secondary clause progress never closes complete original acceptance.
- Only the final root-declared scope is reported; ignored preparations and plans are evidence of requested scope, not grants or implemented/qualified features.
- Galaxy input identity guards do not establish canonical many-to-many membership, alias/mirror equality, provider inventory or real-client qualification.
- Sources/consumer status must distinguish producer, source, consumer parser, selected/read/generated scope and explicit unknowns. A requested analyzer, reference, content digest or source revision is not an execution/permission/observed fact.
- Modern v5 coverage or owner APIs require supplied compatible contracts and fixtures; no new owner schema, parser engine, automatic fact completion or observation approval is inferred.
- No raw Project, GraphSnapshot, AnalysisBundle, selected author context or atlas evidence exception. Only explicitPNG/SVG artifacts and sanitized bounded gate/review metadata selected.
- Previous sealed Studio checkpoint is metadata-only dated history. Its interruptions, report copies, visual finding, captures and gate results are not facts or fresh PASS of this lot.
- No renderer/PPTX/CLI fresh qualification inherited. Private raw logs/traces/sessions, credentials, owner viewer bytes and fonts excluded.
- Dirty local source only; no exact-commit remote CI, complete V2 acceptance, release READY, owner acceptance, publication, commit/push/merge/deploy/cloud/spending or other-product write.
