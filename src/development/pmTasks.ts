import {validateDocument,type Project} from '../core/model';
import {sha256Hex} from '../core/proposal';

/** A read-only consumer of PM's existing owner-task document. No PM filesystem,
 * authority, approval, task editing, session creation or provider is imported. */
export const PM_TASK_SCHEMA='datapass.owner-tasks/1';
export const PM_TASK_IMPORT_LIMITS={bytes:262144,tasks:60,dependencies:1000} as const;
export const PM_TASK_REFUSAL='This PM task document is invalid or exceeds the supported import scope. No project was changed.';
export const PM_TASK_STATES=['TODO','IN_PROGRESS','REVIEW','DONE','BLOCKED'] as const;
export type PmTaskScope={organizationId:string;privacyDomainId:string;projectId:string;repoId:string};
export type PmTask={id:string;title:string;description:string;state:typeof PM_TASK_STATES[number];desiredDate:string|null;dependencies:string[];reviewStatus:'NOT_REQUESTED'|'REQUESTED'|'APPROVED'|'CHANGES_REQUESTED';acceptanceIds:string[];author:string;createdAt:string;updatedAt:string};
export type PmTaskDocument={schema:typeof PM_TASK_SCHEMA;scope:PmTaskScope;revision:number;tasks:PmTask[]};
export type PmTaskImport={document:Project;inputDigest:string;taskMap:{taskId:string;nodeId:string}[];warnings:string[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const identifier=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_.:/-]{1,200}$/.test(v);
const text=(v:unknown,n:number)=>typeof v==='string'&&v.length<=n&&!v.includes('\0');
const identifiers=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=1000&&v.every(identifier)&&new Set(v).size===v.length;
function requireValue(value:unknown):asserts value {if(!value)throw new Error(PM_TASK_REFUSAL);}
export function isPmTaskDocument(input:unknown):boolean{return object(input)&&input.schema===PM_TASK_SCHEMA;}
/** PM accepts up to 1000 tasks. This visual consumer admits at most 60, refuses
 * the whole oversized document, and never silently drops tasks/dependencies. */
export function parsePmTaskDocument(raw:string):PmTaskDocument{
 requireValue(typeof raw==='string'&&new TextEncoder().encode(raw).byteLength<=PM_TASK_IMPORT_LIMITS.bytes);
 let v:unknown;try{v=JSON.parse(raw);}catch{throw new Error(PM_TASK_REFUSAL);}
 requireValue(exact(v,['schema','scope','revision','tasks'])&&v.schema===PM_TASK_SCHEMA);
 requireValue(exact(v.scope,['organizationId','privacyDomainId','projectId','repoId'])&&Object.values(v.scope).every(identifier));
 requireValue(Number.isSafeInteger(v.revision)&&(v.revision as number)>=0&&Array.isArray(v.tasks)&&v.tasks.length<=PM_TASK_IMPORT_LIMITS.tasks);
 const ids=new Set<string>();let dependencyCount=0;
 for(const row of v.tasks){
  requireValue(exact(row,['id','title','description','state','desiredDate','dependencies','reviewStatus','acceptanceIds','author','createdAt','updatedAt']));
  requireValue(identifier(row.id)&&!ids.has(row.id)&&text(row.title,300)&&(row.title as string).trim()&&text(row.description,8192)&&PM_TASK_STATES.includes(row.state as PmTask['state'])&&identifiers(row.dependencies)&&identifiers(row.acceptanceIds)&&text(row.author,200)&&(row.author as string).trim());
  requireValue(['NOT_REQUESTED','REQUESTED','APPROVED','CHANGES_REQUESTED'].includes(row.reviewStatus as string));
  requireValue([row.createdAt,row.updatedAt].every(s=>typeof s==='string'&&!Number.isNaN(Date.parse(s))));
  if(row.desiredDate!==null){const d=row.desiredDate;requireValue(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d);}
  ids.add(row.id);dependencyCount+=row.dependencies.length;
 }
 requireValue(dependencyCount<=PM_TASK_IMPORT_LIMITS.dependencies);
 const doc=v as unknown as PmTaskDocument,tasks=new Map(doc.tasks.map(t=>[t.id,t])),active=new Set<string>(),done=new Set<string>();
 function visit(id:string){requireValue(!active.has(id));if(done.has(id))return;active.add(id);for(const dep of tasks.get(id)!.dependencies){requireValue(tasks.has(dep));visit(dep);}active.delete(id);done.add(id);}
 doc.tasks.forEach(t=>visit(t.id));return structuredClone(doc);
}
const labels:Record<PmTask['state'],string>={TODO:'To do',IN_PROGRESS:'In progress - reported',REVIEW:'Review - reported',DONE:'Done - reported',BLOCKED:'Blocked - reported'};
/** Same-scope changed imports have distinct snapshot IDs, not automatic upserts.
 * Exact bytes can be mapped back to source; no ID/label equality grants a task. */
export function compilePmTasks(raw:string,projectId='pm-task-projection'):PmTaskImport{
 const input=parsePmTaskDocument(raw),inputDigest=sha256Hex(raw),scopeText=JSON.stringify(input.scope);
 requireValue(/^[a-z][a-z0-9_.-]{0,79}$/.test(projectId));
 const sourceId='pm-task-source',taskMap=input.tasks.map(t=>({taskId:t.id,nodeId:'task-'+sha256Hex(scopeText+'\0'+t.id).slice(0,32)}));
 requireValue(new Set(taskMap.map(t=>t.nodeId)).size===taskMap.length);
 const mapped=new Map(taskMap.map(t=>[t.taskId,t.nodeId]));
 const nodes:any[]=[],edges:any[]=[],views:any[]=[],blocks:any[]=[];
 const sourceIds=[sourceId],visibility='private';
 const table=(id:string,title:string,columns:string[],rows:string[][])=>{blocks.push({id,title,type:'table',columns,rows,sourceIds,provenance:'source-derived',visibility});return id;};
 const summary=table('scope-facts','Source scope and limits',['Field','Supplied value'],[
  ...Object.entries(input.scope),['PM document revision',String(input.revision)],['Input SHA256',inputDigest],['Origin','User-selected bytes; authority and source authenticity NOT verified'],['Execution','NONE - viewing and editing this projection cannot write PM tasks or launch a session'],['Status','PM task state is a dated declaration, not current native activity, release evidence or approval'],['Dates','Desired dates are not scheduled start/end intervals; no Gantt duration is inferred']]);
 nodes.push({id:'plan-scope',label:'PM task document',kind:'control',summary:'Read-only source interpretation. Inspect scope, declarations and limits.',basis:'planned',blockIds:[summary],sourceIds,visibility});
 function view(id:string,title:string,nodeIds:string[],description:string,positions?:Record<string,{x:number;y:number}>){const members=new Set(nodeIds);views.push({id,title,description,nodeIds,edgeIds:edges.filter(e=>members.has(e.source)&&members.has(e.target)).map(e=>e.id),positions:positions??Object.fromEntries(nodeIds.map((id,i)=>[id,{x:(i%3)*380,y:Math.floor(i/3)*220}])),perspective:'evidence',visibility});}
 for(const task of input.tasks){const nodeId=mapped.get(task.id)!,detailId='detail-'+nodeId,detailNode='info-'+nodeId;
  const facts=table('facts-'+nodeId,'Task declaration',['Field','Value'],[['Full title',task.title],['Task ID',task.id],['State',task.state],['Review',task.reviewStatus+' (source declaration; not DiagramCloud review)'],['Acceptance IDs',task.acceptanceIds.join(', ')||'None supplied - native preparation needs an explicit task edit'],['Dependencies',task.dependencies.join(', ')||'None in this document'],['Author',task.author],['Created',task.createdAt],['Updated',task.updatedAt],['Desired date',task.desiredDate??'Not supplied']]);
  blocks.push({id:'text-'+nodeId,title:'Task description',type:'text',text:task.description,sourceIds,provenance:'source-derived',visibility});
  const blockIds=[facts,'text-'+nodeId];
  // Native labels stop at 160. Preserve longer PM titles in full in a cited table.
  const title=task.title.length<=160?task.title:'Task '+task.id.slice(0,140);
  nodes.push({id:nodeId,label:title,summary:labels[task.state]+'; not a live observation',kind:'control',status:'idle',basis:'planned',blockIds,sourceIds,tags:['pm-task','pm-state-'+task.state.toLowerCase()],childViewId:detailId,visibility});
  nodes.push({id:detailNode,label:'Task scope and acceptance',summary:'Imported task text and exact source identity. No task authority adopted.',kind:'report',status:'idle',basis:'planned',blockIds,sourceIds,visibility});
  view(detailId,title,[detailNode],'Full description, criteria and supplied state. Presentation edits never update PM.');
 }
 for(const task of input.tasks)for(const [i,dep] of task.dependencies.entries())edges.push({id:'dep-'+mapped.get(task.id)!+'-'+i,source:mapped.get(dep)!,target:mapped.get(task.id)!,label:'PM declared prerequisite',kind:'dependency',basis:'planned',visibility});
 const rootIds=['plan-scope'];
 for(const state of PM_TASK_STATES){const id='column-'+state.toLowerCase(),childViewId='state-'+state.toLowerCase(),ids=input.tasks.filter(t=>t.state===state).map(t=>mapped.get(t.id)!);rootIds.push(id);nodes.push({id,label:labels[state],summary:ids.length+' supplied task(s); not a complete release inventory',kind:'control',basis:'planned',status:'idle',blockIds:[],sourceIds,childViewId,visibility});view(childViewId,labels[state],ids,'All matching tasks in this supplied document. Missing data is not a live zero.');}
 const dependencyIds=input.tasks.map(t=>mapped.get(t.id)!);rootIds.push('dependency-map');nodes.push({id:'dependency-map',label:'Dependencies',summary:'Only same-document PM prerequisites. Cross-repository gates require the separate release plan.',kind:'control',basis:'planned',sourceIds,childViewId:'dependencies',visibility});view('dependencies','Declared task dependencies',dependencyIds,'No dependency is inferred from order, titles, roles or model names.');
 view('root','Private PM task projection',rootIds,'A local presentation copy. Public export intentionally contains only this neutral shell.');views.at(-1)!.visibility='public';
 const document=validateDocument({schemaVersion:1,id:projectId,revision:0,title:'Private work plan',summary:'User-selected PM task declarations; not a task authority or live execution record.',author:'Read-only PM adapter',provenance:'PM task projection; source authenticity and authority are unverified.',category:'Blank',rootViewId:'root',nodes,edges,views,blocks,sources:[{id:sourceId,title:'Selected PM task document',location:'sha256:'+inputDigest,visibility}],observations:[],privateNotes:'Imported from '+PM_TASK_SCHEMA+'; scope '+scopeText+'. PM revision '+input.revision+'. Source authority not adopted; presentation edits are local only.'});
 return {document,inputDigest,taskMap,warnings:['All task data is private by default. Public exports retain a neutral empty shell.','Task approval/state stays an attributed declaration; no session, result, grant or observation was created.','Same-scope changed bytes create another snapshot; they do not overwrite previous presentation edits.']};
}
