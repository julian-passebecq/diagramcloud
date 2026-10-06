import {documentSchema,validateDocument,type EvidenceBlock,type Project,type ProjectNode,type ProjectSnapshot,type SnapshotRepository} from '../model';
import {layeredPositions,type ImportResult} from '../interchange/graph';
import {documentFromScan,SCAN_LIMITS} from '../scan/document';
import type {ScanModel} from '../scan/scanner';
import {REPO_ID,type ManifestRepository,type ProjectManifest} from './manifest';

/**
 * Project atlas composition: one project made of N repositories. The root view shows the repositories and the
 * relationships the manifest declares (basis `planned`); each scanned repository drills into its own scan (system
 * context → containers → components → files, data lineage, infrastructure), with every ID prefixed by the repository
 * ID so two repositories never collide and a rescan of one keeps the others. The document records a snapshot: the
 * revision vector (each repository at its own commit) at capture time.
 */
export const ATLAS_ROOT='atlas';
const HOST_LABEL:Record<SnapshotRepository['host'],string>={github:'GitHub',gitlab:'GitLab','azure-devops':'Azure DevOps',bitbucket:'Bitbucket',local:'Local folder',other:'Git host'};
const ROLE_KIND:Record<ManifestRepository['role'],ProjectNode['kind']>={application:'app',service:'process',library:'function',data:'storage',infrastructure:'control',tool:'function',documentation:'report',platform:'process'};
const STATUS_LABEL:Record<SnapshotRepository['scanStatus'],string>={scanned:'scanned','not-scanned':'not scanned',failed:'scan failed',missing:'source missing'};
const clip=(s:string,n:number)=>s.length>n?`${s.slice(0,n-1)}…`:s;
export const repoNodeId=(repo:string)=>`repo-${repo}`;
const factsId=(repo:string)=>`repo-${repo}.facts`;

/** Deterministic short hash for IDs that would exceed 80 characters once prefixed. */
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36).padStart(7,'0');}
export function prefixed(repo:string,id:string){const out=`${repo}.${id}`;return out.length<=80?out:`${repo}.${id.slice(0,80-repo.length-10)}-${hash(id)}`;}
const ownedBy=(repo:string,id:string)=>id.startsWith(`${repo}.`);

/** Budget per scanned repository so N scans fit DiagramCloud's document limits (500 nodes, 1500 edges, 80 views). */
export function scanBudget(scanned:number,repositories:number){
 const n=Math.max(1,scanned),views=Math.max(2,Math.floor((78-1)/n)),componentViews=Math.max(1,Math.floor((views-3)/2));
 return {nodes:Math.max(12,Math.floor((480-repositories)/n)),edges:Math.floor((1400-200)/n),views,componentViews,fileViews:Math.max(0,views-3-componentViews),filesPerView:SCAN_LIMITS.filesPerView,perView:Math.min(SCAN_LIMITS.perView,Math.max(12,Math.floor((480-repositories)/n)))};
}

/** Repository facts as a reference table: what the manifest declares and what git recorded, each with its basis. */
function factsBlock(r:{id:string;title:string;purpose?:string;capabilities:string[];boundaries:string[]},s:SnapshotRepository):EvidenceBlock{
 const rows:string[][]=[['Purpose',r.purpose||'—','manifest'],['Host',HOST_LABEL[s.host],'manifest'],['Locator',s.locator,'manifest'],
  ['Revision',s.revision??'unknown',s.revision?(s.authority==='git'?'git (.git HEAD)':s.authority):'—'],['Branch / ref',s.ref??'unknown',s.ref?(s.authority==='git'?'git (.git HEAD)':s.authority):'—'],
  ['Scan',STATUS_LABEL[s.scanStatus]+(s.scannedAt?` (${s.scannedAt.slice(0,10)})`:''),s.scanStatus==='scanned'?'scan':'—'],
  ...r.capabilities.map(c=>['Capability',c,'manifest']),...r.boundaries.map(b=>['Boundary',b,'manifest']),...(s.note?[['Note',s.note,'scan']]:[])];
 return {id:factsId(r.id),title:'Repository facts',type:'table',columns:['Fact','Value','Basis'],rows,visibility:'public',sourceIds:[],provenance:'reference'};
}

/** Insert one repository's scan, prefixed, as the drilldown of its card. Returns report lines. */
function embedScan(doc:Project,repo:string,model:ScanModel,limits:ReturnType<typeof scanBudget>,now:Date):{lost:string[];views:number}{
 const {document:scan,report}=documentFromScan(model,{now,fileName:repo,limits});
 const p=(id:string)=>prefixed(repo,id);
 for(const n of scan.nodes)doc.nodes.push({...n,id:p(n.id),childViewId:n.childViewId?p(n.childViewId):undefined,blockIds:n.blockIds.map(p)});
 for(const e of scan.edges)doc.edges.push({...e,id:p(e.id),source:p(e.source),target:p(e.target)});
 for(const b of scan.blocks)doc.blocks.push({...b,id:p(b.id)});
 for(const v of scan.views)doc.views.push({...v,id:p(v.id),title:clip(`${model.name} · ${v.title}`,160),nodeIds:v.nodeIds.map(p),edgeIds:v.edgeIds.map(p),positions:Object.fromEntries(Object.entries(v.positions).map(([k,v])=>[p(k),v]))});
 for(const n of doc.nodes)if(n.childViewId===undefined)delete n.childViewId;
 const card=doc.nodes.find(n=>n.id===repoNodeId(repo));if(card)card.childViewId=p(scan.rootViewId);
 return {lost:report.lost.map(l=>`${repo}: ${l}`),views:scan.views.length};
}

function snapshotId(now:Date,taken:Set<string>){const base=`snap-${now.toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'').toLowerCase()}`;let id=base,k=2;while(taken.has(id))id=`${base}-${k++}`;return id;}

function appendSnapshot(doc:Project,repositories:SnapshotRepository[],now:Date,previous?:Project['atlas']){
 const history=(previous?.snapshots??[]).slice(-19),snap:ProjectSnapshot={id:snapshotId(now,new Set(history.map(s=>s.id))),capturedAt:now.toISOString(),repositories,runtimeRefs:[],contextRefs:[]};
 doc.atlas={snapshots:[...history,snap],activeSnapshotId:snap.id};
}

export type AtlasScan={model?:ScanModel;error?:string;missing?:boolean};

/** Manifest + the scans that were possible → a validated atlas project and an import report. */
export function documentFromAtlas(manifest:ProjectManifest,scans:Record<string,AtlasScan>={},options:{now?:Date;previous?:Project;fileName?:string}={}):ImportResult{
 const now=options.now??new Date(),repos=manifest.repositories;
 const scannedIds=repos.filter(r=>scans[r.id]?.model).map(r=>r.id),budget=scanBudget(scannedIds.length,repos.length);
 const doc:Project=documentSchema.parse({schemaVersion:1,id:`atlas-${manifest.project.id}`.slice(0,80),title:manifest.project.title,category:'Blank',tags:['Atlas','Project'],rootViewId:ATLAS_ROOT,
  summary:clip(manifest.project.summary||`${manifest.project.title}: ${repos.length} repositories and how they relate. Open a scanned repository to see its system context, containers, modules and files.`,3000),
  provenance:clip(`Project atlas from an explicit project manifest (${repos.length} repositories), ${now.toISOString().slice(0,10)}. Relationships between repositories are declared by the manifest (planned); everything inside a repository is read from its source by the deterministic scanner (static-source). Each repository keeps its own revision: there is no single project revision. Nothing here is a runtime observation.`,3000),
  nodes:[],edges:[],views:[{id:ATLAS_ROOT,title:manifest.project.title,description:clip(`Repositories of ${manifest.project.title} and the relationships the project manifest declares. Dashed: declared dependency. Open a repository to drill into its scan.`,2000),perspective:'system'}]});
 const repositories:SnapshotRepository[]=[],lost:string[]=[];
 for(const r of repos){
  const scan=scans[r.id],model=scan?.model;
  const s:SnapshotRepository={id:r.id,title:r.title,host:r.host,locator:r.locator,scanStatus:model?'scanned':scan?.missing?'missing':scan?.error?'failed':'not-scanned',authority:model?.commit?'git':'manifest',nodeId:repoNodeId(r.id)};
  const revision=model?.commit??r.revision,ref=model?.branch??r.ref;if(revision)s.revision=revision;if(ref)s.ref=ref.slice(0,200);
  if(model)s.scannedAt=now.toISOString();if(scan?.error)s.note=clip(scan.error,500);
  repositories.push(s);
  doc.nodes.push({id:repoNodeId(r.id),label:r.title,kind:ROLE_KIND[r.role],provider:HOST_LABEL[r.host],icon:'generic',summary:clip(r.purpose??'',500),role:clip(r.capabilities.join(' · '),1000),status:'idle',blockIds:[factsId(r.id)],sourceIds:[],tags:[STATUS_LABEL[s.scanStatus],r.role],basis:model?'static-source':'planned',visibility:'public'});
  doc.blocks.push(factsBlock(r,s));
  if(!model)lost.push(`${r.id}: ${scan?.missing?'source folder not found':scan?.error?`scan failed (${scan.error})`:'not scanned'}: the card has no drilldown and its revision is ${s.revision?'from the manifest':'unknown'}.`);
 }
 manifest.relationships.forEach((l,i)=>doc.edges.push({id:`rel-${i+1}`,source:repoNodeId(l.from),target:repoNodeId(l.to),label:l.label,kind:l.kind,speed:'medium',basis:l.basis,visibility:'public'}));
 const root=doc.views[0];root.nodeIds=doc.nodes.map(n=>n.id);root.edgeIds=doc.edges.map(e=>e.id);
 root.positions=Object.fromEntries(layeredPositions({title:root.title,nodes:root.nodeIds.map(key=>({key,label:key})),edges:doc.edges.map(e=>({source:e.source,target:e.target})),groups:[],direction:'LR'}));
 for(const id of scannedIds){const out=embedScan(doc,id,scans[id].model!,budget,now);lost.push(...out.lost);}
 appendSnapshot(doc,repositories,now,options.previous?.atlas);
 doc.story=[{title:manifest.project.title,viewId:ATLAS_ROOT,narration:`${repos.length} repositories, ${scannedIds.length} scanned. Each card lists its host, locator and revision; open a scanned repository to follow it down to files.`,highlightEdgeIds:[]}];
 const document=validateDocument(doc);
 const kept=[`${repos.length} repositories (${scannedIds.length} scanned), ${manifest.relationships.length} declared relationships, ${document.views.length} views.`,
  `Revision vector: ${repositories.map(r=>`${r.id} @ ${r.revision?r.revision.slice(0,12):'unknown'}`).join(', ')}.`,
  'Relationships between repositories are declared (planned); components inside a repository come from its source (static-source).'];
 return {document,report:{format:'atlas',fileName:options.fileName??`${manifest.project.id}.manifest.json`,pages:document.views.length,nodes:document.nodes.length,edges:document.edges.length,groups:repos.length,kept,lost}};
}

const activeSnapshot=(doc:Project)=>{const a=doc.atlas;if(!a)throw new Error('This project is not a project atlas.');return a.snapshots.find(s=>s.id===a.activeSnapshotId)!;};

/** Replace one repository's scan (all IDs under its prefix) and record a new snapshot; other repositories are untouched. */
export function rescanRepository(input:Project,repo:string,model:ScanModel,now=new Date()):ImportResult{
 const doc=structuredClone(input),snap=activeSnapshot(doc),entry=snap.repositories.find(r=>r.id===repo);
 if(!entry)throw new Error(`Repository ${repo} is not part of this atlas. Add it first.`);
 const removedViews=new Set(doc.views.filter(v=>ownedBy(repo,v.id)).map(v=>v.id));
 doc.nodes=doc.nodes.filter(n=>!ownedBy(repo,n.id));doc.edges=doc.edges.filter(e=>!ownedBy(repo,e.id));doc.blocks=doc.blocks.filter(b=>!ownedBy(repo,b.id));doc.views=doc.views.filter(v=>!removedViews.has(v.id));
 doc.story=doc.story.filter(s=>!removedViews.has(s.viewId));
 const card=doc.nodes.find(n=>n.id===repoNodeId(repo));if(card)delete card.childViewId;
 const scanned=snap.repositories.filter(r=>r.scanStatus==='scanned'||r.id===repo).length;
 const out=embedScan(doc,repo,model,scanBudget(scanned,snap.repositories.length),now);
 const updated:SnapshotRepository={...entry,scanStatus:'scanned',scannedAt:now.toISOString(),authority:model.commit?'git':entry.authority};delete updated.note;
 if(model.commit)updated.revision=model.commit;if(model.branch)updated.ref=model.branch.slice(0,200);
 if(card){card.basis='static-source';card.tags=[STATUS_LABEL.scanned,...card.tags.slice(1)];}
 const facts=doc.blocks.findIndex(b=>b.id===factsId(repo));
 if(facts>=0){const old=doc.blocks[facts];if(old.type==='table'){const keep=old.rows.filter(r=>['Purpose','Capability','Boundary'].includes(String(r[0])));
  doc.blocks[facts]=factsBlock({id:repo,title:entry.title,purpose:String(keep.find(r=>r[0]==='Purpose')?.[1]??''),capabilities:keep.filter(r=>r[0]==='Capability').map(r=>String(r[1])),boundaries:keep.filter(r=>r[0]==='Boundary').map(r=>String(r[1]))},updated);}}
 appendSnapshot(doc,snap.repositories.map(r=>r.id===repo?updated:r),now,doc.atlas);
 const document=validateDocument(doc);
 return {document,report:{format:'atlas',fileName:repo,pages:out.views,nodes:document.nodes.filter(n=>ownedBy(repo,n.id)).length,edges:document.edges.filter(e=>ownedBy(repo,e.id)).length,groups:0,
  kept:[`${entry.title} rescanned${model.branch?` on ${model.branch}`:''}${model.commit?` @ ${model.commit.slice(0,12)}`:''}: ${out.views} views. Other repositories are unchanged.`,`Previous revision: ${entry.revision?entry.revision.slice(0,12):'unknown'}. The previous snapshot is kept for comparison.`],lost:out.lost}};
}

/** Declare one more repository (a reviewed edit): a card on the atlas root, not scanned, revision unknown until scanned. */
export function addRepository(input:Project,repo:{id:string;title:string;host:SnapshotRepository['host'];locator:string;purpose?:string;role?:ManifestRepository['role']},now=new Date()):Project{
 const doc=structuredClone(input),snap=activeSnapshot(doc);
 if(!REPO_ID.test(repo.id))throw new Error('A repository ID is lowercase letters, digits and hyphens, at most 24 characters.');
 if(snap.repositories.some(r=>r.id===repo.id)||doc.nodes.some(n=>n.id===repoNodeId(repo.id)))throw new Error(`Repository ${repo.id} is already in this atlas.`);
 const s:SnapshotRepository={id:repo.id,title:repo.title,host:repo.host,locator:repo.locator,scanStatus:'not-scanned',authority:'author',nodeId:repoNodeId(repo.id)};
 doc.nodes.push({id:repoNodeId(repo.id),label:repo.title,kind:ROLE_KIND[repo.role??'application'],provider:HOST_LABEL[repo.host],icon:'generic',summary:clip(repo.purpose??'',500),role:'',status:'idle',blockIds:[factsId(repo.id)],sourceIds:[],tags:[STATUS_LABEL['not-scanned'],repo.role??'application'],basis:'planned',visibility:'public'});
 doc.blocks.push(factsBlock({id:repo.id,title:repo.title,purpose:repo.purpose,capabilities:[],boundaries:[]},s));
 const root=doc.views.find(v=>v.id===ATLAS_ROOT)??doc.views.find(v=>v.id===doc.rootViewId)!;
 const xs=Object.values(root.positions);root.nodeIds.push(repoNodeId(repo.id));root.positions[repoNodeId(repo.id)]={x:xs.length?Math.max(...xs.map(p=>p.x))+300:0,y:xs.length?Math.min(...xs.map(p=>p.y)):0};
 appendSnapshot(doc,[...snap.repositories,s],now,doc.atlas);
 return validateDocument(doc);
}
