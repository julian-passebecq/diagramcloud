import {applyDocumentPatch,isPatch,patchSchema,type Patch} from './patch';
import type {Project} from './model';

/**
 * One proposal validator behind every request path: the JSON / AI dialog (manual import), the CLI
 * `validate-proposal` and the stdio MCP `diagramcloud_validate_proposal`. The same payload against the same
 * document and ledger returns the same reasons, in the same order, whichever path asks.
 *
 * It validates only; it never applies, reviews, publishes, executes or launches anything. The supported proposal
 * kind is a `diagramcloud.patch` targeting the open project. Its origin comes from the calling path, never from the
 * payload: the dialog and CLI are `imported`, MCP is `ai` (with the client name), and `author` only when a person
 * names themself explicitly. A non-author proposal cannot review itself (observations, concept mappings, choices),
 * cannot relabel who suggested something, and cannot be applied twice: replay is detected by a digest of its
 * target and operations, so relabelling the base revision of an applied proposal does not make it new.
 */
export const PROPOSAL_VALIDATION_FORMAT='diagramcloud.proposal-validation' as const;
export const PROPOSAL_ORIGINS=['author','ai','imported'] as const;
export type ProposalOrigin=typeof PROPOSAL_ORIGINS[number];
export type ProposalContext={origin:ProposalOrigin;by:string};
export const REASON_CODES=['unsupported-kind','provider-launch','malformed','wrong-target','wrong-project','stale-revision','replay','self-review','origin-relabel','not-applicable'] as const;
export type ProposalReasonCode=typeof REASON_CODES[number];
export type ProposalReason={code:ProposalReasonCode;message:string};
/** What an applied proposal leaves behind for replay checks. Holds digests and revisions only, never content. */
export type AppliedProposal={digest:string;contentDigest:string;projectId:string;baseRevision:number;appliedRevision?:number};
export type ProposalValidation={
 format:typeof PROPOSAL_VALIDATION_FORMAT;version:1;valid:boolean;kind:'patch'|'unsupported';
 origin:ProposalOrigin;by:string;projectId:string;projectRevision:number;baseRevision:number|null;
 digest:string|null;contentDigest:string|null;operations:number;reasons:ProposalReason[];
 /** Always false: validation never applies. Apply stays the reviewed, revision-guarded step in Edit mode. */
 applied:false;
};

export const PROVIDER_LAUNCH_MESSAGE='DiagramCloud cannot launch a provider, model, command or service from a proposal: proposals are inert data that a person reviews, and nothing is executed or contacted.';
const LAUNCH_KEYS=['provider','model','command','commands','launch','execute','exec','run','endpoint','url','apiKey','prompt','tool','tools','spawn'];
/** A payload that asks for something to be started rather than describing a document change. */
export function isProviderRequest(value:unknown):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const o=value as Record<string,unknown>;
 if('schemaVersion' in o||isPatch(o))return false;
 if(typeof o.format==='string'&&/(provider|launch|execut|run-request|model-request|command)/i.test(o.format))return true;
 return !('format' in o)&&LAUNCH_KEYS.some(k=>k in o);
}

const isObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const canon=(v:unknown):string=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:isObj(v)?`{${Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v)??'null';

/** Synchronous SHA-256 (FIPS 180-4) over UTF-8, so the browser, CLI and MCP compute identical digests without I/O. */
export function sha256Hex(text:string):string{
 const bytes=new TextEncoder().encode(text),bitLength=bytes.length*8,padded=new Uint8Array(((bytes.length+9+63)>>6)<<6);
 padded.set(bytes);padded[bytes.length]=0x80;const view=new DataView(padded.buffer);
 view.setUint32(padded.length-8,Math.floor(bitLength/0x100000000));view.setUint32(padded.length-4,bitLength>>>0);
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Array<number>(64);
 const rotr=(x:number,n:number)=>(x>>>n)|(x<<(32-n));
 for(let off=0;off<padded.length;off+=64){
  for(let i=0;i<16;i++)w[i]=view.getUint32(off+i*4);
  for(let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0;}
  let [a,b,c,d,e,f,g,hh]=h;
  for(let i=0;i<64;i++){const t1=(hh+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])|0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))|0;hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
  h[0]=(h[0]+a)|0;h[1]=(h[1]+b)|0;h[2]=(h[2]+c)|0;h[3]=(h[3]+d)|0;h[4]=(h[4]+e)|0;h[5]=(h[5]+f)|0;h[6]=(h[6]+g)|0;h[7]=(h[7]+hh)|0;
 }
 return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}

/** Replay identity. `digest` binds the proposal to its base revision; `contentDigest` ignores the revision, so a relabelled copy still matches. */
export function proposalDigests(patch:Pick<Patch,'target'|'targetId'|'baseRevision'|'operations'>):{digest:string;contentDigest:string}{
 const content={target:patch.target,targetId:patch.targetId,operations:patch.operations};
 return {digest:'sha256:'+sha256Hex(canon({...content,baseRevision:patch.baseRevision})),contentDigest:'sha256:'+sha256Hex(canon(content))};
}

const same=(a:unknown,b:unknown)=>canon(a)===canon(b);
type Keyed={id:string}&Record<string,unknown>;
const byId=<T extends Keyed>(rows:readonly T[]|undefined)=>new Map((rows??[]).map(r=>[r.id,r] as const));
const allChoices=(d:Project)=>{const rows:Keyed[]=[];for(const owner of [...d.nodes,...d.views])for(const c of owner.choices??[])rows.push({...c,id:`${owner.id}/${c.id}`});return rows;};

/** Review and origin claims a non-author proposal makes, read from the change itself (current → result). */
function reviewClaims(current:Project,result:Project):ProposalReason[]{
 const out:ProposalReason[]=[],self=(message:string)=>out.push({code:'self-review',message}),relabel=(message:string)=>out.push({code:'origin-relabel',message});
 const obs=byId(current.observations as unknown as Keyed[]);
 for(const o of result.observations){const was=obs.get(o.id) as Project['observations'][number]|undefined;
  if(o.reviewedAt&&o.reviewedAt!==was?.reviewedAt)self(`Observation ${o.id}: a proposal cannot mark an observation reviewed; the author reviews it in Edit mode.`);
  if(o.shareable&&!was?.shareable)self(`Observation ${o.id}: a proposal cannot make an observation shareable; that is the author's decision in Edit mode.`);
  if(o.visibility==='public'&&was?.visibility!=='public')self(`Observation ${o.id}: a proposal cannot make an observation public; that is the author's decision in Edit mode.`);}
 const maps=byId(current.learningMappings as unknown as Keyed[]|undefined);
 for(const m of result.learningMappings??[]){const was=maps.get(m.id) as NonNullable<Project['learningMappings']>[number]|undefined;
  if((m.state==='reviewed'||m.state==='rejected')&&m.state!==was?.state)self(`Mapping ${m.id}: a proposal cannot mark a concept mapping ${m.state}; a person reviews or rejects it in Edit mode.`);
  else if((m.reviewedBy!==was?.reviewedBy||m.reviewedAt!==was?.reviewedAt)&&(m.reviewedBy||m.reviewedAt))self(`Mapping ${m.id}: a proposal cannot record a reviewer; a person reviews it in Edit mode.`);
  if(was&&(m.origin!==was.origin||m.suggestedBy!==was.suggestedBy))relabel(`Mapping ${m.id}: a proposal cannot change who suggested it (origin ${was.origin} stays ${was.origin}).`);}
 const choices=byId(allChoices(current));
 for(const c of allChoices(result)){const was=choices.get(c.id);
  if(c.status==='accepted'&&was?.status!=='accepted')self(`Choice ${c.id}: a proposal cannot accept a choice; a person decides it in Edit mode.`);
  else if((c.decidedBy!==was?.decidedBy||c.decidedAt!==was?.decidedAt)&&(c.decidedBy||c.decidedAt))self(`Choice ${c.id}: a proposal cannot record who decided; a person decides it in Edit mode.`);
  if(was&&(c.origin!==was.origin||c.suggestedBy!==was.suggestedBy))relabel(`Choice ${c.id}: a proposal cannot change who suggested it (origin ${String(was.origin)} stays ${String(was.origin)}).`);}
 const variants=byId(current.variants as unknown as Keyed[]|undefined);
 for(const v of result.variants??[]){const was=variants.get(v.id) as NonNullable<Project['variants']>[number]|undefined;
  if(was&&(v.origin!==was.origin||v.suggestedBy!==was.suggestedBy))relabel(`Variant ${v.id}: a proposal cannot change who suggested it (origin ${was.origin} stays ${was.origin}).`);}
 return out;
}

/** Validate one proposal against the open document and the ledger of proposals already applied to it. Pure; never throws for a bad payload. */
export function validateProposal(current:Project,input:unknown,context:ProposalContext,applied:readonly AppliedProposal[]=[]):ProposalValidation{
 const base={format:PROPOSAL_VALIDATION_FORMAT,version:1 as const,origin:context.origin,by:context.by,projectId:current.id,projectRevision:current.revision,applied:false as const};
 const refuse=(reason:ProposalReason,kind:'patch'|'unsupported'='unsupported'):ProposalValidation=>({...base,valid:false,kind,baseRevision:null,digest:null,contentDigest:null,operations:0,reasons:[reason]});
 if(!PROPOSAL_ORIGINS.includes(context.origin))return refuse({code:'malformed',message:`Unknown proposal origin ${String(context.origin)}.`});
 if(isProviderRequest(input))return refuse({code:'provider-launch',message:PROVIDER_LAUNCH_MESSAGE});
 if(!isPatch(input)){const format=isObj(input)&&typeof input.format==='string'?input.format:'this payload';return refuse({code:'unsupported-kind',message:`Only diagramcloud.patch proposals are validated; ${format} is not a supported proposal kind.`});}
 const parsed=patchSchema.safeParse(input);
 if(!parsed.success)return refuse({code:'malformed',message:`Not a valid DiagramCloud patch: ${parsed.error.issues.slice(0,3).map(i=>`${i.path.join('.')||'patch'}: ${i.message}`).join('; ')}`},'patch');
 const patch=parsed.data,{digest,contentDigest}=proposalDigests(patch),reasons:ProposalReason[]=[];
 // Same wording and order as the patch envelope, so every path reads the same sentence.
 if(patch.target!=='project')reasons.push({code:'wrong-target',message:'This patch targets an evidence-workspace pack; use it in the Workspace JSON / AI panel.'});
 else if(patch.targetId!==current.id)reasons.push({code:'wrong-project',message:`This patch is for project “${patch.targetId}”, but “${current.id}” is open.`});
 else if(patch.baseRevision!==current.revision)reasons.push({code:'stale-revision',message:`Stale patch: it was written against revision ${patch.baseRevision}, and the open project is at revision ${current.revision}. Load the current JSON and ask for the patch again.`});
 const prior=applied.find(a=>a.projectId===patch.targetId&&a.contentDigest===contentDigest);
 if(prior)reasons.push({code:'replay',message:`Replay: this proposal was already applied to project “${prior.projectId}” (written against revision ${prior.baseRevision}${prior.appliedRevision!==undefined?`, applied as revision ${prior.appliedRevision}`:''}). A proposal cannot apply twice, and relabelling its base revision does not make it new.`});
 if(!reasons.length){
  try{const {result}=applyDocumentPatch(current,patch);if(context.origin!=='author')reasons.push(...reviewClaims(current,result));}
  catch(e){reasons.push({code:'not-applicable',message:e instanceof Error?e.message:String(e)});}
 }
 return {...base,valid:!reasons.length,kind:'patch',baseRevision:patch.baseRevision,digest,contentDigest,operations:patch.operations.length,reasons};
}

/** The single sentence a refusing path shows or throws. */
export const proposalRefusal=(v:ProposalValidation)=>v.reasons.map(r=>r.message).join(' ');

/** Read a ledger file or MCP argument: digests and revisions only; anything else is refused. */
export function parseAppliedLedger(value:unknown):AppliedProposal[]{
 const rows=isObj(value)&&Array.isArray(value.applied)?value.applied:value;
 if(!Array.isArray(rows)||rows.length>1000)throw new Error('An applied-proposal ledger is an array of at most 1000 {digest, contentDigest, projectId, baseRevision} rows');
 const digest=/^sha256:[a-f0-9]{64}$/;
 return rows.map((r,n)=>{if(!isObj(r)||typeof r.digest!=='string'||!digest.test(r.digest)||typeof r.contentDigest!=='string'||!digest.test(r.contentDigest)||typeof r.projectId!=='string'||!Number.isInteger(r.baseRevision))throw new Error(`Applied-proposal ledger row ${n+1} needs digest, contentDigest (sha256:<64 hex>), projectId and an integer baseRevision`);
  return {digest:r.digest,contentDigest:r.contentDigest,projectId:r.projectId,baseRevision:r.baseRevision as number,...(Number.isInteger(r.appliedRevision)?{appliedRevision:r.appliedRevision as number}:{})};});
}
