import {z} from 'zod';
import {validateDocument,scheduleItemSchema,type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {isPermittedPath} from '../core/hierarchy';
import {sha256Hex} from '../core/proposal';

/** Authored discussion input. Compilation is preparation, NEVER plan adoption or tool execution. */
export const IDEATION_FORMAT='diagramcloud.ideation-brief/1';
const id=z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),text=(max=1200)=>z.string().trim().min(1).max(max);
const ids=z.array(id).max(16),lines=z.array(text()).max(12);
const source=z.object({id,title:text(160),location:text(2000),url:z.string().url().refine(s=>{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;}).optional()}).strict();
const assessment=z.object({criterion:z.enum(['feasibility','difficulty','value']),rating:z.enum(['low','medium','high','unknown']),rationale:text(),sourceIds:ids}).strict();
export const ideaSchema=z.object({id,title:text(160),groupIds:ids.min(1),problem:text(),proposal:text(1500),benefits:lines,risks:lines,unknowns:lines,conditions:lines,
 consideration:z.enum(['candidate','exploring','deferred','rejected','superseded']),assessments:z.array(assessment).max(3),
 estimate:z.object({low:z.number().finite().min(0).max(1000000),high:z.number().finite().min(0).max(1000000),unit:z.literal('active-minutes'),basis:text(),sourceIds:ids}).strict().nullable(),sourceIds:ids.min(1)}).strict();
const group=z.object({id,label:text(160),kind:z.enum(['organization','project','theme']),description:text()}).strict();
export const ideationBriefSchema=z.object({schema:z.literal(IDEATION_FORMAT),id,title:text(160),question:text(1500),visibility:z.enum(['private','public']).default('private'),
 provenance:z.enum(['supplied-discussion','authored-synthetic']),sources:z.array(source).min(1).max(80),groups:z.array(group).min(1).max(24),ideas:z.array(ideaSchema).min(1).max(120),
 relations:z.array(z.object({id,from:id,to:id,kind:z.enum(['depends-on','alternative','related','supersedes','conflicts-with']),reason:text(),sourceIds:ids.min(1)}).strict()).max(400),
 schedule:z.object({timezone:z.string().min(1).max(100),items:z.array(scheduleItemSchema).min(1).max(100)}).strict().optional()}).strict();
export type IdeationBrief=z.infer<typeof ideationBriefSchema>;
export type Idea=z.infer<typeof ideaSchema>;
export const isIdeationBrief=(v:unknown):boolean=>!!v&&typeof v==='object'&&(v as {schema?:unknown}).schema===IDEATION_FORMAT;
export function validateIdeationBrief(v:unknown):IdeationBrief{
 if(new TextEncoder().encode(JSON.stringify(v)).byteLength>512*1024)throw Error('Idea input exceeds 512 KiB.');
 const b=ideationBriefSchema.parse(v);
 if(b.provenance==='supplied-discussion'&&b.visibility!=='private')throw Error('Supplied discussions must remain private. Publish a separately reviewed, sanitized Project instead.');
 const unique=(a:string[])=>{if(new Set(a).size!==a.length)throw Error('Duplicate idea-input identity or reference.');};
 for(const set of [b.sources,b.groups,b.ideas,b.relations])unique(set.map(x=>x.id));
 const ss=new Set(b.sources.map(x=>x.id)),gg=new Set(b.groups.map(x=>x.id)),ii=new Set(b.ideas.map(x=>x.id));
 const refs=(xs:string[])=>{unique(xs);if(xs.some(x=>!ss.has(x)))throw Error('Unresolved idea source.');};
 for(const i of b.ideas){unique(i.groupIds);if(i.groupIds.some(g=>!gg.has(g)))throw Error('Unresolved idea group.');refs(i.sourceIds);
  unique(i.assessments.map(a=>a.criterion));for(const a of i.assessments)refs(a.sourceIds);
  if(i.estimate){if(i.estimate.low>i.estimate.high)throw Error('Inverted idea allowance.');refs(i.estimate.sourceIds);}}
 for(const r of b.relations){if(!ii.has(r.from)||!ii.has(r.to)||r.from===r.to)throw Error('Invalid idea relationship.');refs(r.sourceIds);}
 // Cycles may be useful discussion evidence. They are NOT interpreted as a schedulable work DAG.
 if(b.schedule)for(const row of b.schedule.items)if(row.nodeIds.some(n=>!ii.has(n)))throw Error('Unknown scheduled idea.');
 return b;
}
/** Ordinary Project is the output. No new fact store; incoming ideas cannot accept choices or create observations. */
export function compileIdeationBrief(v:unknown):{document:Project;inputDigest:string}{
 const b=validateIdeationBrief(v),vis=b.visibility,prov=b.provenance==='authored-synthetic'?'synthetic':'source-derived',digest=sha256Hex(JSON.stringify(b));
 const doc:any={schemaVersion:1,id:vis==='private'?'ideas-private-'+sha256Hex(b.id).slice(0,24):'ideas-'+b.id,revision:0,title:vis==='private'?'Private idea portfolio':b.title,summary:vis==='private'?'Supplied discussion. Private author context required.':b.question,category:'Reference',tags:['idea-portfolio'],rootViewId:'ideas-overview',
  provenance:'Authored idea portfolio. Proposal, consideration and opinion are not approval, runtime or delivery.'+(vis==='public'?' Normalized validated input sha256:'+digest:''),
  nodes:[],edges:[],views:[],blocks:[],assets:[],sources:b.sources.map(s=>({...s,visibility:vis})),story:[],observations:[]};
 const table=(bid:string,title:string,columns:string[],rows:(string|number|null)[][],sourceIds:string[])=>{doc.blocks.push({id:bid,title,type:'table',columns,rows,sourceIds,visibility:vis,provenance:prov});return bid;};
 const contextBlock=table('ideas-context','Discussion scope',['Field','Value'],[['Title',b.title],['Question',b.question]],b.sources.map(s=>s.id));
 const groups=b.groups.map(g=>({id:'group-'+g.id,label:g.label,kind:'control',summary:g.description.slice(0,500),status:'idle',basis:'planned',visibility:vis,tags:['idea-group',g.kind],childViewId:'group-view-'+g.id,
  blockIds:[table('group-profile-'+g.id,'Idea grouping',['Kind','Value'],[['id',g.id],['kind',g.kind],['description',g.description]],[])]}));doc.nodes.push(...groups);doc.nodes[0].blockIds.push(contextBlock);
 for(const i of b.ideas){const refs=[...new Set([...i.sourceIds,...i.assessments.flatMap(a=>a.sourceIds),...(i.estimate?.sourceIds??[])])];
  const meta='idea-profile-'+i.id;doc.blocks.push({id:meta,title:'Idea profile (supplied, not adopted)',type:'code',language:'json',code:JSON.stringify(i,null,2),visibility:vis,provenance:prov,sourceIds:refs});
  const detail=table('idea-summary-'+i.id,'Problem, option and uncertainty',['Field','Reading'],[['Problem',i.problem],['Proposal',i.proposal],['Consideration',i.consideration],...i.benefits.map(x=>['Benefit',x]),...i.risks.map(x=>['Risk',x]),...i.unknowns.map(x=>['Open question',x]),...i.conditions.map(x=>['Condition',x]),['Effort allowance',i.estimate?`${i.estimate.low}-${i.estimate.high} active minutes. ${i.estimate.basis}`:'UNKNOWN; not a scheduled task']],refs);
  doc.nodes.push({id:'idea-'+i.id,label:i.title,kind:'control',summary:i.problem.slice(0,500),status:'idle',basis:'planned',tags:['brainstorm-idea'],visibility:vis,sourceIds:refs,blockIds:[detail,meta],
   choices:[{id:'choice-'+i.id,title:i.title,goal:i.problem.slice(0,1000),status:'candidate',origin:'imported',options:[{id:'option-'+i.id,label:i.title,summary:i.proposal.slice(0,1000)}],reasons:i.benefits.map(s=>s.slice(0,500)),tradeoffs:i.risks.map(s=>s.slice(0,500)),assumptions:i.conditions.map(s=>s.slice(0,500)),sourceIds:refs,visibility:vis}]});
  const related=b.relations.filter(r=>r.from===i.id||r.to===i.id);
  if(related.length){const relationBlock=table('idea-relations-'+i.id,'Authored relationships, not execution order',['From','Relation','To','Reason','Sources'],related.map(r=>[r.from,r.kind,r.to,r.reason,r.sourceIds.join(', ')]),[...new Set(related.flatMap(r=>r.sourceIds))]);doc.nodes[doc.nodes.length-1].blockIds.push(relationBlock);}
 }
 for(const r of b.relations)doc.edges.push({id:'relation-'+r.id,source:'idea-'+r.from,target:'idea-'+r.to,label:r.kind+': '+r.reason.slice(0,100),kind:r.kind==='depends-on'?'dependency':'control',basis:'planned',visibility:vis});
 function view(id:string,title:string,nodeIds:string[]){const set=new Set(nodeIds);doc.views.push({id,title,description:'Authored idea relations and consideration only. Not a work schedule or live status.',visibility:vis,nodeIds,edgeIds:doc.edges.filter((e:any)=>set.has(e.source)&&set.has(e.target)).map((e:any)=>e.id),positions:Object.fromEntries(nodeIds.map((n,i)=>[n,{x:i%3*300,y:Math.floor(i/3)*180}])),perspective:'decisions'});}
 view('ideas-overview',vis==='private'?'Private idea portfolio':b.title,groups.map(g=>g.id));doc.views[0].visibility='public';
 for(const g of b.groups)view('group-view-'+g.id,g.label,b.ideas.filter(i=>i.groupIds.includes(g.id)).map(i=>'idea-'+i.id));
 if(b.schedule){doc.blocks.push({id:'ideas-supplied-schedule',title:'Supplied dates, not calculated ETA',type:'schedule',...b.schedule,items:b.schedule.items.map(i=>({...i,nodeIds:i.nodeIds.map(n=>'idea-'+n)})),sourceIds:b.sources.map(s=>s.id),provenance:prov,visibility:vis});doc.nodes[0].blockIds.push('ideas-supplied-schedule');}
 return {document:validateDocument(doc),inputDigest:digest};
}
export type IdeaReading={document:Project;title:string;question:string;ideas:(Idea&{nodeId:string;sourceKey:string})[];groups:IdeationBrief['groups'];invalid:boolean;sourceKey:string};
/** Permission projection happens before indexing, grouping, search and counts. */
export function readIdeaPortfolio(input:Project,audience:'author'|'public'):IdeaReading{
 const doc=audience==='public'?publicDocument(validateDocument(input)):validateDocument(input),sourceKey=sha256Hex(JSON.stringify(doc));
 const meta=doc.blocks.find(b=>b.id==='ideas-context'),context=meta?.type==='table'?Object.fromEntries(meta.rows.map(r=>[r[0],r[1]])):{};
 const out:IdeaReading={document:doc,title:typeof context.Title==='string'?context.Title:doc.title,question:typeof context.Question==='string'?context.Question:doc.summary,ideas:[],groups:[],invalid:false,sourceKey};
 const sourceIds=new Set(doc.sources.map(s=>s.id));
 for(const n of doc.nodes.filter(n=>n.tags.includes('idea-group'))){const block=doc.blocks.find(b=>n.blockIds.includes(b.id)&&b.id.startsWith('group-profile-'));if(!block||block.type!=='table'){out.invalid=true;continue;}
  const rows=Object.fromEntries(block.rows.map(r=>[r[0],r[1]]));const parsed=group.safeParse({id:rows.id,label:n.label,kind:rows.kind,description:rows.description});if(parsed.success)out.groups.push(parsed.data);else out.invalid=true;}
 const groupIds=new Set(out.groups.map(g=>g.id));
 for(const n of doc.nodes.filter(n=>n.tags.includes('brainstorm-idea'))){const block=doc.blocks.find(b=>n.blockIds.includes(b.id)&&b.id==='idea-profile-'+n.id.slice(5));
  try{if(!block||block.type!=='code'||block.code.length>40000)throw Error();const i=ideaSchema.parse(JSON.parse(block.code));
   if(i.estimate&&i.estimate.low>i.estimate.high)throw Error();
   if(new Set(i.groupIds).size!==i.groupIds.length||new Set(i.assessments.map(a=>a.criterion)).size!==i.assessments.length)throw Error();
   if(n.id!=='idea-'+i.id||n.label!==i.title||i.groupIds.some(g=>!groupIds.has(g))||[...i.sourceIds,...i.assessments.flatMap(a=>a.sourceIds),...(i.estimate?.sourceIds??[])].some(s=>!sourceIds.has(s)))throw Error();
   out.ideas.push({...i,nodeId:n.id,sourceKey});
  }catch{out.invalid=true;}}
 return out;
}
export function filterIdeas(reading:IdeaReading,query='',groupId='',consideration=''){
 const terms=query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
 return reading.ideas.filter(i=>(!groupId||i.groupIds.includes(groupId))&&(!consideration||i.consideration===consideration)&&terms.every(t=>[i.title,i.problem,i.proposal,...i.benefits,...i.unknowns].join(' ').normalize('NFKC').toLowerCase().includes(t)));
}
export function resolveIdeaPick(input:Project,audience:'author'|'public',pick:{sourceKey:string;nodeId:string;groupId:string}){
 if(!pick||typeof pick!=='object'||typeof pick.groupId!=='string'||typeof pick.nodeId!=='string')return null;
 const r=readIdeaPortfolio(input,audience),i=r.ideas.find(i=>i.nodeId===pick.nodeId);
 if(pick.sourceKey!==r.sourceKey||!i||!i.groupIds.includes(pick.groupId))return null;
 const path=[r.document.rootViewId,'group-view-'+pick.groupId];
 if(!isPermittedPath(r.document,path)||!r.document.views.find(v=>v.id===path[1])?.nodeIds.includes(i.nodeId))return null;
 return {nodeId:i.nodeId,viewId:path[1],path};
}
