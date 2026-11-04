/** XML 1.0 text safety for every export writer (SVG, draw.io, PPTX parts). No imports, so any module can use it. */
/** Characters XML 1.0 forbids (C0 controls other than tab, LF and CR; U+FFFE, U+FFFF) and unpaired surrogates. */
const XML_INVALID=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
/** Text with every XML-forbidden character replaced by U+FFFD, so SVG, draw.io and PPTX parts stay well-formed. */
export const xmlChars=(value:string)=>value.replace(XML_INVALID,'\uFFFD');
/**
 * A copy of a plain JSON-like value with xmlChars applied to every string (the same reference when nothing changes),
 * for writers such as pptxgenjs that only escape &lt; &gt; &amp; and quotes.
 */
export function xmlSafe<T>(value:T):T{
 if(typeof value==='string')return xmlChars(value) as T;
 if(Array.isArray(value)){let changed=false;const out=value.map(v=>{const s=xmlSafe(v);if(s!==v)changed=true;return s;});return (changed?out:value) as T;}
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){let out:Record<string,unknown>|undefined;
  for(const [k,v] of Object.entries(value)){const s=xmlSafe(v);if(s!==v)(out??={...value as Record<string,unknown>})[k]=s;}return (out??value) as T;}
 return value;
}
