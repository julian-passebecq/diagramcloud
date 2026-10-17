/**
 * Development Atlas adapter, adopted from the preserved donor (ced0150 with the fixes of c5097e6 and b2a5b51):
 * a bounded `development-atlas/1` runtime projection onto the existing model, auto layout, ViewSpec, export scene,
 * architecture SVG and stable-ID delta. It is not a second renderer and adds no observation: runtime facts keep their
 * evidence basis in the Atlas, diagram nodes carry the unspecified design basis and the idle illustration status.
 * Not adopted: the donor's App.tsx hunk, its packages/development-core bundle (29d53f2), page.ts and c5ab19c.
 *
 * Local paths: `scope.repo`, `scope.worktree` and entity `data.path` / `data.worktreePath` only select which entities
 * a view shows. They never reach the projected document, its SVG or a delta; a label that is an absolute local path is
 * reduced to its last segment and a summary value that is one is dropped.
 */
import {validateDocument,type Project} from '../core/model';
import {layeredLayout} from '../core/layout';
import {viewSpec} from '../core/viewspec';
import {buildScene} from '../export/scene';
import {architectureSvg} from '../export/design/architecture';
import {compareView} from '../export/design/delta';
import {atlasEntities,validateDevelopmentAtlas,type DevelopmentAtlas} from './contracts';
export * from './contracts';
export const DEVELOPMENT_VIEWS=['repository-blueprint','active-work','branch-merge','agent-worktree','review-impact','evolution'] as const;
export type DevelopmentView=typeof DEVELOPMENT_VIEWS[number];
const titles:Record<DevelopmentView,string>={'repository-blueprint':'Repository blueprint','active-work':'Active work','branch-merge':'Branch / merge','agent-worktree':'Agent / worktree','review-impact':'Review / impact','evolution':'Evolution'};
const kinds:Record<DevelopmentView,string[]>={'repository-blueprint':['repository','worktree','component','file'],'active-work':['repository','worktree','change','file','component'],'branch-merge':['repository','branch','revision','worktree','review','ci','change'],'agent-worktree':['repository','worktree','agent','change'],'review-impact':['repository','change','file','review','ci','component'],'evolution':['repository','revision','change']};
/** An absolute local path (drive, UNC, POSIX root or home) reduced to its last segment; anything else unchanged. */
export function withoutLocalPath(text:string):string{
 if(!/^(?:[A-Za-z]:[\\/]|\\\\|\/|~[\\/])/.test(text.trim()))return text;
 const parts=text.trim().split(/[\\/]+/).filter(Boolean);return parts[parts.length-1]??'';
}
/** A summary value; an absolute local path is dropped entirely (its last segment can name a private checkout). */
const summaryValue=(value:unknown)=>{const text=String(value??'');return withoutLocalPath(text)===text?text:'';};
/** Runtime projection, separate from reviewed portfolio observations and design status. */
export function atlasToDiagramDocument(input:unknown):Project{
 const a=validateDevelopmentAtlas(input),entities=atlasEntities(a);
 const nodes=entities.map(e=>({id:e.id,label:withoutLocalPath(e.label)||e.id,kind:e.kind==='file'?'source':'process',provider:'Generic',summary:`${e.kind} · ${e.basis} · ${summaryValue(e.data.status??e.data.sha??e.data.branch)}`.slice(0,500),tags:[e.basis],status:'idle'}));
 const edges=a.relations.map(r=>({id:r.id,source:r.source,target:r.target,label:`${r.basis} · ${withoutLocalPath(r.label)}`.slice(0,160),kind:'dependency',basis:'unknown'}));
 const views=DEVELOPMENT_VIEWS.map(id=>{let files=0;const selected=entities.filter(e=>kinds[id].includes(e.kind)).filter(e=>!['repository-blueprint','active-work','review-impact'].includes(id)||!a.scope.worktree||e.kind==='repository'||e.kind==='review'||e.kind==='ci'||e.data.worktreePath===a.scope.worktree||e.data.path===a.scope.worktree).filter(e=>id!=='repository-blueprint'||e.kind!=='file'||e.data.blueprint===true).filter(e=>e.kind!=='file'||++files<=40);const ids=new Set(selected.map(e=>e.id));return {id,title:titles[id],description:`Runtime facts captured ${a.capturedAt}. File views show at most 40 files in the selected worktree; full facts stay in the Atlas inspector. Evidence bases remain in the Atlas; design status is not telemetry.`,nodeIds:selected.map(e=>e.id),edgeIds:edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>e.id),positions:{},perspective:id==='agent-worktree'?'agents':'git'};});
 const doc=validateDocument({schemaVersion:1,id:'development-atlas',title:withoutLocalPath(a.scope.project)||'Development Atlas',rootViewId:'active-work',provenance:'Runtime projection from development-atlas/1. No reviewed or published observations.',nodes,edges,views});
 for(const v of doc.views)v.positions=layeredLayout(doc,v.id,{maxColumns:6});
 return doc;
}
export function buildDevelopmentView(input:unknown,view:DevelopmentView='active-work'){
 const atlas=validateDevelopmentAtlas(input),document={...atlasToDiagramDocument(atlas),rootViewId:view},v=document.views.find(v=>v.id===view);
 if(!v)throw Error('Unknown development view');
 return {atlas,document,viewSpec:viewSpec(document,view,{now:new Date(atlas.capturedAt)}),scene:buildScene(document,v)};
}
export function renderDevelopmentSvg(input:unknown,view:DevelopmentView='active-work',theme:'light'|'dark'='light'){
 const atlas=validateDevelopmentAtlas(input),document={...atlasToDiagramDocument(atlas),rootViewId:view};
 if(!DEVELOPMENT_VIEWS.includes(view))throw Error('Unknown development view');
 return architectureSvg(document,view,{theme,now:new Date(atlas.capturedAt)},c=>({type:'development',label:'Development Atlas',positions:c.view.positions}));
}
export function compareDevelopmentViews(before:DevelopmentAtlas,after:DevelopmentAtlas,view:DevelopmentView='active-work'){
 return compareView({...atlasToDiagramDocument(before),rootViewId:view},{...atlasToDiagramDocument(after),rootViewId:view},view,new Date(after.capturedAt));
}
