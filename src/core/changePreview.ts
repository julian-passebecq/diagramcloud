import type {Project} from './model';

export const ENTITY_GROUPS=['nodes','edges','views','blocks','assets','sources'] as const;
export type EntityGroup=typeof ENTITY_GROUPS[number];
export type EntityDelta={added:string[];removed:string[];changed:string[]};
export type DocumentChangePreview={
 sameProject:boolean;
 revision:{current:number;incoming:number;compatible:boolean};
 metadata:string[];
 storyChanged:boolean;
 entities:Record<EntityGroup,EntityDelta>;
 totalChanges:number;
};

const metadataKeys=['title','summary','author','category','tags','rootViewId','provenance','privateNotes','experience'] as const;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function byId<T extends {id:string}>(current:T[],incoming:T[]):EntityDelta{
 const before=new Map(current.map(item=>[item.id,item])),after=new Map(incoming.map(item=>[item.id,item]));
 const added=[...after.keys()].filter(id=>!before.has(id)).sort();
 const removed=[...before.keys()].filter(id=>!after.has(id)).sort();
 const changed=[...after.keys()].filter(id=>before.has(id)&&!same(before.get(id),after.get(id))).sort();
 return{added,removed,changed};
}

/** Human-review summary for whole-document JSON / AI edits. No mutation occurs here. */
export function previewDocumentChange(current:Project,incoming:Project):DocumentChangePreview{
 const sameProject=current.id===incoming.id;
 const entities=Object.fromEntries(ENTITY_GROUPS.map(group=>[group,byId(current[group] as {id:string}[],incoming[group] as {id:string}[])])) as Record<EntityGroup,EntityDelta>;
 const metadata=metadataKeys.filter(key=>!same(current[key],incoming[key]));
 const storyChanged=!same(current.story,incoming.story);
 const entityChanges=ENTITY_GROUPS.reduce((sum,group)=>sum+entities[group].added.length+entities[group].removed.length+entities[group].changed.length,0);
 return{
  sameProject,
  revision:{current:current.revision,incoming:incoming.revision,compatible:!sameProject||current.revision===incoming.revision},
  metadata,
  storyChanged,
  entities,
  totalChanges:metadata.length+(storyChanged?1:0)+entityChanges
 };
}
