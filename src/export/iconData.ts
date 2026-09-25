import type {IconEntry} from '../core/icons';

/**
 * Exports are standalone files, so a registered vendor icon is embedded as a data URI of its exact, unmodified
 * file. The caller supplies the bytes: the browser fetches them from the app, the build and tests read public/.
 * Without a provider an export simply leaves the icon slot empty.
 */
export type IconData=(entry:IconEntry)=>string|undefined;
export const noIcons:IconData=()=>undefined;

const MIME:Record<string,string>={svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg'};
export function iconDataUri(file:string,bytes:Uint8Array):string{
 const ext=file.split('.').pop()!.toLowerCase(),mime=MIME[ext];if(!mime)throw new Error(`Unsupported icon file type: ${file}`);
 let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return `data:${mime};base64,${btoa(bin)}`;
}
/** Icon bytes from a map built ahead of a synchronous export. */
export function iconDataFrom(map:Map<string,string>):IconData{return e=>map.get(e.id);}

/** Browser: fetch each registered vendor file once from the app's own origin. */
export async function loadBrowserIcons(entries:IconEntry[],base:string):Promise<IconData>{
 const map=new Map<string,string>();
 for(const e of entries){if(!e.file||map.has(e.id))continue;try{const r=await fetch(base+e.file);if(r.ok)map.set(e.id,iconDataUri(e.file,new Uint8Array(await r.arrayBuffer())));}catch{/* The export still works; the slot stays empty. */}}
 return iconDataFrom(map);
}
