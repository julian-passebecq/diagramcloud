import type {Asset} from '../core/model';

export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const CONFIG_KEY='diagramcloud-google-drive-config-v1';
const GIS_SRC='https://accounts.google.com/gsi/client';
const GAPI_SRC='https://apis.google.com/js/api.js';
const DRIVE_API='https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD='https://www.googleapis.com/upload/drive/v3';

export type DriveConfig={clientId:string;apiKey:string;appId:string;folderId:string};
export type DriveSession={accessToken:string;expiresAt:number};
export type DriveFile={
 id:string;
 name:string;
 mimeType:string;
 webViewLink?:string;
 modifiedTime?:string;
 size?:string;
};
type TokenResponse={access_token?:string;expires_in?:number;error?:string;error_description?:string};
type TokenClient={requestAccessToken:(options?:{prompt?:string})=>void};

type GoogleIdentity={
 accounts:{oauth2:{
  initTokenClient:(config:{
   client_id:string;
   scope:string;
   callback:(response:TokenResponse)=>void;
   error_callback?:(error:{type?:string;message?:string})=>void;
  })=>TokenClient;
  revoke?:(token:string,done:()=>void)=>void;
 }};
};
type PickerView={setMimeTypes:(types:string)=>PickerView};
type PickerInstance={setVisible:(visible:boolean)=>void};
type PickerBuilder={
 setOAuthToken:(token:string)=>PickerBuilder;
 setDeveloperKey:(key:string)=>PickerBuilder;
 setAppId:(id:string)=>PickerBuilder;
 setOrigin:(origin:string)=>PickerBuilder;
 addView:(view:PickerView)=>PickerBuilder;
 setCallback:(callback:(data:{action?:string;docs?:Array<{id?:string}>})=>void)=>PickerBuilder;
 build:()=>PickerInstance;
};
type GooglePicker={
 picker:{
  PickerBuilder:new()=>PickerBuilder;
  DocsView:new(id:string)=>PickerView;
  ViewId:{DOCS_IMAGES:string};
 };
};
type Gapi={load:(name:string,options:{callback:()=>void;onerror?:()=>void;timeout?:number;ontimeout?:()=>void})=>void};

const scriptPromises=new Map<string,Promise<void>>();
let memorySession:DriveSession|null=null;

function envConfig():Partial<DriveConfig>{
 const env=(import.meta as ImportMeta&{env?:Record<string,string|undefined>}).env??{};
 return{
  clientId:env.VITE_GOOGLE_CLIENT_ID??'',
  apiKey:env.VITE_GOOGLE_PICKER_API_KEY??'',
  appId:env.VITE_GOOGLE_APP_ID??'',
  folderId:''
 };
}
function safeStoredConfig():Partial<DriveConfig>{
 if(typeof localStorage==='undefined')return{};
 try{
  const raw=localStorage.getItem(CONFIG_KEY);
  return raw?JSON.parse(raw) as Partial<DriveConfig>:{};
 }catch{return{};}
}
export function loadDriveConfig():DriveConfig{
 const env=envConfig(),stored=safeStoredConfig();
 return{
  clientId:String(stored.clientId||env.clientId||'').trim(),
  apiKey:String(stored.apiKey||env.apiKey||'').trim(),
  appId:String(stored.appId||env.appId||'').trim(),
  folderId:String(stored.folderId||'').trim()
 };
}
export function saveDriveConfig(config:DriveConfig):void{
 if(typeof localStorage==='undefined')return;
 localStorage.setItem(CONFIG_KEY,JSON.stringify(config));
}
export function clearDriveConfig():void{
 if(typeof localStorage!=='undefined')localStorage.removeItem(CONFIG_KEY);
 memorySession=null;
}
export function drivePickerConfigured(config:DriveConfig):boolean{return !!(config.clientId&&config.apiKey&&config.appId);}
export function driveSessionValid(session:DriveSession|null,skewMs=60_000):session is DriveSession{return !!session&&session.expiresAt-Date.now()>skewMs;}
export function currentDriveSession():DriveSession|null{return driveSessionValid(memorySession)?memorySession:null;}

function loadScript(src:string,id:string):Promise<void>{
 if(typeof document==='undefined')return Promise.reject(new Error('Google Drive connection requires a browser'));
 const existing=document.getElementById(id) as HTMLScriptElement|null;
 if(existing?.dataset.loaded==='true')return Promise.resolve();
 const cached=scriptPromises.get(id);if(cached)return cached;
 const promise=new Promise<void>((resolve,reject)=>{
  const script=existing??document.createElement('script');
  script.id=id;script.async=true;script.defer=true;
  script.onload=()=>{script.dataset.loaded='true';resolve();};
  script.onerror=()=>{script.remove();scriptPromises.delete(id);reject(new Error('Could not load Google client library'));};
  if(!existing){script.src=src;document.head.appendChild(script);}
 }).catch(error=>{scriptPromises.delete(id);throw error;});
 scriptPromises.set(id,promise);return promise;
}
function googleIdentity():GoogleIdentity{
 const google=(window as unknown as {google?:GoogleIdentity}).google;
 if(!google?.accounts?.oauth2)throw new Error('Google Identity Services did not initialize');
 return google;
}
function googlePicker():GooglePicker{
 const google=(window as unknown as {google?:GooglePicker}).google;
 if(!google?.picker)throw new Error('Google Picker did not initialize');
 return google;
}
function gapi():Gapi{
 const value=(window as unknown as {gapi?:Gapi}).gapi;
 if(!value)throw new Error('Google API loader did not initialize');
 return value;
}

export async function requestDriveAccess(config:DriveConfig):Promise<DriveSession>{
 if(!config.clientId)throw new Error('Add a Google OAuth client ID before connecting Drive');
 await loadScript(GIS_SRC,'diagramcloud-google-identity');
 const session=await new Promise<DriveSession>((resolve,reject)=>{
  let settled=false;
  const client=googleIdentity().accounts.oauth2.initTokenClient({
   client_id:config.clientId,
   scope:DRIVE_SCOPE,
   callback:response=>{
    if(settled)return;
    if(response.error||!response.access_token){settled=true;reject(new Error(response.error_description||response.error||'Google authorization failed'));return;}
    settled=true;resolve({accessToken:response.access_token,expiresAt:Date.now()+Math.max(60,Number(response.expires_in??3600))*1000});
   },
   error_callback:error=>{if(!settled){settled=true;reject(new Error(error.message||error.type||'Google authorization popup failed'));}}
  });
  client.requestAccessToken({prompt:''});
 });
 memorySession=session;return session;
}
export async function revokeDriveAccess(session:DriveSession|null=memorySession):Promise<void>{
 memorySession=null;
 if(!session||typeof window==='undefined')return;
 try{
  await loadScript(GIS_SRC,'diagramcloud-google-identity');
  await new Promise<void>(resolve=>{
   const revoke=googleIdentity().accounts.oauth2.revoke;
   if(!revoke){resolve();return;}
   revoke(session.accessToken,resolve);
  });
 }catch{/* Revocation is best-effort; local token is already discarded. */}
}

async function driveError(response:Response):Promise<Error>{
 let detail='';
 try{
  const body=await response.json() as {error?:{message?:string}};
  detail=body.error?.message??'';
 }catch{/* Ignore non-JSON error responses. */}
 return new Error(detail||`Google Drive request failed (${response.status})`);
}
function authHeaders(token:string):HeadersInit{return{Authorization:`Bearer ${token}`};}
export function dataUrlToBlob(data:string):Blob{
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data);
 if(!match)throw new Error('Asset is not an embedded PNG, JPEG or WebP');
 const binary=atob(match[2]),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Blob([bytes],{type:match[1]});
}
export function driveRemote(file:DriveFile){
 if(!['image/png','image/jpeg','image/webp'].includes(file.mimeType))throw new Error('Google Drive file is not a supported image');
 return{
  provider:'google-drive' as const,
  fileId:file.id,
  fileName:file.name.slice(0,160),
  mimeType:file.mimeType as 'image/png'|'image/jpeg'|'image/webp',
  ...(file.webViewLink?{webViewLink:file.webViewLink}:{}),
  ...(file.modifiedTime?{modifiedTime:file.modifiedTime}:{}),
  ...(file.size?{size:file.size}:{}),
  savedAt:new Date().toISOString()
 };
}
export async function createDriveAssetFolder(token:string,name='DiagramCloud Assets'):Promise<DriveFile>{
 const response=await fetch(`${DRIVE_API}/files?fields=id,name,mimeType,webViewLink,modifiedTime`,{
  method:'POST',
  headers:{...authHeaders(token),'Content-Type':'application/json'},
  body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',appProperties:{diagramcloud:'assets-v1'}})
 });
 if(!response.ok)throw await driveError(response);
 return await response.json() as DriveFile;
}
const DRIVE_ARCHIVE_TYPES=new Set([
 'image/png','image/jpeg','image/webp',
 'application/pdf',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
function archiveMime(blob:Blob,name:string):string{
 const lower=name.toLowerCase(),mime=blob.type||
  (lower.endsWith('.pdf')?'application/pdf':
   lower.endsWith('.pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':
   lower.endsWith('.png')?'image/png':
   lower.endsWith('.jpg')||lower.endsWith('.jpeg')?'image/jpeg':
   lower.endsWith('.webp')?'image/webp':'');
 if(!DRIVE_ARCHIVE_TYPES.has(mime))throw new Error('Drive archive accepts PNG, JPEG, WebP, PDF or PPTX files');
 if(blob.size>25*1024*1024)throw new Error('Drive archive files are limited to 25 MiB');
 return mime;
}
export async function uploadDriveFile(blob:Blob,name:string,token:string,parentId=''):Promise<DriveFile>{
 const mime=archiveMime(blob,name),boundary=`diagramcloud_${crypto.randomUUID().replaceAll('-','')}`;
 const metadata:{name:string;parents?:string[]}={name:name.slice(0,160)||'diagramcloud-export'};
 if(parentId)metadata.parents=[parentId];
 const body=new Blob([
  `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
  JSON.stringify(metadata),
  `\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  blob,
  `\r\n--${boundary}--`
 ],{type:`multipart/related; boundary=${boundary}`});
 const response=await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime,size`,{
  method:'POST',headers:{...authHeaders(token),'Content-Type':`multipart/related; boundary=${boundary}`},body
 });
 if(!response.ok)throw await driveError(response);
 return await response.json() as DriveFile;
}
export async function uploadDriveImage(blob:Blob,name:string,token:string,parentId=''):Promise<DriveFile>{
 if(!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error('Only PNG, JPEG and WebP can be uploaded as DiagramCloud image evidence');
 return uploadDriveFile(blob,name,token,parentId);
}
export async function getDriveFileMetadata(fileId:string,token:string):Promise<DriveFile>{
 const response=await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink,modifiedTime,size`,{headers:authHeaders(token)});
 if(!response.ok)throw await driveError(response);
 return await response.json() as DriveFile;
}
export async function downloadDriveImage(fileId:string,token:string):Promise<{file:File;metadata:DriveFile}>{
 const metadata=await getDriveFileMetadata(fileId,token);
 if(!['image/png','image/jpeg','image/webp'].includes(metadata.mimeType))throw new Error('Choose a PNG, JPEG or WebP image from Drive');
 if(metadata.size&&Number(metadata.size)>8*1024*1024)throw new Error('Drive image exceeds the 8 MiB import limit');
 const response=await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{headers:authHeaders(token)});
 if(!response.ok)throw await driveError(response);
 const blob=await response.blob();
 if(blob.size>8*1024*1024)throw new Error('Drive image exceeds the 8 MiB import limit');
 return{file:new File([blob],metadata.name,{type:metadata.mimeType}),metadata};
}
async function loadPicker():Promise<void>{
 await loadScript(GAPI_SRC,'diagramcloud-google-api');
 await new Promise<void>((resolve,reject)=>gapi().load('picker',{callback:resolve,onerror:()=>reject(new Error('Could not load Google Picker')),timeout:10_000,ontimeout:()=>reject(new Error('Google Picker timed out'))}));
}
export async function pickDriveImage(config:DriveConfig,session:DriveSession):Promise<string|null>{
 if(!drivePickerConfigured(config))throw new Error('Google Picker needs OAuth client ID, API key and Cloud project number');
 if(!driveSessionValid(session))throw new Error('Google Drive session expired. Connect again.');
 await loadPicker();const api=googlePicker();
 return await new Promise<string|null>((resolve,reject)=>{
  let settled=false;
  const view=new api.picker.DocsView(api.picker.ViewId.DOCS_IMAGES).setMimeTypes('image/png,image/jpeg,image/webp');
  try{
   new api.picker.PickerBuilder()
    .setOAuthToken(session.accessToken)
    .setDeveloperKey(config.apiKey)
    .setAppId(config.appId)
    .setOrigin(window.location.origin)
    .addView(view)
    .setCallback(data=>{
     if(settled)return;
     if(data.action==='picked'){settled=true;resolve(data.docs?.[0]?.id??null);}
     else if(data.action==='cancel'){settled=true;resolve(null);}
    }).build().setVisible(true);
  }catch(error){settled=true;reject(error);}
 });
}
export function assetDriveStatus(asset:Asset):'local'|'drive'{return asset.remote?.provider==='google-drive'?'drive':'local';}
