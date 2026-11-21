/** Model of the DiagramCloud shell (R875, R958, R964, R993, R998): diagram files from diagrams/, their groups, templates, pane sizes. */

/** The ribbon has only buttons that work. */
export const RIBBON_BUTTONS=[{id:'new',label:'New from template'},{id:'rename',label:'Rename group'},{id:'save',label:'Save as'},{id:'fit',label:'Zoom to fit'},{id:'raw',label:'Open raw file'},{id:'compare',label:'Compare A vs B'},{id:'copy',label:'Copy comparison'},{id:'present',label:'Present'}] as const;

/** Why a new diagram name is refused, or null when diagrams/<name>.svg may be created. */
export function checkNewName(name:string,existing:readonly string[]):string|null{
 if(!name)return 'Give the diagram a name.';
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(name))return `"${name}" is refused: use only letters, digits, dash and underscore (at most 64), no dots, slashes or spaces.`;
 // Windows reserves these device names in every folder (CON.svg opens the console, not a file).
 if(/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name))return `"${name}" is refused: Windows reserves that name for a device.`;
 // Case-insensitive: macOS and Windows folders treat a.svg and A.svg as one file.
 if(existing.some(n=>n.toLowerCase()===`${name}.svg`.toLowerCase()))return `diagrams/${name}.svg already exists: choose another name.`;
 return null;
}

/** Why a group title is refused, or null. */
export const checkGroupTitle=(title:string)=>!title.trim()?'A group title cannot be empty.':title.length>80?'A group title has at most 80 characters.':null;

/** The diagram's own <title>, used as the template's name in the menu. */
export const svgTitle=(text:string,fallback:string)=>/<title>([^<]+)<\/title>/.exec(text)?.[1].trim()||fallback;

export type DiagramFile={name:string;text:string;url:string;pageOnly?:boolean};

/** Turns a Vite glob map ('/diagrams/x.svg' -> text) into a sorted file list. */
export function diagramFiles(texts:Record<string,string>,urls:Record<string,string>):DiagramFile[]{
 return Object.keys(texts).map(path=>({name:path.split('/').pop()!,text:texts[path],url:urls[path]??path})).sort((a,b)=>a.name.localeCompare(b.name));
}

export const formatSize=(bytes:number)=>bytes<1024?`${bytes} B`:`${(bytes/1024).toFixed(1)} KB`;
export const byteSize=(text:string)=>new TextEncoder().encode(text).length;

/** Why a file cannot be shown, or null when it can. */
export function cannotShow(file:DiagramFile):string|null{
 if(!/\.svg$/i.test(file.name))return `${file.name} cannot be shown: only .svg files are drawn in the centre.`;
 if(!file.text.trim())return `${file.name} cannot be shown: the file is empty.`;
 if(!/<svg[\s>]/i.test(file.text))return `${file.name} cannot be shown: no <svg> element found.`;
 return null;
}

/** viewBox to add so Zoom to fit can scale an SVG that has none: from its own width and height (px or unitless), else null. */
export function missingViewBox(viewBox:string|null,width:string|null,height:string|null):string|null{
 if(viewBox?.trim())return null;
 const n=(v:string|null)=>{const m=/^\s*([\d.]+)\s*(px)?\s*$/.exec(v??'');const x=m?Number(m[1]):NaN;return x>0?x:null;};
 const w=n(width),h=n(height);
 return w&&h?`0 0 ${w} ${h}`:null;
}

/** Minimal element shape, so the group walk runs on a real DOM and in Node tests alike. */
export type El={tagName:string;getAttribute(name:string):string|null;children:ArrayLike<El>;textContent:string|null};
export type DiagramGroup={id:string;label:string;el:El};

const titleOf=(el:El)=>Array.from(el.children).find(c=>c.tagName.toLowerCase()==='title')?.textContent?.trim()||'';

/** Top-level named groups: a <g> with an id or a <title>, not inside another named group. */
export function diagramGroups(root:El):DiagramGroup[]{
 const out:DiagramGroup[]=[];
 const walk=(el:El)=>{for(const c of Array.from(el.children)){
  if(c.tagName.toLowerCase()!=='g'){continue;}
  const id=c.getAttribute('id')??'';const label=titleOf(c);
  if(id||label)out.push({id,label:label||id,el:c});else walk(c);
 }};
 walk(root);
 return out;
}

/** Pane sizes in pixels, kept inside sane bounds so a pane can never vanish or swallow the canvas. */
export type PaneSizes={left:number;right:number;bottom:number};
export const DEFAULT_SIZES:PaneSizes={left:240,right:220,bottom:140};
export const LIMITS:Record<keyof PaneSizes,[number,number]>={left:[140,480],right:[140,420],bottom:[60,400]};
export const clampSize=(pane:keyof PaneSizes,value:number)=>Math.min(LIMITS[pane][1],Math.max(LIMITS[pane][0],Math.round(value)));

/** R993: one named group in the union of option A and option B. a / b are its index in each side's group list, or null. */
export type CompareSide='A only'|'B only'|'both';
export type CompareRow={key:string;label:string;side:CompareSide;a:number|null;b:number|null};

/** Union of the named groups of A and B, matched by id (or by title when a group has no id), A's order first, then B's.
 *  A name used twice on one side pairs with the same occurrence on the other side, so nothing is counted twice. */
export function compareGroups(a:readonly {id:string;label:string}[],b:readonly {id:string;label:string}[]):CompareRow[]{
 const keys=(list:readonly {id:string;label:string}[])=>{const seen=new Map<string,number>();
  return list.map(g=>{const base=g.id?`#${g.id}`:`title:${g.label}`;const n=seen.get(base)??0;seen.set(base,n+1);return JSON.stringify([base,n]);});};
 const ka=keys(a),kb=keys(b);
 const inB=new Map(kb.map((k,i)=>[k,i]));const inA=new Set(ka);
 const rows:CompareRow[]=ka.map((key,i)=>{const j=inB.get(key);return {key,label:a[i].label,side:j===undefined?'A only':'both',a:i,b:j??null};});
 kb.forEach((key,j)=>{if(!inA.has(key))rows.push({key,label:b[j].label,side:'B only',a:null,b:j});});
 return rows;
}

/** R993: the short comparison written to Output and copied by Copy comparison. */
export function comparisonText(rows:readonly CompareRow[],a:{name:string;bytes:number},b:{name:string;bytes:number}):string[]{
 const list=(side:CompareSide)=>{const l=rows.filter(r=>r.side===side).map(r=>r.label);return `(${l.length}): ${l.length?l.join(', '):'none'}.`;};
 return [`Compare A = ${a.name} (${formatSize(a.bytes)}) with B = ${b.name} (${formatSize(b.bytes)}).`,
  `Only in A ${list('A only')}`,`Only in B ${list('B only')}`,`In both ${list('both')}`];
}

/** R998: the slides of a deck, in tree order: the picked files, or every file when none is picked. */
export function deckOrder(tree:readonly string[],picked:readonly string[]):string[]{
 const set=new Set(picked);
 return picked.length?tree.filter(n=>set.has(n)):[...tree];
}

/** R998: the slide after a step of delta, kept inside the deck (no wrap); -1 for an empty deck. */
export const deckStep=(index:number,count:number,delta:number)=>count<1?-1:Math.min(count-1,Math.max(0,index+delta));

/** R998: what a key does in Present: Right arrow or Space = next, Left arrow = previous, Escape = leave. */
export const deckKey=(key:string):'next'|'prev'|'exit'|null=>key==='ArrowRight'||key===' '||key==='Spacebar'?'next':key==='ArrowLeft'?'prev':key==='Escape'?'exit':null;

/** R998: the bottom pane's line for the shown slide. */
export const deckStatus=(index:number,count:number,name:string)=>`slide ${index+1} of ${count}: ${name}`;

/** R998: the SVG's own <title>: the root element's first child (after blanks and comments), never a group's title; '' when none. */
export function rootTitle(text:string):string{
 // Each alternative is unambiguous (a comment body can never contain "-->", a prolog never "?>"), so no backtracking blow-up.
 const m=/^(?:\s|<\?xml(?:[^?]|\?(?!>))*\?>|<!--(?:[^-]|-(?!->))*-->|<!DOCTYPE[^>]*>)*<svg(?:\s[^>]*)?>(?:\s|<!--(?:[^-]|-(?!->))*-->)*<title>([^<]*)<\/title>/i.exec(text);
 return m?.[1].trim().replace(/\s+/g,' ')??'';
}

/** R998: the deck outline copied as plain text: "n. file, title" per slide (just "n. file" without a title). */
export const deckOutline=(slides:readonly {name:string;title:string}[])=>slides.map((s,i)=>`${i+1}. ${s.name}${s.title?`, ${s.title}`:''}`).join('\n');
