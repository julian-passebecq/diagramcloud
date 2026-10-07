import {z} from 'zod';
import {DESIGN_THEMES,DESIGN_TYPES,validateDocument,type Project} from './model';
import type {ImportResult} from './interchange/graph';

/**
 * Design brief (`diagramcloud.design-brief/1`): the bridge for an AI agent (or a person) to say how each view should be
 * drawn in Diagram Design mode: figure type, at most two focal components, theme and a caption. It is presentation
 * only: it never adds, removes or renames a component, connection or view, never changes basis, status or
 * observations, and the agent never writes the document itself. Applying a brief produces a reviewed change like any
 * import; anything that does not fit (unknown view, focal outside the view, a third focal) is reported and skipped.
 */
const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
export const designBriefSchema=z.object({
 format:z.literal('diagramcloud.design-brief'),version:z.literal(1),projectId:id.optional(),author:z.string().max(160).optional(),
 views:z.array(z.object({viewId:id,type:z.enum(DESIGN_TYPES).optional(),focal:z.array(id).max(10).optional(),theme:z.enum(DESIGN_THEMES).optional(),caption:z.string().max(300).optional(),why:z.string().max(500).optional()}).strict()).min(1).max(80),
}).strict();
export type DesignBrief=z.infer<typeof designBriefSchema>;

export function parseDesignBrief(raw:string):DesignBrief{
 let json:unknown;try{json=JSON.parse(raw);}catch{throw new Error('This is not valid JSON. Nothing was changed.');}
 if(!json||typeof json!=='object'||(json as {format?:unknown}).format!=='diagramcloud.design-brief')throw new Error('Not a design brief: expected "format": "diagramcloud.design-brief".');
 const r=designBriefSchema.safeParse(json);
 if(!r.success)throw new Error(`Design brief rejected: ${r.error.issues.slice(0,4).map(i=>`${i.path.join('.')||'(root)'} ${i.message}`).join('; ')}. Nothing was changed.`);
 return r.data;
}

export function applyDesignBrief(input:Project,brief:DesignBrief,options:{fileName?:string}={}):ImportResult{
 if(brief.projectId&&brief.projectId!==input.id)throw new Error(`This brief is for project ${brief.projectId}, not ${input.id}. Nothing was changed.`);
 const doc=structuredClone(input),kept:string[]=[],lost:string[]=[];let changed=0;
 for(const b of brief.views){
  const v=doc.views.find(v=>v.id===b.viewId);if(!v){lost.push(`${b.viewId}: no such view, skipped.`);continue;}
  const focal=(b.focal??[]).filter(f=>{const ok=v.nodeIds.includes(f);if(!ok)lost.push(`${b.viewId}: ${f} is not a component of this view, not made focal.`);return ok;});
  if(focal.length>2)lost.push(`${b.viewId}: ${focal.length} focal components asked; Diagram Design keeps two (${focal.slice(0,2).join(', ')}).`);
  const next={type:b.type??v.design?.type??'auto',focal:b.focal?focal.slice(0,2):v.design?.focal??[],...((b.theme??v.design?.theme)?{theme:b.theme??v.design?.theme}:{}),...((b.caption??v.design?.caption)?{caption:b.caption??v.design?.caption}:{})};
  v.design=next;changed++;
  kept.push(`${v.title}: ${next.type}${next.focal.length?`, focal ${next.focal.join(', ')}`:''}${next.theme?`, ${next.theme}`:''}${next.caption?`, caption "${next.caption.slice(0,60)}${next.caption.length>60?'…':''}"`:''}${b.why?` (why: ${b.why.slice(0,120)})`:''}.`);
 }
 if(!changed)throw new Error(`No view of this brief exists in ${input.title}. Nothing was changed.${lost.length?`\n${lost.slice(0,5).join('\n')}`:''}`);
 const document=validateDocument(doc);
 return {document,report:{format:'design-brief',fileName:options.fileName??'design-brief.json',pages:changed,nodes:0,edges:0,groups:0,
  kept:[`${changed} view(s) get Diagram Design hints${brief.author?` from ${brief.author.slice(0,80)}`:''}. Components, connections, basis and observations are unchanged.`,...kept],lost}};
}
