import {z} from 'zod';
import {patternSchema,recipeSchema,patternCatalog,recipeRegistry,type ViewRecipe,type CatalogueFamilyFilter} from '../recipes';
import {R4_LEARNING_SOURCES} from './sources';
import {R4_LEARNING_CARDS} from './cards';
import {AUTHORED_FAILURE_MODES,CASE_STUDIES,LEARNING_ADOPTED_ON} from './content';import {lessonContentProblems} from './guards';
/** Optional typed catalogue entries. Editorial lesson content is separate from recognition rules: nothing here reads a Project or changes a match. */
export const CATALOGUE_ENTRY_KINDS=['concept','pattern','procedure','technology','case-study','view-recipe'] as const;
export type CatalogueEntryKind=typeof CATALOGUE_ENTRY_KINDS[number];
export const CATALOGUE_ENTRY_KIND_LABELS:Record<CatalogueEntryKind,string>={concept:'Concept',pattern:'Pattern',procedure:'Procedure',technology:'Technology','case-study':'Case study','view-recipe':'View recipe'};
export const LEARNING_DOMAINS=['warehousing','data-engineering','ai-systems','agentic-development','case-studies'] as const;
const key=z.string().regex(/^[a-z][a-z0-9-]{0,60}$/);
const text=(max=600)=>z.string().min(1).max(max).refine(value=>value.trim().length>0,'Nonblank text required');
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;},'Valid calendar date required');
const sourceRef=z.string().regex(/^(S|DC)-[A-Z0-9-]{1,40}$/);
const safeUrl=z.string().url().max(2048).refine(value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}},'HTTPS citation without credentials required');
/** Static documentation records for lessons. A citation is not proof of an owner installation, runtime or applicability. */
export const learningSourceSchema=z.object({id:sourceRef,title:text(200),url:safeUrl,kind:z.enum(['primary-documentation','primary-provider-case-study','primary-project-documentation','inspected-repository-source','inspected-repository-search-excerpt','observed-github-metadata']),retrievedOn:date,externalRevision:z.string().regex(/^[a-f0-9]{40}$/).nullable(),contentSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable(),limits:text(300)}).strict();
export type LearningSource=z.infer<typeof learningSourceSchema>;
export const learningSources:readonly LearningSource[]=(()=>{const rows=z.array(learningSourceSchema).min(1).max(100).parse(R4_LEARNING_SOURCES.sources);if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Duplicate learning source ID');return rows;})();
const claimSchema=z.object({text:text(),basis:z.enum(['primary-source-summary','provider-reported','authored-reasoning']),sourceRefs:z.array(sourceRef).max(6)}).strict();
/** Optional lesson sections. Absent optional sections are hidden, never an error. */
export const lessonSchema=z.object({
 definition:z.array(claimSchema).min(1).max(6),problem:text(),prerequisites:z.array(key).max(8),
 levels:z.object({overview:text(),architecture:text(),detail:text()}).strict(),
 example:z.object({provenance:z.literal('authored-synthetic'),input:text(),steps:z.array(text()).min(1).max(8),output:text(),limits:z.array(text()).min(1).max(6)}).strict().optional(),
 alternatives:z.array(z.object({label:text(160),whenToConsider:text(),status:z.literal('CANDIDATE_NOT_SELECTED')}).strict()).min(1).max(6).optional(),
 failureModes:z.array(claimSchema).min(1).max(6).optional(),
 interview:z.object({question:text(),answerHints:z.array(text()).min(1).max(6),assessment:z.literal('SELF_EXPLANATION_NOT_CERTIFICATION')}).strict().optional(),
 sourceRefs:z.array(sourceRef).min(1).max(8)
}).strict();
export type Lesson=z.infer<typeof lessonSchema>;
/** Editorial metadata is independent of the five source-pinned reference families, which are never assigned to new topics. */
const editorialSchema=z.object({contentRevision:text(80),provenance:z.literal('r4-packet-authored-draft'),packetContentStatus:z.literal('AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN'),adoptedOn:date,applicability:z.literal('UNKNOWN_NOT_ASSESSED'),sourceRefs:z.array(sourceRef).min(1).max(8)}).strict();
const relatedSchema=z.object({status:z.enum(['EXISTING_NATIVE_TOPIC_REUSE','RECONCILE_WITH_ORIGINAL_64_TOPIC_TABLE']),canonicalTopicId:key.nullable(),nativePatternId:key.optional(),nativeRecipeId:key.optional()}).strict();
const caseStudySchema=z.object({subject:text(200),reportedBy:text(120),retrievedOn:date,publishedOn:date.nullable(),sourceRef,relation:z.literal('CASE_STUDY_ONLY_NOT_A_DEPENDENCY'),distinctFrom:z.array(z.object({label:text(160),sourceRef:sourceRef.nullable()}).strict()).min(1).max(6)}).strict();
export const learningEntrySchema=z.object({entryKind:z.enum(CATALOGUE_ENTRY_KINDS),id:key,version:z.literal(1),title:text(200),summary:text(),domain:z.enum(LEARNING_DOMAINS),editorial:editorialSchema,lesson:lessonSchema,related:relatedSchema,caseStudy:caseStudySchema.optional(),
 instanceMappings:z.array(z.never()).max(0),instanceMappingPolicy:text(300)}).strict().superRefine((entry,ctx)=>{
 if((entry.entryKind==='case-study')!==Boolean(entry.caseStudy))ctx.addIssue({code:z.ZodIssueCode.custom,path:['caseStudy'],message:'A case study, and only a case study, carries dated case-study metadata'});
 if(entry.related.status==='EXISTING_NATIVE_TOPIC_REUSE'?!entry.related.canonicalTopicId||!(entry.related.nativePatternId||entry.related.nativeRecipeId):Boolean(entry.related.canonicalTopicId||entry.related.nativePatternId||entry.related.nativeRecipeId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['related'],message:'Native topic reuse needs exactly a canonical topic and native entry; otherwise none'});
});
export type LearningEntry=z.infer<typeof learningEntrySchema>;
export type LegacyPatternEntry=z.infer<typeof patternSchema>;
/** One catalogue row: an authored lesson, a legacy registry entry decoded unchanged, or a visible omission. */
export type CatalogueRow=
 |{state:'lesson';kind:CatalogueEntryKind;id:string;title:string;entry:LearningEntry}
 |{state:'legacy-pattern';kind:'pattern';id:string;title:string;pattern:LegacyPatternEntry}
 |{state:'legacy-recipe';kind:'view-recipe';id:string;title:string;recipe:ViewRecipe}
 |{state:'unsupported-kind';kind:string;id:string|null;title:string|null;reason:string}
 |{state:'invalid';kind:string|null;id:string|null;title:null;reason:string};
const firstIssue=(error:z.ZodError)=>error.issues.slice(0,3).map(issue=>(issue.path.join('.')||'entry')+': '+issue.message).join('; ');
const shortText=(value:unknown,max=200)=>typeof value==='string'&&value.trim()?value.slice(0,max):null;
/** Backward decoding: an untagged legacy pattern/recipe stays valid; a tagged entry is never coerced into another kind; an unknown future kind is an omission, not a crash. */
export function decodeCatalogueEntry(input:unknown):CatalogueRow{
 if(!input||typeof input!=='object'||Array.isArray(input))return {state:'invalid',kind:null,id:null,title:null,reason:'Catalogue entry must be an object'};
 const raw=input as Record<string,unknown>,id=shortText(raw.id,80),tag=raw.entryKind;
 if('proposalFormat' in raw)return {state:'invalid',kind:null,id,title:null,reason:'A learning proposal envelope is not a catalogue entry; adopt it through the reviewed authored catalogue'};
 if(tag!==undefined&&(typeof tag!=='string'||!(CATALOGUE_ENTRY_KINDS as readonly string[]).includes(tag)))return {state:'unsupported-kind',kind:typeof tag==='string'?tag.slice(0,60):String(typeof tag),id,title:shortText(raw.title),reason:'This catalogue version does not support this entry kind; the entry is omitted, not converted'};
 if('lesson' in raw||'editorial' in raw){const parsed=learningEntrySchema.safeParse(raw);return parsed.success?{state:'lesson',kind:parsed.data.entryKind,id:parsed.data.id,title:parsed.data.title,entry:parsed.data}:{state:'invalid',kind:typeof tag==='string'?tag:null,id,title:null,reason:firstIssue(parsed.error)};}
 const {entryKind,...legacy}=raw;
 if(tag===undefined||tag==='pattern'){const parsed=patternSchema.safeParse(legacy);if(parsed.success)return {state:'legacy-pattern',kind:'pattern',id:parsed.data.id,title:parsed.data.title,pattern:parsed.data};if(tag==='pattern')return {state:'invalid',kind:'pattern',id,title:null,reason:firstIssue(parsed.error)};}
 if(tag===undefined||tag==='view-recipe'){const parsed=recipeSchema.safeParse(legacy);if(parsed.success)return {state:'legacy-recipe',kind:'view-recipe',id:parsed.data.id,title:parsed.data.title,recipe:parsed.data};if(tag==='view-recipe')return {state:'invalid',kind:'view-recipe',id,title:null,reason:firstIssue(parsed.error)};}
 return {state:'invalid',kind:typeof tag==='string'?tag:null,id,title:null,reason:tag===undefined?'Untagged entry is neither a legacy pattern nor a legacy view recipe':'A '+tag+' entry needs authored lesson content; it is not coerced into a pattern or view recipe'};
}
/** Catalogue-wide references: unique IDs (also against legacy registries), known prerequisites without cycles, resolvable sources, native reuse links and the content guards (`./guards`). */
export function validateLearningCatalogue(input:unknown,sources:readonly LearningSource[]=learningSources){
 const entries=z.array(learningEntrySchema).max(200).parse(input),problems:string[]=[],ids=new Set<string>(),sourceIds=new Set(sources.map(source=>source.id));
 const legacyIds=new Set<string>([...patternCatalog.map(row=>row.id),...recipeRegistry.map(row=>row.id)]);
 for(const entry of entries){if(ids.has(entry.id))problems.push('Duplicate catalogue entry ID: '+entry.id);if(legacyIds.has(entry.id))problems.push('Catalogue entry ID collides with a legacy registry ID: '+entry.id);ids.add(entry.id);}
 for(const entry of entries){
  for(const prerequisite of entry.lesson.prerequisites){if(prerequisite===entry.id)problems.push(entry.id+': prerequisite refers to itself');else if(!ids.has(prerequisite))problems.push(entry.id+': unknown prerequisite '+prerequisite);}
  const refs=[...entry.editorial.sourceRefs,...entry.lesson.sourceRefs,...entry.lesson.definition.flatMap(row=>row.sourceRefs),...(entry.lesson.failureModes??[]).flatMap(row=>row.sourceRefs),...(entry.caseStudy?[entry.caseStudy.sourceRef,...entry.caseStudy.distinctFrom.flatMap(row=>row.sourceRef?[row.sourceRef]:[])]:[])];
  for(const ref of new Set(refs))if(!sourceIds.has(ref))problems.push(entry.id+': unknown source reference '+ref);problems.push(...lessonContentProblems(entry));
  if(entry.related.nativePatternId){const pattern=patternCatalog.find(row=>row.id===entry.related.nativePatternId);if(!pattern)problems.push(entry.id+': unknown native pattern '+entry.related.nativePatternId);else if(pattern.guidance?.topicKey!==entry.related.canonicalTopicId)problems.push(entry.id+': canonical topic does not match native pattern guidance');}
  if(entry.related.nativeRecipeId){const recipe=recipeRegistry.find(row=>row.id===entry.related.nativeRecipeId);if(!recipe)problems.push(entry.id+': unknown native recipe '+entry.related.nativeRecipeId);else if(recipe.guidance?.topicKey!==entry.related.canonicalTopicId)problems.push(entry.id+': canonical topic does not match native recipe guidance');}
 }
 const byId=new Map(entries.map(entry=>[entry.id,entry])),state=new Map<string,'visiting'|'done'>();
 const visit=(id:string,path:string[]):void=>{if(state.get(id)==='done')return;if(state.get(id)==='visiting'){problems.push('Prerequisite cycle: '+[...path.slice(path.indexOf(id)),id].join(' -> '));return;}state.set(id,'visiting');for(const next of byId.get(id)?.lesson.prerequisites??[])if(byId.has(next)&&next!==id)visit(next,[...path,id]);state.set(id,'done');};
 for(const entry of entries)visit(entry.id,[]);
 if(problems.length)throw new Error([...new Set(problems)].slice(0,20).join('\n'));
 return entries;
}
const proposalSchema=z.object({proposalFormat:z.literal('diagramcloud.learning-proposal'),proposalVersion:z.literal(1),id:key,entryKind:z.enum(CATALOGUE_ENTRY_KINDS),title:text(200),domain:z.enum(LEARNING_DOMAINS),contentStatus:z.literal('AUTHORED_DRAFT_NATIVE_ADOPTION_NOT_RUN'),contentRevision:text(80),applicability:z.literal('UNKNOWN_NOT_ASSESSED'),summary:text(),
 claims:z.array(claimSchema).min(1).max(6),levels:lessonSchema.shape.levels,prerequisites:z.array(key).max(8),example:lessonSchema.shape.example.unwrap(),alternatives:lessonSchema.shape.alternatives.unwrap(),interview:lessonSchema.shape.interview.unwrap(),sourceRefs:z.array(sourceRef).min(1).max(8),
 instanceMappings:z.array(z.never()).max(0),instanceMappingPolicy:text(300),legacyMapping:z.object({status:relatedSchema.shape.status,canonicalTopicId:key.nullable(),nativePatternId:key.optional(),nativeRecipeId:key.optional()}).strict(),
 displayDefaults:z.object({overviewFirst:z.literal(true),showDetails:z.literal(false),requiresGit:z.literal(false),requiresAI:z.literal(false),requiresCloud:z.literal(false)}).strict()}).strict();
/** Adopts one supplied R4 card into a native entry. The proposal envelope never reaches Project or ProjectBrief parsers. */
export function adoptLearningCard(input:unknown):LearningEntry{
 const card=proposalSchema.parse(input),failureModes=AUTHORED_FAILURE_MODES[card.id],caseStudy=CASE_STUDIES[card.id];
 return learningEntrySchema.parse({entryKind:card.entryKind,id:card.id,version:1,title:card.title,summary:card.summary,domain:card.domain,
  editorial:{contentRevision:card.contentRevision,provenance:'r4-packet-authored-draft',packetContentStatus:card.contentStatus,adoptedOn:LEARNING_ADOPTED_ON,applicability:card.applicability,sourceRefs:card.sourceRefs},
  lesson:{definition:card.claims,problem:card.summary,prerequisites:card.prerequisites,levels:card.levels,example:card.example,alternatives:card.alternatives,...(failureModes?{failureModes}:{}),interview:card.interview,sourceRefs:card.sourceRefs},
  related:{status:card.legacyMapping.status,canonicalTopicId:card.legacyMapping.canonicalTopicId,...(card.legacyMapping.nativePatternId?{nativePatternId:card.legacyMapping.nativePatternId}:{}),...(card.legacyMapping.nativeRecipeId?{nativeRecipeId:card.legacyMapping.nativeRecipeId}:{})},
  ...(caseStudy?{caseStudy}:{}),instanceMappings:[],instanceMappingPolicy:card.instanceMappingPolicy});
}
/** Curriculum order: warehousing, data engineering, AI systems, agentic development, case study. */
export const learningCatalogue:readonly LearningEntry[]=validateLearningCatalogue(R4_LEARNING_CARDS.map(adoptLearningCard));
/** Every catalogue row: legacy registry entries decoded unchanged, then authored lessons. Legacy objects are copied, never shared with the matcher. */
export function catalogueRows(lessons:readonly unknown[]=learningCatalogue):CatalogueRow[]{
 return [...patternCatalog.map(row=>decodeCatalogueEntry(structuredClone(row))),...recipeRegistry.map(row=>decodeCatalogueEntry(structuredClone(row))),...lessons.map(row=>decodeCatalogueEntry(structuredClone(row)))];
}
/** Lessons that link to an existing native pattern or recipe; the native card is never overwritten. */
export function lessonsForNativeEntry(nativeId:string,kind:'pattern'|'view-recipe'){return learningCatalogue.filter(entry=>kind==='pattern'?entry.related.nativePatternId===nativeId:entry.related.nativeRecipeId===nativeId).map(entry=>entry.id);}
export type CatalogueKindFilter='all'|CatalogueEntryKind;
export type LearningDomainFilter='all'|'not-supplied'|typeof LEARNING_DOMAINS[number];
/** Display-only lexical filter over static catalogue text; never reads a Project or match evidence. */
export function matchesCatalogueRow(row:CatalogueRow,query:string,{kind='all',domain='all',family='all'}:{kind?:CatalogueKindFilter;domain?:LearningDomainFilter;family?:CatalogueFamilyFilter}={}){
 if(row.state==='unsupported-kind'||row.state==='invalid')return true;
 if(kind!=='all'&&row.kind!==kind)return false;
 const rowDomain=row.state==='lesson'?row.entry.domain:undefined;
 if(domain==='not-supplied'?rowDomain!==undefined:domain!=='all'&&rowDomain!==domain)return false;
 // Only the five source-pinned legacy cards carry a reference family; lessons are always "not supplied".
 const rowFamily=row.state==='legacy-pattern'?row.pattern.guidance?.catalogueClassification?.family:row.state==='legacy-recipe'?row.recipe.guidance?.catalogueClassification?.family:undefined;
 if(family==='not-supplied'?rowFamily!==undefined:family!=='all'&&rowFamily!==family)return false;
 const needle=query.trim().toLowerCase();
 return !needle||[row.id,row.title,row.state==='lesson'?row.entry.summary:row.state==='legacy-recipe'?row.recipe.question:undefined,row.state==='legacy-pattern'?row.pattern.guidance?.topicKey:row.state==='legacy-recipe'?row.recipe.guidance?.topicKey:row.entry.related.canonicalTopicId??undefined].some(value=>value?.toLowerCase().includes(needle));
}
export function learningSource(id:string){return learningSources.find(source=>source.id===id);}
