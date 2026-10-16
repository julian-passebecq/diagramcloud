import {z} from 'zod';
import {REPOSITORY_HOSTS} from '../model';
import {secretFindings} from '../secrets';

/**
 * Project manifest (`diagramcloud.project-manifest/1`): the explicit list of repositories a project is made of and the
 * relationships its authors declare. Membership never comes from scanning a whole account: only from this file, a
 * DataPass `.datapass/project.json`, or a reviewed "Add repository". `path` is a local folder for the CLI scanner only
 * and never enters a document.
 */
export const REPO_ID=/^[a-z][a-z0-9-]{0,23}$/;
const repoId=z.string().regex(REPO_ID,'A repository ID is lowercase letters, digits and hyphens, at most 24 characters');
const text=(n:number)=>z.string().max(n);
export const REPOSITORY_ROLES=['application','service','library','data','infrastructure','tool','documentation','platform'] as const;
export const manifestRepositorySchema=z.object({
 id:repoId,title:z.string().min(1).max(160),purpose:text(500).optional(),role:z.enum(REPOSITORY_ROLES).default('application'),
 host:z.enum(REPOSITORY_HOSTS),locator:z.string().min(1).max(500),ref:text(200).optional(),revision:z.string().regex(/^[0-9a-f]{7,64}$/).optional(),
 path:text(500).optional(),capabilities:z.array(text(160)).max(12).default([]),boundaries:z.array(text(160)).max(12).default([]),
}).strict();
export const manifestRelationshipSchema=z.object({from:repoId,to:repoId,label:text(160).default(''),kind:z.enum(['batch','stream','query','control','dependency']).default('dependency'),basis:z.enum(['planned','static-source']).default('planned')}).strict();
const MAX_MANIFEST_REPOSITORIES=40;
export const projectManifestSchema=z.object({
 format:z.literal('diagramcloud.project-manifest'),version:z.literal(1),
 project:z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),title:z.string().min(1).max(160),summary:text(3000).default('')}).strict(),
 repositories:z.array(manifestRepositorySchema).min(1).max(MAX_MANIFEST_REPOSITORIES),relationships:z.array(manifestRelationshipSchema).max(200).default([]),
}).strict();
export type ProjectManifest=z.infer<typeof projectManifestSchema>;
export type ManifestRepository=z.infer<typeof manifestRepositorySchema>;

const credentials=(s:string)=>/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(s)||/[?&](token|access_token|private_token|sig)=/i.test(s);

export function validateManifest(input:unknown):ProjectManifest{
 const m=projectManifestSchema.parse(input),errors:string[]=[];
 const ids=new Set<string>();
 for(const r of m.repositories){if(ids.has(r.id))errors.push(`Duplicate repository ID: ${r.id}`);ids.add(r.id);if(credentials(r.locator))errors.push(`${r.id}: a repository locator never carries credentials`);}
 for(const l of m.relationships){for(const end of [l.from,l.to])if(!ids.has(end))errors.push(`Relationship ${l.from} → ${l.to}: unknown repository ${end}`);if(l.from===l.to)errors.push(`Relationship ${l.from} → ${l.to}: a repository cannot relate to itself`);}
 if(errors.length)throw new Error(errors.slice(0,20).join('\n'));
 return m;
}

const slugId=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^[^a-z]+/,'').replace(/-+$/,'').slice(0,24).replace(/-+$/,'')||'repo';

/** DataPass project file (`.datapass/project.json`, schemaVersion 1): repositories by name with a local path. */
const datapassProjectSchema=z.object({schemaVersion:z.literal(1),project:z.object({id:z.string().min(1).max(160),title:z.string().min(1).max(200)}).passthrough(),
 repositories:z.record(z.object({path:z.string().max(500),label:z.string().max(160).optional()}).passthrough()).default({})}).passthrough();

/**
 * Claude Control galaxy map (`galaxy.json`: apps, contracts, connections). Read only: the format is owned by Claude
 * Control. Each app with a repository becomes a member; a connection becomes a relationship labelled with its contract.
 * A `live` connection names the source file that implements it on the main branch, so its basis is static-source;
 * `branch` and `planned` connections stay planned. Nothing here is runtime evidence.
 */
const galaxySchema=z.object({apps:z.array(z.object({id:z.string().min(1),name:z.string().min(1),path:z.string().nullish(),repo:z.string().nullish(),branch:z.string().nullish(),what:z.string().optional(),hub:z.boolean().optional()}).passthrough()).min(1),
 connections:z.array(z.object({from:z.string(),to:z.string(),kind:z.string().default(''),contract:z.string().default(''),status:z.string().default('planned'),source:z.string().optional()}).passthrough()).default([])}).passthrough();
const GALAXY_KIND:[RegExp,ManifestRelationship['kind']][]=[[/mongo-read|http|query/,'query'],[/deep-link|rule|work-order|handoff/,'control'],[/export|import|file|embed/,'batch']];
type ManifestRelationship=z.infer<typeof manifestRelationshipSchema>;
function fromGalaxy(g:z.infer<typeof galaxySchema>,captureBindings=false):{manifest:ProjectManifest;notes:string[];bindings?:{sourceAppId:string;repositoryId:string}[]}{
 // Capacity admission precedes local identity/membership and connection resolution; never return a partial map.
 if(g.apps.length>MAX_MANIFEST_REPOSITORIES)throw new Error('Galaxy scope exceeds the supported limit of 40 applications. Select a smaller explicit scope. No project was created.');
 // Repeated source identity cannot be resolved by a local suffix or last Map write.
 const appIds=new Set<string>();for(const app of g.apps){if(appIds.has(app.id))throw new Error('Ambiguous Galaxy app identities. No project was created.');appIds.add(app.id);}
 const notes:string[]=[],ids=new Map<string,string>(),taken=new Set<string>();
 const repositories=g.apps.map(a=>{let id=slugId(a.id),k=2;while(taken.has(id))id=`${slugId(a.id).slice(0,21)}-${k++}`;taken.add(id);ids.set(a.id,id);
  const repo=a.repo?.trim(),gitlab=!!repo&&/gitlab/i.test(repo),name=repo?.replace(/^gitlab:\s*/i,'').replace(/\s*\(.*\)$/,'').trim();
  const host=!repo?'local' as const:gitlab?'gitlab' as const:/^[\w.-]+\/[\w.-]+$/.test(name!)?'github' as const:'other' as const;
  return {id,title:a.name.slice(0,160),...(a.what?{purpose:a.what.slice(0,500)}:{}),role:a.hub?'platform' as const:'application' as const,host,
   locator:(host==='github'?`https://github.com/${name}`:name||a.path||a.id).slice(0,500),...(a.branch?{ref:a.branch.slice(0,200)}:{}),...(a.path?{path:a.path}:{})};});
 const relationships:ManifestRelationship[]=[];
 for(const c of g.connections){const from=ids.get(c.from),to=ids.get(c.to);
  if(!from||!to){notes.push(`Connection ${c.from} → ${c.to}: unknown app, not drawn.`);continue;}
  if(from===to){notes.push(`Connection ${c.from} → ${c.to} (${c.contract}): an app reading its own contract, not drawn.`);continue;}
  relationships.push({from,to,label:`${c.contract||c.kind} · ${c.status}`.slice(0,160),kind:GALAXY_KIND.find(([re])=>re.test(c.kind))?.[1]??'dependency',basis:c.status==='live'&&c.source?'static-source':'planned'});}
 if(relationships.length>200){notes.push(`${relationships.length-200} connection(s) beyond the 200 limit were not drawn.`);relationships.length=200;}
 return {manifest:validateManifest({format:'diagramcloud.project-manifest',version:1,project:{id:'galaxy',title:'App Galaxy',summary:'Generated from the Claude Control galaxy map: repositories are declared there; relationships are its connections. live = implemented on the main branch (static source), branch / planned = not on main. Not runtime evidence.'},repositories,relationships}),notes,...(captureBindings?{bindings:[...ids].map(([sourceAppId,repositoryId])=>({sourceAppId,repositoryId}))}:{})};
}

/** A project manifest, or a DataPass project file or Claude Control galaxy map read as one (members start unscanned). */
export function parseManifest(raw:string):{manifest:ProjectManifest;source:'manifest'|'datapass'|'galaxy';notes?:string[]}{
 let json:unknown;try{json=JSON.parse(raw);}catch{throw new Error('This is not valid JSON. No project was created.');}
 if(json&&typeof json==='object'&&(json as {format?:unknown}).format==='diagramcloud.project-manifest')return {manifest:validateManifest(json),source:'manifest'};
 const dp=datapassProjectSchema.safeParse(json);
 if(dp.success){
  const taken=new Set<string>();
  const repositories=Object.entries(dp.data.repositories).map(([name,r])=>{let id=slugId(name),k=2;while(taken.has(id))id=`${slugId(name).slice(0,21)}-${k++}`;taken.add(id);return {id,title:(r.label||name).slice(0,160),host:'local' as const,locator:name.slice(0,500),path:r.path};});
  if(!repositories.length)throw new Error('This DataPass project file lists no repositories.');
  return {manifest:validateManifest({format:'diagramcloud.project-manifest',version:1,project:{id:slugId(dp.data.project.id).slice(0,41)||'project',title:dp.data.project.title.slice(0,160)},repositories}),source:'datapass'};
 }
 const galaxy=galaxySchema.safeParse(json);
 if(galaxy.success&&Array.isArray((json as {contracts?:unknown}).contracts))return {...fromGalaxy(galaxy.data),source:'galaxy'};
 throw new Error('Not a project manifest: expected "format": "diagramcloud.project-manifest" (or a DataPass .datapass/project.json, or a galaxy map).');
}

/** Consumer-local import provenance only. This is not an owner format, namespace grant or ID reuse API. */
export const GALAXY_IMPORT_PROVENANCE_PREFIX='analysis-galaxy-import-';
export const GALAXY_IMPORT_PROVENANCE_BLOCK=GALAXY_IMPORT_PROVENANCE_PREFIX+'receipt';
const provenanceId=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
const exactSourceId=z.string().min(1).max(1000).refine(s=>s.trim().length>0&&!/[\u0000-\u001f\u007f]/.test(s));
export const galaxyImportProvenanceSchema=z.object({
 format:z.literal('diagramcloud.galaxy-import-provenance/1'),consumerParser:z.literal('diagramcloud-galaxy/1'),
 targetProjectId:provenanceId,snapshotId:provenanceId,capturedAt:z.string().datetime({offset:true}),
 input:z.object({kind:z.literal('galaxy-map'),digestDomain:z.literal('decoded-text-utf8'),
  sha256:z.string().regex(/^[a-f0-9]{64}$/),utf8Bytes:z.number().int().min(1).max(1024*1024),upstreamVersion:z.null()}).strict(),
 namespace:z.null(),bindingState:z.literal('unbound'),sourceSemantics:z.literal('source-declared'),synthetic:z.null(),complete:z.literal(true),
 mappings:z.array(z.object({sourceAppId:exactSourceId,repositoryId:repoId,nodeId:provenanceId}).strict()).min(1).max(MAX_MANIFEST_REPOSITORIES)
}).strict();
export type GalaxyImportProvenance=z.infer<typeof galaxyImportProvenanceSchema>;
/** Evidence is editable/untrusted. Exact safe one-to-one identities are mandatory; no truncation or fallback. */
export function parseGalaxyImportProvenance(code:string):GalaxyImportProvenance|undefined{
 try{
  if(code.length>48000||new TextEncoder().encode(code).byteLength>64*1024)return;
  const value:unknown=JSON.parse(code);if(secretFindings(value).length)return;
  const parsed=galaxyImportProvenanceSchema.parse(value);
  for(const key of ['sourceAppId','repositoryId','nodeId'] as const)if(new Set(parsed.mappings.map(row=>row[key])).size!==parsed.mappings.length)return;
  if(parsed.mappings.some(row=>row.nodeId!==`repo-${row.repositoryId}`))return;
  return parsed;
 }catch{return;}
}
/** Hash the exact decoded input string, never reserialized JSON/original file bytes/a repository revision. */
export async function prepareGalaxyImportProvenance(raw:string,targetProjectId:string,snapshotId:string,now:Date=new Date()):Promise<{receipt:GalaxyImportProvenance;manifest:ProjectManifest}|undefined>{
 try{
  const bytes=new TextEncoder().encode(raw);if(bytes.byteLength>1024*1024)return;
  const input:unknown=JSON.parse(raw),g=galaxySchema.safeParse(input);
  if(!g.success||!Array.isArray((input as {contracts?:unknown}).contracts))return;
  const converted=fromGalaxy(g.data,true);
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  const candidate={format:'diagramcloud.galaxy-import-provenance/1',consumerParser:'diagramcloud-galaxy/1',targetProjectId,snapshotId,capturedAt:now.toISOString(),
   input:{kind:'galaxy-map',digestDomain:'decoded-text-utf8',sha256:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),utf8Bytes:bytes.byteLength,upstreamVersion:null},
   namespace:null,bindingState:'unbound',sourceSemantics:'source-declared',synthetic:null,complete:true,
   mappings:converted.bindings!.map(row=>({...row,nodeId:`repo-${row.repositoryId}`}))};
  const receipt=parseGalaxyImportProvenance(JSON.stringify(candidate));return receipt?{receipt,manifest:converted.manifest}:undefined;
 }catch{return;}
}
