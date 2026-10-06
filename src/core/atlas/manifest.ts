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

/** A project manifest, or a DataPass project file read as one (repositories become local, unscanned members). */
export function parseManifest(raw:string):{manifest:ProjectManifest;source:'manifest'|'datapass'}{
 let json:unknown;try{json=JSON.parse(raw);}catch{throw new Error('This is not valid JSON. No project was created.');}
 if(json&&typeof json==='object'&&(json as {format?:unknown}).format==='diagramcloud.project-manifest')return {manifest:validateManifest(json),source:'manifest'};
 const dp=datapassProjectSchema.safeParse(json);
 if(dp.success){
  const taken=new Set<string>();
  const repositories=Object.entries(dp.data.repositories).map(([name,r])=>{let id=slugId(name),k=2;while(taken.has(id))id=`${slugId(name).slice(0,21)}-${k++}`;taken.add(id);return {id,title:(r.label||name).slice(0,160),host:'local' as const,locator:name.slice(0,500),path:r.path};});
  if(!repositories.length)throw new Error('This DataPass project file lists no repositories.');
  return {manifest:validateManifest({format:'diagramcloud.project-manifest',version:1,project:{id:slugId(dp.data.project.id).slice(0,41)||'project',title:dp.data.project.title.slice(0,160)},repositories}),source:'datapass'};
 }
 throw new Error('Not a project manifest: expected "format": "diagramcloud.project-manifest" (or a DataPass .datapass/project.json).');
}
