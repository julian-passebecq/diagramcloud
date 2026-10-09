import {rasterAvailable} from '../export/rasterDimensions';
import {publicationPages} from '../export/publicationPages';
import {z} from 'zod';
import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {viewSpec} from '../core/viewspec';
import {secretFindings} from '../core/secrets';
export const publicationBriefSchema=z.object({format:z.literal('diagramcloud.publication-brief/1'),title:z.string().max(160),audience:z.string().max(160),viewIds:z.array(z.string().min(1).max(120)).min(1).max(80),detail:z.enum(['overview','standard','full']).default('full'),paper:z.enum(['A4','letter','screen']).default('A4'),profile:z.enum(['classic','editorial','blueprint','design','business']).default('design'),storyIndices:z.array(z.number().int().nonnegative()).max(30).default([])}).strict();
export type PublicationBrief=z.infer<typeof publicationBriefSchema>;
export function validatePublicationBrief(input:unknown,project:Project){const brief=publicationBriefSchema.parse(input),safe=publicDocument(project);
 if(new Set(brief.viewIds).size!==brief.viewIds.length||new Set(brief.storyIndices).size!==brief.storyIndices.length)throw new Error('Duplicate publication selection');
 if(brief.viewIds.some(id=>!safe.views.some(v=>v.id===id)))throw new Error('Publication references an unavailable public view');
 if(brief.storyIndices.some(i=>!safe.story[i]||!brief.viewIds.includes(safe.story[i].viewId)))throw new Error('Publication story step is unavailable or outside the selected views');
 if(secretFindings(brief,'publication brief').length)throw new Error('Publication brief contains sensitive text');return brief;
}
/** Every ledger row is computed from the same input/spec as its renderer.
 * Hidden object identities never enter a public omission row. */
export function publicationFidelity(project:Project,briefInput:unknown){const brief=validatePublicationBrief(briefInput,project),safe=publicDocument(project);
 const views=brief.viewIds.map(id=>{const spec=viewSpec(project,id),unavailableImages=brief.detail==='full'?safe.blocks.filter(b=>b.type==='image'&&spec.nodes.some(n=>n.evidenceRefs.includes(b.id))&&!rasterAvailable(safe.assets.find(a=>a.id===b.assetId)?.data??'')).map(b=>({blockId:b.id,reason:'Raster container or dimensions unavailable; caption and recorded rights retained without embedded pixels.'})):[],original=safe.views.find(v=>v.id===id)!,pagination=publicationPages(project,id,brief.viewIds,{profile:brief.profile,paper:brief.paper});return {viewId:id,title:spec.title,nodes:pagination.ledger.nodes,edges:brief.profile==='business'?{shown:[] as string[],collapsed:spec.edges.map(e=>e.id),omitted:[] as string[]}:pagination.ledger.edges,representation:brief.profile==='business'?'text-and-tables':'figures-and-tables',pages:pagination.dense?pagination.pages.map(p=>({id:p.id,shownNodeIds:p.nodeIds,drawnEdgeIds:brief.profile==='business'?[]:p.edgeIds})):[],contextTableEdgeIds:pagination.contextEdges.map(e=>e.id),evidence:{unavailableImages,shown:brief.detail==='full'?[...new Set(spec.nodes.flatMap(n=>n.evidenceRefs))]:[],omitted:brief.detail==='full'?0:new Set(spec.nodes.flatMap(n=>n.evidenceRefs)).size,reason:brief.detail==='full'?'Attached public evidence included.':'Brief detail excludes evidence bodies; references remain in tables.'},reasons:pagination.ledger.reasons,complexity:{nodes:spec.nodes.length,edges:spec.edges.length,overviewBudget:40,withinOverviewBudget:spec.nodes.length<=40&&spec.edges.length<=100,legibility:pagination.legibility,paginated:pagination.dense,pageNodeBudget:pagination.budget}};});
 return {format:'diagramcloud.publication-fidelity/1',profile:brief.profile,detail:brief.detail,views,omittedViews:safe.views.filter(v=>!brief.viewIds.includes(v.id)).map(v=>({viewId:v.id,reason:'Not selected by the publication brief.'})),story:{shown:brief.storyIndices,omitted:safe.story.length-brief.storyIndices.length,reason:'Only explicitly selected authored steps included.'},policy:'Public ViewSpec first. Presentation does not rewrite semantic entities, designed status or observations.'};
}
