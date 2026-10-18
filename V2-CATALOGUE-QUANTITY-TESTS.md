# Qualification locale — Catalogue et quantités

Produit PARTIAL, source 11aff5ba168bd8d9ca3dcf8e6268ee83f2c260282bdb6ae14bae46c72074a313, 543 entrées, HEAD dirty 091947452683102849eb225d67ef870fc6e2f1d0.

| Gate réelle | Résultat | Preuve |
|---|---|---|
| TypeScript | sortie0 | .local/v2-catalogue-quantity/typecheck-final.log et exit.txt |
| Production build | sortie0 | .local/v2-catalogue-quantity/build-final.log et exit.txt |
| Unitaire complet | 743 réussis / 744, 1 ignorés, 0 échoués, 0 annulés ; 103352.3112ms | .local/v2-catalogue-quantity/unit-evidence.json |
| Full Chromium, 132 cas découverts | 132 réussis / 132, 0 échoués, 0 ignorés, 0 instables ; sortie0 ; 668946.098ms | .local/v2-catalogue-quantity/browser-final-report.json |
| Revue indépendante finale | 2 findings corrigés ; aucun finding concret ouvert | .local/v2-catalogue-quantity/independent-review-final.json |
| Inspection UI | 6 PNG réellement inspectés, source/hash liés | .local/v2-catalogue-quantity/visual-review.json |

Les comptes unitaires ci-dessus viennent du reçu réel, jamais d’une constante prévue. Les 132 cas navigateur sont vérifiés contre les statistiques finales ; aucune gate n’est lancée par ces helpers.

L’original Petit client a été comparé octet pour octet à l’entrée r3 de l’archive fournie : SHA d1c33ff28eea2584d9125b433e3891fdcf373ed6de202ab1c7f552508202f8a8, archive parent bab1150ea6c19d3ee85dba9d1db60c01fb83bc94c975688941cbe890eb163c73, CRC vérifié. Nouvelle instance locale, scope/relations/questions conservés ; nodes/edges/blocks/sources privés, expérience draft privée, zéro observation. Ce sont des définitions synthétiques, pas des occurrences.

Deux défauts concrets ont été corrigés : conversion de ±1e-9999 en faux zéro connu ; ancienne lecture File.text écrasant une saisie Guided title/ID/summary/steps. Les vrais zéros exponentiels et 5e-324 restent valides ; chaque entrée invalide produit une seule perte générique. Load/restore/manual JSON/quatre champs/source/close invalident les anciennes lectures. Le parcours conserve l’ancien projet et sauvegarde/réouvre seulement après Apply humain.

La première gate ciblée reste **7 PASS / 1 FAIL** dans browser-focused-report.json ; le correctif mobile et les preuves finales ne l’effacent pas. La gate primaire finale n’a aucun échec inattendu.

Les captures UI conservent leurs limites de viewport/sticky header ; une capture Chromium supplémentaire après défilement montre le ledger de pertes et Apply, sans remplacer la gate132. Les cinq artefacts obligatoires sont trois vues du template, la revue quantité et quantity-import.public.json. Ce dernier seul est autorisé comme Project de preuve : native validateDocument, projection publique identique, fixture synthétique exacte, observations vides, aucun champ/objet privé, zéro synthetic conservé et quantité non fournie absente. Aucun autre raw Project/atlas/GraphSnapshot n’est admis.

La gate unitaire actuelle a rendu 3948 figures du snapshot local explicitement sélectionné, zéro défaut, contrôles inchangés. Ce snapshot antérieur ne certifie aucun client ni nouvel export natif.

- Whole V2 and all eight workstreams remain PARTIAL; local gate results do not close the complete original clauses.
- Only one supplied synthetic workflow is adopted as a private Guided template. Seven other workflows, catalogue patterns/recipes and real client workflows remain open.
- Source original and reference card remain byte-exact with their dated NOT_RUN assertions. New adoption evidence does not rewrite original dossier claims.
- Load and restore affect an editor draft only. Preview and human Apply are separate; no occurrence, execution, timing, actor/gate/retry or runtime observation is invented.
- Absent/invalid quantity stays unknown. Supplied finite valid zero stays zero; nonzero underflow is omitted. Units, provenance and encoded notes remain source-declared, never a runtime measurement.
- No metric window/scope/SLO/capacity, Agent/Config usage, reset, deduplication, caches, quota, estimated cost or billing producer contract is closed.
- Initial focused browser run remains 7 PASS / 1 FAIL. Root separately found background hero-title>div horizontal overflow: 449px at 390px after two frames plus 200ms. min-width:0 and overflow-wrap:anywhere preserve full text and the unchanged test predicate; this is separate from the two independent-review findings.
- Independent review found nonzero-underflow false zero and stale file read superseding Guided field edits; source fixes and exact counterexamples are recorded separately from browser acceptance.
- No renderer/export/PPTX/CLI implementation change or fresh native/bundle qualification is claimed by this slice. Previous checkpoints and failures retain their own dispositions.
- Private atlases, raw private logs, traces, sessions, owner viewer bytes, font binaries and negative credential fixture payloads are excluded from delivery.
- Dirty local source only. No exact-commit remote CI, complete V2 acceptance, release READY, owner acceptance, publication, commit/push/merge/deploy/cloud/spending or other-product write.

Le correctif mobile root est distinct des deux findings de la revue indépendante : le fond .hero-title>div débordait à 449px pour un viewport de 390px, encore après deux frames et 200ms. min-width:0 et overflow-wrap:anywhere conservent tout le texte ; le prédicat du test reste inchangé. Le reçu log-encoding.json lie les hashes des logs originaux UTF16LE conservés privés et de leurs copies publiques UTF8 sans perte ; les exits réels restent des fichiers séparés.

La nouvelle gate ciblée v2 compte réellement 8/8 réussis, zéro échec/skip/flaky, sortie0 ; ses report/log/exit sont joints. Elle ne remplace ni le focused initial FAIL ni la gate complète de 132 cas.

Une tentative de capture build a été interceptée par PowerShell pendant un warning stderr : résultat produit NOT_CAPTURED, log original privé conservé dans la métadonnée encoding. Ce n’est pas un échec produit inventé ; le build final relancé sur la même source a son exit réel séparé.
