import * as React from 'react';
import {sanitizeSvg,STAGE_CSS} from './sanitize';
import {RIBBON_BUTTONS,DEFAULT_SIZES,clampSize,diagramFiles,diagramGroups,cannotShow,missingViewBox,byteSize,formatSize,checkNewName,checkGroupTitle,svgTitle,type PaneSizes,type DiagramGroup,type DiagramFile,type El} from './shellModel';

// Every file of diagrams/ is bundled as text only: no diagram is ever served as an SVG page on the app origin (R970).
const FILES=diagramFiles(import.meta.glob<string>('/diagrams/*',{query:'?raw',import:'default',eager:true}),{});
// The three starting points of "New from template" (templates/*.svg).
const TEMPLATES=diagramFiles(import.meta.glob<string>('/templates/*.svg',{query:'?raw',import:'default',eager:true}),{});
const where=(f:DiagramFile)=>f.url.startsWith('blob:')?`${f.name} (in this page only)`:`diagrams/${f.name}`;
const hlOff=(root:ParentNode|null|undefined)=>root?.querySelectorAll('.sh-hl').forEach(e=>e.classList.remove('sh-hl'));
/** Opens text as plain text in a new tab: shows the source, runs nothing (R970). */
const openText=(text:string)=>{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);};

/** DiagramCloud GUI shell: ribbon top, diagrams/ tree left, the shown SVG in the centre, its groups right, Output bottom. */
export function Shell(){
 const [selected,setSelected]=React.useState<string|null>(FILES[0]?.name??null);
 const [added,setAdded]=React.useState<DiagramFile[]>([]); // new diagrams; page-only when the page cannot write the folder
 const [menu,setMenu]=React.useState(false);
 const edited=React.useRef(new Map<string,string>()); // file name -> text after Rename group (page only)
 const [fit,setFit]=React.useState(false);
 const [groups,setGroups]=React.useState<DiagramGroup[]>([]);
 const [active,setActive]=React.useState<number|null>(null);
 const [sizes,setSizes]=React.useState<PaneSizes>(DEFAULT_SIZES);
 const [log,setLog]=React.useState<string[]>([FILES.length?`Found ${FILES.length} file(s) in diagrams/.`:'diagrams/ has no files.']);
 const host=React.useRef<HTMLDivElement>(null);
 // The diagram lives in a shadow root, so its own <style> styles the diagram and never the shell's panes (R970).
 const stage=()=>{const h=host.current;return h?h.shadowRoot??h.attachShadow({mode:'open'}):null;};
 const note=(line:string)=>setLog(l=>l[l.length-1]===line?l:[...l.slice(-49),line]);
 const resize=(pane:keyof PaneSizes,delta:number)=>setSizes(s=>({...s,[pane]:clampSize(pane,s[pane]+delta)}));
 const files=React.useMemo(()=>[...FILES,...added.filter(a=>!FILES.some(f=>f.name===a.name))].sort((a,b)=>a.name.localeCompare(b.name)),[added]);
 const file=files.find(f=>f.name===selected)??null;
 const reason=file?cannotShow(file):null;

 React.useEffect(()=>{
  const box=stage();if(!box)return;
  box.replaceChildren();setGroups([]);setActive(null);
  if(!file)return;
  if(reason){note(reason);return;}
  box.innerHTML=`<style>${STAGE_CSS}</style>`+sanitizeSvg(edited.current.get(file.name)??file.text);
  const svg=box.querySelector('svg');
  if(!svg){note(`${file.name} cannot be shown: the SVG did not survive parsing or sanitising.`);return;}
  if(!svg.getAttribute('viewBox')){const b=svg.getBBox();// fallback without width/height: the drawing's own bounds
   const vb=missingViewBox(null,svg.getAttribute('width'),svg.getAttribute('height'))??(b.width>0&&b.height>0?`${b.x} ${b.y} ${b.width} ${b.height}`:null);
   if(vb)svg.setAttribute('viewBox',vb);}
  setGroups(diagramGroups(svg as unknown as El));
  note(`Showing ${where(file)} (${formatSize(byteSize(file.text))}).`);
 },[file]);

 const pick=(i:number)=>{
  hlOff(stage());
  const el=groups[i].el as unknown as SVGGElement;
  el.classList.add('sh-hl');el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});
  setActive(i);note(`Highlighted ${groups[i].label}.`);
 };
 // Copy a template to diagrams/<name>.svg through the dev server; without one, keep it in the page and say so.
 const create=async(t:DiagramFile)=>{
  setMenu(false);
  const label=svgTitle(t.text,t.name);
  const name=window.prompt(`Name for the new ${label.toLowerCase()} (letters, digits, dash, underscore):`)?.trim();
  if(name===undefined)return;
  const refused=checkNewName(name,files.map(f=>f.name));
  if(refused){note(refused);return;}
  let saved=false;
  try{
   const r=await fetch('__shell/new',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,template:t.name})});
   const out=r.headers.get('content-type')?.includes('json')?await r.json():null;
   if(out&&!out.ok){note(out.error);return;}
   saved=!!out?.ok;
  }catch{/* no dev server: page-only below */}
  const url=saved?`diagrams/${name}.svg`:URL.createObjectURL(new Blob([t.text],{type:'text/plain'}));
  setAdded(a=>[...a,{name:`${name}.svg`,text:t.text,url}]);setSelected(`${name}.svg`);
  note(saved?`Created diagrams/${name}.svg from the ${label.toLowerCase()} template.`:`${name}.svg lives in this page only: not saved to the diagrams/ folder yet (this page has no file access). Use Save as to download it.`);
 };
 // Change the selected group's <title> (and a label text that repeats it) in the shown SVG.
 const rename=()=>{
  const g=active===null?null:groups[active];const svg=stage()?.querySelector('svg');
  if(!g||!svg||!file)return;
  const title=window.prompt(`New title for the group ${g.label}:`,g.label);
  if(title===null)return;
  const refused=checkGroupTitle(title);if(refused){note(refused);return;}
  const el=g.el as unknown as SVGGElement;
  let t=Array.from(el.children).find(c=>c.tagName.toLowerCase()==='title');
  if(!t){t=document.createElementNS('http://www.w3.org/2000/svg','title');el.prepend(t);}
  for(const c of Array.from(el.children))if(c.tagName.toLowerCase()==='text'&&c.textContent?.trim()===g.label)c.textContent=title.trim();
  t.textContent=title.trim();
  setGroups(diagramGroups(svg as unknown as El));
  hlOff(svg);edited.current.set(file.name,svg.outerHTML);el.classList.add('sh-hl');
  note(`Renamed group ${g.label} to ${title.trim()} in the page; diagrams/${file.name} on disk is unchanged until you Save as.`);
 };
 const run=(id:typeof RIBBON_BUTTONS[number]['id'])=>{
  if(id==='new'){setMenu(!menu);return;}
  if(!file)return;
  if(id==='rename')rename();
  else if(id==='save'){
   const svg=stage()?.querySelector('svg');if(!svg)return;
   const copy=svg.cloneNode(true) as SVGSVGElement;hlOff(copy);
   const a=document.createElement('a');a.download=file.name;
   a.href=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));a.click();
   note(`Downloaded ${file.name} (Save as). Move it into diagrams/ to keep it there.`);
  }
  else if(id==='fit'){setFit(!fit);note(fit?'Actual size.':'Zoomed to fit.');}
  else{openText(file.text);note(`Opened raw file ${where(file)} as plain text.`);}
 };
 const off=(id:string)=>id==='new'?false:id==='rename'?active===null:!file||!!reason;

 return <div className="sh-root" style={{gridTemplateColumns:`${sizes.left}px 6px 1fr 6px ${sizes.right}px`,gridTemplateRows:`auto 1fr 6px ${sizes.bottom}px`}}>
  <header className="sh-ribbon">
   <div className="sh-tools" role="toolbar" aria-label="Diagram tools">
    <span className="sh-brand">DiagramCloud</span>
    {RIBBON_BUTTONS.map(b=><button key={b.id} disabled={off(b.id)} aria-pressed={b.id==='fit'?fit:undefined} aria-haspopup={b.id==='new'?'menu':undefined} aria-expanded={b.id==='new'?menu:undefined} onClick={()=>run(b.id)}>{b.label}</button>)}
   </div>
   {menu&&<ul className="sh-menu" role="menu" aria-label="Templates">{TEMPLATES.map(t=><li key={t.name} role="none"><button role="menuitem" onClick={()=>create(t)}>{svgTitle(t.text,t.name)}</button></li>)}</ul>}
  </header>
  <nav className="sh-left" aria-label="Diagrams"><h2>diagrams/</h2>
   <ul role="tree">{files.map(f=><li key={f.name} role="treeitem" aria-selected={f.name===selected}>
    <div className={`sh-node${f.name===selected?' on':''}`}><button className="sh-label" onClick={()=>setSelected(f.name)}>{f.name}</button></div>
   </li>)}</ul>
   {!files.length&&<p className="sh-muted">Add an .svg file to diagrams/.</p>}
  </nav>
  <Splitter dir="col" column={2} label="Resize explorer" onDelta={d=>resize('left',d)}/>
  <main className={`sh-canvas${fit?' fit':''}`} aria-label="Diagram">
   <div ref={host} className={`sh-diagram${fit?' fit':''}`}/>
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
