import type {Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {mappingStatus} from './mappings';
/**
 * "What is missing to explain this?" for one view. When timing, quantities or concept mappings are absent, the figure that
 * would need them is withheld and the missing input is named, instead of drawing a misleading schedule, flow or mapping.
 * Reads the public projection in public mode. Nothing is inferred: a story order is not timing, a name is not a mapping.
 */
export type ExplanationGapKey='timing'|'quantities'|'mappings';
export type ExplanationGap={key:ExplanationGapKey;state:'supplied'|'partial'|'missing';label:string;withheld:string|null;reason:string;needs:string};
export function explanationGaps(input:Project,viewId:string,{publicMode=false}:{publicMode?:boolean}={}):{viewId:string;title:string;gaps:ExplanationGap[];missing:number}|null{
 const doc=publicMode?publicDocument(input):input,view=doc.views.find(v=>v.id===viewId);if(!view)return null;
 const nodes=new Set(view.nodeIds),edges=doc.edges.filter(e=>view.edgeIds.includes(e.id));
 const dated=doc.observations.filter(o=>nodes.has(o.nodeId)&&(!publicMode||o.reviewedAt)).length;
 const blockIds=new Set(doc.nodes.filter(n=>nodes.has(n.id)).flatMap(n=>n.blockIds)),items=doc.blocks.filter(b=>blockIds.has(b.id)).flatMap(b=>b.type==='schedule'?b.items:[]),estimates=items.filter(i=>i.basis==='estimate').length;
 const timing:ExplanationGap=items.length?{key:'timing',label:'Timing',state:'supplied',withheld:null,
  reason:`${items.length} schedule item${items.length>1?'s':''} with dates on this view's components${estimates?`, ${estimates} declared as estimate${estimates>1?'s':''}`:''}.`,
  needs:'Supplied dates or durations per step, or estimates labelled as estimates.'}:{key:'timing',label:'Timing',state:dated?'partial':'missing',withheld:'Scheduled timeline (Gantt)',
  reason:dated?`${dated} dated claim${dated>1?'s':''} on this view, but no start, end or duration for any step.`:'No dates, durations or declared estimates for this view.'+(doc.story.some(s=>s.viewId===viewId)?' The story order is a presentation sequence, not timing.':''),
  needs:'Supplied dates or durations per step, or estimates labelled as estimates.'};
 const quantified=edges.filter(e=>e.quantity).length;
 const quantities:ExplanationGap={key:'quantities',label:'Quantities',state:!edges.length||!quantified?'missing':quantified===edges.length?'supplied':'partial',withheld:quantified===edges.length&&edges.length?null:'Sankey flow figure',
  reason:!edges.length?'No connections on this view.':`${quantified} of ${edges.length} connection${edges.length>1?'s':''} carry a quantity with a unit.`,
  needs:'A quantity with a unit and provenance on each connection; synthetic amounts stay labelled synthetic.'};
 const established=(doc.learningMappings??[]).filter(m=>(m.target.kind==='view'?m.target.id===viewId:nodes.has(m.target.id))).filter(m=>{const s=mappingStatus(doc,m).state;return s==='reviewed'||s==='source-declared';}).length;
 const mappings:ExplanationGap={key:'mappings',label:'Concept mappings',state:established?'supplied':'missing',withheld:established?null:'Concept explanation in this view (In my project)',
  reason:established?`${established} reviewed or source-declared mapping${established>1?'s':''} to this view or its components.`:'No reviewed or source-declared concept mapping to this view or its components.',
  needs:'A mapping citing a project source or evidence block, declared by a source or reviewed by the author. A shared name, tag or icon is not evidence.'};
 const gaps=[timing,quantities,mappings];
 return {viewId,title:view.title,gaps,missing:gaps.filter(g=>g.state!=='supplied').length};
}
