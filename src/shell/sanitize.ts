/** R970: what a shown diagram may keep. Nothing in it may fetch from outside the page or restyle the shell. */
import DOMPurify from 'dompurify';

/** An href stays only when it points inside the diagram (#id) or is an inline image (data:image/...). */
export const keepHref=(value:string)=>/^\s*(#|data:image\/)/i.test(value);

/** CSS (a kept <style> or a style/presentation attribute) without outside url(), @import or :host rules. */
export function stripOutsideUrls(css:string):string{
 return css
  .replace(/@import[^;]*;?/gi,'')
  .replace(/:host(-context)?\b/gi,':not(*)')
  .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(all,_q,url:string)=>keepHref(url)?all:'url(#)')
  // Escaped or split spellings (u\72l(, image-set(...) without url) are refused whole.
  .replace(/\\|image-set\s*\(|image\s*\(/gi,'');
}

/** Rules that live inside the diagram's shadow root: the shell's sizing and its highlight. */
export const STAGE_CSS=':host{display:block}svg{display:block;max-width:none;box-shadow:0 1px 4px #0002}:host(.fit){width:100%;height:100%}:host(.fit) svg{width:100%;height:100%}.sh-hl{filter:drop-shadow(0 0 3px var(--sh-accent)) drop-shadow(0 0 6px var(--sh-accent))}';

let purify:ReturnType<typeof DOMPurify>|null=null;
/** A private DOMPurify instance with the hooks, so they never touch the studio's own sanitising. */
export function sanitizeSvg(text:string):string{
 if(!purify){
  purify=DOMPurify(window);
  purify.addHook('uponSanitizeAttribute',(_n,data)=>{
   const name=data.attrName.toLowerCase();
   if((name==='href'||name==='xlink:href')&&!keepHref(data.attrValue))data.keepAttr=false;
   else if(/url\(|@import|\\/i.test(data.attrValue))data.attrValue=stripOutsideUrls(data.attrValue);
  });
  purify.addHook('uponSanitizeElement',(node)=>{
   if(node.nodeName.toLowerCase()==='style'&&node.textContent)node.textContent=stripOutsideUrls(node.textContent);
  });
 }
 return purify.sanitize(text,{USE_PROFILES:{svg:true,svgFilters:true}}) as string;
}
