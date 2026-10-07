import type {Project,ProjectNode} from '../../core/model';
import type {SpecNode} from '../../core/viewspec';
import {summaryCards} from './architecture';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {clipMono,f,footerLine,header,KIND_TAG,legendStrip,lines,markers,monoWidth,MONO,nodeBox,sansLines,svgDocument,treatmentOf,TREATMENT_LABEL,txt,type LegendItem,type Treatment} from './kit';
import {xml} from '../diagram';

const M=48,W=880,G=24,PAD=12,IG=12,TOP=32,CH=72,RG=16,SLOTS=4;
/** Designed status values in the order of the model's enum (nodeSchema.status); the Record keeps it exhaustive. */
export const STATUS_LABEL:Record<ProjectNode['status'],string>={idle:'Idle',running:'Running',complete:'Complete',warning:'Warning',failed:'Failed'};
export const STATUS_ORDER=Object.keys(STATUS_LABEL) as ProjectNode['status'][];
export const NOT_STATED='not-stated';
export type StatusColumn={id:string;label:string;nodes:SpecNode[]};
/** Columns of a status board: one per designed status that occurs, in the model's order, plus "Not stated" for a missing or unknown value; members ordered by canvas position. */
export function statusColumns(nodes:SpecNode[]):StatusColumn[]{
 const key=(n:SpecNode)=>STATUS_ORDER.includes(n.designStatus as ProjectNode['status'])?n.designStatus:NOT_STATED,sort=(ns:SpecNode[])=>[...ns].sort((a,b)=>a.position.y-b.position.y||a.position.x-b.position.x||a.id.localeCompare(b.id));
 return [...STATUS_ORDER,NOT_STATED].map(id=>({id,label:id===NOT_STATED?'Not stated':STATUS_LABEL[id as ProjectNode['status']],nodes:sort(nodes.filter(n=>key(n)===id))})).filter(col=>col.nodes.length);
}

/**
 * Status board: one column per designed status (the Planned/designed meaning of a component's `status`), each component
 * a card with its name, kind tag and declared provider. It is never an observation, a verification or a deployment
 * claim, and the caption says so; observations and connections are counted, never drawn.
 */
export function statusSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c0=designContext(input,viewId,'status',options),c={...c0,focal:new Set([...c0.focal].slice(0,2))},{spec,t}=c;
 const hdr=header(eyebrowOf(c,'Status board'),spec.title,c.purpose,M,M,W,t,c.editorial),cols=statusColumns(spec.nodes);
 const caption='Designed status: the illustrative design state set by the author (Planned/designed). It is not an observation, a verification or a deployment claim.';
 const capLines=sansLines(caption,W,11,2),capY=M+hdr.height+20,top=capY+(capLines.length-1)*15+40,out:string[]=[lines(capLines,M,capY,15,{size:11,fill:t.muted,italic:true,extra:' data-dd-caption="designed-status"'})];
 // Slots: at least four (one per column beyond that); extra slots go to the column that saves the most rows.
 const slots=Math.max(cols.length,SLOTS),sub=cols.map(()=>1),rowsOf=(i:number)=>Math.ceil(cols[i].nodes.length/sub[i]);
 for(let free=slots-cols.length;free>0&&cols.length;free--){let best=-1,gain=0;cols.forEach((_,i)=>{const g=rowsOf(i)-Math.ceil(cols[i].nodes.length/(sub[i]+1));if(g>gain){gain=g;best=i;}});if(best<0)break;sub[best]++;}
 const used=sub.reduce((s,n)=>s+n,0),slotW=Math.floor((W-(used-1)*G)/Math.max(1,used)/4)*4,rows=Math.max(0,...cols.map((_,i)=>rowsOf(i))),colH=TOP+rows*CH+Math.max(0,rows-1)*RG+PAD;
 const treatments=new Set<Treatment>();let x=M+Math.round((W-(used*slotW+(used-1)*G))/8)*4;
 cols.forEach((col,i)=>{const cw=sub[i]*slotW+(sub[i]-1)*G,cardW=Math.floor((cw-2*PAD-(sub[i]-1)*IG)/sub[i]/4)*4,r=rowsOf(i),ns=col.nodes.length;
  const label=clipMono(`${col.label.toUpperCase()} · ${ns}`,cw-28,8,0.14),lw=Math.ceil(monoWidth(label,8,0.14))+12,notStated=col.id===NOT_STATED;
  out.push(`<g data-dd-status="${xml(col.id)}" data-dd-count="${ns}"><rect x="${f(x)}" y="${f(top)}" width="${f(cw)}" height="${f(colH)}" rx="8" fill="${t.wash}" stroke="${notStated?t.optionalStroke:t.rule}" stroke-width="1"${notStated?' stroke-dasharray="4,3"':''}/>`+
   `<rect x="${f(x+10)}" y="${f(top-6)}" width="${f(lw)}" height="12" fill="${t.paper}"/>${txt(label,x+16,top+3,{size:8,fill:c.editorial?t.accent:t.soft,font:MONO,tracking:0.14})}`);
  col.nodes.forEach((n,k)=>{const cx=x+PAD+Math.floor(k/r)*(cardW+IG),cy=top+TOP+(k%r)*(CH+RG),focal=c.focal.has(n.id),tr=treatmentOf(n.kind,n.basis??'unspecified',focal);treatments.add(tr);
   out.push(nodeBox({id:n.id,x:cx,y:cy,w:cardW,h:CH,name:n.label,sub:n.provider&&n.provider!=='Generic'?n.provider:'provider not stated',tag:KIND_TAG[n.kind],treatment:tr,opens:!!n.opens,
    title:`${n.label} · ${n.kind} · designed status ${col.label.toLowerCase()} · ${n.provider&&n.provider!=='Generic'?n.provider:'provider not stated'}${focal?' · focal':''}`},t));});
  out.push('</g>');x+=cw+G;});
 const areaBottom=cols.length?top+colH:top;
 const observed=spec.nodes.filter(n=>n.observation).length,edges=spec.edges.length;
 const notes=[...(!spec.nodes.length?['This view has no public components.']:[]),...(edges?[`${edges} connection(s) not drawn: this board groups components by designed status only.`]:[]),
  ...(observed?[`${observed} component(s) also carry a presented observation; it is a separate, dated claim and does not set a column here.`]:[])];
 notes.forEach((n,i)=>out.push(txt(n,M,areaBottom+32+i*15,{size:10,fill:t.muted,italic:true})));
 const order:Treatment[]=['focal','backend','store','external','input','optional'];
 const items:LegendItem[]=[{kind:'swatch',fill:t.wash,label:'Column · designed status'},
  ...order.filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:x==='focal'&&c.focalReason==='auto'?'Focal · most connected':TREATMENT_LABEL[x]}))];
 const ly=areaBottom+32+notes.length*15+12,legend=legendStrip(items,M,ly,W,t);
 let y=ly+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,W):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:W+2*M,height:y+M,title:`${spec.title} · status board`,
  desc:`Status board of the public view ${spec.viewId}: ${spec.nodes.length} component(s) by designed status (${cols.map(col=>`${col.label} ${col.nodes.length}`).join(', ')||'none'}). Designed status is the author's illustrative design state, not an observation or verification.${spec.omissions.length?` ${spec.omissions.join(' ')}`:''}`,
  t,theme:c.theme,type:'status',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,W,t)});
}
