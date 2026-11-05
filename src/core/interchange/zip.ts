/**
 * Minimal ZIP reader for Office Open XML packages (Visio .vsdx). Reads the central directory, then inflates the
 * requested entries with the platform's DecompressionStream. No ZIP64, encryption or multi-disk archives.
 */
export type ZipEntry={name:string;method:number;offset:number;compressedSize:number;size:number};
const MAX_ENTRY=64*1024*1024;

/** Thrown when a decompressed stream would exceed its byte limit; callers report it instead of a generic read error. */
export class InflateLimitError extends Error{}

/**
 * Inflate `bytes` chunk by chunk and stop as soon as the output passes `limit` bytes, so a small compressed
 * stream that expands to gigabytes is refused before it is held in memory.
 */
export async function inflateBounded(bytes:Uint8Array,format:'deflate-raw'|'deflate',limit:number,message:string):Promise<Uint8Array>{
 const reader=new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(format)).getReader();
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){
  const {done,value}=await reader.read();if(done)break;
  size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>undefined);throw new InflateLimitError(message);}
  chunks.push(value);
 }
 const out=new Uint8Array(size);let o=0;for(const c of chunks){out.set(c,o);o+=c.byteLength;}
 return out;
}

export function zipEntries(bytes:Uint8Array):Map<string,ZipEntry>{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<22||view.getUint32(0,true)!==0x04034b50)throw new Error('Not a ZIP package.');
 // The end-of-central-directory record sits in the last 22 + 65535 (comment) bytes.
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw new Error('The ZIP package is truncated (no central directory).');
 const count=view.getUint16(eocd+10,true),start=view.getUint32(eocd+16,true);
 const out=new Map<string,ZipEntry>(),names=new TextDecoder();
 for(let i=0,p=start;i<count;i++){
  if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)throw new Error('The ZIP central directory is damaged.');
  const method=view.getUint16(p+10,true),compressedSize=view.getUint32(p+20,true),size=view.getUint32(p+24,true);
  const nameLen=view.getUint16(p+28,true),extraLen=view.getUint16(p+30,true),commentLen=view.getUint16(p+32,true),offset=view.getUint32(p+42,true);
  const name=names.decode(bytes.subarray(p+46,p+46+nameLen));
  out.set(name,{name,method,offset,compressedSize,size});p+=46+nameLen+extraLen+commentLen;
 }
 return out;
}

const findEntry=(entries:Map<string,ZipEntry>,name:string)=>entries.get(name)??[...entries.values()].find(x=>x.name.toLowerCase()===name.toLowerCase());

/** Uncompressed bytes one package import may read in total, across every part. */
export const MAX_PACKAGE_INFLATED=64*1024*1024;

/**
 * Reads parts of one package with one shared budget: each part is read (and inflated) at most once, its text is
 * cached for later references, and the declared sizes of every part read draw from `limit` before any inflation,
 * so the total work of an import is bounded however many pages point to the same part.
 */
export function partReader(bytes:Uint8Array,entries:Map<string,ZipEntry>,limit=MAX_PACKAGE_INFLATED,message=`The package expands to more than ${limit/1024/1024} MiB of parts.`){
 const cache=new Map<string,Promise<string|undefined>>();let used=0;
 return {
  get used(){return used;},
  text(name:string):Promise<string|undefined>{
   const e=findEntry(entries,name);if(!e)return Promise.resolve(undefined);
   const hit=cache.get(e.name);if(hit)return hit;
   if(used+e.size>limit)return Promise.reject(new InflateLimitError(message));
   used+=e.size;const read=zipText(bytes,entries,e.name);cache.set(e.name,read);return read;
  },
 };
}
export type PartReader=ReturnType<typeof partReader>;

/** The text of one entry, or undefined when the package has no such entry. */
export async function zipText(bytes:Uint8Array,entries:Map<string,ZipEntry>,name:string):Promise<string|undefined>{
 const e=findEntry(entries,name);if(!e)return undefined;
 if(e.size>MAX_ENTRY||e.compressedSize>MAX_ENTRY)throw new Error(`The package part ${name} is too large.`);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(e.offset,true)!==0x04034b50)throw new Error(`The package part ${name} is damaged.`);
 const dataStart=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true);
 const data=bytes.subarray(dataStart,dataStart+e.compressedSize);
 // The declared size is checked against the real output: inflation stops at the declared size (at most 64 MiB),
 // and a part whose real size differs from the central directory is refused as damaged.
 if(e.method===0){if(data.length!==e.size)throw new Error(`The package part ${name} is damaged.`);return new TextDecoder().decode(data);}
 if(e.method!==8)throw new Error(`The package part ${name} uses an unsupported compression method.`);
 const out=await inflateBounded(data,'deflate-raw',Math.min(MAX_ENTRY,e.size),`The package part ${name} is too large.`);
 if(out.byteLength!==e.size)throw new Error(`The package part ${name} is damaged.`);
 return new TextDecoder().decode(out);
}
