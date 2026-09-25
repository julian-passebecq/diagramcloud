import {z} from 'zod';
import {publicDocument} from '../core/operations';
import type {Project} from '../core/model';
import {isOpenUri,secretFindings} from '../core/secrets';
import {day} from '../core/realization';

/**
 * `diagramcloud.portfolio-index/1`: a small, user-triggered snapshot for Mongoku's read-only projection view
 * (Mongoku-datapass docs/GALAXY_PROJECTION_CONTRACT_2026-09-25.md). Built from publicDocument only, so private
 * nodes, evidence, assets and the authoring document never reach it. Realization cards are only reviewed, public
 * observations the author explicitly marked shareable. DiagramCloud only exports: storing the file in
 * DATAPASSCONTROL is an operator-reviewed step outside this app.
 */
export const PORTFOLIO_INDEX_FORMAT='diagramcloud.portfolio-index/1';
export const INDEX_LIMITS={bytes:64*1024,items:25,counts:30,text:500} as const;

const text=z.string().min(1).max(INDEX_LIMITS.text),instant=z.string().datetime({offset:true});
const openUri=z.string().refine(isOpenUri,'must be an http(s) or vscode link without embedded credentials');
export const portfolioIndexSchema=z.object({
 format:z.literal(PORTFOLIO_INDEX_FORMAT),projectRef:text,sourceApp:z.literal('diagramcloud'),sourceObjectId:text,sourceRevision:text,
 generatedAt:instant,observedAt:instant.optional(),openUri:openUri.optional(),authority:z.literal('diagramcloud'),
 visibility:z.enum(['private','shareable']),freshness:z.literal('snapshot'),lifecycle:z.literal('current'),
 // Not read by Mongoku (unknown fields are dropped there); kept for people and other consumers of the file.
 title:text,rootViewId:text,rootViewTitle:text,storyPresent:z.boolean(),lastReviewedAt:instant.optional(),
 counts:z.record(z.string().max(64),z.number().int().min(0)).refine(c=>Object.keys(c).length<=INDEX_LIMITS.counts,'too many count keys'),
 items:z.array(z.object({id:text,title:text,kind:text.optional(),status:text.optional(),openUri:openUri.optional()}).strict()).max(INDEX_LIMITS.items)
}).strict();
export type PortfolioIndex=z.infer<typeof portfolioIndexSchema>;

const clip=(s:string,n:number=INDEX_LIMITS.text)=>s.length>n?s.slice(0,n-1)+'…':s;

export function portfolioIndex(input:Project,{generatedAt=new Date()}:{generatedAt?:Date}={}):PortfolioIndex{
 const d=publicDocument(input),root=d.views.find(v=>v.id===d.rootViewId)!,label=(id:string)=>d.nodes.find(n=>n.id===id)?.label??id;
 const shareable=d.observations.filter(o=>o.shareable).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
 const cards=shareable.slice(0,INDEX_LIMITS.items);
 const observed=new Set(d.observations.map(o=>o.nodeId));
 const latest=cards[0]?.observedAt,p=input.portfolio;
 return {
  format:PORTFOLIO_INDEX_FORMAT,projectRef:p?.projectRef??d.id,sourceApp:'diagramcloud',sourceObjectId:d.id,sourceRevision:String(d.revision),
  generatedAt:generatedAt.toISOString(),...(latest?{observedAt:latest}:{}),...(p?.openUri?{openUri:p.openUri}:{}),
  authority:'diagramcloud',visibility:p?.indexVisibility??'private',freshness:'snapshot',lifecycle:'current',
  title:clip(d.title),rootViewId:d.rootViewId,rootViewTitle:clip(root.title),storyPresent:d.story.length>0,...(p?.lastReviewedAt?{lastReviewedAt:p.lastReviewedAt}:{}),
  counts:{
   public_views:d.views.length,public_components:d.nodes.length,public_evidence_blocks:d.blocks.length,
   synthetic_evidence_blocks:d.blocks.filter(b=>b.provenance==='synthetic').length,
   story_steps:d.story.length,story_present:d.story.length?1:0,
   observed_components:observed.size,designed_only_components:d.nodes.filter(n=>!observed.has(n.id)).length,
   shareable_realization_cards:shareable.length
  },
  items:cards.map(o=>({id:o.id,title:clip(`${label(o.nodeId)}: ${o.summary} (${o.sourceApp} @ ${o.sourceRevision}, ${day(o.observedAt)})${o.caveat?` Caveat: ${o.caveat}`:''}`),kind:'realization',status:o.claim,...(o.link?{openUri:o.link}:{})}))
 };
}

/** Everything Mongoku would refuse, checked the same way: size and secrets on the raw payload, then the shape. */
export function checkPortfolioIndex(raw:unknown):string[]{
 const json=JSON.stringify(raw??null),bytes=new TextEncoder().encode(json).byteLength;
 if(bytes>INDEX_LIMITS.bytes)return [`${bytes} bytes > ${INDEX_LIMITS.bytes}`];
 const secrets=secretFindings(raw);if(secrets.length)return secrets;
 const parsed=portfolioIndexSchema.safeParse(raw);
 return parsed.success?[]:parsed.error.issues.map(i=>`${i.path.join('.')||'(root)'}: ${i.message}`);
}

/** The file to download, or an error naming each refused path (never its value). */
export function portfolioIndexJson(input:Project,options?:{generatedAt?:Date}):string{
 const index=portfolioIndex(input,options),issues=checkPortfolioIndex(index);
 if(issues.length)throw new Error(`Portfolio index not exported; Mongoku would refuse it:\n${issues.slice(0,10).join('\n')}\nReword the public text or clear the flagged field, then export again.`);
 return JSON.stringify(index,null,2)+'\n';
}

/** For the export dialog: what the index would contain, before downloading. */
export function indexSummary(input:Project):string{
 const d=publicDocument(input),cards=d.observations.filter(o=>o.shareable).length,pending=input.observations.filter(o=>!o.reviewedAt).length;
 return `${d.blocks.length} public evidence block${d.blocks.length===1?'':'s'} · story ${d.story.length?'present':'absent'} · ${cards} shareable card${cards===1?'':'s'}${pending?` · ${pending} observation${pending===1?'':'s'} awaiting review (left out)`:''}`;
}
