# Qualification locale — Studio layout

Produit PARTIAL. Source d92d06a87d26fc8aa21927b07c2c31b6431d99c9efd5c35fccec3e556dbb5b50, 552 entrées, dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0.

| Gate réelle | Résultat | Preuve |
|---|---|---|
| TypeScript | sortie 0 | .local/v2-studio-layout/typecheck-final.log et exit séparé |
| Build | sortie 0 | .local/v2-studio-layout/build-final.log et exit séparé |
| Unitaire complet | 754 réussis / 755, 1 ignorés, 0 échoués, 0 annulés, 117155.6722ms | .local/v2-studio-layout/unit-evidence.json |
| Full Chromium, 138 cas réels | 138 réussis / 138, 0 échoués, 0 ignorés, 0 instables, sortie 0, 818464.989ms | .local/v2-studio-layout/browser-final-report.json |
| Revue indépendante | 1 findings comptabilisés, aucun concret ouvert | .local/v2-studio-layout/independent-final-review.json |
| Inspection UI | 7 PNG réels source/hash liés | .local/v2-studio-layout/visual-review.json |

Les comptes viennent des reçus réels. Le nombre de cas du full doit égaler expectedCases explicitement fourni par root dans browser-runtime.json ; aucun total prévisionnel ou ancien PASS hérité. Les helpers ne lancent aucune gate.

Historique ciblé, distinct du full final :
- browser-focused: 8 PASS / 0 FAIL / 0 SKIP / 0 flaky, exit 0.
- browser-focused-v3: 1 PASS / 0 FAIL / 0 SKIP / 0 flaky, exit 0.

Première tentative full sur source b5f2327313a86a0536483a0ca39421a68f970521bf1ac1bbc3aa9bce8e2bfa88 : INTERRUPTED par root pour LAYOUT-VISUAL-01, CLI exit -1, aucun résultat complet de 138 cas. Les résultats core terminés de cette ancienne source (754/755, 1 skip ; tsc/build exit 0) restent historiques, jamais la qualification finale. Les logs privés ne sont pas joints. Le JSON focused a été relocalisé octet pour octet, sans nouvelle exécution.

Tentative focused-v2 : NOT_RUN / ENVIRONMENT_BLOCKED avant tout test, CLI exit 1. Le preview détaché du full interrompu occupait 4173 ; root a vérifié le processus précis puis arrêté uniquement ce preview. Le petit JSON startup, si présent, ne contient aucun cas exécuté. Log/exit/config originaux restent locaux sous .local/v2-studio-layout/history/focused-v2-port-startup. Focused-v3 est une tentative distincte, lue uniquement depuis ses résultats réels.

Les cinq PNG obligatoires montrent sidebar droite, reset avec Pin retenu, révocation publique et récupération à 1150 px et 390 px. Le parcours synthétique exige JSON auteur inchangé, sélection B distincte du Pin A, filtre Navigator retenu, clavier, profils, projection privée/publique, Close séparé, projet/reload et stockage de préférence indisponible. Tout résultat réel reste lié aux reports ; les assertions présentes dans le patch ne sont pas des réussites.

Aucun échec inattendu dans la gate primaire finale.

- Whole V2 and all eight workstreams remain PARTIAL; bounded local panel controls do not close original full clauses.
- The existing sidebar moves as one pane. Independent Navigator/Inspector docking, bottom docking, saved layouts and custom pointer dragging remain open.
- Preferences are session-only numbers/enums/booleans. Reload/project/host switch resets only layout; no localStorage/IndexedDB/profile-v1 writes or host settings changes.
- Collapse preserves mounting and current privacy updates. Existing Close details continues to unmount/reset Follow; layout reset is not Close or permission.
- The current Web slice does not implement Hub/PM/VSIX compact/full environment/variant/revision/return transport, a new semantic zoom model, dense scope or graph facts.
- Focus attempt dispositions are retained from actual report/log/exit files as diagnostic history, never inherited as primary final full qualification.
- Focused-v2 was blocked before tests by the old detached preview on 4173: ENVIRONMENT_BLOCKED/NOT_RUN, CLI 1, zero executed cases and zero product-test failures. Root stopped only the verified workspace preview; later focused-v3 is a separate actual attempt.
- LAYOUT-VISUAL-01 was found in an actual 390px capture: compact controls incorrectly described desktop-request numbers as effective pixel widths. Compact labels now say desktop request/full width; desktop effective labels and canonical facts remain unchanged.
- The first old-source full browser attempt was interrupted by root for that concrete correction, CLI exit -1, with no completed full result. It is INTERRUPTED, not a completed browser FAIL or PASS; old completed core/focused gates remain dated history only.
- The initial focused JSON reporter was copied byte-identically from a nested relative output to its canonical path. No test rerun occurred; executed config/original output stay preserved locally. Future reporter outputs use absolute paths.
- No renderer/export/PPTX/CLI implementation change or fresh native/bundle/owner qualification is claimed; previous checkpoints remain dated history.
- No raw Project, GraphSnapshot or atlas evidence exception. Private raw logs/traces/sessions, owner viewer bytes, credentials and font binaries are excluded.
- Dirty local source only; no exact-commit remote CI, complete V2 acceptance, release READY, owner acceptance, publication, commit/push/merge/deploy/cloud/spending or other-product write.
- Layout retains canonical positions and the interactive canvas viewport; it does not promise automatic Fit view after panel/viewport resize. Existing pan/zoom/Fit view controls remain needed for off-screen cards. Existing long context-tab labels wrap in narrow default-width columns.
