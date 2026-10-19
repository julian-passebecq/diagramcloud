/**
 * Which surface the App opens with. A per-host localStorage preference ('studio' or 'workspace'); the classic studio
 * stays the default for everyone and `?workspace=studio` always opens it (the legacy escape).
 * Precedence: ?workspace=studio > ?workspace=v3 > stored choice > 'studio'. A storage failure or a corrupt value
 * falls back to the studio silently. No Project fact is read or written.
 */
export type Surface='studio'|'workspace';
export const DEFAULT_SURFACE_KEY='diagramcloud.default-surface.v1';
export type DefaultSurfaceStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

/** The stored choice, or null when none, unreadable or corrupt. Reading never repairs or removes anything. */
export function readDefaultSurface(storage:DefaultSurfaceStorage|null):Surface|null{
 if(!storage)return null;
 try{const raw=storage.getItem(DEFAULT_SURFACE_KEY);return raw==='studio'||raw==='workspace'?raw:null;}catch{return null;}
}
/** Explicit choice only. Choosing the studio removes the record, so nothing is stored for a reader who never opted in. */
export function writeDefaultSurface(storage:DefaultSurfaceStorage|null,surface:Surface):boolean{
 if(!storage||(surface!=='studio'&&surface!=='workspace'))return false;
 try{if(surface==='studio')storage.removeItem(DEFAULT_SURFACE_KEY);else storage.setItem(DEFAULT_SURFACE_KEY,surface);return true;}catch{return false;}
}
export function resolveInitialSurface(search:string,storage:DefaultSurfaceStorage|null):Surface{
 let requested:string|null=null;
 try{requested=new URLSearchParams(search).get('workspace');}catch{requested=null;}
 if(requested==='studio')return 'studio';
 if(requested==='v3')return 'workspace';
 return readDefaultSurface(storage)??'studio';
}
