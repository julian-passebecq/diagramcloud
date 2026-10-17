import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {matchAsset,withDigest} from '../core/assetIdentity';
import type {Asset,EvidenceBlock,Project} from '../core/model';

type Pending={asset:Asset;block:EvidenceBlock;exact:Asset[]};
type Options={doc:Pick<Project,'assets'>;attach:(asset:Asset,block:EvidenceBlock)=>void;reuse:(block:EvidenceBlock)=>void;onNote?:(note:string)=>void};

/**
 * Attach a new image with its locally computed digest. Identical bytes already in the project → the author chooses
 * "Reuse existing image" (a new block on the existing asset) or "Keep both" (recorded in keptDistinctFrom, so it is never
 * asked again for that pair). The same name with different bytes is attached and flagged as a possible duplicate, never merged.
 */
export function useImageDuplicates(o:Options){
 const [pending,setPending]=useState<Pending|null>(null);
 const offer=async(raw:Asset,block:EvidenceBlock)=>{
  const asset=await withDigest(raw),match=await matchAsset(o.doc,{name:asset.name,digest:asset.digest!});
  if(match.exact.length){setPending({asset,block,exact:match.exact});return;}
  setPending(null);o.attach(asset,block);
  if(match.sameName.length)o.onNote?.(`Possible duplicate: “${asset.name}” has the same name as ${match.sameName.map(a=>a.id).join(', ')} but different bytes. Both are kept; nothing was merged.`);
 };
 const prompt=pending&&<div className="note-card duplicate-choice" role="group" aria-label="Duplicate image">
  <strong>This image is already in the project</strong>
  <p className="micro">“{pending.asset.name}” has the same bytes ({pending.asset.digest!.slice(0,19)}…) as {pending.exact.map(a=>`“${a.name}” (${a.id})`).join(', ')}. Reuse it, or keep both as distinct copies.</p>
  <div className="toolbar">
   <Button appearance="primary" onClick={()=>{const target=pending.exact[0];setPending(null);o.reuse({...pending.block,assetId:target.id} as EvidenceBlock);o.onNote?.(`Reused the existing image ${target.id}; no new asset was added.`);}}>Reuse existing image</Button>
   <Button onClick={()=>{const p=pending;setPending(null);o.attach({...p.asset,keptDistinctFrom:p.exact.map(a=>a.id)},p.block);o.onNote?.(`Kept both: ${p.asset.id} is recorded as a distinct copy of ${p.exact.map(a=>a.id).join(', ')}.`);}}>Keep both</Button>
   <Button appearance="subtle" onClick={()=>setPending(null)}>Cancel</Button>
  </div>
 </div>;
 return {offer,prompt,pending:!!pending};
}
