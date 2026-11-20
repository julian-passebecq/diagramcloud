import * as React from 'react';
import {RIBBON_TABS,TREE,NAV_ENTRIES,DEFAULT_SIZES,clampSize,type PaneSizes,type TreeNode} from './shellModel';

/** Empty DiagramCloud GUI shell (R875): ribbon top, tree left, navigation right, bottom pane. Placeholders only. */
export function Shell(){
 const [tab,setTab]=React.useState(RIBBON_TABS[0].id);
 const [selected,setSelected]=React.useState<string|null>(null);
 const [nav,setNav]=React.useState(NAV_ENTRIES[0]);
 const [sizes,setSizes]=React.useState<PaneSizes>(DEFAULT_SIZES);
 const [log,setLog]=React.useState<string[]>(['Shell ready. No project loaded.']);
 const note=(line:string)=>setLog(l=>[...l.slice(-49),line]);
 const resize=(pane:keyof PaneSizes,delta:number)=>setSizes(s=>({...s,[pane]:clampSize(pane,s[pane]+delta)}));
 const active=RIBBON_TABS.find(t=>t.id===tab)!;
 return <div className="sh-root" style={{gridTemplateColumns:`${sizes.left}px 6px 1fr 6px ${sizes.right}px`,gridTemplateRows:`auto 1fr 6px ${sizes.bottom}px`}}>
  <header className="sh-ribbon">
   <div className="sh-tabs" role="tablist">
    <span className="sh-brand">DiagramCloud</span>
    {RIBBON_TABS.map(t=><button key={t.id} role="tab" aria-selected={t.id===tab} className={t.id===tab?'on':''} onClick={()=>setTab(t.id)}>{t.label}</button>)}
   </div>
   <div className="sh-tools" role="toolbar" aria-label={`${active.label} tools`}>
    {active.buttons.map(b=><button key={b} onClick={()=>note(`${b}: placeholder, does nothing yet.`)}>{b}</button>)}
   </div>
  </header>
  <nav className="sh-left" aria-label="Project tree"><h2>Explorer</h2><ul role="tree">{TREE.map(n=><TreeItem key={n.id} node={n} selected={selected} onSelect={id=>{setSelected(id);note(`Selected ${id}.`);}}/>)}</ul></nav>
  <Splitter dir="col" column={2} label="Resize explorer" onDelta={d=>resize('left',d)}/>
  <main className="sh-canvas"><p>Empty canvas</p><p className="sh-muted">{selected?`Selected: ${selected}`:'Select an item in the tree.'}</p></main>
  <Splitter dir="col" column={4} label="Resize navigation" onDelta={d=>resize('right',-d)}/>
  <aside className="sh-right" aria-label="Navigation"><h2>Navigation</h2><ul>{NAV_ENTRIES.map(e=><li key={e}><button className={e===nav?'on':''} aria-current={e===nav?'page':undefined} onClick={()=>setNav(e)}>{e}</button></li>)}</ul><p className="sh-muted">{nav}: nothing to show.</p></aside>
  <Splitter dir="row" label="Resize bottom pane" onDelta={d=>resize('bottom',-d)}/>
  <footer className="sh-bottom" aria-label="Status and log"><h2>Output</h2><ol>{log.map((l,i)=><li key={i}>{l}</li>)}</ol></footer>
 </div>;
}

function TreeItem({node,selected,onSelect}:{node:TreeNode;selected:string|null;onSelect:(id:string)=>void}){
 const [open,setOpen]=React.useState(true);
 const kids=node.children??[];
 return <li role="treeitem" aria-expanded={kids.length?open:undefined} aria-selected={selected===node.id}>
  <div className={`sh-node${selected===node.id?' on':''}`}>
   {kids.length?<button className="sh-twisty" aria-label={open?'Collapse':'Expand'} onClick={()=>setOpen(!open)}>{open?'▾':'▸'}</button>:<span className="sh-twisty"/>}
   <button className="sh-label" onClick={()=>onSelect(node.id)}>{node.label}</button>
  </div>
  {kids.length>0&&open&&<ul role="group">{kids.map(k=><TreeItem key={k.id} node={k} selected={selected} onSelect={onSelect}/>)}</ul>}
 </li>;
}

/** Drag or arrow keys resize the neighbouring pane. */
function Splitter({dir,column,label,onDelta}:{dir:'row'|'col';column?:number;label:string;onDelta:(delta:number)=>void}){
 const last=React.useRef<number|null>(null);
 const pos=(e:React.PointerEvent)=>dir==='col'?e.clientX:e.clientY;
 return <div className={`sh-split sh-split-${dir}`} role="separator" aria-label={label} aria-orientation={dir==='col'?'vertical':'horizontal'} tabIndex={0} style={column?{gridColumn:column}:undefined}
  onPointerDown={e=>{last.current=pos(e);e.currentTarget.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{if(last.current===null)return;const p=pos(e);onDelta(p-last.current);last.current=p;}}
  onPointerUp={()=>{last.current=null;}}
  onKeyDown={e=>{const step=e.shiftKey?40:10;const k=e.key;
   if((dir==='col'&&k==='ArrowLeft')||(dir==='row'&&k==='ArrowUp')){e.preventDefault();onDelta(-step);}
   if((dir==='col'&&k==='ArrowRight')||(dir==='row'&&k==='ArrowDown')){e.preventDefault();onDelta(step);}}}/>;
}
