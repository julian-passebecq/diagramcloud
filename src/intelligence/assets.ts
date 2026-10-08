import type {Project} from '../core/model';
import type {AssetPlan} from './types';

/** A read port for the existing icon registry; not a second registry. */
export type RegisteredIcon = {id: string; origin: 'original' | 'vendor'};
export function planAssets(project: Project, registry: readonly RegisteredIcon[]): AssetPlan {
  const known = new Map(registry.map(icon => [icon.id, icon]));
  if (!known.has('generic')) throw new Error('The registry must provide the generic fallback');
  return {
    format: 'diagramcloud.asset-plan', version: 1,
    projectId: project.id, projectRevision: project.revision,
    requirements: [...project.nodes].sort((a, b) => a.id.localeCompare(b.id, 'en')).map(node => {
      const icon = known.get(node.icon);
      const isGeneric = !icon || icon.id === 'generic';
      const namedProvider = !!node.provider.trim() && node.provider !== 'Generic';
      return {
        id: `asset-${node.id}`, nodeId: node.id, label: node.label, requestedIcon: node.icon,
        status: !icon ? 'unknown-icon' as const : isGeneric ? 'generic-fallback' as const : 'resolved' as const,
        resolvedIcon: icon?.id || 'generic', blocksRendering: false as const,
        recommendation: !isGeneric ? 'keep' as const : namedProvider ? 'official-asset-review' as const : 'semantic-symbol' as const,
        reason: !icon ? 'Unknown icon ID. Use the generic symbol, never an arbitrary asset path.'
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
  const rows: unknown[][] = [['asset_id', 'node_id', 'label', 'requested_icon', 'status', 'resolved_icon', 'recommendation', 'blocks_rendering', 'reason'],
    ...plan.requirements.map(r => [r.id, r.nodeId, r.label, r.requestedIcon, r.status, r.resolvedIcon, r.recommendation, r.blocksRendering, r.reason])];
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
