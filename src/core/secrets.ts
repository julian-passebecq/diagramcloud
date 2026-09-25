/**
 * Credential and .env detection for content that crosses an app boundary: external observations entering a
 * document, and the portfolio index leaving it. The rules mirror Mongoku's projection consumer
 * (Mongoku-datapass src/lib/datapass/projection.ts + aiContext.ts scrubSecrets), plus PEM private keys, so
 * DiagramCloud refuses first what Mongoku would refuse. Findings name the path and the reason, never the value.
 * Fails closed: a title such as “token: rotate” is refused too; reword it.
 */
const SECRET_VALUES:RegExp[]=[
 /mongodb(?:\+srv)?:\/\/[^\s"'`]+/i,
 /\b(?:postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s"'`]+/i,
 /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
 /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
 /\bsk-[A-Za-z0-9_-]{16,}\b/,
 /\bAKIA[0-9A-Z]{16}\b/,
 /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
 /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
 /\b(?:password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;"'`]+/i,
 /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
/** A key naming a secret is refused unless its suffix says it only carries a reference or a fact about it. */
const SECRET_KEY=/passw(?:or)?d|passphrase|pwd|secret|token|api_?key|private_?key|recovery_?(?:code|key)|connection_?string|dotenv|env_?contents?/i;
const SAFE_KEY_SUFFIX=/(?:_ref|Ref|_id|Id|_name|Name|_label|Label|_present|Present|_missing|Missing|_expected|Expected|_exists|Exists|_at|At|_count|Count|_status|Status)$/;
const DOTENV_LINE=/^\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=/gm;

export function secretInText(value:string):string|null{
 if(SECRET_VALUES.some(p=>p.test(value)))return 'credential-like value';
 if((value.match(DOTENV_LINE)??[]).length>=2)return 'looks like .env contents';
 return null;
}

/** Paths (never values) of every secret-like field name or value in a JSON-like value. */
export function secretFindings(value:unknown,path='',out:string[]=[]):string[]{
 if(typeof value==='string'){const reason=secretInText(value);if(reason)out.push(`${path||'(root)'}: ${reason}`);}
 else if(Array.isArray(value))value.forEach((v,i)=>secretFindings(v,`${path}[${i}]`,out));
 else if(value&&typeof value==='object')for(const [key,nested] of Object.entries(value)){
  const at=path?`${path}.${key}`:key;
  if(SECRET_KEY.test(key)&&!SAFE_KEY_SUFFIX.test(key))out.push(`${at}: secret-like field name`);
  secretFindings(nested,at,out);
 }
 return out;
}

/** http(s) or vscode link without embedded credentials: the only links that cross an app boundary. */
export function isOpenUri(value:string):boolean{
 try{const u=new URL(value);return ['https:','http:','vscode:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}
}
