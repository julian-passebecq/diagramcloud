/**
 * Local educational client of the catalogue. No code execution, scoring service,
 * hiring recommendation, credential, provider or public progress store.
 * A bank is authored content; it is not a new architecture Project format.
 */
export const QUESTION_KINDS = ['concept','syntax','exercise','scenario'] as const;
export type QuestionKind = typeof QUESTION_KINDS[number];
export type PracticeSource = {id:string;title:string;url:string;retrievedOn:string;versionScope:string};
export type InterviewQuestion = {
 id:string;kind:QuestionKind;prompt:string;hint:string;answer:string;
 checks:string[];pitfall:string;sourceIds:string[];code?:{language:string;text:string};
};
export type InterviewRound = {
 id:string;title:string;domain:string;level:'foundation'|'intermediate';
 prerequisites:string[];overview:string;questions:InterviewQuestion[];caseId:string;
 diagram:{nodes:string[];edges:[number,number,string][]};
};
export type InterviewCase = {
 id:string;name:string;classification:'fictional';business:string;decision:string;
 constraints:string[];unknowns:string[];interviewFocus:string[];
};
export type InterviewBank = {
 id:string;revision:string;authorship:'original-teaching';sources:PracticeSource[];
 cases:InterviewCase[];rounds:InterviewRound[];
};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=6000):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const id=(v:unknown):v is string=>typeof v==='string'&&!['constructor','prototype','__proto__'].includes(v)&&/^[a-z][a-z0-9-]{0,79}$/.test(v);
const validDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
const texts=(v:unknown,max=12):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(x=>text(x,600));
export function practiceBankProblems(v:unknown):string[] {
 const errors:string[]=[];
 if(!obj(v)||!exact(v,['id','revision','authorship','sources','cases','rounds'])||!id(v.id)||!text(v.revision,80)||v.authorship!=='original-teaching')return ['Invalid practice bank header.'];
 if(!Array.isArray(v.sources)||v.sources.length>100||!Array.isArray(v.cases)||v.cases.length>20||!Array.isArray(v.rounds)||!v.rounds.length||v.rounds.length>80)return ['Invalid practice bank collections.'];
 const sources=new Set<string>(),cases=new Set<string>(),rounds=new Set<string>(),questions=new Set<string>();
 for(const s of v.sources){
  if(!obj(s)||!exact(s,['id','title','url','retrievedOn','versionScope'])||!id(s.id)||sources.has(s.id)||!text(s.title,240)||!text(s.versionScope,500)||!validDate(s.retrievedOn)){errors.push('Invalid/duplicate source.');continue;}
  try {const u=new URL(String(s.url)); if(u.protocol!=='https:'||u.username||u.password||String(s.url).length>2048)throw Error();}catch{errors.push('Unsafe citation URL.');}
  sources.add(s.id);
 }
 for(const c of v.cases){
  if(!obj(c)||!exact(c,['id','name','classification','business','decision','constraints','unknowns','interviewFocus'])||!id(c.id)||cases.has(c.id)||c.classification!=='fictional'||!text(c.name,160)||!text(c.business)||!text(c.decision)||!texts(c.constraints)||!texts(c.unknowns)||!texts(c.interviewFocus)){errors.push('Invalid/duplicate fictional case.');continue;}
  cases.add(c.id);
 }
 for(const r of v.rounds){
  if(!obj(r)||!exact(r,['id','title','domain','level','prerequisites','overview','questions','caseId','diagram'])||!id(r.id)||rounds.has(r.id)||!text(r.title,200)||!text(r.domain,80)||!['foundation','intermediate'].includes(String(r.level))||!texts(r.prerequisites)||!text(r.overview)||!cases.has(String(r.caseId))){errors.push('Invalid/duplicate round.');continue;}
  rounds.add(r.id);
  if(!obj(r.diagram)||!exact(r.diagram,['nodes','edges'])||!texts(r.diagram.nodes,10)||r.diagram.nodes.length<2||!Array.isArray(r.diagram.edges)||r.diagram.edges.length>16)errors.push('Invalid concept diagram.');
  else for(const e of r.diagram.edges){if(!Array.isArray(e)||e.length!==3||!Number.isInteger(e[0])||!Number.isInteger(e[1])||e[0]<0||e[1]<0||e[0]>=r.diagram.nodes.length||e[1]>=r.diagram.nodes.length||!text(e[2],120))errors.push('Invalid concept relationship.');}
  if(!Array.isArray(r.questions)||r.questions.length!==4){errors.push('A round requires four question kinds.');continue;}
  r.questions.forEach((q,i)=>{
   if(!obj(q)||!exact(q,['id','kind','prompt','hint','answer','checks','pitfall','sourceIds','code'])||!id(q.id)||questions.has(q.id)||q.kind!==QUESTION_KINDS[i]||!text(q.prompt)||!text(q.hint)||!text(q.answer)||!texts(q.checks,8)||!q.checks.length||!text(q.pitfall)||!Array.isArray(q.sourceIds)||!q.sourceIds.length||q.sourceIds.length>6||q.sourceIds.some(s=>!sources.has(String(s)))){errors.push('Invalid question or source reference.');return;}
   questions.add(q.id);
   if(q.code!==undefined&&(!obj(q.code)||!exact(q.code,['language','text'])||!text(q.code.language,40)||!text(q.code.text,12000)))errors.push('Invalid displayed code.');
  });
 }
 for(const r of v.rounds)if(obj(r)&&Array.isArray(r.prerequisites)&&r.prerequisites.some(x=>!rounds.has(String(x))))errors.push('Unknown prerequisite.');
 // Curriculum links are not allowed to cycle.
 const rawRounds=v.rounds;
 const done=new Set<string>(),visiting=new Set<string>();
 const visit=(key:string):void=>{if(done.has(key))return;if(visiting.has(key)){errors.push('Cyclic prerequisites.');return;}visiting.add(key);const r=rawRounds.find(x=>obj(x)&&x.id===key);if(obj(r)&&Array.isArray(r.prerequisites))for(const dep of r.prerequisites)if(rounds.has(String(dep)))visit(String(dep));visiting.delete(key);done.add(key);};
 for(const key of rounds)visit(key);
 return [...new Set(errors)];
}
export function validatePracticeBank(v:unknown):InterviewBank{
 const problems=practiceBankProblems(v);if(problems.length)throw Error(problems.join(' '));
 return JSON.parse(JSON.stringify(v)) as InterviewBank;
}
/** Exact content cut, not just a claimed editorial revision. Local equality key, not a credential. */
export const practiceContentKey=(bank:InterviewBank)=>JSON.stringify(bank);
export type PracticeRecord={draft:string;revealed:boolean;self:'unrated'|'revisit'|'explained'};
export type PracticeSession={bankKey:string;roundId:string;records:Record<string,PracticeRecord>};
export type PracticeAction=
 |{type:'choose';roundId:string}
 |{type:'draft';questionId:string;value:string}
 |{type:'reveal';questionId:string;value:boolean}
 |{type:'self';questionId:string;value:PracticeRecord['self']}
 |{type:'clear'};
export function newPracticeSession(bank:InterviewBank):PracticeSession{return {bankKey:practiceContentKey(bank),roundId:bank.rounds[0].id,records:{}};}
export function practiceReduce(bank:InterviewBank,session:PracticeSession,action:PracticeAction):PracticeSession{
 if(session.bankKey!==practiceContentKey(bank))throw Error('Practice source changed. Start a new session; never silently rebind answers.');
 if(action.type==='clear')return newPracticeSession(bank);
 if(action.type==='choose'){if(!bank.rounds.some(r=>r.id===action.roundId))throw Error('Round unavailable.');return {...session,roundId:action.roundId};}
 const round=bank.rounds.find(r=>r.id===session.roundId);
 if(!round?.questions.some(q=>q.id===action.questionId))throw Error('Question unavailable in the selected round.');
 const prior=session.records[action.questionId]??{draft:'',revealed:false,self:'unrated'};
 let record:PracticeRecord={...prior};
 if(action.type==='draft'){if(typeof action.value!=='string'||action.value.length>8000)throw Error('Answer too long.');record.draft=action.value;record.self='unrated';}
 else if(action.type==='reveal'){if(typeof action.value!=='boolean')throw Error('Invalid reveal.');record.revealed=action.value;}
 else if(action.type==='self'){if(!['unrated','revisit','explained'].includes(action.value))throw Error('Invalid self review.');if(!prior.revealed)throw Error('Read the reference before self review.');record.self=action.value;}
 else throw Error('Unsupported practice action.');
 return {...session,records:{...session.records,[action.questionId]:record}};
}
export function practiceCoverage(bank:InterviewBank,session:PracticeSession){
 if(session.bankKey!==practiceContentKey(bank))return {state:'stale' as const,attempted:0,reviewed:0,total:bank.rounds.length*4};
 const values=Object.values(session.records);
 return {state:'current' as const,attempted:values.filter(x=>x.draft.trim()).length,reviewed:values.filter(x=>x.self!=='unrated').length,total:bank.rounds.length*4};
}
export const findPracticeRounds=(bank:InterviewBank,query:string,domain='all')=>{
 const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return bank.rounds.filter(r=>(domain==='all'||r.domain===domain)&&terms.every(term=>[r.title,r.domain,r.overview,...r.questions.map(q=>q.prompt)].join(' ').toLocaleLowerCase().includes(term)));
};
