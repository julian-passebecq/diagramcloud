import {DESIGN_TYPES,type DesignType,type Project} from '../../core/model';
import {designContext} from './context';
import {chartableTable} from './chart';
import {flowRanks} from './flow';
import {layersOf} from './layers';
import {contextRoles} from './systemContext';

export type FigureType=Exclude<DesignType,'auto'>;
export type FigureRecommendation={type:FigureType;score:number;reason:string};
const FIGURES=DESIGN_TYPES.filter((t):t is FigureType=>t!=='auto');
const n=(k:number,one:string,many=`${one}s`)=>`${k} ${k===1?one:many}`;

/**
 * Every Diagram Design figure ranked for one view, best first, from facts of the public view only (designContext: the
 * public document and its ViewSpec, falling back to the root when the view is not public). Each entry names the fact
 * behind its score; a figure with no supporting fact still appears, scored low, saying what is missing. Table figures
 * are only recommended from a numeric table on a public component. Scores are 0–100 and only a ranking aid; ties keep
 * the DESIGN_TYPES order, so the result is deterministic.
 */
export function recommendFigures(input:Project,viewId:string):FigureRecommendation[]{
 const c=designContext(input,viewId,'recommend'),{doc,spec}=c,ids=new Set(spec.nodes.map(x=>x.id)),edges=spec.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to);
 const table=chartableTable(c),owner=table&&spec.nodes.find(x=>x.evidenceRefs.includes(table.block.id))?.label;
 const providers=[...new Set(spec.nodes.map(x=>x.provider).filter(p=>p&&p!=='Generic'))],shared=providers.filter(p=>spec.nodes.filter(x=>x.provider===p).length>=2).length,children=spec.children.length,parent=spec.path.length>1;
 const ranks=flowRanks(spec.nodes,edges),depth=ranks.size?Math.max(...ranks.values())+1:0,deg=new Map(spec.nodes.map(x=>[x.id,0]));
 for(const e of edges){deg.set(e.from,deg.get(e.from)!+1);deg.set(e.to,deg.get(e.to)!+1);}
 const hub=[...deg].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0],hubDeg=hub?.[1]??0,hubLabel=hub?spec.nodes.find(x=>x.id===hub[0])!.label:'';
 const steps=doc.story.filter(s=>doc.views.some(v=>v.id===s.viewId)),here=steps.filter(s=>s.viewId===spec.viewId).length;
 const cells=new Set(spec.nodes.map(x=>`${x.basis}|${x.confidence??'none'}`)).size,statuses=new Set(spec.nodes.map(x=>x.designStatus)).size;
 const roles=[...contextRoles(spec.nodes,edges).values()],entries=roles.filter(r=>r==='entry').length,sinks=roles.filter(r=>r==='sink').length,inner=roles.filter(r=>r==='inner').length;
 const layers=layersOf(spec.nodes).length,count=spec.nodes.length,empty=!count;
 const numeric=table?.series.length??0,rows=table?.block.rows.length??0,on=table?` on ${owner??'a component'}`:'',noTable='no numeric table evidence on this view';
 const r:Record<FigureType,[number,string]>={
  architecture:[empty?10:50,empty?'no public components in this view':`a sound default for ${n(count,'component')} and ${n(edges.length,'connection')}`],
  layers:layers>=3?[55,`${layers} layers of component kinds`]:[layers===2?30:12,layers===2?'only 2 layers of component kinds':'fewer than 2 layers of component kinds'],
  exploded:children?[58,`${n(children,'child view')} below this one`]:parent?[50,'a parent view above this one']:layers>=3?[35,`no drilldown, ${layers} layers of component kinds`]:[10,'no drilldown and few layers'],
  tree:children?[Math.min(80,62+children*3),`${n(children,'child view')} below this one`]:parent?[30,'no child view below this one, only a parent']:[8,'no drilldown from this view'],
  treemap:children>=2?[Math.min(72,56+children*3),`${n(children,'child view')} below this one`]:children?[40,'only 1 child view below this one']:[8,'no drilldown from this view'],
  swimlane:count>=5&&depth>=3?[spec.groups.length>=2?72:62,`${n(count,'component')} on a flow ${depth} steps deep${spec.groups.length>=2?` across ${spec.groups.length} repositories`:''}`]:[count>=3&&depth>=2?30:12,count<5?`only ${n(count,'component')}, no clear flow`:`flow only ${depth} step(s) deep`],
  sequence:edges.length>=2&&edges.length<=18&&count<=10?[48,`${n(edges.length,'connection')} between ${n(count,'component')} (order from connections, not timing)`]:[edges.length>18||count>10?20:8,edges.length>18||count>10?'too many connections or components for a sequence':'fewer than 2 connections'],
  timeline:steps.length?[here?62:50,`${n(steps.length,'public story step')}${here?`, ${here} on this view`:''}`]:[5,'no public story steps'],
  chart:table?[90,`a numeric table${on}`]:[3,noTable],
  line:table?[rows>=3?82:68,`a numeric table${on} with ${n(rows,'row')}`]:[3,noTable],
  heatmap:table?[numeric>=2?78:60,`a numeric table${on} with ${n(numeric,'numeric column')}`]:[3,noTable],
  deployment:shared>=2?[Math.min(80,58+shared*4),`${shared} providers each running 2 or more components`]:providers.length>=2?[40,`${providers.length} providers, mostly one component each`]:[providers.length?18:10,providers.length?'only 1 provider in this view':'no named provider in this view'],
  matrix:cells>=2?[Math.min(66,48+cells*3),`${cells} distinct basis and confidence pairs`]:[12,'one basis and confidence for every component'],
  hub:hubDeg>=3?[Math.min(74,58+hubDeg*2),`${hubLabel} has ${hubDeg} connections`]:[14,'no component with 3 or more connections'],
  radial:hubDeg>=3&&depth>=3?[Math.min(68,52+hubDeg*2),`${hubLabel} has ${hubDeg} connections on a flow ${depth} steps deep`]:[hubDeg>=3?40:12,hubDeg>=3?`${hubLabel} has ${hubDeg} connections, short reach`:'no component with 3 or more connections'],
  context:entries&&sinks&&inner?[60,`${n(entries,'entry point')}, ${n(sinks,'sink')} and ${inner} inside`]:[entries&&sinks?28:10,entries&&sinks?'no component between entry points and sinks':'no clear sources and sinks'],
  status:statuses>1?[Math.min(62,46+statuses*4),`${statuses} distinct designed statuses`]:[10,'one designed status for every component'],
  lineage:count>=5&&depth>=3?[66,`${n(count,'component')} on a flow ${depth} steps deep`]:[count>=3&&depth>=2?28:10,count<5?`only ${n(count,'component')}, no clear flow`:`flow only ${depth} step(s) deep`]};
 return FIGURES.map((type,i)=>({type,score:r[type][0],reason:r[type][1],i})).sort((a,b)=>b.score-a.score||a.i-b.i).map(({type,score,reason})=>({type,score,reason}));
}
export const recommendedType=(input:Project,viewId:string):FigureType=>recommendFigures(input,viewId)[0].type;
