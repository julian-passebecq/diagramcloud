import {useEffect,useMemo,useState} from 'react';
import {Button} from '@fluentui/react-components';
import {DESIGN_THEMES,DESIGN_TYPES,errorMessage,parseDocument,type DesignTheme,type DesignType,type Project} from '../core/model';
import {deltaSvg} from '../export/design/delta';
import {publicDocument} from '../core/operations';
import {viewSpec} from '../core/viewspec';
import {DESIGN_THEME_LABEL,DESIGN_TYPE_LABEL,designSvg,resolveDesignType} from '../export/design';
import {download,pngFromSvg} from '../export/browser';
import {recommendFigures} from '../export/design/recommend';

/**
 * Diagram Design mode: the current public view drawn by a Diagram Design renderer. The figure is shown as an image
 * (never injected markup), so it behaves exactly like the downloaded file. Type and theme start from the view's design
 * hints; in Edit mode they can be saved back as hints, and a design brief can set hints for many views at once.
 */
export function DesignPreview({project,viewId,appTheme,edit,busy,onOpen,onSaveHint,onBrief}:{project:Project;viewId:string;appTheme:'light'|'dark';edit:boolean;busy:boolean;
 onOpen:(viewId:string)=>void;onSaveHint:(viewId:string,type:DesignType,theme:DesignTheme)=>void;onBrief:(file:File)=>void}){
 const safe=useMemo(()=>publicDocument(project),[project]),shownId=safe.views.some(v=>v.id===viewId)?viewId:safe.rootViewId,view=safe.views.find(v=>v.id===shownId)!;
 const [type,setType]=useState<DesignType>(view.design?.type??'auto'),[theme,setTheme]=useState<DesignTheme>(view.design?.theme??(appTheme==='dark'?'dark':'light'));
 useEffect(()=>{setType(view.design?.type??'auto');setTheme(view.design?.theme??(appTheme==='dark'?'dark':'light'));},[project.id,shownId,view.design?.type,view.design?.theme]);// eslint-disable-line react-hooks/exhaustive-deps
 const resolved=resolveDesignType(project,shownId,type);
 const svg=useMemo(()=>designSvg(project,shownId,{type,theme}),[project,shownId,type,theme]);
 // Architecture delta: an earlier version of this project, compared with the open one for the current view.
 const [earlier,setEarlier]=useState<Project|null>(null),[compareError,setCompareError]=useState('');
 const compared=useMemo(()=>{if(!earlier)return {svg:'',error:''};try{const [older,newer]=earlier.revision<=project.revision?[earlier,project]:[project,earlier];return {svg:deltaSvg(older,newer,shownId,{theme}),error:''};}catch(e){return {svg:'',error:errorMessage(e)};}},[earlier,project,shownId,theme]),delta=compared.svg;
 const shown=delta||svg;
 const [url,setUrl]=useState('');
 useEffect(()=>{const u=URL.createObjectURL(new Blob([shown],{type:'image/svg+xml'}));setUrl(u);return()=>URL.revokeObjectURL(u);},[shown]);
 const readEarlier=async(file:File)=>{try{if(file.size>16*1024*1024)throw new Error('A project file is at most 16 MiB.');const d=parseDocument(await file.text());if(d.id!==project.id)throw new Error(`That file is project ${d.id}, not ${project.id}: compare two versions of the same project.`);setEarlier(d);}catch(e){setEarlier(null);setCompareError(errorMessage(e));}};
 const suggested=useMemo(()=>recommendFigures(project,shownId).slice(0,3),[project,shownId]);
 const children=useMemo(()=>viewSpec(project,shownId).children,[project,shownId]);
 const name=`${project.id}.${shownId}.design-${resolved}-${theme}`;
 return <section className="design-preview" aria-label="Diagram Design preview" data-testid="design-preview">
  <div className="design-controls">
   <label className="trace-label">Figure <select aria-label="Figure type" value={type} onChange={e=>setType(e.target.value as DesignType)}>{DESIGN_TYPES.map(k=><option key={k} value={k}>{DESIGN_TYPE_LABEL[k]}</option>)}</select></label>
   <label className="trace-label">Theme <select aria-label="Figure theme" value={theme} onChange={e=>setTheme(e.target.value as DesignTheme)}>{DESIGN_THEMES.map(k=><option key={k} value={k}>{DESIGN_THEME_LABEL[k]}</option>)}</select></label>
   <Button size="small" onClick={()=>download(shown,`${delta?`${project.id}.${shownId}.delta`:name}.svg`,'image/svg+xml')}>Download SVG</Button>
   <Button size="small" onClick={()=>void pngFromSvg(shown).then(png=>download(png,`${delta?`${project.id}.${shownId}.delta`:name}.png`))}>PNG</Button>
   {earlier?<Button size="small" onClick={()=>{setEarlier(null);setCompareError('');}}>Close comparison</Button>:<label className="file-button" title="Another diagramcloud.json or authoring export of this project: the figure becomes Before · Changes · After for this view (the lower revision is Before), compared by stable ID. Nothing is imported.">Compare with another version…<input type="file" accept=".json,application/json" aria-label="Compare with another version" onChange={e=>{const f=e.target.files?.[0];if(f)void readEarlier(f);e.target.value='';}}/></label>}
   {edit&&<Button size="small" disabled={busy||project.views.find(v=>v.id===shownId)?.design?.type===type&&project.views.find(v=>v.id===shownId)?.design?.theme===theme} title="Store this figure type and theme on the view, so exports and other people get the same figure." onClick={()=>onSaveHint(shownId,type,theme)}>Use for this view</Button>}
   {edit&&<label className={`file-button${busy?' disabled':''}`} title="A diagramcloud.design-brief JSON (for example written by an AI agent): figure type, focal components, theme and caption per view. Reviewed before it applies.">Read design brief…<input type="file" accept=".json,application/json" aria-label="Read design brief" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)onBrief(f);e.target.value='';}}/></label>}
  </div>
  {!delta&&<p className="design-suggest" aria-label="Suggested figures">Suggested for this view: {suggested.map(r=><button key={r.type} type="button" className="link-button" aria-pressed={resolved===r.type} title={r.reason} onClick={()=>setType(r.type)}>{DESIGN_TYPE_LABEL[r.type]}</button>)} <span className="micro">({suggested[0]?.reason})</span></p>}
  {shownId!==viewId&&<p className="micro">This view is private: the figure shows the public overview instead.</p>}
  {(compareError||compared.error)&&<p className="micro" role="alert">{compareError||compared.error}</p>}
  {url&&<img className="design-figure" src={url} alt={delta?`${view.title}: architecture delta between two versions`:`${view.title}: ${DESIGN_TYPE_LABEL[resolved]} figure`} data-design-type={delta?'delta':resolved} data-theme={theme}/>}
  {children.length>0&&resolved!=='tree'&&<p className="design-open">Open a level: {children.map(ch=><button key={ch.viewId} type="button" className="link-button" onClick={()=>onOpen(ch.viewId)}>{ch.title}</button>)}</p>}
  <p className="micro">Public content only, drawn from the same model as the canvas: static, offline, accessible SVG. Visual grammar adapted from diagram-design (MIT).</p>
 </section>;
}
