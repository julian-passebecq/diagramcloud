/** Intrinsic dimensions of the three embedded raster formats. No network, decoder or image mutation. */
export function rasterDimensions(data:string):{width:number;height:number}{
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data);
 if(!match)throw new Error('Cannot size custom artwork: unsupported raster format');
 const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0)),v=new DataView(bytes.buffer);
 let width=0,height=0;
 const ascii=(start:number,n:number)=>String.fromCharCode(...bytes.subarray(start,start+n));
 if(match[1]==='png'&&bytes.length>=45&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a&&v.getUint32(8)===13&&ascii(12,4)==='IHDR'){
  let ended=false,pixels=false;for(let i=8;i+12<=bytes.length;){const size=v.getUint32(i),end=i+12+size;if(end>bytes.length)break;const kind=ascii(i+4,4);if(kind==='IDAT'&&size) pixels=true;if(kind==='IEND'){ended=size===0&&end===bytes.length;break;}i=end;}
  if(ended&&pixels){width=v.getUint32(16);height=v.getUint32(20);}
 }
 if(match[1]==='jpeg'&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9){
  for(let i=2;i+3<bytes.length;){
   if(bytes[i++]!==0xff)break;while(bytes[i]===0xff)i++;const marker=bytes[i++];
   if(marker===0xd9||marker===0xda)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   if(i+2>bytes.length)break;const size=v.getUint16(i);if(size<2||i+size>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&size>=7){height=v.getUint16(i+3);width=v.getUint16(i+5);break;}i+=size;
  }
 }
 if(match[1]==='webp'&&bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'&&v.getUint32(4,true)+8===bytes.length&&v.getUint32(16,true)+20<=bytes.length){
  const chunk=ascii(12,4),u24=(i:number)=>bytes[i]+(bytes[i+1]<<8)+(bytes[i+2]<<16);
  if(chunk==='VP8X'){width=u24(24)+1;height=u24(27)+1;}
  else if(chunk==='VP8 '&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a){width=v.getUint16(26,true)&0x3fff;height=v.getUint16(28,true)&0x3fff;}
  else if(chunk==='VP8L'&&bytes[20]===0x2f){const bits=v.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
 }
 if(!width||!height||width*height>40_000_000)throw new Error('Cannot size custom artwork: invalid or excessive raster dimensions');
 return {width,height};
}

/** Container/header availability only; does not attest that every pixel decodes. */
export function rasterAvailable(data:string):boolean{try{rasterDimensions(data);return true;}catch{return false;}}
