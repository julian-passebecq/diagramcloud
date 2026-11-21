import * as React from 'react';
import {sanitizeSvg,STAGE_CSS} from './sanitize';
import {RIBBON_BUTTONS,DEFAULT_SIZES,clampSize,diagramFiles,diagramGroups,cannotShow,missingViewBox,byteSize,formatSize,checkNewName,checkGroupTitle,svgTitle,compareGroups,comparisonText,deckOrder,deckStep,deckKey,deckStatus,deckOutline,rootTitle,type PaneSizes,type DiagramGroup,type DiagramFile,type El} from './shellModel';

// Every file of diagrams/ is bundled as text only: the build serves no diagram as a page, and the dev server answers /diagrams/ with CSP sandbox (R970).
const FILES=diagramFiles(import.meta.glob<string>('/diagrams/*',{query:'?raw',import:'default',eager:true}),{});
// The three starting points of "New from template" (templates/*.svg).
const TEMPLATES=diagramFiles(import.meta.glob<string>('/templates/*.svg',{query:'?raw',import:'default',eager:true}),{});
const where=(f:DiagramFile)=>f.pageOnly?`${f.name} (in this page only)`:`diagrams/${f.name}`;
const hlOff=(root:ParentNode|null|undefined)=>root?.querySelectorAll('.sh-hl').forEach(e=>e.classList.remove('sh-hl'));
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
 const output=React.useRef<HTMLElement>(null);
 React.useEffect(()=>{const o=output.current;if(o)o.scrollTop=o.scrollHeight;},[log]); // newest Output line in view
 // R993: compare option A (the selected diagram) with option B, side by side.
 const [compareB,setCompareB]=React.useState<string|null>(null);
 const [picker,setPicker]=React.useState(false);
 const [groupsB,setGroupsB]=React.useState<DiagramGroup[]>([]);
 const [drawnB,setDrawnB]=React.useState<string|null>(null); // the B file whose stage is drawn: no comparison before that
 const [activeRow,setActiveRow]=React.useState<string|null>(null);
 const hostB=React.useRef<HTMLDivElement>(null);
 // R998: Present. picks = files Ctrl/Cmd-clicked in the tree; deck = the slide names while presenting.
 const [picks,setPicks]=React.useState<string[]>([]);
 const [deck,setDeck]=React.useState<string[]|null>(null);
 const [slide,setSlide]=React.useState(0);
 const canvas=React.useRef<HTMLElement>(null);
 const stageB=()=>{const h=hostB.current;return h?h.shadowRoot??h.attachShadow({mode:'open'}):null;};
 const textOf=(f:DiagramFile)=>edited.current.get(f.name)??f.text;
 // The diagram lives in a shadow root, so its own <style> styles the diagram and never the shell's panes (R970).
 const stage=()=>{const h=host.current;return h?h.shadowRoot??h.attachShadow({mode:'open'}):null;};
 const note=(line:string)=>setLog(l=>l[l.length-1]===line?l:[...l.slice(-49),line]);
 const resize=(pane:keyof PaneSizes,delta:number)=>setSizes(s=>({...s,[pane]:clampSize(pane,s[pane]+delta)}));
 const files=React.useMemo(()=>[...FILES,...added.filter(a=>!FILES.some(f=>f.name===a.name))].sort((a,b)=>a.name.localeCompare(b.name)),[added]);
 const file=files.find(f=>f.name===selected)??null;
 const reason=file?cannotShow(file):null;
 const slideName=deck?deck[slide]??null:null;
 const shown=deck?files.find(f=>f.name===slideName)??null:file; // what the centre draws: the slide while presenting, else A
 const shownReason=shown?cannotShow(shown):null;
 const fileB=compareB===null?null:files.find(f=>f.name===compareB)??null;
 const split=!!(file&&!reason&&fileB); // the side-by-side layout: B's stage is visible only with it
 const comparing=split&&drawnB===fileB!.name;
 const rows=React.useMemo(()=>comparing?compareGroups(groups,groupsB):[],[comparing,groups,groupsB]);
 const comparison=React.useMemo(()=>comparing&&file&&fileB?comparisonText(rows,{name:where(file),bytes:byteSize(textOf(file))},{name:where(fileB),bytes:byteSize(textOf(fileB))}):[],[rows]);

 React.useEffect(()=>{
  const box=stage();if(!box)return;
  box.replaceChildren();setGroups([]);setActive(null);
  if(!shown)return;
  if(shownReason){note(shownReason);return;}
  const found=draw(box,shown,textOf(shown),note);
  if(!found)return;
  setGroups(found);
  if(!deck)note(`Showing ${where(shown)} (${formatSize(byteSize(shown.text))}).`);
 },[shown]);
 // A changed during compare: to nothing, to a file that cannot be shown, or to B itself. Leave compare, naming the new A.
 React.useEffect(()=>{if(compareB!==null&&(!file||reason||file.name===compareB))exitCompare();},[file]);

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
 // Keys: in Present, Right/Space = next, Left = previous, Esc = leave; else Esc leaves compare (or closes the B picker).
 // The listener reads the latest render through a ref, so it never names a file from an earlier render.
 const onKey=React.useRef<(e:KeyboardEvent)=>void>(()=>{});
 onKey.current=e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(deck){
   const t=e.target as Element|null;
   if(t?.closest?.('input,textarea,select'))return;
   // A focused splitter keeps only the arrows it resizes with (side splitters Left/Right); Esc and Space still drive the deck.
   if(t?.closest?.('[role=separator][aria-orientation=vertical]')&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))return;
   // Space on a focused button presses that button (Copy deck outline, a slide in the list).
   if(e.key===' '&&t?.closest?.('button'))return;
   const act=deckKey(e.key);if(!act)return;
   e.preventDefault();
   if(act==='exit')exitPresent();else setSlide(i=>deckStep(i,deck.length,act==='next'?1:-1));
   return;
  }
  if(e.key==='Escape'&&(compareB!==null||picker)){e.preventDefault();exitCompare();}
 };
 React.useEffect(()=>{const h=(e:KeyboardEvent)=>onKey.current(e);window.addEventListener('keydown',h);return ()=>window.removeEventListener('keydown',h);},[]);
 const startPresent=()=>{
  const order=deckOrder(files.map(f=>f.name),picks);
  const ok=order.filter(n=>{const f=files.find(x=>x.name===n);return !!f&&!cannotShow(f);});
  const left=order.filter(n=>!ok.includes(n));
  if(left.length)note(`Left out of the deck (cannot be shown): ${left.join(', ')}.`);
  if(!ok.length){note('Present needs at least one diagram that can be shown.');return;}
  setPicker(false);setMenu(false);setCompareB(null);hlOff(stage());setActive(null);
  setDeck(ok);setSlide(0);
  canvas.current?.focus({preventScroll:true}); // off the Present button, so Space moves the deck at once
  note(`Present: ${ok.length} slide(s) ${picks.length?'picked in the tree':'from diagrams/'}, in tree order. Right arrow or Space = next, Left = previous, Esc = leave.`);
 };
 const exitPresent=()=>{setDeck(null);note(`Left Present: showing ${file?where(file):'nothing'}.`);};
 const outline=()=>deckOutline((deck??[]).map(n=>{const f=files.find(x=>x.name===n);return {name:n,title:f?rootTitle(textOf(f)):''};}));
 const copyOutline=()=>{
  const text=outline();
  const refused=()=>note('Could not copy: the browser refused clipboard access. Select the slide list in Navigation instead.');
  if(!navigator.clipboard){refused();return;}
  navigator.clipboard.writeText(text).then(()=>note(`Copied the deck outline (${deck?.length??0} slide(s)) to the clipboard.`),refused);
 };
 const clickTree=(e:React.MouseEvent,name:string)=>{
  if(e.ctrlKey||e.metaKey){
   const next=picks.includes(name)?picks.filter(n=>n!==name):[...picks,name];
   setPicks(next);
   note(next.length?`Picked for Present (${next.length}): ${deckOrder(files.map(f=>f.name),next).join(', ')}.`:'No diagram picked: Present shows every diagram in diagrams/.');
   return;
  }
  if(picks.length)setPicks([]);
  setSelected(name);
 };
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
  if(id==='present'){if(deck)exitPresent();else startPresent();return;}
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
 const off=(id:string)=>deck?id!=='present':id==='present'?!files.some(f=>!cannotShow(f)):id==='new'?false:id==='rename'?active===null||comparing:id==='copy'?!comparing:id==='compare'?compareB===null&&(!file||!!reason):!file||!!reason;
 const labelOf=(b:typeof RIBBON_BUTTONS[number])=>b.id==='compare'&&compareB!==null?'Exit compare':b.id==='present'&&deck?'Exit present':b.label;

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
   <ul role="tree" aria-multiselectable={picks.length?true:undefined}>{files.map(f=>{const picked=picks.includes(f.name);
    return <li key={f.name} role="treeitem" aria-selected={picks.length?picked:f.name===selected}>
    <div className={`sh-node${f.name===selected?' on':''}${picked?' picked':''}`}><button className="sh-label" title="Ctrl/Cmd-click to pick it for Present" onClick={e=>clickTree(e,f.name)}>{f.name}</button></div>
   </li>;})}</ul>
   {picks.length>0&&<p className="sh-muted">{picks.length} picked for Present (Ctrl/Cmd-click to change).</p>}
   {!files.length&&<p className="sh-muted">Add an .svg file to diagrams/.</p>}
  </nav>
  <Splitter dir="col" column={2} label="Resize explorer" onDelta={d=>resize('left',d)}/>
  <main className={`sh-canvas${fit||deck?' fit':''}${split?' compare':''}${deck?' present':''}`} aria-label="Diagram" ref={canvas} tabIndex={-1}>
   <section className="sh-stage" aria-label={deck&&slideName?`Slide ${slide+1}: ${slideName}`:comparing?`Option A: ${file?.name}`:undefined}>
    {comparing&&<h3 className="sh-stage-label"><b>A</b> {file?.name}</h3>}
    <div ref={host} className={`sh-diagram${fit||comparing||deck?' fit':''}`}/>
   </section>
   <section className="sh-stage" aria-label={comparing?`Option B: ${fileB?.name}`:undefined} hidden={!split}>
    {comparing&&<h3 className="sh-stage-label"><b>B</b> {fileB?.name}</h3>}
    <div ref={hostB} className="sh-diagram fit"/>
   </section>
   {(!shown||shownReason)&&<p className="sh-muted">{shownReason??'Select a diagram in the tree.'}</p>}
  </main>
  <Splitter dir="col" column={4} label="Resize navigation" onDelta={d=>resize('right',-d)}/>
  <aside className="sh-right" aria-label="Navigation"><h2>Navigation</h2>
   {deck?<ul aria-label="Slides">{deck.map((n,i)=><li key={n}><button className={i===slide?'on':''} aria-current={i===slide?'true':undefined} onClick={()=>setSlide(i)}>{i+1}. {n}</button></li>)}</ul>:
   comparing?<ul aria-label="Groups of A and B">{rows.map(r=><li key={r.key}><button className={r.key===activeRow?'on':''} aria-current={r.key===activeRow?'true':undefined} onClick={()=>pickRow(r)}>
    <span className="sh-row-label">{r.label}</span> <span className={`sh-mark sh-mark-${r.side==='both'?'both':r.side==='A only'?'a':'b'}`}>{r.side}</span></button></li>)}</ul>:
   <ul>{groups.map((g,i)=><li key={i}><button className={i===active?'on':''} aria-current={i===active?'true':undefined} title={g.id?`#${g.id}`:undefined} onClick={()=>pick(i)}>{g.label}</button></li>)}</ul>}
   {!deck&&file&&!reason&&!comparing&&!groups.length&&<p className="sh-muted">This diagram has no named groups (a &lt;g&gt; with an id or a title).</p>}
  </aside>
  <Splitter dir="row" label="Resize bottom pane" onDelta={d=>resize('bottom',-d)}/>
  <footer ref={output} className="sh-bottom" aria-label="Output"><h2>Output</h2>
   {deck&&slideName&&<div className="sh-deckbar"><p role="status">{deckStatus(slide,deck.length,slideName)}</p><button onClick={copyOutline}>Copy deck outline</button></div>}<ol>{log.map((l,i)=><li key={i}>{l}</li>)}</ol></footer>
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
