/** Authored lesson supplements added at native adoption, kept apart from the supplied R4 card text and from recognition rules.
 * Failure modes are authored teaching reasoning (basis authored-reasoning, no provider claim); they restate risks each card already names. */
export const LEARNING_ADOPTED_ON='2026-10-16';
type Claim={text:string;basis:'authored-reasoning';sourceRefs:string[]};
const fm=(...rows:string[]):Claim[]=>rows.map(text=>({text,basis:'authored-reasoning',sourceRefs:[]}));
export const AUTHORED_FAILURE_MODES:Readonly<Record<string,Claim[]>>={
 'oltp-olap':fm('Running wide analytical scans against the transactional store and treating the slowdown as a reporting bug.','Assuming the analytical copy is current without a declared refresh boundary.'),
 'star-grain':fm('Joining a fact to a nonunique dimension key, which silently multiplies totals.','Mixing order-level and order-line rows in one fact so the grain is no longer stated.'),
 'scd-history':fm('Overlapping validity intervals match two versions; a claimed single-version join must fail visibly instead of choosing one.','Joining on the current dimension row only, which rewrites history for earlier facts.'),
 'medallion-environments':fm('Reading bronze/silver/gold as DEV/TEST/PROD and promoting data between environments as if it were refinement.','Creating physical stores for every layer and environment combination without a stated contract.'),
 'batch-stream-cdc':fm('Replaying a feed without a declared event identity, which duplicates records downstream.','Calling a pipeline exactly-once when the sink has side effects outside the engine guarantee.'),
 'dbt-spark-sql':fm('Drawing dbt, Spark and an orchestrator as interchangeable boxes, hiding which one owns compute, scheduling or the model definition.','Treating a committed model definition as evidence of a successful run.'),
 'training-inference-rag':fm('Fine-tuning to add frequently changing facts that retrieval from permitted sources would supply.','Comparing approaches without stating the allowed data, model identity and evaluation scope.'),
 'rag-pipeline':fm('Judging only the final answer, so a retrieval failure and a generation failure look identical.','Indexing material that the asking user is not permitted to see.'),
 'graph-memory':fm('Treating a returned graph neighbourhood or memory note as an authoritative source without its exact origin.','Keeping a stale memory note after its source changed, with no generation binding to detect it.'),
 'workflow-agent':fm('Using a model-directed agent where a fixed sequence of steps was sufficient, which adds unreviewed decisions.','Letting a candidate approve itself: the review gate must be a separate decision.'),
 'worktrees-ci':fm('Treating a worktree as a security sandbox.','Merging on a check result that refers to a different commit than the one being integrated.'),
 'anthropic-scion':fm('Copying a provider case study as a migration plan without a measured local bottleneck.','Confusing the Anthropic source-control system with an unrelated project that shares the name.')
};
/** Dated case-study metadata. The Scion card studies Anthropic's reported source-control redesign; it is not GoogleCloudPlatform Scion and is never a dependency. */
export const CASE_STUDIES:Readonly<Record<string,{subject:string;reportedBy:string;retrievedOn:string;publishedOn:string|null;sourceRef:string;relation:'CASE_STUDY_ONLY_NOT_A_DEPENDENCY';distinctFrom:{label:string;sourceRef:string|null}[]}>>={
 'anthropic-scion':{subject:'Anthropic source control (Scion): reported monorepo redesign',reportedBy:'Anthropic (provider-reported)',retrievedOn:'2026-10-16',publishedOn:null,sourceRef:'S-SCION',relation:'CASE_STUDY_ONLY_NOT_A_DEPENDENCY',
  distinctFrom:[{label:'GoogleCloudPlatform Scion (an unrelated project)',sourceRef:'S-SCION-AGENTS'},{label:'SCION networking',sourceRef:null},{label:'Scion Asset Management',sourceRef:null}]}
};
