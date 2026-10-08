import type {Project} from '../core/model';
import {readAcquisitionAnalysis} from './materialize';
import type {AnalysisOptions} from './types';
/** A recommendation is a reasoned presentation choice, never an applied change. */
export type Recipe={id:string;title:string;availability:'available'|'partial'|'unknown';viewIds:string[];reason:string;figure:'architecture'|'swimlane'|'lineage'|'matrix'|'tree'|'exploded';maxNodes:number};
const definitions:{id:string;title:string;perspectives:string[];tags:string[];figure:Recipe['figure']}[]=[
 {id:'system',title:'System concept map',perspectives:['system'],tags:[],figure:'architecture'},
 {id:'data',title:'Data and semantic lineage',perspectives:['data'],tags:['dbt','fabric'],figure:'lineage'},
 {id:'jobs',title:'Job dependencies and delivery',perspectives:['cicd'],tags:['databricks'],figure:'swimlane'},
 {id:'interfaces',title:'Interfaces and schema dependencies',perspectives:['code'],tags:['dotnet'],figure:'tree'},
 {id:'cloud',title:'Infrastructure declarations',perspectives:['cloud'],tags:['azure'],figure:'architecture'},
 {id:'evidence',title:'Evidence and checks',perspectives:['evidence'],tags:[],figure:'matrix'},
 {id:'knowledge',title:'Document and decision sources',perspectives:['decisions','code'],tags:['document'],figure:'tree'}
];
export function recommendRecipes(doc:Project,options:AnalysisOptions):Recipe[]{
 const choices=definitions.map(d=>{const views=doc.views.filter(v=>d.perspectives.includes(v.perspective??'')||v.nodeIds.some(id=>doc.nodes.some(n=>n.id===id&&n.tags.some(t=>d.tags.includes(t)))));
  const edgeCount=views.reduce((n,v)=>n+v.edgeIds.length,0),nodeCount=views.reduce((n,v)=>n+v.nodeIds.length,0);
  return {id:d.id,title:d.title,availability:nodeCount?(edgeCount?'available':'partial'):'unknown',viewIds:views.map(v=>v.id),figure:d.figure,
   maxNodes:options.depth==='quick'?24:60,reason:nodeCount?(edgeCount?'Explicit matching perspectives and retained relationships':'Components exist; relationships not established'):'No matching facts in the current selected scope'} as Recipe;});
 const priority=options.purpose==='audit'?['evidence','interfaces','cloud']:options.purpose==='presentation'||options.purpose==='portfolio'?['system','data','jobs']:['system','interfaces','data'];
 return choices.sort((a,b)=>Number(b.availability==='available')-Number(a.availability==='available')+((priority.indexOf(a.id)<0?10:priority.indexOf(a.id))-(priority.indexOf(b.id)<0?10:priority.indexOf(b.id)))/20);
}
/** Source-backed bounded reachability, not causal impact or test coverage %. */
export function impactFacts(doc:Project,start:string,options:{direction:'upstream'|'downstream';includeInferred:boolean;limit?:number}){
 if(!doc.nodes.some(n=>n.id===start))throw new Error('Unknown impact subject');
 const edges=doc.edges.filter(e=>e.basis==='static-source'||e.basis==='planned'||(options.includeInferred&&(!e.basis||e.basis==='unknown'))),limit=Math.max(1,Math.min(100,options.limit??60));
 const ids=new Set([start]),queue=[start],links=new Set<string>();let limited=false;
 while(queue.length){const id=queue.shift()!;for(const e of edges){const next=options.direction==='downstream'?(e.source===id?e.target:null):(e.target===id?e.source:null);if(!next)continue;
  links.add(e.id);if(ids.has(next))continue;if(ids.size>=limit){limited=true;continue;}ids.add(next);queue.push(next);}}
 return {nodes:doc.nodes.filter(n=>ids.has(n.id)),edges:edges.filter(e=>links.has(e.id)&&ids.has(e.source)&&ids.has(e.target)),limited,
  checks:doc.observations.filter(o=>ids.has(o.nodeId)&&o.reviewedAt),gaps:doc.nodes.filter(n=>ids.has(n.id)&&!doc.observations.some(o=>o.nodeId===n.id&&o.reviewedAt)).map(n=>({nodeId:n.id,reason:'No reviewed external check is attached; source declarations do not prove coverage'}))};
}
export function knowledgeFacts(doc:Project){const analysis=readAcquisitionAnalysis(doc);
 return {documents:analysis?.documentMap.documents??[],links:analysis?.documentMap.links??[],diagnostics:analysis?.documentMap.diagnostics??[],
  decisions:doc.views.filter(v=>v.perspective==='decisions'),limitations:['Only explicit source links are connected; prose similarity is not a relationship.']};}
export function projectCollection(projects:Project[]){return projects.map(p=>({id:p.id,title:p.title,views:p.views.length,
 revisions:p.atlas?.snapshots.find(s=>s.id===p.atlas?.activeSnapshotId)?.repositories.map(r=>({id:r.id,revision:r.revision??'UNKNOWN'}))??[],
 source:'independent-project' as const}));}

/** Atlas namespaces are explicit ownership, not a technology/name join. */
export function repositoryOutputFacts(doc:Project,repositoryId?:string){
 const active=doc.atlas?.snapshots.find(s=>s.id===doc.atlas?.activeSnapshotId);
 if(!repositoryId)return {nodes:doc.nodes,views:doc.views,edges:doc.edges};
 const repository=active?.repositories.find(r=>r.id===repositoryId);
 if(!repository)return {nodes:[],views:[],edges:[]};
 const nodes=doc.nodes.filter(n=>n.id.startsWith(repositoryId+'.')||n.id===(repository.nodeId??'repo-'+repositoryId)),ids=new Set(nodes.map(n=>n.id));
 const edges=doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),edgeIds=new Set(edges.map(e=>e.id));
 const views=doc.views.filter(v=>v.id.startsWith(repositoryId+'.')).map(v=>({...v,nodeIds:v.nodeIds.filter(id=>ids.has(id)),edgeIds:v.edgeIds.filter(id=>edgeIds.has(id))}));
 return {nodes,views,edges};
}
