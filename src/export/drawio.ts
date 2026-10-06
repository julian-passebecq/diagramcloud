import {publicDocument} from '../core/operations';
import type {Project,ProjectNode} from '../core/model';
import {CLAIM_LABEL,presentedObservation} from '../core/realization';
import {buildScene} from './scene';

/**
 * draw.io / diagrams.net export: one page per public view (root first, then each drilldown), boxes at their canvas
 * positions, the shared orthogonal routes as fixed waypoints, connection labels, and drilldown cards as page links.
 * Each box keeps its DiagramCloud ID, component type and provider as shape data, so importing the file back keeps
 * them. Evidence, sources, story and private content stay in JSON; vendor artwork is not embedded.
 */
const FILL:Record<ProjectNode['kind'],string>={source:'#eef6ff',process:'#ffffff',storage:'#eefaf3',model:'#f4f0ff',report:'#fff8e8',app:'#eef6ff',control:'#fff1f1',physics:'#f3f6f9',function:'#f0f7ff',table:'#f3f6f9'};
const STROKE='#9aa9bb',INK='#16263d',EDGE='#45556d';

/** XML attribute value: draw.io reads plain text labels (html=0), so only XML escaping applies. */
const attr=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\r?\n/g,'&#10;').replace(/\t/g,'&#9;');
const round=(n:number)=>Math.round(n*100)/100;

function nodeStyle(n:ProjectNode):string{
 const shape=n.kind==='storage'?'shape=cylinder3;boundedLbl=1;size=10;':n.kind==='control'?'shape=hexagon;perimeter=hexagonPerimeter2;size=0.08;':'rounded=1;arcSize=8;';
 return `${shape}whiteSpace=wrap;html=0;fillColor=${FILL[n.kind]};strokeColor=${STROKE};fontColor=${INK};fontFamily=Arial;fontSize=13;fontStyle=1;verticalAlign=middle;spacing=8;${n.childViewId?'dashed=0;strokeWidth=2;':''}`;
}

/** Public views reachable from the root, root first then each drilldown in order (publicDocument already dropped the rest). */
function orderedViews(d:Project){
 const out:string[]=[],visit=(id:string)=>{if(out.includes(id))return;const v=d.views.find(v=>v.id===id);if(!v)return;out.push(id);for(const n of d.nodes.filter(n=>v.nodeIds.includes(n.id)))if(n.childViewId)visit(n.childViewId);};
 visit(d.rootViewId);
 return out.map(id=>d.views.find(v=>v.id===id)!);
}

export function drawioDiagram(input:Project,now=new Date()):string{
 const d=publicDocument(input),views=orderedViews(d);
 const pages=views.map(view=>{
  const scene=buildScene(d,view),byId=new Map(d.nodes.map(n=>[n.id,n])),boxes=new Map(scene.nodes.map(n=>[n.id,n]));
  const cells:string[]=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
  for(const s of scene.nodes){
   const n=byId.get(s.id)!,obs=presentedObservation(d,n.id);
   const data=[`label="${attr(n.label)}"`,`tooltip="${attr(n.summary)}"`,`dcId="${attr(n.id)}"`,`dcKind="${n.kind}"`,`dcProvider="${attr(n.provider)}"`,
    ...(n.childViewId?[`link="data:page/id,${attr(n.childViewId)}"`]:[]),
    ...(obs?[`realization="${attr(`${CLAIM_LABEL[obs.claim]} by ${obs.sourceApp} @ ${obs.sourceRevision} (${obs.observedAt.slice(0,10)})`)}"`]:[])];
   cells.push(`<UserObject id="n-${attr(n.id)}" ${data.join(' ')}><mxCell style="${attr(nodeStyle(n))}" vertex="1" parent="1"><mxGeometry x="${round(s.x)}" y="${round(s.y)}" width="${s.w}" height="${s.h}" as="geometry"/></mxCell></UserObject>`);
  }
  for(const [k,e] of scene.edges.entries()){
   const edge=d.edges.find(x=>x.id===e.id)!,a=boxes.get(edge.source),b=boxes.get(edge.target);if(!a||!b)continue;
   const first=e.points[0],last=e.points[e.points.length-1],inner=e.points.slice(1,-1);
   // Pin both ends where the route meets the box so draw.io draws the same orthogonal line.
   const pin=(p:{x:number;y:number},box:{x:number;y:number;w:number;h:number},side:'exit'|'entry')=>`${side}X=${round((p.x-box.x)/box.w)};${side}Y=${round((p.y-box.y)/box.h)};${side}Dx=0;${side}Dy=0;${side}Perimeter=0;`;
   const style=`edgeStyle=none;rounded=0;html=0;endArrow=block;endFill=1;strokeColor=${EDGE};fontColor=${EDGE};fontFamily=Arial;fontSize=10;labelBackgroundColor=#ffffff;${e.dashed||edge.kind==='dependency'?'dashed=1;':''}dcKind=${edge.kind};${pin(first,a,'exit')}${pin(last,b,'entry')}`;
   const points=inner.length?`<Array as="points">${inner.map(p=>`<mxPoint x="${round(p.x)}" y="${round(p.y)}"/>`).join('')}</Array>`:'';
   cells.push(`<mxCell id="e-${k}-${attr(edge.id)}" value="${attr(edge.label)}" style="${attr(style)}" edge="1" parent="1" source="n-${attr(edge.source)}" target="n-${attr(edge.target)}"><mxGeometry relative="1" as="geometry">${points}</mxGeometry></mxCell>`);
  }
  const {x,y,width,height}=scene.bounds;
  return `<diagram id="${attr(view.id)}" name="${attr(view.title)}"><mxGraphModel dx="${Math.round(width)}" dy="${Math.round(height)}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="${Math.ceil(width-x)}" pageHeight="${Math.ceil(height-y)}" math="0" shadow="0"><root>${cells.join('')}</root></mxGraphModel></diagram>`;
 });
 return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="DiagramCloud" agent="DiagramCloud ${attr(typeof __APP_VERSION__==='string'?__APP_VERSION__:'')}" modified="${now.toISOString()}" type="device">${pages.join('')}</mxfile>\n`;
}
