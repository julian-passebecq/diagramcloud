import type {DesignTheme,DesignType,Project,ProjectView} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {viewSpec,PERSPECTIVE_LABEL,type ViewSpec} from '../../core/viewspec';
import {tokensFor,slugOf,type Tokens} from './kit';

export type DesignOptions={type?:DesignType;theme?:DesignTheme;now?:Date};
export type DesignContext={input:Project;doc:Project;view:ProjectView;spec:ViewSpec;theme:DesignTheme;t:Tokens;editorial:boolean;focal:Set<string>;focalReason:'hint'|'auto'|'none';slug:string;now:Date};

/**
 * Everything a Diagram Design renderer needs, from the public document only: the view (falling back to the root when
 * the requested one is not public), its ViewSpec (omissions are counted against the full input) and the focal set.
 * Focal components come from the view's design hints; without hints, at most one is chosen: the single component
 * with strictly the most connections (at least three). The legend says which rule applied.
 */
export function designContext(input:Project,viewId:string,type:string,options:DesignOptions={}):DesignContext{
 const doc=publicDocument(input),id=doc.views.some(v=>v.id===viewId)?viewId:doc.rootViewId,view=doc.views.find(v=>v.id===id)!;
 const now=options.now??new Date(),spec=viewSpec(input,id,{now}),theme=options.theme??view.design?.theme??'light';
 let focal=new Set((view.design?.focal??[]).filter(f=>view.nodeIds.includes(f))),focalReason:DesignContext['focalReason']=focal.size?'hint':'none';
 if(!focal.size){
  const degree=new Map(spec.nodes.map(n=>[n.id,0]));for(const e of spec.edges){degree.set(e.from,(degree.get(e.from)??0)+1);degree.set(e.to,(degree.get(e.to)??0)+1);}
  const ranked=[...degree].sort((a,b)=>b[1]-a[1]);
  if(ranked.length&&ranked[0][1]>=3&&(ranked.length<2||ranked[0][1]>ranked[1][1])){focal=new Set([ranked[0][0]]);focalReason='auto';}
 }
 return {input,doc,view,spec,theme,t:tokensFor(theme),editorial:theme==='editorial',focal,focalReason,slug:slugOf(`${id}-${type}`),now};
}

export const eyebrowOf=(c:DesignContext,what:string)=>`${c.spec.projectTitle} · ${PERSPECTIVE_LABEL[c.spec.perspective]} · ${what}`;
/** Revision vector: each repository at its own revision, never one project SHA. */
export function vectorOf(spec:ViewSpec,max=3):string{
 if(!spec.snapshot)return `revision ${spec.projectRevision}`;
 const reps=spec.snapshot.repositories,parts=reps.slice(0,max).map(r=>`${r.id}@${r.revision?r.revision.slice(0,8):'unknown'}`);
 return parts.join(' ')+(reps.length>max?` +${reps.length-max}`:'');
}
export function footerParts(c:DesignContext):string[]{
 return [c.spec.projectId,`view ${c.spec.viewId}`,vectorOf(c.spec),c.now.toISOString().slice(0,10),'public content only',...c.spec.omissions.slice(0,1)];
}
