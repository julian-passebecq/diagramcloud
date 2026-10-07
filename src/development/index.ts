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
/** Runtime projection, separate from reviewed portfolio observations and design status. */
export function atlasToDiagramDocument(input:unknown):Project{
 const a=validateDevelopmentAtlas(input),entities=atlasEntities(a);
 const nodes=entities.map(e=>({id:e.id,label:e.label,kind:e.kind==='file'?'source':'process',provider:e.kind,summary:`${e.basis} · ${String(e.data.status??e.data.sha??e.data.branch??'')}`.slice(0,500),basis:'unknown',tags:[e.basis],status:'idle'}));
 const edges=a.relations.map(r=>({id:r.id,source:r.source,target:r.target,label:`${r.basis} · ${r.label}`.slice(0,160),kind:'dependency',basis:'unknown'}));
 const views=DEVELOPMENT_VIEWS.map(id=>{const selected=entities.filter(e=>kinds[id].includes(e.kind)).filter(e=>id!=='active-work'||!a.scope.worktree||e.kind==='repository'||e.data.worktreePath===a.scope.worktree||e.data.path===a.scope.worktree||e.kind==='component');const ids=new Set(selected.map(e=>e.id));return {id,title:titles[id],description:`Runtime facts captured ${a.capturedAt}. Evidence bases remain in the Atlas; design status is not telemetry.`,nodeIds:selected.map(e=>e.id),edgeIds:edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>e.id),positions:{},perspective:id==='agent-worktree'?'agents':'git'};});
 const doc=validateDocument({schemaVersion:1,id:'development-atlas',title:a.scope.project,rootViewId:'active-work',provenance:'Runtime projection from development-atlas/1. No reviewed or published observations.',nodes,edges,views});
 for(const v of doc.views)v.positions=layeredLayout(doc,v.id,{maxColumns:6});
 return doc;
}
export function buildDevelopmentView(input:unknown,view:DevelopmentView='active-work'){
 const atlas=validateDevelopmentAtlas(input),document={...atlasToDiagramDocument(atlas),rootViewId:view},v=document.views.find(v=>v.id===view);
 if(!v)throw Error('Unknown development view');
 return {atlas,document,viewSpec:viewSpec(document,view,{now:new Date(atlas.capturedAt)}),scene:buildScene(document,v)};
}
export function renderDevelopmentSvg(input:unknown,view:DevelopmentView='active-work',theme:'light'|'dark'='light'){
 const {document,atlas}=buildDevelopmentView(input,view);
 return architectureSvg(document,view,{theme,now:new Date(atlas.capturedAt)},c=>({type:'development',label:'Development Atlas',positions:c.view.positions}));
}
export function compareDevelopmentViews(before:DevelopmentAtlas,after:DevelopmentAtlas,view:DevelopmentView='active-work'){
 return compareView({...atlasToDiagramDocument(before),rootViewId:view},{...atlasToDiagramDocument(after),rootViewId:view},view,new Date(after.capturedAt));
}
