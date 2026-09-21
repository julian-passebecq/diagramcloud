/** Presentation line wrapping. Preserve code indentation; never normalize its spaces. */
export function wrapLines(text:string,width:number,preserveSpaces=false):string[]{
 if(width<1)throw new Error('Line width must be positive');
 return text.split('\n').flatMap(line=>{
  if(!line)return [''];
  if(preserveSpaces)return Array.from({length:Math.ceil(line.length/width)},(_,i)=>line.slice(i*width,(i+1)*width));
  const lines:string[]=[];let rest=line;
  while(rest.length>width){let cut=rest.lastIndexOf(' ',width);if(cut<width/2)cut=width;lines.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}
  if(rest)lines.push(rest);return lines;
 });
}
export function caption(text:string,width:number,limit:number):string{const chunks=wrapLines(text,width);return chunks.length<=limit?chunks.join('\n'):chunks.slice(0,limit).join('\n').slice(0,-1)+'…';}
