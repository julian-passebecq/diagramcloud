import {z} from 'zod';
import {validateDocument,type Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {applyDocumentPatch,type Operation,type Patch} from '../../core/patch';
import {CATALOGUE_REFERENCE_FAMILIES} from '../recipes';
import {catalogueRows,learningCatalogue,learningSource,matchesCatalogueRow,CATALOGUE_ENTRY_KINDS,LEARNING_DOMAINS,type CatalogueRow,type LearningEntry} from './catalogue';
import {conceptsExplaining,lessonInstanceFacts,mappingCandidates,suggestMapping,CANDIDATE_LABEL,type SuggestionOrigin} from './mappings';
/**
 * Read-only catalogue lookup shared by the CLI (`npm run intelligence -- catalogue`) and the stdio MCP (`diagramcloud_catalogue`).
 * It calls the same catalogue and mapping functions as the Learning catalogue UI, so every path returns the same rows. A project,
 * when given, is read through its public projection first: hidden components, views, sources and mappings never reach a result
 * or a count. No network, model, execution or mutation; the only write-shaped output is a suggestion patch for author review.
 */
export const CATALOGUE_QUERY_FORMAT='diagramcloud.catalogue-query/1';
const key=z.string().regex(/^[a-z][a-z0-9-]{0,60}$/,'Use a catalogue ID');
const depth=z.enum(['overview','architecture','detail']).default('overview');
export const catalogueQuerySchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('search'),query:z.string().max(160).default(''),kind:z.enum(['all',...CATALOGUE_ENTRY_KINDS]).default('all'),domain:z.enum(['all','not-supplied',...LEARNING_DOMAINS]).default('all'),family:z.enum(['all','not-supplied',...CATALOGUE_REFERENCE_FAMILIES]).default('all'),limit:z.number().int().min(1).max(200).default(50)}).strict(),
 z.object({op:z.literal('lesson'),id:key,depth}).strict(),
 z.object({op:z.literal('prerequisites'),id:key}).strict(),
 z.object({op:z.literal('mappings'),conceptId:key.optional(),nodeId:z.string().max(120).optional()}).strict()]);
export type CatalogueQuery=z.input<typeof catalogueQuerySchema>;
const lessonById=(id:string):LearningEntry=>{const entry=learningCatalogue.find(e=>e.id===id);if(entry)return entry;
 const legacy=catalogueRows([]).find(r=>r.id===id);throw new Error(legacy?`${id} is a ${legacy.kind} registry entry without an authored lesson`:`Unknown lesson ${id}`);};
const ref=(id:string)=>({id,title:learningCatalogue.find(e=>e.id===id)?.title??null});
/** The fields a row shows in the catalogue list; omitted and invalid rows keep their reason, as in the UI. */
function listRow(row:CatalogueRow){
 if(row.state==='lesson')return {state:row.state,kind:row.kind,id:row.id,title:row.title,domain:row.entry.domain,summary:row.entry.summary,contentRevision:row.entry.editorial.contentRevision};
 if(row.state==='legacy-pattern')return {state:row.state,kind:row.kind,id:row.id,title:row.title,topicKey:row.pattern.guidance?.topicKey??null,family:row.pattern.guidance?.catalogueClassification?.family??null};
 if(row.state==='legacy-recipe')return {state:row.state,kind:row.kind,id:row.id,title:row.title,question:row.recipe.question,topicKey:row.recipe.guidance?.topicKey??null,family:row.recipe.guidance?.catalogueClassification?.family??null};
 return {state:row.state,kind:row.kind,id:row.id,title:row.title,reason:row.reason};
}
/** Every transitive prerequisite, learn-first (a prerequisite precedes the lessons that need it). The catalogue has no cycles. */
function prerequisiteOrder(entry:LearningEntry){const seen=new Set<string>(),order:string[]=[];
 const visit=(id:string)=>{if(seen.has(id))return;seen.add(id);for(const next of learningCatalogue.find(e=>e.id===id)?.lesson.prerequisites??[])visit(next);if(id!==entry.id)order.push(id);};
 visit(entry.id);return order;}
const bounded=<T>(out:T):T=>{if(new TextEncoder().encode(JSON.stringify(out)).byteLength>1024*1024)throw new Error('Result exceeds 1 MiB; use a narrower query');return out;};
export function catalogueQuery(request:unknown,project?:Project){
 const q=catalogueQuerySchema.parse(request);
 if(q.op==='search'){const matches=catalogueRows().filter(row=>matchesCatalogueRow(row,q.query,{kind:q.kind,domain:q.domain,family:q.family}));
  return bounded({format:CATALOGUE_QUERY_FORMAT,op:q.op,scope:'static-catalogue',data:{total:matches.length,limited:matches.length>q.limit,rows:matches.slice(0,q.limit).map(listRow)}});}
 if(q.op==='lesson'){const entry=lessonById(q.id),{levels,...lesson}=entry.lesson;
  return bounded({format:CATALOGUE_QUERY_FORMAT,op:q.op,scope:'static-catalogue',data:{id:entry.id,kind:entry.entryKind,title:entry.title,domain:entry.domain,summary:entry.summary,depth:q.depth,explanation:levels[q.depth],
   lesson:{...lesson,prerequisites:lesson.prerequisites.map(ref)},sources:[...new Set([...entry.editorial.sourceRefs,...lesson.sourceRefs])].map(id=>learningSource(id)??{id,missing:true}),
   editorial:entry.editorial,related:entry.related,...(entry.caseStudy?{caseStudy:entry.caseStudy}:{}),note:'Authored teaching content; not evidence about any project, installation or runtime. Applicability stays UNKNOWN_NOT_ASSESSED.'}});}
 if(q.op==='prerequisites'){const entry=lessonById(q.id),direct=new Set(entry.lesson.prerequisites);
  return bounded({format:CATALOGUE_QUERY_FORMAT,op:q.op,scope:'static-catalogue',data:{id:entry.id,title:entry.title,direct:entry.lesson.prerequisites.map(ref),order:prerequisiteOrder(entry).map(id=>({...ref(id),direct:direct.has(id)}))}});}
 if(!project)throw new Error('Mappings need a selected project file');
 const doc=publicDocument(validateDocument(project));
 if(q.nodeId){if(!doc.nodes.some(n=>n.id===q.nodeId))throw new Error('Component unavailable in public projection');
  return bounded({format:CATALOGUE_QUERY_FORMAT,op:q.op,scope:'public-projection',projectId:doc.id,projectRevision:doc.revision,data:{nodeId:q.nodeId,explainedBy:conceptsExplaining(project,q.nodeId,{publicMode:true})}});}
 const entries=q.conceptId?[lessonById(q.conceptId)]:learningCatalogue,rows=entries.map(entry=>{const facts=lessonInstanceFacts(project,entry,{publicMode:true});return {conceptId:entry.id,title:entry.title,contentRevision:entry.editorial.contentRevision,established:facts.established,stale:facts.stale,gap:facts.gap};});
 const shown=q.conceptId?rows:rows.filter(r=>r.established.length||r.stale.length);
 return bounded({format:CATALOGUE_QUERY_FORMAT,op:q.op,scope:'public-projection',projectId:doc.id,projectRevision:doc.revision,data:{concepts:shown,withoutReviewedMapping:rows.filter(r=>!r.established.length).length,
  note:'Reviewed and source-declared public mappings only; suggestions and rejections stay in the authoring document. A mapping is an association, not proof of applicability, deployment or runtime.'}});
}
const suggestionSchema=z.object({conceptId:key,target:z.object({kind:z.enum(['node','view']),id:z.string().min(1).max(120)}).strict().optional(),evidence:z.object({sourceIds:z.array(z.string().max(120)).max(20),blockIds:z.array(z.string().max(120)).max(20)}).strict().optional(),
 note:z.string().max(500).optional(),visibility:z.enum(['public','private']).optional(),limit:z.number().int().min(1).max(20).optional()}).strict();
/**
 * Propose-only concept mapping over the selected project. Without a target it returns the UI's name-based candidates (public
 * projection). With a target it returns a revision-guarded `diagramcloud.patch` adding one `suggested` mapping whose origin and
 * suggester come from the calling path (`by`), never from the request; applying it stays the ordinary reviewed import, and only
 * a person reviews it in Edit mode. A target or citation absent from the public projection is refused with one message.
 */
export function proposeMappingSuggestion(project:Project,request:unknown,by:SuggestionOrigin){
 const r=suggestionSchema.parse(request),doc=validateDocument(project),pub=publicDocument(doc),entry=lessonById(r.conceptId);
 if(!r.target){if(r.evidence||r.note||r.visibility)throw new Error('Evidence, note and visibility need a target');
  return bounded({format:'diagramcloud.mapping-suggestion/1',state:'CANDIDATES_ONLY',scope:'public-projection',projectId:pub.id,projectRevision:pub.revision,conceptId:entry.id,candidates:mappingCandidates(project,entry,{publicMode:true,limit:r.limit??5}),
   note:`Ranked by shared words only (${CANDIDATE_LABEL}). Choose a target to propose a suggestion; nothing is recorded.`});}
 if(r.limit!==undefined)throw new Error('limit applies to candidates only');
 const target=r.target,inPublic=target.kind==='node'?pub.nodes.some(n=>n.id===target.id):pub.views.some(v=>v.id===target.id);
 if(!inPublic)throw new Error('Target unavailable in public projection');
 if(r.evidence&&(!r.evidence.sourceIds.every(id=>pub.sources.some(s=>s.id===id))||!r.evidence.blockIds.every(id=>pub.blocks.some(b=>b.id===id))))throw new Error('Cited evidence unavailable in public projection');
 const next=suggestMapping(doc,{conceptId:entry.id,target,...(r.evidence?{evidence:r.evidence}:{}),...(r.note?{note:r.note}:{}),...(r.visibility?{visibility:r.visibility}:{})},by),mapping=next.learningMappings!.at(-1)!;
 const operations:Operation[]=[{op:'test',path:'/revision',value:doc.revision},doc.learningMappings?{op:'add',path:'/learningMappings/-',value:mapping}:{op:'add',path:'/learningMappings',value:[mapping]}];
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:`Suggested concept mapping ${entry.id} -> ${target.kind} ${target.id} (origin ${by.origin}); ${CANDIDATE_LABEL}; the author reviews or rejects it in Edit mode`,operations};
 applyDocumentPatch(doc,patch);
 return bounded({format:'diagramcloud.proposal/1',state:'REQUIRES_AUTHOR_REVIEW',mappingState:'suggested',origin:by.origin,suggestedBy:mapping.suggestedBy,patch,
  note:'Apply through the ordinary reviewed JSON import. The mapping arrives suggested, never reviewed; only a person other than the suggester reviews it in Edit mode, citing project evidence.'});
}
