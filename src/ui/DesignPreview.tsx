import {useEffect,useMemo,useState} from 'react';
import {Button} from '@fluentui/react-components';
import {DESIGN_THEMES,DESIGN_TYPES,type DesignTheme,type DesignType,type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {viewSpec} from '../core/viewspec';
import {DESIGN_THEME_LABEL,DESIGN_TYPE_LABEL,designSvg,resolveDesignType} from '../export/design';
import {download,pngFromSvg} from '../export/browser';

/**
 * Diagram Design mode: the current public view drawn by a Diagram Design renderer. The figure is shown as an image
 * (never injected markup), so it behaves exactly like the downloaded file. Type and theme start from the view's design
 * hints; in Edit mode they can be saved back as hints, and a design brief can set hints for many views at once.
 */
export function DesignPreview({project,viewId,appTheme,edit,busy,onOpen,onSaveHint,onBrief}:{project:Project;viewId:string;appTheme:'light'|'dark';edit:boolean;busy:boolean;
 onOpen:(viewId:string)=>void;onSaveHint:(viewId:string,type:DesignType,theme:DesignTheme)=>void;onBrief:(file:File)=>void}){
 const safe=useMemo(()=>publicDocument(project),[project]),shownId=safe.views.some(v=>v.id===viewId)?viewId:safe.rootViewId,view=safe.views.find(v=>v.id===shownId)!;
 const [type,setType]=useState<DesignType>(view.design?.type??'auto'),[theme,setTheme]=useState<DesignTheme>(view.design?.theme??(appTheme==='dark'?'dark':'light'));
 useEffect(()=>{setType(view.design?.type??'auto');setTheme(view.design?.theme??(appTheme==='dark'?'dark':'light'));},[shownId]);// eslint-disable-line react-hooks/exhaustive-deps
 const resolved=resolveDesignType(project,shownId,type);
 const svg=useMemo(()=>designSvg(project,shownId,{type,theme}),[project,shownId,type,theme]);
 const [url,setUrl]=useState('');
 useEffect(()=>{const u=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));setUrl(u);return()=>URL.revokeObjectURL(u);},[svg]);
 const children=useMemo(()=>viewSpec(project,shownId).children,[project,shownId]);
 const name=`${project.id}.${shownId}.design-${resolved}-${theme}`;
 return <section className="design-preview" aria-label="Diagram Design preview" data-testid="design-preview">
  <div className="design-controls">
   <label className="trace-label">Figure <select aria-label="Figure type" value={type} onChange={e=>setType(e.target.value as DesignType)}>{DESIGN_TYPES.map(k=><option key={k} value={k}>{DESIGN_TYPE_LABEL[k]}</option>)}</select></label>
   <label className="trace-label">Theme <select aria-label="Figure theme" value={theme} onChange={e=>setTheme(e.target.value as DesignTheme)}>{DESIGN_THEMES.map(k=><option key={k} value={k}>{DESIGN_THEME_LABEL[k]}</option>)}</select></label>
   <Button size="small" onClick={()=>download(svg,`${name}.svg`,'image/svg+xml')}>Download SVG</Button>
   <Button size="small" onClick={()=>void pngFromSvg(svg).then(png=>download(png,`${name}.png`))}>PNG</Button>
   {edit&&<Button size="small" disabled={busy||project.views.find(v=>v.id===shownId)?.design?.type===type&&project.views.find(v=>v.id===shownId)?.design?.theme===theme} title="Store this figure type and theme on the view, so exports and other people get the same figure." onClick={()=>onSaveHint(shownId,type,theme)}>Use for this view</Button>}
   {edit&&<label className={`file-button${busy?' disabled':''}`} title="A diagramcloud.design-brief JSON (for example written by an AI agent): figure type, focal components, theme and caption per view. Reviewed before it applies.">Read design brief…<input type="file" accept=".json,application/json" aria-label="Read design brief" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)onBrief(f);e.target.value='';}}/></label>}
  </div>
  {shownId!==viewId&&<p className="micro">This view is private: the figure shows the public overview instead.</p>}
  {url&&<img className="design-figure" src={url} alt={`${view.title}: ${DESIGN_TYPE_LABEL[resolved]} figure`} data-design-type={resolved} data-theme={theme}/>}
  {children.length>0&&resolved!=='tree'&&<p className="design-open">Open a level: {children.map(ch=><button key={ch.viewId} type="button" className="link-button" onClick={()=>onOpen(ch.viewId)}>{ch.title}</button>)}</p>}
  <p className="micro">Public content only, drawn from the same model as the canvas: static, offline, accessible SVG. Visual grammar adapted from diagram-design (MIT).</p>
 </section>;
}
