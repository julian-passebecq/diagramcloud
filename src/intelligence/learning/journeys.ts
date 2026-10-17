import {learningMappingSchema,validateDocument,type Project} from '../../core/model';
import {project,node,view,note,block} from '../../data/builders';
import {targetFingerprint} from '../../core/learningMapping';
import {learningCatalogue} from './catalogue';
/**
 * Three adoption journeys registered in the gallery. They open with no project, Git or AI.
 * 1. DiagramCloud describing itself, read only from this repository's own public files (file:line), basis static-source.
 * 2. One Galaxy agent process: intended procedure, a synthetic attempt, the lesson and the live process kept apart.
 * 3. One FOIL local/environment slice: logical capability vs local vs cloud realization; DEV/TEST/PROD are environment
 *    instances, distinct from bronze/silver/gold refinement. Synthetic: no private FOIL source is read.
 * Nothing here is observed: no observation, no runtime claim, designed status stays idle.
 */
export const JOURNEY_TAG='Adoption journey';
/** Every self-description citation: a real file of this repository, the line, and a token that must stay on that line (tests/adoption-journeys.test.ts). */
export const SELF_CITATIONS=[
 {id:'src-model-validate',title:'validateDocument',path:'src/core/model.ts',line:209,token:'export function validateDocument'},
 {id:'src-json-draft',title:'JSON drawer applyDraft',path:'src/core/jsonDraft.ts',line:70,token:'export function applyDraft'},
 {id:'src-brief-compile',title:'ProjectBrief compiler',path:'src/intelligence/brief.ts',line:77,token:'export function compileProjectBrief'},
 {id:'src-patch-guard',title:'JSON Patch revision guard',path:'src/core/patch.ts',line:113,token:'Stale patch'},
 {id:'src-patch-apply',title:'applyDocumentPatch',path:'src/core/patch.ts',line:118,token:'export function applyDocumentPatch'},
 {id:'src-public-document',title:'publicDocument',path:'src/core/operations.ts',line:9,token:'export function publicDocument'},
 {id:'src-export-project',title:'exportProject',path:'src/app/exports.ts',line:19,token:'const safe=publicDocument(project)'},
 {id:'src-ci-receipt',title:'CI verification receipt step',path:'.github/workflows/ci.yml',line:43,token:'if: always()'},
 {id:'src-learning-catalogue',title:'learningCatalogue',path:'src/intelligence/learning/catalogue.ts',line:96,token:'export const learningCatalogue'},
 {id:'src-lesson-ui',title:'LearningCatalogue panel',path:'src/ui/LearningCatalogue.tsx',line:100,token:'export function LearningCatalogue'},
 {id:'src-suggest-mapping',title:'suggestMapping',path:'src/intelligence/learning/mappings.ts',line:80,token:'export function suggestMapping'},
 {id:'src-review-mapping',title:'reviewMapping',path:'src/intelligence/learning/mappings.ts',line:95,token:'export function reviewMapping'}
] as const;
const cite=(d:Project,ids:string[])=>{for(const id of ids){const c=SELF_CITATIONS.find(c=>c.id===id)!;if(!d.sources.some(s=>s.id===id))d.sources.push({id,title:c.title,location:`${c.path}:${c.line}`,visibility:'public'});}return ids;};
/** A source-declared mapping bound to the current lesson revision and the target's evidence fingerprint. */
function declare(d:Project,conceptId:string,targetId:string,sourceIds:string[],note:string){
 const concept=learningCatalogue.find(e=>e.id===conceptId);if(!concept)throw new Error('Unknown concept '+conceptId);
 const fingerprint=targetFingerprint(d,{kind:'node',id:targetId});if(!fingerprint)throw new Error('Unknown node '+targetId);
 d.learningMappings=[...(d.learningMappings??[]),learningMappingSchema.parse({id:`map-${conceptId}-${targetId}`,conceptId,contentRevision:concept.editorial.contentRevision,target:{projectId:d.id,kind:'node',id:targetId,projectRevision:d.revision,fingerprint},evidence:{sourceIds,blockIds:[]},state:'source-declared',origin:'source',note})];
}

export function selfDescription():Project{
 const d=project('journey-diagramcloud-self','DiagramCloud describes itself','How DiagramCloud works, read from its own public source files: author, validate, review, export; catalogue, lesson, mapping. Every component cites a file and line of this repository. Static source, never an observed run.','Reference',[JOURNEY_TAG,'Self-description','Static source']);
 d.author='DiagramCloud reference library';
 d.provenance='Read from this repository\'s own public source files (file:line citations, re-checked by tests/adoption-journeys.test.ts). Basis static-source: what the code declares, not an observed run, deployment or measured result.';
 const sn=(id:string,label:string,kind:Parameters<typeof node>[3],summary:string,role:string,sources:string[],icon='generic')=>node(d,id,label,kind,{summary,role,icon,basis:'static-source',sourceIds:cite(d,sources),tags:['diagramcloud']});
 sn('author','Author a draft','app','A person edits JSON in the drawer or compiles a ProjectBrief.','Turns intent into a candidate document; nothing is applied yet.',['src-json-draft','src-brief-compile'],'generic-document');
 sn('validate','Validate','control','Every import and edit crosses validateDocument.','Structural and relational checks; JSON Schema alone is not enough.',['src-model-validate'],'generic-test');
 sn('review','Revision guard','control','A patch written against another revision is refused.','The review gate an agent proposal must pass; the author applies it.',['src-patch-guard','src-patch-apply'],'generic-decision');
 sn('export','Public export','report','Exports call publicDocument first.','Hidden components, private notes and choices never leave.',['src-public-document','src-export-project'],'generic-artifact');
 sn('catalogue','Learning catalogue','source','Typed lessons, usable offline.','Static teaching content; reads no project.',['src-learning-catalogue'],'generic-document');
 sn('lesson','Lesson panel','app','Depths, example, alternatives, In my project.','Explains a concept and lists mapped instances.',['src-lesson-ui']);
 sn('mapping','Concept mapping','function','Suggest, review or reject a mapping.','Binds a concept revision to one exact component, citing evidence.',['src-suggest-mapping','src-review-mapping'],'generic-function');
 sn('ci','CI receipt','process','The verification receipt runs with always().','Records each step outcome even after a failure.',['src-ci-receipt'],'generic-ci');
 note(d,'review','self-review-note','What the guard checks','The patch envelope must name the open project and its exact base revision; otherwise nothing changes and the author reloads. Source: src/core/patch.ts:113.','source-derived',['src-patch-guard']);
 note(d,'ci','self-ci-note','Why always()','The receipt and package steps run even when typecheck, unit, build or browser tests fail, so a red run still names what ran. Source: .github/workflows/ci.yml:43.','source-derived',['src-ci-receipt']);
 view(d,'overview','Author, validate, review, export','The authoring workflow. Click Learning catalogue to drill into the learning loop.',['author','validate','review','export','catalogue'],[['author','validate','draft'],['validate','review','valid document'],['review','export','applied revision']],4);
 view(d,'learning-loop','Lesson and mapping','Inside the learning catalogue: a lesson and an exact mapped instance.',['lesson','mapping'],[['lesson','mapping','In my project']]);
 view(d,'verification','Verification','Behind the revision guard: what CI records about the code that ran. A green check is not a release.',['ci','export'],[['ci','export','packaged build','control']]);
 d.views.find(v=>v.id==='verification')!.perspective='cicd';d.views.find(v=>v.id==='overview')!.perspective='system';
 d.nodes.find(n=>n.id==='catalogue')!.childViewId='learning-loop';d.nodes.find(n=>n.id==='review')!.childViewId='verification';
 d.story=[{title:'Author then validate',viewId:'overview',nodeId:'validate',narration:'A draft only becomes the document after validateDocument accepts it. This order is the code path, not timing.',highlightEdgeIds:['overview-e0'],},{title:'Learn the concept',viewId:'learning-loop',nodeId:'lesson',narration:'A lesson works without a project; In my project lists only cited mappings.',highlightEdgeIds:[]}];
 declare(d,'workflow-agent','review',['src-patch-guard','src-patch-apply'],'Source-declared: the revision guard is the review gate between an agent proposal and the applied document (src/core/patch.ts:113, :118).');
 declare(d,'worktrees-ci','ci',['src-ci-receipt'],'Source-declared: the CI receipt step runs with always() so a check outcome is recorded per step (.github/workflows/ci.yml:43).');
 return validateDocument(d);
}

export function galaxyProcess():Project{
 const d=project('journey-galaxy-agent-process','Galaxy agent process','One agent package: session, worktree, pull request, CI, merge, handoff. The intended procedure, one synthetic attempt, the lesson and the live process are kept apart. Lens stays the Git microscope.','Reference',[JOURNEY_TAG,'Galaxy','Workflow']);
 d.author='DiagramCloud reference library';
 d.provenance='Intended procedure partly cited from this repository\'s public AGENTS.md and CI workflow; every other step and the attempt are synthetic teaching data. No observed run, commit graph or live state is held here.';
 d.sources.push({id:'agents-md',title:'AGENTS.md: feature branch, read CI result',location:'AGENTS.md:19',visibility:'public'},{id:'ci-workflow',title:'DiagramCloud CI workflow',location:'.github/workflows/ci.yml:1',visibility:'public'});
 node(d,'procedure','Intended procedure','process',{summary:'The declared steps, in order.',role:'What should happen; planned, not run.',basis:'planned',icon:'generic-document'});
 node(d,'attempt','Attempt (synthetic)','process',{summary:'One illustrative attempt with step outcomes.',role:'Synthetic teaching record, not an observed run.',basis:'unknown',icon:'generic-test'});
 node(d,'lesson-ref','Lesson reference','source',{summary:'Agent worktrees, changes, review and CI.',role:'Catalogue concept; a lesson is not this process.',basis:'planned',icon:'generic-document'});
 node(d,'live','Live process','app',{summary:'Sessions, heads and CI states belong to their owners.',role:'Not held here; Lens is the Git microscope, without a commit graph.',basis:'unknown',icon:'generic-git'});
 const steps:[string,string,string,string[]][]=[['session','Session','One lane, one package.',[]],['worktree','Worktree','An isolated working copy on a feature branch.',['agents-md']],['pr','Pull request','The branch is proposed for review.',[]],['ci-run','CI','Checks run on the head commit; read the result.',['ci-workflow','agents-md']],['merge','Merge','Squash on green, branch up to date.',[]],['handoff','Handoff','A short report: what merged, what is left.',[]]];
 for(const [id,label,summary,sourceIds] of steps)node(d,id,label,id==='ci-run'?'control':'process',{summary,role:sourceIds.length?'Declared in a cited public file.':'Synthetic step description; no public source in this repository.',basis:'planned',sourceIds,icon:id==='ci-run'?'generic-ci':id==='worktree'||id==='pr'||id==='merge'?'generic-git':'generic'});
 view(d,'overview','Procedure, attempt, lesson, live process','Four different things that are easy to conflate. Open each one.',['procedure','attempt','lesson-ref','live'],[['procedure','attempt','tried as','control'],['lesson-ref','procedure','explains','dependency']],2);
 view(d,'procedure-steps','Intended procedure','Declared order of steps. A sequence is not timing and not an observed run.',steps.map(s=>s[0]),steps.slice(1).map(([id],i)=>[steps[i][0],id,'then','control'] as [string,string,string,'control']),3);
 d.views.find(v=>v.id==='procedure-steps')!.perspective='agents';
 d.nodes.find(n=>n.id==='procedure')!.childViewId='procedure-steps';
 block(d,'attempt',{id:'attempt-steps',title:'Synthetic attempt: step outcomes',type:'table',provenance:'synthetic',columns:['Step','Outcome (synthetic)','Note'],rows:[['Worktree','created','illustrative'],['CI','failed once','a test needed a fix'],['CI','passed','second run'],['Merge','squash','after green'],['Handoff','written','what is left']]});
 note(d,'attempt','attempt-caveat','Why this is not a run','Synthetic illustration. A real attempt is owned by its CI provider and Git forge; DiagramCloud would only show it as a reviewed observation.');
 note(d,'lesson-ref','lesson-ref-note','Where the lesson lives','Open the Learning catalogue (Business overview) and the lesson "Agent worktrees, changes, review and CI". No mapping is declared here, so In my project stays empty.','author');
 note(d,'live','live-note','Live state is elsewhere','Heads, sessions and CI states are pointers owned by Lens, the Git forge and the CI provider. No commit graph is drawn here.','author');
 return validateDocument(d);
}

export function foilEnvironments():Project{
 const d=project('journey-foil-environments','FOIL local and environments','One synthetic FOIL slice: a logical capability realized locally and in the cloud; DEV, TEST and PROD are environment instances, and bronze, silver and gold are data refinement. Macro by default, detail on demand.','Reference',[JOURNEY_TAG,'FOIL','Synthetic']);
 d.author='DiagramCloud reference library';
 d.provenance='Synthetic teaching slice. No private FOIL repository was read; names are illustrative. Environments and instances are declarations, not deployments or runtime health.';
 const n=(id:string,label:string,kind:Parameters<typeof node>[3],summary:string,role:string,icon='generic')=>node(d,id,label,kind,{summary,role,icon,basis:'planned',tags:['foil','synthetic']});
 n('capability','Forecast capability','function','The logical capability: what the product does.','Independent of where it runs.');
 n('refinement','Data refinement','process','Bronze, silver and gold quality stages.','Refinement, not an environment.');
 n('environments','Environments','control','DEV, TEST and PROD instances.','Where a realization runs; not a quality stage.');
 n('serving','Report','report','Published forecast report.','Audience-facing output.');
 n('bronze','Bronze','storage','Raw landed data.','Refinement stage 1.');n('silver','Silver','storage','Cleaned, conformed data.','Refinement stage 2.');n('gold','Gold','storage','Business-ready tables.','Refinement stage 3.');
 n('local-run','Local realization','app','Local container on a developer machine.','Realizes the capability in DEV.','generic-job');
 n('cloud-run','Cloud realization','app','Managed cloud job.','Realizes the capability in TEST; PROD not declared.','generic-job');
 view(d,'overview','FOIL macro','Macro presentation: capability, refinement, environments, report. Open a card for detail.',['capability','refinement','environments','serving'],[['capability','refinement','produces'],['refinement','serving','feeds','query'],['environments','capability','realizes','control']],2);
 view(d,'refinement-detail','Bronze, silver, gold','Data refinement inside every environment. Not DEV, TEST and PROD.',['bronze','silver','gold'],[['bronze','silver','clean'],['silver','gold','model']]);
 view(d,'environment-detail','Local vs cloud realization','Environment instances of the same logical capability. A passed TEST does not establish DEV or PROD.',['capability','local-run','cloud-run'],[['local-run','capability','realizes','control'],['cloud-run','capability','realizes','control']]);
 d.views.find(v=>v.id==='refinement-detail')!.perspective='data';d.views.find(v=>v.id==='environment-detail')!.perspective='cloud';
 d.nodes.find(x=>x.id==='refinement')!.childViewId='refinement-detail';d.nodes.find(x=>x.id==='environments')!.childViewId='environment-detail';
 note(d,'environments','env-note','Environment is not refinement','Each environment has its own bronze, silver and gold. A TEST pass establishes nothing about DEV or PROD; each needs its own evidence.');
 block(d,'refinement',{id:'refinement-rows',title:'Synthetic refinement example',type:'table',provenance:'synthetic',columns:['Stage','Rows (synthetic)','Rule'],rows:[['Bronze',120,'as landed'],['Silver',112,'deduplicated'],['Gold',4,'monthly forecast']]});
 d.delivery={environments:[{id:'env-dev',label:'DEV',description:'Local developer environment (synthetic).',role:'development',lifecycle:'persistent',bindings:[{kind:'provider',label:'Local container',sourceIds:[],visibility:'public'}],sourceIds:[],visibility:'public'},{id:'env-test',label:'TEST',description:'Cloud test environment (synthetic).',role:'test',lifecycle:'persistent',bindings:[{kind:'provider',label:'Managed cloud',sourceIds:[],visibility:'public'}],sourceIds:[],visibility:'public'},{id:'env-prod',label:'PROD',description:'Production: no realization declared in this slice.',role:'production',lifecycle:'unknown',sourceIds:[],visibility:'public'}],
  artifacts:[],instances:[{id:'inst-dev-local',nodeId:'local-run',componentId:'capability',environmentId:'env-dev',sourceIds:[],visibility:'public'},{id:'inst-test-cloud',nodeId:'cloud-run',componentId:'capability',environmentId:'env-test',sourceIds:[],visibility:'public'}],promotions:[{id:'promote-dev-test',fromEnvironmentId:'env-dev',toEnvironmentId:'env-test',gates:[],sourceIds:[],visibility:'public'}]};
 return validateDocument(d);
}
/** The three journeys, in gallery order. */
export function adoptionJourneys():Project[]{return [selfDescription(),galaxyProcess(),foilEnvironments()];}
