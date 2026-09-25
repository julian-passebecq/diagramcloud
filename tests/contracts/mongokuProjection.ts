/**
 * Test oracle: Mongoku's projection consumer, ported verbatim (formatting aside) from Mongoku-datapass
 * commit 8e83981 (2026-09-25): src/lib/datapass/projection.ts `parseProjection`, its `scrubSecrets` patterns
 * from aiContext.ts and `timeOf` from cockpit.ts. It is deliberately NOT DiagramCloud code: the portfolio index
 * must pass the consumer's own rules, not only our mirror of them. Update it when Mongoku's contract changes.
 */
import {z} from 'zod';

const SECRET_PATTERNS:RegExp[]=[
 /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
 /\b(?:postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s"'`]+/gi,
 /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
 /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
 /\bsk-[A-Za-z0-9_-]{16,}\b/g,
 /\bAKIA[0-9A-Z]{16}\b/g,
 /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
 /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
 /\b(password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;"'`]+/gi,
];
function scrubSecrets(value:string):string{
 return SECRET_PATTERNS.reduce((current,pattern)=>current.replace(pattern,(match,key?:string)=>typeof key==='string'&&/[:=]/.test(match)?key+'=[redacted]':'[redacted]'),value);
}
function timeOf(value:string|undefined):number{
 if(!value)return Number.NaN;
 return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00Z':value);
}

export const PROJECTION_LIMITS={bytes:64*1024,items:25,counts:30,text:500} as const;
const OPEN_URI_PROTOCOLS=new Set(['https:','http:','vscode:']);
const boundedText=z.string().min(1).max(PROJECTION_LIMITS.text);
const timestamp=z.string().refine(value=>Number.isFinite(timeOf(value)),'must be an ISO date or timestamp');
const openUri=z.string().refine(value=>{try{const url=new URL(value);return OPEN_URI_PROTOCOLS.has(url.protocol)&&!url.username&&!url.password;}catch{return false;}},'must be an http(s) or vscode link without embedded credentials');
const projectionItemSchema=z.object({id:boundedText,title:boundedText,kind:boundedText.optional(),status:boundedText.optional(),dueAt:timestamp.optional(),openUri:openUri.optional()});
export const projectionEnvelopeSchema=z.object({
 format:z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+\/\d+$/,'must look like <app>.<name>/<major>'),
 projectRef:boundedText,
 sourceApp:z.enum(['powerops','atlasnote','datapass-vscode','diagramcloud','mongoku']),
 sourceObjectId:boundedText,sourceRevision:boundedText.optional(),generatedAt:timestamp,observedAt:timestamp.optional(),openUri:openUri.optional(),
 authority:boundedText,visibility:z.enum(['private','shareable']),freshness:z.enum(['snapshot','live','unknown']),
 lifecycle:z.enum(['current','historical','frozen']).default('current'),
 counts:z.record(z.string().max(64),z.number().int().min(0)).refine(value=>Object.keys(value).length<=PROJECTION_LIMITS.counts,'too many count keys').optional(),
 items:z.array(projectionItemSchema).max(PROJECTION_LIMITS.items).optional(),
});

const SECRET_KEY=/passw(?:or)?d|passphrase|pwd|secret|token|api_?key|private_?key|recovery_?(?:code|key)|connection_?string|dotenv|env_?contents?/i;
const SAFE_KEY_SUFFIX=/(?:_ref|Ref|_id|Id|_name|Name|_label|Label|_present|Present|_missing|Missing|_expected|Expected|_exists|Exists|_at|At|_count|Count|_status|Status)$/;
const DOTENV_LINE=/^\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=/gm;
function secretFindings(value:unknown,path:string,out:string[]):void{
 if(typeof value==='string'){
  if(scrubSecrets(value)!==value)out.push(path+': credential-like value');
  else if((value.match(DOTENV_LINE)??[]).length>=2)out.push(path+': looks like .env contents');
  return;
 }
 if(Array.isArray(value)){value.forEach((nested,index)=>secretFindings(nested,path+'['+index+']',out));return;}
 if(value&&typeof value==='object')for(const [key,nested] of Object.entries(value)){
  const keyPath=path?path+'.'+key:key;
  if(SECRET_KEY.test(key)&&!SAFE_KEY_SUFFIX.test(key))out.push(keyPath+': secret-like field name');
  secretFindings(nested,keyPath,out);
 }
}

export type ParsedProjection={ok:true;projection:z.infer<typeof projectionEnvelopeSchema>}|{ok:false;reason:'too_large'|'secret_like'|'invalid';issues:string[]};
export function parseProjection(raw:unknown):ParsedProjection{
 const size=JSON.stringify(raw??null).length;
 if(size>PROJECTION_LIMITS.bytes)return {ok:false,reason:'too_large',issues:[size+' bytes > '+PROJECTION_LIMITS.bytes]};
 const secrets:string[]=[];secretFindings(raw,'',secrets);
 if(secrets.length>0)return {ok:false,reason:'secret_like',issues:secrets};
 const parsed=projectionEnvelopeSchema.safeParse(raw);
 if(!parsed.success)return {ok:false,reason:'invalid',issues:parsed.error.issues.map(issue=>(issue.path.join('.')||'(root)')+': '+issue.message)};
 return {ok:true,projection:parsed.data};
}
