/**
 * Deterministic text measurement for exports, with no DOM and no font files. Widths are Arial's advance widths
 * (metric-compatible with Helvetica and Liberation Sans) in 1/1000 em for printable ASCII. SVG and PowerPoint
 * both draw node text in Arial with this module's line breaks, so a label wraps at the same word everywhere.
 */
const REGULAR=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const SPECIAL:Record<string,number>={'…':1000,'—':1000,'–':556,'→':1000,'←':1000,'↳':1000,'·':278,'•':350,'“':333,'”':333,'‘':222,'’':222,'€':556,'£':556,'°':400,'×':584,'±':584,'µ':556,'é':556,'è':556,'à':556,'ç':500,'ü':556,'ö':556,'ä':556,'ñ':556};

/** Advance width of one character in 1/1000 em. Unknown wide scripts count as a full em; other letters as an average glyph. */
function advance(ch:string,bold:boolean):number{
 const c=ch.codePointAt(0)!;
 if(c>=32&&c<=126)return (bold?BOLD:REGULAR)[c-32];
 if(SPECIAL[ch]!==undefined)return SPECIAL[ch];
 if(c>=0x2e80)return 1000;
 return bold?611:556;
}
export function textWidth(text:string,size:number,bold=false):number{
 let units=0;for(const ch of text)units+=advance(ch,bold);return units*size/1000;
}

export type TextStyle={size:number;bold?:boolean};
/**
 * Break text into lines no wider than `width`, at spaces when possible, and at characters for a word longer than a
 * line. Beyond `maxLines` the last kept line ends with an ellipsis that still fits.
 */
export function measureLines(text:string,width:number,style:TextStyle,maxLines=Infinity):{lines:string[];truncated:boolean}{
 const fits=(s:string)=>textWidth(s,style.size,style.bold)<=width;
 const words=text.replace(/\s+/g,' ').trim().split(' ').filter(Boolean),lines:string[]=[];let line='';
 const push=(l:string)=>{lines.push(l);};
 for(const word of words){
  const candidate=line?`${line} ${word}`:word;
  if(fits(candidate)){line=candidate;continue;}
  if(line)push(line);
  if(fits(word)){line=word;continue;}
  // A word wider than the line breaks after a slash or hyphen when it can, and by characters only as a last resort.
  let part='';
  for(const piece of word.split(/(?<=[/-])/)){
   if(fits(part+piece)){part+=piece;continue;}
   if(part)push(part);
   if(fits(piece)){part=piece;continue;}
   part='';for(const ch of piece){if(fits(part+ch))part+=ch;else{push(part);part=ch;}}
  }
  line=part;
 }
 if(line)push(line);
 if(lines.length<=maxLines)return {lines,truncated:false};
 const kept=lines.slice(0,maxLines);let last=kept[maxLines-1];
 while(last&&!fits(`${last}…`))last=last.slice(0,-1);
 kept[maxLines-1]=`${last.trimEnd()}…`;
 return {lines:kept,truncated:true};
}
