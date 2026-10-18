# PARTIAL — Core / Sources DiagramCloud V2

Le périmètre effectivement figé et revu, distinct des préparations ignorées :

- Galaxy : refus générique des apps[].id dupliqués avant conversion en manifest, sans création ni mutation du projet courant ; les identifiants distincts dont les slugs se ressemblent gardent leurs propres relations.
- Sources & Bridge : résumé transitoire en lecture seule dans Structure, Evidence et le résultat configuré. Il distingue producteur inconnu, version du consommateur connue, demandes d'analyse, sorties produites, admission connue ou inconnue, empreinte agrégée et empreintes de fichiers réellement fournies.
- La sélection explicite d'un repository ne retombe pas sur un reçu global. Un bundle et un sélecteur repository ne sont pas joints implicitement ; chaque ligne de bundle conserve repositoryId et sourceId.
- La projection publique produit un message constant avant de lire les métadonnées privées du reçu. Les citations publiques restent accessibles et ne constituent pas une preuve de lecture. Les tableaux restent utilisables sur 390px.

| Chantier | Progrès local borné | Critères ouverts |
|---|---|---|
| 1. Core général | Le consommateur Galaxy refuse les IDs d'app dupliqués sans mutation et conserve les endpoints des IDs distincts à slugs proches. Identité canonique many-to-many, aliases/mirrors et suffixes persistants indépendants de l'ordre restent ouverts. | Core transverse partiel ; source IDs, memberships, états, métriques et autorisations complets restent ouverts. |
| 2. Studio autonome | Surfaces existantes conservées ; les seuls changements déclarés sont ceux du scope source-bound ci-dessous. | Aucune parité générale multi-hôtes, nouveau store ou second modèle admis par cette qualification. |
| 3. Galaxy Atlas et projets externes | Le consommateur Galaxy refuse les IDs d'app dupliqués sans mutation et conserve les endpoints des IDs distincts à slugs proches. Identité canonique many-to-many, aliases/mirrors et suffixes persistants indépendants de l'ordre restent ouverts. | Garde d’entrée locale ne certifie ni inventaire owner, client réel, membership many-to-many, aliases/mirrors ou compte provider. |
| 4. Catalogue général IT | Aucune nouvelle fiche catalogue certifiée dans ce lot. | Les critères et valeurs datées précédentes restent conservés ; contenu restant et mapping persistent ouverts. |
| 5. Analyses, bridges et diagnostics | Résumé Sources & Bridge en lecture seule : identités et empreintes fournies, demande versus sortie, parser consommateur, diagnostics typés, limites et UNKNOWN explicites ; projection publique constante. Contrat v5, couverture Hub/Core, versions runtime et permissions owner restent ouverts. | Version/hash/readstatus/consumer/capabilities inconnus restent explicites ; v5 owner/coverage, parser spécialiste et observations ne sont pas inventés. |
| 6. Qualité des visualisations | 5 artefacts PNG/SVG explicites source/hash liés réellement inspectés ; voir dataClass de chaque artefact. | Aucune nouvelle qualification renderer/PPTX/native/CLI héritée ; données synthétiques ou locales autorisées seulement. |
| 7. Intégrations | Réemploi des readers/validateurs et producteurs existants, sans nouveau parser ni protocole ; aucun joint implicite entre scopes. Intégration owner complète et compatibilité multi-host non qualifiées. | Configuration globale providers/MCP reste au produit owner ; pas de permission ou protocole deviné. |
| 8. Publication | Artefacts de revue explicitement sélectionnés, zéro raw Project/Graph/AnalysisBundle/atlas ou bundle owner. | Toutes audiences/destinations, réception owner, CI exact-commit et publication externe restent ouvertes. |

TypeScript/build sortie 0. Unitaire complet **764 réussis / 765, 1 ignorés, 0 échoués, 0 annulés**, 111975.6012ms. Full Chromium **142 réussis / 142, 0 échoués, 0 ignorés, 0 instables**, sortie 0, 462344.07999999996ms. PASS local sur cette source seule, sans acceptation V2 complète.

Source a6998703ea33639ca1873727d3c815c9dc7ed20eb9f55f1dc3a0063ca97951eb, 559 entrées, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0. [Tests](V2-CORE-SOURCES-TESTS.md), [reprise](V2-CORE-SOURCES-RESUME.md). Tous les champs/IDs et les 98 références / 152 lignes restent exacts. Aucune publication externe.

Historique propre à ce lot : .local/v2-core-sources/diagnostic-history.json, SHA256 d2ad0b3e30abf5a38c78076c3e67a8e7bbaa4dfe6d5e4b8c109edd4b286630f8. Les preuves brutes originales restent en place localement avec leurs hashes exacts ; aucune copie browser-focused ni promotion d’un ciblé vers le full courant. L’échec TS2345 initial et le FAIL 14/15 restent enregistrés ; le replay 1/1 ne qualifie que son cas corrigé.
