import type {ExperiencePack} from './model';

/**
 * Undo/redo for experience-pack edits in the studio. Each entry remembers the pack before an edit and a label
 * for that edit ("Moved SQL validation rule"). Undo and redo restore content but always issue a new, higher
 * revision: revision numbers only go up, so an AI import prepared against an older revision is still refused.
 */
export type PackEntry={pack:ExperiencePack;label:string};
export type PackHistory={past:PackEntry[];present:ExperiencePack;future:PackEntry[]};
export const HISTORY_LIMIT=50;

export function startHistory(pack:ExperiencePack):PackHistory{return {past:[],present:pack,future:[]};}

/** Record an already-validated next pack. Its revision is set to present + 1 unless keepRevision (imports carry their own). Redo is cleared. */
export function commitPack(h:PackHistory,next:ExperiencePack,label:string,keepRevision=false):PackHistory{
 return {past:[...h.past,{pack:h.present,label}].slice(-HISTORY_LIMIT),present:keepRevision?next:{...next,revision:h.present.revision+1},future:[]};
}

/** A short human label for what changed between two packs, used on the Undo/Redo buttons. */
export function describeChange(before:ExperiencePack,after:ExperiencePack):string{
 const title=(p:ExperiencePack,itemId:string)=>p.items.find(i=>i.id===itemId)?.title??itemId;
 const spaces=new Map(before.workspaces.map(w=>[w.id,w]));
 const added=after.workspaces.filter(w=>!spaces.has(w.id));if(added.length)return `New board “${added[0].title}”`;
 const moves:string[]=[];
 for(const w of after.workspaces){
  const old=spaces.get(w.id);if(!old)continue;
  if(old.title!==w.title||old.description!==w.description||old.visibility!==w.visibility)return 'Board settings';
  const was=new Map(old.placements.map(p=>[p.id,p])),now=new Set(w.placements.map(p=>p.id));
  const gone=old.placements.filter(p=>!now.has(p.id));if(gone.length)return `Removed “${title(before,gone[0].itemId)}”`;
  const fresh=w.placements.filter(p=>!was.has(p.id));if(fresh.length)return `Added “${title(after,fresh[0].itemId)}”`;
  for(const p of w.placements){const o=was.get(p.id)!;if(o.w!==p.w||o.h!==p.h)moves.push(`Resized “${title(after,p.itemId)}”`);else if(o.x!==p.x||o.y!==p.y)moves.push(`Moved “${title(after,p.itemId)}”`);}
 }
 return moves.length>1?'Rearranged board':moves[0]??'Edit';
}
export function undoPack(h:PackHistory):PackHistory{
 const last=h.past.at(-1);if(!last)return h;
 return {past:h.past.slice(0,-1),present:{...last.pack,revision:h.present.revision+1},future:[{pack:h.present,label:last.label},...h.future]};
}
export function redoPack(h:PackHistory):PackHistory{
 const next=h.future[0];if(!next)return h;
 return {past:[...h.past,{pack:h.present,label:next.label}].slice(-HISTORY_LIMIT),present:{...next.pack,revision:h.present.revision+1},future:h.future.slice(1)};
}
export const undoLabel=(h:PackHistory)=>h.past.at(-1)?.label??'';
export const redoLabel=(h:PackHistory)=>h.future[0]?.label??'';

/** Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo; never while typing in a field. */
export function historyKey(e:{key:string;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;target:EventTarget|null}):'undo'|'redo'|null{
 const el=e.target as {closest?:(s:string)=>unknown}|null;
 if(el?.closest?.('input,textarea,select,[contenteditable="true"]'))return null;
 if(!(e.ctrlKey||e.metaKey))return null;
 const k=e.key.toLowerCase();
 if(k==='z')return e.shiftKey?'redo':'undo';
 if(k==='y'&&!e.shiftKey)return 'redo';
 return null;
}
