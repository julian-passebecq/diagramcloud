import type {DeliveryView} from './deliveryEvidence';
export type PlanGroup={id:string;label:string;declared:boolean;blocks:{id:string;title:string;state:string;ownerId:string|null}[]};
/** Group supplied phases for reading only; order of appearance is not time or a dependency. */
export function planNavigation(view:DeliveryView,audience:'author'|'public'):PlanGroup[]{
 if(audience==='public'&&view.visibility!=='public')return [];
 const groups=new Map<string,PlanGroup>();
 for(const block of view.blocks){
  const phase=block.phase===null||block.phase===undefined?null:String(block.phase).trim()||null,key=phase===null?'unassigned':'phase:'+phase;
  let group=groups.get(key);
  if(!group){group={id:key,label:phase===null?'Phase not supplied':'Phase '+phase,declared:phase!==null,blocks:[]};groups.set(key,group);}
  group.blocks.push({id:block.id,title:block.title,state:block.state,ownerId:block.ownerId});
 }
 return [...groups.values()];
}
