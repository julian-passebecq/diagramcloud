/**
 * Plain deep links between Datapass Galaxy apps: `?project=<id>&view=<id>&node=<id>`. DataPass VS Code uses them
 * for “Open in DiagramCloud”, Mongoku for “Open architecture/evidence”. Only stable IDs travel; nothing else.
 */
const ID=/^[a-z][a-z0-9_.-]{0,79}$/;
export type DeepLink={project:string;view?:string;node?:string};

export function deepLink(base:string,target:DeepLink):string{
 const url=new URL(base);url.search='';url.hash='';
 for(const key of ['project','view','node'] as const){const value=target[key];if(value)url.searchParams.set(key,value);}
 return url.toString();
}

/** Reads a deep link; any value that is not a stable ID is ignored. */
export function readDeepLink(search:string):DeepLink|null{
 const q=new URLSearchParams(search),pick=(k:string)=>{const v=q.get(k);return v&&ID.test(v)?v:undefined;};
 const project=pick('project');if(!project)return null;
 const view=pick('view'),node=pick('node');
 return {project,...(view?{view}:{}),...(node?{node}:{})};
}
