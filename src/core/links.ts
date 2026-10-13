/**
 * Plain deep links between Datapass Galaxy apps: `?project=<id>&view=<id>&node=<id>`. DataPass VS Code uses them
 * for “Open in DiagramCloud”, Mongoku for “Open architecture/evidence”. Only stable IDs travel; nothing else.
 */
const ID=/^[a-z][a-z0-9_.-]{0,79}$/;
const LIBRARY_ID=/^[a-z0-9][a-z0-9._-]{0,119}$/;
export type LibraryTarget={kind:'collection'|'publication';id:string};
export type DeepLink={project?:string;view?:string;node?:string;collection?:string;publication?:string};
export function libraryTargetForLink(link:DeepLink):LibraryTarget|undefined{return link.collection?{kind:'collection',id:link.collection}:link.publication?{kind:'publication',id:link.publication}:undefined;}

export function deepLink(base:string,target:DeepLink):string{
 const url=new URL(base);url.search='';url.hash='';
 if(target.collection&&target.publication)throw new Error('Choose one library link target');
 if(!target.project&&!target.collection&&!target.publication)throw new Error('A link needs a project or library target');
 for(const key of ['project','view','node','collection','publication'] as const){const value=target[key];if(value){if(!(key==='collection'||key==='publication'?LIBRARY_ID:ID).test(value))throw new Error('Invalid stable link target');url.searchParams.set(key,value);}}
 return url.toString();
}

/** Reads a deep link; any value that is not a stable ID is ignored. */
export function readDeepLink(search:string):DeepLink|null{
 const q=new URLSearchParams(search),pick=(k:string)=>{const v=q.get(k);return v&&ID.test(v)?v:undefined;};
 const library=(k:string)=>{const value=q.get(k);return value&&LIBRARY_ID.test(value)?value:undefined;},collection=library('collection'),publication=library('publication');
 if(q.has('collection')&&!collection||q.has('publication')&&!publication||collection&&publication)return null;
 const project=pick('project');if(!project&&!collection&&!publication)return null;
 const view=pick('view'),node=pick('node');
 return {...(project?{project}:{}),...(view?{view}:{}),...(node?{node}:{}),...(collection?{collection}:{}),...(publication?{publication}:{})};
}
