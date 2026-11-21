import * as React from 'react';
import {sanitizeSvg,STAGE_CSS} from './sanitize';
import {RIBBON_BUTTONS,DEFAULT_SIZES,clampSize,diagramFiles,diagramGroups,cannotShow,missingViewBox,byteSize,formatSize,checkNewName,checkGroupTitle,svgTitle,compareGroups,comparisonText,type PaneSizes,type DiagramGroup,type DiagramFile,type El} from './shellModel';

// Every file of diagrams/ is bundled as text only: the build serves no diagram as a page, and the dev server answers /diagrams/ with CSP sandbox (R970).
const FILES=diagramFiles(import.meta.glob<string>('/diagrams/*',{query:'?raw',import:'default',eager:true}),{});
// The three starting points of "New from template" (templates/*.svg).
const TEMPLATES=diagramFiles(import.meta.glob<string>('/templates/*.svg',{query:'?raw',import:'default',eager:true}),{});
const where=(f:DiagramFile)=>f.pageOnly?`${f.name} (in this page only)`:`diagrams/${f.name}`;
const hlOff=(root:ParentNode|null|undefined)=>root?.querySelectorAll('.sh-hl').forEach(e=>e.classList.remove('sh-hl'));
/** Opens text as plain text in a new tab: shows the source, runs nothing (R970). */
/** Draws a diagram file into a shadow root, sanitised (R970); returns its named groups, or null with the reason in Output. */
function draw(box:ShadowRoot,file:DiagramFile,text:string,note:(line:string)=>void):DiagramGroup[]|null{
 const safe=sanitizeSvg(text);
 box.innerHTML=`<style>${STAGE_CSS}</style>`+safe.html;
 if(safe.refused.length)note(`Refused in ${file.name} (could load from outside or restyle the shell): ${safe.refused.join(', ')}.`);
 const svg=box.querySelector('svg');
 if(!svg){note(`${file.name} cannot be shown: the SVG did not survive parsing or sanitising.`);return null;}
 if(!svg.getAttribute('viewBox')){const b=svg.getBBox();// fallback without width/height: the drawing's own bounds
  const vb=missingViewBox(null,svg.getAttribute('width'),svg.getAttribute('height'))??(b.width>0&&b.height>0?`${b.x} ${b.y} ${b.width} ${b.height}`:null);
  if(vb)svg.setAttribute('viewBox',vb);}
 return diagramGroups(svg as unknown as El);
}
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
 const output=React.useRef<HTMLElement>(null);
 React.useEffect(()=>{const o=output.current;if(o)o.scrollTop=o.scrollHeight;},[log]); // newest Output line in view
 // R993: compare option A (the selected diagram) with option B, side by side.
 const [compareB,setCompareB]=React.useState<string|null>(null);
 const [picker,setPicker]=React.useState(false);
 const [groupsB,setGroupsB]=React.useState<DiagramGroup[]>([]);
 const [drawnB,setDrawnB]=React.useState<string|null>(null); // the B file whose stage is drawn: no comparison before that
 const [activeRow,setActiveRow]=React.useState<string|null>(null);
 const hostB=React.useRef<HTMLDivElement>(null);
 const stageB=()=>{const h=hostB.current;return h?h.shadowRoot??h.attachShadow({mode:'open'}):null;};
 const textOf=(f:DiagramFile)=>edited.current.get(f.name)??f.text;
 // The diagram lives in a shadow root, so its own <style> styles the diagram and never the shell's panes (R970).
 const stage=()=>{const h=host.current;return h?h.shadowRoot??h.attachShadow({mode:'open'}):null;};
 const note=(line:string)=>setLog(l=>l[l.length-1]===line?l:[...l.slice(-49),line]);
 const resize=(pane:keyof PaneSizes,delta:number)=>setSizes(s=>({...s,[pane]:clampSize(pane,s[pane]+delta)}));
 const files=React.useMemo(()=>[...FILES,...added.filter(a=>!FILES.some(f=>f.name===a.name))].sort((a,b)=>a.name.localeCompare(b.name)),[added]);
 const file=files.find(f=>f.name===selected)??null;
 const reason=file?cannotShow(file):null;
 const fileB=compareB===null?null:files.find(f=>f.name===compareB)??null;
 const comparing=!!(file&&!reason&&fileB&&drawnB===fileB.name);
 const rows=React.useMemo(()=>comparing?compareGroups(groups,groupsB):[],[comparing,groups,groupsB]);
 const comparison=React.useMemo(()=>comparing&&file&&fileB?comparisonText(rows,{name:where(file),bytes:byteSize(textOf(file))},{name:where(fileB),bytes:byteSize(textOf(fileB))}):[],[rows]);

 React.useEffect(()=>{
  const box=stage();if(!box)return;
  box.replaceChildren();setGroups([]);setActive(null);
  if(!file)return;
  if(reason){note(reason);return;}
  const found=draw(box,file,textOf(file),note);
  if(!found)return;
  setGroups(found);
  note(`Showing ${where(file)} (${formatSize(byteSize(file.text))}).`);
 },[file]);

 // Option B's stage: drawn the same way as A, in its own shadow root.
 React.useEffect(()=>{
  const box=stageB();if(!box)return;
  box.replaceChildren();setGroupsB([]);setActiveRow(null);setDrawnB(null);
  if(!fileB)return;
  const why=cannotShow(fileB);if(why){note(why);setCompareB(null);return;}
  const found=draw(box,fileB,textOf(fileB),note);
  if(!found){setCompareB(null);return;}
  setGroupsB(found);setDrawnB(fileB.name);
 },[fileB]);
 React.useEffect(()=>{setActiveRow(null);},[file]);
 React.useEffect(()=>{if(comparison.length)setLog(l=>[...l,...comparison].slice(-50));},[comparison]);
 // Esc leaves compare (or closes the B picker).
 React.useEffect(()=>{
  if(!compareB&&!picker)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();exitCompare();}};
  window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
 },[compareB,picker]);
 const exitCompare=()=>{
  setPicker(false);if(compareB===null)return;
  setCompareB(null);hlOff(stage());
  note(`Exit compare: showing ${file?where(file):'nothing'} alone.`);
 };
 const startCompare=(b:DiagramFile)=>{setPicker(false);setMenu(false);hlOff(stage());setActive(null);setCompareB(b.name);};
 const pickRow=(r:typeof rows[number])=>{
  hlOff(stage());hlOff(stageB());
  for(const el of [r.a===null?null:groups[r.a]?.el,r.b===null?null:groupsB[r.b]?.el]){
   if(!el)continue;const g=el as unknown as SVGGElement;g.classList.add('sh-hl');g.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});}
  setActiveRow(r.key);note(`Highlighted ${r.label} (${r.side}).`);
 };
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
  setAdded(a=>[...a,{name:`${name}.svg`,text:t.text,url:`diagrams/${name}.svg`,pageOnly:!saved}]);setSelected(`${name}.svg`);
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
  if(id==='new'){setPicker(false);setMenu(!menu);return;}
  if(id==='compare'){
   if(compareB!==null){exitCompare();return;}
   setMenu(false);
   if(!files.some(f=>f.name!==selected)){note('Compare needs a second diagram in diagrams/.');return;}
   setPicker(!picker);return;
  }
  if(id==='copy'){
   const text=comparison.join('\n');
   navigator.clipboard?.writeText(text).then(()=>note('Copied the comparison to the clipboard.'),()=>note('Could not copy: the browser refused clipboard access. Select the lines in Output instead.'));
   return;
  }
  if(!file)return;
  if(id==='rename')rename();
  else if(id==='save'){
   const svg=stage()?.querySelector('svg');if(!svg)return;
   const copy=svg.cloneNode(true) as SVGSVGElement;hlOff(copy);
   const a=document.createElement('a');a.download=file.name;
   a.href=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));a.click();
   setTimeout(()=>URL.revokeObjectURL(a.href),60000); // the download has started; free the blob
   note(`Downloaded ${file.name} (Save as). Move it into diagrams/ to keep it there.`);
  }
  else if(id==='fit'){setFit(!fit);note(fit?'Actual size.':'Zoomed to fit.');}
  else{openText(file.text);note(`Opened raw file ${where(file)} as plain text.`);}
 };
 const off=(id:string)=>id==='new'?false:id==='rename'?active===null||comparing:id==='copy'?!comparing:id==='compare'?compareB===null&&(!file||!!reason):!file||!!reason;
 const labelOf=(b:typeof RIBBON_BUTTONS[number])=>b.id==='compare'&&compareB!==null?'Exit compare':b.label;

 return <div className="sh-root" style={{gridTemplateColumns:`${sizes.left}px 6px 1fr 6px ${sizes.right}px`,gridTemplateRows:`auto 1fr 6px ${sizes.bottom}px`}}>
  <header className="sh-ribbon">
   <div className="sh-tools" role="toolbar" aria-label="Diagram tools">
    <span className="sh-brand">DiagramCloud</span>
    {RIBBON_BUTTONS.map(b=><button key={b.id} disabled={off(b.id)} aria-pressed={b.id==='fit'?fit:undefined} aria-haspopup={b.id==='new'?'menu':undefined} aria-expanded={b.id==='new'?menu:undefined} onClick={()=>run(b.id)}>{labelOf(b)}</button>)}
   </div>
   {menu&&<ul className="sh-menu" role="menu" aria-label="Templates">{TEMPLATES.map(t=><li key={t.name} role="none"><button role="menuitem" onClick={()=>create(t)}>{svgTitle(t.text,t.name)}</button></li>)}</ul>}
   {picker&&<ul className="sh-menu sh-picker" role="menu" aria-label={`Compare ${selected} with`}>{files.filter(f=>f.name!==selected).map(f=><li key={f.name} role="none"><button role="menuitem" onClick={()=>startCompare(f)}>{f.name}</button></li>)}</ul>}
  </header>
  <nav className="sh-left" aria-label="Diagrams"><h2>diagrams/</h2>
   <ul role="tree">{files.map(f=><li key={f.name} role="treeitem" aria-selected={f.name===selected}>
    <div className={`sh-node${f.name===selected?' on':''}`}><button className="sh-label" onClick={()=>setSelected(f.name)}>{f.name}</button></div>
   </li>)}</ul>
   {!files.length&&<p className="sh-muted">Add an .svg file to diagrams/.</p>}
  </nav>
  <Splitter dir="col" column={2} label="Resize explorer" onDelta={d=>resize('left',d)}/>
  <main className={`sh-canvas${fit?' fit':''}${file&&!reason&&fileB?' compare':''}`} aria-label="Diagram">
   <section className="sh-stage" aria-label={comparing?`Option A: ${file?.name}`:undefined}>
    {comparing&&<h3 className="sh-stage-label"><b>A</b> {file?.name}</h3>}
    <div ref={host} className={`sh-diagram${fit||comparing?' fit':''}`}/>
   </section>
   <section className="sh-stage" aria-label={comparing?`Option B: ${fileB?.name}`:undefined} hidden={!fileB}>
    {comparing&&<h3 className="sh-stage-label"><b>B</b> {fileB?.name}</h3>}
    <div ref={hostB} className="sh-diagram fit"/>
   </section>
   {(!file||reason)&&<p className="sh-muted">{reason??'Select a diagram in the tree.'}</p>}
  </main>
  <Splitter dir="col" column={4} label="Resize navigation" onDelta={d=>resize('right',-d)}/>
  <aside className="sh-right" aria-label="Navigation"><h2>Navigation</h2>
   {comparing?<ul aria-label="Groups of A and B">{rows.map(r=><li key={r.key}><button className={r.key===activeRow?'on':''} aria-current={r.key===activeRow?'true':undefined} onClick={()=>pickRow(r)}>
    <span className="sh-row-label">{r.label}</span> <span className={`sh-mark sh-mark-${r.side==='both'?'both':r.side==='A only'?'a':'b'}`}>{r.side}</span></button></li>)}</ul>:
   <ul>{groups.map((g,i)=><li key={i}><button className={i===active?'on':''} aria-current={i===active?'true':undefined} title={g.id?`#${g.id}`:undefined} onClick={()=>pick(i)}>{g.label}</button></li>)}</ul>}
   {file&&!reason&&!comparing&&!groups.length&&<p className="sh-muted">This diagram has no named groups (a &lt;g&gt; with an id or a title).</p>}
  </aside>
  <Splitter dir="row" label="Resize bottom pane" onDelta={d=>resize('bottom',-d)}/>
  <footer ref={output} className="sh-bottom" aria-label="Output"><h2>Output</h2><ol>{log.map((l,i)=><li key={i}>{l}</li>)}</ol></footer>
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
