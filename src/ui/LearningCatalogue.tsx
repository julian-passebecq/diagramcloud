import {useMemo,useState} from 'react';
import {catalogueRows,learningCatalogue,learningSource,lessonsForNativeEntry,matchesCatalogueRow,CATALOGUE_ENTRY_KINDS,CATALOGUE_ENTRY_KIND_LABELS,LEARNING_DOMAINS,type CatalogueKindFilter,type CatalogueRow,type LearningDomainFilter,type LearningEntry} from '../intelligence/learning/catalogue';
import {compileLearningExample,learningExamplesForLesson,scdExercise} from '../intelligence/learning/examples';
import {CATALOGUE_REFERENCE_FAMILIES,type CatalogueFamilyFilter} from '../intelligence/recipes';
/** Static learning catalogue. It reads no Project, calls no AI or network, and never creates a mapping, view or observation. */
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
  {example&&<><p>Authored synthetic example · provenance {example.provenance}. Not an owner project, run or result.</p><p><strong>Input:</strong> {example.input}</p><ol>{example.steps.map((step,i)=><li key={i}>{step}</li>)}</ol><p><strong>Output:</strong> {example.output}</p><p className="micro">Limits: {example.limits.join(' ')}</p></>}
  {scd&&<div><h6>Synthetic table exercise</h6><p>{scd.rows} order lines · sales {scd.sales} synthetic currency units. Interval rule: {scd.intervalSemantics}.</p><ul aria-label="Temporal join result">{scd.matches.map(m=><li key={m.date}>{m.date} → {m.state==='matched'?m.region:m.state+' ('+(m.regions.join(', ')||'none')+')'}</li>)}</ul><p className="micro">Computed here from the labelled synthetic tables; fixture arithmetic, not business evidence.</p></div>}
  {compiled.map(id=>{const doc=compileLearningExample(id);return <div key={id}><h6>Synthetic cookbook example</h6><p>{doc.title} · {doc.nodes.length} declared components · {doc.edges.length} declared connections. Compiled through the native ProjectBrief compiler and document validation; synthetic, no deployment or observed execution.</p><button type="button" onClick={()=>download(id)}>Download synthetic example JSON</button><p className="micro">A new candidate: import it through JSON / AI so it is previewed and reviewed like any other document.</p></div>;})}
 </section>;
}
function Lesson({entry,onOpen,onClose}:{entry:LearningEntry;onOpen:(id:string)=>void;onClose:()=>void}){
 const [depth,setDepth]=useState<Depth>('overview'),[revealed,setRevealed]=useState(false),lesson=entry.lesson;
 const title=(id:string)=>learningCatalogue.find(row=>row.id===id)?.title??id;
 return <article aria-label={'Lesson: '+entry.title} style={{minWidth:0,overflowWrap:'anywhere'}}>
  <h4>{entry.title}</h4>
  <p className="micro">{kindLabel(entry.entryKind)} · {entry.domain} · content revision {entry.editorial.contentRevision} · authored draft adopted {entry.editorial.adoptedOn} · applicability UNKNOWN / not assessed. Reference topic family: not supplied (new topics never receive the source-pinned families).</p>
  {entry.caseStudy&&<p role="note">Dated case study: {entry.caseStudy.subject}. Reported by {entry.caseStudy.reportedBy}; source retrieved {entry.caseStudy.retrievedOn}; publication date {entry.caseStudy.publishedOn??'UNKNOWN'}. A case study only, not a dependency or a migration recommendation. Not to be confused with: {entry.caseStudy.distinctFrom.map(row=>row.label).join('; ')}.</p>}
  <section aria-label="Definition"><h5>Definition</h5><ul>{lesson.definition.map((claim,i)=><li key={i}>{claim.text} <span className="micro">({claim.basis}{claim.sourceRefs.length?'; '+claim.sourceRefs.join(', '):''})</span></li>)}</ul><p><strong>Question:</strong> {lesson.problem}</p></section>
  {lesson.prerequisites.length>0&&<section aria-label="Prerequisites"><h5>Prerequisites</h5><ul>{lesson.prerequisites.map(id=><li key={id}><button type="button" onClick={()=>onOpen(id)}>{title(id)}</button></li>)}</ul></section>}
  <fieldset style={{minWidth:0}}><legend>Explanation depth</legend>{DEPTHS.map(d=><label key={d.id} style={{marginRight:12}}><input type="radio" name={'depth-'+entry.id} value={d.id} checked={depth===d.id} onChange={()=>setDepth(d.id)}/> {d.label}</label>)}</fieldset>
  <p role="status" aria-label="Explanation at selected depth"><strong>{DEPTHS.find(d=>d.id===depth)!.label}:</strong> {lesson.levels[depth]}</p>
  <p className="micro">Depth changes the explanation only; it changes no environment, variant, run or audience.</p>
  {lesson.alternatives&&<section aria-label="Alternatives"><h5>Alternatives</h5><ul>{lesson.alternatives.map((row,i)=><li key={i}><strong>{row.label}</strong>: {row.whenToConsider} <span className="micro">Candidate, not selected.</span></li>)}</ul></section>}
  <ExampleSection entry={entry}/>
  {lesson.failureModes&&<section aria-label="Failure modes"><h5>Failure modes</h5><ul>{lesson.failureModes.map((row,i)=><li key={i}>{row.text}</li>)}</ul><p className="micro">Authored teaching reasoning, not observed incidents.</p></section>}
  {lesson.interview&&<section aria-label="Interview"><h5>Interview · explain it back</h5><p>{lesson.interview.question}</p>{revealed?<><ul aria-label="Answer hints">{lesson.interview.answerHints.map((hint,i)=><li key={i}>{hint}</li>)}</ul><button type="button" onClick={()=>setRevealed(false)}>Hide hints</button></>:<button type="button" onClick={()=>setRevealed(true)}>Reveal answer hints</button>}<p className="micro">Self-explanation, not certification or an assessment score.</p></section>}
  <section aria-label="Sources"><h5>Sources</h5><SourceList ids={entry.editorial.sourceRefs}/></section>
  <section aria-label="In my project"><h5>In my project</h5><p>No reviewed mapping. {entry.instanceMappingPolicy}</p></section>
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
export function LearningCatalogue({entries}:{entries?:readonly unknown[]}){
 const rows=useMemo(()=>catalogueRows(entries??learningCatalogue),[entries]);
 const [query,setQuery]=useState(''),[kind,setKind]=useState<CatalogueKindFilter>('all'),[domain,setDomain]=useState<LearningDomainFilter>('all'),[family,setFamily]=useState<CatalogueFamilyFilter>('all'),[open,setOpen]=useState<string|null>(null);
 const shown=rows.filter(row=>matchesCatalogueRow(row,query,{kind,domain,family})),lessons=rows.flatMap(row=>row.state==='lesson'?[row.entry]:[]),current=lessons.find(entry=>entry.id===open);
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
  {current&&<Lesson key={current.id} entry={current} onOpen={setOpen} onClose={()=>setOpen(null)}/>}
 </section>;
}
