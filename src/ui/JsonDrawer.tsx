import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';
import {applyDraft,checkDraft,createLatestValidator,draftText,type DraftBase,type DraftCheck,type DraftScope} from '../core/jsonDraft';
import {ChangePreview} from '../app/ReviewShell';

type Props={visible:boolean;project:Project;live:()=>Project;selectedNodeId:string|null;onApply:(next:Project)=>boolean;onClose:()=>void;history:{canUndo:boolean;canRedo:boolean;onUndo:()=>void;onRedo:()=>void}};
type Loaded={base:DraftBase;applied:Project;text:string;error:string};
type Status='unchanged'|'validating'|'valid'|'invalid';
function load(project:Project,scope:DraftScope):Loaded{
 const base={projectId:project.id,revision:project.revision,scope};
 try{return {base,applied:project,text:draftText(project,scope),error:''};}catch(e){return {base,applied:project,text:'',error:errorMessage(e)};}
}

/**
 * Native JSON drawer (Edit mode only). Three distinct states: the applied model (live revision), the current draft
 * (text only, keystrokes never save) and the last valid preview, kept while the draft is invalid. Apply revalidates
 * against the live project and commits one undoable revision. It stays mounted so a draft survives a mode switch, but
 * renders nothing unless visible: public modes never receive authoring JSON from here.
 */
export function JsonDrawer({visible,project,live,selectedNodeId,onApply,onClose,history}:Props){
 const [loaded,setLoaded]=useState<Loaded|null>(null),[draft,setDraft]=useState(''),[status,setStatus]=useState<Status>('unchanged'),[error,setError]=useState(''),[lastValid,setLastValid]=useState<Extract<DraftCheck,{ok:true}>|null>(null),[notice,setNotice]=useState<{kind:'ok'|'refused';text:string}|null>(null);
 const ref=useRef(loaded);ref.current=loaded;
 const validator=useMemo(()=>createLatestValidator((text:string)=>{const l=ref.current;return l?checkDraft(l.base,l.applied,text):{ok:false as const,text,error:'No draft loaded'};},(_text,result:DraftCheck)=>{if(result.ok){setLastValid(result);setStatus('valid');setError('');}else{setStatus('invalid');setError(result.error);}},300),[]);
 useEffect(()=>()=>validator.cancel(),[validator]);
 const dirty=!!loaded&&draft!==loaded.text;
 const reset=(project:Project,scope:DraftScope)=>{validator.cancel();const l=load(project,scope);setLoaded(l);setDraft(l.text);setStatus('unchanged');setError(l.error);setLastValid(null);};
 // An untouched draft follows the applied model (visual edits, Undo, project switch); an edited draft is never replaced.
 useEffect(()=>{if(!visible)return;if(!loaded){reset(project,{kind:'project'});return;}if(!dirty&&(loaded.applied!==project))reset(project,loaded.base.scope);},[visible,project]);
 if(!visible||!loaded)return null;
 const scope=loaded.base.scope,otherProject=project.id!==loaded.base.projectId,stale=!otherProject&&loaded.applied!==project;
 const edit=(text:string)=>{setDraft(text);setNotice(null);if(text===loaded.text){validator.cancel();setStatus('unchanged');setError(loaded.error);setLastValid(null);return;}setStatus('validating');validator.submit(text);};
 const canApply=status==='valid'&&!!lastValid&&lastValid.text===draft;
 const apply=()=>{
  try{const before=live(),next=applyDraft(loaded.base,before,draft,loaded.applied);
   if(!onApply(next)){setNotice({kind:'refused',text:'Refused: the project did not accept this revision. Nothing was applied.'});return;}
   const now=live();reset(now,scope.kind==='node'&&now.nodes.some(n=>n.id===scope.id)?scope:{kind:'project'});setNotice({kind:'ok',text:`Applied as revision ${now.revision}. One Undo restores revision ${before.revision}.`});
  }catch(e){setNotice({kind:'refused',text:errorMessage(e)});}
 };
 const choose=(value:string)=>{setNotice(null);reset(project,value==='project'||!selectedNodeId?{kind:'project'}:{kind:'node',id:selectedNodeId});};
 const counts=(p:Project)=>`${p.nodes.length} components · ${p.edges.length} connections · ${p.views.length} views`;
 return <aside className="json-drawer" role="complementary" aria-label="JSON drawer">
  <div className="json-drawer-head"><h2>JSON drawer</h2><Button appearance="subtle" onClick={onClose} aria-label="Close JSON drawer">✕</Button></div>
  <section className="json-drawer-state" aria-label="Applied model"><div className="eyebrow">APPLIED MODEL</div>
   <p><b>{project.title}</b> · revision <span data-testid="applied-revision">{project.revision}</span><br/><span className="micro">{counts(project)}</span></p>
   <div className="toolbar"><Button size="small" disabled={!history.canUndo} onClick={history.onUndo}>Undo last revision</Button><Button size="small" disabled={!history.canRedo} onClick={history.onRedo}>Redo revision</Button><span className="micro">Same project history as the canvas.</span></div>
   {otherProject&&<p className="revision-warning" role="status">This draft belongs to project “{loaded.base.projectId}”, but “{project.id}” is open. Apply is refused; discard the draft or return to that project.</p>}
   {stale&&<p className="revision-warning" role="status">The applied model changed after this draft started (draft base: revision {loaded.base.revision}, now revision {project.revision}). Apply will be refused; reload the draft and redo the edit.</p>}
  </section>
  <section className="json-drawer-state" aria-label="Current draft"><div className="eyebrow">CURRENT DRAFT</div>
   <div className="two-fields"><label>Scope<select aria-label="Draft scope" value={scope.kind==='node'?'node':'project'} disabled={dirty} onChange={e=>choose(e.target.value)}><option value="project">Whole project</option><option value="node" disabled={!selectedNodeId&&scope.kind!=='node'}>{scope.kind==='node'?`Component ${scope.id}`:selectedNodeId?`Selected component ${selectedNodeId}`:'Select a component first'}</option></select></label></div>
   {dirty&&<p className="micro">Discard or apply the draft before changing scope.</p>}
   <p className="micro" role="status" data-testid="draft-status">{status==='unchanged'?(loaded.error?'No draft: '+loaded.error:'Unchanged · matches the applied model'):status==='validating'?'Edited · validating…':status==='valid'?'Edited · valid · not applied yet':'Edited · invalid · Apply is disabled'}</p>
   {status==='invalid'&&<pre className="validation-error" role="alert" data-testid="draft-error">{error}</pre>}
   <textarea className="json-drawer-text" aria-label="JSON draft" spellCheck={false} value={draft} readOnly={!!loaded.error&&!loaded.text} onChange={e=>edit(e.target.value)}/>
   <div className="toolbar"><Button appearance="primary" disabled={!canApply} onClick={apply}>Apply draft</Button><Button onClick={()=>{setNotice(null);reset(project,scope.kind==='node'&&!project.nodes.some(n=>n.id===scope.id)?{kind:'project'}:scope);}}>{dirty?'Discard draft':'Reload from applied model'}</Button></div>
   {notice&&<p className={notice.kind==="ok"?"micro":"validation-error"} role={notice.kind==='ok'?'status':'alert'} data-testid="draft-notice">{notice.text}</p>}
  </section>
  <section className="json-drawer-state" aria-label="Last valid preview"><div className="eyebrow">LAST VALID PREVIEW</div>
   {lastValid?<>{lastValid.text!==draft&&<p className="micro">From an earlier version of the draft; the current draft is not valid, so nothing can be applied.</p>}<ChangePreview preview={lastValid.preview}/>
    {lastValid.decisions.length>0&&<p className="revision-warning">Rewrites or removes accepted decision{lastValid.decisions.length===1?'':'s'}: {lastValid.decisions.join(', ')}. Their author, date and sources change only if you apply this on purpose.</p>}</>
    :<p className="muted">No valid edited draft yet. Keystrokes never save; only Apply creates a revision.</p>}
  </section>
 </aside>;
}
