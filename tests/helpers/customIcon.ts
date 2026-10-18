import {deflateSync} from 'node:zlib';
/** Original synthetic raster: four coloured bands, 4:1 aspect, no vendor art. */
export function customIconData(){
 const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const chunk=(name:string,data:Buffer)=>{const type=Buffer.from(name),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,checksum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(320,0);header.writeUInt32BE(80,4);header[8]=8;header[9]=6;
 const pixels=Buffer.alloc(80*(1+320*4)),colors=[[230,100,60],[70,130,220],[60,170,130],[160,100,190]];
 for(let y=0;y<80;y++)for(let x=0;x<320;x++){const at=y*(1+320*4)+1+x*4,color=colors[Math.floor(x/80)];pixels[at]=color[0];pixels[at+1]=color[1];pixels[at+2]=color[2];pixels[at+3]=255;}
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);return 'data:image/png;base64,'+png.toString('base64');
}
