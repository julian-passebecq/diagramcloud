import DOMPurify from 'dompurify';
import {assetSchema,newId,type Asset} from '../core/model';
export function download(data:Blob|string,filename:string,mime='text/plain'){const blob=typeof data==='string'?new Blob([data],{type:mime}):data;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function loadImage(url:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('The image could not be decoded'));i.src=url;});}
export async function pngFromSvg(svg:string):Promise<Blob>{const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const image=await loadImage(url),scale=Math.min(2,4096/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(image.width*scale);canvas.height=Math.ceil(image.height*scale);const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');context.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));}finally{URL.revokeObjectURL(url);}}
const MAX_IMAGE_INPUT_BYTES=8*1024*1024,MAX_ASSET_DATA_CHARS=Math.floor(2.8*1024*1024);
function encodedCanvas(image:HTMLImageElement):string{
 let scale=Math.min(1,2200/Math.max(image.width,image.height));
 for(let attempt=0;attempt<7;attempt++){
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');context.drawImage(image,0,0,canvas.width,canvas.height);
  const png=canvas.toDataURL('image/png');if(png.length<=MAX_ASSET_DATA_CHARS)return png;
  const webp=canvas.toDataURL('image/webp',.9);if(webp.startsWith('data:image/webp')&&webp.length<=MAX_ASSET_DATA_CHARS)return webp;
  scale*=.78;
 }
 throw new Error('Image remains too large after normalization. Crop it or use a simpler visual.');
}
/** Decode and re-encode uploads. SVG is sanitized, external references removed, then rasterized. */
export async function imageAsset(file:File):Promise<Asset>{
 if(file.size>MAX_IMAGE_INPUT_BYTES)throw new Error('Image imports are limited to 8 MiB. Resize larger screenshots first.');
 let blob:Blob=file;
 if(file.type==='image/svg+xml'||file.name.toLowerCase().endsWith('.svg')){
  const clean=DOMPurify.sanitize(await file.text(),{USE_PROFILES:{svg:true,svgFilters:false},FORBID_TAGS:['style','foreignObject','image','use','a','animate','animateMotion','animateTransform','set','script'],FORBID_ATTR:['style']});
  const parsed=new DOMParser().parseFromString(clean,'image/svg+xml');
  if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw new Error('Invalid SVG');
  parsed.querySelectorAll('*').forEach(el=>Array.from(el.attributes).forEach(a=>{if(/href$|^on/i.test(a.name)||/url\(/i.test(a.value)&&!/^url\(#[\w.-]+\)$/.test(a.value))el.removeAttribute(a.name);}));
  const root=parsed.documentElement;root.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const vb=(root.getAttribute('viewBox')??'').split(/[\s,]+/).map(Number);if(!root.hasAttribute('width'))root.setAttribute('width',String(vb.length===4&&vb[2]>0?vb[2]:800));if(!root.hasAttribute('height'))root.setAttribute('height',String(vb.length===4&&vb[3]>0?vb[3]:500));
  blob=new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'});
 }else if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose PNG, JPEG, WebP or SVG.');
 const url=URL.createObjectURL(blob);try{const image=await loadImage(url);if(!image.width||!image.height||image.width*image.height>40_000_000)throw new Error('Image dimensions are too large or invalid');return assetSchema.parse({id:newId('asset'),name:file.name.slice(0,160),data:encodedCanvas(image),rights:'User-supplied or generated image. Confirm publication rights before sharing.',visibility:'public'});}finally{URL.revokeObjectURL(url);}
}
