import {useEffect,useMemo,useRef,useState} from 'react';
import type {Project} from '../core/model';
import {buildScene,svgPolylinePath,SCENE_FONT,type SceneText} from '../export/scene';
import type {DepthScene,DepthSceneFigure} from '../intelligence/learning/depth';
/** Follows the reader's reduced-motion preference; without a browser (server render, tests) motion is treated as reduced. */
function useReducedMotion(){
 const media=()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
 const [reduced,setReduced]=useState(()=>media()?.matches??true);
 useEffect(()=>{const query=media();if(!query)return;const on=()=>setReduced(query.matches);on();query.addEventListener?.('change',on);return ()=>query.removeEventListener?.('change',on);},[]);
 return reduced;
}
const pct=(v:number,of:number)=>`${(v/of*100).toFixed(3)}%`;
const INK='var(--ink, #16263d)',MUTED='var(--muted, #52647a)',LINE='var(--border, #cbd5e1)',ACCENT='var(--blue, #2563eb)',PANEL='var(--panel, #ffffff)',SOFT='var(--soft, #f8fafc)';
function Text({t,fill,halo}:{t:SceneText;fill:string;halo?:string}){
 if(!t.lines.length)return null;
 return <text x={t.x} y={t.y} fontSize={t.size} fontWeight={t.bold?700:undefined} fill={fill} {...(halo?{stroke:halo,strokeWidth:4,strokeLinejoin:'round' as const,paintOrder:'stroke'}:{})} textAnchor={t.anchor==='middle'?'middle':undefined}>{t.lines.map((l,i)=><tspan key={i} x={t.x} dy={i?t.lineHeight:undefined}>{l}</tspan>)}</text>;
}
/**
 * The spatial figure of one lesson depth scene: the shared export scene (measured boxes, orthogonal routes) over the depth
 * figure's derived view, with one frame per explicitly opened view. Camera zoom sizes this figure only. Played steps light up
 * their component and its connections. The drawing is a picture (role img); each drawn component is also a real button laid over
 * it (accessible name = component label, reached by Tab) that selects the component. The list stays the text alternative.
 */
export function LessonDiagramFigure({doc,scene,figure,zoom,highlight,environment,instances,depthLabel,selected=null,onSelect}:{doc:Project;scene:DepthScene;figure:DepthSceneFigure;zoom:number;
 highlight:{nodeIds:string[];edgeIds:string[]};environment?:{label:string};instances:Set<string>;depthLabel:string;
 selected?:string|null;onSelect?:(nodeId:string)=>void}){
 const built=useMemo(()=>buildScene(doc,figure.view),[doc,figure]),reduced=useReducedMotion(),box=useRef<HTMLDivElement>(null);
 const minX=Math.min(figure.bounds.x,built.bounds.x),minY=Math.min(figure.bounds.y,built.bounds.y);
 const width=Math.max(figure.bounds.x+figure.bounds.width,built.bounds.x+built.bounds.width)-minX,height=Math.max(figure.bounds.y+figure.bounds.height,built.bounds.y+built.bounds.height)-minY;
 const lit=new Set(highlight.nodeIds),litEdges=new Set(highlight.edgeIds),marker='lesson-figure-arrow-'+figure.view.id.replace(/[^A-Za-z0-9_-]/g,'-');
 const motion=reduced?'none':'stroke 160ms ease, stroke-width 160ms ease';
 // Bring a highlighted component into the figure's own scroll box (never the page); instant when motion is reduced.
 useEffect(()=>{const el=box.current,id=highlight.nodeIds[0];if(!el||!id||el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight)return;
  const node=built.nodes.find(n=>n.id===id),svg=el.querySelector('svg');if(!node||!svg)return;const k=svg.clientWidth/width;
  el.scrollTo?.({left:Math.max(0,(node.x-minX)*k-el.clientWidth/2+node.w*k/2),top:Math.max(0,(node.y-minY)*k-el.clientHeight/2+node.h*k/2),behavior:reduced?'auto':'smooth'});},[highlight.nodeIds.join(','),zoom]);// eslint-disable-line react-hooks/exhaustive-deps
 const envTag=environment?'declared in '+environment.label:'';
 return <div ref={box} data-testid="lesson-diagram-camera" data-zoom={zoom} style={{overflow:'auto',maxWidth:'100%',maxHeight:'70vh',border:'1px solid '+LINE,borderRadius:8,background:SOFT}}>
  <div data-testid="lesson-diagram-stage" style={{position:'relative',width:`min(${Math.round(zoom*100)}%, ${Math.round(width*zoom)}px)`}}>
  <svg viewBox={`${minX} ${minY} ${width} ${height}`} role="img" data-testid="lesson-diagram-figure" data-depth={figure.depth}
   aria-label={`Lesson figure at depth ${depthLabel}: ${scene.nodes.length} components, ${scene.edges.length} connections, ${figure.frames.length} opened view${figure.frames.length===1?'':'s'}${environment?', environment '+environment.label+' (declared)':''}. Each component is also a button that selects it. The list below is the text and keyboard alternative.`}
   style={{display:'block',width:'100%',height:'auto',fontFamily:`${SCENE_FONT}, Helvetica, sans-serif`}}>
   <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={MUTED}/></marker></defs>
   {figure.frames.map(f=><g key={f.viewId} data-figure-frame={f.viewId} data-frame-via={f.via}>
    <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={12} fill="none" stroke={LINE} strokeWidth={1.5} strokeDasharray="6 4"/>
    <text x={f.x+14} y={f.y+22} fontSize={12} fill={MUTED}>Inside {f.viaLabel} · {f.title}</text>
   </g>)}
   {built.edges.map(e=>{const on=litEdges.has(e.id);return <path key={e.id} data-figure-edge-id={e.id} data-highlighted={on?'true':undefined} d={svgPolylinePath(e.points)} fill="none"
    stroke={on?ACCENT:MUTED} strokeWidth={on?4:2} strokeDasharray={e.dashed?'5 5':undefined} markerEnd={`url(#${marker})`} style={{transition:motion}}/>;})}
   {built.nodes.map(n=>{const on=lit.has(n.id),declared=!!environment&&instances.has(n.id);
    return <g key={n.id} data-figure-node-id={n.id} data-highlighted={on?'true':undefined}>
     <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={12} fill={PANEL} stroke={on||selected===n.id?ACCENT:LINE} strokeWidth={on?4:selected===n.id?3:1} strokeDasharray={selected===n.id&&!on?'8 4':undefined} style={{transition:motion}}/>
     <rect x={n.x} y={n.y+12} width={4} height={28} rx={2} fill={ACCENT}/>
     <Text t={n.provider} fill={MUTED}/><Text t={n.label} fill={INK}/><Text t={n.summary} fill={MUTED}/><Text t={n.footer} fill={ACCENT}/>
     {declared&&<g data-figure-environment={n.id}><rect x={n.x+n.w-14-envTag.length*5.6} y={n.y-10} width={envTag.length*5.6+12} height={18} rx={9} fill={ACCENT}/>
      <text x={n.x+n.w-8} y={n.y+3} fontSize={10} fill={PANEL} textAnchor="end">{envTag}</text></g>}
    </g>;})}
   {built.edges.map(e=>e.label?<Text key={'label-'+e.id} t={e.label} fill={MUTED} halo={SOFT}/>:null)}
  </svg>
  {built.nodes.map(n=>{const name=scene.nodes.find(s=>s.id===n.id)?.label??n.id;
   return <button key={n.id} type="button" className="lesson-figure-hit" data-figure-hit={n.id} aria-pressed={selected===n.id} aria-label={name}
    onClick={()=>onSelect?.(n.id)} style={{left:pct(n.x-minX,width),top:pct(n.y-minY,height),width:pct(n.w,width),height:pct(n.h,height)}}/>;})}
  </div>
 </div>;
}
