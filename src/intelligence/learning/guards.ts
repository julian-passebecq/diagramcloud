/**
 * Content guards for authored lessons. Deterministic sentence checks over lesson text only (never a Project), run by
 * validateLearningCatalogue so a lesson that conflates two paths or asserts an unreviewed implementation is refused at adoption.
 * They are guards, not understanding: a refused sentence is rewritten by its author, never by the check.
 */
type LessonText={id:string;title:string;summary:string;lesson:{definition:readonly {text:string}[];problem:string;levels:{overview:string;architecture:string;detail:string};
 example?:{input:string;steps:readonly string[];output:string;limits:readonly string[]};alternatives?:readonly {label:string;whenToConsider:string}[];failureModes?:readonly {text:string}[];interview?:{question:string;answerHints:readonly string[]}};
 caseStudy?:{subject:string;distinctFrom:readonly {label:string}[]}};
export type LessonStatement={where:string;text:string};
/** Every authored sentence (or ';' clause) of a lesson with where it is shown. Definitions show at every depth. */
export function lessonStatements(entry:LessonText):LessonStatement[]{
 const l=entry.lesson,parts:[string,string][]=[['title',entry.title],['summary',entry.summary],...l.definition.map((c,i)=>['definition '+(i+1),c.text] as [string,string]),['problem',l.problem],
  ['overview',l.levels.overview],['architecture',l.levels.architecture],['detail',l.levels.detail],
  ...(l.example?[['example input',l.example.input],...l.example.steps.map(s=>['example step',s]),['example output',l.example.output],...l.example.limits.map(s=>['example limit',s])] as [string,string][]:[]),
  ...(l.alternatives??[]).map(a=>['alternative',a.label+'. '+a.whenToConsider] as [string,string]),...(l.failureModes??[]).map(f=>['failure mode',f.text] as [string,string]),
  ...(l.interview?[['interview',l.interview.question],...l.interview.answerHints.map(h=>['answer hint',h])] as [string,string][]:[]),
  ...(entry.caseStudy?[['case study',entry.caseStudy.subject],...entry.caseStudy.distinctFrom.map(d=>['distinct from',d.label])] as [string,string][]:[])];
 return parts.flatMap(([where,text])=>text.split(/(?<=[.;!?])\s+/).map(t=>t.trim()).filter(Boolean).map(t=>({where,text:t})));
}
const CONTEXT_PATH=/\b(?:RAG|retriev\w*|index\w*|context)\b/i;
const WEIGHT_CHANGE=/\b(?:chang\w*|updat\w*|modif\w*|adjust\w*|alter\w*|retrain\w*|rewrit\w*|learn\w*|writ\w*)\b[^.;]*\bweights?\b|\bweights?\b[^.;]*\b(?:chang\w*|updat\w*|modif\w*|adjust\w*|alter\w*)\b/i;
const KEPT_APART=/\b(?:is not|are not|does not|do not|not the same|never|separately|separate|distinct|different|rather than|instead of|whereas|while)\b/i;
/** Training/fine-tuning changes weights; retrieval (RAG) supplies context. A sentence that ties retrieval to a weight change without keeping them apart is a conflation. */
export function weightsContextConflations(entry:LessonText){return lessonStatements(entry).filter(s=>CONTEXT_PATH.test(s.text)&&WEIGHT_CHANGE.test(s.text)&&!KEPT_APART.test(s.text));}
const BRAIN=/\bBrain\b/;
const DISCLAIMED=/\b(?:no claim|never|does not|do not|is not|not (?:established|known|assessed|claimed)|unknown)\b/i;
/** There is no Brain format and no reviewed Brain mapping: any lesson sentence about the (DataPass/local) Brain must disclaim, never assert, its implementation (GraphRAG or any other). */
export function brainImplementationClaims(entry:LessonText){return lessonStatements(entry).filter(s=>BRAIN.test(s.text)&&!DISCLAIMED.test(s.text));}
/** Problems for validateLearningCatalogue. */
export function lessonContentProblems(entry:LessonText):string[]{
 return [...weightsContextConflations(entry).map(s=>`${entry.id}: ${s.where} conflates retrieval context with a weight change: "${s.text}"`),
  ...brainImplementationClaims(entry).map(s=>`${entry.id}: ${s.where} asserts a Brain implementation without a reviewed mapping: "${s.text}"`)];
}
