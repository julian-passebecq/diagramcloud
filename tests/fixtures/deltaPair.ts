import {validateDocument,type Project} from '../../src/core/model';
import {contosoForecasting} from '../../src/data/contosoForecasting';

/** Two versions of the Contoso overview: a rename, a removal, an addition, a move and a rewire. */
export function deltaPair():{before:Project;after:Project}{
 const before=contosoForecasting(),d=structuredClone(before),v=d.views.find(v=>v.id==='overview')!;
 d.revision=before.revision+1;d.story=d.story.map(s=>s.nodeId==='fabric-app'?{...s,nodeId:undefined}:s);
 d.nodes.find(n=>n.id==='client')!.label='Rayfin client v2';
 v.nodeIds=v.nodeIds.filter(id=>id!=='fabric-app');delete v.positions['fabric-app'];
 const gone=new Set(d.edges.filter(e=>e.source==='fabric-app'||e.target==='fabric-app').map(e=>e.id));v.edgeIds=v.edgeIds.filter(id=>!gone.has(id));
 d.nodes.push({...structuredClone(d.nodes.find(n=>n.id==='mirror')!),id:'cache',label:'Read cache',provider:'Redis',summary:'Hot reads for the chart',childViewId:undefined,blockIds:[],sourceIds:[]});
 v.nodeIds.push('cache');v.positions.cache={x:v.positions.gold.x,y:v.positions.gold.y+260};
 d.edges.push({id:'gold-cache',source:'gold',target:'cache',label:'warm',kind:'batch',speed:'medium',visibility:'public'});v.edgeIds.push('gold-cache');
 v.positions.planner={x:v.positions.planner.x,y:v.positions.planner.y-120};
 const e=d.edges.find(e=>v.edgeIds.includes(e.id)&&e.target==='chart')!;e.source='cache';
 return {before,after:validateDocument(d)};
}
