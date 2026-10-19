import {validateDocument, DESIGN_TYPES, DESIGN_THEMES, type Project, type DesignType, type DesignTheme} from './model';
import {publicDocument} from './operations';
import {canonical,fnv64} from './learningMapping';
import {readDomainMappings,type DomainMapping} from './domainCorrespondence';

/** Export/host configuration, not a new stored architecture schema. Both views use one
 * permitted Project cut. These are perspectives, NOT alternative implementations. */
export type ReadingChapter={id:string;parentId?:string;leftViewId:string;rightViewId:string;leftDesign:DesignType;rightDesign:DesignType;anchorNodeId?:string};
export type LinkedReadingOptions={projectId:string;sourceKey:string;chapters:ReadingChapter[];theme?:DesignTheme;mappingBlockIds?:string[]};
export type PreparedLinkedReading={document:Project;sourceKey:string;chapters:ReadingChapter[];theme:DesignTheme;mappings:DomainMapping[]};
const key=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_.-]{0,79}$/.test(v);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=():never=>{throw new Error('Linked reading configuration is invalid, stale or unavailable for this public source cut.');};
/** Change detector, not authentication. Private payloads do not influence it, but the public Project revision remains
 * bound because the native renderer prints it. It is not an authorization token. */
export function linkedReadingKey(project:Project):string{
 const p=publicDocument(validateDocument(project));
 return fnv64(canonical(p));
}
export function prepareLinkedReading(project:Project,input:unknown):PreparedLinkedReading{
 const p=publicDocument(validateDocument(project)),sourceKey=linkedReadingKey(project);
 if(!plain(input)||Object.keys(input).some(k=>!['projectId','sourceKey','chapters','theme','mappingBlockIds'].includes(k))||input.projectId!==p.id||input.sourceKey!==sourceKey||!Array.isArray(input.chapters)||!input.chapters.length||input.chapters.length>16||input.theme!==undefined&&!(DESIGN_THEMES as readonly unknown[]).includes(input.theme))return fail();
 const ids=new Set<string>(),viewIds=new Set(p.views.map(v=>v.id));
 for(const c of input.chapters){
  if(!plain(c)||Object.keys(c).some(k=>!['id','parentId','leftViewId','rightViewId','leftDesign','rightDesign','anchorNodeId'].includes(k))||!key(c.id)||ids.has(c.id)||c.parentId!==undefined&&!key(c.parentId)||!key(c.leftViewId)||!key(c.rightViewId)||!viewIds.has(c.leftViewId)||!viewIds.has(c.rightViewId)||!(DESIGN_TYPES as readonly unknown[]).includes(c.leftDesign)||!(DESIGN_TYPES as readonly unknown[]).includes(c.rightDesign))return fail();
  if(c.anchorNodeId!==undefined&&(!key(c.anchorNodeId)||!p.nodes.some(n=>n.id===c.anchorNodeId)))return fail();
  ids.add(c.id);
 }
 const chapters=structuredClone(input.chapters) as ReadingChapter[];
 for(const c of chapters){const seen=new Set([c.id]);let next=c.parentId;while(next){if(!ids.has(next)||seen.has(next))return fail();seen.add(next);next=chapters.find(x=>x.id===next)?.parentId;}}
 let mappings:DomainMapping[];try{mappings=readDomainMappings(p,(input.mappingBlockIds??[]) as string[]);}catch{return fail();}
 return {document:p,sourceKey,chapters,mappings,theme:(input.theme as DesignTheme|undefined)??'light'};
}
export type LinkedPick={selectedId:string|null;leftPresent:boolean;rightPresent:boolean;state:'MATCH'|'LEFT_ONLY'|'RIGHT_ONLY'|'REFUSED'};
/** A many-occurrence visual may repeat one entity, but never matches on its label.
 * Lists here are renderer-produced IDs from the permitted cut, not arbitrary DOM text. */
export function resolveLinkedPick(leftIds:readonly string[],rightIds:readonly string[],side:'left'|'right',id:string):LinkedPick{
 const leftPresent=leftIds.includes(id),rightPresent=rightIds.includes(id);
 if(side!=='left'&&side!=='right'||!(side==='left'?leftPresent:rightPresent))return {selectedId:null,leftPresent:false,rightPresent:false,state:'REFUSED'};
 return {selectedId:id,leftPresent,rightPresent,state:leftPresent&&rightPresent?'MATCH':leftPresent?'LEFT_ONLY':'RIGHT_ONLY'};
}
/** The chapter hierarchy is explicit reading navigation; graph edges never create parents. */
export function chapterPath(chapters:readonly ReadingChapter[],id:string):string[]{
 const path:string[]=[],seen=new Set<string>();let current=chapters.find(c=>c.id===id);
 while(current){if(seen.has(current.id))return [];seen.add(current.id);path.unshift(current.id);if(!current.parentId)return path;current=chapters.find(c=>c.id===current!.parentId);}
 return [];
}
