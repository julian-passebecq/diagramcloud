import type {Project} from './model';
import type {ExperiencePack} from '../experience/model';

/**
 * Item-by-item review of a proposed (often AI-written) document or experience pack: what was added, removed or
 * changed, with before → after per field, plus cautions for edits that AGENTS.md says a human must confirm
 * (publishing, relabelling synthetic data as sourced, replacing stable IDs, dropping sources, image rights).
 * Pure: nothing is applied here. Works on IDs, so a renamed label shows as a change, not a delete + add.
 */
export type FieldChange={field:string;before:string;after:string};
export type ItemChange={kind:'added'|'removed'|'changed';group:string;id:string;name:string;fields:FieldChange[]};
export type ChangeDetail={changes:ItemChange[];cautions:string[]};

export const GROUP_LABEL:Record<string,string>={project:'Project',nodes:'Components',edges:'Connections',views:'Views',blocks:'Evidence',assets:'Images',sources:'Sources',observations:'Observations',story:'Story steps',
 pack:'Evidence workspaces',entities:'Scopes',items:'Panels',workspaces:'Screens','pack-sources':'Workspace sources',relations:'Relations'};
const SINGULAR:Record<string,string>={nodes:'component',edges:'connection',views:'view',blocks:'evidence block',assets:'image',sources:'source',observations:'observation',story:'story step',
 entities:'scope',items:'panel',workspaces:'screen','pack-sources':'source',relations:'relation'};

type Rec=Record<string,unknown>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const clip=(s:string,n=90)=>s.length>n?s.slice(0,n-1)+'…':s;
const nameOf=(x:Rec)=>String(x.label??x.title??x.name??(typeof x.summary==='string'?clip(x.summary,70):x.id));
const plural=(n:number,w:string)=>`${n} ${n===1?w:w.endsWith('y')?w.slice(0,-1)+'ies':w+'s'}`;
const isStrings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string');
const isIdList=(v:unknown):v is {id:string}[]=>Array.isArray(v)&&v.length>0&&v.every(x=>!!x&&typeof x==='object'&&typeof (x as Rec).id==='string');

function show(v:unknown):string{
 if(v===undefined)return '—';
 if(v===null)return 'empty';
 if(typeof v==='string')return v?`“${clip(v)}”`:'(empty)';
 if(typeof v==='number'||typeof v==='boolean')return String(v);
 if(isStrings(v))return v.length?clip(v.join(', ')):'(none)';
 if(Array.isArray(v))return plural(v.length,'entry');
 return plural(Object.keys(v as object).length,'field');
}

/** Field-level differences between two versions of one object. */
export function fieldChanges(a:Rec,b:Rec):FieldChange[]{
 const out:FieldChange[]=[];
 for(const k of [...new Set([...Object.keys(a),...Object.keys(b)])]){
  const x=a[k],y=b[k];if(k==='id'||same(x,y))continue;
  if(k==='data'&&typeof x==='string'&&typeof y==='string'){out.push({field:k,before:'previous image',after:'replaced image'});continue;}
  if(isStrings(x)&&isStrings(y)){const add=y.filter(v=>!x.includes(v)),rem=x.filter(v=>!y.includes(v));
   out.push(add.length||rem.length?{field:k,before:rem.length?`− ${clip(rem.join(', '))}`:'',after:add.length?`+ ${clip(add.join(', '))}`:''}:{field:k,before:'',after:'reordered'});continue;}
  if((isIdList(x)||isIdList(y))&&Array.isArray(x??[])&&Array.isArray(y??[])){const d=byId((x??[]) as Rec[],(y??[]) as Rec[]);
   out.push({field:k,before:'',after:[d.added.length?`+${d.added.length}`:'',d.changed.length?`~${d.changed.length}`:'',d.removed.length?`−${d.removed.length}`:''].filter(Boolean).join(' ')||'reordered'});continue;}
  if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y)){const xs=x as Rec,ys=y as Rec,keys=new Set([...Object.keys(xs),...Object.keys(ys)]);
   const n=[...keys].filter(key=>!same(xs[key],ys[key])).length;out.push({field:k,before:'',after:k==='positions'?`${n} moved`:`${n} of ${plural(keys.size,'entry')} changed`});continue;}
  const before=show(x),after=show(y);
  out.push({field:k,before,after:before===after?`${after} (edited)`:after});
 }
 return out;
}

/** Everything a reviewer needs to judge an incoming observation: who says it, when, at which revision, and the caveat. */
const OBSERVATION_FIELDS=['nodeId','claim','sourceApp','authority','observedAt','sourceRevision','link','caveat','visibility','reviewedAt'];
function observationFields(x:Rec):FieldChange[]{return OBSERVATION_FIELDS.filter(k=>x[k]!==undefined&&x[k]!=='').map(k=>({field:k,before:'',after:typeof x[k]==='string'?clip(x[k] as string,200):show(x[k])}));}

function byId(current:Rec[],incoming:Rec[]){
 const before=new Map(current.map(i=>[String(i.id),i])),after=new Map(incoming.map(i=>[String(i.id),i]));
 return {before,after,added:[...after.keys()].filter(id=>!before.has(id)),removed:[...before.keys()].filter(id=>!after.has(id)),changed:[...after.keys()].filter(id=>before.has(id)&&!same(before.get(id),after.get(id)))};
}

function diffGroup(group:string,current:Rec[],incoming:Rec[],out:ChangeDetail){
 const d=byId(current,incoming),what=SINGULAR[group]??'item';
 for(const id of d.added){const x=d.after.get(id)!;out.changes.push({kind:'added',group,id,name:nameOf(x),fields:group==='observations'?observationFields(x):[]});
  if(group==='observations'){out.cautions.push(`New ${x.sourceApp} observation about ${String(x.nodeId)} claims “${String(x.claim)}” as of ${String(x.observedAt)} (revision ${String(x.sourceRevision)}). Check the source before you review it.`);
   if(x.reviewedAt)out.cautions.push(`Observation “${nameOf(x)}” arrives already marked reviewed. Review it yourself.`);
   if(x.visibility==='public')out.cautions.push(`Observation “${nameOf(x)}” arrives public.`);}
  if(x.provenance==='source-derived'&&isStrings(x.sourceIds)&&!x.sourceIds.length)out.cautions.push(`New ${what} “${nameOf(x)}” is labelled source-derived but cites no source.`);
  if(x.assertion==='verified-in-source'&&isStrings(x.sourceIds)&&!x.sourceIds.length)out.cautions.push(`New ${what} “${nameOf(x)}” claims to be verified in a source but cites none.`);}
 for(const id of d.removed)out.changes.push({kind:'removed',group,id,name:nameOf(d.before.get(id)!),fields:[]});
 for(const id of d.changed){const a=d.before.get(id)!,b=d.after.get(id)!,name=nameOf(b);
  out.changes.push({kind:'changed',group,id,name:name===nameOf(a)?name:`${nameOf(a)} → ${name}`,fields:fieldChanges(a,b)});
  if(a.visibility!=='public'&&b.visibility==='public'&&a.visibility!==undefined)out.cautions.push(`Makes ${what} “${name}” public.`);
  if(group==='observations'){if(!a.reviewedAt&&b.reviewedAt)out.cautions.push(`Marks observation “${name}” reviewed.`);if(!a.shareable&&b.shareable)out.cautions.push(`Marks observation “${name}” shareable in the portfolio index.`);if(a.claim!==b.claim)out.cautions.push(`Changes the claim of observation “${name}” from ${String(a.claim)} to ${String(b.claim)}. Only the source app can say this.`);}
  if(a.approval==='draft'&&b.approval==='approved')out.cautions.push(`Approves ${what} “${name}” for public export.`);
  if(a.provenance!==b.provenance&&(a.provenance==='synthetic'||b.provenance==='source-derived'))out.cautions.push(`Relabels ${what} “${name}” from ${a.provenance} to ${b.provenance}. Only do this when a real source backs it.`);
  if(a.assertion!==b.assertion&&b.assertion==='verified-in-source')out.cautions.push(`Marks ${what} “${name}” as verified in source.`);
  if(a.type==='kpi'&&b.type==='kpi'&&a.value!==b.value)out.cautions.push(`Changes the figure on ${what} “${name}” from ${String(a.value)} to ${String(b.value)}. Check it against the source; a portfolio figure is not a verified result.`);
  if(typeof a.rights==='string'&&a.rights!==b.rights)out.cautions.push(`Changes the image rights of “${name}”.`);}
 // A removed and an added item with the same name usually means an ID was replaced instead of the label being edited.
 for(const id of d.removed){const name=nameOf(d.before.get(id)!),twin=d.added.find(n=>nameOf(d.after.get(n)!)===name);
  if(twin)out.cautions.push(`${what[0].toUpperCase()+what.slice(1)} “${name}” is removed as ${id} and re-added as ${twin}. Keep the stable ID and edit the label instead.`);}
 if(group==='sources'||group==='pack-sources')for(const id of d.removed)out.cautions.push(`Removes source “${nameOf(d.before.get(id)!)}”.`);
 if(d.removed.length>=5||(current.length>=4&&d.removed.length/current.length>.25))out.cautions.push(`Removes ${d.removed.length} of ${plural(current.length,what)}.`);
}

const PROJECT_FIELDS=['title','summary','author','category','tags','rootViewId','provenance','privateNotes','portfolio'] as const;
const PACK_FIELDS=['title','rootId'] as const;
const steps=(s:Project['story'])=>s.map((x,k)=>({...x,id:`step-${k+1}`}) as unknown as Rec);

export function describePackChanges(current:ExperiencePack,incoming:ExperiencePack,out:ChangeDetail={changes:[],cautions:[]}):ChangeDetail{
 const meta=fieldChanges(Object.fromEntries(PACK_FIELDS.map(k=>[k,current[k]])),Object.fromEntries(PACK_FIELDS.map(k=>[k,incoming[k]])));
 if(meta.length)out.changes.push({kind:'changed',group:'pack',id:incoming.id,name:incoming.title,fields:meta});
 diffGroup('entities',current.entities as unknown as Rec[],incoming.entities as unknown as Rec[],out);
 diffGroup('workspaces',current.workspaces as unknown as Rec[],incoming.workspaces as unknown as Rec[],out);
 diffGroup('items',current.items as unknown as Rec[],incoming.items as unknown as Rec[],out);
 diffGroup('relations',current.relations as unknown as Rec[],incoming.relations as unknown as Rec[],out);
 diffGroup('pack-sources',current.sources as unknown as Rec[],incoming.sources as unknown as Rec[],out);
 out.cautions=[...new Set(out.cautions)];
 return out;
}

export function describeChanges(current:Project,incoming:Project):ChangeDetail{
 const out:ChangeDetail={changes:[],cautions:[]};
 const meta=fieldChanges(Object.fromEntries(PROJECT_FIELDS.map(k=>[k,current[k]])),Object.fromEntries(PROJECT_FIELDS.map(k=>[k,incoming[k]])));
 if(meta.length)out.changes.push({kind:'changed',group:'project',id:incoming.id,name:incoming.title,fields:meta});
 for(const g of ['nodes','edges','views','blocks','assets','sources','observations'] as const)diffGroup(g,current[g] as unknown as Rec[],incoming[g] as unknown as Rec[],out);
 diffGroup('story',steps(current.story),steps(incoming.story),out);
 if(current.experience&&incoming.experience)describePackChanges(current.experience,incoming.experience,out);
 else if(current.experience||incoming.experience)out.changes.push({kind:incoming.experience?'added':'removed',group:'pack',id:(incoming.experience??current.experience)!.id,name:(incoming.experience??current.experience)!.title,fields:[]});
 out.cautions=[...new Set(out.cautions)];
 return out;
}
