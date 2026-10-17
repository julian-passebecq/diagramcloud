import {ASSET_DIGEST,type Asset,type Project} from './model';

/**
 * Image identity for duplicate detection. The digest is the SHA-256 of the stored image bytes (the decoded data URL),
 * computed locally in this browser or process. A Drive md5Checksum, ETag or modifiedTime is never a digest.
 * An exact duplicate is offered as "reuse or keep both"; a same-name image with different bytes is only flagged as a
 * possible duplicate. Nothing here merges, removes or rewrites an asset.
 */
export type AssetDigest=`sha256:${string}`;

function dataBytes(dataUrl:string):Uint8Array<ArrayBuffer>{
 const comma=dataUrl.indexOf(',');if(comma<0||!/;base64$/.test(dataUrl.slice(0,comma)))throw new Error('An image asset is a base64 data URL');
 const binary=atob(dataUrl.slice(comma+1)),bytes=new Uint8Array(new ArrayBuffer(binary.length));for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;
}
export async function assetDigest(dataUrl:string):Promise<AssetDigest>{
 const hash=await crypto.subtle.digest('SHA-256',dataBytes(dataUrl));return `sha256:${[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}`;
}
/** The asset with its locally computed digest. A digest already present is recomputed, never trusted. */
export async function withDigest(asset:Asset):Promise<Asset>{return {...asset,digest:await assetDigest(asset.data)};}

export type AssetMatch={exact:Asset[];sameName:Asset[]};
const sameName=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
/** Existing project assets that match a new image: identical bytes (exact), or the same file name with different bytes. */
export async function matchAsset(doc:Pick<Project,'assets'>,candidate:{name:string;digest:string}):Promise<AssetMatch>{
 const exact:Asset[]=[],named:Asset[]=[];
 for(const a of doc.assets){const digest=await assetDigest(a.data);if(digest===candidate.digest)exact.push(a);else if(sameName(a.name,candidate.name))named.push(a);}
 return {exact,sameName:named};
}

/** Imported digests are checked against the bytes they claim to identify; a mismatch refuses the import. */
export async function digestErrors(doc:Pick<Project,'assets'>):Promise<string[]>{
 const errors:string[]=[];
 for(const a of doc.assets)if(a.digest){if(!ASSET_DIGEST.test(a.digest))errors.push(`${a.id}: malformed digest`);else if(await assetDigest(a.data)!==a.digest)errors.push(`${a.id}: its digest does not match its image bytes. A digest is computed locally from the bytes, never copied from Drive or an ETag.`);}
 return errors;
}

export type DuplicateFlag={assetId:string;otherId:string;kind:'exact'|'possible'|'kept-distinct'};
const kept=(a:Asset,b:Asset)=>!!(a.keptDistinctFrom?.includes(b.id)||b.keptDistinctFrom?.includes(a.id));
/**
 * Pairs of project images worth the author's attention: identical bytes (exact), same name with different bytes
 * (possible), or a pair the author already chose to keep (kept-distinct, never asked again). Read-only.
 */
export async function duplicateFlags(doc:Pick<Project,'assets'>):Promise<DuplicateFlag[]>{
 const digests=await Promise.all(doc.assets.map(a=>assetDigest(a.data))),flags:DuplicateFlag[]=[];
 doc.assets.forEach((a,i)=>doc.assets.forEach((b,j)=>{if(j<=i)return;
  if(kept(a,b))flags.push({assetId:b.id,otherId:a.id,kind:'kept-distinct'});
  else if(digests[i]===digests[j])flags.push({assetId:b.id,otherId:a.id,kind:'exact'});
  else if(sameName(a.name,b.name))flags.push({assetId:b.id,otherId:a.id,kind:'possible'});}));
 return flags;
}
export const DUPLICATE_LABEL:Record<DuplicateFlag['kind'],string>={exact:'Exact duplicate (same bytes)',possible:'Possible duplicate: same name, different bytes. Never merged.','kept-distinct':'Kept as a distinct copy by the author'};
