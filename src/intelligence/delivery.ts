import {z} from 'zod';
import {deliverySchema,validateDocument,type Project} from '../core/model';
import {applyDocumentPatch,type Patch} from '../core/patch';
import {secretFindings} from '../core/secrets';
export const deliveryBriefSchema=z.object({format:z.literal('diagramcloud.delivery-brief'),version:z.literal(1),
 projectId:z.string().max(120),baseRevision:z.number().int().nonnegative(),delivery:deliverySchema}).strict();
/** Input only declares topology; it cannot create or review observations. */
export function previewDeliveryBrief(current:Project,input:unknown){
 validateDocument(current);if(secretFindings(input).length)throw new Error('Sensitive delivery declaration refused');
 const brief=deliveryBriefSchema.parse(input);if(brief.projectId!==current.id||brief.baseRevision!==current.revision)throw new Error('Delivery brief identity / revision conflict');
 const doc=structuredClone(current);doc.delivery=brief.delivery;
 // A new declaration is private. Existing author-reviewed visibility is retained.
 const preserve=(kind:'environments'|'artifacts'|'instances'|'promotions')=>{for(const row of doc.delivery![kind])row.visibility=current.delivery?.[kind].find(x=>x.id===row.id)?.visibility??'private';};
 for(const kind of ['environments','artifacts','instances','promotions'] as const)preserve(kind);
 for(const kind of ['releases','applicability','configurations'] as const)for(const row of doc.delivery[kind]??[])row.visibility=current.delivery?.[kind]?.find(x=>x.id===row.id)?.visibility??'private';
 for(const env of doc.delivery.environments)for(const binding of env.bindings??[])binding.visibility=current.delivery?.environments.find(e=>e.id===env.id)?.bindings?.find(b=>b.kind===binding.kind&&b.label===binding.label)?.visibility??'private';
 for(const i of doc.delivery.instances){if(!doc.nodes.some(n=>n.id===i.componentId))throw new Error('Unknown deployment component: '+i.componentId);
  const previous=current.delivery?.instances.find(x=>x.id===i.id);
  if(previous&&(previous.nodeId!==i.nodeId||previous.componentId!==i.componentId||previous.environmentId!==i.environmentId))throw new Error('Conflicting deployment instance identity: '+i.id);
  if(i.nodeId===i.componentId||(!previous&&doc.nodes.some(n=>n.id===i.nodeId)))throw new Error('Deployment instance requires a distinct, unused node identity: '+i.nodeId);
  if(i.releaseId&&i.artifactId&&!doc.delivery.releases?.find(r=>r.id===i.releaseId)?.artifactIds.includes(i.artifactId))throw new Error('Instance artifact is outside its declared release: '+i.id);
  if(!doc.nodes.some(n=>n.id===i.nodeId))doc.nodes.push({id:i.nodeId,label:'Deployment declaration '+i.id,kind:'app',provider:'Generic',icon:'generic',
   summary:'Declared instance in '+i.environmentId+'. Runtime UNKNOWN until an external observation is reviewed.',role:'',status:'idle',basis:'planned',sourceIds:i.sourceIds,blockIds:[],tags:['Deployment declaration'],visibility:'private'});
 }
 const viewId='delivery-environment-matrix',navId='delivery-navigation';
 const links=doc.delivery.instances.map(i=>({id:'delivery-instance-'+i.id,source:i.componentId,target:i.nodeId,label:'Declared deployment instance',kind:'dependency' as const,speed:'medium' as const,basis:'planned' as const,visibility:doc.edges.find(e=>e.id==='delivery-instance-'+i.id)?.visibility??'private' as const}));
 doc.edges=doc.edges.filter(e=>!e.id.startsWith('delivery-instance-')).concat(links);
 const nodeIds=[...new Set(doc.delivery.instances.flatMap(i=>[i.componentId,i.nodeId]))];
 const previous=doc.views.find(v=>v.id===viewId),positions={...previous?.positions};
 for(const [index,id] of nodeIds.entries())positions[id]??={x:(index%4)*300,y:Math.floor(index/4)*180};
 for(const id of Object.keys(positions))if(!nodeIds.includes(id))delete positions[id];
 const view={id:viewId,title:'Environment and deployment declarations',description:'Declared instances are not observed deployments. Reviewed observations remain dated external claims.',nodeIds,edgeIds:links.map(e=>e.id),positions,perspective:'cloud' as const,design:previous?.design??{type:'deployment' as const,focal:[]},visibility:previous?.visibility??'private' as const};
 const at=doc.views.findIndex(v=>v.id===viewId);if(at<0)doc.views.push(view);else doc.views[at]=view;
 if(!doc.nodes.some(n=>n.id===navId)){doc.nodes.push({id:navId,label:'Environments and delivery',kind:'control',provider:'Generic',icon:'generic',summary:'Declared topology and evidence gaps.',role:'',status:'idle',basis:'planned',sourceIds:[],blockIds:[],tags:['Navigation'],childViewId:viewId,visibility:'private'});
  const root=doc.views.find(v=>v.id===doc.rootViewId)!;root.nodeIds.push(navId);root.positions[navId]={x:0,y:Math.ceil(root.nodeIds.length/3)*180};}
 const operations:Patch['operations']=(['nodes','edges','views','delivery'] as const).filter(k=>JSON.stringify(current[k])!==JSON.stringify(doc[k])).map(k=>({op:current[k]===undefined?'add':'replace',path:'/'+k,value:doc[k]}));
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:current.id,baseRevision:current.revision,
  summary:'Review declared environments, instances, artifacts and promotion gates; runtime remains unknown',operations:operations.length?operations:[{op:'test',path:'/revision',value:current.revision}]};
 return {patch,document:applyDocumentPatch(current,patch).result};
}
export function environmentMatrix(doc:Project,options:{at?:string;maxAgeHours?:number}={}){
 const d=doc.delivery;if(!d)return [];
 return d.instances.map(i=>{const observation=doc.observations.filter(o=>o.nodeId===i.nodeId&&o.reviewedAt).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||a.id.localeCompare(b.id)).at(-1);
  return {id:i.id,nodeId:i.nodeId,component:doc.nodes.find(n=>n.id===i.componentId)?.label??i.componentId,
   environment:d.environments.find(e=>e.id===i.environmentId)?.label??i.environmentId,
   artifact:d.artifacts.find(a=>a.id===i.artifactId),release:d.releases?.find(r=>r.id===i.releaseId),declaredRevision:i.declaredRevision??'UNKNOWN',
   observed:observation?{claim:observation.claim,capturedAt:observation.observedAt,revision:observation.sourceRevision,authority:observation.authority}:null,
   freshness:observation?evidenceFreshness(observation.observedAt,options):'UNKNOWN',
   drift:!observation||!i.declaredRevision||!['observed','verified'].includes(observation.claim)?'UNKNOWN':observation.sourceRevision===i.declaredRevision?'same-revision':'revision-difference',sourceIds:i.sourceIds};});
}
export function evidenceFreshness(capturedAt:string,options:{at?:string;maxAgeHours?:number}={}){
 const now=Date.parse(options.at??new Date().toISOString()),captured=Date.parse(capturedAt),hours=options.maxAgeHours??24;
 if(!Number.isFinite(now)||!Number.isFinite(captured)||!Number.isFinite(hours)||hours<0)return 'UNKNOWN';
 return captured>now?'future-timestamp':now-captured>hours*3600000?'stale':'within-selected-age';
}
export function deliveryGates(doc:Project,options:{at?:string;maxAgeHours?:number}={}){return (doc.delivery?.promotions??[]).map(p=>({...p,gates:p.gates.map(g=>{
 const result=g.observationId?doc.observations.find(o=>o.id===g.observationId&&o.reviewedAt):undefined,artifact=doc.delivery?.artifacts.find(a=>a.id===p.artifactId);
 return {...g,result,freshness:result?evidenceFreshness(result.observedAt,options):'UNKNOWN',revisionMatch:!result||!artifact?.sourceRevision?'UNKNOWN':result.sourceRevision===artifact.sourceRevision?'exact-source-revision':'different-source-revision'};
 })}));}
/** Sparse declarations are expanded only for selected logical components;
 * missing cells are UNKNOWN, never undeployed or implicitly applicable. */
export function deliveryCoverageMatrix(doc:Project,options:{componentIds?:string[];at?:string;maxAgeHours?:number}={}){
 const d=doc.delivery;if(!d)return [];const instanceNodes=new Set(d.instances.map(i=>i.nodeId)),components=options.componentIds??[...new Set([...d.instances.map(i=>i.componentId),...(d.applicability??[]).map(i=>i.componentId)])];
 if(components.some(id=>!doc.nodes.some(n=>n.id===id)||instanceNodes.has(id)))throw new Error('Matrix requires existing logical components');
 const rows=environmentMatrix(doc,options),lookup=new Map(rows.map(r=>[r.id,r]));
 return [...new Set(components)].flatMap(componentId=>d.environments.map(env=>{
  const instances=d.instances.filter(i=>i.componentId===componentId&&i.environmentId===env.id),notApplicable=d.applicability?.find(i=>i.componentId===componentId&&i.environmentId===env.id),claims=instances.map(i=>lookup.get(i.id)!);
  return {componentId,component:doc.nodes.find(n=>n.id===componentId)!.label,environmentId:env.id,environment:env.label,
   state:notApplicable?'not-applicable':claims.some(c=>c.observed)?'reviewed-claim':instances.length?'declared':'UNKNOWN',reason:notApplicable?.reason,sourceIds:notApplicable?.sourceIds??[],instances:claims};
 }));
}
export function releaseChain(doc:Project){const d=doc.delivery;return (d?.artifacts??[]).map(a=>({artifact:a,sourceRevision:a.sourceRevision??'UNKNOWN',sourceRepositoryId:a.sourceRepositoryId??'UNKNOWN',buildId:a.buildId??'UNKNOWN',digest:a.digest??'UNKNOWN',releases:(d?.releases??[]).filter(r=>r.artifactIds.includes(a.id)),instances:(d?.instances??[]).filter(i=>i.artifactId===a.id),basis:a.sourceIds.length?'cited declaration':'author declaration'}));}
export type DeliveryPublicationKind='environments'|'artifacts'|'releases'|'instances'|'promotions'|'applicability'|'configurations';
/** Explicit human publication choice. Related closure is opt-in; observations and nested private bindings are never promoted. */
export function deliveryPublicationPatch(current:Project,kind:DeliveryPublicationKind,id:string,visibility:'public'|'private',related=false):Patch{
 validateDocument(current);const doc=structuredClone(current),delivery=doc.delivery;
 if(!delivery)throw new Error('No delivery declarations');
 const row=delivery[kind]?.find(r=>r.id===id);if(!row)throw new Error('Unknown delivery publication object');row.visibility=visibility;
 if(visibility==='public'&&related){
  const sourceIds=new Set<string>(),nodeIds=new Set<string>(),instanceIds=new Set<string>(),seen=new Set<string>();
  const include=(k:DeliveryPublicationKind,key:string)=>{
   if(seen.has(k+'/'+key))return;seen.add(k+'/'+key);const item=delivery[k]?.find(r=>r.id===key);if(!item)throw new Error('Missing related delivery object');item.visibility='public';item.sourceIds.forEach(id=>sourceIds.add(id));
   if(k==='instances'){const i=delivery.instances.find(i=>i.id===key)!;instanceIds.add(key);nodeIds.add(i.componentId);nodeIds.add(i.nodeId);include('environments',i.environmentId);if(i.artifactId)include('artifacts',i.artifactId);if(i.releaseId)include('releases',i.releaseId);}
   if(k==='releases')delivery.releases!.find(r=>r.id===key)!.artifactIds.forEach(id=>include('artifacts',id));
   if(k==='promotions'){const p=delivery.promotions.find(p=>p.id===key)!;include('environments',p.fromEnvironmentId);include('environments',p.toEnvironmentId);if(p.artifactId)include('artifacts',p.artifactId);if(p.releaseId)include('releases',p.releaseId);}
   if(k==='applicability'||k==='configurations'){const c=delivery[k]!.find(c=>c.id===key)!;nodeIds.add(c.componentId);include('environments',c.environmentId);}
  };
  include(kind,id);
  for(const n of doc.nodes)if(nodeIds.has(n.id)){n.visibility='public';n.sourceIds.forEach(id=>sourceIds.add(id));}
  for(const source of doc.sources)if(sourceIds.has(source.id))source.visibility='public';
  if(instanceIds.size){const view=doc.views.find(v=>v.id==='delivery-environment-matrix'),nav=doc.nodes.find(n=>n.id==='delivery-navigation');if(view)view.visibility='public';if(nav)nav.visibility='public';for(const edge of doc.edges)if([...instanceIds].some(id=>edge.id==='delivery-instance-'+id))edge.visibility='public';}
 }
 const operations:Patch['operations']=(['delivery','nodes','edges','views','sources'] as const).filter(k=>JSON.stringify(current[k])!==JSON.stringify(doc[k])).map(k=>({op:'replace',path:'/'+k,value:doc[k]}));
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:current.id,baseRevision:current.revision,summary:'Human-selected delivery publication visibility and optional declared reference closure; observation review/shareable state unchanged',operations:operations.length?operations:[{op:'test',path:'/revision',value:current.revision}]};applyDocumentPatch(current,patch);return patch;
}
/** Revisions are comparable values; no verdict about health or causality. */
export function compareEnvironments(doc:Project,from:string,to:string,options:{at?:string;maxAgeHours?:number}={}){
 if(!doc.delivery?.environments.some(e=>e.id===from)||!doc.delivery.environments.some(e=>e.id===to))throw new Error('Select two declared environment identities');
 const matrix=environmentMatrix(doc,options),ids=[...new Set(doc.delivery.instances.map(i=>i.componentId))];
 return ids.map(id=>{const instances=doc.delivery!.instances.filter(i=>i.componentId===id),a=instances.filter(i=>i.environmentId===from).map(i=>matrix.find(r=>r.id===i.id)!),b=instances.filter(i=>i.environmentId===to).map(i=>matrix.find(r=>r.id===i.id)!);
  const positive=(rows:typeof a)=>rows.length===1&&rows[0].observed&&['observed','verified'].includes(rows[0].observed.claim)&&rows[0].freshness==='within-selected-age';
  return {componentId:id,component:doc.nodes.find(n=>n.id===id)?.label??id,from:a,to:b,declaredComparison:a.length===1&&b.length===1&&a[0].declaredRevision!=='UNKNOWN'&&b[0].declaredRevision!=='UNKNOWN'?(a[0].declaredRevision===b[0].declaredRevision?'same-declaration':'different-declarations'):'UNKNOWN',observedComparison:positive(a)&&positive(b)?a[0].observed!.revision===b[0].observed!.revision?'same-observed-revision':'different-observed-revisions':'UNKNOWN'};
 });
}
