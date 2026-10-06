/**
 * Minimal ZIP reader for Office Open XML packages (Visio .vsdx). Reads the central directory, then inflates the
 * requested entries with the platform's DecompressionStream. No ZIP64, encryption or multi-disk archives.
 */
export type ZipEntry={name:string;method:number;offset:number;compressedSize:number;size:number};
const MAX_ENTRY=64*1024*1024;

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

/** The text of one entry, or undefined when the package has no such entry. */
export async function zipText(bytes:Uint8Array,entries:Map<string,ZipEntry>,name:string):Promise<string|undefined>{
 const e=entries.get(name)??[...entries.values()].find(x=>x.name.toLowerCase()===name.toLowerCase());if(!e)return undefined;
 if(e.size>MAX_ENTRY||e.compressedSize>MAX_ENTRY)throw new Error(`The package part ${name} is too large.`);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(e.offset,true)!==0x04034b50)throw new Error(`The package part ${name} is damaged.`);
 const dataStart=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true);
 const data=bytes.subarray(dataStart,dataStart+e.compressedSize);
 if(e.method===0)return new TextDecoder().decode(data);
 if(e.method!==8)throw new Error(`The package part ${name} uses an unsupported compression method.`);
 const stream=new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
