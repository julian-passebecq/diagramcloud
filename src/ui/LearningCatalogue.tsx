import {useEffect,useMemo,useRef,useState} from 'react';
import type {Project} from '../core/model';
import {download as downloadFile} from '../export/browser';
import {lessonInstanceFacts,mappingCandidates,suggestMapping,reviewMapping,rejectMapping,savedExplanation,MAPPING_STATE_LABELS,CANDIDATE_LABEL,type LessonContext,type MappingRow} from '../intelligence/learning/mappings';
import {catalogueRows,learningCatalogue,learningSource,lessonsForNativeEntry,matchesCatalogueRow,CATALOGUE_ENTRY_KINDS,CATALOGUE_ENTRY_KIND_LABELS,LEARNING_DOMAINS,type CatalogueKindFilter,type CatalogueRow,type LearningDomainFilter,type LearningEntry} from '../intelligence/learning/catalogue';
import {compileLearningExample,learningExamplesForLesson,scdExercise} from '../intelligence/learning/examples';import {lessonPlayback} from '../intelligence/learning/playback';import {LessonDiagram,StepPlayback} from './LessonDiagram';
import {CATALOGUE_REFERENCE_FAMILIES,type CatalogueFamilyFilter} from '../intelligence/recipes';
/** Static learning catalogue. It calls no AI or network and never creates a view or observation. "In my project" reads the
 * host's project after public projection; a mapping is created, reviewed or rejected only by an explicit Edit-mode action. */
const DEPTHS=[{id:'overview',label:'Overview'},{id:'architecture',label:'Mechanism'},{id:'detail',label:'Detail'}] as const;
type Depth=typeof DEPTHS[number]['id'];
const kindLabel=(kind:string)=>(CATALOGUE_ENTRY_KIND_LABELS as Record<string,string>)[kind]??kind;
function SourceList({ids}:{ids:string[]}){
 return <ul>{[...new Set(ids)].map(id=>{const source=learningSource(id);return <li key={id}>{source?<><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> · {source.id} · retrieved {source.retrievedOn} · external revision {source.externalRevision??'UNKNOWN'}. <span className="micro">{source.limits}</span></>:<>{id}: source record unavailable.</>}</li>;})}</ul>;
}
function ExampleSection({entry}:{entry:LearningEntry}){
 const example=entry.lesson.example,compiled=learningExamplesForLesson(entry.id),scd=entry.id==='scd-history'||entry.id==='star-grain'?scdExercise():null;
 if(!example&&!compiled.length&&!scd)return null;
 const download=(id:string)=>{const doc=compileLearningExample(id),u=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=doc.id+'.json';a.click();URL.revokeObjectURL(u);};
 return <section aria-label="Example"><h5>Example</h5>
  {example&&<><p>Authored synthetic example · provenance {example.provenance}. Not an owner project, run or result.</p><p><strong>Input:</strong> {example.input}</p>{(()=>{const steps=lessonPlayback(entry);return steps&&<StepPlayback source={steps}/>;})()}<p><strong>Output:</strong> {example.output}</p><p className="micro">Limits: {example.limits.join(' ')}</p></>}
  {scd&&<div><h6>Synthetic table exercise</h6><p>{scd.rows} order lines · sales {scd.sales} synthetic currency units. Interval rule: {scd.intervalSemantics}.</p><ul aria-label="Temporal join result">{scd.matches.map(m=><li key={m.date}>{m.date} → {m.state==='matched'?m.region:m.state+' ('+(m.regions.join(', ')||'none')+')'}</li>)}</ul><p className="micro">Computed here from the labelled synthetic tables; fixture arithmetic, not business evidence.</p></div>}
  {compiled.map(id=>{const doc=compileLearningExample(id);return <div key={id}><h6>Synthetic cookbook example</h6><p>{doc.title} · {doc.nodes.length} declared components · {doc.edges.length} declared connections. Compiled through the native ProjectBrief compiler and document validation; synthetic, no deployment or observed execution.</p><button type="button" onClick={()=>download(id)}>Download synthetic example JSON</button><p className="micro">A new candidate: import it through JSON / AI so it is previewed and reviewed like any other document.</p></div>;})}
 </section>;
}
/** What a host (the studio) supplies: the project and its exposure, the return context, explicit navigation and Edit-only actions. */
export type LearningHost={project?:Project;publicMode?:boolean;initial?:LessonContext|null;onLesson?:(context:LessonContext|null)=>void;onOpenInstance?:(context:LessonContext,target:{viewId:string;nodeId?:string})=>void;onEdit?:(change:(live:Project)=>Project)=>void;reviewer?:string};
export type Citation={id:string;kind:'source'|'block';title:string};
/** The citations a reviewer may tick: the suggestion's own, else the target's sources and evidence blocks. Never preselected. */
export function reviewCitations(project:Project,row:MappingRow):Citation[]{
 if(row.evidence.length)return row.evidence;
 const owner=row.target.kind==='node'?project.nodes.find(n=>n.id===row.target.id):undefined;
 return [...(owner?.sourceIds??[]).flatMap(id=>{const s=project.sources.find(s=>s.id===id);return s?[{id,kind:'source' as const,title:s.title}]:[];}),...(owner?.blockIds??[]).flatMap(id=>{const b=project.blocks.find(b=>b.id===id);return b?[{id,kind:'block' as const,title:b.title}]:[];})];
}
/** Only the ticked citations are sent; Mark reviewed stays disabled (and reviewMapping refuses) until one is ticked. */
export const tickedEvidence=(ticked:readonly string[])=>({sourceIds:ticked.filter(k=>k.startsWith('source:')).map(k=>k.slice(7)),blockIds:ticked.filter(k=>k.startsWith('block:')).map(k=>k.slice(6))});
function ReviewControls({row,citations,reviewer,onEdit,catalogue}:{row:MappingRow;citations:Citation[];reviewer:string;onEdit:NonNullable<LearningHost['onEdit']>;catalogue:readonly LearningEntry[]}){
 const [ticked,setTicked]=useState<string[]>([]),name=row.target.label??row.target.id,keys=new Set(citations.map(c=>c.kind+':'+c.id)),chosen=ticked.filter(k=>keys.has(k));
 const toggle=(key:string,on:boolean)=>setTicked(list=>on?[...new Set([...list,key])]:list.filter(k=>k!==key));
 return <>{citations.length>0&&<fieldset aria-label={'Citations used to review '+name} style={{minWidth:0}}><legend className="micro">Tick the citations you checked for {name}</legend>{citations.map(c=>{const key=c.kind+':'+c.id;return <label key={key} style={{display:'block'}}><input type="checkbox" checked={chosen.includes(key)} onChange={e=>toggle(key,e.target.checked)} aria-label={'Cite '+c.title+' ('+c.kind+' '+c.id+')'}/> {c.title} <span className="micro">({c.kind} {c.id})</span></label>;})}</fieldset>}
  {' '}<button type="button" disabled={!chosen.length} aria-label={'Mark mapping to '+name+' reviewed'} onClick={()=>onEdit(live=>reviewMapping(live,row.id,{reviewedBy:reviewer,evidence:tickedEvidence(chosen)},catalogue))}>{row.state==='stale'?'Review again':'Mark reviewed'}</button>{' '}<button type="button" aria-label={'Reject mapping to '+name} onClick={()=>onEdit(live=>rejectMapping(live,row.id,{reviewedBy:reviewer}))}>Reject</button>
  <span className="micro"> {!citations.length?`Attach a source or evidence block to this ${row.target.kind} first: a name match is not evidence.`:chosen.length?`Review cites the ${chosen.length} ticked reference${chosen.length>1?'s':''}; you review it as ${reviewer}.`:'Tick at least one citation you checked: a name match is not evidence.'}</span></>;
}
function InMyProject({entry,depth,host,catalogue}:{entry:LearningEntry;depth:Depth;host:LearningHost;catalogue:readonly LearningEntry[]}){
 const {project,publicMode=false,onOpenInstance,onEdit}=host;
 const facts=useMemo(()=>project?lessonInstanceFacts(project,entry,{publicMode,catalogue}):null,[project,entry,publicMode,catalogue]),candidates=useMemo(()=>project?mappingCandidates(project,entry,{publicMode}):[],[project,entry,publicMode]);
 if(!project||!facts)return <section aria-label="In my project"><h5>In my project</h5><p>No reviewed mapping. No project is open. {entry.instanceMappingPolicy}</p></section>;
 const context:LessonContext={lessonId:entry.id,depth,contentRevision:entry.editorial.contentRevision},reviewer=(host.reviewer??'').trim()||'author';
 const target=(row:MappingRow)=><>{row.target.label??'(unavailable)'} <span className="micro">{row.target.kind} <code>{row.target.id}</code></span></>;
 const evidenceText=(row:MappingRow)=>row.evidence.length?row.evidence.map(e=>e.title+' ('+e.kind+' '+e.id+')').join('; '):'none cited';
 const review=(row:MappingRow)=>onEdit&&<ReviewControls key={row.id+':'+row.state} row={row} citations={reviewCitations(project,row)} reviewer={reviewer} onEdit={onEdit} catalogue={catalogue}/>;
 return <section aria-label="In my project"><h5>In my project</h5>
  <p className="micro">{publicMode?'Public projection':'Private authoring context'} · project {facts.projectId} · document revision {facts.projectRevision} · lesson content revision {entry.editorial.contentRevision}. A mapping is an association reviewed against cited evidence, not proof of applicability, deployment or runtime.</p>
  {facts.established.length>0&&<ul aria-label="Mapped instances">{facts.established.map(row=><li key={row.id}>{target(row)} · {MAPPING_STATE_LABELS[row.state]}{row.reviewedBy?' ('+row.reviewedBy+(row.reviewedAt?', '+row.reviewedAt.slice(0,10):'')+')':''} · lesson rev {row.contentRevision} · bound at document revision {row.target.projectRevision} · evidence: {evidenceText(row)}{' '}
   {row.open&&onOpenInstance?<button type="button" aria-label={'Open '+(row.target.label??row.target.id)} onClick={()=>onOpenInstance(context,row.open!)}>Open</button>:<span className="micro">Not reachable from the overview in this projection.</span>}</li>)}</ul>}
  {facts.gap&&<p role="note">{facts.gap}</p>}
  {facts.stale.length>0&&<><h6>Stale mappings</h6><ul aria-label="Stale mappings">{facts.stale.map(row=><li key={row.id}>{target(row)} · {MAPPING_STATE_LABELS.stale} (was {row.storedState}). {row.staleReasons.join(' ')} Not rebound automatically.{review(row)}</li>)}</ul></>}
  {facts.suggested.length>0&&<><h6>Suggestions awaiting review</h6><ul aria-label="Suggested mappings">{facts.suggested.map(row=><li key={row.id}>{target(row)} · {MAPPING_STATE_LABELS.suggested} · {row.origin} · evidence: {evidenceText(row)}.{review(row)}</li>)}</ul></>}
  {facts.rejected>0&&<p className="micro">{facts.rejected} rejected mapping{facts.rejected>1?'s are':' is'} kept so the same candidate is not proposed again.</p>}
  {candidates.length>0&&<details><summary>Candidates by name ({CANDIDATE_LABEL})</summary><p className="micro">Ranked only by words shared with component labels, tags, icons and providers. A shared word, tag or icon can suggest a mapping; it never establishes one.</p><ul aria-label="Mapping candidates">{candidates.map(c=><li key={c.nodeId}>{c.label} <code>{c.nodeId}</code> · {CANDIDATE_LABEL} · shared words: {c.matchedTerms.join(', ')}{onEdit&&<>{' '}<button type="button" aria-label={'Suggest mapping to '+c.label} onClick={()=>onEdit(live=>suggestMapping(live,{conceptId:entry.id,target:{kind:'node',id:c.nodeId}},{origin:'author',suggestedBy:reviewer},catalogue))}>Suggest mapping</button></>}</li>)}</ul></details>}
  <button type="button" onClick={()=>{const doc=savedExplanation(project,entry,depth);downloadFile(JSON.stringify(doc,null,2),`${doc.projectId}.${entry.id}.explanation.json`,'application/json');}}>Download explanation JSON</button><span className="micro"> Public projection only, bound to lesson content revision {entry.editorial.contentRevision}.</span>
 </section>;
}
function Lesson({entry,onOpen,onClose,host,initial,catalogue}:{entry:LearningEntry;onOpen:(id:string)=>void;onClose:()=>void;host:LearningHost;initial?:LessonContext|null;catalogue:readonly LearningEntry[]}){
 const restoring=initial?.lessonId===entry.id?initial:null;
 const [depth,setDepthState]=useState<Depth>(restoring?.depth??'overview'),[revealed,setRevealed]=useState(false),lesson=entry.lesson,heading=useRef<HTMLHeadingElement>(null);
 const setDepth=(next:Depth)=>{setDepthState(next);host.onLesson?.({lessonId:entry.id,depth:next,contentRevision:entry.editorial.contentRevision});};
 useEffect(()=>{if(restoring){heading.current?.scrollIntoView?.({block:'start'});heading.current?.focus();}},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const title=(id:string)=>catalogue.find(row=>row.id===id)?.title??id;
 return <article aria-label={'Lesson: '+entry.title} style={{minWidth:0,overflowWrap:'anywhere'}}>
  <h4 ref={heading} tabIndex={-1}>{entry.title}</h4>
  {restoring&&<p role="status" aria-label="Lesson return context">Returned to this lesson at depth {DEPTHS.find(d=>d.id===restoring.depth)!.label}, content revision {restoring.contentRevision}.{restoring.contentRevision!==entry.editorial.contentRevision?' The lesson content has changed since then (now revision '+entry.editorial.contentRevision+'); its mappings show as stale until reviewed again.':''}</p>}
  <p className="micro">{kindLabel(entry.entryKind)} · {entry.domain} · content revision {entry.editorial.contentRevision} · authored draft adopted {entry.editorial.adoptedOn} · applicability UNKNOWN / not assessed. Reference topic family: not supplied (new topics never receive the source-pinned families).</p>
  {entry.caseStudy&&<p role="note">Dated case study: {entry.caseStudy.subject}. Reported by {entry.caseStudy.reportedBy}; source retrieved {entry.caseStudy.retrievedOn}; publication date {entry.caseStudy.publishedOn??'UNKNOWN'}. A case study only, not a dependency or a migration recommendation. Not to be confused with: {entry.caseStudy.distinctFrom.map(row=>row.label).join('; ')}.</p>}
  <section aria-label="Definition"><h5>Definition</h5><ul>{lesson.definition.map((claim,i)=><li key={i}>{claim.text} <span className="micro">({claim.basis}{claim.sourceRefs.length?'; '+claim.sourceRefs.join(', '):''})</span></li>)}</ul><p><strong>Question:</strong> {lesson.problem}</p></section>
  {lesson.prerequisites.length>0&&<section aria-label="Prerequisites"><h5>Prerequisites</h5><ul>{lesson.prerequisites.map(id=><li key={id}><button type="button" onClick={()=>onOpen(id)}>{title(id)}</button></li>)}</ul></section>}
  <fieldset style={{minWidth:0}}><legend>Explanation depth</legend>{DEPTHS.map(d=><label key={d.id} style={{marginRight:12}}><input type="radio" name={'depth-'+entry.id} value={d.id} checked={depth===d.id} onChange={()=>setDepth(d.id)}/> {d.label}</label>)}</fieldset>
  <p role="status" aria-label="Explanation at selected depth"><strong>{DEPTHS.find(d=>d.id===depth)!.label}:</strong> {lesson.levels[depth]}</p>
  <p className="micro">Depth changes the explanation and the containment level the lesson diagram shows; it changes no environment, variant, run, audience or camera zoom.</p><LessonDiagram entry={entry} depth={depth}/>
  {lesson.alternatives&&<section aria-label="Alternatives"><h5>Alternatives</h5><ul>{lesson.alternatives.map((row,i)=><li key={i}><strong>{row.label}</strong>: {row.whenToConsider} <span className="micro">Candidate, not selected.</span></li>)}</ul></section>}
  <ExampleSection entry={entry}/>
  {lesson.failureModes&&<section aria-label="Failure modes"><h5>Failure modes</h5><ul>{lesson.failureModes.map((row,i)=><li key={i}>{row.text}</li>)}</ul><p className="micro">Authored teaching reasoning, not observed incidents.</p></section>}
  {lesson.interview&&<section aria-label="Interview"><h5>Interview · explain it back</h5><p>{lesson.interview.question}</p>{revealed?<><ul aria-label="Answer hints">{lesson.interview.answerHints.map((hint,i)=><li key={i}>{hint}</li>)}</ul><button type="button" onClick={()=>setRevealed(false)}>Hide hints</button></>:<button type="button" onClick={()=>setRevealed(true)}>Reveal answer hints</button>}<p className="micro">Self-explanation, not certification or an assessment score.</p></section>}
  <section aria-label="Sources"><h5>Sources</h5><SourceList ids={entry.editorial.sourceRefs}/></section>
  <InMyProject entry={entry} depth={depth} host={host} catalogue={catalogue}/>
  {(entry.related.nativePatternId||entry.related.nativeRecipeId)&&<p className="micro">Related native entry: {entry.related.nativePatternId?'pattern '+entry.related.nativePatternId:'view recipe '+entry.related.nativeRecipeId} · topic {entry.related.canonicalTopicId}. Its existing authored guidance is unchanged; this lesson links to it and does not replace it.</p>}
  <button type="button" onClick={onClose}>Close lesson</button>
 </article>;
}
function rowSummary(row:CatalogueRow){
 if(row.state==='lesson')return kindLabel(row.kind)+' · '+row.entry.domain+' · lesson';
 if(row.state==='legacy-pattern')return 'Pattern · legacy registry entry · reference family '+(row.pattern.guidance?.catalogueClassification?.family??'not supplied');
 if(row.state==='legacy-recipe')return 'View recipe · legacy registry entry · reference family '+(row.recipe.guidance?.catalogueClassification?.family??'not supplied');
 return '';
}
/** The return context of an opened lesson, looked up in the lessons this catalogue actually shows (custom entries included). */
export function lessonContextFor(lessons:readonly LearningEntry[],id:string|null):LessonContext|null{
 const entry=id?lessons.find(row=>row.id===id):undefined;return entry?{lessonId:entry.id,depth:'overview',contentRevision:entry.editorial.contentRevision}:null;
}
export function LearningCatalogue({entries,host={}}:{entries?:readonly unknown[];host?:LearningHost}){
 const rows=useMemo(()=>catalogueRows(entries??learningCatalogue),[entries]);
 const [initial,setInitial]=useState(()=>host.initial??null);
 const [query,setQuery]=useState(''),[kind,setKind]=useState<CatalogueKindFilter>('all'),[domain,setDomain]=useState<LearningDomainFilter>('all'),[family,setFamily]=useState<CatalogueFamilyFilter>('all'),[open,setOpenState]=useState<string|null>(initial?.lessonId??null);
 const lessons=useMemo(()=>rows.flatMap(row=>row.state==='lesson'?[row.entry]:[]),[rows]);
 const setOpen=(id:string|null)=>{setOpenState(id);setInitial(null);host.onLesson?.(lessonContextFor(lessons,id));};
 const shown=rows.filter(row=>matchesCatalogueRow(row,query,{kind,domain,family})),current=lessons.find(entry=>entry.id===open);
 const reset=()=>{setQuery('');setKind('all');setDomain('all');setFamily('all');};
 return <section aria-label="Learning catalogue" style={{minWidth:0}}><h3>Learning catalogue</h3>
  <p className="micro">Concepts, patterns, case studies and view recipes. Works without a project, Git, cloud or AI. Lessons are authored synthetic teaching content; opening one runs nothing and maps nothing to your project.</p>
  <div className="pi-controls"><label style={{minWidth:0,flex:'1 1 200px'}}>Search lessons<input type="search" maxLength={200} aria-label="Search lessons" value={query} onChange={e=>setQuery(e.target.value)} style={{width:'100%',maxWidth:'100%',boxSizing:'border-box'}}/></label>
   <label style={{minWidth:0}}>Entry kind<select aria-label="Entry kind" value={kind} onChange={e=>setKind(e.target.value as CatalogueKindFilter)}><option value="all">All kinds</option>{CATALOGUE_ENTRY_KINDS.map(k=><option key={k} value={k}>{CATALOGUE_ENTRY_KIND_LABELS[k]}</option>)}</select></label>
   <label style={{minWidth:0}}>Learning domain<select aria-label="Learning domain" value={domain} onChange={e=>setDomain(e.target.value as LearningDomainFilter)}><option value="all">All domains</option>{LEARNING_DOMAINS.map(d=><option key={d} value={d}>{d}</option>)}<option value="not-supplied">Not supplied</option></select></label>
   <label style={{minWidth:0}}>Lesson reference family<select aria-label="Lesson reference family" value={family} onChange={e=>setFamily(e.target.value as CatalogueFamilyFilter)}><option value="all">All families</option>{CATALOGUE_REFERENCE_FAMILIES.map(f=><option key={f}>{f}</option>)}<option value="not-supplied">Not supplied / UNKNOWN</option></select></label>
   <button type="button" onClick={reset}>Reset lesson filters</button></div>
  <p role="status" aria-label="Learning catalogue results">Showing {shown.length} of {rows.length} catalogue entries.</p>
  {!shown.length&&<p>No catalogue entries match these filters. Reset filters to browse all entries.</p>}
  <ul>{shown.map((row,i)=>row.state==='unsupported-kind'||row.state==='invalid'?<li key={'omitted-'+i} role="note">Omitted catalogue entry {row.id??'(no ID)'}{row.state==='unsupported-kind'?' of unsupported kind '+row.kind:''}: {row.reason}.</li>:<li key={row.state+row.id}><strong>{kindLabel(row.kind)+': '+row.title}</strong> <span className="micro">{rowSummary(row)}</span>{' '}
   {row.state==='lesson'?<button type="button" aria-label={'Open lesson '+row.title} onClick={()=>setOpen(row.id)}>Open lesson</button>:<span className="micro">Detailed lesson not supplied for this legacy entry; see its authored guidance in the recipe and pattern sections.{(()=>{const related=lessonsForNativeEntry(row.id,row.kind);return related.length?' Related lesson: '+related.join(', ')+'.':'';})()}</span>}</li>)}</ul>
  {current&&<Lesson key={current.id} entry={current} onOpen={setOpen} onClose={()=>setOpen(null)} host={host} initial={initial} catalogue={lessons}/>}
 </section>;
}
