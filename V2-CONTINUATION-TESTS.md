# Qualification locale — continuation V2

Statut produit : PARTIAL. Source sélectionnée : 7cbee018f35c98338d09c3c4beeddecaf3c17485acc812d45bf5b7cc11cb5694 (526 fichiers), dirty HEAD 091947452683102849eb225d67ef870fc6e2f1d0. Node22.23.3, Chromium153.0.8010.12, Windows. Aucune CI exacte ou acceptation owner. Les métadonnées et résultats bruts locaux font autorité : .local/v2-continuation/qualification.json.

| Contrôle | Commande / résultat | Preuve locale |
|---|---|---|
| TypeScript | npm run check — sortie0 | .local/v2-continuation/typecheck-qualified-final.log |
| Build | SOURCE_DATE_EPOCH=1792023600 npm run build — sortie0 | .local/v2-continuation/build-qualified-final.log |
| Unitaire complet | node node_modules/tsx/dist/cli.mjs --test --test-concurrency=4 tests/*.test.ts ; DIAGRAMCLOUD_QUALITY_DOCS=atlas local sélectionné — 711total,710PASS,1SKIP,0FAIL ; 128262.311ms | .local/v2-continuation/unit-evidence.json ; log source privé conservé hors livraison |
| Navigateur complet | npx playwright test --config .local/v2-continuation/browser-qualified.config.ts — 123 réussis, 1 échoués, 0 ignorés, 0 instables, sortie1, 592936.138ms | .local/v2-continuation/browser-qualified-report.json et .log |
| CLI/MCP | run-clients.ps1 → scripts/qualify-clients.ts ; 21PASS, bundles hors dépôt/node_modules, NODE_PATH vide | .local/v2-continuation/bundled-client-qualified/receipt.json ; final-clients/QUALIFIED-COPY.json |
| PowerPoint natif | Trois PNG1920×1080 inspectés ; 28parties XML/rels, notes et confidentialité vérifiées | .local/v2-continuation/powerpoint/{fixture-receipt,native-review,visual-review,xml-review}.json |

Le seul skip final est le contrôle indépendant real-stage optionnel sans entrée sélectionnée. Les projections denses et la géométrie du vrai atlas local ont effectivement tourné. L’entrée source privée est identifiée par SHA256 07c3a0717f241c37539830c79b374761154b5bb62df45d03e5fca6308796e07b ; c’est un snapshot antérieur explicitement sélectionné du dépôt courant, sans actualisation ni certification d’un client. Ses contenus et figures ne sont pas livrés. Le checker original a vu quatre chevauchements lineage avant correction, puis zéro sur les mêmes 3 948 figures. Une fixture indépendante synthétique reproduit le défaut ; seuls les titres STEP ont été déplacés de14px.

Les deux nouveaux parcours navigateur passent par import/patch/revue UI, facettes indépendantes, historique FROZEN→CANCELLED, distribution DEPLOYED, développement non sélectionné, runtime inconnu, code/parent conservés, sauvegarde et sélection explicite du projet dans la galerie après reload. Le HTML public réellement téléchargé est ouvert hors ligne, sans requête réseau, et n’expose pas la vérification privée. Preuves : .local/v2-continuation/browser-qualified-results/state-facets-Portfolio-and-a7a51-eaking-private-verification/state-facets.public.html et .local/v2-continuation/browser-qualified-results/state-facets-Portfolio-and-a7a51-eaking-private-verification/state-facets-offline.png.

## Tentatives conservées

- Le checkpoint nocturne précédent : 685tests/683PASS/2SKIP ; navigateur121PASS/1FAIL draw.io. Il ne qualifie pas cette source.
- Première passe ciblée nouvelle : 5PASS/1FAIL, hypothèse erronée d’auto-ouverture après reload ; le test utilise maintenant le vrai parcours galerie, sans affaiblir la comparaison exacte du document.
- Contrôle unitaire affecté initial : refus de clés inattendues perdu par une première whitelist de patch ; corrigé en retirant uniquement reviewedAt et en conservant les clés inconnues pour le refus strict. Gate affectée finale34PASS.
- Première géométrie réelle : 4défauts/3948figures ; renderer corrigé, checker inchangé.
- Contrôle navigateur provisoire sur4b66… interrompu pour ajouter le rapport de pertes des facettes et restaurer le texte historique No external observation, dont le test existant avait détecté la régression. Fichiers browser-final* conservés ; pas de qualification finale revendiquée.
- Source finale7cbee… : TypeScript/build/unitaires ci-dessus et résultat navigateur réel ci-dessus. Aucun timeout ni assertion n’a été relevé pour obtenir PASS.
- Diagnostic draw.io unique instrumenté avant cette dernière source : 11131octets reçus, puis9.115s avant completed ; saveAs résout9ms plus tard. Une révocation Blob à~1s n’empêche pas cette réussite. Cause du timeout initial non établie ; pas de désactivation sécurité ou de correction spéculative.

## Non qualifié

- The final full browser gate failed; focused or diagnostic passes do not replace it.
- Whole DiagramCloud V2 remains incomplete across the eight original workstreams. Local test success is not full acceptance.
- State facets are dated component/source history, not a current-state resolver. Explicit producer adapters, stale/revoked semantics and project-wide reconciliation remain open.
- Shared repository bindings are declared private evidence, not global repository identity or account inventory; existing binding evidence is retained on conservative reimport and needs a reviewed patch to change.
- No compatible pinned Agent/Config usage producer receipt was supplied; the dossier example explicitly says native_import_supported:false. Counter/dedup/reset implementation remains open; no substitute owner format was invented.
- Catalogue/workflow/client/completion-kit/panel/installed-host and full delivery lineage criteria remain open implementation, not merely permission blockers.
- One optional independent real-stage unit gate was skipped; real-atlas geometry and dense projections did run in the final unit gate.
- The historical overnight full browser failure and new diagnostic are retained. Browser finalization took9.115s after all bytes in one diagnostic; the original timeout cause is unresolved and no timeout/security bypass was added.
- Mosaic native picks, T3/VSIX owner adoption and automatic WebGL restoration remain unsupported or unqualified; owner proposals are unapplied.
- Dirty local source vector only; no exact-commit CI, release readiness, real client/runtime result or owner acceptance is claimed.
- STAGED local review only. No commit, push, merge, deployment, cloud execution, spending, permission change or publication.
- Owner viewer bytes, fonts, private source atlas/renders, raw traces/sessions and negative secret fixture bytes are excluded from delivery. Excluded synthetic fixture hashes require the current authorized workspace to reverify.

Le paquet local ne lance aucun test lors de son assemblage. Il inclut les résultats actuels, les cinq copies CSV avec champs originaux et nocturnes inchangés, les preuves explicitement sélectionnées et les bundles actuels ; il exclut les octets du viewer propriétaire, les fontes, l’atlas privé, les traces/sessions brutes et les fixtures négatives classées secrets. Les SHA de ces entrées de test restent dans le vecteur ; leur revérification exige l’espace autorisé courant.
