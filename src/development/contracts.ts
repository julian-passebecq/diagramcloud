import {z} from 'zod';
export const ATLAS_VERSION='development-atlas/1' as const;
export const EVIDENCE_BASES=['OBSERVED','DERIVED','DECLARED','INFERRED','UNKNOWN'] as const;
const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
const value=z.union([z.string().max(2048),z.number().finite(),z.boolean(),z.null()]);
const data=z.record(z.string().max(80),z.union([value,z.array(value).max(100)])).default({});
const entity=z.object({id,label:z.string().min(1).max(160),kind:z.string().max(40),basis:z.enum(EVIDENCE_BASES),evidenceIds:z.array(id).max(20),data}).strict();
const relation=z.object({id,source:id,target:id,label:z.string().max(160),basis:z.enum(EVIDENCE_BASES),evidenceIds:z.array(id).max(20)}).strict();
const evidence=z.object({id,authority:z.string().max(160),basis:z.enum(EVIDENCE_BASES),observedAt:z.string().datetime({offset:true}),summary:z.string().max(500)}).strict();
export const developmentAtlasSchema=z.object({version:z.literal(ATLAS_VERSION),capturedAt:z.string().datetime({offset:true}),scope:z.object({project:z.string().max(160),repo:z.string().max(2048).optional(),worktree:z.string().max(2048).optional(),revision:z.string().max(120).optional()}).strict(),repositories:z.array(entity).max(60),worktrees:z.array(entity).max(100),branches:z.array(entity).max(150),revisions:z.array(entity).max(200),changes:z.array(entity).max(100),files:z.array(entity).max(200),reviews:z.array(entity).max(100),ci:z.array(entity).max(100),agents:z.array(entity).max(100),components:z.array(entity).max(100),relations:z.array(relation).max(1500),evidence:z.array(evidence).max(200)}).strict();
export type DevelopmentAtlas=z.infer<typeof developmentAtlasSchema>;
export type AtlasEntity=z.infer<typeof entity>;
export const ENTITY_COLLECTIONS=['repositories','worktrees','branches','revisions','changes','files','reviews','ci','agents','components'] as const;
export function atlasEntities(atlas:DevelopmentAtlas):AtlasEntity[]{return ENTITY_COLLECTIONS.flatMap(k=>atlas[k]);}
/** Contract boundary shared by every host. No filesystem, host APIs or executable payload. */
export function validateDevelopmentAtlas(input:unknown):DevelopmentAtlas{
 if(JSON.stringify(input).length>2*1024*1024)throw Error('Atlas exceeds 2 MiB');
 const atlas=developmentAtlasSchema.parse(input),entities=atlasEntities(atlas);
 if(entities.length>500)throw Error('Atlas exceeds 500 entities');
 const all=[...entities,...atlas.relations,...atlas.evidence].map(e=>e.id);
 if(new Set(all).size!==all.length)throw Error('Duplicate Atlas ID');
 const ids=new Set(entities.map(e=>e.id)),ev=new Set(atlas.evidence.map(e=>e.id));
 for(const r of atlas.relations)if(!ids.has(r.source)||!ids.has(r.target))throw Error('Dangling Atlas relationship');
 for(const e of [...entities,...atlas.relations])if(e.evidenceIds.some(i=>!ev.has(i)))throw Error('Missing Atlas evidence');
 return atlas;
}
