import type {Project} from '../core/model';
import {DEFAULT_OPTIONS, PURPOSES, type AnalysisOptions, type AssetPlan} from './types';
import {contextualRecipes, recipeRegistry, repositoryOutputFacts} from './recipes';
import {z} from 'zod';
import {rasterAvailable} from '../export/rasterDimensions';

/** A read port for the existing icon registry; not a second registry. */
export type RegisteredIcon = {id: string; origin: 'original' | 'vendor';source?:{repository:string;commit:string;blob:string};terms?:{name:string;url:string}};
export type AssetPlanOptions = {
  viewId?: string; recipeId?: string; analysis?: Partial<AnalysisOptions>;
  context?: {archetypes: string[]; repositoryId?: string; environmentId?: string};
};
export function planAssets(project: Project, registry: readonly RegisteredIcon[],options:AssetPlanOptions={}): AssetPlan {
  const known = new Map(registry.map(icon => [icon.id, icon]));
  if (!known.has('generic')) throw new Error('The registry must provide the generic fallback');
  if(options.viewId!==undefined&&options.recipeId!==undefined)throw new Error('Choose one asset-plan view or recipe scope');
  const view=options.viewId!==undefined?project.views.find(v=>v.id===options.viewId):undefined;if(options.viewId!==undefined&&!view)throw new Error('Unknown asset-plan view');
  let scope:NonNullable<AssetPlan['scope']>={kind:view?'view':'project',viewIds:view?[view.id]:project.views.map(v=>v.id),nodeIds:[],availability:'available',state:'available',reason:view?'Current canonical members of the selected view.':'Current canonical project components.'};
  let nodes=project.nodes.filter(n=>!view||view.nodeIds.includes(n.id));
  if(options.recipeId!==undefined){
    if(!recipeRegistry.some(r=>r.id===options.recipeId))throw new Error('Unknown asset-plan recipe');
    const analysis=z.object({purpose:z.enum(PURPOSES),depth:z.enum(['quick','standard']),includeInferred:z.boolean()}).strict().parse({...DEFAULT_OPTIONS,...options.analysis});
    const context=options.context?z.object({archetypes:z.array(z.string()).max(30),repositoryId:z.string().min(1).optional(),environmentId:z.string().min(1).optional()}).strict().parse(options.context):undefined;
    const recipe=contextualRecipes(project,analysis,context).find(r=>r.id===options.recipeId)!;
    const scopedIds=new Set(repositoryOutputFacts(project,context?.repositoryId).nodes.map(n=>n.id));
    const memberships=new Set(project.views.filter(v=>recipe.viewIds.includes(v.id)).flatMap(v=>v.nodeIds));
    const environmentIds=context?.environmentId?new Set(project.delivery?.instances.filter(i=>i.environmentId===context.environmentId).flatMap(i=>[i.nodeId,i.componentId])??[]):undefined;
    nodes=project.nodes.filter(n=>memberships.has(n.id)&&scopedIds.has(n.id)&&(analysis.includeInferred||n.basis!=='unknown')&&(!environmentIds||environmentIds.has(n.id)));
    scope={kind:'recipe',recipeId:recipe.id,viewIds:[...recipe.viewIds],nodeIds:[],availability:nodes.length?recipe.availability:'unknown',state:z.enum(['recommended','available','useful','unavailable','not-applicable']).parse(nodes.length?recipe.state:recipe.state==='not-applicable'?'not-applicable':'unavailable'),
      reason:nodes.length?recipe.reason+' Asset requirements use every unique current component in the selected recipe views; preview limits do not create or omit asset facts.':recipe.reason+' No current components satisfy the recipe and selected filters; the plan is empty.',options:analysis,context};
  }
  nodes=[...nodes].sort((a,b)=>a.id.localeCompare(b.id,'en'));scope.nodeIds=nodes.map(n=>n.id);
  if(!nodes.length){scope.availability='unknown';if(scope.state!=='not-applicable')scope.state='unavailable';}
  return {
    format: 'diagramcloud.asset-plan', version: 1,
    projectId: project.id, projectRevision: project.revision,
    scope,
    requirements: nodes.map(node => {
      const icon = known.get(node.icon);
      const custom=node.customIconAssetId?project.assets.find(a=>a.id===node.customIconAssetId&&a.rights.trim()):undefined;
      const customAvailable=!!custom&&rasterAvailable(custom.data);
      const isGeneric = !icon || icon.id === 'generic';
      const namedProvider = !!node.provider.trim() && node.provider !== 'Generic';
      return {
        id: `asset-${node.id}`, nodeId: node.id, label: node.label, requestedIcon: node.icon,
        status: customAvailable?'resolved' as const:!icon ? 'unknown-icon' as const : isGeneric ? 'generic-fallback' as const : 'resolved' as const,
        resolvedIcon: icon?.id || 'generic', blocksRendering: false as const,
        recommendation: custom||!isGeneric ? 'keep' as const : namedProvider ? 'official-asset-review' as const : 'semantic-symbol' as const,
        customAssetId:custom?.id,origin:custom?'project-asset' as const:icon?.origin??'original' as const,rights:custom?.rights,assetVisibility:custom?.visibility,sourceIdentity:icon?.source,terms:icon?.terms,
        reason: custom&&!customAvailable?'Custom raster container or dimensions unavailable; optional artwork falls back to the registry or semantic symbol. Asset and rights remain in the author backup.':custom?'Project-scoped raster asset with recorded rights. Aspect ratio retained; private assets are omitted from public exports. Some presentation profiles use semantic labels; inspect the fidelity ledger.':!icon ? 'Unknown icon ID. Use the generic symbol, never an arbitrary asset path.'
          : !isGeneric ? 'Existing registry entry. Its origin and usage terms remain authoritative.'
          : namedProvider ? 'Generic symbol is sufficient. Review official artwork only for the exact represented product.'
          : 'Generic semantic symbol is sufficient; custom illustration is optional.',
      };
    }),
    limitations: ['Asset gaps never block factual diagrams.', 'No downloads, image generation, uploads or registry mutations occur.',
      'Provider identity must come from project/source facts, not from a generated logo.',
      'Inspect before sharing: this authoring checklist may contain private node labels.'],
  };
}

/** Spreadsheet-safe export: protect cells from formula injection and quote RFC 4180 fields. */
export function assetChecklistCsv(plan: AssetPlan): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const scope=[plan.scope?.kind,plan.scope?.recipeId,plan.scope?.viewIds.join(' | '),plan.scope?.availability,plan.scope?.state,plan.scope?.reason,'Private authoring checklist; inspect before sharing'];
  const requirementRows=plan.requirements.map(r => [r.id, r.nodeId, r.label, r.requestedIcon, r.status, r.resolvedIcon, r.recommendation, r.blocksRendering, r.reason,r.origin,r.customAssetId,r.assetVisibility,r.rights,r.sourceIdentity?.repository,r.sourceIdentity?.commit,r.sourceIdentity?.blob,r.terms?.name,r.terms?.url]);
  const rows: unknown[][] = [['asset_id', 'node_id', 'label', 'requested_icon', 'status', 'resolved_icon', 'recommendation', 'blocks_rendering', 'reason','origin','custom_asset_id','asset_visibility','rights','source_repository','source_commit','source_blob','terms_name','terms_url','scope_kind','recipe_id','view_ids','scope_availability','scope_state','scope_reason','privacy'],
    ...(requirementRows.length?requirementRows:[Array(18).fill('')]).map(row=>[...row,...scope])];
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
