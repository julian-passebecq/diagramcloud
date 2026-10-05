/**
 * Minimal, non-validating XML reader for machine-written interchange files (draw.io). It runs the same in the browser
 * and in Node tests, never resolves external entities or DTDs, and keeps only elements, attributes and text.
 */
export type XmlElement={name:string;attrs:Record<string,string>;children:XmlElement[];text:string};

const ENTITY:Record<string,string>={lt:'<',gt:'>',amp:'&',quot:'"',apos:"'"};
export function decodeEntities(s:string):string{
 return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e:string)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):+e.slice(1)):ENTITY[e]??m);
}

export function parseXml(src:string):XmlElement{
 const root:XmlElement={name:'#document',attrs:{},children:[],text:''},stack=[root];let i=0;
 const attrRe=/([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
 while(i<src.length){
  const lt=src.indexOf('<',i);
  if(lt<0){stack[stack.length-1].text+=decodeEntities(src.slice(i));break;}
  if(lt>i)stack[stack.length-1].text+=decodeEntities(src.slice(i,lt));
  if(src.startsWith('<!--',lt)){const end=src.indexOf('-->',lt);i=end<0?src.length:end+3;continue;}
  if(src.startsWith('<![CDATA[',lt)){const end=src.indexOf(']]>',lt);stack[stack.length-1].text+=src.slice(lt+9,end<0?src.length:end);i=end<0?src.length:end+3;continue;}
  if(src.startsWith('<?',lt)||src.startsWith('<!',lt)){const end=src.indexOf('>',lt);i=end<0?src.length:end+1;continue;}
  // Find the end of the tag outside quoted attribute values.
  let j=lt+1,quote='';for(;j<src.length;j++){const ch=src[j];if(quote){if(ch===quote)quote='';}else if(ch==='"'||ch==="'")quote=ch;else if(ch==='>')break;}
  const body=src.slice(lt+1,j);i=j+1;
  if(body.startsWith('/')){const name=body.slice(1).trim();for(let k=stack.length-1;k>0;k--)if(stack[k].name===name){stack.length=k;break;}continue;}
  const selfClosing=body.endsWith('/'),inner=selfClosing?body.slice(0,-1):body,name=inner.match(/^[^\s/>]+/)?.[0]??'';
  const el:XmlElement={name,attrs:{},children:[],text:''};
  for(const m of inner.slice(name.length).matchAll(attrRe))el.attrs[m[1]]=decodeEntities(m[3]??m[4]??'');
  stack[stack.length-1].children.push(el);if(!selfClosing)stack.push(el);
 }
 return root;
}
export function* walk(el:XmlElement):Generator<XmlElement>{for(const c of el.children){yield c;yield* walk(c);}}
export function find(el:XmlElement,name:string):XmlElement|undefined{for(const c of walk(el))if(c.name===name)return c;return undefined;}
