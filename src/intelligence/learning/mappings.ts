import {z} from 'zod';
import {clone,learningMappingSchema,sameAgent,validateDocument,type LearningMapping,type Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {pathTo} from '../../core/viewspec';
import {targetFingerprint} from '../../core/learningMapping';
import {learningCatalogue,type LearningEntry} from './catalogue';
/**
 * Concept -> real instance associations. A mapping is stored in the project (`learningMappings`), saved, undone and exported
 * with it. Suggested, source-declared, reviewed and rejected are stored; stale is derived when the lesson content revision,
 * the target project or the target's evidence fingerprint no longer match, and is never silently rebound: only an explicit
 * review in Edit mode binds a mapping to the current revisions. Public projection always runs first (publicDocument).
 */
export type MappingState=LearningMapping['state']|'stale';
export const MAPPING_STATE_LABELS:Record<MappingState,string>={suggested:'Suggested · candidate, not evidence','source-declared':'Source-declared',reviewed:'Reviewed by the author',stale:'Stale · needs review',rejected:'Rejected'};
export const CANDIDATE_LABEL='candidate, not evidence';
export type LessonContext={lessonId:string;depth:'overview'|'architecture'|'detail';contentRevision:string};
type Catalogue=readonly LearningEntry[];
const conceptOf=(conceptId:string,catalogue:Catalogue)=>catalogue.find(entry=>entry.id===conceptId);
/** Effective state with the exact reasons a mapping is stale. A rejected mapping stays rejected. */
export function mappingStatus(project:Project,mapping:LearningMapping,catalogue:Catalogue=learningCatalogue):{state:MappingState;staleReasons:string[]}{
 if(mapping.state==='rejected')return {state:'rejected',staleReasons:[]};
 const reasons:string[]=[],concept=conceptOf(mapping.conceptId,catalogue);
 if(!concept)reasons.push(`Concept ${mapping.conceptId} is not in this catalogue version.`);
 else if(concept.editorial.contentRevision!==mapping.contentRevision)reasons.push(`Lesson content changed from revision ${mapping.contentRevision} to ${concept.editorial.contentRevision}.`);
 if(mapping.target.projectId!==project.id)reasons.push(`Mapped in project ${mapping.target.projectId}, not this project.`);
 const fingerprint=targetFingerprint(project,mapping.target);
 if(!fingerprint)reasons.push(`The mapped ${mapping.target.kind} ${mapping.target.id} no longer exists here.`);
 else if(fingerprint!==mapping.target.fingerprint)reasons.push(`The evidence of ${mapping.target.kind} ${mapping.target.id} changed since document revision ${mapping.target.projectRevision}.`);
 const sources=new Set(project.sources.map(s=>s.id)),blocks=new Set(project.blocks.map(b=>b.id));
 for(const id of mapping.evidence.sourceIds)if(!sources.has(id))reasons.push(`Cited source ${id} is no longer in this project.`);
 for(const id of mapping.evidence.blockIds)if(!blocks.has(id))reasons.push(`Cited evidence block ${id} is no longer in this project.`);
 return reasons.length?{state:'stale',staleReasons:reasons}:{state:mapping.state,staleReasons:[]};
}
const project=(input:Project,publicMode:boolean)=>publicMode?publicDocument(input):input;
/** A reachable view for the target: the view itself, or the first reachable view containing the component. No fallback. */
function openTarget(doc:Project,target:LearningMapping['target']):{viewId:string;nodeId?:string}|null{
 if(target.kind==='view')return pathTo(doc,target.id).length?{viewId:target.id}:null;
 const view=doc.views.find(v=>v.nodeIds.includes(target.id)&&pathTo(doc,v.id).length);return view?{viewId:view.id,nodeId:target.id}:null;
}
export type MappingRow={id:string;conceptId:string;state:MappingState;storedState:LearningMapping['state'];staleReasons:string[];origin:LearningMapping['origin'];contentRevision:string;
 target:{kind:'node'|'view';id:string;label:string|null;projectRevision:number};open:{viewId:string;nodeId?:string}|null;evidence:{id:string;kind:'source'|'block';title:string}[];reviewedBy?:string;reviewedAt?:string};
function row(doc:Project,m:LearningMapping,catalogue:Catalogue):MappingRow{
 const status=mappingStatus(doc,m,catalogue),label=m.target.kind==='node'?doc.nodes.find(n=>n.id===m.target.id)?.label:doc.views.find(v=>v.id===m.target.id)?.title;
 const evidence=[...m.evidence.sourceIds.flatMap(id=>{const s=doc.sources.find(s=>s.id===id);return s?[{id,kind:'source' as const,title:s.title}]:[];}),...m.evidence.blockIds.flatMap(id=>{const b=doc.blocks.find(b=>b.id===id);return b?[{id,kind:'block' as const,title:b.title}]:[];})];
 return {id:m.id,conceptId:m.conceptId,state:status.state,storedState:m.state,staleReasons:status.staleReasons,origin:m.origin,contentRevision:m.contentRevision,target:{kind:m.target.kind,id:m.target.id,label:label??null,projectRevision:m.target.projectRevision},open:status.state==='stale'||status.state==='rejected'?null:openTarget(doc,m.target),evidence,...(m.reviewedBy?{reviewedBy:m.reviewedBy}:{}),...(m.reviewedAt?{reviewedAt:m.reviewedAt}:{})};
}
const STOP=new Set(['and','the','for','with','from','into','its','your','what','how','when','are','not','one','two','vs','versus','time','query','data','model','source','review','different','roles','have']);
const terms=(text:string)=>[...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=3&&!STOP.has(t)))];
export type MappingCandidate={nodeId:string;label:string;matchedTerms:string[];score:number;basis:typeof CANDIDATE_LABEL;evidence:{sourceIds:string[];blockIds:string[]}};
/** Ranks components by shared words in label, tags, icon and provider. A ranking only: never a mapping, never evidence. */
export function mappingCandidates(input:Project,entry:LearningEntry,{publicMode=false,limit=5}:{publicMode?:boolean;limit?:number}={}):MappingCandidate[]{
 const doc=project(input,publicMode),wanted=terms([entry.id,entry.title,entry.related.canonicalTopicId??''].join(' ')),taken=new Set((doc.learningMappings??[]).filter(m=>m.conceptId===entry.id).map(m=>m.target.kind+':'+m.target.id));
 if(!wanted.length)return [];
 return doc.nodes.filter(n=>!taken.has('node:'+n.id)).map(n=>{const have=new Set(terms([n.label,...n.tags,n.icon,n.provider].join(' ')));const matchedTerms=wanted.filter(t=>have.has(t));return {nodeId:n.id,label:n.label,matchedTerms,score:matchedTerms.length,basis:CANDIDATE_LABEL,evidence:{sourceIds:[...n.sourceIds],blockIds:[...n.blockIds]}} as MappingCandidate;})
  .filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label)||a.nodeId.localeCompare(b.nodeId)).slice(0,Math.max(1,Math.min(20,limit)));
}
/** The lesson's "In my project" facts, after public projection: established, stale and (authoring only) suggested rows, plus a precise gap. */
export function lessonInstanceFacts(input:Project,entry:LearningEntry,{publicMode=false,catalogue=learningCatalogue}:{publicMode?:boolean;catalogue?:Catalogue}={}){
 const doc=project(input,publicMode),rows=(doc.learningMappings??[]).filter(m=>m.conceptId===entry.id).map(m=>row(doc,m,catalogue));
 const established=rows.filter(r=>r.state==='reviewed'||r.state==='source-declared'),stale=rows.filter(r=>r.state==='stale'),suggested=publicMode?[]:rows.filter(r=>r.state==='suggested'),rejected=publicMode?0:rows.filter(r=>r.state==='rejected').length;
 const gap=established.length?null:`No reviewed mapping. "${entry.title}" has no reviewed or source-declared instance in this ${publicMode?'public projection':'project'}. Missing evidence: a component or view that implements this concept, citing a project source or evidence block, reviewed by the author in Edit mode${stale.length?`; ${stale.length} earlier mapping${stale.length>1?'s are':' is'} stale and must be reviewed again`:''}${suggested.length?`; ${suggested.length} suggestion${suggested.length>1?'s await':' awaits'} review`:''}. A shared name, tag or icon is not evidence.`;
 return {projectId:doc.id,projectRevision:doc.revision,established,stale,suggested,rejected,gap};
}
/** "Explained by": the concepts mapped to one component, after public projection. Suggestions appear only in authoring and say so. */
export function conceptsExplaining(input:Project,nodeId:string,{publicMode=false,catalogue=learningCatalogue}:{publicMode?:boolean;catalogue?:Catalogue}={}){
 const doc=project(input,publicMode);if(!doc.nodes.some(n=>n.id===nodeId))return [];
 return (doc.learningMappings??[]).filter(m=>m.target.kind==='node'&&m.target.id===nodeId).map(m=>({...row(doc,m,catalogue),title:conceptOf(m.conceptId,catalogue)?.title??null,currentRevision:conceptOf(m.conceptId,catalogue)?.editorial.contentRevision??null}))
  .filter(r=>r.state!=='rejected'&&(!publicMode||r.state!=='suggested'));
}
const proposalSchema=z.object({conceptId:learningMappingSchema.shape.conceptId,target:z.object({kind:z.enum(['node','view']),id:learningMappingSchema.shape.target.shape.id}).strict(),evidence:learningMappingSchema.shape.evidence.optional(),
 note:z.string().max(500).optional(),visibility:z.enum(['public','private']).default('public')}).strict();
const nextId=(doc:Project,conceptId:string,targetId:string)=>{const base=('map-'+conceptId+'-'+targetId).slice(0,72).replace(/[^a-z0-9_.-]/g,'-');let id=base,i=2;while((doc.learningMappings??[]).some(m=>m.id===id))id=base+'-'+i++;return id;};
/** Who suggests: set by the calling path (Edit-mode UI, an agent tool, an importer), never read from the proposal itself. */
export type SuggestionOrigin={origin:'author'|'ai'|'imported';suggestedBy:string};
/**
 * Records a suggestion. Strict input: a proposal that tries to carry a state, reviewer, review time, origin or suggester is
 * refused, so an AI or automatic suggestion can never arrive reviewed or pass itself off as the author's. The calling path
 * supplies origin and suggestedBy (recorded for every origin). Binds the current lesson revision and target fingerprint.
 */
export function suggestMapping(input:Project,proposal:unknown,by:SuggestionOrigin,catalogue:Catalogue=learningCatalogue):Project{
 const p=proposalSchema.parse(proposal),concept=conceptOf(p.conceptId,catalogue),suggestedBy=by?.suggestedBy?.trim()??'';
 if(!by||!['author','ai','imported'].includes(by.origin))throw new Error('The calling path sets the suggestion origin: author, ai or imported');
 if(!suggestedBy||suggestedBy.length>160)throw new Error('A suggestion records suggestedBy');
 if(!concept)throw new Error(`Unknown concept ${p.conceptId}`);
 const fingerprint=targetFingerprint(input,p.target);if(!fingerprint)throw new Error(`Unknown ${p.target.kind} ${p.target.id}`);
 if((input.learningMappings??[]).some(m=>m.conceptId===p.conceptId&&m.target.kind===p.target.kind&&m.target.id===p.target.id))throw new Error(`${p.conceptId} is already mapped to ${p.target.kind} ${p.target.id}; review or reject that mapping instead`);
 const d=clone(input),mapping=learningMappingSchema.parse({id:nextId(d,p.conceptId,p.target.id),conceptId:p.conceptId,contentRevision:concept.editorial.contentRevision,target:{projectId:d.id,kind:p.target.kind,id:p.target.id,projectRevision:d.revision,fingerprint},evidence:p.evidence??{sourceIds:[],blockIds:[]},state:'suggested',origin:by.origin,suggestedBy,...(p.note?{note:p.note}:{}),visibility:p.visibility});
 d.learningMappings=[...(d.learningMappings??[]),mapping];return validateDocument(d);
}
/**
 * The explicit human review, offered only in Edit mode. It binds the mapping to the current lesson revision and target
 * evidence (this is how a stale mapping is re-reviewed, never automatically), and needs cited evidence and a reviewer who
 * is not the agent that suggested it.
 */
export function reviewMapping(input:Project,mappingId:string,{reviewedBy,reviewedAt=new Date().toISOString(),evidence}:{reviewedBy:string;reviewedAt?:string;evidence?:{sourceIds:string[];blockIds:string[]}},catalogue:Catalogue=learningCatalogue):Project{
 const d=clone(input),m=d.learningMappings?.find(m=>m.id===mappingId);if(!m)throw new Error(`Unknown concept mapping ${mappingId}`);
 const reviewer=reviewedBy.trim(),concept=conceptOf(m.conceptId,catalogue);if(!reviewer)throw new Error('A review records who reviewed it');
 if(m.origin!=='author'&&sameAgent(reviewer,m.suggestedBy))throw new Error(`An ${m.origin==='ai'?'AI':m.origin} suggestion cannot review itself; a person other than ${m.suggestedBy} reviews it in Edit mode`);
 if(!concept)throw new Error(`Concept ${m.conceptId} is not in this catalogue version`);
 const fingerprint=targetFingerprint(d,m.target);if(!fingerprint)throw new Error(`The mapped ${m.target.kind} ${m.target.id} no longer exists; reject this mapping instead`);
 const cited=evidence??m.evidence,sources=new Set(d.sources.map(s=>s.id)),blocks=new Set(d.blocks.map(b=>b.id));
 const kept={sourceIds:cited.sourceIds.filter(id=>sources.has(id)),blockIds:cited.blockIds.filter(id=>blocks.has(id))};
 if(!kept.sourceIds.length&&!kept.blockIds.length)throw new Error('A reviewed mapping cites at least one project source or evidence block; a shared name, tag or icon is not evidence');
 Object.assign(m,{state:'reviewed',contentRevision:concept.editorial.contentRevision,target:{...m.target,projectId:d.id,projectRevision:d.revision,fingerprint},evidence:kept,reviewedBy:reviewer,reviewedAt});
 return validateDocument(d);
}
/** Explicit rejection in Edit mode. A rejected mapping is kept (so the same candidate is not proposed again) but never shown as an instance. */
export function rejectMapping(input:Project,mappingId:string,{reviewedBy,reviewedAt=new Date().toISOString()}:{reviewedBy:string;reviewedAt?:string}):Project{
 const d=clone(input),m=d.learningMappings?.find(m=>m.id===mappingId);if(!m)throw new Error(`Unknown concept mapping ${mappingId}`);
 const reviewer=reviewedBy.trim();if(!reviewer)throw new Error('A rejection records who rejected it');
 Object.assign(m,{state:'rejected',reviewedBy:reviewer,reviewedAt});return validateDocument(d);
}
/** A saved explanation: always built from publicDocument and bound to the lesson's content revision. */
export function savedExplanation(input:Project,entry:LearningEntry,depth:LessonContext['depth'],catalogue:Catalogue=learningCatalogue){
 const facts=lessonInstanceFacts(input,entry,{publicMode:true,catalogue});
 return {format:'diagramcloud.saved-explanation/1',conceptId:entry.id,title:entry.title,contentRevision:entry.editorial.contentRevision,depth,explanation:entry.lesson.levels[depth],sourceRefs:[...entry.editorial.sourceRefs],projectId:facts.projectId,projectRevision:facts.projectRevision,
  instances:facts.established.map(r=>({mappingId:r.id,state:r.state,target:r.target,evidence:r.evidence,contentRevision:r.contentRevision})),gap:facts.gap,
  note:'Public projection only. Lesson text is authored teaching content; a mapping is a reviewed or source-declared association, not proof of applicability, deployment or runtime.'};
}
