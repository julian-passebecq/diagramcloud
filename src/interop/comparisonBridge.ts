import {validateDocument, type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {evolutionSnapshot, type EvolutionSnapshot} from '../intelligence/evolution';
import type {ProjectionV2, CorrespondenceV2, ScenarioInput, ScenarioRequest, ReviewBundle} from './generated/scenario';

export type Audience = 'author'|'public';
export const REVIEW_LIMIT = 8 * 1024 * 1024;
const encoder = new TextEncoder();
/** Rust's BTreeMap compares UTF-8 bytes, not browser locale or UTF-16 units. */
export function utf8Compare(a:string,b:string):number {
 const x=encoder.encode(a),y=encoder.encode(b);for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length;
}
export function canonicalJson(value:unknown):string {
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>(value as Record<string,unknown>)[k]!==undefined).sort(utf8Compare).map(k=>JSON.stringify(k)+':'+canonicalJson((value as Record<string,unknown>)[k])).join(',')+'}';
 throw new Error('Non-JSON value in comparison materialization.');
}
export async function sha256(text:string):Promise<string> {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
/** Old immutable evolution receipts wrote an undefined literal for absent optional fields.
 * Decode that one historical token without evaluating any source. Quoted text is untouched.
 */
export function readEvolutionSemantic(text:string):Record<string,unknown> {
 if(encoder.encode(text).length>150000)throw new Error('Retained semantic field exceeds its limit.');
 let at=0;
 const ws=()=>{while(/\s/.test(text[at]??'')&&at<text.length)at++;};
 const string=():string=>{const start=at++;let escape=false;while(at<text.length){const c=text[at++];if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c==='"')return JSON.parse(text.slice(start,at));}throw new Error('Unterminated retained string.');};
 const value=(depth:number):unknown=>{if(depth>40)throw new Error('Retained semantic nesting exceeds limit.');ws();const c=text[at];
  if(c==='"')return string();
  if(c==='{'){at++;const object:Record<string,unknown>=Object.create(null),seen=new Set<string>();ws();if(text[at]==='}'){at++;return object;}
   for(;;){ws();if(text[at]!=='"')throw new Error('Invalid retained object key.');const key=string();if(seen.has(key))throw new Error('Duplicate retained object key.');seen.add(key);ws();if(text[at++]!==':')throw new Error('Invalid retained object.');const item=value(depth+1);if(item!==undefined)object[key]=item;ws();const end=text[at++];if(end==='}')return object;if(end!==',')throw new Error('Invalid retained object separator.');}
  }
  if(c==='['){at++;const array:unknown[]=[];ws();if(text[at]===']'){at++;return array;}for(;;){const item=value(depth+1);if(item===undefined)throw new Error('Missing array values are unsupported.');array.push(item);ws();const end=text[at++];if(end===']')return array;if(end!==',')throw new Error('Invalid retained array.');}}
  const token=/^(?:undefined|null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at))?.[0];if(!token)throw new Error('Invalid retained literal.');at+=token.length;if(token==='undefined')return undefined;return JSON.parse(token);
 };
 const parsed=value(0);ws();if(at!==text.length||!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Retained semantic object is invalid.');return parsed as Record<string,unknown>;
}

const sorted=(values:string[])=>[...new Set(values)].sort(utf8Compare);
async function boundedProperties(input:Record<string,unknown>,warnings:Set<string>):Promise<Record<string,string>> {
 const result:Record<string,string>={};
 for(const key of Object.keys(input).sort(utf8Compare)) {if(input[key]===undefined)continue;const value=typeof input[key]==='string'?input[key] as string:canonicalJson(input[key]);
  if(encoder.encode(value).length>4096){result[key+'.sha256']=await sha256(value);warnings.add('EVIDENCE_DIGEST_ONLY: A property exceeds 4096 UTF-8 bytes; its permitted content is compared by SHA-256, not displayed in the report.');}else result[key]=value;
 }return result;
}
export async function projectionFromSnapshot(snapshot:EvolutionSnapshot,options:{audience:Audience;viewIds?:string[];edgeIds?:string[];derivation?:string;label?:string}):Promise<ProjectionV2> {
 // Retained snapshots are private receipts. Public calls must materialize a current public Project instead.
 const warnings=new Set<string>(['SEMANTIC_SUBSET: Comparison covers component meaning, connection contracts and cited evidence. Story order, icons, view descriptions, choices, delivery/environment metadata and source acquisition extensions are not evaluated.', 'NO_RUNTIME_ATTESTATION: Authored membership and source references do not establish deployment, observation or source deletion.']);
 const ids=sorted(options.viewIds??[]);
 const chosenNodes=snapshot.nodes.filter(n=>!ids.length||((readEvolutionSemantic(n.presentation).positions??[]) as {id:string}[]).some(p=>ids.includes(p.id)));
 const nodeIds=new Set(chosenNodes.map(n=>n.id));
 const evidence=new Map(snapshot.evidence.map(e=>[e.id,e.signature]));
 const entities=await Promise.all(chosenNodes.map(async n=>{
  const semantic=readEvolutionSemantic(n.semantic);
  const content=Object.fromEntries(n.evidenceIds.filter(id=>evidence.has(id)).sort(utf8Compare).map(id=>[id,evidence.get(id)]));
  return {id:n.id,label:n.label,kind:typeof semantic.kind==='string'?semantic.kind:'component',properties:await boundedProperties({semantic,evidence:content,claims:n.claims,confidence:n.confidence,sourceReferencesDigest:await sha256(canonicalJson(n.sourceRefs))},warnings),evidenceRefs:sorted(n.evidenceIds).slice(0,64)};
 }));
 const relationships=await Promise.all(snapshot.edges.filter(e=>{const sem=readEvolutionSemantic(e.semantic);if(typeof sem.source!=='string'||typeof sem.target!=='string'||!snapshot.nodes.some(n=>n.id===sem.source)||!snapshot.nodes.some(n=>n.id===sem.target))throw new Error('Retained connection endpoints are invalid or unavailable.');return nodeIds.has(String(sem.source))&&nodeIds.has(String(sem.target))&&(!ids.length||(options.edgeIds?options.edgeIds.includes(e.id):e.perspectives.length>0));}).map(async e=>{
  const sem=readEvolutionSemantic(e.semantic);if(typeof sem.source!=='string'||typeof sem.target!=='string')throw new Error('Retained connection endpoints are unavailable.');
  return {id:e.id,fromId:sem.source,toId:sem.target,relation:typeof sem.kind==='string'?sem.kind:'dependency',label:e.label,properties:await boundedProperties({basis:sem.basis??'unknown',quantity:sem.quantity,sourceReferencesDigest:await sha256(canonicalJson(e.sourceRefs))},warnings),evidenceRefs:sorted(e.evidenceIds).slice(0,64)};
 }));
 if([...chosenNodes,...snapshot.edges].some(n=>n.evidenceIds.length>64))warnings.add('EVIDENCE_REFERENCE_LIMIT: At most 64 reference IDs are exposed per component; all supplied permitted evidence content remains covered by its property or digest.');
 if(ids.length&&!options.edgeIds)warnings.add('VIEW_MEMBERSHIP_PARTIAL: Endpoints select connections in retained history; historical exact edge-view membership is unavailable. Absence does not establish deletion.');
 const scope={kind:ids.length?'views' as const:'project' as const,ids,coverage:ids.length?'partial' as const:snapshot.scope.complete?'declared-complete' as const:'unknown' as const};
 entities.sort((a,b)=>utf8Compare(a.id,b.id));relationships.sort((a,b)=>utf8Compare(a.id,b.id));
 const digest=await sha256(canonicalJson({entities,relationships,scope}));
 return {source:{projectId:snapshot.projectId,snapshotId:'sha256-'+digest},label:options.label??snapshot.label,binding:{digest,audience:options.audience,revision:options.audience==='author'?String(snapshot.documentRevision):null,derivation:options.audience==='author'?options.derivation??null:null},scope,entities,relationships,warnings:[...warnings].sort(utf8Compare)};
}
export async function projectProjection(input:Project,options:{audience:Audience;viewIds?:string[];derivation?:string}):Promise<ProjectionV2> {
 const validated=validateDocument(input),doc=options.audience==='public'?publicDocument(validated):validated;
 if(options.viewIds?.some(id=>!doc.views.some(v=>v.id===id)))throw new Error('Selected scope is unavailable in this audience.');
 const snapshot=evolutionSnapshot(doc,{label:doc.title,capturedAt:'2000-01-01T00:00:00.000Z'});
 return projectionFromSnapshot(snapshot,{...options,edgeIds:options.viewIds?.length?sorted(doc.views.filter(v=>options.viewIds!.includes(v.id)).flatMap(v=>v.edgeIds)):undefined,label:doc.title});
}
/** Call only for lineage the editor owns: active Project, its variants or its retained history. */
export function ancestorCorrespondence(before:ProjectionV2,after:ProjectionV2,evidenceRef:string):CorrespondenceV2 {
 if(before.source.projectId!==after.source.projectId)throw new Error('Common project identity is required for this explicit ancestry mapping.');
 const matching=(a:{id:string}[],b:{id:string}[])=>a.filter(x=>b.some(y=>y.id===x.id)).map(x=>({beforeId:x.id,afterId:x.id}));
 return {source:before.source,target:after.source,sourceDigest:before.binding.digest,targetDigest:after.binding.digest,evidenceRef,entities:matching(before.entities,after.entities),relationships:matching(before.relationships,after.relationships)};
}
export function scenarioRequest(scenarios:ScenarioInput[],mode:'evolution'|'alternatives',trustedAncestor:boolean):ScenarioRequest {
 if(scenarios.length<2||scenarios.length>4)throw new Error('Select two to four scenarios.');
 if(mode==='evolution'&&scenarios.length!==2)throw new Error('Before/after evolution needs exactly two selected snapshots.');
 const pairs:ScenarioRequest['pairs']=[];
 for(let i=0;i<scenarios.length;i++)for(let j=i+1;j<scenarios.length;j++){const a=scenarios[i],b=scenarios[j];pairs.push({id:a.id+'--'+b.id,beforeId:a.id,afterId:b.id,correspondence:trustedAncestor?ancestorCorrespondence(a.projection,b.projection,'diagramcloud:explicit-common-ancestor:'+a.projection.source.projectId):null,metrics:[],migration:[]});}
 return {schema:'datapass.scenario-set/0.1',setId:'diagramcloud-review',title:mode==='evolution'?'Before / after evolution':'Architecture alternatives',mode,scenarios,pairs,criteria:[],assessments:[]};
}
export function parseReviewBundle(text:string,audience:Audience):ReviewBundle {
 if(encoder.encode(text).length>REVIEW_LIMIT)throw new Error('Review bundle exceeds 8 MiB.');
 const x=JSON.parse(text);
 if(!x||x.schema!=='datapass.scenario-review/0.1'||typeof x.narrative!=='string'||x.narrative.length>10000||Object.keys(x).some(k=>!['schema','request','narrative'].includes(k)))throw new Error('Unsupported review bundle. Import contains inputs and narrative only; supplied reports or trust claims are refused.');
 if(!x.request||x.request.schema!=='datapass.scenario-set/0.1'||!Array.isArray(x.request.scenarios)||x.request.scenarios.some((s:any)=>s?.projection?.binding?.audience!==audience))throw new Error('Review audience mismatch.');
 return x as ReviewBundle; // Rust validates the complete request before the UI adopts imported inputs.
}
export async function currentFreshness(frozen:ProjectionV2,current:Project|undefined):Promise<'current'|'stale'|'unknown'> {
 if(!current||current.id!==frozen.source.projectId||frozen.binding.derivation)return 'unknown';
 const now=await projectProjection(current,{audience:frozen.binding.audience,viewIds:frozen.scope.kind==='views'?frozen.scope.ids:undefined});
 return now.binding.digest===frozen.binding.digest?'current':'stale';
}
