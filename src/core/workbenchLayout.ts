import {defaultStudioLayout,fitStudioLayout,validateStudioLayout,STUDIO_LAYOUT_BOUNDS,type StudioLayout} from './studioLayout';

/** Layout presets, never Explore/Edit permissions or an architecture model. Physical requests only; named arrangements persist explicitly outside the Project. */
export const WORKBENCH_PRESETS=['explain','compare','present'] as const;
export const WORKBENCH_PANES=['primary','explorer','companion','dock'] as const;
export type WorkbenchPreset=typeof WORKBENCH_PRESETS[number];
export type WorkbenchPane=typeof WORKBENCH_PANES[number];
export const FLOATING_PANES=['explorer','companion','dock'] as const;
export type FloatingPane=typeof FLOATING_PANES[number];
/** Pane chrome density only (padding, tab rows, dock headers); never content, zoom, route or permission. */
export const WORKBENCH_DENSITIES=['comfortable','compact'] as const;
export type WorkbenchDensity=typeof WORKBENCH_DENSITIES[number];
export type FloatingRect={x:number;y:number;width:number;height:number};
export type WorkbenchLayout={floating:Record<FloatingPane,FloatingRect|null>;panels:StudioLayout;preset:WorkbenchPreset;density:WorkbenchDensity;companionPercent:number;dockHeight:number;dockCollapsed:boolean;compactPane:WorkbenchPane;railCollapsed:boolean;mapCollapsed:boolean};
export type WorkbenchSlots={explorer:boolean;companion:boolean;dock:boolean;rail:boolean};
export function defaultWorkbenchLayout(panels:StudioLayout=defaultStudioLayout()):WorkbenchLayout{
 return {floating:{explorer:null,companion:null,dock:null},panels:validateStudioLayout(panels),preset:'explain',density:'comfortable',companionPercent:45,dockHeight:220,dockCollapsed:true,compactPane:'primary',railCollapsed:false,mapCollapsed:false};
}
export function validateWorkbenchLayout(input:unknown):WorkbenchLayout{
 const bad=()=>new Error('Invalid workbench layout');
 if(!input||typeof input!=='object'||Array.isArray(input))throw bad();
 const v=input as Record<string,unknown>,keys=['panels','preset','companionPercent','dockHeight','dockCollapsed','compactPane'];
 const bounded=(x:unknown,min:number,max:number)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=min&&x<=max;
 if(Object.keys(v).some(k=>!keys.includes(k)&&k!=='railCollapsed'&&k!=='mapCollapsed'&&k!=='floating'&&k!=='density')||(Object.hasOwn(v,'density')&&!WORKBENCH_DENSITIES.includes(v.density as WorkbenchDensity))||['railCollapsed','mapCollapsed'].some(k=>Object.hasOwn(v,k)&&typeof v[k]!=='boolean')||keys.some(k=>!Object.hasOwn(v,k))||!WORKBENCH_PRESETS.includes(v.preset as WorkbenchPreset)||!WORKBENCH_PANES.includes(v.compactPane as WorkbenchPane)||!bounded(v.companionPercent,30,70)||!bounded(v.dockHeight,140,360)||typeof v.dockCollapsed!=='boolean')throw bad();
 return {floating:validateFloating(v.floating,Object.hasOwn(v,'floating')),panels:validateStudioLayout(v.panels),preset:v.preset as WorkbenchPreset,density:Object.hasOwn(v,'density')?v.density as WorkbenchDensity:'comfortable',companionPercent:v.companionPercent as number,dockHeight:v.dockHeight as number,dockCollapsed:v.dockCollapsed,compactPane:v.compactPane as WorkbenchPane,railCollapsed:v.railCollapsed===true,mapCollapsed:v.mapCollapsed===true};
}
/** Present is a reversible visibility preset. It never clears the reader's previous panel choices. */
export function setWorkbenchPreset(input:WorkbenchLayout,preset:WorkbenchPreset):WorkbenchLayout{
 return validateWorkbenchLayout({...validateWorkbenchLayout(input),preset});
}
export function selectWorkbenchPane(input:WorkbenchLayout,pane:WorkbenchPane):WorkbenchLayout{
 const layout=validateWorkbenchLayout(input);
 return validateWorkbenchLayout({...layout,compactPane:pane,panels:{...layout.panels,...(pane==='explorer'?{sidebarCollapsed:false}:pane==='companion'?{detailsCollapsed:false}:{})},dockCollapsed:pane==='dock'?false:layout.dockCollapsed});
}
/** Finite measured viewport, not window globals. Missing slots never leave an empty column or compact pane. */
export function fitWorkbenchLayout(input:WorkbenchLayout,width:number,height:number,slots:WorkbenchSlots){
 const layout=validateWorkbenchLayout(input);
 if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1)throw Error('Invalid workbench viewport');
 const legacy=fitStudioLayout(layout.panels,width,slots.companion),compact=!legacy.desktop||height<540,focus=layout.preset==='present';
 const allowed={primary:true,explorer:slots.explorer&&!focus&&!layout.panels.sidebarCollapsed,companion:slots.companion&&!focus&&!layout.panels.detailsCollapsed,dock:slots.dock&&!focus&&!layout.dockCollapsed};
 const active:WorkbenchPane=allowed[layout.compactPane]?layout.compactPane:'primary';
 const visible=Object.fromEntries(WORKBENCH_PANES.map(p=>[p,allowed[p]&&(!compact||p===active)])) as Record<WorkbenchPane,boolean>;
 const rail=slots.rail&&!layout.railCollapsed&&!focus&&!compact,explorer=visible.explorer&&!(layout.floating.explorer&&!compact)?legacy.sidebar:0;
 // Gaps, padding and the optional rail have a declared budget. The main canvas keeps at least 360px.
 const available=Math.max(0,width-explorer-(rail?48:0)-48),minimum=STUDIO_LAYOUT_BOUNDS.main;
 const requested=layout.preset==='compare'?Math.round(available*layout.companionPercent/100):(layout.panels.detailsWidth??360);
 // A floating pane releases its docked track; compact and Present suspend floating without clearing the request.
 const floating={explorer:visible.explorer&&!compact&&!!layout.floating.explorer,companion:visible.companion&&!compact&&!!layout.floating.companion,dock:visible.dock&&!compact&&!!layout.floating.dock};
 const companion=visible.companion&&!compact&&!floating.companion?Math.min(Math.max(260,requested),Math.max(0,available-minimum)):0;
 const dock=visible.dock&&!compact&&!floating.dock?Math.min(layout.dockHeight,Math.max(0,height-320)):0;
 return {floating,compact,active,visible,rail,explorer,companion,dock,primary:compact?width:available-companion};
}

/** Records written before 1.34 have exactly companion and dock; explorer then normalises to null in memory only. */
function validateFloating(input:unknown,present:boolean):WorkbenchLayout['floating']{
 if(!present)return {explorer:null,companion:null,dock:null};
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid floating layout');
 const v=input as Record<string,unknown>,keys=Object.keys(v);
 if(!(keys.length===2||(keys.length===3&&Object.hasOwn(v,'explorer')))||!Object.hasOwn(v,'companion')||!Object.hasOwn(v,'dock'))throw Error('Invalid floating layout');
 const rect=(value:unknown):FloatingRect|null=>{
  if(value===null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid floating rectangle');
  const r=value as Record<string,unknown>,keys=['x','y','width','height'];
  if(Object.keys(r).length!==4||keys.some(k=>!Object.hasOwn(r,k)||!Number.isSafeInteger(r[k])||(r[k] as number)<(k==='x'||k==='y'?0:120)||(r[k] as number)>(k==='x'||k==='y'?8192:2000)))throw Error('Invalid floating rectangle');
  return {x:r.x as number,y:r.y as number,width:r.width as number,height:r.height as number};
 };
 return {explorer:Object.hasOwn(v,'explorer')?rect(v.explorer):null,companion:rect(v.companion),dock:rect(v.dock)};
}
export const FLOATING_MIN_WIDTH:Record<FloatingPane,number>={explorer:220,companion:260,dock:320};
/** Clamp presentation to measured space without rewriting a saved desktop request. */
export function fitFloatingRect(rect:FloatingRect,width:number,height:number,pane:FloatingPane):FloatingRect{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('Invalid floating viewport');
 const w=Math.max(1,Math.floor(width)),h=Math.max(1,Math.floor(height));
 const rw=Math.min(w,Math.max(FLOATING_MIN_WIDTH[pane],Math.min(2000,Math.round(rect.width)))),rh=Math.min(h,Math.max(180,Math.min(2000,Math.round(rect.height))));
 return {x:Math.max(0,Math.min(8192,w-rw,Math.round(rect.x))),y:Math.max(0,Math.min(8192,h-rh,Math.round(rect.y))),width:rw,height:rh};
}
