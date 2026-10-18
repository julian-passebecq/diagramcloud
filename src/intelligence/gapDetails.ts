import {z} from 'zod';

/** Producer-supplied diagnostic reasons. Missing metadata means unclassified, never a guessed cause. */
export const GAP_CAUSES = ['missing-declaration','missing-source','access-denied','unsupported-analyzer','dynamic-unresolved','stale-revision','conflicting-evidence','consumer-error'] as const;
export const GAP_ACTION_KINDS = ['declare','select-source','request-access','use-specialist','verify-runtime','refresh-source','review-evidence','report-consumer-error'] as const;
export const gapCauseSchema = z.enum(GAP_CAUSES);
export const gapActionSchema = z.object({kind:z.enum(GAP_ACTION_KINDS),label:z.string().min(1).max(240)}).strict();
export type GapCause = z.infer<typeof gapCauseSchema>;
export type GapAction = z.infer<typeof gapActionSchema>;

const ACTIONS: Record<GapCause,GapAction> = {
  'missing-declaration': {kind:'declare',label:'Supply the required declaration for this scope.'},
  'missing-source': {kind:'select-source',label:'Review the selected scope and supply an authorized source if available.'},
  'access-denied': {kind:'request-access',label:'Request access through the source owner or choose another authorized source.'},
  'unsupported-analyzer': {kind:'use-specialist',label:'Use a compatible source or a specialist that supports this feature.'},
  'dynamic-unresolved': {kind:'verify-runtime',label:'Supply a resolved declaration or dated external runtime evidence; keep the relation unresolved meanwhile.'},
  'stale-revision': {kind:'refresh-source',label:'Refresh the explicitly selected source or regenerate the proposal at its current revision.'},
  'conflicting-evidence': {kind:'review-evidence',label:'Review the cited declarations and their scope before choosing a correction.'},
  'consumer-error': {kind:'report-consumer-error',label:'Report the consumer failure with sanitized operation and version details.'},
};

/** Advice only: this descriptor contains no command, URL, permission grant or executable action. */
export function actionForGapCause(cause:GapCause):GapAction {
  return {...ACTIONS[cause]};
}

export function gapAdvice(cause:GapCause):{cause:GapCause;action:GapAction} {
  return {cause,action:actionForGapCause(cause)};
}
