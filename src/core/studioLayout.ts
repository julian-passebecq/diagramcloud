/** Local UI preferences only: no Project facts or host actions. */
export type StudioLayout={sidebarSide:'left'|'right';sidebarWidth:number|null;detailsWidth:number|null;sidebarCollapsed:boolean;detailsCollapsed:boolean};
export const STUDIO_LAYOUT_BOUNDS={sidebar:{min:220,max:420},details:{min:260,max:480},main:360,wide:1200,maxWorkspace:2000} as const;
export function defaultStudioLayout():StudioLayout{return {sidebarSide:'left',sidebarWidth:null,detailsWidth:null,sidebarCollapsed:false,detailsCollapsed:false};}
export function studioLayoutScope(projectId:string,hostId:string){return JSON.stringify([hostId,projectId]);}
/** Strict finite values only; the error never echoes supplied values. */
export function validateStudioLayout(input:unknown):StudioLayout{
 const keys=['sidebarSide','sidebarWidth','detailsWidth','sidebarCollapsed','detailsCollapsed'];
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid workspace layout');
 const value=input as Record<string,unknown>,width=(name:string,min:number,max:number)=>value[name]===null||(typeof value[name]==='number'&&Number.isSafeInteger(value[name])&&(value[name] as number)>=min&&(value[name] as number)<=max);
 if(Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key))||!['left','right'].includes(value.sidebarSide as string)||typeof value.sidebarCollapsed!=='boolean'||typeof value.detailsCollapsed!=='boolean'||!width('sidebarWidth',220,420)||!width('detailsWidth',260,480))throw new Error('Invalid workspace layout');
 return {sidebarSide:value.sidebarSide as StudioLayout['sidebarSide'],sidebarWidth:value.sidebarWidth as number|null,detailsWidth:value.detailsWidth as number|null,sidebarCollapsed:value.sidebarCollapsed,detailsCollapsed:value.detailsCollapsed};
}
/** Requested desktop sizes survive compact layout. Effective clamping never changes them. */
export function fitStudioLayout(input:StudioLayout,containerWidth:number,detailsOpen:boolean){
 const layout=validateStudioLayout(input);
 if(!Number.isSafeInteger(containerWidth)||containerWidth<1)throw new Error('Invalid workspace width');
 const width=Math.min(containerWidth,STUDIO_LAYOUT_BOUNDS.maxWorkspace),desktop=width>STUDIO_LAYOUT_BOUNDS.wide;
 const detailsVisible=detailsOpen&&!layout.detailsCollapsed,sidebarVisible=!layout.sidebarCollapsed;
 let sidebar=layout.sidebarWidth??(detailsVisible?300:width>=1600?330:300),details=layout.detailsWidth??300;
 if(desktop){let excess=Math.max(0,(sidebarVisible?sidebar:0)+(detailsVisible?details:0)+STUDIO_LAYOUT_BOUNDS.main-width);
  if(sidebarVisible){const reduction=Math.min(excess,sidebar-STUDIO_LAYOUT_BOUNDS.sidebar.min);sidebar-=reduction;excess-=reduction;}
  if(detailsVisible){const reduction=Math.min(excess,details-STUDIO_LAYOUT_BOUNDS.details.min);details-=reduction;}
 }
 return {desktop,sidebar,details,sidebarVisible,detailsVisible};
}

/** Same guarded localStorage backend as presentation preferences; no new database or Project schema. */
export type StudioLayoutPreferenceStorage=Pick<Storage,'getItem'|'setItem'>;
export type StudioLayoutPlacement=Pick<StudioLayout,'sidebarSide'|'sidebarWidth'|'detailsWidth'>;
export type StudioLayoutPreferenceRead={layout:StudioLayout;status:'saved'|'missing'|'corrupt'|'unavailable';hasStoredValue:boolean};
export const STUDIO_LAYOUT_PREFERENCE_VERSION=1;
export const STUDIO_LAYOUT_PREFERENCE_MAX_CHARS=512;
export function studioLayoutPreferenceKey(projectId:string,hostId:string){return `diagramcloud.studio-layout.v1:${encodeURIComponent(studioLayoutScope(projectId,hostId))}`;}
/** Only requested physical choices: collapsed state and explanatory pointers never persist. */
export function studioLayoutPlacement(input:unknown):StudioLayoutPlacement{
 const value=validateStudioLayout(input);return {sidebarSide:value.sidebarSide,sidebarWidth:value.sidebarWidth,detailsWidth:value.detailsWidth};
}
/** Loading is read-only: malformed or future records remain untouched for an explicit human action. */
export function readStudioLayoutPreference(storage:StudioLayoutPreferenceStorage|null,projectId:string,hostId:string):StudioLayoutPreferenceRead{
 const fallback=(status:StudioLayoutPreferenceRead['status'],hasStoredValue=false):StudioLayoutPreferenceRead=>({layout:defaultStudioLayout(),status,hasStoredValue});
 if(!storage)return fallback('unavailable');
 let raw:string|null;try{raw=storage.getItem(studioLayoutPreferenceKey(projectId,hostId));}catch{return fallback('unavailable');}
 if(raw===null)return fallback('missing');
 if(typeof raw!=='string'||raw.length>STUDIO_LAYOUT_PREFERENCE_MAX_CHARS)return fallback('corrupt',true);
 try{
  const value:unknown=JSON.parse(raw),keys=['version','sidebarSide','sidebarWidth','detailsWidth'];
  if(!value||typeof value!=='object'||Array.isArray(value))return fallback('corrupt',true);
  const record=value as Record<string,unknown>;
  if(Object.keys(record).length!==keys.length||keys.some(key=>!Object.hasOwn(record,key))||record.version!==STUDIO_LAYOUT_PREFERENCE_VERSION)return fallback('corrupt',true);
  const layout=validateStudioLayout({...defaultStudioLayout(),sidebarSide:record.sidebarSide,sidebarWidth:record.sidebarWidth,detailsWidth:record.detailsWidth});
  return {layout,status:'saved',hasStoredValue:true};
 }catch{return fallback('corrupt',true);}
}
/** Explicit last-save-wins UI preference only; never a cross-tab compare-and-swap. */
export function writeStudioLayoutPreference(storage:StudioLayoutPreferenceStorage|null,projectId:string,hostId:string,input:unknown):boolean{
 if(!storage)return false;
 try{const placement=studioLayoutPlacement(input),raw=JSON.stringify({version:STUDIO_LAYOUT_PREFERENCE_VERSION,...placement});
  if(raw.length>STUDIO_LAYOUT_PREFERENCE_MAX_CHARS)return false;
  storage.setItem(studioLayoutPreferenceKey(projectId,hostId),raw);return true;
 }catch{return false;}
}

/**
 * Linked perspective layout (V3 workspace): the physical placement of the one detail slot and the split between the
 * two views. Its own key and record; the studio record above is unchanged. Semantic choices (views, anchor, pick)
 * never persist here: they live in the workspace route and the deep link.
 */
export type LinkedDetailPlacement='below-both'|'below-right';
export type LinkedLayout={detailPlacement:LinkedDetailPlacement;splitPercent:number};
export type LinkedLayoutPreferenceRead={layout:LinkedLayout;status:'saved'|'missing'|'corrupt'|'unavailable';hasStoredValue:boolean};
export const LINKED_LAYOUT_PREFERENCE_VERSION=1;
export const LINKED_LAYOUT_SPLIT={min:30,max:70} as const;
export function defaultLinkedLayout():LinkedLayout{return {detailPlacement:'below-both',splitPercent:50};}
export function validateLinkedLayout(input:unknown):LinkedLayout{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid linked layout');
 const value=input as Record<string,unknown>,keys=['detailPlacement','splitPercent'];
 if(Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key))||!['below-both','below-right'].includes(value.detailPlacement as string)||typeof value.splitPercent!=='number'||!Number.isSafeInteger(value.splitPercent)||value.splitPercent<LINKED_LAYOUT_SPLIT.min||value.splitPercent>LINKED_LAYOUT_SPLIT.max)throw new Error('Invalid linked layout');
 return {detailPlacement:value.detailPlacement as LinkedDetailPlacement,splitPercent:value.splitPercent};
}
export function linkedLayoutPreferenceKey(projectId:string,hostId:string){return `diagramcloud.linked-layout.v1:${encodeURIComponent(studioLayoutScope(projectId,hostId))}`;}
/** Read-only, like the studio record: a malformed or future record stays untouched. */
export function readLinkedLayoutPreference(storage:StudioLayoutPreferenceStorage|null,projectId:string,hostId:string):LinkedLayoutPreferenceRead{
 const fallback=(status:LinkedLayoutPreferenceRead['status'],hasStoredValue=false):LinkedLayoutPreferenceRead=>({layout:defaultLinkedLayout(),status,hasStoredValue});
 if(!storage)return fallback('unavailable');
 let raw:string|null;try{raw=storage.getItem(linkedLayoutPreferenceKey(projectId,hostId));}catch{return fallback('unavailable');}
 if(raw===null)return fallback('missing');
 if(typeof raw!=='string'||raw.length>STUDIO_LAYOUT_PREFERENCE_MAX_CHARS)return fallback('corrupt',true);
 try{
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))return fallback('corrupt',true);
  const record=value as Record<string,unknown>,keys=['version','detailPlacement','splitPercent'];
  if(Object.keys(record).length!==keys.length||keys.some(key=>!Object.hasOwn(record,key))||record.version!==LINKED_LAYOUT_PREFERENCE_VERSION)return fallback('corrupt',true);
  return {layout:validateLinkedLayout({detailPlacement:record.detailPlacement,splitPercent:record.splitPercent}),status:'saved',hasStoredValue:true};
 }catch{return fallback('corrupt',true);}
}
/** Explicit last-save-wins UI preference only. */
export function writeLinkedLayoutPreference(storage:StudioLayoutPreferenceStorage|null,projectId:string,hostId:string,input:unknown):boolean{
 if(!storage)return false;
 try{const layout=validateLinkedLayout(input),raw=JSON.stringify({version:LINKED_LAYOUT_PREFERENCE_VERSION,...layout});
  if(raw.length>STUDIO_LAYOUT_PREFERENCE_MAX_CHARS)return false;
  storage.setItem(linkedLayoutPreferenceKey(projectId,hostId),raw);return true;
 }catch{return false;}
}
