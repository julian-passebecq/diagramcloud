import type {Project,ProjectNode,ProjectView} from '../core/model';
import {block,node,note,project,validateDocument,view} from './builders';

/** Original illustrative design. No installation inventory, execution or private input. */
export function agentSystemsWorkmap():Project {
 const d=project('agent-systems-workmap','Agents · mémoire & travail',
  'An illustrative whole-project work map: assess the unknown baseline, discuss a proposed target, explore memory and presentation profiles, and identify evidence still needed.',
  'Reference',['Work map','Agents','Memory','Architecture','Illustrative']);
 d.provenance='Original illustrative design, not an inspected installation. Baseline subjects are UNKNOWN; target components are planned. Synthetic tables are questions and proposed artifacts, never observed receipts, telemetry or results. Presentation order, not timing or a run.';
 const add=(id:string,label:string,kind:ProjectNode['kind'],summary:string,options:Partial<ProjectNode>={})=>
  node(d,id,label,kind,{basis:'planned',status:'idle',summary,...options});
 const explain=(owner:string,id:string,title:string,text:string)=>note(d,owner,id,title,text,'synthetic');
 const table=(owner:string,id:string,title:string,columns:string[],rows:string[][])=>
  block(d,owner,{id,title,type:'table',columns,rows,provenance:'synthetic',sourceIds:[]});
 const map=(id:string,title:string,description:string,ids:string[],links:[string,string,string][],perspective:ProjectView['perspective']='agents')=>{
  view(d,id,title,description,ids,links.map(([a,b,label])=>[a,b,label,'dependency']));
  const v=d.views.find(v=>v.id===id)!;v.perspective=perspective;
  v.positions=Object.fromEntries(ids.map((id,i)=>[id,{x:(i%3)*360,y:Math.floor(i/3)*260}]));
  v.design={type:'architecture',theme:'light',caption:'Illustrative design · no execution · results UNKNOWN'};
 };

 add('aim','Goals & boundaries','control','Proposed: explain work, preserve source context and make missing evidence visible.');
 add('project','Canonical project','model','One proposed project context shared across views and profiles.');
 for(const [id,label,child,summary] of [
  ['assessment','Current assessment','baseline','Open UNKNOWN subjects to verify; no installation inspected.'],
  ['target','Proposed target','target-design','Open planned relationships; no implementation claim.'],
  ['memory','Memory layers','memory-design','Open archive, small notes, representations and bounded context.'],
  ['profiles','Presentation profiles','profile-design','Open direct Claude Code and optional host/T3 design options.'],
  ['work','Work categories','work-design','Open architecture, implementation, review, test, debug and tech-lead.'],
  ['factory','Factory viewpoint','factory-design','Distinguish project, repository, runner, agent and receipt requirements.'],
  ['evidence','Evidence to establish','evidence-design','Open verification questions and proposed artifacts; results UNKNOWN.']
 ])add(id,label,'process',summary,{childViewId:child});
 map('overview','Agents · whole-project map','Original illustrative design. Start with Current assessment, then Proposed target. Open each domain while retaining this overview. Nothing here inspects, schedules or executes work.',
  ['aim','project','assessment','memory','target','profiles','work','factory','evidence'],
  [['aim','project','scope'],['project','target','design'],['work','evidence','needs evidence']], 'system');

 for(const [id,label,kind,question] of [
  ['baseline-source','Source access UNKNOWN','source','Which original sources are available and permitted?'],
  ['baseline-memory','Memory state UNKNOWN','storage','Which notes exist and which claims need correction?'],
  ['baseline-profile','Installed profile UNKNOWN','app','Which host and model are actually configured?'],
  ['baseline-work','Work state UNKNOWN','process','Which artifacts exist and what work remains?'],
  ['baseline-receipts','Results UNKNOWN','report','Which independently reviewable receipts exist?']
 ] as const)add(id,label,kind,`UNKNOWN / to verify. ${question}`,{basis:'unknown',tags:['To verify']});
 map('baseline','Baseline · current assessment','Illustrative assessment checklist only. Every subject is UNKNOWN / to verify; neither the article nor this sample establishes an installed system.',
  ['baseline-source','baseline-memory','baseline-profile','baseline-work','baseline-receipts'],[]);
 table('baseline-source','baseline-checklist','Synthetic assessment · no findings',
  ['Subject ID','Question','Artifact needed','Assessment'],[
   ['baseline-source','Are originals searchable with permitted access?','Owner-selected source inventory and retrieval example','UNKNOWN'],
   ['baseline-memory','Can a note be traced to its original?','Cited note and original excerpt reviewed privately','UNKNOWN'],
   ['baseline-profile','What is configured?','Sanitized configuration and owner confirmation','UNKNOWN'],
   ['baseline-work','What changed?','Scoped artifact diff with review context','UNKNOWN'],
   ['baseline-receipts','What was actually checked?','Dated result tied to exact artifact and scope','UNKNOWN']
  ]);

 add('repository','Repository / worktree','storage','Proposed source and change boundary; no repository or local path supplied.');
 add('archive','Transcripts / sources','source','Original sources and search are conceptual foundations; actual access UNKNOWN.');
 add('notes','Small notes','storage','Proposed concise claims with source pointers, uncertainty and correction history.');
 add('representations','Representations / indexes','model','Proposed derived navigation aids; usefulness depends on the task.');
 add('context','Bounded injected context','model','Proposed small selected context; retain pointers to originals and omit irrelevant detail.');
 add('consolidation','Review consolidation','control','Proposed review of notes against originals; never a scheduled task or self-learning implementation.');
 add('artifacts','Work artifacts','storage','Proposed designs, changes and review material; no actual result supplied.');
 add('criteria','Verification criteria','control','Proposed checks and evidence requirements; no approval or successful test implied.');
 map('target-design','Target · proposed design','All components are planned design subjects. Shared project and memory identities stay unchanged across presentation profiles. No provider, host or workflow is launched.',
  ['project','repository','archive','notes','context','artifacts','criteria'],
  [['project','repository','scope'],['repository','archive','source pointers'],['archive','notes','cite originals'],['notes','context','select'],['artifacts','criteria','review against']]);
 map('memory-design','Memory · layers & review','Illustrative memory design. Search and original sources are foundations conceptually; availability is not verified. Consolidation is proposed human-reviewable work, not a timer, scheduler or model-weight change.',
  ['archive','notes','representations','consolidation','context','criteria'],
  [['archive','notes','source pointers'],['notes','representations','derive'],['representations','context','select'],['archive','consolidation','check originals'],['consolidation','notes','propose correction'],['criteria','consolidation','review boundary']]);
 d.sources=[{id:'memory-layering-reference',title:'Anthropic · The components of agent memory',url:'https://www.anthropic.com/research/components-of-agent-memory',location:'Nov 6, 2026. Motivation for memory layering only; not installation evidence or integration support.',visibility:'public'}];
 note(d,'archive','memory-layering-source','Source-derived motivation only',
  'The article distinguishes transcripts, notes, derived representations and injected context. It describes checking notes against original transcripts; wiki usefulness depends on the task. This motivates layering only, not any claim about this example being installed.',
  'source-derived',['memory-layering-reference']);
 table('consolidation','consolidation-contract','Synthetic consolidation proposal',
  ['Input','Proposed work','Reviewable output','Boundary'],[
   ['A note and its cited original','Compare the claim with the original context','Correction proposal with source pointer and reason','No automatic overwrite'],
   ['An unsupported note','Keep uncertainty visible','Question for the owner; retain original','Never invent supporting evidence'],
   ['A task-specific index','Check whether retrieval helps the selected task','Keep, revise or discard proposal','No universal wiki benefit'],
   ['Candidate context','Select relevant notes and original pointers','Small context draft with omissions stated','No silent instruction change']
  ]);

 add('direct-profile','Direct Claude Code','app','Design option: direct workflow around the same project and memory. No provider invoked.');
 add('host-profile','Optional host / T3','app','Design option only: optional presentation around the same project and memory. No T3 integration exists here.');
 map('profile-design','Profiles · same canonical context','Two presentation/workflow design options. Looking at this view never invokes a provider, installs T3, forks the model or changes instructions. No host integration is claimed.',
  ['direct-profile','project','host-profile','notes','context','criteria'],
  [['direct-profile','project','same project'],['host-profile','project','same project'],['notes','context','shared memory'],['context','direct-profile','proposed input'],['context','host-profile','proposed input']]);
 explain('host-profile','profile-boundary','Optional presentation, unchanged authority',
  'Both profile cards refer to the same canonical project, notes and bounded context. A host wrapper is an optional design choice, not a second memory model. Opening or selecting a card grants no capability and does not alter instructions. Any future integration needs its own contract and qualification.');

 for(const [id,label,summary] of [
  ['architecture','Architecture','Proposed: connect requirements, source context and design decisions.'],
  ['implementation','Implementation','Proposed: make a bounded change with an inspectable artifact diff.'],
  ['review','Review','Proposed: compare an artifact with its requirements and record unresolved questions.'],
  ['test','Test','Proposed: define checks and preserve their actual results separately.'],
  ['debug','Debug','Proposed: relate a reproducible symptom to source and a candidate correction.'],
  ['tech-lead','Tech-lead','Proposed: assess direction across projects, dependencies, unnecessary complexity and release conditions.']
 ])add(id,label,'process',summary);
 map('work-design','Work · categories & artifacts','Illustrative categories, not a queue or execution sequence. Each category requires source context and an artifact that a person can examine. Outcomes remain UNKNOWN.',
  ['architecture','implementation','review','test','debug','tech-lead','repository','artifacts','criteria'],
  [['repository','implementation','source'],['architecture','artifacts','design'],['implementation','artifacts','change'],['review','artifacts','review material'],['test','criteria','check definition'],['debug','repository','reproduction context'],['tech-lead','architecture','direction and dependencies'],['tech-lead','criteria','release conditions']]);
 table('artifacts','work-contract','Synthetic work-to-evidence contract',
  ['Category','Input','Artifact to examine','Result'],[
   ['Architecture','Question and source constraints','Decision sketch with alternatives and open questions','UNKNOWN'],
   ['Implementation','Scoped design and source','Patch plus affected-artifact list','UNKNOWN'],
   ['Review','Artifact and acceptance criteria','Review notes bound to the examined artifact','UNKNOWN'],
   ['Test','Artifact and check definition','Result with command, scope and failure details','UNKNOWN'],
   ['Debug','Reproduction and source context','Hypothesis, reproduction case and candidate correction','UNKNOWN'],
   ['Tech-lead','Project goals, dependencies and available evidence','Direction review, tradeoffs and release conditions','UNKNOWN']
  ]);

 add('runner','Machine / runner','app','Proposed execution location category; machine identity and capacity UNKNOWN.');
 add('agent','Agent / model','model','Proposed worker category; model selection and actual activity UNKNOWN.');
 add('receipts','Observed receipt requirements','report','Requirements for future external evidence only. No observed receipts are supplied.');
 map('factory-design','Factory · identities & unknowns','Illustrative design distinctions only. A project, repository/worktree, machine/runner and agent/model are different subjects. This map neither collects telemetry nor schedules work.',
  ['project','repository','runner','agent','artifacts','receipts'],
  [['project','repository','source scope'],['repository','artifacts','change boundary'],['runner','agent','proposed location'],['agent','artifacts','proposed work'],['artifacts','receipts','evidence needed']]);
 table('runner','factory-unknowns','Synthetic factory checklist · no telemetry',
  ['Question','Value','Evidence needed'],[
   ['CPU / GPU','UNKNOWN','Scoped measurement from an authorized external source'],
   ['Temperature','UNKNOWN','Dated sensor reading with unit and machine scope'],
   ['Rate / count','UNKNOWN','Defined metric, interval and original records'],
   ['ETA','UNKNOWN','Explicit assumptions and independently assessed estimate'],
   ['Agent activity','UNKNOWN','Dated receipt tied to an artifact and actor scope']
  ]);
 map('evidence-design','Evidence · what would establish a claim?','Synthetic evidence requirements, not evidence of execution. Source-derived literature is separate from these invented checklists. Only reviewed external claims may become observations through the existing patch review.',
  ['archive','artifacts','criteria','receipts'],
  [['archive','criteria','source context'],['artifacts','criteria','inspect'],['criteria','receipts','require evidence']]);
 table('receipts','receipt-requirements','Synthetic receipt requirements · none supplied',
  ['Claim to verify','Required artifact','Missing condition'],[
   ['A change was examined','Review bound to exact artifact and scope','Reviewer and review evidence UNKNOWN'],
   ['A check passed','Dated original result with command, scope and failures','Execution and outcome UNKNOWN'],
   ['A note is supported','Cited original plus review of the claim in context','Source access and review UNKNOWN'],
   ['A profile is installed','Owner-confirmed configuration and bounded integration check','Installation and compatibility UNKNOWN']
  ]);
 explain('aim','design-boundary','Use the map to ask better questions',
  'Begin with the unknown baseline. Discuss the target as a proposal, select a useful work artifact and name what would establish its result. This original synthetic example contains no actual source archive, raw prompt, transcript, worker event, benchmark, receipt or private installation data.');
 for(const edge of d.edges){edge.basis='planned';edge.speed='slow';}
 d.story=[
  ['Start with uncertainty','baseline','baseline-source','Separate assessment questions from installation facts. All baseline subjects are UNKNOWN.'],
  ['Discuss the target','target-design','project','The target is planned; a shared project does not establish execution.'],
  ['Read the memory layers','memory-design','archive','Distinguish originals, small notes, representations and bounded context. Consolidation is proposed reviewable work.'],
  ['Compare presentation options','profile-design','host-profile','Direct Claude Code and optional host/T3 share canonical context. Selecting a view changes no instructions or capabilities.'],
  ['Connect work to artifacts','work-design','artifacts','Architecture, implementation, review, test, debug and tech-lead each need inspectable artifacts.'],
  ['Keep factory claims unknown','factory-design','runner','Identities, capacity, telemetry and ETA remain UNKNOWN.'],
  ['End with evidence needed','evidence-design','receipts','A checklist is not a receipt. Reviewed external evidence is still required.']
 ].map(([title,viewId,nodeId,narration])=>({title,viewId,nodeId,narration:`Presentation order, not timing or a run. ${narration}`,highlightEdgeIds:[]}));
 return validateDocument(d);
}
