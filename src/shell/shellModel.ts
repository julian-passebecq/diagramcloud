/** Model of the DiagramCloud shell (R875, R958): diagram files from diagrams/, their groups, pane sizes. No backend. */

/** The ribbon has only buttons that work. */
export const RIBBON_BUTTONS=[{id:'fit',label:'Zoom to fit'},{id:'raw',label:'Open raw file'}] as const;

export type DiagramFile={name:string;text:string;url:string};

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
