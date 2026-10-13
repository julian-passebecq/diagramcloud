import {validateDocument,type Project} from '../core/model';
import {recipeRegistry,patternCatalog} from './recipes';

const archetypes=[{id:'application',nodes:[['entry','app'],['module','function'],['database','storage']],perspectives:['system','code']},
 {id:'data',nodes:[['input','source'],['transform','process'],['output','storage']],perspectives:['system','data']},
 {id:'cloud',nodes:[['service','app'],['policy','control'],['store','storage']],perspectives:['system','cloud']},
 {id:'jobs',nodes:[['extract','source'],['compute','process'],['publish','report']],perspectives:['system','cicd']},
 {id:'documents',nodes:[['source','source'],['decision','control'],['explanation','report']],perspectives:['system','decisions','evidence']}];
/** Versioned, generated synthetic references. No employer data or observed results. */
export function referenceCookbook():Project[]{return archetypes.map(a=>{
 const ids=a.nodes.map(n=>n[0]),edges=ids.slice(1).map((to,i)=>({id:'link-'+i,source:ids[i],target:to,label:'Illustrative relationship',kind:'dependency',basis:'planned'}));
 return validateDocument({schemaVersion:1,id:'recipe-'+a.id,revision:0,title:'Synthetic '+a.id+' cookbook',category:'Reference',summary:'Generated recipe reference; synthetic teaching data, not a deployed architecture.',tags:['Cookbook',a.id],rootViewId:'overview',provenance:'Synthetic reference cookbook/1; generated from explicit archetype definition.',
 nodes:a.nodes.map(([id,kind])=>({id,label:id[0].toUpperCase()+id.slice(1),kind,summary:'Synthetic reference component',tags:[a.id,...(a.id==='application'?['dotnet']:a.id==='data'?['dbt']:a.id==='jobs'?['databricks']:a.id==='cloud'?['azure']:['document'])],basis:'planned',blockIds:['explanation-'+id]})),edges,
 views:a.perspectives.map((perspective,i)=>({id:i===0?'overview':'detail-'+perspective,title:'Synthetic '+perspective+' view',perspective,nodeIds:ids,edgeIds:edges.map(e=>e.id),positions:Object.fromEntries(ids.map((id,n)=>[id,{x:n*300,y:0}]))})),
 blocks:ids.map(id=>({id:'explanation-'+id,type:'text',title:'Synthetic contribution and constraint',text:'Input: selected teaching data. Contribution: explain '+id+'. Output: an illustrative supplied relationship. Constraint: neither execution nor deployment is verified.',provenance:'synthetic'})),story:[{title:'Start with the scope',viewId:'overview',narration:'Synthetic teaching example; explain the boundary and inspect the component evidence.',highlightEdgeIds:[]} ]});});}
export const cookbookManifest={format:'diagramcloud.reference-cookbook/1',version:1,recipeVersions:recipeRegistry.map(r=>({id:r.id,version:r.version})),patternVersions:patternCatalog.map(p=>({id:p.id,version:p.version})),fixtures:archetypes.map(a=>({projectId:'recipe-'+a.id,archetype:a.id,expectedViews:a.perspectives.map((p,i)=>i===0?'overview':'detail-'+p),provenance:'synthetic'}))};
