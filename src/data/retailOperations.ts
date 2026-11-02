import type {Project,ProjectNode,ProjectView} from '../core/model';
import {node,note,project,validateDocument,view} from './builders';

/**
 * An anonymous, authored retail map for learning the whole-workspace journey.
 * Nodes are proposed modelling subjects, not an inventory of a real organisation.
 * The same canonical IDs appear in several views; no provider is connected here.
 */
export function retailOperations():Project{
 const d=project(
  'retail-operations','Retail · opérations & échanges',
  'Comprendre un système retail dans son ensemble : boutique, caisses, échanges, données, responsabilités et pistes IA. Cinq vues d’un même modèle illustratif, à adapter en atelier.',
  'Reference',['Retail','Work map','Architecture','Workflows','Fichiers','API','Métadonnées','IA']
 );
 d.author='DiagramCloud · bibliothèque de modèles';
 d.provenance='Modèle pédagogique original et anonyme. Tous les composants, liens, rôles et processus sont proposés pour structurer une discussion. Aucun système réel inspecté, aucun échange observé, aucune mesure ni date de livraison fournie. Le sens des flèches organise la lecture de cet exemple ; il ne confirme pas le sens des flux réels.';

 const add=(id:string,label:string,kind:ProjectNode['kind'],summary:string,options:Partial<ProjectNode>={})=>
  node(d,id,label,kind,{basis:'planned',status:'idle',summary,...options});
 const explain=(id:string,title:string,text:string)=>note(d,id,`${id}-explanation`,title,text,'synthetic');
 const arrange=(id:string,perspective:ProjectView['perspective'],positions:Record<string,{x:number;y:number}>,focal:string[])=>{
  const v=d.views.find(v=>v.id===id)!;
  v.perspective=perspective;v.positions=positions;
  v.design={type:'architecture',focal,theme:'light',caption:'Modèle illustratif · liens et responsabilités à confirmer'};
 };

 add('retail-shopify','Boutique Shopify','app','Exemple de boutique en ligne. Périmètre, données et interfaces à préciser.',{provider:'Shopify',tags:['Commerce','Exemple']});
 add('retail-pos','Caisses / points de vente','app','Les systèmes de caisse sont à identifier. Aucun fournisseur ni lien avec la boutique n’est supposé.',{tags:['Commerce','Fournisseur inconnu']});
 add('retail-ftp','Serveur FTP','storage','Point de transfert à documenter : protocole exact, accès, producteurs et destinataires inconnus.',{tags:['Échanges','À préciser']});
 add('retail-interfaces','Fichiers & interfaces','process','Ouvrir la carte des échanges : fichiers, API, métadonnées et contrôles à relier.',{childViewId:'retail-exchanges',tags:['Échanges','Ouvrir']});
 add('retail-metadata','Métadonnées & sens métier','model','Décrire ce que les données signifient, les identifiants et les règles attendues.',{tags:['Données','Définition']});
 add('retail-controls','Contrôles & incidents','control','Prévoir comment reconnaître un résultat attendu, un rejet ou un échange manquant.',{tags:['Exploitation','À concevoir']});
 add('retail-responsibilities','Qui fait quoi ?','control','Ouvrir les rôles proposés : besoin métier, systèmes, données et exploitation.',{childViewId:'retail-responsibilities-view',tags:['Organisation','Ouvrir']});
 add('retail-work','Du besoin au changement','process','Ouvrir un parcours de travail proposé, de la question métier au résultat expliqué.',{childViewId:'retail-workflow',tags:['Workflow','Ouvrir']});
 add('retail-ai','Évolution & pistes IA','model','Explorer une assistance possible après avoir clarifié le besoin, les données et la validation.',{childViewId:'retail-ai-opportunities',tags:['Évolution','Proposition']});

 view(d,'overview','Retail · vue d’ensemble',
  'Une carte pour discuter du système complet. Ouvrir Fichiers & interfaces, Du besoin au changement, Qui fait quoi ? ou Évolution & pistes IA. Les liens restent illustratifs, pas des flux constatés.',
  ['retail-shopify','retail-ftp','retail-metadata','retail-pos','retail-interfaces','retail-controls','retail-responsibilities','retail-work','retail-ai'],[
   ['retail-shopify','retail-interfaces','interfaces à préciser','dependency'],
   ['retail-pos','retail-interfaces','échanges à préciser','dependency'],
   ['retail-ftp','retail-interfaces','fichiers concernés ?','dependency'],
   ['retail-interfaces','retail-metadata','sens à définir','dependency'],
   ['retail-interfaces','retail-controls','contrôles à définir','dependency'],
   ['retail-responsibilities','retail-work','rôles proposés','dependency'],
   ['retail-work','retail-interfaces','documenter','dependency'],
   ['retail-controls','retail-ai','prérequis à discuter','dependency']
  ]);
 arrange('overview','system',{
  'retail-shopify':{x:0,y:0},'retail-ftp':{x:340,y:0},'retail-metadata':{x:680,y:0},
  'retail-pos':{x:0,y:240},'retail-interfaces':{x:340,y:240},'retail-controls':{x:680,y:240},
  'retail-responsibilities':{x:0,y:480},'retail-work':{x:340,y:480},'retail-ai':{x:680,y:480}
 },['retail-interfaces','retail-work']);

 explain('retail-shopify','Partir de l’usage','Quelle activité la boutique doit-elle permettre ? Quelles informations sont saisies, reçues ou consultées ? Le nom du produit situe cet exemple ; il ne prouve aucune configuration, connexion ou fonctionnalité activée.');
 explain('retail-pos','Garder la caisse identifiable','Identifier les systèmes de caisse et leurs responsables avant de dessiner une synchronisation. Le fournisseur, le nombre de points de vente, les données échangées et le lien éventuel avec la boutique restent à préciser.');
 explain('retail-ftp','Nommer le point de transfert','FTP est ici un sujet à qualifier. Aucun protocole sécurisé, emplacement, compte, fréquence ni format n’est présumé. Décrire séparément le dépôt, la récupération et la personne qui traite un échec.');
 explain('retail-metadata','Relier le fichier au métier','Un champ ou un fichier n’explique pas à lui seul son sens. Documenter la définition métier, l’identifiant, l’unité éventuelle, les règles attendues et la personne qui peut les confirmer. Ce même composant est partagé entre les vues : son sens ne change pas avec la mise en page.');
 explain('retail-controls','Rendre un problème explicable','Quels signes permettent de distinguer un échange attendu d’un échange incomplet ? Où trouver le résultat, qui intervient et comment reprendre ? Ce sont des questions de conception, pas des contrôles déjà exécutés.');

 add('retail-files','Fichiers échangés','storage','Contenu, format, émetteur, destinataire et fréquence à documenter.',{tags:['Échanges','Format inconnu']});
 add('retail-api','Interfaces API','function','Contrat, version, accès et sens d’appel à préciser ; aucune API appelée.',{tags:['Échanges','Contrat à définir']});
 view(d,'retail-exchanges','Échanges · applications, fichiers & API',
  'Comparer les chemins possibles sans décider trop tôt de la solution. Les connexions sont des questions d’atelier ; leur direction n’atteste aucun flux réel. Les mêmes applications, métadonnées et contrôles restent identifiables.',
  ['retail-shopify','retail-api','retail-metadata','retail-pos','retail-files','retail-controls','retail-ftp'],[
   ['retail-shopify','retail-api','quelles interfaces ?','dependency'],
   ['retail-pos','retail-files','quels échanges ?','dependency'],
   ['retail-ftp','retail-files','quels dépôts ?','dependency'],
   ['retail-api','retail-metadata','quel contrat ?','dependency'],
   ['retail-files','retail-metadata','quel sens métier ?','dependency'],
   ['retail-files','retail-controls','quels contrôles ?','dependency'],
   ['retail-api','retail-controls','quelle reprise ?','dependency']
  ]);
 arrange('retail-exchanges','data',{
  'retail-shopify':{x:0,y:0},'retail-api':{x:340,y:0},'retail-metadata':{x:680,y:0},
  'retail-pos':{x:0,y:240},'retail-files':{x:340,y:240},'retail-controls':{x:680,y:240},
  'retail-ftp':{x:0,y:480}
 },['retail-files','retail-api']);
 explain('retail-interfaces','Ouvrir les échanges','La vue d’ensemble pose le périmètre ; la vue enfant distingue applications, transport, contenu et contrat. Relier ces sujets dans un atelier ne signifie pas qu’ils sont déjà connectés.');
 explain('retail-files','Raconter la vie d’un fichier','Partir d’un exemple anonymisé choisi par son auteur : pourquoi il existe, qui le produit, qui le consomme et ce qui indique sa bonne prise en compte. Format et calendrier restent ouverts ; aucun exemple de données client n’est embarqué.');
 explain('retail-api','Décrire une interface avant de la brancher','Préciser l’usage attendu, l’appelant, la réponse, les droits nécessaires et le comportement en cas d’échec. La version et les opérations sont à choisir dans le contexte du projet ; le modèle ne fournit ni accès ni connecteur.');

 add('retail-need','Clarifier le besoin','process','Proposition : formuler une question métier et le résultat attendu.',{tags:['Travail','Proposé']});
 add('retail-map','Cartographier l’existant','process','Proposition : identifier les composants et consigner les connexions encore inconnues.',{tags:['Travail','Proposé']});
 add('retail-describe','Décrire le changement','process','Proposition : montrer ce qui change, les dépendances et les règles à préserver.',{tags:['Travail','Proposé']});
 add('retail-decide','Expliquer & décider','report','Proposition : présenter le résultat, les limites et la décision attendue.',{tags:['Travail','Proposé']});
 view(d,'retail-workflow','Travail · du besoin à la décision',
  'Un parcours de travail proposé, à adapter avec l’équipe. L’ordre décrit une méthode de discussion ; il ne représente ni une exécution, ni des délais, ni des étapes terminées.',
  ['retail-need','retail-map','retail-describe','retail-metadata','retail-controls','retail-decide'],[
   ['retail-need','retail-map','ordre proposé','dependency'],
   ['retail-map','retail-describe','ordre proposé','dependency'],
   ['retail-describe','retail-controls','validation à définir','dependency'],
   ['retail-metadata','retail-controls','règles attendues','dependency'],
   ['retail-controls','retail-decide','résultat à examiner','dependency']
  ]);
 arrange('retail-workflow','system',{
  'retail-need':{x:0,y:0},'retail-map':{x:340,y:0},'retail-describe':{x:680,y:0},
  'retail-metadata':{x:0,y:240},'retail-decide':{x:340,y:240},'retail-controls':{x:680,y:240}
 },['retail-describe','retail-decide']);
 explain('retail-work','Rendre le travail visible','Le diagramme peut raconter ce qui doit être compris, documenté, changé et validé. Chaque étape proposée peut ensuite recevoir un responsable et des éléments de preuve revus. Ici, aucune étape n’est déclarée terminée.');
 explain('retail-describe','Relier le travail à la carte','Présenter le changement envisagé sur les applications et échanges concernés. Expliquer le besoin, les impacts possibles, le retour arrière à prévoir et ce qui permettra de prendre une décision.');
 explain('retail-decide','Une explication pour décider','La vue globale répond à « sur quoi travaillons-nous ? » ; les vues de détail répondent à « comment cela se relie ? ». Terminer par la prochaine décision et les informations manquantes plutôt que par un résultat non établi.');

 add('retail-business-role','Référent métier','source','Rôle proposé, personne à identifier : clarifier le besoin et le résultat attendu.',{tags:['Organisation','Non attribué']});
 add('retail-system-role','Responsable des systèmes','source','Rôle proposé, personne à identifier : décrire les applications et leurs interfaces.',{tags:['Organisation','Non attribué']});
 add('retail-data-role','Responsable des définitions','source','Rôle proposé, personne à identifier : expliquer les données et les règles métier.',{tags:['Organisation','Non attribué']});
 add('retail-operations-role','Référent exploitation','source','Rôle proposé, personne à identifier : préciser les contrôles, alertes et reprises.',{tags:['Organisation','Non attribué']});
 view(d,'retail-responsibilities-view','Responsabilités · relier les rôles au système',
  'Quatre rôles possibles, sans personne ni organisation présumée. Une même personne peut en tenir plusieurs. Les liens représentent une répartition à discuter, pas une affectation acceptée.',
  ['retail-business-role','retail-system-role','retail-data-role','retail-operations-role','retail-metadata','retail-controls'],[
   ['retail-business-role','retail-metadata','sens à confirmer','dependency'],
   ['retail-system-role','retail-controls','interfaces à documenter','dependency'],
   ['retail-data-role','retail-metadata','définitions à proposer','dependency'],
   ['retail-operations-role','retail-controls','reprise à définir','dependency'],
   ['retail-metadata','retail-controls','règles à discuter','dependency']
  ]);
 arrange('retail-responsibilities-view','system',{
  'retail-business-role':{x:0,y:0},'retail-metadata':{x:340,y:0},'retail-data-role':{x:680,y:0},
  'retail-system-role':{x:0,y:240},'retail-controls':{x:340,y:240},'retail-operations-role':{x:680,y:240}
 },['retail-metadata','retail-controls']);
 explain('retail-responsibilities','Distinguer rôle et personne','Ce modèle nomme des responsabilités possibles, sans désigner d’équipe réelle. Attribuer un rôle demande une décision explicite. La carte sert à repérer les questions sans interlocuteur et les passages entre métier, données et exploitation.');

 add('retail-ai-purpose','Choisir un besoin IA','process','Piste proposée : préciser une tâche à assister et le résultat utile attendu.',{tags:['IA','Candidat']});
 add('retail-ai-inputs','Définir les données utiles','storage','Piste proposée : déterminer les données nécessaires, leur sens et leur accès autorisé.',{tags:['IA','Candidat']});
 add('retail-ai-trial','Essai délimité','model','Piste proposée : préparer un essai avec critères de qualité, coût et limites explicites.',{tags:['IA','Non exécuté']});
 add('retail-ai-review','Validation humaine','control','Piste proposée : décider qui examine le résultat et peut arrêter ou corriger l’usage.',{tags:['IA','À définir']});
 view(d,'retail-ai-opportunities','Évolution · préparer une piste IA',
  'Une proposition future, distincte de la carte des échanges. Aucun modèle ni fournisseur n’est choisi. Les prérequis, critères et responsabilités se discutent avant tout essai ; aucun résultat n’est annoncé.',
  ['retail-ai-purpose','retail-ai-inputs','retail-ai-trial','retail-metadata','retail-controls','retail-ai-review'],[
   ['retail-ai-purpose','retail-ai-inputs','besoin à délimiter','dependency'],
   ['retail-metadata','retail-ai-inputs','sens à préserver','dependency'],
   ['retail-ai-inputs','retail-ai-trial','entrée à qualifier','dependency'],
   ['retail-ai-trial','retail-ai-review','résultat à examiner','dependency'],
   ['retail-controls','retail-ai-review','critères à définir','dependency']
  ]);
 arrange('retail-ai-opportunities','agents',{
  'retail-ai-purpose':{x:0,y:0},'retail-ai-inputs':{x:340,y:0},'retail-ai-trial':{x:680,y:0},
  'retail-metadata':{x:0,y:240},'retail-controls':{x:340,y:240},'retail-ai-review':{x:680,y:240}
 },['retail-ai-purpose','retail-ai-review']);
 explain('retail-ai','Faire évoluer sans brouiller l’existant','Conserver la carte du système et ouvrir une vue dédiée aux propositions. Commencer par une tâche utile, ses données et sa validation. L’ajout d’une carte IA ne prouve ni intégration, ni autonomie, ni gain.');
 explain('retail-ai-trial','Un essai a besoin de critères','Décrire ce qui sera comparé, les entrées autorisées, le résultat attendu et la personne qui l’examinera. Qualité, délai et coût restent des critères à renseigner ; aucune valeur n’est inventée dans ce modèle.');

 for(const e of d.edges){e.basis='planned';e.speed='slow';}
 d.story=[
  {title:'Situer le système',viewId:'overview',nodeId:'retail-interfaces',narration:'Commencer par le commerce, les échanges et les personnes. Cette carte illustre un périmètre à documenter ; ses liens ne décrivent pas un système inspecté.',highlightEdgeIds:[]},
  {title:'Ouvrir les échanges',viewId:'retail-exchanges',nodeId:'retail-files',narration:'Distinguer les applications, le transport, les fichiers et le sens des données. Garder visibles les connexions et contrats encore inconnus.',highlightEdgeIds:[]},
  {title:'Montrer le travail',viewId:'retail-workflow',nodeId:'retail-describe',narration:'Proposer un chemin du besoin à la décision : cartographier, décrire le changement et définir la validation. Ce parcours ne prétend pas avoir été exécuté.',highlightEdgeIds:[]},
  {title:'Identifier les responsabilités',viewId:'retail-responsibilities-view',nodeId:'retail-controls',narration:'Relier les sujets à des rôles possibles. Les personnes et la répartition effective restent à décider.',highlightEdgeIds:[]},
  {title:'Préparer une évolution IA',viewId:'retail-ai-opportunities',nodeId:'retail-ai-review',narration:'Une piste IA part du besoin et revient à une validation humaine. Elle réutilise les définitions et contrôles de la même architecture, sans annoncer de résultat.',highlightEdgeIds:[]},
  {title:'Revenir à la vue globale',viewId:'overview',nodeId:'retail-work',narration:'Les vues racontent différentes facettes du même système. La prochaine décision porte sur le périmètre à confirmer et le travail à entreprendre.',highlightEdgeIds:[]}
 ];
 return validateDocument(d);
}
