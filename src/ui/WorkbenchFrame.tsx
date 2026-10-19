import * as React from 'react';
import {defaultWorkbenchLayout,fitWorkbenchLayout,selectWorkbenchPane,setWorkbenchPreset,validateWorkbenchLayout,type WorkbenchLayout,type WorkbenchPane,type WorkbenchPreset} from '../core/workbenchLayout';
import './workbenchFrame.css';

export type WorkbenchFrameProps={
 id:string;title:string;scopeCaption?:string;layout:WorkbenchLayout;width:number;height:number;
 onLayoutChange:(layout:WorkbenchLayout)=>void;
 primary:React.ReactNode;explorer?:React.ReactNode;companion?:React.ReactNode;
 navigationMap?:React.ReactNode;activity?:React.ReactNode;rail?:React.ReactNode;
 primaryTitle?:string;companionTitle?:string;activityTitle?:string;
 controls?:React.ReactNode;status?:React.ReactNode;
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
 * This slice has native keyboard width controls, not free drag docking or cross-device preferences.
 */
export class WorkbenchFrame extends React.Component<WorkbenchFrameProps>{
 private root:HTMLDivElement|null=null;
 componentDidUpdate(){
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
  const region=(name:WorkbenchPane)=>({id:id(name),tabIndex:-1,'data-wb-region':name,hidden:!fit.visible[name]});
  return <div ref={el=>{this.root=el;}} className="workbench-frame" data-preset={layout.preset} data-compact={String(fit.compact)} data-side={layout.panels.sidebarSide} style={css} onKeyDownCapture={this.cycle}>
   <header className="wb-header">
    <div className="wb-heading"><strong>{p.title}</strong>{p.scopeCaption&&<span>{p.scopeCaption}</span>}</div>
    <div className="wb-controls" aria-label="Workspace controls">
     <label>Workspace <select className="wb-native" data-wb-recovery aria-label="Workspace layout preset" value={layout.preset} onChange={e=>change(setWorkbenchPreset(layout,e.target.value as WorkbenchPreset))}>
      <option value="explain">Explain</option><option value="compare">Compare</option><option value="present">Present focus</option>
     </select></label>
     {!fit.compact&&layout.preset!=='present'&&<span className="wb-controls">
      {slots.explorer&&<button className="wb-native" type="button" aria-controls={id('explorer')} aria-expanded={!layout.panels.sidebarCollapsed} onClick={()=>toggle('explorer')}>Explorer</button>}
      {slots.companion&&<button className="wb-native" type="button" aria-controls={id('companion')} aria-expanded={!layout.panels.detailsCollapsed} onClick={()=>toggle('companion')}>Companion</button>}
      {slots.dock&&<button className="wb-native" type="button" aria-controls={id('dock')} aria-expanded={!layout.dockCollapsed} onClick={()=>toggle('dock')}>Bottom panel</button>}
     </span>}
     <details className="wb-layout"><summary className="wb-native">Layout</summary><div className="wb-layout-fields">
      <label>Explorer side <select className="wb-native" aria-label="Explorer side" value={layout.panels.sidebarSide} onChange={e=>change({...layout,panels:{...layout.panels,sidebarSide:e.target.value as 'left'|'right'}})}><option value="left">Left</option><option value="right">Right</option></select></label>
      <label>Explorer width <input className="wb-native" aria-label="Requested desktop explorer width" type="range" min={220} max={420} step={10} value={layout.panels.sidebarWidth??300} onChange={e=>change({...layout,panels:{...layout.panels,sidebarWidth:Number(e.target.value)}})}/></label>
      <label>Companion width <input className="wb-native" aria-label="Requested desktop companion width" type="range" min={260} max={480} step={10} value={layout.panels.detailsWidth??360} onChange={e=>change({...layout,panels:{...layout.panels,detailsWidth:Number(e.target.value)}})}/></label>
      <label>Compare split <input className="wb-native" aria-label="Requested desktop comparison percentage" type="range" min={30} max={70} step={5} value={layout.companionPercent} onChange={e=>change({...layout,companionPercent:Number(e.target.value)})}/></label>
      <label>Bottom height <input className="wb-native" aria-label="Requested desktop bottom height" type="range" min={140} max={360} step={10} value={layout.dockHeight} onChange={e=>change({...layout,dockHeight:Number(e.target.value)})}/></label>
      <p>Session-only layout. Compact screens show one pane at a time. These sizes are desktop requests, not current measured dimensions.</p>
      <button className="wb-native" type="button" onClick={()=>change(defaultWorkbenchLayout())}>Reset session layout</button>
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
    <section {...region('primary')} className="wb-primary wb-region" aria-label={p.primaryTitle??'Architecture view'}><h2>{p.primaryTitle??'Architecture view'}</h2>{p.primary}</section>
    <aside {...region('companion')} className="wb-companion wb-region" aria-label={p.companionTitle??'Context and explanation'}><h2>{p.companionTitle??'Context and explanation'}</h2>{p.companion}</aside>
    <nav id={id('rail')} className="wb-rail wb-region" hidden={!fit.rail} aria-label="Semantic navigation" data-wb-region="rail" tabIndex={-1}>{p.rail}</nav>
   </div>
   <section {...region('dock')} className="wb-bottom wb-region" aria-label="Navigation map and contextual activity">
    <div className="wb-dock-content" data-map={String(present(p.navigationMap))} data-activity={String(present(p.activity))}>
     <section className="wb-map" hidden={!present(p.navigationMap)} aria-label="Navigation map"><h2>Navigation map</h2>{p.navigationMap}</section>
     <section className="wb-activity" hidden={!present(p.activity)} aria-label={p.activityTitle??'Contextual activity'}><h2>{p.activityTitle??'Contextual activity'}</h2>{p.activity}</section>
    </div>
   </section>
   <footer className="wb-status">{p.status??'Layout only. Source, evidence and permissions remain owned by the host.'}</footer>
  </div>;
 }
}
