import type {Project} from './model';

/**
 * Guided-story editing without JSON. Pure helpers over `doc.story`; the composer commits the returned array as
 * one undo step, and validateDocument still checks every reference. Drafts reuse the author's own labels,
 * summaries and view descriptions; nothing new is claimed.
 */
export type StoryStep=Project['story'][number];
export const TITLE_MAX=160,NARRATION_MAX=2000;
const clip=(s:string,n:number)=>s.length>n?s.slice(0,n-1)+'…':s;

/** Connections in a view that touch a component: the default highlight for a step focused on it. */
export function edgesAround(doc:Project,viewId:string,nodeId:string):string[]{
 const view=doc.views.find(v=>v.id===viewId);if(!view)return [];
 return doc.edges.filter(e=>view.edgeIds.includes(e.id)&&(e.source===nodeId||e.target===nodeId)).map(e=>e.id);
}

/** A starting step for a view, focused on a component when one is given and belongs to the view. */
export function draftStep(doc:Project,viewId:string,nodeId?:string|null):StoryStep{
 const view=doc.views.find(v=>v.id===viewId);if(!view)throw new Error(`Unknown view ${viewId}`);
 const node=nodeId&&view.nodeIds.includes(nodeId)?doc.nodes.find(n=>n.id===nodeId):undefined;
 const narration=node?(node.role||node.summary):view.description;
 return {title:clip(node?.label??view.title,TITLE_MAX),viewId,...(node?{nodeId:node.id}:{}),narration:clip(narration,NARRATION_MAX),highlightEdgeIds:node?edgesAround(doc,viewId,node.id):[]};
}

/** One step per view, in drilldown order from the root view (a first draft to edit, not a finished story). */
export function draftStory(doc:Project):StoryStep[]{
 const order:string[]=[],queue=[doc.rootViewId];
 while(queue.length){const id=queue.shift()!;if(order.includes(id))continue;const v=doc.views.find(x=>x.id===id);if(!v)continue;order.push(id);
  for(const nid of v.nodeIds){const child=doc.nodes.find(n=>n.id===nid)?.childViewId;if(child&&!order.includes(child))queue.push(child);}}
 return order.map(id=>draftStep(doc,id));
}

/** Keep a step valid after its view changes: drop the focus and highlights that are not in the new view. */
export function retarget(doc:Project,step:StoryStep,viewId:string):StoryStep{
 const view=doc.views.find(v=>v.id===viewId);if(!view)throw new Error(`Unknown view ${viewId}`);
 const {nodeId,...rest}=step,keep=nodeId&&view.nodeIds.includes(nodeId);
 return {...rest,viewId,...(keep?{nodeId}:{}),highlightEdgeIds:step.highlightEdgeIds.filter(id=>view.edgeIds.includes(id))};
}

export function moveStep(story:StoryStep[],from:number,to:number):StoryStep[]{
 if(from<0||from>=story.length||to<0||to>=story.length||from===to)return story;
 const next=[...story],[s]=next.splice(from,1);next.splice(to,0,s);return next;
}
export function insertStep(story:StoryStep[],at:number,step:StoryStep):StoryStep[]{const next=[...story];next.splice(Math.max(0,Math.min(at,story.length)),0,step);return next;}
export function removeStep(story:StoryStep[],at:number):StoryStep[]{return story.filter((_,k)=>k!==at);}
export function replaceStep(story:StoryStep[],at:number,step:StoryStep):StoryStep[]{return story.map((s,k)=>k===at?step:s);}

/** What an author should know about a step: missing text, or content the public portfolio will leave out. */
export function stepNotes(doc:Project,step:StoryStep):string[]{
 const notes:string[]=[],view=doc.views.find(v=>v.id===step.viewId),node=step.nodeId?doc.nodes.find(n=>n.id===step.nodeId):undefined;
 if(!step.title.trim())notes.push('Add a title.');
 if(!step.narration.trim())notes.push('No narration yet: Present mode will show only the title.');
 if(view?.visibility==='private')notes.push('The view is private, so the public portfolio skips this step.');
 else if(node?.visibility==='private')notes.push('The focus component is private, so the public portfolio skips this step.');
 return notes;
}
