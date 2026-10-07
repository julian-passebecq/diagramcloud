import type {Project} from '../../core/model';
import {PERSPECTIVE_LABEL,perspectiveOf} from '../../core/viewspec';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {elbowPath,footerLine,header,legendStrip,markers,nodeBox,svgDocument,type LegendItem} from './kit';

const M=48,BW=184,BH=72,SLOT=BW+20,LEVEL=BH+56,MAX=40;
type TreeNode={viewId:string;title:string;sub:string;tag:string;children:TreeNode[];x:number;y:number;depth:number};

/**
 * Drilldown tree: every public view reachable from the root, each under the view whose component opens it (first
 * parent wins, so a view shown twice is drawn once). Leaves take consecutive slots and parents centre over their
 * children; connectors leave the parent's bottom edge at fanned points and turn with r = 8. The current view is focal.
 */
export function treeSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'tree',options),{doc,spec,t}=c,seen=new Set<string>();let count=0;
 function build(id:string,via:string|undefined,depth:number):TreeNode|undefined{
  if(seen.has(id)||count>=MAX)return undefined;const v=doc.views.find(v=>v.id===id);if(!v)return undefined;seen.add(id);count++;
  const ns=doc.nodes.filter(n=>v.nodeIds.includes(n.id)),node:TreeNode={viewId:id,title:v.title,tag:PERSPECTIVE_LABEL[perspectiveOf(v)].toUpperCase().slice(0,6),
   sub:`${ns.length} component${ns.length===1?'':'s'}${via?` · via ${via}`:''}`,children:[],x:0,y:0,depth};
  for(const n of v.nodeIds.map(id=>ns.find(x=>x.id===id)).filter(x=>x?.childViewId)){const child=build(n!.childViewId!,n!.label,depth+1);if(child)node.children.push(child);}
  return node;
 }
 const root=build(doc.rootViewId,undefined,0)!,omitted=doc.views.length-count;
 let slot=0,depthMax=0;
 (function place(n:TreeNode){depthMax=Math.max(depthMax,n.depth);if(!n.children.length){n.x=slot++*SLOT;}else{n.children.forEach(place);n.x=(n.children[0].x+n.children[n.children.length-1].x)/2;}n.y=n.depth*LEVEL;})(root);
 const treeW=Math.max(1,slot)*SLOT-20,contentW=Math.max(treeW,640),hdr=header(eyebrowOf(c,'Drilldown tree'),spec.projectTitle,`Every public view and the component that opens it. Current view: ${spec.title}.`,M,M,contentW,t,c.editorial);
 const ox=M+(contentW-treeW)/2,oy=M+hdr.height+32,boxes:string[]=[],links:string[]=[];
 (function draw(n:TreeNode){const x=ox+n.x,y=oy+n.y,N=n.children.length;
  // Org-chart bus: one trunk from the parent's bottom centre, then each child drops from the shared rail.
  const cx=x+BW/2,sy=y+BH,mid=sy+(LEVEL-BH)/2;
  if(N)links.push(`<path d="M ${cx} ${sy} V ${mid}" fill="none" stroke="${t.muted}" stroke-width="1.2"/>`);
  n.children.forEach(ch=>{const tx=ox+ch.x+BW/2,ty=oy+ch.y;
   links.push(`<path data-edge-id="${ch.viewId}" d="${elbowPath(tx===cx?[{x:cx,y:mid},{x:tx,y:ty}]:[{x:cx,y:mid},{x:tx,y:mid},{x:tx,y:ty}])}" fill="none" stroke="${t.muted}" stroke-width="1.2" marker-end="url(#${c.slug}-arrow)"/>`);draw(ch);});
  boxes.push(nodeBox({id:n.viewId,attr:'data-view-ref',x,y,w:BW,h:BH,name:n.title,sub:n.sub,tag:n.tag,treatment:n.viewId===spec.viewId?'focal':'backend',opens:N>0,title:`${n.title} · ${n.sub}`},t));})(root);
 const bottom=oy+depthMax*LEVEL+BH;
 const items:LegendItem[]=[{kind:'box',treatment:'focal',label:'Current view'},{kind:'box',treatment:'backend',label:'View'},{kind:'line',stroke:'muted',label:'Opens (drilldown)'}];
 const legend=legendStrip(items,M,bottom+32,contentW,t);
 let y=bottom+32+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+12+M-12,title:`${spec.projectTitle} · drilldown tree`,
  desc:`Drilldown tree of ${count} public view(s)${omitted>0?`; ${omitted} more not drawn (limit ${MAX} or not reachable)`:''}. Current view: ${spec.title}.`,t,theme:c.theme,type:'tree',viewId:spec.viewId,defs:markers(c.slug,t),
  body:hdr.svg+links.join('')+boxes.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
