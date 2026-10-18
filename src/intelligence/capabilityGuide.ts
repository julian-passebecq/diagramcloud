import {validateDocument, type Project} from '../core/model';

/** An explicit authoring brief, NOT a source scanner, live feature registry or new persisted Project schema.
 * Output goes through the ordinary import/review/save path. No observations or permissions are generated.
 */
export const CAPABILITY_SECTION_KINDS=['use','implementation','origins','assurance','limits','economics'] as const;
export type CapabilitySectionKind=typeof CAPABILITY_SECTION_KINDS[number];
export const CAPABILITY_AXES=['lifecycle','selection','implementation','verification','distribution','runtime'] as const;
type Basis='planned'|'static-source'|'unknown';
type Visibility='private'|'public';
export type GuideSource={id:string;title:string;location:string;url?:string;visibility:Visibility};
export type GuideSection={kind:CapabilitySectionKind;text:string;sourceIds:string[];basis:Basis;visibility:Visibility};
export type GuideState={facet:typeof CAPABILITY_AXES[number];value:string;scope:string;sourceIds:string[]};
export type GuideTechnology={id:string;title:string;kind:string;version:string|null;explanation:string;sourceIds:string[];visibility:Visibility};
export type GuideCapability={id:string;title:string;goal:string;surfaces:string[];version:string;environment:string;
 basis:Basis;visibility:Visibility;sourceIds:string[];sections:GuideSection[];states:GuideState[];
 uses:{technologyId:string;relation:string;basis:Basis;sourceIds:string[]}[]};
export type CapabilityGuideInput={id:string;title:string;summary:string;visibility:Visibility;capturedAt:string;
 sourceCut:{repository:string;revision:string}[];sources:GuideSource[];capabilities:GuideCapability[];technologies:GuideTechnology[]};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function fail():never{throw Error('Invalid capability guide. Check the explicit source, scope, references and bounded fields.');}
function keys(x:unknown,required:string[],optional:string[]=[]):asserts x is Record<string,unknown>{
 if(!object(x)||required.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>!required.includes(k)&&!optional.includes(k)))fail();
}
const text=(v:unknown,max=2000):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_.-]{0,34}$/.test(v);
const visibility=(v:unknown):v is Visibility=>v==='private'||v==='public';
const basis=(v:unknown):v is Basis=>['planned','static-source','unknown'].includes(String(v));
const list=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max;
const unique=(xs:string[])=>new Set(xs).size===xs.length;
function refs(v:unknown,known:Set<string>):asserts v is string[]{if(!list(v,20)||!v.every(x=>id(x)&&known.has(x))||!unique(v as string[]))fail();}
function safeLink(v:unknown):boolean{try{const u=new URL(String(v));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&![...u.searchParams.keys()].some(k=>/^(?:token|access_token|api_?key|key|sig|signature|private_token|authorization|x-amz-.+)$/i.test(k));}catch{return false;}}

/** Validate the whole authored brief before producing any candidate. Unknown fields are not silently dropped. */
export function validateCapabilityGuide(input:unknown):CapabilityGuideInput{
 let raw:string;try{raw=JSON.stringify(input);}catch{return fail();}if(!raw||new TextEncoder().encode(raw).length>1_000_000)fail();
 keys(input,['id','title','summary','visibility','capturedAt','sourceCut','sources','capabilities','technologies']);
 if(!id(input.id)||!text(input.title,160)||!text(input.summary,3000)||!visibility(input.visibility)||!text(input.capturedAt,40)||
 !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(input.capturedAt)||!Number.isFinite(Date.parse(input.capturedAt))||
 !list(input.sourceCut,30)||!input.sourceCut.length||!list(input.sources,180)||!list(input.capabilities,36)||!list(input.technologies,80))fail();
 const sourceIds=new Set<string>(),technologyIds=new Set<string>(),capabilityIds=new Set<string>(),repos=new Set<string>(),surfaces=new Set<string>();
 for(const s of input.sourceCut){keys(s,['repository','revision']);if(!text(s.repository,500)||!text(s.revision,120)||repos.has(s.repository)||/[\r\n]/.test(s.repository+s.revision))fail();repos.add(s.repository);}
 for(const s of input.sources){keys(s,['id','title','location','visibility'],['url']);if(!id(s.id)||sourceIds.has(s.id)||!text(s.title,160)||!text(s.location,2000)||!visibility(s.visibility)||(s.url!==undefined&&!safeLink(s.url)))fail();sourceIds.add(s.id);}
 for(const t of input.technologies){keys(t,['id','title','kind','version','explanation','sourceIds','visibility']);if(!id(t.id)||technologyIds.has(t.id)||!text(t.title,160)||!text(t.kind,60)||(t.version!==null&&!text(t.version,100))||!text(t.explanation)||!visibility(t.visibility))fail();refs(t.sourceIds,sourceIds);technologyIds.add(t.id);}
 for(const c of input.capabilities){keys(c,['id','title','goal','surfaces','version','environment','basis','visibility','sourceIds','sections','states','uses']);
  if(!id(c.id)||capabilityIds.has(c.id)||!text(c.title,160)||!text(c.goal,500)||(!list(c.surfaces,12)||!c.surfaces.length||!c.surfaces.every(v=>text(v,60))||!unique(c.surfaces as string[]))||!text(c.version,100)||!text(c.environment,160)||!basis(c.basis)||!visibility(c.visibility)||!list(c.sections,6)||!list(c.states,60)||!list(c.uses,20))fail();
  refs(c.sourceIds,sourceIds);if(c.basis==='static-source'&&!c.sourceIds.length)fail();capabilityIds.add(c.id);for(const surface of c.surfaces as string[])surfaces.add(surface);if(surfaces.size>36)fail();
  const sections=new Set<string>(),axes=new Set<string>(),uses=new Set<string>();
  for(const s of c.sections){keys(s,['kind','text','sourceIds','basis','visibility']);if(!CAPABILITY_SECTION_KINDS.includes(s.kind as CapabilitySectionKind)||sections.has(String(s.kind))||!text(s.text,10000)||!basis(s.basis)||!visibility(s.visibility))fail();refs(s.sourceIds,sourceIds);if(s.basis==='static-source'&&!s.sourceIds.length)fail();sections.add(String(s.kind));}
  for(const s of c.states){keys(s,['facet','value','scope','sourceIds']);if(!CAPABILITY_AXES.includes(s.facet as typeof CAPABILITY_AXES[number])||axes.has(JSON.stringify([s.facet,s.value,s.scope]))||!text(s.value,160)||!text(s.scope,160))fail();refs(s.sourceIds,sourceIds);if(!s.sourceIds.length)fail();axes.add(JSON.stringify([s.facet,s.value,s.scope]));}
  for(const u of c.uses){keys(u,['technologyId','relation','basis','sourceIds']);if(!id(u.technologyId)||!technologyIds.has(u.technologyId)||uses.has(u.technologyId)||!text(u.relation,120)||!basis(u.basis))fail();refs(u.sourceIds,sourceIds);if(u.basis==='static-source'&&!u.sourceIds.length)fail();uses.add(u.technologyId);}
 }
 return structuredClone(input) as CapabilityGuideInput;
}

/** Materialize into existing nodes/views/text/table/source blocks, never infer completeness from entrypoint presence.
 * All text is inert; sourceCut records author-supplied scope, not an attestation or an installed artifact identity.
 * Public eligibility is conservative: a section with any private citation is entirely private, not text-redacted.
 */
export function compileCapabilityGuide(input:unknown):Project{
 const x=validateCapabilityGuide(input),d=validateDocument({schemaVersion:1,id:x.id,title:x.visibility==='public'?x.title:'Capability guide',
 summary:x.visibility==='public'?x.summary:'Open the permitted capabilities to inspect goals, usage, implementation, provenance and evidence.',
 rootViewId:'guide-root',category:'Reference',tags:['Capability guide'],provenance:'Explicit source-bound authoring brief. No code, tool, scan or provider is executed. No observation or approval is created.',
 nodes:[],edges:[],views:[{id:'guide-root',title:'Capability guide',nodeIds:[],edgeIds:[],positions:{},visibility:'public'}]});
 d.sources=x.sources.map(s=>({...s}));
 const sourceMap=new Map(x.sources.map(s=>[s.id,s]));
 const exposure=(own:Visibility,ids:string[],parent:Visibility=x.visibility):Visibility=>
  parent==='public'&&own==='public'&&ids.every(k=>sourceMap.get(k)?.visibility==='public')?'public':'private';
 const addView=(vid:string,title:string,nodeIds:string[],edgeIds:string[]=[],vis:Visibility='private')=>{
  const positioned=[...nodeIds.filter(id=>d.nodes.find(n=>n.id===id)?.visibility==='public'),...nodeIds.filter(id=>d.nodes.find(n=>n.id===id)?.visibility!=='public')];
  d.views.push({id:vid,title,description:'Supplied records only. Missing evidence is not proof of missing functionality.',nodeIds,edgeIds,visibility:vis,
   positions:Object.fromEntries(positioned.map((n,i)=>[n,{x:(i%3)*320,y:Math.floor(i/3)*180}]))});
 };
 const addNode=(nid:string,label:string,summary:string,b:Basis,vis:Visibility,sourceIds:string[]=[],childViewId?:string)=>{
  d.nodes.push({id:nid,label,summary,kind:'app',provider:'Generic',icon:'generic',role:'',status:'idle',basis:b,visibility:vis,
   blockIds:[],sourceIds:[...sourceIds],tags:['capability-guide'],...(childViewId?{childViewId}: {})});
 };
 const addBlock=(nodeId:string,b:Project['blocks'][number])=>{d.blocks.push(b);d.nodes.find(n=>n.id===nodeId)!.blockIds.push(b.id);};
 const allCaps:string[]=[],allTech:string[]=[],surfaceGroups=new Map<string,string[]>();
 for(const c of x.capabilities){const nid=`cap.${c.id}`,vis=exposure(c.visibility,c.sourceIds),detail=`detail.${c.id}`;
  allCaps.push(nid);addNode(nid,c.title,c.goal,c.basis,vis,c.sourceIds,detail);
  const sections:string[]=[],sourceIds=[...new Set(c.states.flatMap(s=>s.sourceIds))];
  const statesVis=exposure(vis,sourceIds,vis),statusId=`status.${c.id}`;
  addNode(statusId,'Scope and source claims','Dated declarations; not a computed current availability verdict.','planned',statesVis,sourceIds);sections.push(statusId);
  addBlock(statusId,{id:`scope.${c.id}`,title:'Selected capability scope',type:'text',provenance:'author',visibility:statesVis,sourceIds:[...c.sourceIds],
   text:`${c.title}\nSurfaces: ${c.surfaces.join(', ')}\nVersion: ${c.version}\nEnvironment: ${c.environment}\nCaptured: ${x.capturedAt}\nDeclarations below may coexist. A frozen lifecycle does not remove a previously delivered feature.`});
  addBlock(statusId,{id:`states.${c.id}`,title:'Independent source claims',type:'table',provenance:'author',visibility:statesVis,sourceIds,
   columns:['Axis','Supplied value','Scope'],rows:CAPABILITY_AXES.flatMap(axis=>{const claims=c.states.filter(t=>t.facet===axis);return claims.length?claims.map(s=>[axis,s.value,s.scope]):[[axis,'UNKNOWN - not supplied','Not supplied']];})});
  for(const s of c.sections){const sid=`section.${c.id}.${s.kind}`,svis=exposure(s.visibility,s.sourceIds,vis);sections.push(sid);
   addNode(sid,{use:'How to use',implementation:'How it is built',origins:'Origins and reuse',assurance:'Checks and trust boundaries',limits:'Limits and alternatives',economics:'Cost evidence'}[s.kind],
    `${s.basis}; read the supplied detail and sources. No action executes.`,s.basis,svis,s.sourceIds);
   addBlock(sid,{id:`text.${c.id}.${s.kind}`,title:d.nodes[d.nodes.length-1].label,type:'text',text:s.text,sourceIds:[...s.sourceIds],provenance:s.basis==='static-source'?'source-derived':'author',visibility:svis});
  }
  addView(detail,c.title,sections,[],vis);
  for(const surface of c.surfaces){const members=surfaceGroups.get(surface)??[];members.push(nid);surfaceGroups.set(surface,members);}
 }
 for(const t of x.technologies){const nid=`tech.${t.id}`,vis=exposure(t.visibility,t.sourceIds);allTech.push(nid);
  addNode(nid,t.title,`${t.kind}; version ${t.version??'UNKNOWN'}. Package presence does not prove feature use.`,'planned',vis,t.sourceIds);
  addBlock(nid,{id:`technology.${t.id}`,title:t.title,type:'text',text:t.explanation,sourceIds:[...t.sourceIds],provenance:'author',visibility:vis});
 }
 const links:string[]=[];
 for(const c of x.capabilities)for(const u of c.uses){const eid=`uses.${c.id}.${u.technologyId}`;
  const from=d.nodes.find(n=>n.id===`cap.${c.id}`)!,to=d.nodes.find(n=>n.id===`tech.${u.technologyId}`)!;
  // Edge has no native sourceIds. Bind explicit relationship evidence to the capability as a labelled text block.
  const vis=exposure(from.visibility,u.sourceIds,to.visibility);links.push(eid);
  d.edges.push({id:eid,source:from.id,target:to.id,label:u.relation,kind:'dependency',speed:'medium',basis:u.basis,visibility:vis});
  addBlock(from.id,{id:`reuse.${c.id}.${u.technologyId}`,title:'Supplied reuse relation',type:'text',text:`${c.title} -> ${to.label}: ${u.relation}. Basis: ${u.basis}. This is an explicit association, not inferred runtime usage.`,sourceIds:[...u.sourceIds],provenance:u.basis==='static-source'?'source-derived':'author',visibility:vis});
 }
 addNode('guide.capabilities','Capabilities','What can this application do, and how is each capability used?','planned',x.visibility,[],'guide-list');
 addNode('guide.surfaces','Interfaces','The same capabilities grouped by supplied entry surface, without duplicate identities.','planned',x.visibility,[],'guide-surfaces');
 addNode('guide.implementation','Implementation and reuse','Explicit capability-to-technology associations. Not an automatically inferred dependency map.','planned',x.visibility,[],'guide-implementation');
 addBlock('guide.capabilities',{id:'guide-context',title:'Original guide context (private)',type:'text',text:JSON.stringify({title:x.title,summary:x.summary,sourceCut:x.sourceCut},null,2),sourceIds:[],visibility:'private',provenance:'author'});
 addView('guide-list','Capability catalogue',allCaps,[],x.visibility);
 addView('guide-implementation','Implementation and reuse',[...allCaps,...allTech],links,x.visibility);
 const surfaceNodes:string[]=[],surfaceKeys=new Set<string>();
 for(const [surface,members] of surfaceGroups){let hash=14695981039346656037n;for(const ch of surface){hash=BigInt.asUintN(64,(hash^BigInt(ch.codePointAt(0)!))*1099511628211n);}const key=hash.toString(16);if(surfaceKeys.has(key))fail();surfaceKeys.add(key);const sid=`surface.${key}`,vid=`surface-view.${key}`;
  // Membership of a hidden capability may not create a public surface label.
  const vis:Visibility=members.some(n=>d.nodes.find(v=>v.id===n)?.visibility==='public')?'public':'private';
  addNode(sid,surface,'Supplied interface grouping; not a deployment or execution grant.','planned',vis,[],vid);surfaceNodes.push(sid);addView(vid,surface,members,[],vis);
 }
 addView('guide-surfaces','Entry surfaces',surfaceNodes,[],x.visibility);
 const root=d.views[0];root.nodeIds=['guide.capabilities','guide.surfaces','guide.implementation'];root.positions=Object.fromEntries(root.nodeIds.map((n,i)=>[n,{x:i*320,y:0}]));
 if(x.visibility==='public')d.story=[{title:'Start with the user goal',viewId:'guide-list',narration:'Each capability links a user goal to its scope, usage, implementation and evidence. Declared does not mean qualified.',highlightEdgeIds:[]},
  {title:'Inspect the entry surface',viewId:'guide-surfaces',narration:'Browse by interface without treating every command, endpoint or tool as a separately proven feature.',highlightEdgeIds:[]}];
 return validateDocument(d);
}
