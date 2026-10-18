import {pathTo,perspectiveOf,PERSPECTIVE_LABEL} from '../core/viewspec';
import {validatePublicationBrief,publicationBriefSchema,type PublicationBrief} from './publicationBrief';
import {z} from 'zod';
import {validateDocument,type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {secretFindings} from '../core/secrets';
import type {LibraryTarget} from '../core/links';
const key=z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/);
export const collectionSchema=z.object({format:z.literal('diagramcloud.collection/1'),id:key,title:z.string().min(1).max(160),revision:z.number().int().nonnegative(),projectIds:z.array(key).max(100),publicationIds:z.array(key).max(100),visibility:z.enum(['private','public'])}).strict();
export type ProjectCollection=z.infer<typeof collectionSchema>;
export function validateCollection(input:unknown){const c=collectionSchema.parse(input);if(new Set(c.projectIds).size!==c.projectIds.length||new Set(c.publicationIds).size!==c.publicationIds.length)throw new Error('Duplicate collection member');if(secretFindings(c,'collection').length)throw new Error('Collection contains sensitive text');return c;}
/** digest binds the frozen public document only. outputDigest additionally binds
 * its output header and normalized presentation settings. Neither is a signature
 * or external verification claim. Older snapshots retain an explicit unbound header. */
export type PublicationSnapshot={format:'diagramcloud.publication-snapshot/1';id:string;projectId:string;projectRevision:number;createdAt:string;digest:string;outputDigest?:string;outputBinding:'bound'|'legacy-unbound';title:string;audience:string;viewIds:string[];sourceVector:{repositoryId:string;revision:string|null}[];document:Project;brief?:PublicationBrief};
const digestSchema=z.string().regex(/^sha256:[a-f0-9]{64}$/);
const snapshotSchema=z.object({format:z.literal('diagramcloud.publication-snapshot/1'),id:key,projectId:key,projectRevision:z.number().int().nonnegative(),createdAt:z.string().datetime({offset:true}),digest:digestSchema,outputDigest:digestSchema.optional(),outputBinding:z.enum(['bound','legacy-unbound']).optional(),title:z.string().max(160),audience:z.string().max(160),viewIds:z.array(key).min(1).max(80),sourceVector:z.array(z.object({repositoryId:key,revision:z.string().max(200).nullable()}).strict()).max(80),document:z.unknown(),brief:publicationBriefSchema.optional()}).strict();
export async function validatePublication(input:unknown):Promise<PublicationSnapshot>{
 const value=snapshotSchema.parse(input),document=validateDocument(value.document);
 const {document:ignoredDocument,...header}=value;
 if(secretFindings(header,'publication header').length)throw new Error('Publication header contains sensitive text');
 if(new Set(value.viewIds).size!==value.viewIds.length)throw new Error('Duplicate publication view selection');
 if(document.id!==value.projectId||document.revision!==value.projectRevision)throw new Error('Publication identity/revision mismatch');
 if(JSON.stringify(publicDocument(document))!==JSON.stringify(document))throw new Error('Publication contains non-public authoring data');
 if(value.viewIds.some(id=>!document.views.some(v=>v.id===id)))throw new Error('Publication references a missing public view');
 const expected=document.atlas?.snapshots.find(s=>s.id===document.atlas?.activeSnapshotId)?.repositories.map(r=>({repositoryId:r.id,revision:r.revision??null}))??[];
 if(JSON.stringify(value.sourceVector)!==JSON.stringify(expected))throw new Error('Publication source vector differs from its frozen document');
 if(value.brief){const brief=validatePublicationBrief(value.brief,document);if(JSON.stringify(brief.viewIds)!==JSON.stringify(value.viewIds)||brief.title!==value.title||brief.audience!==value.audience)throw new Error('Publication brief differs from its frozen selections');}
 if(await publicationDigest(document)!==value.digest)throw new Error('Publication content digest mismatch');
 if(value.outputDigest&&await publicationOutputDigest(value)!==value.outputDigest)throw new Error('Publication output digest mismatch');
 return {...value,document,outputBinding:value.outputDigest?'bound':'legacy-unbound'};
}
async function jsonDigest(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return 'sha256:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
async function publicationDigest(document:Project){return jsonDigest(document);}
async function publicationOutputDigest(value:Omit<PublicationSnapshot,'outputBinding'|'document'>){return jsonDigest({format:value.format,id:value.id,projectId:value.projectId,projectRevision:value.projectRevision,createdAt:value.createdAt,documentDigest:value.digest,title:value.title,audience:value.audience,viewIds:value.viewIds,sourceVector:value.sourceVector,brief:value.brief});}
/** Immutable output snapshot, never an alternate editable Project. All exports
 * still reapply publicDocument. Missing perspective stays an explicit gap. */
export async function createPublication(input:Project,brief:{title:string;audience:string;viewIds:string[];detail?:PublicationBrief['detail'];paper?:PublicationBrief['paper'];profile?:PublicationBrief['profile'];storyIndices?:number[]},createdAt=new Date().toISOString()):Promise<PublicationSnapshot>{
 const document=publicDocument(validateDocument(input)),presentation=validatePublicationBrief({format:'diagramcloud.publication-brief/1',...brief},input);
 if(!brief.viewIds.length||brief.viewIds.some(id=>!document.views.some(v=>v.id===id)))throw new Error('Choose existing public views');
 const active=document.atlas?.snapshots.find(s=>s.id===document.atlas?.activeSnapshotId);
 const value={format:'diagramcloud.publication-snapshot/1' as const,id:'publication-'+crypto.randomUUID(),projectId:document.id,projectRevision:document.revision,createdAt,digest:await publicationDigest(document),title:brief.title,audience:brief.audience,viewIds:[...new Set(brief.viewIds)],sourceVector:active?.repositories.map(r=>({repositoryId:r.id,revision:r.revision??null}))??[],document,brief:presentation};
 return validatePublication({...value,outputDigest:await publicationOutputDigest(value)});
}
export function collectionFacts(collection:ProjectCollection,projects:Project[]){
 const c=validateCollection(collection),byId=new Map(projects.map(p=>[p.id,validateDocument(p)]));
 return {collection:c,members:c.projectIds.map(id=>{const p=byId.get(id),active=p?.atlas?.snapshots.find(s=>s.id===p.atlas?.activeSnapshotId);return {id,state:p?'available' as const:'missing' as const,title:p?.title??id,documentRevision:p?.revision??null,sourceVector:active?.repositories.map(r=>({repositoryId:r.id,revision:r.revision??null}))??[]};}),revisionPolicy:'Each project and repository keeps its own revision; no collection SHA.'};
}
export function publicCollection(collection:ProjectCollection,projects:Project[]){
 const c=validateCollection(collection);if(c.visibility!=='public')throw new Error('Collection is private');
 const publicProjects=projects.map(publicDocument).filter(p=>p.nodes.length>0);
 // Omit unavailable/private projects entirely, including titles and counts.
 return collectionFacts({...c,projectIds:c.projectIds.filter(id=>publicProjects.some(p=>p.id===id)),publicationIds:[]},publicProjects);
}
function openLibrary():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('diagramcloud-library-v1',1);let blocked=false;r.onupgradeneeded=()=>{r.result.createObjectStore('collections',{keyPath:'id'});r.result.createObjectStore('publications',{keyPath:'id'});};r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error??new Error('Could not open publication library'));r.onblocked=()=>{blocked=true;reject(new Error('Close another library tab and try again'));};});}
/** The load boundary excludes corrupt rows independently and never rewrites them. */
export async function validateLibraryRows(collectionRows:readonly unknown[],publicationRows:readonly unknown[]){
 const collections:ProjectCollection[]=[],publications:PublicationSnapshot[]=[],warnings:string[]=[];
 for(const row of collectionRows){try{collections.push(validateCollection(row));}catch{warnings.push('An invalid collection was retained in storage and excluded from editing.');}}
 for(const result of await Promise.allSettled(publicationRows.map(validatePublication)))if(result.status==='fulfilled'){publications.push(result.value);if(result.value.outputBinding==='legacy-unbound')warnings.push('An older publication binds its public document only. Its output header is legacy-unbound; no output digest was manufactured.');}else warnings.push('An invalid publication was retained in storage and excluded from export.');
 return {collections,publications,warnings};
}
/** Resolve an exact saved identity. A missing target never becomes current-project membership. */
export function resolveLibraryTarget(target:LibraryTarget,library:{collections:ProjectCollection[];publications:PublicationSnapshot[]}){
 if(!key.safeParse(target.id).success)throw new Error('Invalid stable library target');
 if(target.kind==='collection'){const collection=library.collections.find(c=>c.id===target.id);return collection?{state:'available' as const,kind:'collection' as const,collection}: {state:'unavailable' as const,kind:'collection' as const,reason:'The linked collection is unavailable in this browser library. No membership was inferred.'};}
 if(target.kind!=='publication')throw new Error('Invalid library target kind');
 const publication=library.publications.find(p=>p.id===target.id);return publication?{state:'available' as const,kind:'publication' as const,publication}:{state:'unavailable' as const,kind:'publication' as const,reason:'The linked publication is unavailable or failed validation in this browser library. The editable project was not replaced.'};
}
export async function loadLibrary(){const db=await openLibrary();try{return await new Promise<Awaited<ReturnType<typeof validateLibraryRows>>>((resolve,reject)=>{const tx=db.transaction(['collections','publications'],'readonly'),c=tx.objectStore('collections').getAll(),p=tx.objectStore('publications').getAll();tx.oncomplete=()=>{validateLibraryRows(c.result,p.result).then(resolve,reject);};tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function saveCollection(input:ProjectCollection,expectedRevision:number|null){const value=validateCollection(input),db=await openLibrary();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('collections','readwrite'),store=tx.objectStore('collections');let problem:Error|undefined;const current=store.get(value.id);current.onsuccess=()=>{if((current.result?.revision??null)!==expectedRevision){problem=new Error('Another tab changed this collection. Reload the library before editing.');tx.abort();return;}if(value.revision!==(expectedRevision??-1)+1){problem=new Error('Invalid collection revision');tx.abort();return;}store.put(value);};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(problem??tx.error??new Error('Collection not saved'));});}finally{db.close();}}
export async function savePublication(input:PublicationSnapshot){const value=await validatePublication(input),db=await openLibrary();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('publications','readwrite');tx.objectStore('publications').add(value);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Immutable publication already exists or could not be saved'));});}finally{db.close();}}


/** Narrow local file admission, never authoring import or trust in a self-supplied digest.
 * No opaque assets/workspaces/observations in this first restoration journey. */
export const PUBLICATION_RESTORE_REFUSED='This file cannot be restored. Choose a supported public publication snapshot without assets, workspaces, observations or sensitive content.';
export const PUBLICATION_RESTORE_COLLISION='A different publication already uses this ID. The existing publication was not changed.';
export async function preparePublicationRestore(input:unknown):Promise<PublicationSnapshot>{
 try{const value=await validatePublication(input);
  if(value.document.assets.length||value.document.experience||value.document.observations.length||value.document.sources.some(source=>source.url&&!isOpenUri(source.url))||secretFindings(value).length)throw new Error('Unsupported restoration scope');
  return value;
 }catch{throw new Error(PUBLICATION_RESTORE_REFUSED);}
}
/** Key order does not distinguish equal validated JSON; array order and all values do. */
function publicationValueKey(value:unknown){return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);}
function sameRestoredPublication(stored:unknown,value:PublicationSnapshot){
 try{const parsed=snapshotSchema.parse(stored),document=validateDocument(parsed.document);
  return publicationValueKey({...parsed,document,outputBinding:parsed.outputDigest?'bound':'legacy-unbound'})===publicationValueKey(value);
 }catch{return false;}
}
/** Existing immutable publications store only. Revocation is checked before every write;
 * a confirmed transaction that already committed is not claimed to be rolled back. */
export async function restorePublication(input:unknown,isCurrent:()=>boolean):Promise<'restored'|'already-present'>{
 try{
  if(!isCurrent())throw new Error(PUBLICATION_RESTORE_REFUSED);
  const value=await preparePublicationRestore(input);if(!isCurrent())throw new Error(PUBLICATION_RESTORE_REFUSED);
  const db=await openLibrary();try{
   if(!isCurrent())throw new Error(PUBLICATION_RESTORE_REFUSED);
   return await new Promise<'restored'|'already-present'>((resolve,reject)=>{
    const tx=db.transaction('publications','readwrite'),store=tx.objectStore('publications'),request=store.get(value.id);let result:'restored'|'already-present'='restored',problem=PUBLICATION_RESTORE_REFUSED;
    request.onsuccess=()=>{
     if(!isCurrent()){tx.abort();return;}
     if(request.result!==undefined){if(sameRestoredPublication(request.result,value))result='already-present';else{problem=PUBLICATION_RESTORE_COLLISION;tx.abort();}}
     else{try{store.add(value);}catch{tx.abort();}}
    };
    tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(new Error(problem));
   });
  }finally{db.close();}
 }catch(error){throw new Error(error instanceof Error&&error.message===PUBLICATION_RESTORE_COLLISION?PUBLICATION_RESTORE_COLLISION:PUBLICATION_RESTORE_REFUSED);}
}

import {isOpenUri} from '../core/secrets';


/** Local navigation projection over already validated workspace Projects. Not a saved bookmark format. */
export const WORKSPACE_VIEW_UNAVAILABLE='This view is unavailable in the current workspace context.';
export type WorkspaceViewTarget={projectId:string;viewId:string;revision:number};
export type WorkspaceViewRow={target:WorkspaceViewTarget;projectTitle:string;title:string;purpose:string;perspective:string};
export const WORKSPACE_VIEW_PAGE_SIZE=8;
const workspaceId=/^[a-z][a-z0-9_.-]{0,79}$/;
/** Public Library is unavailable: branch before inspecting any authoring row, target or count. */
export function resolveWorkspaceView(projects:readonly Project[],target:unknown,options:{publicMode?:boolean}={}):{state:'unavailable'}|{state:'available';project:Project;path:string[];row:WorkspaceViewRow}{
 const unavailable={state:'unavailable' as const};if(options.publicMode)return unavailable;
 try{
 if(!target||typeof target!=='object'||Array.isArray(target))return unavailable;
 const t=target as Record<string,unknown>;
 if(Object.keys(t).length!==3||!Object.hasOwn(t,'projectId')||!Object.hasOwn(t,'viewId')||!Object.hasOwn(t,'revision')||typeof t.projectId!=='string'||!workspaceId.test(t.projectId)||typeof t.viewId!=='string'||!workspaceId.test(t.viewId)||!Number.isSafeInteger(t.revision)||(t.revision as number)<0)return unavailable;
 const matches=projects.filter(p=>p.id===t.projectId);if(matches.length!==1)return unavailable;
 const project=matches[0];if(project.revision!==t.revision)return unavailable;
 const views=project.views.filter(v=>v.id===t.viewId);if(views.length!==1)return unavailable;
 const view=views[0],path=pathTo(project,view.id).map(v=>v.viewId);if(!path.length)return unavailable;
 return {state:'available',project,path,row:{target:{projectId:project.id,viewId:view.id,revision:project.revision},projectTitle:project.title,title:view.title,purpose:view.description,perspective:PERSPECTIVE_LABEL[perspectiveOf(view)]}};
 }catch{return unavailable;}
}
export function workspaceViewPage(projects:readonly Project[],options:{publicMode?:boolean;page?:number}={}){
 if(options.publicMode)return {state:'unavailable' as const,rows:[] as WorkspaceViewRow[],total:0,page:0,pages:0,displayed:0,omitted:0};
 const rows:WorkspaceViewRow[]=[];
 for(const project of projects)for(const view of project.views){const resolved=resolveWorkspaceView(projects,{projectId:project.id,viewId:view.id,revision:project.revision});if(resolved.state==='available')rows.push(resolved.row);}
 const pages=Math.ceil(rows.length/WORKSPACE_VIEW_PAGE_SIZE),requested=Number.isFinite(options.page)?Math.max(0,Math.floor(options.page!)):0,page=Math.min(requested,Math.max(0,pages-1)),shown=rows.slice(page*WORKSPACE_VIEW_PAGE_SIZE,(page+1)*WORKSPACE_VIEW_PAGE_SIZE);
 return {state:'available' as const,rows:shown,total:rows.length,page,pages,displayed:shown.length,omitted:rows.length-shown.length};
}
