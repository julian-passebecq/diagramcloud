import {defaultStudioLayout,fitStudioLayout,validateStudioLayout,STUDIO_LAYOUT_BOUNDS,type StudioLayout} from './studioLayout';

/** Layout presets, never Explore/Edit permissions or an architecture model. All new fields are session-only. */
export const WORKBENCH_PRESETS=['explain','compare','present'] as const;
export const WORKBENCH_PANES=['primary','explorer','companion','dock'] as const;
export type WorkbenchPreset=typeof WORKBENCH_PRESETS[number];
export type WorkbenchPane=typeof WORKBENCH_PANES[number];
export type WorkbenchLayout={panels:StudioLayout;preset:WorkbenchPreset;companionPercent:number;dockHeight:number;dockCollapsed:boolean;compactPane:WorkbenchPane};
export type WorkbenchSlots={explorer:boolean;companion:boolean;dock:boolean;rail:boolean};
export function defaultWorkbenchLayout(panels:StudioLayout=defaultStudioLayout()):WorkbenchLayout{
 return {panels:validateStudioLayout(panels),preset:'explain',companionPercent:45,dockHeight:220,dockCollapsed:true,compactPane:'primary'};
}
export function validateWorkbenchLayout(input:unknown):WorkbenchLayout{
 const bad=()=>new Error('Invalid workbench layout');
 if(!input||typeof input!=='object'||Array.isArray(input))throw bad();
 const v=input as Record<string,unknown>,keys=['panels','preset','companionPercent','dockHeight','dockCollapsed','compactPane'];
 const bounded=(x:unknown,min:number,max:number)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=min&&x<=max;
 if(Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k))||!WORKBENCH_PRESETS.includes(v.preset as WorkbenchPreset)||!WORKBENCH_PANES.includes(v.compactPane as WorkbenchPane)||!bounded(v.companionPercent,30,70)||!bounded(v.dockHeight,140,360)||typeof v.dockCollapsed!=='boolean')throw bad();
 return {panels:validateStudioLayout(v.panels),preset:v.preset as WorkbenchPreset,companionPercent:v.companionPercent as number,dockHeight:v.dockHeight as number,dockCollapsed:v.dockCollapsed,compactPane:v.compactPane as WorkbenchPane};
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
 const rail=slots.rail&&!focus&&!compact,explorer=visible.explorer?legacy.sidebar:0;
 // Gaps, padding and the optional rail have a declared budget. The main canvas keeps at least 360px.
 const available=Math.max(0,width-explorer-(rail?48:0)-48),minimum=STUDIO_LAYOUT_BOUNDS.main;
 const requested=layout.preset==='compare'?Math.round(available*layout.companionPercent/100):(layout.panels.detailsWidth??360);
 const companion=visible.companion&&!compact?Math.min(Math.max(260,requested),Math.max(0,available-minimum)):0;
 const dock=visible.dock&&!compact?Math.min(layout.dockHeight,Math.max(0,height-320)):0;
 return {compact,active,visible,rail,explorer,companion,dock,primary:compact?width:available-companion};
}
