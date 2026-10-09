import {z} from 'zod';
import {secretFindings} from '../core/secrets';
import {PURPOSES} from './types';

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
export const ANALYZERS=['inventory','imports','documents','dbt','fabric','databricks','azure','dotnet','tree-sitter'] as const;
export const profileSchema=z.object({format:z.literal('diagramcloud.analysis-profile'),version:z.literal(1),
 depth:z.enum(['quick','standard','deep','custom']),purpose:z.enum(PURPOSES),
 audience:z.enum(['technical','business','mixed']).default('mixed'),archetypes:z.array(z.enum(['application','data','cloud','library','documents'])).max(5).default([]),
 analyzers:z.array(z.enum(ANALYZERS)).min(1).max(9),includeInferred:z.boolean().default(true),
 scope:z.array(z.string().min(1).max(500)).max(60).default([]),repositoryIds:z.array(id).max(60).default([]),
 budgets:z.object({files:z.number().int().min(1).max(10000),fileBytes:z.number().int().min(1024).max(1048576),
  totalBytes:z.number().int().min(1024).max(67108864),nodes:z.number().int().min(1).max(10000),links:z.number().int().min(1).max(50000)}).strict(),
 autonomy:z.literal('review-required').default('review-required')}).strict();
export type AnalysisProfile=z.infer<typeof profileSchema>;
export function validateAnalysisProfile(input:unknown):AnalysisProfile{
 const p=profileSchema.parse(input);if(secretFindings(p).length)throw new Error('Profile contains a credential-bearing value');
 if(new Set(p.analyzers).size!==p.analyzers.length||new Set(p.scope).size!==p.scope.length||new Set(p.repositoryIds).size!==p.repositoryIds.length||new Set(p.archetypes).size!==p.archetypes.length)throw new Error('Duplicate profile selector');
 if(p.budgets.fileBytes>p.budgets.totalBytes)throw new Error('File budget exceeds total budget');
 for(const scope of p.scope)if(/^(?:\/|[a-z]:)|[\\\u0000-\u001f]/i.test(scope)||scope.replace(/\/$/,'').split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Profile path scope must be an explicit relative path/prefix');
 if(p.analyzers.includes('tree-sitter')&&!['deep','custom'].includes(p.depth))throw new Error('Tree-sitter requires an explicit deep/custom profile');
 return {...p,analyzers:[...p.analyzers].sort(),scope:[...p.scope].sort(),repositoryIds:[...p.repositoryIds].sort(),archetypes:[...p.archetypes].sort()};
}
export function analysisProfile(depth:AnalysisProfile['depth']='standard',overrides:Partial<Omit<AnalysisProfile,'format'|'version'|'depth'|'budgets'>> & {budgets?:Partial<AnalysisProfile['budgets']>}={}):AnalysisProfile{
 const budgets=depth==='quick'?{files:200,fileBytes:65536,totalBytes:4194304,nodes:1000,links:4000}:depth==='deep'?{files:5000,fileBytes:524288,totalBytes:33554432,nodes:10000,links:50000}:{files:1500,fileBytes:262144,totalBytes:16777216,nodes:4000,links:15000};
 return validateAnalysisProfile({format:'diagramcloud.analysis-profile',version:1,depth,purpose:'understand',analyzers:ANALYZERS.filter(a=>a!=='tree-sitter'||depth==='deep'||depth==='custom'),...overrides,budgets:{...budgets,...overrides.budgets}});
}
/** Key order is irrelevant, array order remains semantic unless the validator sorts selectors. */
export function canonicalJson(value:unknown):string{if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson((value as Record<string,unknown>)[k])).join(',')+'}';return JSON.stringify(value);}
export async function sha256(value:string){const bytes=new TextEncoder().encode(value);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export const analysisBundleSchema=z.object({format:z.literal('diagramcloud.analysis-bundle'),version:z.literal(1),parserVersion:z.string().min(1).max(100),profile:profileSchema,
 revisions:z.array(z.object({repositoryId:id,revision:z.string().min(1).max(120),contentDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(60),
 sources:z.array(z.object({id,path:z.string().min(1).max(500),repositoryId:id,revision:z.string().min(1).max(120),line:z.number().int().positive(),endLine:z.number().int().positive().optional(),contentDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(20000),
 items:z.array(z.object({id,label:z.string().min(1).max(160),kind:z.string().min(1).max(80),sourceIds:z.array(id).min(1).max(100),confidence:z.enum(['confirmed','inferred','possible'])}).strict()).max(10000),
 links:z.array(z.object({id,from:id,to:id,kind:z.string().min(1).max(80),sourceIds:z.array(id).min(1).max(100),confidence:z.enum(['confirmed','inferred','possible'])}).strict()).max(50000),
 diagnostics:z.array(z.string().max(1000)).max(2000),omitted:z.object({items:z.number().int().nonnegative(),links:z.number().int().nonnegative(),sources:z.number().int().nonnegative()}).strict()}).strict();
export type AnalysisBundle=z.infer<typeof analysisBundleSchema>;
/** Generated analysis only: no positions, author text, visibility, observations or review decision. */
export function validateAnalysisBundle(input:unknown):AnalysisBundle{
 const b=analysisBundleSchema.parse(input);b.profile=validateAnalysisProfile(b.profile);if(secretFindings(b).length)throw new Error('Analysis bundle contains secret values');
 const unique=(items:{id:string}[],label:string)=>{const ids=new Set(items.map(x=>x.id));if(ids.size!==items.length)throw new Error('Duplicate '+label+' ID');return ids;};
 const repos=unique(b.revisions.map(r=>({id:r.repositoryId})),'repository'),sources=unique(b.sources,'source'),items=unique(b.items,'item');unique(b.links,'link');
 for(const s of b.sources){if(!repos.has(s.repositoryId)||b.revisions.find(r=>r.repositoryId===s.repositoryId)!.revision!==s.revision)throw new Error('Source revision differs from revision vector');if(s.endLine&&s.endLine<s.line)throw new Error('Invalid source line range');if(/(^|\/)(\.env|\.git|node_modules)(\/|$)|(^|\/)\.\.(\/|$)|^[a-z]:|^\//i.test(s.path))throw new Error('Unsafe analysis source path');}
 for(const row of [...b.items,...b.links])for(const source of row.sourceIds)if(!sources.has(source))throw new Error('Unknown source reference');
 for(const l of b.links)if(!items.has(l.from)||!items.has(l.to))throw new Error('Unknown relationship endpoint');
 if(b.items.length>b.profile.budgets.nodes||b.links.length>b.profile.budgets.links)throw new Error('Analysis exceeds selected profile budget');
 return {...b,revisions:[...b.revisions].sort((a,c)=>a.repositoryId.localeCompare(c.repositoryId)),sources:[...b.sources].sort((a,c)=>a.id.localeCompare(c.id)),items:[...b.items].sort((a,c)=>a.id.localeCompare(c.id)),links:[...b.links].sort((a,c)=>a.id.localeCompare(c.id))};
}
export async function analysisCacheKey(input:AnalysisBundle){const b=validateAnalysisBundle(input);return 'diagramcloud-analysis-1:'+await sha256(canonicalJson({parserVersion:b.parserVersion,profile:b.profile,revisions:b.revisions}));}
/** Cache is a rebuildable optimization, never authoring storage. A mismatch refuses reuse. */
export class AnalysisCache{
 private rows=new Map<string,{digest:string;bundle:AnalysisBundle}>();
 constructor(private maxEntries=4){if(maxEntries<1||maxEntries>20)throw new Error('Cache bound must be 1–20');}
 async put(input:AnalysisBundle){const bundle=validateAnalysisBundle(input),key=await analysisCacheKey(bundle),digest=await sha256(canonicalJson(bundle));const old=this.rows.get(key);if(old&&old.digest!==digest)throw new Error('Same source/profile cache key produced a different result');this.rows.delete(key);this.rows.set(key,{digest,bundle:structuredClone(bundle)});while(this.rows.size>this.maxEntries)this.rows.delete(this.rows.keys().next().value!);return key;}
 get(key:string){const row=this.rows.get(key);return row?structuredClone(row.bundle):undefined;}
 clear(){this.rows.clear();}
}
