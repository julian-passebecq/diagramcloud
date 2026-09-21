import {useMemo,useState} from 'react';
import {Button} from '@fluentui/react-components';
import {blockSchema,newId,type Asset,type EvidenceBlock,type Project,type ProjectNode} from '../core/model';
import {imageAsset} from '../export/browser';
import {
 assetDriveStatus,clearDriveConfig,createDriveAssetFolder,currentDriveSession,dataUrlToBlob,
 downloadDriveImage,drivePickerConfigured,driveRemote,driveSessionValid,loadDriveConfig,
 pickDriveImage,requestDriveAccess,revokeDriveAccess,saveDriveConfig,uploadDriveImage,
 type DriveConfig,type DriveSession
} from '../connectors/googleDrive';

type Props={
 doc:Project;
 selectedNode?:ProjectNode;
 onAttach:(asset:Asset,block:EvidenceBlock)=>void;
 onUpdateAsset:(asset:Asset)=>void;
 onError:(message:string)=>void;
};

export function DriveAssetManager(p:Props){
 const [config,setConfig]=useState<DriveConfig>(()=>loadDriveConfig());
 const [session,setSession]=useState<DriveSession|null>(()=>currentDriveSession());
 const [busy,setBusy]=useState('');
 const [status,setStatus]=useState('');
 const [provenance,setProvenance]=useState<EvidenceBlock['provenance']>('synthetic');
 const connected=driveSessionValid(session);
 const imageAssets=useMemo(()=>p.doc.assets,[p.doc.assets]);

 const run=async(label:string,work:()=>Promise<void>)=>{setBusy(label);setStatus('');try{await work();}catch(error){p.onError(error instanceof Error?error.message:String(error));}finally{setBusy('');}};
 const ensureSession=async()=>{if(driveSessionValid(session))return session;const next=await requestDriveAccess(config);setSession(next);return next;};
 const ensureFolder=async(token:string)=>{if(config.folderId)return config.folderId;const folder=await createDriveAssetFolder(token);const next={...config,folderId:folder.id};saveDriveConfig(next);setConfig(next);return folder.id;};
 const connect=()=>run('connect',async()=>{const next=await requestDriveAccess(config);setSession(next);setStatus('Google Drive connected for this browser session.');});
 const disconnect=()=>run('disconnect',async()=>{await revokeDriveAccess(session);setSession(null);setStatus('Drive session disconnected.');});
 const backup=(asset:Asset)=>run(`backup-${asset.id}`,async()=>{
  const active=await ensureSession(),folder=await ensureFolder(active.accessToken),blob=dataUrlToBlob(asset.data);
  const file=await uploadDriveImage(blob,asset.name,active.accessToken,folder);
  p.onUpdateAsset({...asset,remote:driveRemote(file)});
  setStatus(`${asset.name} backed up to Drive. PPTX still uses the cached local copy.`);
 });
 const refresh=(asset:Asset)=>run(`refresh-${asset.id}`,async()=>{
  if(!asset.remote)throw new Error('This image is not linked to Google Drive');
  const active=await ensureSession(),downloaded=await downloadDriveImage(asset.remote.fileId,active.accessToken),normalized=await imageAsset(downloaded.file);
  p.onUpdateAsset({...normalized,id:asset.id,name:asset.name,rights:asset.rights,visibility:asset.visibility,remote:driveRemote(downloaded.metadata)});
  setStatus(`${asset.name} refreshed from Drive and cached locally.`);
 });
 const importFromDrive=()=>run('import',async()=>{
  if(!p.selectedNode)throw new Error('Select a component before importing Drive evidence');
  const active=await ensureSession(),fileId=await pickDriveImage(config,active);if(!fileId)return;
  const downloaded=await downloadDriveImage(fileId,active.accessToken),asset=await imageAsset(downloaded.file);
  asset.remote=driveRemote(downloaded.metadata);
  const block=blockSchema.parse({
   id:newId('image'),title:downloaded.metadata.name.slice(0,160),type:'image',assetId:asset.id,
   caption:provenance==='synthetic'?'AI-generated / synthetic visual cached from Google Drive':'Image evidence cached from Google Drive',
   provenance
  });
  p.onAttach(asset,block);
  setStatus(`${downloaded.metadata.name} attached to ${p.selectedNode.label}. The cached copy is available to PPTX and offline HTML.`);
 });
 const saveSettings=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const f=new FormData(event.currentTarget),next:DriveConfig={
  clientId:String(f.get('clientId')??'').trim(),apiKey:String(f.get('apiKey')??'').trim(),appId:String(f.get('appId')??'').trim(),folderId:config.folderId
 };saveDriveConfig(next);setConfig(next);setStatus('Drive connector settings saved in this browser only.');};
 const forget=()=>{clearDriveConfig();const next={clientId:'',apiKey:'',appId:'',folderId:''};setConfig(next);setSession(null);setStatus('Local Drive connector settings cleared.');};

 return <div className="drive-manager">
  <div className="note-card"><strong>Optional asset vault.</strong> Drive is never the project database. DiagramCloud keeps a sanitized cached image inside the authoring document, so PPTX/HTML exports do not need a live Google token.</div>
  <form className="property-form drive-config" onSubmit={saveSettings}>
   <label>Google OAuth client ID<input name="clientId" defaultValue={config.clientId} placeholder="...apps.googleusercontent.com" autoComplete="off"/></label>
   <label>Picker API key <span className="micro">optional for upload-only</span><input name="apiKey" defaultValue={config.apiKey} autoComplete="off"/></label>
   <label>Cloud project number / App ID <span className="micro">required for Picker</span><input name="appId" defaultValue={config.appId} inputMode="numeric" autoComplete="off"/></label>
   <div className="toolbar"><Button type="submit">Save connector settings</Button><Button appearance="subtle" type="button" onClick={forget}>Forget settings</Button></div>
  </form>
  <p className="micro">Client ID, restricted API key and project number are public app configuration, not OAuth secrets. Access tokens stay in memory and are never written to DiagramCloud JSON or localStorage.</p>
  <div className="drive-session">
   <span className={connected?'drive-state connected':'drive-state'}>{connected?'Connected':'Not connected'}</span>
   {connected?<Button onClick={disconnect} disabled={!!busy}>Disconnect</Button>:<Button appearance="primary" onClick={connect} disabled={!config.clientId||!!busy}>{busy==='connect'?'Connecting…':'Connect Google Drive'}</Button>}
  </div>
  <hr/>
  <h3>Import image evidence</h3>
  <label>Provenance<select value={provenance} onChange={e=>setProvenance(e.target.value as EvidenceBlock['provenance'])}><option value="synthetic">Synthetic / AI-generated</option><option value="author">Author-created</option><option value="source-derived">Source-derived</option><option value="reference">Reference</option></select></label>
  <Button appearance="primary" onClick={importFromDrive} disabled={!connected||!drivePickerConfigured(config)||!p.selectedNode||!!busy}>{busy==='import'?'Opening Drive…':'Choose image from Drive'}</Button>
  {!p.selectedNode&&<p className="micro">Select a component first; imported images become evidence on that component.</p>}
  {!drivePickerConfigured(config)&&<p className="micro">Picker import needs client ID + API key + project number. Upload/back-up only needs the OAuth client ID.</p>}
  <hr/>
  <div className="drive-heading"><h3>Project image assets</h3><span className="micro">{imageAssets.length} cached</span></div>
  {imageAssets.length===0?<p className="muted">No project images yet. Attach or import an image to create the first asset.</p>:<div className="drive-asset-list">{imageAssets.map(asset=><div className="drive-asset-row" key={asset.id}>
   <img src={asset.data} alt=""/>
   <div><strong>{asset.name}</strong><small>{assetDriveStatus(asset)==='drive'?'Drive-backed · local cache retained':'Local only'}</small>{asset.remote?.webViewLink&&<a href={asset.remote.webViewLink} target="_blank" rel="noopener noreferrer">Open in Drive ↗</a>}</div>
   <div className="drive-actions">{asset.remote?<Button size="small" onClick={()=>refresh(asset)} disabled={!connected||!!busy}>{busy===`refresh-${asset.id}`?'Refreshing…':'Refresh cache'}</Button>:<Button size="small" onClick={()=>backup(asset)} disabled={!connected||!!busy}>{busy===`backup-${asset.id}`?'Uploading…':'Back up to Drive'}</Button>}</div>
  </div>)}</div>}
  {config.folderId&&<div className="toolbar drive-folder"><span className="micro">DiagramCloud Assets folder linked</span><Button appearance="subtle" size="small" onClick={()=>{const next={...config,folderId:''};saveDriveConfig(next);setConfig(next);setStatus('Folder link reset; the next upload will create a new DiagramCloud Assets folder.');}}>Reset folder link</Button></div>}
  {status&&<p role="status" className="validation-success">{status}</p>}
 </div>;
}
