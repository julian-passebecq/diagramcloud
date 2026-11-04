import {z} from 'zod';
import {blockSchema,type Project,type EvidenceBlock} from './model';
import {canonical,fnv64} from './learningMapping';
import {readExplanationDetails} from './explanationDetails';
import {PATCH_FORMAT,applyDocumentPatch,type Patch} from './patch';
export const ANSWER_FORMAT='diagramcloud.question-answer/1';
const digest=(x:unknown)=>fnv64(canonical(x));
const id=z.string().min(1).max(120),text=z.string().min(1).max(1600).refine(x=>!!x.trim());
const bindingSchema=z.object({nodeId:id,blockId:id,basis:z.string().regex(/^[0-9a-f]{16}$/),kind:z.enum(['focus','follow-up']),index:z.number().int().min(0).max(7),text}).strict();
const schema=z.object({format:z.literal(ANSWER_FORMAT),binding:bindingSchema,answer:text,author:z.string().min(1).max(160).refine(x=>!!x.trim()),citationIds:z.array(id).max(8),citationBasis:z.string().regex(/^[0-9a-f]{16}$/),review:z.object({reviewer:z.string().min(1).max(160).refine(x=>!!x.trim()),at:z.string().datetime(),fingerprint:z.string().regex(/^[0-9a-f]{16}$/)}).strict().optional()}).strict();
export type QuestionBinding=z.infer<typeof bindingSchema>;
export type AnswerRecord=z.infer<typeof schema>;
export type AnswerRow={block:EvidenceBlock;record?:AnswerRecord;state:'current'|'stale'|'unavailable'|'ambiguous';review:'unreviewed'|'reviewed'|'stale';notice:string};
export function isAnswerBlock(b:EvidenceBlock){return b.type==='code'&&b.code.includes('diagramcloud.question-answer/');}
/** Content identity only, not a security signature. Answer records never become their own source. */
export function questionBasis(doc:Project,nodeId:string):string{
 const n=doc.nodes.find(n=>n.id===nodeId);if(!n)throw Error('The question component is missing.');
 const blocks=n.blockIds.map(id=>doc.blocks.find(b=>b.id===id)??null).filter(b=>!b||!isAnswerBlock(b));
 const sourceIds=[...new Set([...n.sourceIds,...blocks.flatMap(b=>b?.sourceIds??[])])].sort();
 const assetIds=[...new Set(blocks.flatMap(b=>b?.type==='image'?[b.assetId]:[]))].sort();
 return digest({node:{...n,blockIds:blocks.map(b=>b?.id??null)},blocks,sources:sourceIds.map(id=>doc.sources.find(s=>s.id===id)??null),assets:assetIds.map(id=>doc.assets.find(a=>a.id===id)??null)});
}
export function questions(doc:Project,nodeId:string):{items:QuestionBinding[];notice?:string}{
 const n=doc.nodes.find(n=>n.id===nodeId);if(!n)return {items:[],notice:'Question component missing.'};
 const r=readExplanationDetails(doc.blocks.filter(b=>n.blockIds.includes(b.id)));if(!r||r.state!=='available')return {items:[],notice:r?.notice??'No supported question record.'};
 const texts=[r.details.focusQuestion,...r.details.questions];
 if(new Set(texts).size!==texts.length)return {items:[],notice:'Duplicate question text is ambiguous. Original questions and saved answers remain readable; no answer was rebound.'};
 return {items:texts.map((text,i)=>({nodeId,blockId:r.block.id,basis:questionBasis(doc,nodeId),kind:i===0?'focus':'follow-up',index:i===0?0:i-1,text}))};
}
function reviewFingerprint(doc:Project,r:AnswerRecord){return digest({...r,review:undefined,citations:r.citationIds.map(id=>doc.sources.find(s=>s.id===id)??null)});}
export function answerRows(doc:Project,nodeId:string):AnswerRow[]{
 const n=doc.nodes.find(n=>n.id===nodeId);if(!n)return [];
 const q=questions(doc,nodeId);
 const rows:AnswerRow[]=doc.blocks.filter(b=>n.blockIds.includes(b.id)&&isAnswerBlock(b)).map(block=>{
  try{
   if(block.visibility!=='private'||block.type!=='code'||block.language!=='json'||block.code.length>12000)throw Error();
   const record=schema.parse(JSON.parse(block.code));
   if(record.binding.nodeId!==nodeId||new Set(record.citationIds).size!==record.citationIds.length||canonical(block.sourceIds)!==canonical(record.citationIds))throw Error();
   const current=q.items.some(x=>canonical(x)===canonical(record.binding))&&record.citationIds.every(id=>doc.sources.some(s=>s.id===id))&&record.citationBasis===digest(record.citationIds.map(id=>doc.sources.find(s=>s.id===id)??null));
   const review=record.review?(current&&record.review.fingerprint===reviewFingerprint(doc,record)?'reviewed':'stale'):'unreviewed';
   return {block,record,state:current?'current':'stale',review,notice:current?'Authored answer; not an observed fact.':'Source or question changed/missing. Saved answer is read-only; no automatic rebinding.'};
  }catch{return {block,state:'unavailable',review:'unreviewed',notice:'Unsupported or invalid answer record. Original evidence is retained; no interpretation or repair.'};}
 });
 for(const r of rows)if(r.record&&rows.filter(x=>x.record&&canonical(x.record.binding)===canonical(r.record!.binding)).length>1){r.state='ambiguous';r.review='stale';r.notice='Several answers claim the same binding. No record was selected or merged.';}
 return rows;
}
export function proposeAnswer(doc:Project,input:{binding:QuestionBinding;blockId:string;answer:string;author:string;citationIds:string[]}|{reviewBlockId:string;reviewer:string;at:string}):Patch{
 let record:AnswerRecord,blockId:string;
 const nodeId='binding'in input?input.binding.nodeId:doc.nodes.find(n=>n.blockIds.includes(input.reviewBlockId))?.id;
 if(!nodeId)throw Error('Answer component missing.');
 const rows=answerRows(doc,nodeId);if(rows.some(r=>r.state==='unavailable'||r.state==='ambiguous'))throw Error('Resolve unsupported or ambiguous records before proposing an answer. Original evidence is retained.');
 if('binding'in input){
  if(!questions(doc,nodeId).items.some(q=>canonical(q)===canonical(input.binding)))throw Error('The question source changed. Reopen Questions; nothing was rebound.');
  blockId=input.blockId;const prior=doc.blocks.find(b=>b.id===blockId),existing=rows.find(r=>r.block.id===blockId);
  if(prior&&(!existing||existing.state!=='current'||canonical(existing.record!.binding)!==canonical(input.binding)))throw Error('Existing answer is stale or does not match this question.');
  if(rows.some(r=>r.block.id!==blockId&&r.record&&canonical(r.record.binding)===canonical(input.binding)))throw Error('An answer already exists for this exact question binding.');
  record=schema.parse({format:ANSWER_FORMAT,binding:input.binding,answer:input.answer,author:input.author,citationIds:input.citationIds,citationBasis:digest(input.citationIds.map(id=>doc.sources.find(s=>s.id===id)??null))});
 }else{
  blockId=input.reviewBlockId;const existing=rows.find(r=>r.block.id===blockId);if(!existing?.record||existing.state!=='current')throw Error('Only a current unambiguous answer can be reviewed.');
  record=schema.parse({...existing.record,review:{reviewer:input.reviewer,at:input.at,fingerprint:reviewFingerprint(doc,existing.record)}});
 }
 if(new Set(record.citationIds).size!==record.citationIds.length||record.citationIds.some(id=>!doc.sources.some(s=>s.id===id)))throw Error('Choose distinct existing sources; missing citations are not accepted.');
 const block=blockSchema.parse({id:blockId,title:'Authored question answer',type:'code',language:'json',code:JSON.stringify(record,null,2),visibility:'private',provenance:'author',sourceIds:record.citationIds});
 const old=doc.blocks.find(b=>b.id===blockId),node=doc.nodes.find(n=>n.id===nodeId)!;
 const patch:Patch={format:PATCH_FORMAT,version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:'reviewBlockId'in input?'Record named review of authored answer':'Save authored answer; clear previous review',operations:[...(['nodes','blocks','sources','assets'] as const).map(key=>({op:'test' as const,path:`/${key}`,value:doc[key]})),{op:'replace',path:'/blocks',value:old?doc.blocks.map(b=>b.id===blockId?block:b):[...doc.blocks,block]},...(!old?[{op:'replace' as const,path:'/nodes',value:doc.nodes.map(n=>n.id===nodeId?{...node,blockIds:[...node.blockIds,blockId]}:n)}]:[])]};
 applyDocumentPatch(doc,patch);return patch;
}
