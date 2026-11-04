import type {EvidenceBlock} from './model';

/** A readable table convention inside ordinary evidence, not a new Project or execution format. */
export const EXPLANATION_DETAILS_FORMAT='diagramcloud.explanation-details/1';
export const EXPLANATION_DETAILS_COLUMNS=['Explanation field','Authored value'];
export type ExplanationDetails={focusQuestion:string;sourceCut:string;caseLabel?:string;prerequisites:string[];questions:string[]};
export type ExplanationDetailsResult={state:'available';block:EvidenceBlock;details:ExplanationDetails}|{state:'unavailable';notice:string}|null;
export function isExplanationDetails(block:EvidenceBlock):boolean{
 return block.type==='table'&&block.rows.some(row=>row[0]==='format'&&String(row[1]).startsWith('diagramcloud.explanation-details/'));
}
export function explanationDetailsRows(details:ExplanationDetails):string[][]{
 return [['format',EXPLANATION_DETAILS_FORMAT],['focus-question',details.focusQuestion],['source-cut',details.sourceCut],
  ...(details.caseLabel?[['case',details.caseLabel]]:[]),...details.prerequisites.map(x=>['prerequisite',x]),...details.questions.map(x=>['question',x])];
}
/** Never infer a contract from prose or an ID prefix. Ambiguous/unsupported structured input stays unavailable. */
export function readExplanationDetails(blocks:EvidenceBlock[]):ExplanationDetailsResult{
 const matches=blocks.filter(isExplanationDetails);if(!matches.length)return null;
 const unavailable=(notice:string):ExplanationDetailsResult=>({state:'unavailable',notice});
 if(matches.length!==1)return unavailable('Several explanation detail records are attached. No record was selected or combined.');
 const block=matches[0];if(block.type!=='table')return null;
 if(block.columns.length!==2||block.columns.some((x,i)=>x!==EXPLANATION_DETAILS_COLUMNS[i])||block.rows.length>32)return unavailable('The explanation detail record has an unsupported structure. Read its original evidence; nothing was repaired.');
 const fields=new Map<string,string[]>(),allowed=new Set(['format','focus-question','source-cut','case','prerequisite','question']);
 for(const row of block.rows){
  if(row.length!==2||typeof row[0]!=='string'||typeof row[1]!=='string'||!allowed.has(row[0])||!row[1].trim()||row[1].length>1600)return unavailable('The explanation detail record contains invalid or unsupported fields. Nothing was interpreted.');
  fields.set(row[0],[...(fields.get(row[0])??[]),row[1]]);
 }
 if(fields.get('format')?.length!==1||fields.get('format')?.[0]!==EXPLANATION_DETAILS_FORMAT)return unavailable('This explanation detail version is unsupported. Nothing was interpreted.');
 if(fields.get('focus-question')?.length!==1||fields.get('source-cut')?.length!==1||(fields.get('case')?.length??0)>1||(fields.get('prerequisite')?.length??0)>20||(fields.get('question')?.length??0)>8)return unavailable('The explanation detail record has missing, duplicate or excessive fields. Nothing was interpreted.');
 return {state:'available',block,details:{focusQuestion:fields.get('focus-question')![0],sourceCut:fields.get('source-cut')![0],caseLabel:fields.get('case')?.[0],prerequisites:fields.get('prerequisite')??[],questions:fields.get('question')??[]}};
}
