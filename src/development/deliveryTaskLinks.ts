import {sha256Hex} from '../core/proposal';
import {parsePmTaskDocument, type PmTask, type PmTaskDocument} from './pmTasks';
import type {DeliveryView, DeliveryTaskRef} from './deliveryEvidence';

/** A local file snapshot, not PM admission, authentication or a live connection. */
export type DeliveryTaskSnapshot = {document: PmTaskDocument; inputSha256: string};
export type DeliveryTaskLink = {
  blockId: string; taskId: string;
  state: 'NO_SNAPSHOT' | 'SNAPSHOT_MISMATCH' | 'SCOPE_MISMATCH' | 'REVISION_MISMATCH' | 'TASK_ABSENT' | 'MATCHED';
  task: PmTask | null; expected: DeliveryTaskRef;
};
export const TASK_LINK_NOTICE = 'A match binds these supplied bytes and scoped task identity only. PM state and review are declarations, not DiagramCloud approval, current activity or release qualification.';
export function readDeliveryTaskSnapshot(raw: string): DeliveryTaskSnapshot {
  return {document: parsePmTaskDocument(raw), inputSha256: sha256Hex(raw)};
}

/** No fallback by title, block ID, newest revision or a similar scope. Source changes require explicit remapping. */
export function resolveDeliveryTaskLinks(plan: DeliveryView, snapshot: DeliveryTaskSnapshot | null, audience: 'author' | 'public'):
  {withheld: boolean; links: DeliveryTaskLink[]; unmappedBlocks: string[]} {
  // Existing PM task documents are private. Marking the surrounding plan public does not publish task contents.
  if (audience !== 'author') return {withheld: true, links: [], unmappedBlocks: []};
  const links: DeliveryTaskLink[] = [];
  for (const block of plan.blocks) for (const expected of block.taskRefs) {
    let state: DeliveryTaskLink['state'] = 'NO_SNAPSHOT', task: PmTask | null = null;
    if (snapshot) {
      const d = snapshot.document;
      if (snapshot.inputSha256 !== expected.inputSha256) state = 'SNAPSHOT_MISMATCH';
      else if (Object.keys(expected.scope).some(k => expected.scope[k as keyof typeof expected.scope] !== d.scope[k as keyof typeof d.scope])) state = 'SCOPE_MISMATCH';
      else if (d.revision !== expected.revision) state = 'REVISION_MISMATCH';
      else {
        const found = d.tasks.find(t => t.id === expected.taskId);
        if (!found) state = 'TASK_ABSENT';
        else {state = 'MATCHED'; task = structuredClone(found);}
      }
    }
    links.push({blockId: block.id, taskId: expected.taskId, state, task, expected: structuredClone(expected)});
  }
  return {withheld: false, links, unmappedBlocks: plan.blocks.filter(b => !b.taskRefs.length).map(b => b.id)};
}
