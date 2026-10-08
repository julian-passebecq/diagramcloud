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
 for(const i of doc.delivery.instances){if(!doc.nodes.some(n=>n.id===i.componentId))throw new Error('Unknown deployment component: '+i.componentId);
  const previous=current.delivery?.instances.find(x=>x.id===i.id);
  if(previous&&(previous.nodeId!==i.nodeId||previous.componentId!==i.componentId||previous.environmentId!==i.environmentId))throw new Error('Conflicting deployment instance identity: '+i.id);
  if(i.nodeId===i.componentId||(!previous&&doc.nodes.some(n=>n.id===i.nodeId)))throw new Error('Deployment instance requires a distinct, unused node identity: '+i.nodeId);
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
export function environmentMatrix(doc:Project){
 const d=doc.delivery;if(!d)return [];
 return d.instances.map(i=>{const observation=doc.observations.filter(o=>o.nodeId===i.nodeId&&o.reviewedAt).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)).at(-1);
  return {id:i.id,nodeId:i.nodeId,component:doc.nodes.find(n=>n.id===i.componentId)?.label??i.componentId,
   environment:d.environments.find(e=>e.id===i.environmentId)?.label??i.environmentId,
   artifact:d.artifacts.find(a=>a.id===i.artifactId),declaredRevision:i.declaredRevision??'UNKNOWN',
   observed:observation?{claim:observation.claim,capturedAt:observation.observedAt,revision:observation.sourceRevision,authority:observation.authority}:null,
   drift:!observation||!i.declaredRevision||!['observed','verified'].includes(observation.claim)?'UNKNOWN':observation.sourceRevision===i.declaredRevision?'same-revision':'revision-difference',sourceIds:i.sourceIds};});
}
export function deliveryGates(doc:Project){return (doc.delivery?.promotions??[]).map(p=>({...p,gates:p.gates.map(g=>({...g,
 result:g.observationId?doc.observations.find(o=>o.id===g.observationId&&o.reviewedAt):undefined}))}));}
