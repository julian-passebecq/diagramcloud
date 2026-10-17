import type {Project} from '../../core/model';
/**
 * Substitution check: could a candidate (an alternative option, another component, a catalogue alternative) replace a
 * component? It lists what the component is declared to satisfy (its role, each connection it takes part in, the
 * assumptions of the decision that chose it) and reports each requirement UNKNOWN unless explicit compatibility evidence
 * citing a project source or a non-synthetic evidence block says otherwise. A matching name, provider or catalogue family
 * is never proof. Pure: nothing is recorded, applied or accepted; deciding stays a human Edit action.
 */
export type SubstitutionVerdict='UNKNOWN'|'compatible-per-cited-evidence'|'not-substitutable'|'unavailable';
export const SUBSTITUTION_LABELS:Record<SubstitutionVerdict,string>={
 UNKNOWN:'UNKNOWN · compatibility not established',
 'compatible-per-cited-evidence':'Compatible per cited evidence · not a verification',
 'not-substitutable':'Not substitutable per cited evidence',
 unavailable:'Unavailable · the component is not in this document'
};
export const NOT_PROOF='A matching name, provider or catalogue family is not proof that one can replace the other.';
export type SubstitutionCandidate={label:string;provider?:string;family?:string;choiceId?:string;optionId?:string};
/** Supplied compatibility evidence for one requirement. Only citations that resolve in this document count. */
export type CompatibilityEvidence={requirementId:string;verdict:'satisfied'|'violated';sourceIds?:string[];blockIds?:string[];requirementText?:string;recordedBy?:string;recordedAt?:string};
export type Requirement={id:string;kind:'role'|'connection'|'assumption';text:string;state:'UNKNOWN'|'satisfied'|'violated';citations:string[];recordedBy?:string;recordedAt?:string};
/** Recorded or supplied evidence that was not counted, with the reason (removed or changed requirement, no usable citation). */
export type IgnoredEvidence={requirementId:string;reason:string};
export type SubstitutionResult={verdict:SubstitutionVerdict;label:string;current:{nodeId:string;label:string|null};candidate:SubstitutionCandidate;requirements:Requirement[];reasons:string[];notProof:string[];ignored:IgnoredEvidence[]};
/** The requirements of a component that compatibility evidence can name, without any evidence applied. */
export function substitutionRequirements(doc:Project,nodeId:string,choiceId?:string):Requirement[]{return substitutionCheck(doc,nodeId,{label:'',...(choiceId?{choiceId}:{})},[],{recorded:false}).requirements;}
const words=(text:string)=>new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=3));
/**
 * `evidence` is supplied for this check only. Unless `recorded` is false, the compatibility evidence recorded on the
 * candidate option (`choiceId` + `optionId`, recorded in Edit mode by a named person) is read first.
 */
export function substitutionCheck(doc:Project,nodeId:string,candidate:SubstitutionCandidate,supplied:readonly CompatibilityEvidence[]=[],{recorded=true}:{recorded?:boolean}={}):SubstitutionResult{
 const node=doc.nodes.find(n=>n.id===nodeId);
 if(!node)return {verdict:'unavailable',label:SUBSTITUTION_LABELS.unavailable,current:{nodeId,label:null},candidate,requirements:[],reasons:[`Component ${nodeId} is not in this document.`],notProof:[NOT_PROOF],ignored:[]};
 const label=(id:string)=>doc.nodes.find(n=>n.id===id)?.label??id,inView=new Set(doc.views.flatMap(v=>v.edgeIds));
 const requirements:Requirement[]=[{id:`role:${node.id}`,kind:'role',text:`Plays the ${node.kind} role of “${node.label}”`,state:'UNKNOWN',citations:[]}];
 for(const e of doc.edges.filter(e=>inView.has(e.id)&&(e.source===node.id||e.target===node.id)).sort((a,b)=>a.id.localeCompare(b.id)))
  requirements.push(e.target===node.id
   ?{id:`in:${e.id}`,kind:'connection',text:`Accepts the ${e.kind} input from “${label(e.source)}”${e.label?` (${e.label})`:''}`,state:'UNKNOWN',citations:[]}
   :{id:`out:${e.id}`,kind:'connection',text:`Provides the ${e.kind} output to “${label(e.target)}”${e.label?` (${e.label})`:''}`,state:'UNKNOWN',citations:[]});
 const choice=candidate.choiceId?node.choices?.find(c=>c.id===candidate.choiceId):undefined;
 choice?.assumptions.forEach((a,i)=>requirements.push({id:`assumption:${choice.id}:${i}`,kind:'assumption',text:`Keeps the assumption: ${a}`,state:'UNKNOWN',citations:[]}));
 const reasons:string[]=[],ignored:IgnoredEvidence[]=[],sources=new Set(doc.sources.map(s=>s.id)),blocks=new Map(doc.blocks.map(b=>[b.id,b]));
 const ignore=(requirementId:string,reason:string)=>{ignored.push({requirementId,reason});reasons.push(reason);};
 const own=recorded&&choice&&candidate.optionId?choice.options.find(o=>o.id===candidate.optionId)?.compatibility??[]:[];
 for(const ev of [...own,...supplied]){const req=requirements.find(r=>r.id===ev.requirementId);
  if(!req){ignore(ev.requirementId,`Evidence for ${ev.requirementId} matches no requirement of this component and is ignored; it is never rebound to another requirement.`);continue;}
  if(ev.requirementText!==undefined&&ev.requirementText!==req.text){ignore(req.id,`Evidence for ${req.id} was recorded for “${ev.requirementText}”, which now reads “${req.text}”: ignored, never rebound. Record it again if it still holds.`);continue;}
  const cited=[...(ev.sourceIds??[]).filter(id=>sources.has(id)),...(ev.blockIds??[]).filter(id=>{const b=blocks.get(id);return !!b&&b.provenance!=='synthetic';})];
  if((ev.blockIds??[]).some(id=>blocks.get(id)?.provenance==='synthetic'))reasons.push(`A synthetic evidence block cannot establish ${req.id}; it illustrates, it does not measure.`);
  if(!cited.length){ignore(req.id,`Evidence for ${req.id} cites no project source or non-synthetic evidence block, so it stays UNKNOWN.`);continue;}
  if(req.state!=='violated'){req.state=ev.verdict;req.citations=[...new Set([...req.citations,...cited])];if(ev.recordedBy){req.recordedBy=ev.recordedBy;if(ev.recordedAt)req.recordedAt=ev.recordedAt;}}
 }
 const violated=requirements.filter(r=>r.state==='violated'),unknown=requirements.filter(r=>r.state==='UNKNOWN');
 const verdict:SubstitutionVerdict=violated.length?'not-substitutable':unknown.length?'UNKNOWN':'compatible-per-cited-evidence';
 if(verdict==='UNKNOWN')reasons.push(`${unknown.length} of ${requirements.length} requirement${requirements.length===1?' has':'s have'} no compatibility evidence. Missing: a project source or evidence block showing that “${candidate.label}” satisfies ${unknown.length===1?'it':'each'}.`);
 const notProof=[NOT_PROOF],shared=[...words(candidate.label)].filter(w=>words(node.label).has(w));
 if(shared.length)notProof.push(`“${candidate.label}” shares the words ${shared.join(', ')} with “${node.label}”: not evidence.`);
 if(candidate.provider&&candidate.provider.trim().toLowerCase()===node.provider.trim().toLowerCase())notProof.push(`Same provider (${node.provider}): not evidence.`);
 if(candidate.family)notProof.push(`Same catalogue family (${candidate.family}): not evidence.`);
 return {verdict,label:SUBSTITUTION_LABELS[verdict],current:{nodeId:node.id,label:node.label},candidate,requirements,reasons,notProof,ignored};
}
