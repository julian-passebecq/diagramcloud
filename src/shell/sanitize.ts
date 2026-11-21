/** R970: what a shown diagram may keep. Nothing in it may fetch from outside the page or restyle the shell. */
import DOMPurify from 'dompurify';

/** An href stays only when it points inside the diagram (#id) or is an inline image (data:image/...). */
export const keepHref=(value:string)=>/^\s*(#|data:image\/)/i.test(value);

// The only url() shapes kept: url(#id) and url(data:image/<type>;base64,<base64>), each whole and well formed.
const INSIDE=/url\(\s*(['"]?)(#[\w.:-]*|data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]*)\1\s*\)/gi;
// Anything that could still load, import, escape or hide text once the kept shapes are set aside.
const REFUSED=/url\s*\(|image-set|image\s*\(|src\s*\(|@import|:host|\\|\/\*/i;

/** CSS (a <style> text or any attribute value) unchanged when safe, else null: refused whole, never rewritten. */
export const safeCss=(css:string):string|null=>REFUSED.test(css.replace(INSIDE,''))?null:css;

/** Rules that live inside the diagram's shadow root: the shell's sizing and its highlight. */
export const STAGE_CSS=':host{display:block}svg{display:block;max-width:none;box-shadow:0 1px 4px #0002}:host(.fit){width:100%;height:100%}:host(.fit) svg{width:100%;height:100%}.sh-hl{filter:drop-shadow(0 0 3px var(--sh-accent)) drop-shadow(0 0 6px var(--sh-accent))}';

let purify:ReturnType<typeof DOMPurify>|null=null;
/** A private DOMPurify instance with the hooks, so they never touch the studio's own sanitising. */
export function sanitizeSvg(text:string):string{
 if(!purify){
  purify=DOMPurify(window);
  purify.addHook('uponSanitizeAttribute',(_n,data)=>{
   const name=data.attrName.toLowerCase();
   if((name==='href'||name==='xlink:href')?!keepHref(data.attrValue):safeCss(data.attrValue)===null)data.keepAttr=false;
  });
  purify.addHook('uponSanitizeElement',(node)=>{
   if(node.nodeName.toLowerCase()==='style'&&safeCss(node.textContent??'')===null)node.textContent='';
  });
 }
 return purify.sanitize(text,{USE_PROFILES:{svg:true,svgFilters:true}}) as string;
}
