import {z} from 'zod';
import {REPOSITORY_HOSTS} from '../model';

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
export const projectManifestSchema=z.object({
 format:z.literal('diagramcloud.project-manifest'),version:z.literal(1),
 project:z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),title:z.string().min(1).max(160),summary:text(3000).default('')}).strict(),
 repositories:z.array(manifestRepositorySchema).min(1).max(40),relationships:z.array(manifestRelationshipSchema).max(200).default([]),
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
function fromGalaxy(g:z.infer<typeof galaxySchema>):{manifest:ProjectManifest;notes:string[]}{
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
 return {manifest:validateManifest({format:'diagramcloud.project-manifest',version:1,project:{id:'galaxy',title:'App Galaxy',summary:'Generated from the Claude Control galaxy map: repositories are declared there; relationships are its connections. live = implemented on the main branch (static source), branch / planned = not on main. Not runtime evidence.'},repositories:repositories.slice(0,40),relationships}),notes};
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
