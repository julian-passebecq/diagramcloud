# Reprise — V2 entière PARTIAL

Préserver dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0, source a6998703ea33639ca1873727d3c815c9dc7ed20eb9f55f1dc3a0063ca97951eb, changements et checkpoints. Pas de reset/commit/push/merge/publication/déploiement ni écriture chez un autre owner sans autorisation applicable.

Gate locale de cette source PASS ; elle ne réécrit aucun résultat précédent.

Livré dans ce scope final :
- Galaxy : refus générique des apps[].id dupliqués avant conversion en manifest, sans création ni mutation du projet courant ; les identifiants distincts dont les slugs se ressemblent gardent leurs propres relations.
- Sources & Bridge : résumé transitoire en lecture seule dans Structure, Evidence et le résultat configuré. Il distingue producteur inconnu, version du consommateur connue, demandes d'analyse, sorties produites, admission connue ou inconnue, empreinte agrégée et empreintes de fichiers réellement fournies.
- La sélection explicite d'un repository ne retombe pas sur un reçu global. Un bundle et un sélecteur repository ne sont pas joints implicitement ; chaque ligne de bundle conserve repositoryId et sourceId.
- La projection publique produit un message constant avant de lire les métadonnées privées du reçu. Les citations publiques restent accessibles et ne constituent pas une preuve de lecture. Les tableaux restent utilisables sur 390px.

Ouvert explicitement :
- Identité canonique many-to-many, aliases/mirrors et stabilité des suffixes selon l'ordre : ouverts. Ce garde local ne certifie ni inventaire owner ni projet client réel.
- Contrat v5 et fixtures compatibles owner non fournis ; versions installées du producteur, fraîcheur, couverture d'origine des bundles et permissions non enregistrées restent UNKNOWN.
- Le reader existant ne distingue pas l'absence d'un reçu de certains reçus invalides. Les sélecteurs/hashes structurés Graph perdus lors de la compilation ne sont pas reconstitués depuis le texte.
- La session live Sidecar et son autorisation ne sont pas injectées dans ce résumé. Les propositions IA, observations et décisions humaines ne sont pas automatisées.
- Studio : disposition de panneaux de session précédemment qualifiée, parité multi-hôtes et persistance générale encore ouvertes. Catalogue : aucune nouvelle fiche dans ce lot.
- Visualisations et publication : aucune nouvelle modification de renderer ni qualification PowerPoint dans ce lot ; aucun export public de données privées et aucune publication externe.
- React SDK, VSIX installée, contrat hôte commun et réception Mosaic native : ouverts. Les plans ignorés ne sont ni des implémentations ni des autorisations.
- Les huit chantiers V2 restent PARTIAL et leurs 98 références originales restent conservées. Cette qualification locale ne vaut ni CI exact-commit ni acceptation complète V2.

Ne pas transformer le garde d’entrée Galaxy en modèle d’identité/membership général. Sources/consumer/status/hash restent distincts et les absences UNKNOWN ; aucun contrat v5/APIowner, source inaccessible ou observation automatiquement complété.

Historique propre à ce lot : .local/v2-core-sources/diagnostic-history.json, SHA256 d2ad0b3e30abf5a38c78076c3e67a8e7bbaa4dfe6d5e4b8c109edd4b286630f8. Les preuves brutes originales restent en place localement avec leurs hashes exacts ; aucune copie browser-focused ni promotion d’un ciblé vers le full courant. L’échec TS2345 initial et le FAIL 14/15 restent enregistrés ; le replay 1/1 ne qualifie que son cas corrigé.

- galaxy-affected — source ad5b059593f83de72bc98dad684728bf54e630a00ef312568a4ce42ce32071c1 (554 entrées), **PASS historique** : typecheck PASS (sortie 0); unit PASS (sortie 0, 21/21 PASS, 0 FAIL); build PASS (sortie 0); browser PASS (sortie 0, 2/2 PASS, 0 FAIL). Affected local Galaxy source-binding slice only, before Sources/Bridge additions. Does not qualify current source.
- bridge-affected-initial-typecheck — source 16b8595010ff24f2d0e065272fd34da7e65d2e6380383a40f06f42f964bfc43e (559 entrées), **FAIL historique** : typecheck FAIL (sortie 2); unit NOT_RUN; build NOT_RUN; browser NOT_RUN. First Bridge attempt stopped by compiler before unit/build/browser; absence is NOT_RUN, not a passing or failing browser execution.
- bridge-affected-v2 — source 0be79c0b984aaf8cecaab20b9730b9d3396fec90ba75b13447647e8f18b67f76 (559 entrées), **FAIL historique** : typecheck PASS (sortie 0); unit PASS (sortie 0, 25/25 PASS, 0 FAIL); build PASS (sortie 0); browser FAIL (sortie 1, 14/15 PASS, 1 FAIL). Affected Bridge gate after test-only type correction. Browser failure retained: reused saved fixture revision1 versus incoming revision0 correctly disabled Apply.
- bridge-affected-v3 — source a6998703ea33639ca1873727d3c815c9dc7ed20eb9f55f1dc3a0063ca97951eb (559 entrées), **PASS historique** : typecheck NOT_RUN; unit NOT_RUN; build NOT_RUN; browser PASS (sortie 0, 1/1 PASS, 0 FAIL). One corrected public-fixture isolation browser case only on latest source. It does not rerun or promote all 15 earlier cases, nor replace final full142.

Ancien Studio scellé source d92d06a87d26fc8aa21927b07c2c31b6431d99c9efd5c35fccec3e556dbb5b50, archive 298e72371e5943cb6a7d9fcdd06516aadec538cc89732f2db78c443cad26af4f, metadata historique seulement. Ses interruptions, copies de rapport et findings n’appartiennent pas à ce nouveau lot. STAGED LOCAL REVIEW sous .local/v2-core-sources/delivery/review-20261015-core-sources après assembly/intégrité. Les 98 références / 152 lignes et huit chantiers PARTIAL restent conservés.
