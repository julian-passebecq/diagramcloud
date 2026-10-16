import type {Project} from '../core/model';
import {readAcquisitionAnalysis} from './materialize';
import type {AnalysisOptions} from './types';
import {z} from 'zod';
import {validateDocument} from '../core/model';
import {publicDocument} from '../core/operations';
import {perspectiveOf,repositoryOf} from '../core/viewspec';
/** Static authored teaching material. It is not a Project source or an assessment. */
const guidanceKey=z.string().regex(/^[a-z][a-z0-9-]{0,60}$/);
const guidanceText=z.string().min(1).max(600).refine(value=>value.trim().length>0,'Nonblank guidance text required');
const guidanceDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(value+'T00:00:00Z');return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;},'Valid calendar date required');
const guidanceStatement=z.object({text:guidanceText,sourceKeys:z.array(guidanceKey).max(5)}).strict();
const guidanceSource=z.object({key:guidanceKey,title:guidanceText,url:z.string().url().max(2048).refine(value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}},'HTTP(S) citation without credentials required'),retrievedOn:guidanceDate,pageUpdatedOn:guidanceDate.nullable(),externalRevision:z.string().min(1).max(200).refine(value=>value.trim().length>0,'Nonblank revision required').nullable()}).strict();
/** Editorial topic families copied from the supplied r2 catalogue, never workload applicability. */
export const CATALOGUE_REFERENCE_FAMILIES=['Fondations','Applications','Data'] as const;
const referenceTopicFamilies:Readonly<Record<string,typeof CATALOGUE_REFERENCE_FAMILIES[number]>>={c4:'Fondations','modular-monolith':'Applications','event-driven':'Applications','lakehouse-medallion':'Data','spark-production':'Data'};
const referenceClassificationSchema=z.object({family:z.enum(CATALOGUE_REFERENCE_FAMILIES),basis:z.literal('packet-authored-reference-topic-family'),classificationRevision:z.literal('2026-10-15.1'),source:z.object({archiveSha256:z.literal('d397fa79d23785dc3c387722a8e52cfef6a19e256fe41fca791c1dd808c2a707'),entry:z.literal('DiagramCloud_V2_Catalogue_IT_r2_2026-10-14/catalogue.csv'),entrySha256:z.literal('991cdfcfac2dab0218a56df35808d0c9ebfe65eeb9c60eb5ff3dd00139666c4d'),topicKey:guidanceKey}).strict()}).strict();
function referenceClassification(topicKey:string):z.infer<typeof referenceClassificationSchema>{return {family:referenceTopicFamilies[topicKey],basis:'packet-authored-reference-topic-family',classificationRevision:'2026-10-15.1',source:{archiveSha256:'d397fa79d23785dc3c387722a8e52cfef6a19e256fe41fca791c1dd808c2a707',entry:'DiagramCloud_V2_Catalogue_IT_r2_2026-10-14/catalogue.csv',entrySha256:'991cdfcfac2dab0218a56df35808d0c9ebfe65eeb9c60eb5ff3dd00139666c4d',topicKey}};}
export const guidanceSchema=z.object({topicKey:guidanceKey,contentRevision:z.string().min(1).max(80).refine(value=>value.trim().length>0,'Nonblank content revision required'),basis:z.literal('authored-illustrative-guidance'),applicability:z.literal('UNKNOWN_NOT_ASSESSED'),packetReviewedOn:guidanceDate,catalogueClassification:referenceClassificationSchema.optional(),problem:guidanceStatement,conditions:z.array(guidanceStatement).min(1).max(6),contraindications:z.array(guidanceStatement).min(1).max(6),alternatives:z.array(guidanceStatement).min(2).max(6),tradeoffs:z.array(guidanceStatement).min(1).max(6),levels:z.object({macro:guidanceStatement,medium:guidanceStatement,micro:guidanceStatement}).strict(),limits:z.array(guidanceStatement).min(1).max(6),sources:z.array(guidanceSource).min(1).max(5)}).strict().superRefine((card,ctx)=>{
 if(card.catalogueClassification&&(card.catalogueClassification.source.topicKey!==card.topicKey||referenceTopicFamilies[card.topicKey]!==card.catalogueClassification.family))ctx.addIssue({code:z.ZodIssueCode.custom,path:['catalogueClassification'],message:'Unbound reference topic classification'});
 const keys=new Set(card.sources.map(source=>source.key));if(keys.size!==card.sources.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['sources'],message:'Duplicate guidance source key'});
 const statements=[card.problem,...card.conditions,...card.contraindications,...card.alternatives,...card.tradeoffs,...Object.values(card.levels),...card.limits];
 for(const statement of statements){if(new Set(statement.sourceKeys).size!==statement.sourceKeys.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Duplicate guidance source reference'});for(const key of statement.sourceKeys)if(!keys.has(key))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Unknown guidance source reference'});}
});
export type PatternGuidance=z.infer<typeof guidanceSchema>;
export type CatalogueGuidanceFilter='all'|'supplied'|'not-supplied';
export type CatalogueFamilyFilter='all'|'not-supplied'|typeof CATALOGUE_REFERENCE_FAMILIES[number];
/** Display-only lexical search over static registry metadata; never inspects match evidence or a Project. */
export function matchesCatalogueEntry(entry:{id:string;title:string;question?:string;guidance?:{topicKey:string;catalogueClassification?:{family:typeof CATALOGUE_REFERENCE_FAMILIES[number]}}},query:string,guidance:CatalogueGuidanceFilter='all',family:CatalogueFamilyFilter='all'){
 if((guidance==='supplied'&&!entry.guidance)||(guidance==='not-supplied'&&entry.guidance))return false;
 const suppliedFamily=entry.guidance?.catalogueClassification?.family;
 if(family==='not-supplied'?suppliedFamily!==undefined:family!=='all'&&suppliedFamily!==family)return false;
 const needle=query.trim().toLowerCase();
 return !needle||[entry.id,entry.title,entry.question,entry.guidance?.topicKey].some(value=>value?.toLowerCase().includes(needle));
}

const authored=(text:string,sourceKeys:string[]=[]):z.infer<typeof guidanceStatement>=>({text,sourceKeys});
const medallionGuidance=guidanceSchema.parse({
 topicKey:'lakehouse-medallion',catalogueClassification:referenceClassification('lakehouse-medallion'),contentRevision:'2026-10-15.1',basis:'authored-illustrative-guidance',applicability:'UNKNOWN_NOT_ASSESSED',packetReviewedOn:'2026-10-14',
 problem:authored('Explain raw, validated and consumption-ready responsibilities without confusing refinement layers with DEV/TEST/PROD environments.',['medallion']),
 conditions:[authored('Use this comparison when supplied consumers need distinct refinement responsibilities. Whether this project needs them is UNKNOWN until contracts and consumers are supplied.'),authored('Declare keys, validation rules, rejects, retention and consumer contracts. A colour label does not supply those conditions.'),authored('Evaluate development approach, data types and transaction needs before choosing a physical store.',['warehouse'])],
 contraindications:[authored('Do not add three physical copies to a small direct transformation merely to match layer names; first justify the responsibilities and materialization.'),authored('Bronze/Silver/Gold directories or matching tags do not prove lineage, quality, deployment or conformity.')],
 alternatives:[authored('A bounded direct pipeline can be compared when the supplied small transformation and its consumers justify fewer stages.'),authored('Separate logical refinement responsibilities from the project-specific choice of lakehouses, a warehouse or a combined deployment.',['medallion']),authored('Consider a separately justified consumption store after reviewing workload and transaction needs. Applicability remains UNKNOWN.',['warehouse'])],
 tradeoffs:[authored('Separating responsibilities can make contracts easier to inspect while adding explicit hand-offs and maintenance work.'),authored('Materialization, latency and cost remain UNKNOWN without workload-specific evidence; no measured ranking is supplied.')],
 levels:{macro:authored('Ask which declared sources lead to which useful consumer outputs; this is not execution timing.'),medium:authored('Inspect existing contracts, transformation and reject/consumer evidence only where supplied; no detail view is manufactured.'),micro:authored('Ask for explicit business keys, schema/rules, transformation inputs/outputs and citations; unavailable detail stays a gap.')},
 limits:[authored('Authored pedagogical comparison, not a benchmark, deployed result or reference-to-instance mapping.'),authored('The pattern candidate and its project citations are separate from this static documentation. Workload applicability is not assessed.'),authored('Layer requirements are not deployment environments, permission grants or evidence that all projects need three layers.')],
 sources:[{key:'medallion',title:'Understand medallion architecture for Fabric with OneLake',url:'https://learn.microsoft.com/en-us/fabric/onelake/onelake-medallion-lakehouse-architecture',retrievedOn:'2026-10-15',pageUpdatedOn:'2026-07-17',externalRevision:null},{key:'warehouse',title:'Microsoft Fabric decision guide: Choose between Warehouse and Lakehouse',url:'https://learn.microsoft.com/en-us/fabric/fundamentals/decision-guide-lakehouse-warehouse',retrievedOn:'2026-10-15',pageUpdatedOn:'2026-09-17',externalRevision:null}]
});
const jobsGuidance=guidanceSchema.parse({
 topicKey:'spark-production',catalogueClassification:referenceClassification('spark-production'),contentRevision:'2026-10-15.1',basis:'authored-illustrative-guidance',applicability:'UNKNOWN_NOT_ASSESSED',packetReviewedOn:'2026-10-14',
 problem:authored('Separate code packaging from an explicit execution route so exploration and shared logic can be compared without a file-extension verdict.',['wheel-job','dbx-vscode']),
 conditions:[authored('A tested versioned package with thin entry points is one authored option when shared logic and artifact identity justify its maintenance. Actual need is UNKNOWN.'),authored('Ask for the entry point, parameters, artifact and runtime identity, source/sink behavior and run evidence; none is supplied by a filename.',['wheel-job','spark-job']),authored('Treat retry/idempotence as an explicit execution-contract question, not a property inferred from a job label.',['spark-job'])],
 contraindications:[authored('Never conclude notebooks are inherently bad or jobs inherently reliable.'),authored('A wheel, notebook or SQL file alone proves neither execution nor operational suitability. No installed tool or authenticated workspace is assumed.')],
 alternatives:[authored('Compare an orchestrated notebook when its supplied workflow and authoring needs justify that route; notebook job routes are documented.',['dbx-vscode']),authored('Compare a shared package and thin job entry point when supplied testing/versioning needs justify artifact management.',['wheel-job']),authored('Compare a SQL transformation when the supplied operations and environment support that route; otherwise applicability is UNKNOWN.')],
 tradeoffs:[authored('Packaging can expose shared-code and test boundaries while introducing explicit artifact/version management.'),authored('Exploration can retain notebooks while execution still needs its own parameters, runtime, attempt and evidence contract.'),authored('These labels supply no performance, cost or reliability ranking.')],
 levels:{macro:authored('Ask how declared acquisition, transformation and consumption steps connect; a teaching flow is not a trace.'),medium:authored('Inspect existing supplied code, test, artifact, job and result evidence separately; absent objects stay UNKNOWN.'),micro:authored('Ask for the entry point, parameters, runtime, attempt, idempotence and recovery contract; do not synthesize a run.')},
 limits:[authored('Authored educational guidance based on the packet and bounded primary documentation reads; no provider execution is performed.'),authored('No package, notebook, Spark, SQL, CI or cloud action is launched; actual tenant/version support remains unassessed.'),authored('Documentation sources and their update dates are not an installed version, permission grant, verified outcome or current project evidence.')],
 sources:[{key:'wheel-job',title:'Use a Python wheel file in Lakeflow Jobs',url:'https://docs.databricks.com/aws/en/jobs/how-to/use-python-wheels-in-workflows',retrievedOn:'2026-10-15',pageUpdatedOn:'2026-10-06',externalRevision:null},{key:'spark-job',title:'How to create an Apache Spark job definition in Fabric',url:'https://learn.microsoft.com/en-us/fabric/data-engineering/create-spark-job-definition',retrievedOn:'2026-10-15',pageUpdatedOn:'2025-12-05',externalRevision:null},{key:'dbx-vscode',title:'Databricks IDE extension',url:'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/',retrievedOn:'2026-10-15',pageUpdatedOn:'2026-09-11',externalRevision:null}]
});
const c4Guidance=guidanceSchema.parse({
 "topicKey": "c4",
 catalogueClassification:referenceClassification('c4'),
 "contentRevision": "2026-10-15.1",
 "basis": "authored-illustrative-guidance",
 "applicability": "UNKNOWN_NOT_ASSESSED",
 "packetReviewedOn": "2026-10-14",
 "problem": {
  "text": "Explain one declared system boundary and its interactions before choosing a more detailed view.",
  "sourceKeys": [
   "c4-context"
  ]
 },
 "conditions": [
  {
   "text": "Ask which system, users and external systems are in scope; context is a broad explanation rather than a catalogue of low-level mechanisms.",
   "sourceKeys": [
    "c4-context"
   ]
  },
  {
   "text": "Supply the intended reader and actual boundary/dependency citations. Applicability to this project is UNKNOWN until those facts are supplied.",
   "sourceKeys": []
  }
 ],
 "contraindications": [
  {
   "text": "Do not infer ownership or an interface from proximity, a familiar icon or a matching component kind.",
   "sourceKeys": []
  },
  {
   "text": "Do not manufacture actors, detailed views or connections to fill a named level.",
   "sourceKeys": []
  }
 ],
 "alternatives": [
  {
   "text": "Keep a bounded context explanation when only a boundary and its participants are supplied; mark missing detail UNKNOWN.",
   "sourceKeys": []
  },
  {
   "text": "Inspect an existing lower-level responsibility or interface view when the document actually supplies it; reading this card selects no view.",
   "sourceKeys": []
  }
 ],
 "tradeoffs": [
  {
   "text": "A broad boundary explanation leaves implementation questions open; a detailed explanation needs additional source-qualified scope.",
   "sourceKeys": []
  },
  {
   "text": "This choice organizes questions for a reader; it supplies no ownership, operational or completeness verdict.",
   "sourceKeys": []
  }
 ],
 "levels": {
  "macro": {
   "text": "Which declared system and participants does this reader need to understand?",
   "sourceKeys": []
  },
  "medium": {
   "text": "Which supplied responsibilities belong within that boundary, and which existing view explains them?",
   "sourceKeys": []
  },
  "micro": {
   "text": "Which explicit entry/interface citation supports the selected connection? Unavailable detail stays UNKNOWN.",
   "sourceKeys": []
  }
 },
 "limits": [
  {
   "text": "Synthetic example: input is an authored request from a fictional reviewer to a fictional service. Output is a bounded explanation and unanswered interface questions, not an actual response.",
   "sourceKeys": []
  },
  {
   "text": "A teaching definition, not a workflow occurrence, reviewed observation, source-to-instance mapping or automatic view choice.",
   "sourceKeys": []
  },
  {
   "text": "Documentation and its dates do not establish an installed tool, current workload suitability or verified project facts.",
   "sourceKeys": []
  }
 ],
 "sources": [
  {
   "key": "c4-context",
   "title": "System context diagram | C4 model",
   "url": "https://c4model.com/diagrams/system-context",
   "retrievedOn": "2026-10-15",
   "pageUpdatedOn": null,
   "externalRevision": null
  }
 ]
});
const modularMonolithGuidance=guidanceSchema.parse({
 "topicKey": "modular-monolith",
 catalogueClassification:referenceClassification('modular-monolith'),
 "contentRevision": "2026-10-15.1",
 "basis": "authored-illustrative-guidance",
 "applicability": "UNKNOWN_NOT_ASSESSED",
 "packetReviewedOn": "2026-10-14",
 "problem": {
  "text": "Compare logical responsibilities with deployment choices instead of treating a module as an independently deployed service.",
  "sourceKeys": []
 },
 "conditions": [
  {
   "text": "Logical layers can share one deployment; logical separation and physical distribution are different decisions.",
   "sourceKeys": [
    "dotnet-boundaries"
   ]
  },
  {
   "text": "Request module interfaces, reference direction, tests and deployment evidence. Matching dotnet tags or folders alone cannot establish those boundaries.",
   "sourceKeys": []
  },
  {
   "text": "Ask which supplied change, ownership or isolation need would justify independent deployments. Project applicability remains UNKNOWN.",
   "sourceKeys": []
  }
 ],
 "contraindications": [
  {
   "text": "Do not declare microservices necessary or a monolith unsuitable without the actual constraints.",
   "sourceKeys": []
  },
  {
   "text": "A package name, function or diagram boundary does not prove isolation, scalability, reliability or a deployment result.",
   "sourceKeys": []
  }
 ],
 "alternatives": [
  {
   "text": "Keep one bounded application when no supplied requirement justifies a further boundary.",
   "sourceKeys": []
  },
  {
   "text": "Compare explicit internal modules and interfaces within a single declared deployment.",
   "sourceKeys": []
  },
  {
   "text": "Assess independently deployed services only against supplied needs and the added coordination questions; no absolute ranking is implied.",
   "sourceKeys": []
  }
 ],
 "tradeoffs": [
  {
   "text": "Independent services introduce extra communication and operational complexity; whether that cost is justified depends on the application.",
   "sourceKeys": [
    "dotnet-boundaries"
   ]
  },
  {
   "text": "Internal contracts also need review and maintenance. No cost, performance or resilience measurement is supplied here.",
   "sourceKeys": []
  }
 ],
 "levels": {
  "macro": {
   "text": "What product boundary and independently changing responsibilities have actually been declared?",
   "sourceKeys": []
  },
  "medium": {
   "text": "Which module may reference which contract, and what deployment boundary is supplied?",
   "sourceKeys": []
  },
  "micro": {
   "text": "Which source lines, entry points and tests support that boundary? Missing tests or deployment evidence stay UNKNOWN.",
   "sourceKeys": []
  }
 },
 "limits": [
  {
   "text": "Synthetic example: input is an authored lookup request. Request and Report modules share one declared fictional application; output is an illustrative report contract. No deployment or response was observed.",
   "sourceKeys": []
  },
  {
   "text": "The existing modular-monolith registry ID remains a coarse candidate; this static card neither strengthens recognition nor creates a reference-to-instance mapping.",
   "sourceKeys": []
  },
  {
   "text": "No refactor, split, build, service call, migration or observation is performed. Version compatibility and workload suitability remain unassessed.",
   "sourceKeys": []
  }
 ],
 "sources": [
  {
   "key": "dotnet-boundaries",
   "title": "Common web application architectures",
   "url": "https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures",
   "retrievedOn": "2026-10-15",
   "pageUpdatedOn": "2023-03-07",
   "externalRevision": null
  }
 ]
});
const eventDrivenGuidance=guidanceSchema.parse({
 "topicKey": "event-driven",
 catalogueClassification:referenceClassification('event-driven'),
 "contentRevision": "2026-10-15.1",
 "basis": "authored-illustrative-guidance",
 "applicability": "UNKNOWN_NOT_ASSESSED",
 "packetReviewedOn": "2026-10-14",
 "problem": {
  "text": "Separate the declared producer, channel and consumer so payload and recovery questions can be inspected.",
  "sourceKeys": [
   "event-style"
  ]
 },
 "conditions": [
  {
   "text": "Supply an event contract and actual producer/consumer references before attributing a channel to this project. Applicability remains UNKNOWN.",
   "sourceKeys": []
  },
  {
   "text": "Ask explicitly about schema evolution, duplicate handling, ordering, failure ownership and correlation.",
   "sourceKeys": [
    "event-style"
   ]
  }
 ],
 "contraindications": [
  {
   "text": "Do not invent exactly-once delivery, latency, a retry count or a broker choice from arrows or labels.",
   "sourceKeys": []
  },
  {
   "text": "Do not infer a successful event occurrence or healthy consumer from the teaching definition.",
   "sourceKeys": []
  }
 ],
 "alternatives": [
  {
   "text": "Compare direct request-response for a supplied interaction that does not justify asynchronous coordination.",
   "sourceKeys": [
    "event-style"
   ]
  },
  {
   "text": "Compare a queued hand-off when its declared consumer and failure contract justify that route.",
   "sourceKeys": []
  },
  {
   "text": "Compare independent event consumers only when the supplied use case needs them; broker and delivery guarantees stay explicit questions.",
   "sourceKeys": []
  }
 ],
 "tradeoffs": [
  {
   "text": "Asynchronous contracts add recovery, consistency and versioning questions; the selected workload's acceptable behavior must be supplied.",
   "sourceKeys": [
    "event-style"
   ]
  },
  {
   "text": "No throughput, cost, availability or reliability ranking follows from this diagram candidate.",
   "sourceKeys": []
  }
 ],
 "levels": {
  "macro": {
   "text": "Who declares the event, and which supplied consumer needs it?",
   "sourceKeys": []
  },
  "medium": {
   "text": "Where do nominal and rejected payloads go, and who owns an unresolved failure?",
   "sourceKeys": []
  },
  "micro": {
   "text": "Which event ID, schema/version and recovery contract are actually supplied? Retry behavior remains a question, not an executed attempt.",
   "sourceKeys": []
  }
 },
 "limits": [
  {
   "text": "Synthetic example: input is a fictional update payload; output is an illustrative accepted/rejected handling contract. A rejection asks for an owner decision; no event is sent and no branch or retry edge is created.",
   "sourceKeys": []
  },
  {
   "text": "The original topic event-driven binds only to existing registry ID event, native version 1. This is not a new event model, workflow engine or mapping.",
   "sourceKeys": []
  },
  {
   "text": "Timing, execution, permissions and delivery guarantees remain UNKNOWN without their own source-qualified evidence; no observation or review decision is authored.",
   "sourceKeys": []
  }
 ],
 "sources": [
  {
   "key": "event-style",
   "title": "Event-driven architecture style",
   "url": "https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven",
   "retrievedOn": "2026-10-15",
   "pageUpdatedOn": "2026-03-07",
   "externalRevision": null
  }
 ]
});
/** Conditional migration teaching, separate from supplied transition/execution evidence. */
const migrationGuidance=guidanceSchema.parse({
 topicKey:'migration',contentRevision:'2026-10-15.1',basis:'authored-illustrative-guidance',applicability:'UNKNOWN_NOT_ASSESSED',packetReviewedOn:'2026-10-14',
 problem:authored('Distinguish the current source, proposed transition and target so that a design comparison is not mistaken for an achieved migration.'),
 conditions:[authored('Assess incremental coexistence only when requests at the declared boundary can be intercepted and the existing system can remain alongside replacements. Whether this project meets those conditions is UNKNOWN.',['strangler']),authored('Check whether the supplied subsystem contracts differ in meaning before comparing a translation boundary.',['translation']),authored('Request workload-specific acceptance and return criteria, dependency checks and an explicit decision owner before implementation.',['migration-planning'])],
 contraindications:[authored('Do not prescribe gradual routing when interception or required legacy modifications are unavailable, whole-system replacement is straightforward, or rapid retirement is required.',['strangler']),authored('Do not add a translation boundary merely to match a pattern when the supplied semantics do not differ.',['translation']),authored('Names, matching kinds, declared tags and designed status do not establish parity, an approved transition or external migration checks.')],
 alternatives:[authored('Compare a separately justified bounded replacement with incremental coexistence; neither route is automatically selected.'),authored('Compare an embedded translation boundary with a separate adapter only when differing supplied contracts justify that responsibility.',['translation']),authored('Retain or defer the current system while prerequisites remain unresolved; this is an author decision, not an inferred incompatibility.')],
 tradeoffs:[authored('Coexistence requires attention to shared data, cross-system dependencies and the eventual responsibility of temporary routing.',['strangler']),authored('Translation introduces call-overhead, maintenance and consistency questions; no measured cost or latency follows from this card.',['translation']),authored('A return plan is not evidence of recoverability. Current writes, retained source state and independent checks must be supplied; no rollback result is inferred.')],
 levels:{macro:authored('Which supplied boundary changes, why, and what remains the source of truth?'),medium:authored('Which current, transition and target dependencies, parity criteria, failure cases and author decisions are declared?'),micro:authored('Which interface or data version, validation evidence, recovery point objective and return procedure are supplied, and which remain UNKNOWN?')},
 limits:[authored('Synthetic example: input is a fictional legacy read endpoint plus a proposed replacement description; output is a comparison checklist with missing parity and return evidence marked UNKNOWN. No route, edge, source, script, task or runtime event is created.'),authored('This static card does not execute a migration or rollback, establish order, timing, downtime or cause, select a platform, approve a transition, or author an observation. Applicability stays UNKNOWN until independently assessed.'),authored('Original topic migration binds to native pattern migration, version 1. Its original Cloud editorial family is not supplied by the current native classification vocabulary; no family or compatibility is inferred.'),authored('Documentation retrieval and page dates are metadata, not installed versions or freshness guarantees. Exact external revisions remain UNKNOWN.')],
 sources:[{key:'strangler',title:'Strangler Fig pattern',url:'https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig',retrievedOn:'2026-10-15',pageUpdatedOn:'2026-06-02',externalRevision:null},{key:'translation',title:'Anti-Corruption Layer pattern',url:'https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer',retrievedOn:'2026-10-15',pageUpdatedOn:'2026-05-30',externalRevision:null},{key:'migration-planning',title:'Plan your migration',url:'https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/migrate/plan-migration',retrievedOn:'2026-10-15',pageUpdatedOn:'2025-08-01',externalRevision:null}]
});
function uniqueGuidanceTopics(rows:{guidance?:PatternGuidance}[]){const topics=rows.flatMap(row=>row.guidance?[row.guidance.topicKey]:[]);if(new Set(topics).size!==topics.length)throw new Error('Duplicate guidance topic binding');}
/** A recommendation is a reasoned presentation choice, never an applied change. */
export type Recipe={id:string;title:string;availability:'available'|'partial'|'unknown';viewIds:string[];reason:string;figure:'architecture'|'swimlane'|'lineage'|'matrix'|'tree'|'exploded';maxNodes:number;guidance?:PatternGuidance};
const definitions:{id:string;title:string;perspectives:string[];tags:string[];figure:Recipe['figure']}[]=[
 {id:'system',title:'System concept map',perspectives:['system'],tags:[],figure:'architecture'},
 {id:'data',title:'Data and semantic lineage',perspectives:['data'],tags:['dbt','fabric'],figure:'lineage'},
 {id:'jobs',title:'Job dependencies and delivery',perspectives:['cicd'],tags:['databricks'],figure:'swimlane'},
 {id:'interfaces',title:'Interfaces and schema dependencies',perspectives:['code'],tags:['dotnet'],figure:'tree'},
 {id:'cloud',title:'Infrastructure declarations',perspectives:['cloud'],tags:['azure'],figure:'architecture'},
 {id:'evidence',title:'Evidence and checks',perspectives:['evidence'],tags:[],figure:'matrix'},
 {id:'knowledge',title:'Document and decision sources',perspectives:['decisions','code'],tags:['document'],figure:'tree'}
];
export const recipeSchema=z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,60}$/),version:z.literal(1),title:z.string().min(1).max(160),
 question:z.string().min(1).max(300),requirements:z.object({perspectives:z.array(z.string()).max(9),tags:z.array(z.string()).max(20),relationships:z.boolean()}).strict(),
 projection:z.object({kind:z.literal('existing-view-membership'),maxNodes:z.number().int().min(1).max(100)}).strict(),
 render:z.object({figure:z.enum(['architecture','swimlane','lineage','matrix','tree','exploded'])}).strict(),missing:z.string().min(1).max(300),guidance:guidanceSchema.optional()}).strict();
export type ViewRecipe=z.infer<typeof recipeSchema>;
export function validateRecipeRegistry(input:unknown){const rows=z.array(recipeSchema).min(1).max(50).parse(input);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Duplicate recipe ID');uniqueGuidanceTopics(rows);return rows;}
export const recipeRegistry=validateRecipeRegistry(definitions.map(d=>({id:d.id,version:1,title:d.title,
 question:{system:'What are the system boundaries and supplied connections?',data:'Where does data come from and which transformations are supplied?',jobs:'Which declared work items depend on which others?',interfaces:'Which interfaces and schemas explicitly reference each other?',cloud:'Which infrastructure resources are declared?',evidence:'Which components have reviewed external evidence and which do not?',knowledge:'Which documents and decisions cite selected sources?'}[d.id],
 requirements:{perspectives:d.perspectives,tags:d.tags,relationships:!['evidence','knowledge'].includes(d.id)},projection:{kind:'existing-view-membership',maxNodes:60},render:{figure:d.figure},missing:'Missing matching facts remain unknown; the recipe never creates relationships.',...(d.id==='jobs'?{guidance:jobsGuidance}:{})})));
export function recommendRecipes(doc:Project,options:AnalysisOptions,scope:{repositoryId?:string;environmentId?:string}={}):Recipe[]{
 const facts=repositoryOutputFacts(doc,scope.repositoryId),envIds=scope.environmentId?new Set(doc.delivery?.instances.filter(i=>i.environmentId===scope.environmentId).flatMap(i=>[i.nodeId,i.componentId])):undefined;
 const nodeMap=new Map(facts.nodes.filter(n=>!envIds||envIds.has(n.id)).map(n=>[n.id,n])),edgeIds=new Set(facts.edges.filter(e=>nodeMap.has(e.source)&&nodeMap.has(e.target)).map(e=>e.id));
 const scopedViews=facts.views.map(v=>({...v,nodeIds:v.nodeIds.filter(id=>nodeMap.has(id)),edgeIds:v.edgeIds.filter(id=>edgeIds.has(id))}));
 const choices=recipeRegistry.map(d=>{const views=scopedViews.filter(v=>v.nodeIds.length&&(d.requirements.perspectives.includes(perspectiveOf(v))||v.nodeIds.some(id=>nodeMap.get(id)?.tags.some(t=>d.requirements.tags.includes(t)))));
  const edgeCount=views.reduce((n,v)=>n+v.edgeIds.length,0),nodeCount=views.reduce((n,v)=>n+v.nodeIds.length,0);
  return {id:d.id,title:d.title,...(d.guidance?{guidance:structuredClone(d.guidance)}:{}),availability:nodeCount?(edgeCount||!d.requirements.relationships?'available':'partial'):'unknown',viewIds:views.map(v=>v.id),figure:d.render.figure,
   maxNodes:options.depth==='quick'?24:60,reason:nodeCount?(edgeCount?'Explicit matching perspectives and retained relationships':'Components exist; relationships not established'):'No matching facts in the current selected scope'} as Recipe;});
 const priority=options.purpose==='audit'||options.purpose==='work-review'?['evidence','interfaces','cloud']:options.purpose==='education'?['system','knowledge','interfaces']:options.purpose==='presentation'||options.purpose==='portfolio'?['system','data','jobs']:['system','interfaces','data'];
 return choices.sort((a,b)=>Number(b.availability==='available')-Number(a.availability==='available')+((priority.indexOf(a.id)<0?10:priority.indexOf(a.id))-(priority.indexOf(b.id)<0?10:priority.indexOf(b.id)))/20);
}
/** Source-backed bounded reachability, not causal impact or test coverage %. */
export function impactFacts(doc:Project,start:string,options:{direction:'upstream'|'downstream';includeInferred:boolean;limit?:number}){
 if(!doc.nodes.some(n=>n.id===start))throw new Error('Unknown impact subject');
 const edges=doc.edges.filter(e=>e.basis==='static-source'||e.basis==='planned'||(options.includeInferred&&(!e.basis||e.basis==='unknown'))),limit=Math.max(1,Math.min(100,options.limit??60));
 const ids=new Set([start]),queue=[start],links=new Set<string>();let limited=false;
 while(queue.length){const id=queue.shift()!;for(const e of edges){const next=options.direction==='downstream'?(e.source===id?e.target:null):(e.target===id?e.source:null);if(!next)continue;
  links.add(e.id);if(ids.has(next))continue;if(ids.size>=limit){limited=true;continue;}ids.add(next);queue.push(next);}}
 const retained=edges.filter(e=>links.has(e.id)&&ids.has(e.source)&&ids.has(e.target));
 return {nodes:doc.nodes.filter(n=>ids.has(n.id)),edges:retained,limited,
  views:doc.views.filter(v=>v.nodeIds.some(id=>ids.has(id))).map(v=>({id:v.id,title:v.title,nodeIds:v.nodeIds.filter(id=>ids.has(id))})),
  relationships:retained.map(e=>({edgeId:e.id,basis:e.basis??'unknown',sourceIds:[...new Set([...(doc.nodes.find(n=>n.id===e.source)?.sourceIds??[]),...(doc.nodes.find(n=>n.id===e.target)?.sourceIds??[])])],note:'Endpoint citations are context; they do not independently prove the relationship.'})),
  checks:doc.observations.filter(o=>!o.stateFacet&&ids.has(o.nodeId)&&o.reviewedAt),gaps:doc.nodes.filter(n=>ids.has(n.id)&&!doc.observations.some(o=>!o.stateFacet&&o.nodeId===n.id&&o.reviewedAt)).map(n=>({nodeId:n.id,reason:'No reviewed external check is attached; source declarations do not prove coverage'}))};
}
export const patternSchema=z.object({id:z.string(),version:z.literal(1),title:z.string(),illustrative:z.literal(true),requiredKinds:z.array(z.string()),requiredTags:z.array(z.string()),evidenceRequirements:z.array(z.string()).min(1),guidance:guidanceSchema.optional()}).strict();
export function validatePatternCatalog(input:unknown){const rows=z.array(patternSchema).min(1).max(50).parse(input);if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Duplicate pattern ID');uniqueGuidanceTopics(rows);return rows;}
export const patternCatalog=validatePatternCatalog([
 {id:'c4',version:1,title:'System and container explanation',illustrative:true,guidance:c4Guidance,requiredKinds:['app','storage'],requiredTags:[],evidenceRequirements:['Explicit system boundary','Source-backed dependencies']},
 {id:'modular-monolith',version:1,title:'Modular application candidate',illustrative:true,guidance:modularMonolithGuidance,requiredKinds:['app','function'],requiredTags:['dotnet'],evidenceRequirements:['Module boundaries','Source-backed entry point and references','Deployment topology']},
 {id:'medallion',version:1,title:'Layered data pipeline candidate',illustrative:true,guidance:medallionGuidance,requiredKinds:['storage','process'],requiredTags:['dbt','fabric','databricks'],evidenceRequirements:['Layer contracts and transforms','Source-backed lineage','Dated external execution evidence to claim deployment']},
 {id:'event',version:1,title:'Event-driven flow candidate',illustrative:true,guidance:eventDrivenGuidance,requiredKinds:['source','process'],requiredTags:[],evidenceRequirements:['Declared broker/topic or event contract','Producer and consumer references','Delivery guarantees']},
 {id:'migration',version:1,title:'Migration design candidate',illustrative:true,guidance:migrationGuidance,requiredKinds:['source','storage'],requiredTags:[],evidenceRequirements:['Explicit before/after scope','Author-approved transition plan','External migration checks']}
]);
/** A pattern match is a candidate and carries its evidence gaps, never a deployed claim. */
export function classifyPatterns(input:Project){const doc=validateDocument(input);return patternCatalog.map(p=>{
 const matching=doc.nodes.filter(n=>p.requiredKinds.includes(n.kind)),kinds=new Set<string>(matching.map(n=>n.kind)),tags=doc.nodes.flatMap(n=>n.tags);
 const matches=p.requiredKinds.every(k=>kinds.has(k))&&(!p.requiredTags.length||p.requiredTags.some(t=>tags.includes(t)));
 const ids=new Set(matching.map(n=>n.id)),relationships=doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
 return {...structuredClone(p),state:matches?'candidate' as const:'not-established' as const,nodeIds:matches?matching.map(n=>n.id):[],sourceIds:matches?[...new Set(matching.flatMap(n=>n.sourceIds))]:[],relationshipIds:matches?relationships.map(e=>e.id):[],matchReasons:matches?['Component kinds: '+[...kinds].join(', '),...(p.requiredTags.length?['Declared tag matches: '+p.requiredTags.filter(t=>tags.includes(t)).join(', ')]:[]),'Supplied connections between selected components: '+relationships.length]:[],reason:matches?'Kinds and declared tags suggest a useful illustrative comparison; they do not prove the architecture pattern.':'Required source facts are not established.',gaps:[...p.evidenceRequirements]};});}
/** Transient explanations of the existing coarse matcher, never approved mappings or evidence satisfaction. */
export const PATTERN_INPUT_PAGE_SIZE=12;
export type PatternInputPage<T>={rows:T[];total:number;displayed:number;omitted:number;page:number;pages:number};
function patternInputPage<T>(rows:T[],requested:number|undefined):PatternInputPage<T>{
 const pages=Math.max(1,Math.ceil(rows.length/PATTERN_INPUT_PAGE_SIZE)),page=typeof requested==='number'&&Number.isSafeInteger(requested)&&requested>=0?Math.min(requested,pages-1):0;
 const shown=rows.slice(page*PATTERN_INPUT_PAGE_SIZE,(page+1)*PATTERN_INPUT_PAGE_SIZE);
 return {rows:shown,total:rows.length,displayed:shown.length,omitted:rows.length-shown.length,page,pages};
}
export function patternInputExplanation(input:Project,patternId:string,options:{publicMode?:boolean;componentPage?:number;connectionPage?:number;citationPage?:number}={}){
 // Public projection precedes contributor, citation, count and matcher reads. Studio already supplies its permitted projection.
 const doc=options.publicMode?publicDocument(input):validateDocument(input),pattern=patternCatalog.find(row=>row.id===patternId);
 if(!pattern)return {state:'unavailable' as const};
 const result=classifyPatterns(doc).find(row=>row.id===pattern.id)!,kindIds=new Set(doc.nodes.filter(node=>pattern.requiredKinds.includes(node.kind)).map(node=>node.id));
 const components=doc.nodes.filter(node=>kindIds.has(node.id)||node.tags.some(tag=>pattern.requiredTags.includes(tag))).map(node=>({
  id:node.id,label:node.label,kind:node.kind,basis:node.basis??null,matchedKinds:pattern.requiredKinds.includes(node.kind)?[node.kind]:[],matchedTags:node.tags.filter(tag=>pattern.requiredTags.includes(tag)),sourceIds:[...node.sourceIds]
 }));
 const byId=new Map(doc.nodes.map(node=>[node.id,node]));
 const connections=doc.edges.filter(edge=>kindIds.has(edge.source)&&kindIds.has(edge.target)).map(edge=>({id:edge.id,label:edge.label,kind:edge.kind,basis:edge.basis??null,
  source:{id:edge.source,label:byId.get(edge.source)!.label},target:{id:edge.target,label:byId.get(edge.target)!.label},endpointSourceIds:[...new Set([...byId.get(edge.source)!.sourceIds,...byId.get(edge.target)!.sourceIds])]
 }));
 const cited=new Set(components.flatMap(node=>node.sourceIds)),citations=doc.sources.filter(source=>cited.has(source.id)).map(source=>({id:source.id,title:source.title,location:source.location,url:source.url??null,visibility:source.visibility}));
 return {state:'supplied' as const,patternId:pattern.id,matchState:result.state,
  kinds:pattern.requiredKinds.map(kind=>({kind,present:components.some(node=>node.matchedKinds.some(matchedKind=>matchedKind===kind))})),
  tags:pattern.requiredTags.map(tag=>({tag,present:components.some(node=>node.matchedTags.includes(tag))})),
  components:patternInputPage(components,options.componentPage),connections:patternInputPage(connections,options.connectionPage),citations:patternInputPage(citations,options.citationPage),
  questions:[...pattern.evidenceRequirements]};
}

export function learningPath(doc:Project){return doc.views.map(v=>({viewId:v.id,title:v.title,nodeId:v.nodeIds[0],sourceIds:[...new Set(v.nodeIds.flatMap(id=>doc.nodes.find(n=>n.id===id)?.sourceIds??[]))],
 reason:v.id===doc.rootViewId?'Start with the declared project boundary.':v.perspective==='evidence'?'Read the cited evidence and unresolved checks.':'Continue into the existing '+(v.perspective??'detail')+' perspective.'})).sort((a,b)=>Number(b.viewId===doc.rootViewId)-Number(a.viewId===doc.rootViewId));}
export function architectureAudit(doc:Project){const analysis=readAcquisitionAnalysis(doc),active=doc.atlas?.snapshots.find(s=>s.id===doc.atlas?.activeSnapshotId),claims=doc.observations.filter(o=>o.reviewedAt);
 const stale=claims.flatMap(o=>{const revision=repositoryOf(doc,o.nodeId)?.revision??(!active?analysis?.sourceIdentity.sourceRevision:undefined);return revision&&/^[a-f0-9]{40,64}$/.test(revision)&&/^[a-f0-9]{40,64}$/.test(o.sourceRevision)&&revision!==o.sourceRevision?[{id:o.id,nodeId:o.nodeId,sourceRevision:o.sourceRevision,currentSourceRevision:revision,...(o.stateFacet?{stateFacet:o.stateFacet}:{}),state:'stale-source-revision',reason:'Reviewed external claim refers to a different exact source commit. No replacement outcome is inferred.'}]:[];});
 const groups=new Map<string,typeof claims>();for(const o of claims){const key=JSON.stringify([o.nodeId,o.sourceApp,o.authority,o.sourceRevision,o.observedAt,...(o.stateFacet?[o.stateFacet.facet,o.stateFacet.scope]:[])]);groups.set(key,[...(groups.get(key)??[]),o]);}
 const conflicts=[...groups.values()].filter(rows=>new Set(rows.map(o=>JSON.stringify([o.claim,o.stateFacet?.value]))).size>1).map(rows=>({nodeId:rows[0].nodeId,observationIds:rows.map(o=>o.id),...(rows[0].stateFacet?{stateFacet:{facet:rows[0].stateFacet.facet,scope:rows[0].stateFacet.scope}}:{}),state:'requires-review',reason:rows[0].stateFacet?'Different scoped state claims share the same axis, scope, authority, timestamp and source revision. Retain both source claims for review; no current-state winner is inferred.':'Different claim outcomes share the same external authority, timestamp and source revision. Inspect their individual check scope before deciding whether they conflict.'}));return {
 format:'diagramcloud.architecture-audit/1',projectId:doc.id,revision:doc.revision,
 missingSources:doc.nodes.filter(n=>!n.sourceIds.length).map(n=>({nodeId:n.id,state:'unknown',reason:'No cited source attached.'})),
 unreviewed:doc.observations.filter(o=>!o.reviewedAt).map(o=>({id:o.id,nodeId:o.nodeId,state:'requires-review'})),
 stale,conflicts,
 unsupported:analysis?.documentMap.diagnostics.filter(d=>d.code==='unsupported'||d.code==='unresolved'||d.code==='ambiguous')??[],
 repositories:active?.repositories.filter(r=>r.scanStatus!=='scanned').map(r=>({id:r.id,state:r.scanStatus,reason:'No successful scan in this selected snapshot.'}))??[],
 note:'Missing facts are unknown. This is a source/evidence inventory, not a security certification or runtime health assessment.'};}
export function contextualRecipes(doc:Project,options:AnalysisOptions,context?:{archetypes:string[];repositoryId?:string;environmentId?:string}){const rows=recommendRecipes(doc,options,context),relevance:Record<string,string[]>={data:['data'],jobs:['data','cloud','application'],interfaces:['application','library'],cloud:['cloud'],knowledge:['documents']};return rows.map((r,i)=>({...r,
 state:r.availability==='unknown'&&context?.archetypes.length&&relevance[r.id]&&!relevance[r.id].some(a=>context.archetypes.includes(a))?'not-applicable':r.availability==='unknown'?'unavailable':r.availability==='partial'?'useful':i<3?'recommended':'available',
 requirements:structuredClone(recipeRegistry.find(d=>d.id===r.id)!.requirements),question:recipeRegistry.find(d=>d.id===r.id)!.question}));}
export function knowledgeFacts(doc:Project){const analysis=readAcquisitionAnalysis(doc);
 return {documents:analysis?.documentMap.documents??[],links:analysis?.documentMap.links??[],diagnostics:analysis?.documentMap.diagnostics??[],
  decisions:doc.views.filter(v=>v.perspective==='decisions'),limitations:['Only explicit source links are connected; prose similarity is not a relationship.']};}
export function projectCollection(projects:Project[]){return projects.map(p=>({id:p.id,title:p.title,views:p.views.length,
 revisions:p.atlas?.snapshots.find(s=>s.id===p.atlas?.activeSnapshotId)?.repositories.map(r=>({id:r.id,revision:r.revision??'UNKNOWN'}))??[],
 source:'independent-project' as const}));}

/** Atlas namespaces are explicit ownership, not a technology/name join. */
export function repositoryOutputFacts(doc:Project,repositoryId?:string){
 const active=doc.atlas?.snapshots.find(s=>s.id===doc.atlas?.activeSnapshotId);
 if(!repositoryId)return {nodes:doc.nodes,views:doc.views,edges:doc.edges};
 const repository=active?.repositories.find(r=>r.id===repositoryId);
 if(!repository)return {nodes:[],views:[],edges:[]};
 const nodes=doc.nodes.filter(n=>n.id.startsWith(repositoryId+'.')||n.id===(repository.nodeId??'repo-'+repositoryId)),ids=new Set(nodes.map(n=>n.id));
 const edges=doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),edgeIds=new Set(edges.map(e=>e.id));
 const views=doc.views.filter(v=>v.id.startsWith(repositoryId+'.')).map(v=>({...v,nodeIds:v.nodeIds.filter(id=>ids.has(id)),edgeIds:v.edgeIds.filter(id=>edgeIds.has(id))}));
 return {nodes,views,edges};
}
