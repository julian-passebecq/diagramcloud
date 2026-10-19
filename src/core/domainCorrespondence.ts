import type {Project} from './model';

/** Opt-in interpretation of ordinary mapping evidence tables. This is not a second
 * Project schema, ontology, unit engine, simulator or permission boundary.
 * Call on the host's already-permitted Project cut, never on hidden author data. */
export const DOMAIN_MAP_COLUMNS = [
 'Mapping ID','From entity','To entity','Relation','State','Scope',
 'Input grain','Output grain','Unit rule','Meaning / limit',
] as const;
export type DomainMapping = {
 id:string;fromId:string;toId:string|null;relation:string;
 state:'declared'|'illustrative'|'unresolved'|'rejected';scope:string;
 inputGrain:string;outputGrain:string;unitRule:string;meaning:string;
 blockId:string;sourceIds:string[];
};
export type MappingPick = {
 state:'EXACT'|'RELATED'|'CHOICE'|'ABSENT'|'REFUSED';
 originId:string|null;targets:string[];mappings:DomainMapping[];
};
const stable=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_.-]{0,79}$/.test(v);
const nonblank=(v:unknown,max=1000):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const refuse=():never=>{throw new Error('Mapping evidence is invalid or unavailable in the selected source cut.');};

/** Each selected table has exactly one mapping row. Per-mapping evidence/visibility
 * stays independent; a mixed public/private table is never created by this helper.
 * Unknown target IDs are refused, not rebound by label. An explicitly unresolved
 * mapping may omit its target and is retained as a gap, never an inferred match. */
export function readDomainMappings(doc:Project,blockIds:readonly string[]):DomainMapping[]{
 if(!Array.isArray(blockIds)||blockIds.length>120||new Set(blockIds).size!==blockIds.length||!blockIds.every(stable))return refuse();
 const nodes=new Set(doc.nodes.map(n=>n.id)),sources=new Set(doc.sources.map(s=>s.id));
 const ids=new Set<string>(),result:DomainMapping[]=[];
 for(const bid of blockIds){
  const b=doc.blocks.find(b=>b.id===bid);
  if(!b||b.type!=='table'||b.transform!=='mapping'||b.rows.length!==1||b.columns.length!==DOMAIN_MAP_COLUMNS.length||!b.columns.every((c,i)=>c===DOMAIN_MAP_COLUMNS[i])||!b.sourceIds.length||b.sourceIds.some(s=>!sources.has(s)))return refuse();
  const row=b.rows[0];
  if(row.length!==DOMAIN_MAP_COLUMNS.length||!stable(row[0])||ids.has(row[0])||!stable(row[1])||!nodes.has(row[1])||!(row[2]===null||stable(row[2])&&nodes.has(row[2]))||!nonblank(row[3],120)||!['declared','illustrative','unresolved','rejected'].includes(String(row[4]))||!row.slice(5).every(v=>nonblank(v)))return refuse();
  const state=row[4] as DomainMapping['state'];
  if((state==='declared'||state==='illustrative')&&row[2]===null||row[1]===row[2])return refuse();
  if(state==='illustrative'&&b.provenance!=='synthetic'||state==='declared'&&b.provenance==='synthetic')return refuse();
  // A table must be attached to the source entity it describes, not a global stray
  // record whose source identity cannot be inspected by the reader.
  if(!doc.nodes.find(n=>n.id===row[1])?.blockIds.includes(bid))return refuse();
  ids.add(row[0]);
  result.push({id:row[0],fromId:row[1],toId:row[2] as string|null,relation:row[3],state,scope:row[5] as string,inputGrain:row[6] as string,outputGrain:row[7] as string,unitRule:row[8] as string,meaning:row[9] as string,blockId:bid,sourceIds:[...b.sourceIds]});
 }
 return result.sort((a,b)=>a.id.localeCompare(b.id));
}

/** Match a picked entity in the opposite permitted view. Exact identity outranks a
 * relation; direct authored relations are NOT transitive identity equivalences.
 * Multiple targets are offered together, never reduced to an arbitrary winner.
 * Reverse exploration is allowed, while each mapping keeps its authored direction. */
export function resolveDomainPick(leftIds:readonly string[],rightIds:readonly string[],side:'left'|'right',id:string,mappings:readonly DomainMapping[]):MappingPick{
 const origin=side==='left'?leftIds:side==='right'?rightIds:[];
 const destination=side==='left'?rightIds:leftIds;
 if(!origin.includes(id))return {state:'REFUSED',originId:null,targets:[],mappings:[]};
 if(destination.includes(id))return {state:'EXACT',originId:id,targets:[id],mappings:[]};
 const permitted=new Set([...leftIds,...rightIds]);
 const direct=mappings.filter(m=>(m.state==='declared'||m.state==='illustrative')&&m.toId!==null&&permitted.has(m.fromId)&&permitted.has(m.toId)&&((m.fromId===id&&destination.includes(m.toId))||(m.toId===id&&destination.includes(m.fromId))));
 const targets=[...new Set(direct.map(m=>m.fromId===id?m.toId!:m.fromId))].sort();
 return {state:targets.length>1?'CHOICE':targets.length?'RELATED':'ABSENT',originId:id,targets,mappings:direct.map(m=>({...m,sourceIds:[...m.sourceIds]}))};
}
