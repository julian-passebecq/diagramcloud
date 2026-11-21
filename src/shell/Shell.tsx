import * as React from 'react';
import DOMPurify from 'dompurify';
import {RIBBON_BUTTONS,DEFAULT_SIZES,clampSize,diagramFiles,diagramGroups,cannotShow,byteSize,formatSize,type PaneSizes,type DiagramGroup,type El} from './shellModel';

// Every file of diagrams/ is bundled as text (to draw it) and as a URL (to open the raw file).
const FILES=diagramFiles(
 import.meta.glob<string>('/diagrams/*',{query:'?raw',import:'default',eager:true}),
 import.meta.glob<string>('/diagrams/*',{query:'?url&no-inline',import:'default',eager:true}));

/** DiagramCloud GUI shell: ribbon top, diagrams/ tree left, the shown SVG in the centre, its groups right, Output bottom. */
export function Shell(){
 const [selected,setSelected]=React.useState<string|null>(FILES[0]?.name??null);
 const [fit,setFit]=React.useState(false);
 const [groups,setGroups]=React.useState<DiagramGroup[]>([]);
 const [active,setActive]=React.useState<number|null>(null);
 const [sizes,setSizes]=React.useState<PaneSizes>(DEFAULT_SIZES);
 const [log,setLog]=React.useState<string[]>([FILES.length?`Found ${FILES.length} file(s) in diagrams/.`:'diagrams/ has no files.']);
 const host=React.useRef<HTMLDivElement>(null);
 const note=(line:string)=>setLog(l=>l[l.length-1]===line?l:[...l.slice(-49),line]);
 const resize=(pane:keyof PaneSizes,delta:number)=>setSizes(s=>({...s,[pane]:clampSize(pane,s[pane]+delta)}));
 const file=FILES.find(f=>f.name===selected)??null;
 const reason=file?cannotShow(file):null;

 React.useEffect(()=>{
  const box=host.current;if(!box)return;
  box.replaceChildren();setGroups([]);setActive(null);
  if(!file)return;
  if(reason){note(reason);return;}
  box.innerHTML=DOMPurify.sanitize(file.text,{USE_PROFILES:{svg:true,svgFilters:true}});
  const svg=box.querySelector('svg');
  if(!svg){note(`${file.name} cannot be shown: the SVG did not survive parsing or sanitising.`);return;}
  setGroups(diagramGroups(svg as unknown as El));
  note(`Showing diagrams/${file.name} (${formatSize(byteSize(file.text))}).`);
 },[file]);

 const pick=(i:number)=>{
  host.current?.querySelectorAll('.sh-hl').forEach(e=>e.classList.remove('sh-hl'));
  const el=groups[i].el as unknown as SVGGElement;
  el.classList.add('sh-hl');el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});
  setActive(i);note(`Highlighted ${groups[i].label}.`);
 };
 const run=(id:typeof RIBBON_BUTTONS[number]['id'])=>{
  if(!file)return;
  if(id==='fit'){setFit(!fit);note(fit?'Actual size.':'Zoomed to fit.');}
  else{window.open(file.url,'_blank','noopener');note(`Opened raw file diagrams/${file.name}.`);}
 };

 return <div className="sh-root" style={{gridTemplateColumns:`${sizes.left}px 6px 1fr 6px ${sizes.right}px`,gridTemplateRows:`auto 1fr 6px ${sizes.bottom}px`}}>
  <header className="sh-ribbon">
   <div className="sh-tools" role="toolbar" aria-label="Diagram tools">
    <span className="sh-brand">DiagramCloud</span>
    {RIBBON_BUTTONS.map(b=><button key={b.id} disabled={!file||!!reason} aria-pressed={b.id==='fit'?fit:undefined} onClick={()=>run(b.id)}>{b.label}</button>)}
   </div>
  </header>
  <nav className="sh-left" aria-label="Diagrams"><h2>diagrams/</h2>
   <ul role="tree">{FILES.map(f=><li key={f.name} role="treeitem" aria-selected={f.name===selected}>
    <div className={`sh-node${f.name===selected?' on':''}`}><button className="sh-label" onClick={()=>setSelected(f.name)}>{f.name}</button></div>
   </li>)}</ul>
   {!FILES.length&&<p className="sh-muted">Add an .svg file to diagrams/.</p>}
  </nav>
  <Splitter dir="col" column={2} label="Resize explorer" onDelta={d=>resize('left',d)}/>
  <main className={`sh-canvas${fit?' fit':''}`} aria-label="Diagram">
   <div ref={host} className="sh-diagram"/>
   {(!file||reason)&&<p className="sh-muted">{reason??'Select a diagram in the tree.'}</p>}
  </main>
  <Splitter dir="col" column={4} label="Resize navigation" onDelta={d=>resize('right',-d)}/>
  <aside className="sh-right" aria-label="Navigation"><h2>Navigation</h2>
   <ul>{groups.map((g,i)=><li key={i}><button className={i===active?'on':''} aria-current={i===active?'true':undefined} title={g.id?`#${g.id}`:undefined} onClick={()=>pick(i)}>{g.label}</button></li>)}</ul>
   {file&&!reason&&!groups.length&&<p className="sh-muted">This diagram has no named groups (a &lt;g&gt; with an id or a title).</p>}
  </aside>
  <Splitter dir="row" label="Resize bottom pane" onDelta={d=>resize('bottom',-d)}/>
  <footer className="sh-bottom" aria-label="Output"><h2>Output</h2><ol>{log.map((l,i)=><li key={i}>{l}</li>)}</ol></footer>
 </div>;
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
