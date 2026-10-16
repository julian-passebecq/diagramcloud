import type {LearningMapping,Project} from './model';
/** Deterministic 64-bit FNV-1a over canonical JSON: an identity of the target's evidence, not a proof of truth. */
function fnv64(text:string){let h1=0x811c9dc5,h2=0x01000193;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);h1=Math.imul(h1^c,0x01000193)>>>0;h2=Math.imul(h2^c^(i&0xff),0x01000193)>>>0;}return h1.toString(16).padStart(8,'0')+h2.toString(16).padStart(8,'0');}
const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value as object).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(value??null);
/**
 * Evidence fingerprint of a mapping target in one document. A component covers its kind, cited sources (title, location,
 * URL) and evidence blocks; a view covers its component and connection membership. Labels, summaries, positions and
 * designed status are presentation and do not change it. Undefined when the target does not exist in this document.
 */
export function targetFingerprint(doc:Project,target:{kind:'node'|'view';id:string}):string|undefined{
 if(target.kind==='view'){const v=doc.views.find(v=>v.id===target.id);return v?fnv64(canonical({kind:'view',id:v.id,nodeIds:[...v.nodeIds].sort(),edgeIds:[...v.edgeIds].sort()})):undefined;}
 const n=doc.nodes.find(n=>n.id===target.id);if(!n)return undefined;
 const sources=[...n.sourceIds].sort().map(id=>{const s=doc.sources.find(s=>s.id===id);return s?{id,title:s.title,location:s.location,url:s.url??null}:{id,missing:true};});
 const blocks=[...n.blockIds].sort().map(id=>doc.blocks.find(b=>b.id===id)??{id,missing:true});
 return fnv64(canonical({kind:'node',id:n.id,nodeKind:n.kind,sources,blocks}));
}
/**
 * Public projection of mappings, called by publicDocument after the public closure is known. Only public reviewed or
 * source-declared mappings whose target is kept, whose evidence still matches the authoring document, and that keep at
 * least one public citation survive. Suggestions, rejections and stale-target rows stay in the authoring document. The
 * public copy carries the fingerprint of the public target so its staleness reads the same as in authoring.
 */
export function publicLearningMappings(input:Project,out:Project,keep:{nodes:Set<string>;views:Set<string>;sources:Set<string>;blocks:Set<string>}):LearningMapping[]{
 return (input.learningMappings??[]).flatMap(m=>{
  if(m.visibility!=='public'||(m.state!=='reviewed'&&m.state!=='source-declared')||m.target.projectId!==input.id)return [];
  if(!(m.target.kind==='node'?keep.nodes:keep.views).has(m.target.id)||targetFingerprint(input,m.target)!==m.target.fingerprint)return [];
  const evidence={sourceIds:m.evidence.sourceIds.filter(id=>keep.sources.has(id)),blockIds:m.evidence.blockIds.filter(id=>keep.blocks.has(id))};
  if(!evidence.sourceIds.length&&!evidence.blockIds.length)return [];
  const fingerprint=targetFingerprint(out,m.target);if(!fingerprint)return [];
  const {note:_note,suggestedBy:_suggestedBy,...rest}=m;
  return [{...rest,...(m.origin==='ai'?{suggestedBy:'ai'}:{}),target:{...m.target,fingerprint},evidence}];
 });
}
