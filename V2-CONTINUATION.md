# PARTIAL — continuation générale DiagramCloud V2

La V2 reste le Studio architectural complet : simple pour un projet isolé, puissant pour Galaxy et réutilisable pour les clients, indépendamment de T3. Cette passe poursuit le contrat général après le checkpoint r4 ; elle ne déclare aucun chantier entièrement accepté. Le [suivi des huit chantiers](docs/product/V2_WORKSTREAM_STATUS.md) conserve les 98 références originales, les dix mappings r4 et les douze ancrages UX r4.

| Chantier | Avancée de cette passe | Critères encore ouverts |
|---|---|---|
| 1. Core général | Sémantique des six facettes, séparation des vérifications générales, conservation des sources et rapports de pertes. | Identités et appartenances globales, réconciliation courante et autres critères core restent ouverts. |
| 2. Studio autonome | Inspection des six axes, revue humaine, historique, annulation sans suppression, sauvegarde et réouverture testées. | Agencement complet des panneaux, Follow/Pin et toutes les combinaisons de profils restent ouverts. |
| 3. Galaxy Atlas et projets externes | Références de dépôts partagés/homonymes conservées sur les preuves privées du brief, sans effacer les légendes approuvées. | Inventaire de comptes, appartenance multi-organisation globale, adaptateurs d’états et vrais clients restent ouverts. |
| 4. Catalogue général IT | Socle existant conservé ; aucun lot de fiches ou workflows supplémentaires livré dans cette passe. | Contenus sélectionnés, branches/retries/occurrences et exemples clients sourcés restent ouverts. |
| 5. Analyses, bridges et diagnostics | Une facette ne satisfait plus un contrôle runtime, une couverture ou une gate générale ; diagnostics et producteurs existants réutilisés. | Completion kit, couverture des bridges et usages/compteurs restent ouverts ; contrat producteur usages manquant. |
| 6. Qualité des visualisations | Chevauchements lineage corrigés ; contrôle géométrique inchangé sur 3 948 figures, avec projections denses réelles. | Autres critères de représentation, migrations, vues alternatives et limites du viewer propriétaire restent ouverts. |
| 7. Intégrations | CLI/MCP requalifiés hors du dépôt ; raccord local existant conservé dans le parcours global. | VSIX installé, contrats spécialistes et adoption native Mosaic/T3 restent ouverts ; aucun dépôt propriétaire modifié. |
| 8. Publication | HTML hors ligne, confidentialité, notes/annexe PPTX et trois slides natives inspectées pour les facettes. | Livraison complète, destination privée approuvée, CI exacte et acceptation owner restent ouvertes. |

## Preuves et limites

- TypeScript et build PASS ; tests unitaires : **710 réussis sur 711, un contrôle optionnel ignoré**, zéro échec. L’atlas local réel a servi aux contrôles géométriques et aux projections denses ; 3 948 figures, zéro défaut, sans modifier le checker.
- Navigateur complet : **123 réussis, 1 échoués, 0 ignorés, 0 instables**, sortie 1. La gate reste FAIL. Les tests ciblés ne la remplacent pas.
- 21 contrôles CLI/MCP hors dépôt et sans NODE_PATH PASS. Trois slides du deck des facettes exportées par PowerPoint puis inspectées ; confidentialité et provenance vérifiées.
- Sources figées : 7cbee018f35c98338d09c3c4beeddecaf3c17485acc812d45bf5b7cc11cb5694, 526 fichiers sélectionnés. HEAD 091947452683102849eb225d67ef870fc6e2f1d0, branche codex/concept-preview-r4, modifications non committées. Le périmètre du vecteur inclut désormais aussi documentation, exemples et configurations ; son nombre de fichiers n’est pas un nombre de nouvelles fonctions.

- Échec navigateur : draw.io export: every public view as a page, and the file imports back with the same components (interchange.spec.ts:103).

Le diagnostic draw.io a observé un délai avant le signal de fin du navigateur, après réception de tous les octets. Il ne prouve pas la cause du timeout historique. Les échecs/tentatives provisoires sont conservés et distingués dans [les résultats détaillés](V2-CONTINUATION-TESTS.md).

Le paquet est **STAGED LOCAL REVIEW**, préparé sous .local/v2-continuation/delivery/review-20261015-general-v2 avec manifeste et hashes. L’archive nocturne précédente et les rapports OVERNIGHT restent des checkpoints historiques inchangés. La publication attend une destination privée explicitement approuvée. Aucun commit, push, merge, déploiement, nouvelle dépense, accès client non accordé ou écriture dans un autre produit.

Les usages/compteurs attendent un contrat producteur natif versionné, pas une permission déduite du dossier proposé. Les autres tâches indépendantes ouvertes restent identifiées dans [V2-RESUME.md](V2-RESUME.md) ; elles ne deviennent pas des blocages de permission par commodité.
