import {validationIssues} from '../core/model';

/**
 * Readable refusals for the explanation request form. A schema refusal becomes one sentence per issue that names the
 * form field as the author sees it ("Question to explain is required.", "Step 2 narration is required.").
 * It only explains: the request is never filled in, trimmed or repaired here.
 */
export const EXPLANATION_REVIEW_REFUSED='Review refused; nothing was changed. Check these fields:';
const TOP:Record<string,string>={id:'Walkthrough ID',title:'Title',question:'Question to explain',sourceIds:'Sources for this explanation',steps:'Explanation steps'};
const STEP:Record<string,string>={id:'step ID',title:'title',viewId:'source view',nodeIds:'subjects',edgeIds:'subjects',narration:'narration',sourceIds:'source citations',
 provenance:'evidence basis',dependsOn:'declared prerequisites',caseLabel:'selected case (in Case, prerequisites and questions)',before:'before state',after:'after state',
 code:'frozen code excerpt',takeaway:'takeaway',questions:'questions to explore (in Case, prerequisites and questions)'};
type Issue={path:(string|number)[];message:string;code?:string;type?:string;minimum?:number|bigint;maximum?:number|bigint;received?:string;validation?:unknown;keys?:string[]};

/** The form label for a request path: "Question to explain", "Step 2 narration", "Step 1 question 3 (in Case, prerequisites and questions)". */
export function explanationFieldLabel(path:(string|number)[]):string{
 const [head,index,field,item,part]=path;
 if(head!=='steps'||typeof index!=='number')return typeof head==='string'?TOP[head]??head:'The request';
 const step=`Step ${index+1}`;
 if(field===undefined)return step;
 if(field==='questions'&&typeof item==='number')return `${step} question ${item+1} (in Case, prerequisites and questions)`;
 if((field==='before'||field==='after')&&typeof item==='number')return `${step} ${field} state ${part==='value'?'value':'field'} ${item+1} (in Optional state, code and takeaway)`;
 if(field==='code'&&typeof item==='string')return `${step} frozen code excerpt ${item==='fromLine'?'first line':item==='toLine'?'last line':item}`;
 return `${step} ${typeof field==='string'?STEP[field]??field:field}`;
}

function sentence(issue:Issue):string{
 const label=explanationFieldLabel(issue.path);
 if(issue.code==='invalid_type'&&issue.received==='undefined')return `${label} is required.`;
 if(issue.code==='too_small'&&issue.type==='string'&&Number(issue.minimum)<=1)return `${label} is required.`;
 if(issue.code==='too_small'&&issue.type==='array')return issue.path[0]==='steps'&&issue.path.length===1?'Add at least one explanation step.':`${label} needs at least ${issue.minimum}.`;
 if(issue.code==='too_big'&&issue.type==='string')return `${label} is longer than ${issue.maximum} characters.`;
 if(issue.code==='too_big'&&issue.type==='array')return `${label} has more than ${issue.maximum} entries.`;
 if(issue.code==='too_small'&&issue.type==='number')return `${label} must be at least ${issue.minimum}.`;
 if(issue.code==='invalid_string'&&issue.validation==='regex')return `${label} must start with a lowercase letter and use only lowercase letters, digits, dots, dashes or underscores.`;
 if(issue.code==='unrecognized_keys')return `${label} has unsupported fields: ${(issue.keys??[]).join(', ')}.`;
 const message=issue.message.replace(/\.$/,'');
 return `${label}: ${message}.`;
}

/** One sentence per issue, under a one-line refusal; null when the error is not a schema refusal (the caller shows it as written). */
export function explanationRequestMessage(error:unknown):string|null{
 const issues=validationIssues(error) as Issue[]|null;
 if(!issues)return null;
 return [EXPLANATION_REVIEW_REFUSED,...[...new Set(issues.map(sentence))]].join('\n');
}
