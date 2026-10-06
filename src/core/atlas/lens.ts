import {z} from 'zod';
import {validateDocument,type Project,type SnapshotRepository} from '../model';
import type {ImportResult} from '../interchange/graph';
import {activeSnapshot,appendSnapshot} from './compose';

/**
 * Lens Git projection reader (`datapass.lens.minimap/1`, produced by DataPass Lens / tern-vscode `minimapProjection`).
 * Lens is the authority for observed Git and delivery state; DiagramCloud does not reimplement it. A minimap becomes
 * a new, reviewed snapshot: observed default-branch heads, exact-head CI, request states, agent associations and
 * attention counts are runtime pointers (basis observed) that publicDocument never ships. Components and their design
 * status are untouched. A scanned repository keeps the revision its content was read at; Lens's head is what makes it
 * stale. Membership stays explicit: repositories Lens knows but the atlas does not are reported, never added.
 */
const sha=z.string().regex(/^[0-9a-f]{7,64}$/i);
const lensRepositorySchema=z.object({
 repositoryId:z.string().max(500),name:z.string().min(1).max(200),gitHost:z.string().max(200).optional(),defaultBranch:z.string().max(200).optional(),head:sha.optional(),
 heads:z.array(z.object({worktreeId:z.string().max(500),branch:z.string().max(200).optional(),head:sha.optional()}).passthrough()).max(100).default([]),
 activeBranches:z.array(z.string().max(200)).max(100).default([]),activeWorktrees:z.array(z.string().max(500)).max(100).default([]),
 requestState:z.array(z.object({provider:z.string().max(40),number:z.union([z.number(),z.string().max(40)]),state:z.string().max(40),revision:z.string().max(64).optional(),url:z.string().max(500).optional()}).passthrough()).max(30).default([]),
 ciState:z.string().max(20).default('UNKNOWN'),
 agentAssociations:z.array(z.object({provider:z.string().max(40),sessionId:z.string().max(200),workOrder:z.string().max(200).optional(),status:z.string().max(40).optional(),observedAt:z.string().max(40).optional()}).passthrough()).max(30).default([]),
 attention:z.object({conflictedWorktrees:z.number().int().nonnegative().default(0),dirtyWorktrees:z.number().int().nonnegative().default(0),failedAtHead:z.number().int().nonnegative().default(0),unavailableProviders:z.number().int().nonnegative().default(0)}).passthrough().default({}),
}).passthrough();
export const lensMinimapSchema=z.object({format:z.literal('datapass.lens.minimap'),version:z.literal(1),observedAt:z.string().datetime({offset:true}),refreshing:z.boolean().default(false),
 omittedRepositories:z.number().int().nonnegative().default(0),repositories:z.array(lensRepositorySchema).max(200)}).passthrough();
export type LensMinimap=z.infer<typeof lensMinimapSchema>;

export function parseLensMinimap(raw:string):LensMinimap{
 let json:unknown;try{json=JSON.parse(raw);}catch{throw new Error('This is not valid JSON. Nothing was changed.');}
 if(!json||typeof json!=='object'||(json as {format?:unknown}).format!=='datapass.lens.minimap')throw new Error('Not a Lens minimap: expected "format": "datapass.lens.minimap" (Lens: Export minimap).');
 const r=lensMinimapSchema.safeParse(json);
 if(!r.success)throw new Error(`Lens minimap rejected: ${r.error.issues.slice(0,4).map(i=>`${i.path.join('.')||'(root)'} ${i.message}`).join('; ')}. Nothing was changed.`);
 return r.data;
}

const credentials=(s:string)=>/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(s)||/[?&](token|access_token|private_token|sig|key)=/i.test(s);
const base=(locator:string)=>locator.replace(/[?#].*$/,'').replace(/\/+$/,'').split(/[\\/:]/).pop()!.replace(/\.git$/i,'').toLowerCase();
const HOST:Partial<Record<SnapshotRepository['host'],RegExp>>={github:/github/i,gitlab:/gitlab/i,'azure-devops':/dev\.azure|visualstudio/i,bitbucket:/bitbucket/i};
const clip=(s:string,n:number)=>s.length>n?`${s.slice(0,n-1)}…`:s;
/** Runtime pointer IDs are `lens.<repo>.<kind>[.<n>]`: the repository is readable without another field. */
export const lensRepositoryOf=(refId:string)=>refId.startsWith('lens.')?refId.split('.')[1]:undefined;

export function applyLensMinimap(input:Project,minimap:LensMinimap,options:{now?:Date;fileName?:string}={}):ImportResult{
 const doc=structuredClone(input),snap=activeSnapshot(doc),kept:string[]=[],lost:string[]=[];
 const observedAt=new Date(minimap.observedAt).toISOString(),refs:NonNullable<typeof snap.runtimeRefs>=[];
 if(minimap.refreshing)lost.push('Lens was still refreshing when it exported: some facts may be partial.');
 if(minimap.omittedRepositories)lost.push(`${minimap.omittedRepositories} repositor(ies) beyond the Lens export limit were not in the file.`);
 const matched=new Map<string,LensMinimap['repositories'][number]>();
 for(const lr of minimap.repositories){
  const name=lr.name.toLowerCase(),hits=snap.repositories.filter(r=>(r.id===name||base(r.locator)===name||r.title.toLowerCase()===name)&&!(lr.gitHost&&HOST[r.host]&&!HOST[r.host]!.test(lr.gitHost)));
  if(hits.length!==1){lost.push(hits.length?`${lr.name}: matches ${hits.length} repositories of this atlas (${hits.map(h=>h.id).join(', ')}), skipped.`:`${lr.name}: not a member of this atlas, not added (add it explicitly first).`);continue;}
  if(matched.has(hits[0].id)){lost.push(`${lr.name}: ${hits[0].id} already matched another Lens entry, skipped.`);continue;}
  matched.set(hits[0].id,lr);
 }
 const repositories=snap.repositories.map(r=>{
  const lr=matched.get(r.id);if(!lr){kept.push(`${r.title}: no Lens data; unchanged.`);return r;}
  const at=lr.head?` @ ${lr.head.slice(0,12)}`:'';
  if(lr.head)refs.push({id:`lens.${r.id}.head`,sourceApp:'lens',kind:'default-branch-head',ref:lr.head.toLowerCase(),observedAt,basis:'observed',...(lr.defaultBranch?{note:clip(`Default branch ${lr.defaultBranch}`,500)}:{})});
  refs.push({id:`lens.${r.id}.ci`,sourceApp:'lens',kind:'ci-state',ref:clip(`${lr.ciState}${at}`,500),observedAt,basis:'observed'});
  const a=lr.attention;
  refs.push({id:`lens.${r.id}.work`,sourceApp:'lens',kind:'work-in-progress',ref:clip(`${lr.activeBranches.length} active branch(es), ${lr.heads.length} worktree(s), ${a.dirtyWorktrees} dirty, ${a.conflictedWorktrees} conflicted, ${a.failedAtHead} failed at head${a.unavailableProviders?`, ${a.unavailableProviders} provider(s) unavailable`:''}`,500),observedAt,basis:'observed',...(lr.activeBranches.length?{note:clip(`Active: ${lr.activeBranches.join(', ')}`,500)}:{})});
  lr.requestState.forEach((p,i)=>{if(p.url&&credentials(p.url)){lost.push(`${r.id}: request ${p.number} link carries credentials, not kept.`);return;}
   refs.push({id:`lens.${r.id}.request.${i+1}`,sourceApp:'lens',kind:'request',ref:clip(p.url||`${p.provider} #${p.number}`,500),observedAt,basis:'observed',note:clip(`${p.provider} #${p.number}: ${p.state}${p.revision?` @ ${p.revision.slice(0,12)}`:''}`,500)});});
  lr.agentAssociations.forEach((g,i)=>refs.push({id:`lens.${r.id}.agent.${i+1}`,sourceApp:'lens',kind:'agent-session',ref:clip(`${g.provider}:${g.sessionId}`,500),...(g.observedAt&&!Number.isNaN(Date.parse(g.observedAt))?{observedAt:new Date(g.observedAt).toISOString()}:{observedAt}),basis:'observed',note:clip(`Agent-reported${g.status?` ${g.status}`:''}${g.workOrder?` · ${g.workOrder}`:''}`,500)}));
  const moved=r.scanStatus==='scanned'&&r.revision&&lr.head&&!lr.head.toLowerCase().startsWith(r.revision.toLowerCase())&&!r.revision.toLowerCase().startsWith(lr.head.toLowerCase());
  kept.push(`${r.title}: ${lr.defaultBranch??'default branch'}${at}, CI ${lr.ciState}, ${lr.requestState.length} request(s), ${lr.agentAssociations.length} agent session(s).${moved?` The scan is at ${r.revision!.slice(0,12)}: rescan to follow.`:''}`);
  // Only an unknown revision is filled from Lens; a scanned or declared revision describes the content and stays.
  return !r.revision&&lr.head&&r.scanStatus!=='scanned'?{...r,revision:lr.head.toLowerCase(),...(lr.defaultBranch&&!r.ref?{ref:lr.defaultBranch.slice(0,200)}:{}),authority:'lens' as const}:r;
 });
 if(!matched.size)throw new Error(`No repository of this Lens minimap is a member of this atlas. Nothing was changed.${lost.length?`\n${lost.slice(0,5).join('\n')}`:''}`);
 if(refs.length>200){lost.push(`${refs.length-200} Lens pointer(s) beyond the 200 per snapshot were not kept.`);refs.length=200;}
 appendSnapshot(doc,repositories,options.now??new Date(),doc.atlas);
 const fresh=activeSnapshot(doc);fresh.label=clip(`Lens observation of ${observedAt.slice(0,16).replace('T',' ')} UTC`,160);fresh.runtimeRefs=refs;fresh.contextRefs=structuredClone(snap.contextRefs);
 const document=validateDocument(doc);
 return {document,report:{format:'atlas',fileName:options.fileName??'lens-minimap.json',pages:0,nodes:0,edges:0,groups:0,
  kept:[`Lens minimap observed ${observedAt.slice(0,16).replace('T',' ')} UTC: ${matched.size} of ${snap.repositories.length} repositories matched. Components, views and design status are unchanged; the facts are observed pointers, never shipped in public exports.`,...kept],lost}};
}

/** Lens-observed default-branch heads of a snapshot, for stale detection. */
export function lensHeads(snapshot:{runtimeRefs?:{id:string;kind:string;ref:string}[]}):Record<string,string>{
 return Object.fromEntries((snapshot.runtimeRefs??[]).filter(r=>r.kind==='default-branch-head'&&lensRepositoryOf(r.id)).map(r=>[lensRepositoryOf(r.id)!,r.ref]));
}
