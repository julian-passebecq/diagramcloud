import {validateDocument,type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {viewSpec} from '../core/viewspec';
import {svgDiagram} from './diagram';
import {styledSvg} from './styled';
import {designSvg} from './design';
import type {PublicationBrief} from '../intelligence/publicationBrief';

export type PublicationPageOptions={profile?:PublicationBrief['profile'];paper?:PublicationBrief['paper']};
/** Measure the selected public renderer at the intended display/paper size.
 * Eight CSS pixels (six print points) is the minimum primary label size;
 * a small component count alone cannot make a kilometre-wide layout readable. */
function readability(doc:Project,viewId:string,options:PublicationPageOptions){
 const view=doc.views.find(v=>v.id===viewId)!,profile=options.profile??(view.design?'design':'editorial'),now=new Date('2000-01-01T00:00:00Z');
 if(profile==='business')return {profile,width:0,height:0,labelSize:0,displayLabelSize:0,minimumLabelSize:8,needsPages:false,reason:'Business profile uses text tables.'};
 const svg=profile==='classic'?svgDiagram(doc,viewId,false):profile==='blueprint'||profile==='editorial'?styledSvg(doc,viewId,profile,now):designSvg(doc,viewId,{type:view.design?.type??'architecture',theme:'light',now});
 const box=/viewBox="([^"]+)"/.exec(svg)?.[1].split(/\s+/).map(Number);if(!box||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)throw new Error('Publication renderer has invalid measured bounds');
 const labelSize=profile==='classic'?13:profile==='blueprint'?14:profile==='editorial'?13:12,width=box[2],height=box[3],displayWidth=options.paper==='screen'?960:700,displayHeight=options.paper==='screen'?640:830,displayLabelSize=labelSize*Math.min(1,displayWidth/width,displayHeight/height);
 return {profile,width,height,labelSize,displayLabelSize,minimumLabelSize:8,needsPages:displayLabelSize<8,reason:`Selected ${profile} figure ${width} × ${height} projects primary labels to ${displayLabelSize.toFixed(2)} px at ${options.paper??'A4'} display; minimum 8 px.`};
}

/** Bounded, disposable page memberships over the public canonical view. A page
 * changes only presentation positions; it is never an authored child view. */
export function publicationPages(input:Project,viewId:string,selectedViewIds?:readonly string[],options:PublicationPageOptions={}){
 const doc=publicDocument(validateDocument(input)),spec=viewSpec(input,viewId),view=doc.views.find(v=>v.id===viewId);if(!view)throw new Error('Publication page view is unavailable');
 const legibility=readability(doc,viewId,options),dense=spec.nodes.length>40||spec.edges.length>100||legibility.needsPages,budget=8,edgeBudget=24;
 const details=spec.nodes.flatMap(n=>n.opens&&doc.views.some(v=>v.id===n.opens)?[{nodeId:n.id,viewId:n.opens,title:doc.views.find(v=>v.id===n.opens)!.title,selected:!selectedViewIds||selectedViewIds.includes(n.opens)}]:[]);
 if(!dense)return {viewId,dense:false,budget,legibility,pages:[{id:viewId+':page:1',nodeIds:spec.nodes.map(n=>n.id),edgeIds:spec.edges.map(e=>e.id),contextEdgeIds:[] as string[],detailViewIds:details.filter(d=>d.selected).map(d=>d.viewId)}],contextEdges:[] as typeof spec.edges,details,ledger:{nodes:{shown:spec.nodes.map(n=>n.id),collapsed:[] as string[],omitted:[] as string[]},edges:{shown:spec.edges.map(e=>e.id),collapsed:[] as string[],omitted:[] as string[]},reasons:spec.omissions},reason:'Existing compact readable view presentation retained.'};
 const remaining=new Set(spec.nodes.map(n=>n.id)),groups:string[][]=[];
 // Prefer actual selected child memberships when they overlap the primary view.
 // Child-only facts remain in their own explicitly selected chapter.
 for(const detail of details.filter(d=>d.selected)){const members=doc.views.find(v=>v.id===detail.viewId)!.nodeIds.filter(id=>remaining.has(id));if(!members.length)continue;for(let i=0;i<members.length;i+=budget){const group=members.slice(i,i+budget);groups.push(group);group.forEach(id=>remaining.delete(id));}}
 const rest=[...remaining];for(let i=0;i<rest.length;i+=budget)groups.push(rest.slice(i,i+budget));
 if(!groups.length)groups.push([]);
 const shown=new Set<string>(),pages=groups.map((nodeIds,index)=>{const membership=new Set(nodeIds),local=spec.edges.filter(e=>membership.has(e.from)&&membership.has(e.to)),edgeIds=local.slice(0,edgeBudget).map(e=>e.id);edgeIds.forEach(id=>shown.add(id));return {id:viewId+':page:'+(index+1),nodeIds,edgeIds,contextEdgeIds:local.slice(edgeBudget).map(e=>e.id),detailViewIds:details.filter(d=>d.selected&&nodeIds.includes(d.nodeId)).map(d=>d.viewId)};});
 const contextEdges=spec.edges.filter(e=>!shown.has(e.id));
 return {viewId,dense:true,budget,legibility,pages,contextEdges,details,ledger:{nodes:{shown:spec.nodes.map(n=>n.id),collapsed:[] as string[],omitted:[] as string[]},edges:{shown:[...shown],collapsed:contextEdges.map(e=>e.id),omitted:[] as string[]},reasons:[...spec.omissions,legibility.reason,'Dense primary membership split into presentation pages of at most eight components. Existing selected child details are linked first. Connections crossing pages or exceeding 24 bands remain in the keyed context table; no public fact is dropped.']},reason:'Component/connection count or measured paper/display readability requires bounded presentation pages; fixed two-column pages keep component text readable.'};
}
export type PublicationPages=ReturnType<typeof publicationPages>;

/** Returns an ephemeral rendering input with the same stable semantic IDs. */
export function publicationPageProject(input:Project,plan:PublicationPages,index:number):Project{
 const doc=publicDocument(validateDocument(input)),page=plan.pages[index];if(!page)throw new Error('Publication page is unavailable');
 const source=doc.views.find(v=>v.id===plan.viewId);if(!source)throw new Error('Publication page source view is unavailable');
 if(!plan.dense)return doc;
 // This disposable renderer input narrows one view, so its story pointers must
 // follow that same membership. The handbook renders selected authored story
 // separately from the complete canonical document, never from this projection.
 const pageNodes=new Set(page.nodeIds),pageEdges=new Set(page.edgeIds),pageObservations=new Set(doc.observations.filter(o=>pageNodes.has(o.nodeId)).map(o=>o.id));
 const story=doc.story.filter(s=>s.viewId!==plan.viewId||!s.nodeId||pageNodes.has(s.nodeId)).map(s=>s.viewId!==plan.viewId?s:{...s,highlightEdgeIds:s.highlightEdgeIds.filter(id=>pageEdges.has(id)),...(s.observationIds?{observationIds:s.observationIds.filter(id=>pageObservations.has(id))}:{})});
 const projected={...doc,story,rootViewId:plan.viewId,views:doc.views.map(v=>v.id!==plan.viewId?v:{...v,design:undefined,nodeIds:page.nodeIds,edgeIds:page.edgeIds,positions:Object.fromEntries(page.nodeIds.map((id,i)=>[id,{x:(i%2)*330,y:Math.floor(i/2)*160}]))})};
 return validateDocument(projected);
}

/** Namespace only SVG document identifiers; stable fact metadata is untouched. */
export function scopePublicationSvg(svg:string,suffix:string):string{
 const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);let result=svg;
 for(const id of ids){const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),scoped=id+'-'+suffix;result=result.replace(new RegExp(' id="'+escaped+'"','g'),' id="'+scoped+'"').replace(new RegExp('url\\(#'+escaped+'\\)','g'),'url(#'+scoped+')').replace(new RegExp('href="#'+escaped+'"','g'),'href="#'+scoped+'"');}
 return result.replace(/aria-labelledby="([^"]+)"/g,(_,value:string)=>'aria-labelledby="'+value.split(' ').map(id=>ids.includes(id)?id+'-'+suffix:id).join(' ')+'"');
}
