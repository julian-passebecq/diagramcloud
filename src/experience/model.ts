import {z} from 'zod';

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,119}$/), label=z.string().min(1).max(200);
const ids=z.array(id).max(1000).default([]);
const visibility=z.enum(['public','private']).default('private');
const scalar=z.union([z.string().max(4000),z.number().finite(),z.boolean(),z.null()]);
const base={id,title:label,entityId:id,sourceIds:ids,visibility,
 provenance:z.enum(['source-derived','synthetic','reconstruction','author']).default('author'),
 approval:z.enum(['draft','approved']).default('draft')};
export const itemSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('note'),text:z.string().max(50000)}).strict(),
 z.object({...base,type:z.literal('code'),language:label,code:z.string().max(50000),file:z.string().max(1000).optional()}).strict(),
 z.object({...base,type:z.literal('table'),columns:z.array(label).min(1).max(30),rows:z.array(z.array(scalar).max(30)).max(500)}).strict(),
 z.object({...base,type:z.literal('kpi'),value:z.string().max(120),unit:z.string().max(60).default(''),note:z.string().max(1000).default('')}).strict(),
 z.object({...base,type:z.literal('chart'),chartType:z.enum(['bar','line']),dataItemId:id,labelColumn:label,valueColumns:z.array(label).min(1).max(6),unit:z.string().max(80).default('')}).strict(),
 z.object({...base,type:z.literal('gantt'),tasks:z.array(z.object({label,start:z.string().date(),end:z.string().date(),progress:z.number().min(0).max(100).default(0)}).strict()).min(1).max(80)}).strict(),
 z.object({...base,type:z.literal('image'),data:z.string().max(2800000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),caption:z.string().max(1000),rights:z.string().max(1000)}).strict()
]);
export const packSchema=z.object({
 format:z.literal('diagramcloud.experience'),schemaVersion:z.literal(1),id,title:label,revision:z.number().int().nonnegative().default(0),rootId:id,
 sources:z.array(z.object({id,title:label,kind:z.enum(['repository','pdf','manual','manifest','codewiki']),locator:z.string().max(2000),revision:z.string().max(120).optional(),page:z.number().int().positive().optional(),visibility}).strict()).max(1000),
 entities:z.array(z.object({id,label,type:z.enum(['organization','project','workstream','subsystem','task','component','resource','repository']),summary:z.string().max(2000).default(''),children:ids,workspaceIds:ids,sourceIds:ids,visibility,assertion:z.enum(['declared','inferred','illustrative','verified-in-source']).default('declared')}).strict()).min(1).max(1000),
 relations:z.array(z.object({id,source:id,target:id,kind:z.enum(['uses','calls','reads','writes','produces','validates','documents']),assertion:z.enum(['declared','inferred','illustrative','verified-in-source']).default('declared'),sourceIds:ids,visibility}).strict()).max(2000),
 items:z.array(itemSchema).max(1500),
 workspaces:z.array(z.object({id,title:label,entityId:id,description:z.string().max(3000).default(''),visibility,
  placements:z.array(z.object({id,itemId:id,x:z.number().int().min(0).max(11),y:z.number().int().min(0).max(200),w:z.number().int().min(1).max(12),h:z.number().int().min(1).max(12)}).strict()).max(100)
 }).strict()).max(200)
}).strict();
export type ExperiencePack=z.infer<typeof packSchema>;
export type ExperienceItem=z.infer<typeof itemSchema>;
export type ExperienceWorkspace=ExperiencePack['workspaces'][number];
export const MAX_PACK_BYTES=12*1024*1024;

/** Syntax and relationship validation before any import can replace state. No code evaluation. */
export function validatePack(input:unknown):ExperiencePack{
 const p=packSchema.parse(input),errors:string[]=[];
 const index=(rows:{id:string}[],kind:string)=>{const set=new Set<string>();for(const row of rows){if(set.has(row.id))errors.push(`Duplicate ${kind}: ${row.id}`);set.add(row.id);}return set;};
 const entities=index(p.entities,'entity'),items=index(p.items,'item'),spaces=index(p.workspaces,'workspace'),sources=index(p.sources,'source');index(p.relations,'relation');
 const check=(value:string,set:Set<string>,context:string)=>{if(!set.has(value))errors.push(`${context}: unknown reference ${value}`);};
 check(p.rootId,entities,'Root');
 for(const e of p.entities){e.children.forEach(x=>check(x,entities,e.id));e.workspaceIds.forEach(x=>check(x,spaces,e.id));e.sourceIds.forEach(x=>check(x,sources,e.id));if(new Set(e.children).size!==e.children.length)errors.push(`Duplicate child in ${e.id}`);}
 for(const r of p.relations){check(r.source,entities,r.id);check(r.target,entities,r.id);r.sourceIds.forEach(x=>check(x,sources,r.id));}
 for(const i of p.items){check(i.entityId,entities,i.id);i.sourceIds.forEach(x=>check(x,sources,i.id));
  if(i.type==='table'){if(new Set(i.columns).size!==i.columns.length)errors.push(`Duplicate column in ${i.id}`);if(i.rows.some(r=>r.length!==i.columns.length))errors.push(`Row width mismatch in ${i.id}`);}
  if(i.type==='chart'){const t=p.items.find(x=>x.id===i.dataItemId);if(t?.type!=='table')errors.push(`${i.id}: chart requires a table`);else{for(const c of [i.labelColumn,...i.valueColumns])if(!t.columns.includes(c))errors.push(`${i.id}: unknown column ${c}`);for(const c of i.valueColumns){const n=t.columns.indexOf(c);if(t.rows.some(r=>typeof r[n]!=='number'))errors.push(`${i.id}: numeric series required for ${c}`);}}}
  if(i.type==='gantt'&&i.tasks.some(t=>t.end<t.start))errors.push(`${i.id}: Gantt end precedes start`);
 }
 for(const w of p.workspaces){check(w.entityId,entities,w.id);index(w.placements,`placement in ${w.id}`);for(const s of w.placements){check(s.itemId,items,w.id);if(s.x+s.w>12)errors.push(`${w.id}: panel outside 12-column grid`);}for(let a=0;a<w.placements.length;a++)for(let b=a+1;b<w.placements.length;b++){const x=w.placements[a],y=w.placements[b];if(x.x<y.x+y.w&&x.x+x.w>y.x&&x.y<y.y+y.h&&x.y+x.h>y.y)errors.push(`${w.id}: overlapping panels ${x.id}/${y.id}`);}}
 const done=new Set<string>(),active=new Set<string>(),byId=new Map(p.entities.map(e=>[e.id,e]));
 function visit(e:string){if(active.has(e)){errors.push(`Navigation cycle at ${e}`);return;}if(done.has(e))return;active.add(e);byId.get(e)?.children.forEach(visit);active.delete(e);done.add(e);}
 p.entities.forEach(e=>visit(e.id));
 if(errors.length)throw new Error(errors.slice(0,20).join('\n'));return p;
}
export function parsePack(raw:string):ExperiencePack{if(new TextEncoder().encode(raw).length>MAX_PACK_BYTES)throw new Error('Experience pack exceeds 12 MiB');return validatePack(JSON.parse(raw));}

/** Fail closed: draft/private content and dependencies cannot leak into public exports. */
export function publicPack(input:ExperiencePack):ExperiencePack{
 const p=structuredClone(input),sourceIds=new Set(p.sources.filter(s=>s.visibility==='public').map(s=>s.id));
 const candidates=new Map(p.entities.filter(e=>e.visibility==='public'&&e.sourceIds.every(s=>sourceIds.has(s))).map(e=>[e.id,e]));
 if(!candidates.has(p.rootId))throw new Error('Root is private or cites a private source');
 const seen=new Set<string>();function walk(id:string){const e=candidates.get(id);if(!e||seen.has(id))return;seen.add(id);e.children.forEach(walk);}walk(p.rootId);
 p.entities=p.entities.filter(e=>seen.has(e.id));
 p.items=p.items.filter(i=>i.visibility==='public'&&i.approval==='approved'&&seen.has(i.entityId)&&i.sourceIds.every(s=>sourceIds.has(s)));
 let allowed=new Set(p.items.map(i=>i.id));p.items=p.items.filter(i=>i.type!=='chart'||allowed.has(i.dataItemId));allowed=new Set(p.items.map(i=>i.id));
 p.workspaces=p.workspaces.filter(w=>w.visibility==='public'&&seen.has(w.entityId)).map(w=>({...w,placements:w.placements.filter(s=>allowed.has(s.itemId))}));
 const reachableSpaces=new Set(p.entities.flatMap(e=>e.workspaceIds));p.workspaces=p.workspaces.filter(w=>reachableSpaces.has(w.id));
 const used=new Set(p.workspaces.flatMap(w=>w.placements.map(s=>s.itemId)));p.items.filter(i=>used.has(i.id)).forEach(i=>{if(i.type==='chart')used.add(i.dataItemId);});p.items=p.items.filter(i=>used.has(i.id));
 const keptSpaces=new Set(p.workspaces.map(w=>w.id));p.entities=p.entities.map(e=>({...e,children:e.children.filter(c=>seen.has(c)),workspaceIds:e.workspaceIds.filter(w=>keptSpaces.has(w))}));
 p.relations=p.relations.filter(r=>r.visibility==='public'&&seen.has(r.source)&&seen.has(r.target)&&r.sourceIds.every(s=>sourceIds.has(s)));
 const usedSources=new Set([...p.entities.flatMap(e=>e.sourceIds),...p.items.flatMap(i=>i.sourceIds),...p.relations.flatMap(r=>r.sourceIds)]);p.sources=p.sources.filter(s=>usedSources.has(s.id)&&sourceIds.has(s.id));return validatePack(p);
}
export function reviewReplacement(current:ExperiencePack,incoming:ExperiencePack){
 if(current.id===incoming.id&&current.revision!==incoming.revision)throw new Error(`Revision conflict: current ${current.revision}, imported ${incoming.revision}. Export current context first.`);
 return {entities:incoming.entities.length,items:incoming.items.length,workspaces:incoming.workspaces.length};
}

/** Root-to-entity chain for breadcrumbs, e.g. [all-projects, datapass, galaxy-task]. Falls back to [root] if unreachable. */
export function entityPath(pack:ExperiencePack,entityId:string):string[]{
 const byId=new Map(pack.entities.map(e=>[e.id,e])),seen=new Set<string>(),queue:string[][]=[[pack.rootId]];
 while(queue.length){const path=queue.shift()!,id=path.at(-1)!;if(id===entityId)return path;if(seen.has(id))continue;seen.add(id);for(const child of byId.get(id)?.children??[])queue.push([...path,child]);}
 return [pack.rootId];
}
