import * as React from 'react';
import {defaultWorkbenchLayout,fitWorkbenchLayout,selectWorkbenchPane,setWorkbenchPreset,validateWorkbenchLayout,type WorkbenchLayout,type WorkbenchPane,type WorkbenchPreset} from '../core/workbenchLayout';
import {WorkspaceArrangements} from './WorkspaceArrangements';
import {arrangementScopeKey,type ArrangementScope,type ArrangementStorage} from '../core/workspaceArrangements';

export type WorkbenchFrameProps={
 id:string;title:string;scopeCaption?:string;layout:WorkbenchLayout;width:number;height:number;
 onLayoutChange:(layout:WorkbenchLayout)=>void;
 /** Exact host/project/audience preference scope; absent for embedded shells that do not offer persistence. */
 arrangementScope?:ArrangementScope;arrangementStorage?:()=>ArrangementStorage|null;
 primary:React.ReactNode;explorer?:React.ReactNode;companion?:React.ReactNode;
 navigationMap?:React.ReactNode;activity?:React.ReactNode;rail?:React.ReactNode;
 primaryTitle?:string;companionTitle?:string;activityTitle?:string;
 controls?:React.ReactNode;status?:React.ReactNode;
  orientation?:React.ReactNode;
 /** Host choices shown inside the Layout details (for example the default surface); never layout state of this frame. */
 layoutExtras?:React.ReactNode;
};
const present=(slot:React.ReactNode)=>slot!==undefined&&slot!==null&&slot!==false;

/**
 * Controlled WEB shell, not another viewer or document store. The host supplies existing Canvas,
 * Navigator, ProjectContext/VariantCompare, hierarchy and evidence components. Hiding/resizing a
 * region does not unmount it. The host must still feed every slot its current permitted projection,
 * invalidate private pins and bind async callbacks to its current project/audience epoch.
 *
 * Presets affect physical layout only. "Present" never publishes or changes an Edit capability.
 * Direct separator resizing keeps keyboard range controls. No floating panes or cross-device synchronization.
 */
export class WorkbenchFrame extends React.Component<WorkbenchFrameProps>{
 private drag:{pointerId:number;kind:'explorer'|'companion'|'dock';x:number;y:number;layout:WorkbenchLayout;scope:string;available:number}|null=null;
 private scope=()=>this.props.arrangementScope?arrangementScopeKey(this.props.arrangementScope):this.props.id;
 private root:HTMLDivElement|null=null;
 private positionLayout=()=>{
  const details=this.root?.querySelector<HTMLDetailsElement>('details.wb-layout');const panel=details?.querySelector<HTMLElement>('.wb-layout-fields');if(!details?.open||!panel)return;
  if(this.root?.dataset.compact==='true'){const bottom=details.getBoundingClientRect().bottom;panel.style.top=`${bottom+4}px`;panel.style.maxHeight=`${Math.max(100,(details.ownerDocument.defaultView?.innerHeight??844)-bottom-16)}px`;}
  else{panel.style.removeProperty('top');panel.style.removeProperty('max-height');}
 };
 private closeLayout=(element:HTMLElement)=>{const details=element.closest('details.wb-layout') as HTMLDetailsElement|null;if(details){details.open=false;details.querySelector<HTMLElement>('summary')?.focus();}};
 componentDidUpdate(){
  this.positionLayout();
  if(this.drag&&this.drag.scope!==this.scope())this.drag=null;
  const root=this.root,active=root?.ownerDocument.activeElement as HTMLElement|null;
  // A collapsed or compact-hidden region must not retain invisible keyboard focus.
  if(root&&active&&root.contains(active)&&active.getClientRects().length===0){
   root.querySelector<HTMLElement>('[data-wb-recovery]')?.focus();
  }
 }
 private cycle=(event:React.KeyboardEvent<HTMLDivElement>)=>{
  if(event.key!=='F6'||event.altKey||event.ctrlKey||event.metaKey||!this.root)return;
  const target=event.target as HTMLElement;if(target.closest('[role="dialog"]'))return;
  const regions=Array.from(this.root.querySelectorAll<HTMLElement>('[data-wb-region]')).filter(el=>el.getClientRects().length>0);
  if(!regions.length)return;
  const at=regions.findIndex(el=>el.contains(target)),next=at<0?(event.shiftKey?regions.length-1:0):(at+(event.shiftKey?-1:1)+regions.length)%regions.length;
  event.preventDefault();regions[next].focus();
 };
 private resize=(kind:'explorer'|'companion'|'dock',value:number,base=this.props.layout)=>{
  const layout=validateWorkbenchLayout(base),round=(min:number,max:number)=>Math.round(Math.max(min,Math.min(max,value)));
  const next=kind==='dock'?{...layout,dockHeight:round(140,360)}:kind==='explorer'?{...layout,panels:{...layout.panels,sidebarWidth:round(220,420)}}:layout.preset==='compare'?{...layout,companionPercent:round(30,70)}:{...layout,panels:{...layout.panels,detailsWidth:round(260,480)}};
  this.props.onLayoutChange(validateWorkbenchLayout(next));
 };
 private resizeKey=(event:React.KeyboardEvent<HTMLElement>,kind:'explorer'|'companion'|'dock')=>{
  const layout=validateWorkbenchLayout(this.props.layout),compare=kind==='companion'&&layout.preset==='compare',value=kind==='dock'?layout.dockHeight:kind==='explorer'?layout.panels.sidebarWidth??300:compare?layout.companionPercent:layout.panels.detailsWidth??360;
  const min=kind==='dock'?140:kind==='explorer'?220:compare?30:260,max=kind==='dock'?360:kind==='explorer'?420:compare?70:480;
  if(event.key==='Escape'&&this.drag){event.preventDefault();const drag=this.drag;this.drag=null;if(drag.scope===this.scope())this.props.onLayoutChange(drag.layout);return;}
  const positive=kind==='dock'?'ArrowUp':(kind==='explorer')===(layout.panels.sidebarSide==='left')?'ArrowRight':'ArrowLeft',negative=kind==='dock'?'ArrowDown':positive==='ArrowRight'?'ArrowLeft':'ArrowRight';
  if(![positive,negative,'Home','End'].includes(event.key))return;event.preventDefault();this.resize(kind,event.key==='Home'?min:event.key==='End'?max:value+(event.key===positive?1:-1)*(compare?1:10));
 };
 private beginResize=(event:React.PointerEvent<HTMLElement>,kind:'explorer'|'companion'|'dock',available:number)=>{
  if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
  this.drag={pointerId:event.pointerId,kind,x:event.clientX,y:event.clientY,layout:validateWorkbenchLayout(this.props.layout),scope:this.scope(),available};
 };
 private moveResize=(event:React.PointerEvent<HTMLElement>)=>{
  const drag=this.drag;if(!drag||drag.pointerId!==event.pointerId||drag.scope!==this.scope())return;
  const layout=drag.layout,kind=drag.kind,compare=kind==='companion'&&layout.preset==='compare',sign=(kind==='explorer')===(layout.panels.sidebarSide==='left')?1:-1;
  const delta=kind==='dock'?drag.y-event.clientY:(event.clientX-drag.x)*sign;
  const value=kind==='dock'?layout.dockHeight:kind==='explorer'?layout.panels.sidebarWidth??300:compare?layout.companionPercent:layout.panels.detailsWidth??360;
  this.resize(kind,value+(compare?delta/Math.max(1,drag.available)*100:delta),layout);
 };
 render(){
  const p=this.props;if(!/^[a-z][a-z0-9_-]{0,60}$/.test(p.id))throw Error('Invalid workbench instance ID');
  const layout=validateWorkbenchLayout(p.layout),slots={explorer:present(p.explorer),companion:present(p.companion),dock:present(p.navigationMap)||present(p.activity),rail:present(p.rail)};
  const fit=fitWorkbenchLayout(layout,p.width,p.height,slots),id=(name:string)=>`${p.id}-${name}`;
  const change=(next:WorkbenchLayout)=>p.onLayoutChange(validateWorkbenchLayout(next));
  const pane=(name:WorkbenchPane)=>change(selectWorkbenchPane(layout,name));
  const toggle=(name:WorkbenchPane)=>{
   if(name==='dock')change({...layout,dockCollapsed:!layout.dockCollapsed});
   else if(name==='explorer')change({...layout,panels:{...layout.panels,sidebarCollapsed:!layout.panels.sidebarCollapsed}});
   else if(name==='companion')change({...layout,panels:{...layout.panels,detailsCollapsed:!layout.panels.detailsCollapsed}});
  };
  const css={'--wb-explorer':`${fit.explorer}px`,'--wb-companion':`${fit.companion}px`,'--wb-rail':fit.rail?'48px':'0px','--wb-dock':`${fit.dock}px`} as React.CSSProperties;
  const scope=this.scope();
  const resizeHandle=(kind:'explorer'|'companion'|'dock')=>{const compare=kind==='companion'&&layout.preset==='compare',value=kind==='dock'?layout.dockHeight:kind==='explorer'?layout.panels.sidebarWidth??300:compare?layout.companionPercent:layout.panels.detailsWidth??360;return <div key={kind} className={`wb-resize wb-resize-${kind}`} role="separator" tabIndex={0} aria-label={`Resize ${kind==='dock'?'bottom panel':kind}`} aria-orientation={kind==='dock'?'horizontal':'vertical'} aria-controls={id(kind)} aria-valuemin={kind==='dock'?140:kind==='explorer'?220:compare?30:260} aria-valuemax={kind==='dock'?360:kind==='explorer'?420:compare?70:480} aria-valuenow={value} aria-valuetext={`${value}${compare?' percent':' pixels'} requested`} onKeyDown={event=>this.resizeKey(event,kind)} onPointerDown={event=>this.beginResize(event,kind,fit.primary+fit.companion)} onPointerMove={this.moveResize} onPointerUp={()=>{this.drag=null;}} onPointerCancel={()=>{const drag=this.drag;this.drag=null;if(drag&&drag.scope===this.scope())change(drag.layout);}} onLostPointerCapture={()=>{this.drag=null;}}/>;};
  const region=(name:WorkbenchPane)=>({id:id(name),tabIndex:-1,'data-wb-region':name,hidden:!fit.visible[name]});
  return <div ref={el=>{this.root=el;}} className="workbench-frame" data-preset={layout.preset} data-compact={String(fit.compact)} data-side={layout.panels.sidebarSide} style={css} onKeyDownCapture={this.cycle}>
   <header className="wb-header">
    <div className="wb-heading"><h1>{p.title}</h1>{p.scopeCaption&&<span>{p.scopeCaption}</span>}</div>
    <div className="wb-controls" aria-label="Workspace controls">
     <label>Workspace <select className="wb-native" data-wb-recovery aria-label="Workspace layout preset" value={layout.preset} onChange={e=>change(setWorkbenchPreset(layout,e.target.value as WorkbenchPreset))}>
      <option value="explain">Explain</option><option value="compare">Compare</option><option value="present">Present focus</option>
     </select></label>
     {!fit.compact&&layout.preset!=='present'&&<span className="wb-controls">
      {slots.explorer&&<button className="wb-native" type="button" aria-controls={id('explorer')} aria-expanded={!layout.panels.sidebarCollapsed} onClick={()=>toggle('explorer')}>Explorer</button>}
      {slots.companion&&<button className="wb-native" type="button" aria-controls={id('companion')} aria-expanded={!layout.panels.detailsCollapsed} onClick={()=>toggle('companion')}>Companion</button>}
      {slots.dock&&<button className="wb-native" type="button" aria-controls={id('dock')} aria-expanded={!layout.dockCollapsed} onClick={()=>toggle('dock')}>Bottom panel</button>}
      {present(p.rail)&&<button className="wb-native" type="button" aria-controls={id('rail')} aria-expanded={!layout.railCollapsed} onClick={()=>change({...layout,railCollapsed:!layout.railCollapsed})}>Route bar</button>}
     </span>}
     <details className="wb-layout" onToggle={this.positionLayout} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.closeLayout(event.currentTarget);}}}><summary className="wb-native">Layout</summary><div className="wb-layout-fields">
      <button type="button" className="wb-native wb-close-layout" onClick={event=>this.closeLayout(event.currentTarget)}>Close layout settings</button>
      <label>Explorer side <select className="wb-native" aria-label="Explorer side" value={layout.panels.sidebarSide} onChange={e=>change({...layout,panels:{...layout.panels,sidebarSide:e.target.value as 'left'|'right'}})}><option value="left">Left</option><option value="right">Right</option></select></label>
      <label>Explorer width <input className="wb-native" aria-label="Requested desktop explorer width" type="range" min={220} max={420} step={10} value={layout.panels.sidebarWidth??300} onChange={e=>change({...layout,panels:{...layout.panels,sidebarWidth:Number(e.target.value)}})}/></label>
      <label>Companion width <input className="wb-native" aria-label="Requested desktop companion width" type="range" min={260} max={480} step={10} value={layout.panels.detailsWidth??360} onChange={e=>change({...layout,panels:{...layout.panels,detailsWidth:Number(e.target.value)}})}/></label>
      <label>Compare split <input className="wb-native" aria-label="Requested desktop comparison percentage" type="range" min={30} max={70} step={5} value={layout.companionPercent} onChange={e=>change({...layout,companionPercent:Number(e.target.value)})}/></label>
      <label>Bottom height <input className="wb-native" aria-label="Requested desktop bottom height" type="range" min={140} max={360} step={10} value={layout.dockHeight} onChange={e=>change({...layout,dockHeight:Number(e.target.value)})}/></label>
      <p>Physical layout only; save a named arrangement to restore it later. Compact screens show one pane at a time. These sizes are desktop requests, not current measured dimensions.</p>
      <button className="wb-native" type="button" onClick={()=>change(defaultWorkbenchLayout())}>Reset session layout</button>
      {p.arrangementScope&&<WorkspaceArrangements key={scope} scope={p.arrangementScope} layout={layout} storage={p.arrangementStorage} isCurrent={()=>this.scope()===scope} onRestore={next=>{if(this.scope()===scope)change(next);}}/>}
      {p.layoutExtras}
     </div></details>
     {p.controls}
    </div>
    {fit.compact&&layout.preset!=='present'&&<nav className="wb-compact-nav" aria-label="Workspace panes">
     {(['primary','explorer','companion','dock'] as WorkbenchPane[]).filter(name=>name==='primary'||name==='dock'?name==='primary'||slots.dock:slots[name]).map(name=><button className="wb-native" key={name} type="button" aria-controls={id(name)} aria-pressed={fit.active===name} onClick={()=>pane(name)}>{name==='primary'?'View':name==='dock'?'Map / activity':name==='companion'?'Explanation / compare':'Explorer'}</button>)}
    </nav>}
   </header>
   <div className="wb-body" hidden={fit.compact&&fit.active==='dock'}>
    <aside {...region('explorer')} className="wb-explorer wb-region" aria-label="Explorer"><h2>Explorer</h2>{p.explorer}</aside>
    <section {...region('primary')} className="wb-primary wb-region" aria-label={p.primaryTitle??'Architecture view'}><h2>{p.primaryTitle??'Architecture view'}</h2>{p.orientation}{p.primary}</section>
    <aside {...region('companion')} className="wb-companion wb-region" aria-label={p.companionTitle??'Context and explanation'}><h2>{p.companionTitle??'Context and explanation'}</h2>{p.companion}</aside>
    {!fit.compact&&fit.visible.explorer&&resizeHandle('explorer')}
    {!fit.compact&&fit.visible.companion&&resizeHandle('companion')}
    <nav id={id('rail')} className="wb-rail wb-region" hidden={!fit.rail} aria-label="Semantic navigation" data-wb-region="rail" tabIndex={-1}>{p.rail}</nav>
   </div>
   <section {...region('dock')} className="wb-bottom wb-region" aria-label="Navigation map and contextual activity">
    <div className="wb-dock-content" data-map={String(present(p.navigationMap))} data-map-collapsed={String(layout.mapCollapsed)} data-activity={String(present(p.activity))}>
     <section className="wb-map" hidden={!present(p.navigationMap)} aria-label="Navigation map"><button type="button" className="wb-native wb-map-toggle" aria-expanded={!layout.mapCollapsed} aria-controls={id('route-map')} onClick={()=>change({...layout,mapCollapsed:!layout.mapCollapsed})}>{layout.mapCollapsed?'Route ▸':'Route ▾'}</button><div id={id('route-map')} hidden={layout.mapCollapsed}>{p.navigationMap}</div></section>
     <section className="wb-activity" hidden={!present(p.activity)} aria-label={p.activityTitle??'Contextual activity'}><h2>{p.activityTitle??'Contextual activity'}</h2>{p.activity}</section>
    </div>
   </section>
   {!fit.compact&&fit.visible.dock&&resizeHandle('dock')}
   <footer className="wb-status">{p.status??'Layout only. Source, evidence and permissions remain owned by the host.'}</footer>
  </div>;
 }
}
